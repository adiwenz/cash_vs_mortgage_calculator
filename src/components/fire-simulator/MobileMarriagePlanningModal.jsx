import React, { useState, useMemo, useEffect } from 'react';
import { Wallet, TrendingUp, Home, Target, User, Check, X, ArrowLeft, AlertTriangle } from 'lucide-react';
import { runFireSimulation } from '../../fireCalculations';
import { formatCurrency } from './helpers';
import { CurrencyInput, PercentInput } from '../ui/PlainInputs';
import { calculateCombinedIncome, calculateMarriageEstimates, getSavingsBreakdown } from '../../domain/events/marriage/marriageImpact';
import { validateWeddingCostFunding } from '../../domain/events/marriage/marriageValidation';
import { createMarriageEventObject, createSpouseRecord } from '../../domain/events/marriage/marriageEventFactory';

export default function MobileMarriagePlanningModal({
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

  const STEPS = [
    "congrats",
    "partnerProfile",
    "weddingPlan",
    "sharedSavings",
    "impactComparison",
    "retirementImpact",
    "finalSummary",
  ];

  const [step, setStep] = useState("congrats");
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [error, setError] = useState(null);

  // Local draft of editing event
  const [draftEvent, setDraftEvent] = useState(() => {
    return {
      id: editingEvent?.id && editingEvent.id !== 'marriage' ? editingEvent.id : `marriage-${Date.now()}`,
      type: 'marriage',
      age: editingEvent?.age !== undefined ? editingEvent.age : currentAge,
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
    };
  });

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

  // Monthly budget preview calculations
  const userSavingsMonthly = Object.values(inputs.budgetDetails?.savings || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const userFlatSavings = (Number(inputs.simpleIncome) || 50000) * ((Number(inputs.preTaxSavingsRate) || 15) / 100) / 12;
  const userSavings = userSavingsMonthly > 0 ? userSavingsMonthly : Math.round(userFlatSavings);
  const partnerSavingsMonthly = partnerSavings / 12;
  const combinedSavings = userSavings + partnerSavingsMonthly;
  const surplusMonthly = combinedIncome / 12 - combinedSpendingVal / 12;
  const leftoverGap = surplusMonthly - combinedSavings;

  // Warning checks
  const hasLowCombinedSpendingWarning = combinedSpendingVal <= userSpendingPreRetirement;
  const hasZeroPartnerSpendingWarning = partnerPersonalSpending === 0;

  // Run projections for Screen 6
  const beforeInputs = useMemo(() => {
    return {
      ...inputs,
      lifeEvents: (inputs.lifeEvents || []).filter(e => e.type !== 'marriage')
    };
  }, [inputs]);

  const afterInputs = useMemo(() => {
    return {
      ...inputs,
      lifeEvents: [
        ...(inputs.lifeEvents || []).filter(e => e.type !== 'marriage'),
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
        setValidationError(`Marriage Age must be greater than or equal to your current age (${currentAge}).`);
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
        setValidationError("Spouse Life Expectancy must be greater than 0.");
        return false;
      }
      if (isNaN(ssAge) || ssAge <= 0) {
        setValidationError("Spouse Social Security Age must be greater than 0.");
        return false;
      }
    }

    if (currentStep === 'weddingPlan' && draftEvent.includeWeddingCost) {
      const weddingAge = Number(draftEvent.weddingAge);
      const weddingCost = Number(draftEvent.weddingCost);

      if (isNaN(weddingAge) || weddingAge < currentAge) {
        setValidationError(`Wedding Age must be greater than or equal to your current age (${currentAge}).`);
        return false;
      }
      if (isNaN(weddingCost) || weddingCost < 0) {
        setValidationError("Wedding Cost must be greater than or equal to 0.");
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
      // Construct final event matching desktop structures
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

  // Render Step Indicator
  const renderStepIndicator = () => {
    if (step === 'congrats' || step === 'finalSummary') return null;

    let activeIndex = 1;
    if (step === 'partnerProfile') activeIndex = 1;
    else if (step === 'weddingPlan') activeIndex = 2;
    else if (step === 'sharedSavings') activeIndex = 3;
    else if (step === 'impactComparison' || step === 'retirementImpact') activeIndex = 4;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', margin: '0.75rem 0', width: '100%' }}>
        {[1, 2, 3, 4].map((num) => {
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
        <div style={{ width: '40px' }} /> {/* Spacer to center the indicator */}
      </div>

      {/* Main Content Area */}
      <div className="mobile-marriage-content">
        {/* Error notification */}
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

        {/* SCREEN 1: CONGRATS */}
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
              Congrats! 🎉
            </h1>
            <p className="mobile-marriage-subtitle" style={{ textAlign: 'center', fontSize: '1.05rem', margin: '0 auto 1.5rem auto', maxWidth: '85%' }}>
              You'll combine finances after marriage.
            </p>

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
                    <label className="mobile-marriage-label" htmlFor="marriage-age">Marriage Age</label>
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
                    <label className="mobile-marriage-label" htmlFor="spouse-income">Spouse Income ($/year)</label>
                    <CurrencyInput
                      id="spouse-income"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseIncome}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseIncome: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-savings-rate">Savings Rate (%)</label>
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
                    <label className="mobile-marriage-label" htmlFor="spouse-desired-retirement-age">Spouse Work Optional Age (Optional)</label>
                    <input
                      id="spouse-desired-retirement-age"
                      type="number"
                      className="mobile-marriage-input"
                      placeholder="e.g. 65"
                      value={draftEvent.spouseDesiredRetirementAge !== null ? draftEvent.spouseDesiredRetirementAge : ''}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseDesiredRetirementAge: e.target.value !== '' ? parseInt(e.target.value) : null }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-life-expectancy">Spouse Life Expectancy</label>
                    <input
                      id="spouse-life-expectancy"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseLifeExpectancy}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseLifeExpectancy: parseInt(e.target.value) || 85 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-social-security-age">Spouse Social Security Age</label>
                    <input
                      id="spouse-social-security-age"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.spouseSocialSecurityAge}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { spouseSocialSecurityAge: parseInt(e.target.value) || 67 }))}
                    />
                  </div>

                  <div className="mobile-marriage-input-group">
                    <label className="mobile-marriage-label" htmlFor="spouse-estimated-social-security-benefit">Spouse Est. SS Benefit ($/yr)</label>
                    <CurrencyInput
                      id="spouse-estimated-social-security-benefit"
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
        {step === 'weddingPlan' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">Plan Your Wedding</h2>
            <p className="mobile-marriage-subtitle">Determine your wedding budget, evaluate funding sources, and identify any savings gaps.</p>

            {/* Available Savings Card */}
            <div className="mobile-marriage-card" style={{ background: '#f9fafb' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>Available Savings Summary</span>
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

            {/* Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="checkbox"
                id="plan-wedding-celeb"
                checked={draftEvent.includeWeddingCost}
                onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { includeWeddingCost: e.target.checked }))}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="plan-wedding-celeb" style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a', cursor: 'pointer' }}>
                Plan to have a wedding celebration
              </label>
            </div>

            {draftEvent.includeWeddingCost && (
              <div className="mobile-marriage-card">
                {/* Presets */}
                <div style={{ marginBottom: '1rem' }}>
                  <label className="mobile-marriage-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Cost Presets</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {[
                      { label: 'Court $500', value: 500 },
                      { label: 'Simple $5k', value: 5000 },
                      { label: 'Traditional $20k', value: 20000 },
                      { label: 'Dream $50k', value: 50000 }
                    ].map((preset) => {
                      const isActive = draftEvent.weddingCost === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          className={`mobile-marriage-preset-chip ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            const val = preset.value;
                            const willBeDisabled = val > combinedAssets;
                            const nextMethod = (willBeDisabled && draftEvent.weddingFundingMethod === 'savings') ? 'debt' : draftEvent.weddingFundingMethod;
                            setDraftEvent(Object.assign({}, draftEvent, { weddingCost: val, weddingFundingMethod: nextMethod }));
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`mobile-marriage-preset-chip ${![500, 5000, 20000, 50000].includes(draftEvent.weddingCost) ? 'active' : ''}`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {/* Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div className="mobile-marriage-input-group" style={{ margin: 0 }}>
                    <label className="mobile-marriage-label" htmlFor="wedding-cost">Wedding Cost ($)</label>
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
                  <div className="mobile-marriage-input-group" style={{ margin: 0 }}>
                    <label className="mobile-marriage-label" htmlFor="wedding-age">Wedding Age</label>
                    <input
                      id="wedding-age"
                      type="number"
                      className="mobile-marriage-input"
                      value={draftEvent.weddingAge}
                      onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { weddingAge: parseInt(e.target.value) || currentAge }))}
                    />
                  </div>
                </div>

                {/* Funding options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left', marginBottom: '1rem' }}>
                  <span className="mobile-marriage-label">How will you fund the wedding?</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    {[
                      { label: '🏦 Use Available Savings (Deduct from liquid assets)', value: 'savings' },
                      { label: '📈 Save Until Wedding (Extra savings targeted before wedding)', value: 'save_targeted' },
                      { label: '💳 Finance Difference (Create credit card or other debt)', value: 'debt' }
                    ].map((opt) => {
                      const isDisabled = opt.value === 'savings' && isSavingsDisabled;
                      return (
                        <label key={opt.value} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          color: '#0f172a',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.5 : 1
                        }}>
                          <input
                            type="radio"
                            name="weddingFundingMethod"
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
                </div>

                {/* Finance specifics */}
                {draftEvent.weddingFundingMethod === 'debt' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b' }}>Financing Details</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="mobile-marriage-input-group" style={{ margin: 0 }}>
                        <label className="mobile-marriage-label" htmlFor="wedding-interest-rate" style={{ fontSize: '0.7rem' }}>Interest Rate (%)</label>
                        <input
                          id="wedding-interest-rate"
                          type="number"
                          className="mobile-marriage-input"
                          style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                          value={draftEvent.weddingInterestRate}
                          onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { weddingInterestRate: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="mobile-marriage-input-group" style={{ margin: 0 }}>
                        <label className="mobile-marriage-label" htmlFor="wedding-payoff-timeline" style={{ fontSize: '0.7rem' }}>Payoff Timeline (Years)</label>
                        <input
                          id="wedding-payoff-timeline"
                          type="number"
                          className="mobile-marriage-input"
                          style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                          value={draftEvent.weddingPayoffTimeline}
                          onChange={(e) => setDraftEvent(Object.assign({}, draftEvent, { weddingPayoffTimeline: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Funding Gap Alert */}
                {Number(draftEvent.weddingCost || 0) > (userAssets + spouseAssets) && (
                  <div className="mobile-marriage-warning-card">
                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>⚠️ Funding Gap Identified</strong>
                    <span>
                      Wedding cost exceeds combined available savings by <strong>{formatCurrency(Number(draftEvent.weddingCost || 0) - (userAssets + spouseAssets))}</strong>.
                    </span>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', opacity: 0.9 }}>
                      {draftEvent.weddingFundingMethod === 'savings' && 'Note: This gap will result in negative liquid assets at the wedding age.'}
                      {draftEvent.weddingFundingMethod === 'save_targeted' && 'Note: You will need to save this difference before the wedding.'}
                      {draftEvent.weddingFundingMethod === 'debt' && `Financing this wedding adds ${formatCurrency(Number(draftEvent.weddingCost || 0) - (userAssets + spouseAssets))} of debt. Your net worth may go negative until the debt is paid down.`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 4: SHARED SAVINGS */}
        {step === 'sharedSavings' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">🏠 Shared Household Benefits</h2>
            <p className="mobile-marriage-subtitle">Review automatic savings estimated from sharing housing, utilities, and services.</p>

            {/* Vertical Savings Benefit Cards */}
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

            {/* Estimated Monthly Household Savings summary card */}
            <div className="mobile-marriage-card" style={{ background: '#f9fafb' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>
                Estimated Monthly Household Savings
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Housing</span>
                  <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.housing)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Utilities</span>
                  <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.utilities)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Internet</span>
                  <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.internet)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Streaming</span>
                  <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.streaming)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Other Shared</span>
                  <strong style={{ color: '#16a34a' }}>+{formatCurrency(savingsBreakdown.otherShared)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', marginTop: '0.25rem', fontWeight: 'bold' }}>
                  <span style={{ color: '#0f172a' }}>Total Savings</span>
                  <strong style={{ color: '#16a34a', fontSize: '1rem' }}>+{formatCurrency(savingsBreakdown.total)}/mo</strong>
                </div>
              </div>
            </div>

            {/* Adjust budget button */}
            <button
              type="button"
              className="mobile-marriage-btn-primary"
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
                marginBottom: '1rem',
                justifyContent: 'center'
              }}
              onClick={() => {
                if (setIsBudgetOpenFromMarriageWizard && handleSetBudgetClick) {
                  setIsBudgetOpenFromMarriageWizard(true);
                  handleSetBudgetClick('workSave', true);
                }
              }}
            >
              📊 Adjust Budget Details
            </button>
          </div>
        )}

        {/* SCREEN 5: IMPACT COMPARISON */}
        {step === 'impactComparison' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h2 className="mobile-marriage-title">Marriage Impact</h2>
            <p className="mobile-marriage-subtitle">Compare your household financials and retirement readiness before and after marriage.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {/* Before Marriage Card */}
              <div className="mobile-marriage-card" style={{ margin: 0, background: '#f8fafc' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.35rem', marginBottom: '0.5rem' }}>
                  Before Marriage
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Income</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(userIncome / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Savings</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(userSavings)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Spending</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(userSpendingPreRetirement / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Savings Rate</span>
                    <strong style={{ color: '#0f172a' }}>{Math.round(userSavingsRate)}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                    <span style={{ color: '#64748b' }}>Net Worth</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(userAssets - userDebt)}</strong>
                  </div>
                </div>
              </div>

              {/* After Marriage Card */}
              <div className="mobile-marriage-card" style={{ margin: 0, border: '1px solid #16a34a', background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.02) 0%, rgba(22, 163, 74, 0.05) 100%)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#16a34a', display: 'block', borderBottom: '1px solid #dcfce7', paddingBottom: '0.35rem', marginBottom: '0.5rem' }}>
                  After Marriage
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Combined Income</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(combinedIncome / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Combined Savings</span>
                    <strong style={{ color: '#16a34a' }}>{formatCurrency(combinedSavings)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Combined Spending</span>
                    <strong style={{ color: '#ef4444' }}>{formatCurrency(combinedSpendingVal / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Savings Rate</span>
                    <strong style={{ color: '#16a34a' }}>{Math.round(((combinedSavings + Math.max(0, leftoverGap)) / (combinedIncome / 12)) * 100)}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #dcfce7', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                    <span style={{ color: '#64748b' }}>Net Worth</span>
                    <strong style={{ color: '#16a34a' }}>{formatCurrency(combinedAssets - combinedDebt)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Wedding Summary Card */}
            {draftEvent.includeWeddingCost && (
              <div className="mobile-marriage-card">
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>Wedding Summary</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Wedding Cost</span>
                    <strong style={{ color: '#ef4444' }}>{formatCurrency(draftEvent.weddingCost || 0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Funding Method</span>
                    <strong style={{ color: '#0f172a' }}>
                      {draftEvent.weddingFundingMethod === 'savings' && 'Available Savings'}
                      {draftEvent.weddingFundingMethod === 'save_targeted' && 'Save Until Wedding'}
                      {draftEvent.weddingFundingMethod === 'debt' && 'Finance Difference'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Passive Soft Warning Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {hasLowCombinedSpendingWarning && (
                <div className="mobile-marriage-warning-card" style={{ borderColor: '#fca5a5', background: '#fef2f2', color: '#991b1b', margin: 0 }}>
                  <strong>⚠️ Notice: Low Combined Spending</strong>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', lineHeight: '1.4' }}>
                    Combined household spending after marriage is less than or equal to your single spending, meaning your spouse has no additional spending needs.
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
            <h2 className="mobile-marriage-title">Retirement Impact</h2>
            <p className="mobile-marriage-subtitle">Evaluate how marrying modifies your projected timeline to reach financial independence.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="mobile-marriage-card" style={{ textAlign: 'center', margin: 0 }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Before Marriage</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.5rem' }}>
                  {beforeReadyAge ? `Age ${beforeReadyAge}` : 'Never Ready'}
                </div>
              </div>
              
              <div className="mobile-marriage-card" style={{
                textAlign: 'center',
                margin: 0,
                border: '1px solid',
                borderColor: afterReadyAge && beforeReadyAge && afterReadyAge < beforeReadyAge ? '#16a34a' : afterReadyAge && beforeReadyAge && afterReadyAge > beforeReadyAge ? '#ef4444' : '#e5e7eb',
                background: afterReadyAge && beforeReadyAge && afterReadyAge < beforeReadyAge ? '#f0fdf4' : afterReadyAge && beforeReadyAge && afterReadyAge > beforeReadyAge ? '#fef2f2' : '#ffffff'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>After Marriage</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6', marginTop: '0.5rem' }}>
                  {afterReadyAge ? `Age ${afterReadyAge}` : 'Never Ready'}
                </div>
                {afterReadyAge && beforeReadyAge && afterReadyAge !== beforeReadyAge && (
                  <div style={{ fontSize: '0.7rem', color: afterReadyAge < beforeReadyAge ? '#16a34a' : '#ef4444', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    {afterReadyAge < beforeReadyAge ? `Ready ${beforeReadyAge - afterReadyAge} years earlier! 🎉` : `Ready ${afterReadyAge - beforeReadyAge} years later`}
                  </div>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', lineHeight: '1.4' }}>
              Retirement target calculated at <strong>{inputs.swr || 4.0}% SWR</strong> supporting both spouses.
            </div>
          </div>
        )}

        {/* SCREEN 7: FINAL SUMMARY */}
        {step === 'finalSummary' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'center', position: 'relative' }}>
            {/* Decorations */}
            <div style={{ height: '70px', position: 'relative', width: '100%', overflow: 'hidden' }}>
              {decorations.slice(0, 4).map((dec, i) => (
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
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#8b5cf6',
              backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 0.5rem 0'
            }}>
              You're All Set! 🎉
            </h1>
            <p className="mobile-marriage-subtitle" style={{ textAlign: 'center' }}>
              Here's your marriage financial plan summary.
            </p>

            {/* Checklist Card */}
            <div className="mobile-marriage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={14} color="#16a34a" strokeWidth={3} />
                </div>
                <span>Partner profile completed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                <div style={{ background: '#dcfce7', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={14} color="#16a34a" strokeWidth={3} />
                </div>
                <span>Wedding plan created</span>
              </div>
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
            </div>

            {/* Key Benefits Card */}
            <div className="mobile-marriage-card" style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>Key Benefits</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TrendingUp size={20} color="#16a34a" />
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>+{formatCurrency(savingsBreakdown.total)}/mo</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Estimated monthly savings</span>
                  </div>
                </div>

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
                      {formatCurrency(Math.max(0, (combinedAssets - combinedDebt) - (userAssets - userDebt)))}
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

        {step === 'weddingPlan' && (
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
