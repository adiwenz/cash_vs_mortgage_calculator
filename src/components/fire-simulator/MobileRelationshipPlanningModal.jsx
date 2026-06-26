import React, { useState, useMemo, useEffect } from 'react';
import { Wallet, TrendingUp, Home, Target, User, Check, X, ArrowLeft, AlertTriangle } from 'lucide-react';
import { runFireSimulation } from '../../fireCalculations';
import { formatCurrency } from './helpers';
import { CurrencyInput, PercentInput } from '../ui/PlainInputs';
import { calculateCombinedIncome, calculateMarriageEstimates, getSavingsBreakdown } from '../../domain/events/marriage/marriageImpact';
import { validateWeddingCostFunding } from '../../domain/events/marriage/marriageValidation';
import { createMarriageEventObject, createSpouseRecord } from '../../domain/events/marriage/marriageEventFactory';

export default function MobileRelationshipPlanningModal({
  scenario,
  eventController,
  simulation,
  uiState,
  onClose,
  handleSetBudgetClick,
  setIsBudgetOpenFromMarriageWizard
}) {
  const inputs = scenario?.inputs || {};
  const editingEvent = eventController?.editingEvent;
  const handleSaveEvent = eventController?.handleSaveEvent;
  const handleDeleteEvent = eventController?.handleDeleteEvent;

  const currentAge = inputs.currentAge !== undefined ? Number(inputs.currentAge) : 30;
  const lifeExpectancy = inputs.lifeExpectancy !== undefined ? Number(inputs.lifeExpectancy) : 85;

  const [draftEvent, setDraftEvent] = useState(() => {
    const relationshipType = editingEvent?.relationshipType || (editingEvent?.type === 'marriage' ? 'married' : (editingEvent?.type === 'domesticPartnership' ? 'domestic_partnership' : 'partner'));
    const defaultType = relationshipType === 'married' ? 'marriage' : (relationshipType === 'domestic_partnership' ? 'domesticPartnership' : 'relationshipBegins');
    const type = editingEvent?.type || defaultType || 'marriage';
    return {
      id: editingEvent?.id && !['marriage', 'domesticPartnership', 'relationshipBegins'].includes(editingEvent.id) ? editingEvent.id : `${type}-${Date.now()}`,
      type,
      relationshipType,
      age: editingEvent?.age !== undefined ? editingEvent.age : currentAge,
      spouseName: editingEvent?.spouseName || (relationshipType === 'married' ? 'Spouse' : 'Partner'),
      spouseCurrentAge: editingEvent?.spouseCurrentAge !== undefined ? editingEvent.spouseCurrentAge : currentAge,
      spouseIncome: editingEvent?.spouseIncome !== undefined ? editingEvent.spouseIncome : 50000,
      savingsRate: editingEvent?.savingsRate !== undefined ? editingEvent.savingsRate : 15,
      cash: editingEvent?.cash !== undefined ? editingEvent.cash : 5000,
      investments: editingEvent?.investments !== undefined ? editingEvent.investments : 0,
      retirement: editingEvent?.retirement !== undefined ? editingEvent.retirement : 0,
      debtStudent: editingEvent?.debtStudent !== undefined ? editingEvent.debtStudent : 0,
      debtCredit: editingEvent?.debtCredit !== undefined ? editingEvent.debtCredit : 0,
      debtOther: editingEvent?.debtOther !== undefined ? editingEvent.debtOther : 0,
      spouseDesiredRetirementAge: editingEvent?.spouseDesiredRetirementAge !== undefined && editingEvent?.spouseDesiredRetirementAge !== null ? editingEvent.spouseDesiredRetirementAge : null,
      spouseLifeExpectancy: editingEvent?.spouseLifeExpectancy !== undefined ? editingEvent.spouseLifeExpectancy : 85,
      spouseSocialSecurityAge: editingEvent?.spouseSocialSecurityAge !== undefined ? editingEvent.spouseSocialSecurityAge : 67,
      spouseEstimatedSocialSecurityBenefit: editingEvent?.spouseEstimatedSocialSecurityBenefit !== undefined ? editingEvent.spouseEstimatedSocialSecurityBenefit : 0,
      includeWeddingCost: editingEvent?.includeWeddingCost !== undefined ? !!editingEvent.includeWeddingCost : true,
      weddingCost: editingEvent?.weddingCost !== undefined ? editingEvent.weddingCost : 20000,
      weddingAge: editingEvent?.weddingAge !== undefined ? editingEvent.weddingAge : (editingEvent?.age !== undefined ? editingEvent.age : currentAge),
      weddingFundingMethod: editingEvent?.weddingFundingMethod !== undefined ? editingEvent.weddingFundingMethod : 'savings',
      weddingInterestRate: editingEvent?.weddingInterestRate !== undefined ? editingEvent.weddingInterestRate : 7,
      weddingPayoffTimeline: editingEvent?.weddingPayoffTimeline !== undefined ? editingEvent.weddingPayoffTimeline : 10,
      weddingHasPaymentPlan: editingEvent?.weddingHasPaymentPlan !== undefined ? !!editingEvent.weddingHasPaymentPlan : true,
      filingStatus: editingEvent?.filingStatus || 'jointly',
      incomeGrowthRate: editingEvent?.incomeGrowthRate || 3,
      housingOption: editingEvent?.housingOption || 'move',
      lifestyleOption: editingEvent?.lifestyleOption || 'same',
      livingTogether: editingEvent?.livingTogether !== false,
      combineFinances: editingEvent?.combineFinances !== false
    };
  });

  const isShortFlow = draftEvent.relationshipType === 'partner' || draftEvent.relationshipType === 'engaged';

  const STEPS = [
    "congrats",
    "partnerProfile",
    ...(isShortFlow ? [] : ["weddingPlan"]),
    "sharedSavings",
    "impactComparison",
    "retirementImpact",
    "finalSummary",
  ];

  const [step, setStep] = useState("congrats");
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [error, setError] = useState(null);

  // Keep wedding age in sync if marriage age changes and wedding age was same
  const handleMarriageAgeChange = (val) => {
    const parsed = parseInt(val) || currentAge;
    setDraftEvent(prev => {
      const wasSame = prev.weddingAge === prev.age;
      return {
        ...prev,
        age: parsed,
        weddingAge: wasSame ? parsed : prev.weddingAge
      };
    });
  };

  // Run Calculations
  const userIncome = Number(inputs.simpleIncome) || 50000;
  const userSavingsRate = Number(inputs.preTaxSavingsRate) || 15;
  const combinedIncome = calculateCombinedIncome(userIncome, draftEvent.spouseIncome);

  const {
    userAssets,
    spouseAssets,
    combinedAssets,
    userDebt,
    spouseDebt,
    combinedDebt,
    isSavingsDisabled,
    fundingGap,
    postWeddingFinancedDebt,
    postWeddingNetWorth,
    isNetWorthBelowZero
  } = validateWeddingCostFunding(draftEvent, inputs);

  // User spending pre-retirement baseline
  let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
  const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
  if (initialPhase) {
    if (initialPhase.frequency === 'monthly') {
      userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
    } else if (initialPhase.frequency === 'yearly') {
      userSpendingPreRetirement = Number(initialPhase.amount) || 0;
    } else {
      userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
    }
  }

  const estimates = calculateMarriageEstimates(draftEvent, inputs);
  const partnerSavings = estimates ? estimates.partnerSavings : 0;
  const partnerTakeHomeRemaining = estimates ? estimates.partnerTakeHomeRemaining : 0;
  const combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
  const savingsBreakdown = estimates ? estimates.savingsBreakdown : getSavingsBreakdown(draftEvent, inputs);

  const partnerPersonalSpending = Math.round(partnerTakeHomeRemaining / 12);
  const hasLowCombinedSpendingWarning = combinedSpendingVal <= userSpendingPreRetirement;
  const hasZeroPartnerSpendingWarning = partnerPersonalSpending === 0;

  // Monthly budget preview calculations
  const userSavingsMonthly = Object.values(inputs.budgetDetails?.savings || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const userFlatSavings = (Number(inputs.simpleIncome) || 50000) * ((Number(inputs.preTaxSavingsRate) || 15) / 100) / 12;
  const userSavings = userSavingsMonthly > 0 ? userSavingsMonthly : Math.round(userFlatSavings);
  const partnerSavingsMonthly = partnerSavings / 12;
  const combinedSavings = userSavings + partnerSavingsMonthly;
  const surplusMonthly = combinedIncome / 12 - combinedSpendingVal / 12;
  const leftoverGap = surplusMonthly - combinedSavings;

  // Run projections for Screen 6
  const beforeInputs = useMemo(() => {
    return {
      ...inputs,
      lifeEvents: (inputs.lifeEvents || []).filter(e => e.type !== 'marriage' && e.type !== 'domesticPartnership' && e.type !== 'relationshipBegins')
    };
  }, [inputs]);

  const afterInputs = useMemo(() => {
    return {
      ...inputs,
      lifeEvents: [
        ...(inputs.lifeEvents || []).filter(e => e.type !== 'marriage' && e.type !== 'domesticPartnership' && e.type !== 'relationshipBegins'),
        {
          ...createMarriageEventObject(draftEvent, inputs),
          enabled: true
        }
      ],
      householdMembers: [
        ...(inputs.householdMembers || []).filter(m => m.id !== 'spouse'),
        {
          ...createSpouseRecord(draftEvent, inputs),
          desiredRetirementAge: null // Forces spouse to retire at same age as user in preview
        }
      ]
    };
  }, [inputs, draftEvent]);

  const beforeReadyAge = useMemo(() => {
    if (step !== 'retirementImpact' && step !== 'finalSummary') return null;
    const res = runFireSimulation(beforeInputs);
    return res.retirementReadyAge;
  }, [step, beforeInputs]);

  const afterReadyAge = useMemo(() => {
    if (step !== 'retirementImpact' && step !== 'finalSummary') return null;
    const res = runFireSimulation(afterInputs);
    return res.retirementReadyAge;
  }, [step, afterInputs]);

  const validateStep = (currentStep) => {
    if (currentStep === 'partnerProfile') {
      const marriageAge = Number(draftEvent.age);
      const partnerAge = Number(draftEvent.spouseCurrentAge);
      const savingsRate = Number(draftEvent.savingsRate);
      const lifeExp = Number(draftEvent.spouseLifeExpectancy);
      const ssAge = Number(draftEvent.spouseSocialSecurityAge);

      if (isNaN(marriageAge) || marriageAge < currentAge) {
        setValidationError(`${draftEvent.relationshipType === 'married' ? 'Marriage Age' : 'Relationship Age'} must be greater than or equal to your current age (${currentAge}).`);
        return false;
      }
      if (isNaN(partnerAge) || partnerAge <= 0) {
        setValidationError("Partner Current Age must be greater than 0.");
        return false;
      }
      if (isNaN(savingsRate) || savingsRate < 0 || savingsRate > 100) {
        setValidationError("Savings Rate must be between 0 and 100.");
        return false;
      }
      if (isNaN(lifeExp) || lifeExp <= 0) {
        setValidationError("Partner Life Expectancy must be greater than 0.");
        return false;
      }
      if (isNaN(ssAge) || ssAge <= 0) {
        setValidationError("Partner Social Security Age must be greater than 0.");
        return false;
      }
    }

    if (currentStep === 'weddingPlan' && draftEvent.includeWeddingCost && !isShortFlow) {
      const weddingAge = Number(draftEvent.weddingAge);
      const weddingCost = Number(draftEvent.weddingCost);

      if (isNaN(weddingAge) || weddingAge < currentAge) {
        setValidationError(`${draftEvent.relationshipType === 'married' ? 'Wedding Age' : 'Celebration Age'} must be greater than or equal to your current age (${currentAge}).`);
        return false;
      }
      if (isNaN(weddingCost) || weddingCost < 0) {
        setValidationError(`${draftEvent.relationshipType === 'married' ? 'Wedding Cost' : 'Celebration Cost'} must be greater than or equal to 0.`);
        return false;
      }
    }

    setValidationError('');
    return true;
  };

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex < STEPS.length - 1) {
      if (validateStep(step)) {
        setStep(STEPS[currentIndex + 1]);
      }
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex > 0) {
      setValidationError('');
      setStep(STEPS[currentIndex - 1]);
    }
  };

  const handleSave = () => {
    if (!handleSaveEvent) return;
    try {
      setError(null);
      const finalEvent = createMarriageEventObject(draftEvent, inputs);
      handleSaveEvent(finalEvent);
      onClose();
    } catch (err) {
      console.error(err);
      setError("An error occurred while saving. Please try again.");
    }
  };

  // Emojis for congrats / final screens
  const decorations = [
    { char: '✨', style: { left: '8%', top: '15%', fontSize: '1.25rem', '--child-dec-rot': '-15deg', opacity: 0.7 } },
    { char: '💍', style: { left: '25%', top: '5%', fontSize: '1.5rem', '--child-dec-rot': '12deg', opacity: 0.85 } },
    { char: '🎉', style: { right: '12%', top: '8%', fontSize: '1.3rem', '--child-dec-rot': '15deg', opacity: 0.9 } },
    { char: '⭐', style: { left: '20%', top: '25%', fontSize: '1.4rem', '--child-dec-rot': '10deg', opacity: 0.9 } },
    { char: '💜', style: { left: '12%', top: '48%', fontSize: '1.2rem', '--child-dec-rot': '-10deg', opacity: 0.75 } },
    { char: '🌱', style: { right: '15%', top: '50%', fontSize: '1.2rem', '--child-dec-rot': '5deg', opacity: 0.8 } }
  ];

  const renderStepIndicator = () => {
    if (step === 'congrats' || step === 'finalSummary') return null;

    let activeIndex = 1;
    let totalSteps = isShortFlow ? 3 : 4;
    
    if (step === 'partnerProfile') activeIndex = 1;
    else if (step === 'weddingPlan') activeIndex = 2;
    else if (step === 'sharedSavings') activeIndex = isShortFlow ? 2 : 3;
    else if (step === 'impactComparison' || step === 'retirementImpact') activeIndex = isShortFlow ? 3 : 4;

    const stepNumbers = Array.from({ length: totalSteps }, (_, i) => i + 1);

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', margin: '0.75rem 0', width: '100%' }}>
        {stepNumbers.map((num) => {
          const isActive = activeIndex === num;
          const isCompleted = activeIndex > num;
          const pillBg = isActive || isCompleted ? '#16a34a' : '#e5e7eb';
          const pillColor = isActive || isCompleted ? '#ffffff' : '#64748b';
          return (
            <React.Fragment key={num}>
              {num > 1 && (
                <div style={{ flex: '1', height: '2px', backgroundColor: activeIndex >= num ? '#16a34a' : '#e5e7eb', minWidth: '12px', maxWidth: '30px' }} />
              )}
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: pillBg,
                color: pillColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.8rem'
              }}>
                {num}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const displayHeading = draftEvent.relationshipType === 'married' ? 'Get Married' : 
                         draftEvent.relationshipType === 'domestic_partnership' ? 'Domestic Partnership' : 
                         'Relationship';

  const pLabel = draftEvent.relationshipType === 'married' ? 'Spouse' : 'Partner';

  return (
    <div className="mobile-marriage-backdrop">
      {/* Header */}
      <div className="mobile-marriage-header">
        {step !== 'congrats' ? (
          <button className="mobile-marriage-close-btn" onClick={handleBack} aria-label="Back">
            <ArrowLeft size={24} />
          </button>
        ) : (
          <button className="mobile-marriage-close-btn" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        )}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {renderStepIndicator()}
        </div>
        <div style={{ width: '40px' }} />
      </div>

      {/* Main Content Area */}
      <div className="mobile-marriage-content">
        {error && (
          <div className="mobile-marriage-warning-card" style={{ background: '#fef2f2', borderColor: '#fee2e2', color: '#b91c1c' }}>
            {error}
          </div>
        )}
        {validationError && (
          <div className="mobile-marriage-warning-card" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#b45309', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertTriangle size={18} />
            <span>{validationError}</span>
          </div>
        )}

        {/* SCREEN 1: CONGRATS & SETUP */}
        {step === 'congrats' && (
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', position: 'relative', width: '100%' }}>
            
            {/* Decorations */}
            <div style={{ height: '70px', position: 'relative', width: '100%', overflow: 'hidden' }}>
              {decorations.slice(0, 3).map((dec, i) => (
                <span
                  key={i}
                  className="mobile-child-dec-item"
                  style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    ...dec.style
                  }}
                >
                  {dec.char}
                </span>
              ))}
            </div>

            <h1 style={{
              fontSize: '2rem',
              fontWeight: '800',
              color: '#8b5cf6',
              backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 0.5rem 0'
            }}>
              {draftEvent.relationshipType === 'married' ? 'Congrats! 🎉' : 'Setup Relationship'}
            </h1>
            <p className="mobile-marriage-subtitle" style={{ textAlign: 'center', fontSize: '1.05rem', margin: '0 auto 1.5rem auto', maxWidth: '85%' }}>
              {draftEvent.combineFinances !== false 
                ? (draftEvent.relationshipType === 'married' ? "You'll combine finances after marriage." : "You'll combine finances for projections.")
                : "You'll project with separate finances."}
            </p>

            {/* Relationship setup inputs */}
            <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%', margin: '0 0 1.25rem 0', padding: '1rem', textAlign: 'left' }}>
              <div className="mobile-marriage-input-group">
                <label className="mobile-marriage-label" htmlFor="spouse-name">Partner Name</label>
                <input
                  id="spouse-name"
                  type="text"
                  className="mobile-marriage-input"
                  value={draftEvent.spouseName || ''}
                  placeholder={draftEvent.relationshipType === 'married' ? 'Spouse' : 'Partner'}
                  onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseName: e.target.value }))}
                />
              </div>
              <div className="mobile-marriage-input-group">
                <label className="mobile-marriage-label" htmlFor="relationship-type">Relationship Type</label>
                <select
                  id="relationship-type"
                  className="mobile-marriage-input"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  value={draftEvent.relationshipType || 'married'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const defaultType = val === 'married' ? 'marriage' : (val === 'domestic_partnership' ? 'domesticPartnership' : 'relationshipBegins');
                    setDraftEvent(Object.assign({}, draftEvent, {
                      relationshipType: val,
                      type: defaultType,
                      name: val === 'married' ? 'Marriage' : (val === 'domestic_partnership' ? 'Domestic Partnership' : 'Relationship Begins')
                    }));
                  }}
                >
                  <option value="married">Married</option>
                  <option value="domestic_partnership">Domestic Partnership</option>
                  <option value="partner">Partner</option>
                  <option value="engaged">Engaged</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={draftEvent.livingTogether !== false}
                    onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { livingTogether: e.target.checked }))}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  Living together
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={draftEvent.combineFinances !== false}
                    onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { combineFinances: e.target.checked }))}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  Combine finances
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start', textAlign: 'left', margin: 0 }}>
                <Wallet size={24} color="#3b82f6" strokeWidth={1.5} />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>More Income</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bigger monthly budget.</span>
              </div>
              <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start', textAlign: 'left', margin: 0 }}>
                <TrendingUp size={24} color="#16a34a" strokeWidth={1.5} />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>Faster Savings</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Grow investments faster.</span>
              </div>
              <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start', textAlign: 'left', margin: 0 }}>
                <Home size={24} color="#eab308" strokeWidth={1.5} />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>Lower Costs</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Share housing expenses.</span>
              </div>
              <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start', textAlign: 'left', margin: 0 }}>
                <Target size={24} color="#8b5cf6" strokeWidth={1.5} />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>Aligned Goals</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Plan retirement together.</span>
              </div>
            </div>

            <button
              type="button"
              className="mobile-marriage-btn-text"
              style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'center', marginBottom: '1rem' }}
              onClick={handleNext}
            >
              <User size={18} />
              Edit Partner Profile ›
            </button>
          </div>
        )}

        {/* SCREEN 2: PARTNER PROFILE */}
        {step === 'partnerProfile' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">Partner Profile</h2>
            <p className="mobile-marriage-subtitle">Tell us more about you both to personalize your plan.</p>

            <button
              type="button"
              className="mobile-marriage-btn-text"
              style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'center', margin: '0 auto 1rem auto' }}
              onClick={() => setIsFullPartnerProfileOpen(!isFullPartnerProfileOpen)}
            >
              {isFullPartnerProfileOpen ? 'Hide Partner Profile ▴' : 'Show Partner Profile ▾'}
            </button>

            {isFullPartnerProfileOpen && (
              <div className="mobile-marriage-card">
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '1rem' }}>
                  Advanced Partner Profile
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="marriage-age">{draftEvent.relationshipType === 'married' ? 'Marriage Age' : 'Relationship Age'}</label>
                    <input
                      id="marriage-age"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.age}
                      onChange={(e) => handleMarriageAgeChange(e.target.value)}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="partner-current-age">Partner Current Age</label>
                    <input
                      id="partner-current-age"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseCurrentAge}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseCurrentAge: parseInt(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-income">{pLabel} Income ($/year)</label>
                    <CurrencyInput
                      id="spouse-income"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseIncome}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseIncome: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-savings-rate">{pLabel} Savings Rate (%)</label>
                    <PercentInput
                      id="spouse-savings-rate"
                      className="mobile-marriage-input"
                      value={draftEvent.savingsRate}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { savingsRate: parseInt(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-assets">Partner Assets ($)</label>
                    <CurrencyInput
                      id="spouse-assets"
                      className="mobile-marriage-input"
                      value={Number(draftEvent.cash || 0) + Number(draftEvent.investments || 0) + Number(draftEvent.retirement || 0)}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { investments: parseFloat(e.target.value) || 0, cash: 0, retirement: 0 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-debt">Partner Debt ($)</label>
                    <CurrencyInput
                      id="spouse-debt"
                      className="mobile-marriage-input"
                      value={Number(draftEvent.debtStudent || 0) + Number(draftEvent.debtCredit || 0) + Number(draftEvent.debtOther || 0)}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { debtOther: parseFloat(e.target.value) || 0, debtStudent: 0, debtCredit: 0 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-ret-age">{pLabel} Work Optional Age</label>
                    <input
                      id="spouse-ret-age"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseDesiredRetirementAge !== null && draftEvent.spouseDesiredRetirementAge !== undefined ? draftEvent.spouseDesiredRetirementAge : ''}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseDesiredRetirementAge: e.target.value !== '' ? parseInt(e.target.value) : null }))}
                      placeholder="e.g. 65 (optional)"
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-life-exp">{pLabel} Life Expectancy</label>
                    <input
                      id="spouse-life-exp"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseLifeExpectancy}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseLifeExpectancy: parseInt(e.target.value) || 85 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-ss-age">{pLabel} SS Claiming Age</label>
                    <input
                      id="spouse-ss-age"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseSocialSecurityAge}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseSocialSecurityAge: parseInt(e.target.value) || 67 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-ss-benefit">{pLabel} SS Benefit ($/yr)</label>
                    <CurrencyInput
                      id="spouse-ss-benefit"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseEstimatedSocialSecurityBenefit}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseEstimatedSocialSecurityBenefit: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 3: WEDDING PLAN */}
        {step === 'weddingPlan' && !isShortFlow && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">
              {draftEvent.relationshipType === 'married' ? 'Plan Your Wedding' : 'Plan Your Celebration'}
            </h2>
            <p className="mobile-marriage-subtitle">
              {draftEvent.relationshipType === 'married'
                ? 'Determine your wedding budget, evaluate funding sources, and identify any savings gaps.'
                : 'Determine your celebration budget and evaluate funding options.'}
            </p>

            {/* Available Savings Card */}
            <div className="mobile-marriage-card" style={{ background: '#f9fafb', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>
                Available Savings Summary
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Your Savings</div>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{formatCurrency(userAssets)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Partner Savings</div>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{formatCurrency(spouseAssets)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Savings</div>
                  <strong style={{ fontSize: '0.9rem', color: '#16a34a' }}>{formatCurrency(userAssets + spouseAssets)}</strong>
                </div>
              </div>
            </div>

            <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b' }}>
                {draftEvent.relationshipType === 'married' ? 'Wedding Funding' : 'Celebration Funding'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="mobile-include-wedding-cost"
                  checked={draftEvent.includeWeddingCost}
                  onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { includeWeddingCost: e.target.checked }))}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <label htmlFor="mobile-include-wedding-cost" className="mobile-marriage-label" style={{ margin: 0, fontWeight: 'normal' }}>
                  {draftEvent.relationshipType === 'married' ? 'Plan to have a wedding celebration' : 'Plan to have a celebration'}
                </label>
              </div>

              {draftEvent.includeWeddingCost && (
                <>
                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="wedding-cost">
                      {draftEvent.relationshipType === 'married' ? 'Estimated Wedding Cost' : 'Estimated Celebration Cost'}
                    </label>
                    <CurrencyInput
                      id="wedding-cost"
                      className="mobile-marriage-input"
                      value={draftEvent.weddingCost}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const willBeDisabled = val > combinedAssets;
                        const nextMethod = (willBeDisabled && draftEvent.weddingFundingMethod === 'savings') ? 'debt' : draftEvent.weddingFundingMethod;
                        setDraftEvent(Object.assign({}, draftEvent, { weddingCost: val, weddingFundingMethod: nextMethod }));
                      }}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="wedding-cost-age">
                      {draftEvent.relationshipType === 'married' ? 'Wedding Age' : 'Celebration Age'}
                    </label>
                    <input
                      id="wedding-cost-age"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.weddingAge}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { weddingAge: parseInt(e.target.value) || draftEvent.age }))}
                    />
                  </div>

                  {/* Funding choices */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>Funding Method</span>
                    {[
                      { label: '🏦 Use Available Savings', value: 'savings' },
                      { label: '📈 Save Until Event', value: 'save_targeted' },
                      { label: '💳 Finance Difference', value: 'debt' }
                    ].map((opt) => {
                      const isDisabled = opt.value === 'savings' && isSavingsDisabled;
                      return (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#0f172a', opacity: isDisabled ? 0.5 : 1 }}>
                          <input
                            type="radio"
                            name="mobileWeddingFunding"
                            value={opt.value}
                            checked={draftEvent.weddingFundingMethod === opt.value}
                            disabled={isDisabled}
                            onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { weddingFundingMethod: e.target.value }))}
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>

                  {draftEvent.weddingFundingMethod === 'debt' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b' }}>Debt Details</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="mobile-marriage-input-group">
                          <label className="mobile-marriage-label" style={{ fontSize: '0.7rem' }}>Interest Rate (%)</label>
                          <input
                            type="number"
                            className="mobile-marriage-input"
                            value={draftEvent.weddingInterestRate}
                            onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { weddingInterestRate: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="mobile-marriage-input-group">
                          <label className="mobile-marriage-label" style={{ fontSize: '0.7rem' }}>Payoff Years</label>
                          <input
                            type="number"
                            className="mobile-marriage-input"
                            value={draftEvent.weddingPayoffTimeline}
                            onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { weddingPayoffTimeline: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Funding Gap warnings */}
                  {fundingGap > 0 && (
                    <div className="mobile-marriage-warning-card">
                      <strong style={{ color: '#b45309', display: 'block', marginBottom: '0.2rem' }}>⚠️ Funding Gap Identified</strong>
                      <span>
                        {draftEvent.relationshipType === 'married'
                          ? `Wedding cost exceeds combined available savings by `
                          : `Celebration cost exceeds combined available savings by `}
                        <strong>{formatCurrency(fundingGap)}</strong>.
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 4: SHARED SAVINGS */}
        {step === 'sharedSavings' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">
              {draftEvent.relationshipType === 'married' ? '🏠 Shared Household Benefits' : 'Life Together'}
            </h2>
            <p className="mobile-marriage-subtitle">
              {draftEvent.relationshipType === 'married'
                ? 'Review automatic savings estimated from sharing housing, utilities, and services.'
                : (draftEvent.livingTogether !== false
                   ? 'Review savings from combining housing, utilities, and services.'
                   : 'Projections are modeled living separately.')}
            </p>

            {draftEvent.livingTogether !== false ? (
              <>
                {draftEvent.relationshipType === 'married' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div className="mobile-marriage-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>Housing Shared</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Estimated savings from living together</div>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#16a34a' }}>+50%</div>
                    </div>

                    <div className="mobile-marriage-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>Utilities Shared</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Shared utility bill reduction</div>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#16a34a' }}>+25%</div>
                    </div>

                    <div className="mobile-marriage-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>Internet Shared</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Combine to a single internet plan</div>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#16a34a' }}>+50%</div>
                    </div>

                    <div className="mobile-marriage-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>Streaming Shared</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Family streaming memberships</div>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#16a34a' }}>+50%</div>
                    </div>

                    <div className="mobile-marriage-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>Household Goods Shared</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Shared shopping and groceries</div>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#16a34a' }}>+10%</div>
                    </div>
                  </div>
                )}

                {savingsBreakdown && (
                  <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem' }}>
                      {draftEvent.relationshipType === 'married' ? 'Estimated Monthly Household Savings' : 'Estimated Monthly Savings'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>Housing:</span>
                      <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.housing)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>Utilities:</span>
                      <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.utilities)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>Internet & Streaming:</span>
                      <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.telecom || (savingsBreakdown.internet + savingsBreakdown.streaming))}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', margin: '0.25rem 0 0 0' }}>
                      <span style={{ color: '#0f172a', fontWeight: 'bold' }}>Total Savings:</span>
                      <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>+{formatCurrency(savingsBreakdown.total)}/mo</strong>
                    </div>
                  </div>
                )}

                {draftEvent.combineFinances !== false && (
                  <button
                    type="button"
                    className="mobile-marriage-btn-primary"
                    style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem', background: '#0f172a' }}
                    onClick={() => {
                      if (setIsBudgetOpenFromMarriageWizard && handleSetBudgetClick) {
                        setIsBudgetOpenFromMarriageWizard(true);
                        handleSetBudgetClick('workSave', true);
                      }
                    }}
                  >
                    📊 Adjust Budget Details
                  </button>
                )}
              </>
            ) : (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                ℹ️ Living separately means no housing or utilities cost savings will be applied to your budget.
              </div>
            )}
          </div>
        )}

        {/* SCREEN 5: IMPACT COMPARISON */}
        {step === 'impactComparison' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">
              {draftEvent.relationshipType === 'married' ? 'Marriage Impact' : 'Financial Impact'}
            </h2>
            <p className="mobile-marriage-subtitle">Compare your household projection indicators before and after the event.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Before Card */}
              <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '#0.5rem', borderLeft: '4px solid #94a3b8' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>
                  {draftEvent.relationshipType === 'married' ? 'Before Marriage' : 'BEFORE EVENT'}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Income:</span>
                  <strong>{formatCurrency(userIncome / 12)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Savings:</span>
                  <strong>{formatCurrency(userSavings)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Savings Rate:</span>
                  <strong>{Math.round(userSavingsRate)}%</strong>
                </div>
              </div>

              {/* After Card */}
              <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '#0.5rem', borderLeft: '4px solid #8b5cf6', background: 'linear-gradient(135deg, rgba(139,92,246,0.03) 0%, rgba(99,102,241,0.03) 100%)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {draftEvent.relationshipType === 'married' ? 'After Marriage' : 'AFTER EVENT'}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Income:</span>
                  <strong>{formatCurrency((draftEvent.combineFinances !== false ? combinedIncome : userIncome) / 12)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Savings:</span>
                  <strong>{formatCurrency(draftEvent.combineFinances !== false ? combinedSavings : userSavings)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Savings Rate:</span>
                  <strong>
                    {draftEvent.combineFinances !== false 
                      ? `${Math.round(((combinedSavings + Math.max(0, leftoverGap)) / (combinedIncome / 12)) * 100)}%`
                      : `${Math.round(userSavingsRate)}%`
                    }
                  </strong>
                </div>
              </div>
            </div>

            {/* Passive Soft Warning Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {hasLowCombinedSpendingWarning && (
                <div className="mobile-marriage-warning-card" style={{ borderColor: '#fca5a5', background: '#fef2f2', color: '#991b1b', margin: 0 }}>
                  <strong>⚠️ Notice: Low Combined Spending</strong>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', lineHeight: '1.4' }}>
                    {draftEvent.relationshipType === 'married' 
                      ? 'Combined household spending after marriage is less than or equal to your single spending, meaning your spouse has no additional spending needs.'
                      : 'Combined household spending after event is less than or equal to your single spending, meaning your partner has no additional spending needs.'}
                  </div>
                </div>
              )}

              {hasZeroPartnerSpendingWarning && (
                <div className="mobile-marriage-warning-card" style={{ borderColor: '#fca5a5', background: '#fef2f2', color: '#991b1b', margin: 0 }}>
                  <strong>⚠️ Notice: Zero Partner Personal Spending</strong>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', lineHeight: '1.4' }}>
                    Partner personal spending is currently set to $0/month.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 6: RETIREMENT IMPACT */}
        {step === 'retirementImpact' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">Retirement Readiness</h2>
            <p className="mobile-marriage-subtitle">See how this relationship event changes your work optional readiness age.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div className="mobile-marriage-card" style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>BEFORE AGE</span>
                <strong style={{ fontSize: '1.25rem', color: '#0f17 slate' }}>{beforeReadyAge ? `Age ${beforeReadyAge}` : 'Never Ready'}</strong>
              </div>
              <div className="mobile-marriage-card" style={{ textAlign: 'center', padding: '1rem 0.5rem', borderColor: '#8b5cf6', background: 'rgba(139,92,246,0.02)' }}>
                <span style={{ fontSize: '0.7rem', color: '#8b5cf6', display: 'block', marginBottom: '0.25rem' }}>AFTER AGE</span>
                <strong style={{ fontSize: '1.25rem', color: '#8b5cf6' }}>{afterReadyAge ? `Age ${afterReadyAge}` : 'Never Ready'}</strong>
              </div>
            </div>

            {beforeReadyAge && afterReadyAge && afterReadyAge !== beforeReadyAge && (
              <div className="mobile-marriage-card" style={{ background: afterReadyAge < beforeReadyAge ? '#f0fdf4' : '#fef2f2', borderColor: afterReadyAge < beforeReadyAge ? '#dcfce7' : '#fee2e2', color: afterReadyAge < beforeReadyAge ? '#15803d' : '#b91c1c', fontWeight: 'bold', textAlign: 'center' }}>
                {afterReadyAge < beforeReadyAge 
                  ? `🎉 You can retire ${beforeReadyAge - afterReadyAge} years earlier!`
                  : `⚠️ Your retirement target increases by ${afterReadyAge - beforeReadyAge} years.`}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 7: FINAL SUMMARY */}
        {step === 'finalSummary' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#8b5cf6',
              backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 0.5rem 0',
              textAlign: 'center'
            }}>
              {draftEvent.relationshipType === 'married' ? "You're All Set! 🎉" : "Ready! 🚀"}
            </h1>
            <p className="mobile-marriage-subtitle" style={{ textAlign: 'center' }}>
              {draftEvent.relationshipType === 'married' 
                ? "Here's your marriage financial plan summary." 
                : "Your relationship plan is complete. Review details below and save."}
            </p>

            {/* Checklist Card */}
            <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left', marginBottom: '1.25rem' }}>
              {draftEvent.relationshipType === 'married' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                    <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} />
                    </div>
                    <span>Partner profile completed</span>
                  </div>
                  {!isShortFlow && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                      <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} color="#16a34a" strokeWidth={3} />
                      </div>
                      <span>Wedding plan created</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                    <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} />
                    </div>
                    <span>Shared savings identified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                    <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} />
                    </div>
                    <span>Budget impact analyzed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                    <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} />
                    </div>
                    <span>Retirement plan updated</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                    <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} />
                    </div>
                    <span>Partner details set</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                    <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} />
                    </div>
                    <span>Budget impact analyzed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                    <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} />
                    </div>
                    <span>Retirement plan updated</span>
                  </div>
                </>
              )}
            </div>

            {/* Key Benefits Card */}
            <div className="mobile-marriage-card" style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>Key Benefits</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {draftEvent.livingTogether !== false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <TrendingUp size={20} color="#16a34a" />
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>+{formatCurrency(savingsBreakdown.total)}/mo</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Estimated monthly savings</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Target size={20} color="#8b5cf6" />
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>
                      {beforeReadyAge && afterReadyAge && afterReadyAge < beforeReadyAge ? `${beforeReadyAge - afterReadyAge} years earlier` : 'On track'}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Retirement readiness</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Wallet size={20} color="#3b82f6" />
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>
                      {formatCurrency(Math.max(0, ((draftEvent.combineFinances !== false ? combinedAssets : userAssets) - (draftEvent.combineFinances !== false ? combinedDebt : userDebt)) - (userAssets - userDebt)))}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Net worth increase</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Nav Bar */}
      <div className="mobile-marriage-sticky-nav">
        {step === 'congrats' && (
          <>
            <button type="button" className="mobile-marriage-btn-text" onClick={onClose}>
              Skip
            </button>
            <button type="button" className="mobile-marriage-btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </>
        )}

        {step === 'partnerProfile' && (
          <>
            <button type="button" className="mobile-marriage-btn-text" onClick={onClose}>
              Skip
            </button>
            <button type="button" className="mobile-marriage-btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </>
        )}

        {step === 'weddingPlan' && !isShortFlow && (
          <>
            <button type="button" className="mobile-marriage-btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button type="button" className="mobile-marriage-btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </>
        )}

        {step === 'sharedSavings' && (
          <>
            <button type="button" className="mobile-marriage-btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button type="button" className="mobile-marriage-btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </>
        )}

        {step === 'impactComparison' && (
          <>
            <button type="button" className="mobile-marriage-btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button type="button" className="mobile-marriage-btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </>
        )}

        {step === 'retirementImpact' && (
          <>
            <button type="button" className="mobile-marriage-btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button type="button" className="mobile-marriage-btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </>
        )}

        {step === 'finalSummary' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="mobile-marriage-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSave}
            >
              Save & Continue to Dashboard
            </button>
            <button
              type="button"
              className="mobile-marriage-btn-text"
              style={{ fontSize: '0.85rem', color: '#16a34a' }}
              onClick={() => setStep('partnerProfile')}
            >
              Review Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
