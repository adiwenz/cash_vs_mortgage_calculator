import { Wallet, TrendingUp, Home, Target, User } from 'lucide-react';
import { runFireSimulation } from '../../fireCalculations';
import { formatCurrency } from './helpers';
import { CurrencyInput, PercentInput } from '../ui/PlainInputs';
import { calculateCombinedIncome, calculateMarriageEstimates } from '../../domain/events/marriage/marriageImpact';
import { validateWeddingCostFunding } from '../../domain/events/marriage/marriageValidation';
import { createMarriageEventObject, createSpouseRecord } from '../../domain/events/marriage/marriageEventFactory';

export default function MarriageWizard({
  inputs,
  editingEvent,
  setEditingEvent,
  isFullPartnerProfileOpen,
  setIsFullPartnerProfileOpen,
  isZeroSpendingConfirmed,
  setIsZeroSpendingConfirmed,
  isPartnerZeroSpendingConfirmed,
  setIsPartnerZeroSpendingConfirmed,
  handleDeleteEvent,
  handleSaveEvent,
  handleSetBudgetClick,
  setIsBudgetOpenFromMarriageWizard
}) {
  const stepId = editingEvent.wizardStep || 1;
  const showTaxesStep = !!inputs.includeTaxes;

  const handleNext = () => {
    if (stepId < 4) {
      setEditingEvent({ ...editingEvent, wizardStep: stepId + 1 });
    }
  };

  const handleBack = () => {
    if (stepId > 1) {
      setEditingEvent({ ...editingEvent, wizardStep: stepId - 1 });
    }
  };

  // Calculate Combined Live Summary
  const userIncome = Number(inputs.simpleIncome) || 50000;
  const userSavingsRate = Number(inputs.preTaxSavingsRate) || 15;
  const spouseIncome = Number(editingEvent.spouseIncome) || 0;
  const combinedIncome = calculateCombinedIncome(userIncome, spouseIncome);

  const {
    userAssets,
    spouseAssets,
    combinedAssets,
    userDebt,
    spouseDebt,
    combinedDebt,
    isSavingsDisabled,
    postWeddingFinancedDebt,
    postWeddingNetWorth,
    isNetWorthBelowZero
  } = validateWeddingCostFunding(editingEvent, inputs);

  // Calculate user spending baseline pre-retirement
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

  const estimates = calculateMarriageEstimates(editingEvent, inputs);
  const partnerSavings = estimates ? estimates.partnerSavings : 0;
  const partnerTakeHomeRemaining = estimates ? estimates.partnerTakeHomeRemaining : 0;
  const housingCostAmount = estimates ? estimates.housingCostAmount : 0;
  const lifestyleAdjustmentAmount = estimates ? estimates.lifestyleAdjustmentAmount : 0;
  const combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
  const spouseRetSpendingVal = estimates ? estimates.spouseRetSpendingVal : 0;

  const partnerPersonalSpending = Math.round(partnerTakeHomeRemaining / 12);

  // Monthly budget preview calculations
  const userSavingsMonthly = Object.values(inputs.budgetDetails?.savings || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const userFlatSavings = (Number(inputs.simpleIncome) || 50000) * ((Number(inputs.preTaxSavingsRate) || 15) / 100) / 12;
  const userSavings = userSavingsMonthly > 0 ? userSavingsMonthly : Math.round(userFlatSavings);
  const partnerSavingsMonthly = partnerSavings / 12;
  const combinedSavings = userSavings + partnerSavingsMonthly;
  const surplusMonthly = combinedIncome / 12 - combinedSpendingVal / 12;
  const leftoverGap = surplusMonthly - combinedSavings;

  const isStep4Invalid = (combinedSpendingVal <= userSpendingPreRetirement && !isZeroSpendingConfirmed) || (partnerPersonalSpending === 0 && !isPartnerZeroSpendingConfirmed);

  const isPreviewStep = stepId === 4;
  let beforeReadyAge = null;
  let afterReadyAge = null;
  if (isPreviewStep) {
    const beforeInputs = {
      ...inputs,
      lifeEvents: (inputs.lifeEvents || []).filter(e => e.type !== 'marriage')
    };
    const beforeRes = runFireSimulation(beforeInputs);
    beforeReadyAge = beforeRes.retirementReadyAge;

    const afterInputs = {
      ...inputs,
      lifeEvents: [
        ...(inputs.lifeEvents || []).filter(e => e.type !== 'marriage'),
        {
          ...createMarriageEventObject(editingEvent, inputs),
          enabled: true
        }
      ],
      householdMembers: [
        ...(inputs.householdMembers || []).filter(m => m.id !== 'spouse'),
        {
          ...createSpouseRecord(editingEvent, inputs),
          desiredRetirementAge: null // Forces spouse to retire at same age as user in preview
        }
      ]
    };
    const afterRes = runFireSimulation(afterInputs);
    afterReadyAge = afterRes.retirementReadyAge;
  }


  return (
    <div className="modal-backdrop" onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: 'bold',
          marginBottom: stepId === 1 ? '1.5rem' : '1.25rem',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: stepId === 1 ? '1px solid var(--border-color)' : 'none',
          paddingBottom: stepId === 1 ? '1rem' : '0'
        }}>
          💍 Get Married
        </h3>

        {/* Stepper Headers - hidden on Step 1 */}
        {stepId > 1 && (
          <div className="wizard-steps-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            {/* Step 1: Congratulations */}
            <div className={`wizard-step-node ${stepId === 1 ? 'active' : ''} ${stepId > 1 ? 'completed' : ''}`} onClick={() => setEditingEvent({ ...editingEvent, wizardStep: 1 })}>
              <div className="wizard-step-icon">1</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Congratulations</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 2 ? 'active' : ''}`} />

            {/* Step 2: Wedding */}
            <div className={`wizard-step-node ${stepId === 2 ? 'active' : ''} ${stepId > 2 ? 'completed' : ''}`} onClick={() => setEditingEvent({ ...editingEvent, wizardStep: 2 })}>
              <div className="wizard-step-icon">2</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Wedding</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 3 ? 'active' : ''}`} />

            {/* Step 3: Life Together */}
            <div className={`wizard-step-node ${stepId === 3 ? 'active' : ''} ${stepId > 3 ? 'completed' : ''}`} onClick={() => setEditingEvent({ ...editingEvent, wizardStep: 3 })}>
              <div className="wizard-step-icon">3</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Life Together</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 4 ? 'active' : ''}`} />

            {/* Step 4: Marriage Impact */}
            <div className={`wizard-step-node ${stepId === 4 ? 'active' : ''}`} onClick={() => {
              setEditingEvent({ ...editingEvent, wizardStep: 4 });
            }}>
              <div className="wizard-step-icon">4</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Marriage Impact</span>
            </div>
          </div>
        )}

        {/* STEP 1: CONGRATULATIONS */}
        {stepId === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
              <h4 style={{
                fontSize: '2rem',
                fontWeight: '800',
                margin: '0 0 0.5rem 0',
                backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block'
              }}>
                Congrats! 🎉
              </h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                You'll combine finances after marriage.
              </p>
            </div>

            {/* Grid of Key Benefits */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <div className="marriage-benefit-card">
                <Wallet size={28} color="#1e3a5f" strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>More Income</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Bigger monthly budget.</p>
                </div>
              </div>

              <div className="marriage-benefit-card">
                <TrendingUp size={28} color="#10b981" strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>Faster Savings</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Grow investments faster.</p>
                </div>
              </div>

              <div className="marriage-benefit-card">
                <Home size={28} color="#fbbf24" strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>Lower Costs</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Share housing expenses.</p>
                </div>
              </div>

              <div className="marriage-benefit-card">
                <Target size={28} color="#3b82f6" strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>Aligned Goals</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Plan retirement together.</p>
                </div>
              </div>
            </div>

            {/* Edit Partner Profile Toggle Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                key="toggle-partner-profile"
                type="button"
                onClick={() => setIsFullPartnerProfileOpen(!isFullPartnerProfileOpen)}
                aria-label={isFullPartnerProfileOpen ? 'Hide Partner Profile' : 'Edit Partner Profile'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 1rem',
                }}
              >
                <User size={16} />
                {isFullPartnerProfileOpen ? 'Hide Partner Profile' : 'Edit Partner'}
                <span style={{ fontSize: '0.85rem' }}>{isFullPartnerProfileOpen ? '▾' : ' ›'}</span>
              </button>
            </div>

            {/* Advanced Partner Profile Controls (Progressive Disclosure) */}
            {isFullPartnerProfileOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Advanced Partner Profile</span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-wrapper">
                    <span className="input-name">Marriage Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.age}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { age: parseInt(e.target.value) || inputs.currentAge }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Partner Current Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? editingEvent.spouseCurrentAge : editingEvent.age}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseCurrentAge: parseInt(e.target.value) || editingEvent.age }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Income ($/year)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseIncome}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseIncome: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Savings Rate (%)</span>
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.savingsRate}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { savingsRate: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Partner Assets ($)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={Number(editingEvent.cash || 0) + Number(editingEvent.investments || 0) + Number(editingEvent.retirement || 0)}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { investments: parseFloat(e.target.value) || 0, cash: 0, retirement: 0 }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Partner Debt ($)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={Number(editingEvent.debtStudent || 0) + Number(editingEvent.debtCredit || 0) + Number(editingEvent.debtOther || 0)}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { debtOther: parseFloat(e.target.value) || 0, debtStudent: 0, debtCredit: 0 }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Work Optional Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== null ? editingEvent.spouseDesiredRetirementAge : ''}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseDesiredRetirementAge: e.target.value !== '' ? parseInt(e.target.value) : null }))}
                      placeholder="e.g. 65 (optional)"
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Life Expectancy</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? editingEvent.spouseLifeExpectancy : 85}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseLifeExpectancy: parseInt(e.target.value) || 85 }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Social Security Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? editingEvent.spouseSocialSecurityAge : 67}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseSocialSecurityAge: parseInt(e.target.value) || 67 }))}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Est. SS Benefit ($/yr)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? editingEvent.spouseEstimatedSocialSecurityBenefit : 0}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseEstimatedSocialSecurityBenefit: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: WEDDING */}
        {stepId === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Plan Your Wedding</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Determine your wedding budget, evaluate funding sources, and identify any savings gaps.
              </p>
            </div>

            {/* Savings Summary */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Available Savings Summary</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Your Savings</div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formatCurrency(userAssets)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Partner Savings</div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formatCurrency(spouseAssets)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Total Savings</div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--success)' }}>{formatCurrency(userAssets + spouseAssets)}</strong>
                </div>
              </div>
            </div>

            {/* Wedding Cost Checkbox & Inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="include-wedding-cost"
                checked={editingEvent.includeWeddingCost !== undefined ? !!editingEvent.includeWeddingCost : true}
                onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { includeWeddingCost: e.target.checked }))}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              <label htmlFor="include-wedding-cost" className="input-name" style={{ margin: 0, cursor: 'pointer' }}>
                Plan to have a wedding celebration
              </label>
            </div>

            {(editingEvent.includeWeddingCost !== undefined ? !!editingEvent.includeWeddingCost : true) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                
                {/* Presets */}
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Cost Presets</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {[
                      { label: 'Court $500', value: 500 },
                      { label: 'Simple $5k', value: 5000 },
                      { label: 'Traditional $20k', value: 20000 },
                      { label: 'Dream $50k', value: 50000 }
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        className="list-builder-edit-btn"
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.3rem 0.6rem',
                          border: (editingEvent.weddingCost === preset.value) ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: (editingEvent.weddingCost === preset.value) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          color: (editingEvent.weddingCost === preset.value) ? 'var(--primary)' : 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          const val = preset.value;
                          const willBeDisabled = val > combinedAssets;
                          const nextMethod = (willBeDisabled && (editingEvent.weddingFundingMethod || 'savings') === 'savings') ? 'debt' : (editingEvent.weddingFundingMethod || 'savings');
                          setEditingEvent(Object.assign({}, editingEvent, { weddingCost: val, weddingFundingMethod: nextMethod }));
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="list-builder-edit-btn"
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.3rem 0.6rem',
                        border: ![500, 5000, 20000, 50000].includes(editingEvent.weddingCost) ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        background: ![500, 5000, 20000, 50000].includes(editingEvent.weddingCost) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                        color: ![500, 5000, 20000, 50000].includes(editingEvent.weddingCost) ? 'var(--primary)' : 'var(--text-primary)'
                      }}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {/* Manual cost and age input */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-wrapper">
                    <span className="input-name">Wedding Cost ($)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ 
                        width: '100%',
                        color: (editingEvent.weddingCost || 0) > 0 ? '#f43f5e' : 'inherit',
                        fontWeight: (editingEvent.weddingCost || 0) > 0 ? 'bold' : 'normal'
                      }}
                      value={editingEvent.weddingCost !== undefined ? editingEvent.weddingCost : 20000}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const willBeDisabled = val > combinedAssets;
                        const nextMethod = (willBeDisabled && (editingEvent.weddingFundingMethod || 'savings') === 'savings') ? 'debt' : (editingEvent.weddingFundingMethod || 'savings');
                        setEditingEvent(Object.assign({}, editingEvent, { weddingCost: val, weddingFundingMethod: nextMethod }));
                      }}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Wedding Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.weddingAge !== undefined ? editingEvent.weddingAge : editingEvent.age}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingAge: parseInt(e.target.value) || editingEvent.age }))}
                    />
                  </div>
                </div>

                {/* Funding Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>How will you fund the wedding?</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
                          gap: '0.4rem', 
                          fontSize: '0.75rem', 
                          color: 'var(--text-primary)', 
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.5 : 1
                        }}>
                          <input
                            type="radio"
                            name="weddingFundingMethod"
                            value={opt.value}
                            checked={(editingEvent.weddingFundingMethod || 'savings') === opt.value}
                            disabled={isDisabled}
                            onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingFundingMethod: e.target.value }))}
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {editingEvent.weddingFundingMethod === 'debt' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.65rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Wedding Financing Details</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name" style={{ fontSize: '0.7rem' }}>Interest Rate (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                          value={editingEvent.weddingInterestRate !== undefined ? editingEvent.weddingInterestRate : 7}
                          onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingInterestRate: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name" style={{ fontSize: '0.7rem' }}>Payoff Timeline (Years)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                          value={editingEvent.weddingPayoffTimeline !== undefined ? editingEvent.weddingPayoffTimeline : 10}
                          onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingPayoffTimeline: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                      <input
                        type="checkbox"
                        id="wedding-has-payment-plan"
                        checked={editingEvent.weddingHasPaymentPlan !== undefined ? !!editingEvent.weddingHasPaymentPlan : true}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingHasPaymentPlan: e.target.checked }))}
                        style={{ width: '0.85rem', height: '0.85rem', cursor: 'pointer' }}
                      />
                      <label htmlFor="wedding-has-payment-plan" className="input-name" style={{ margin: 0, cursor: 'pointer', fontSize: '0.7rem' }}>
                        Set up a structured payment plan
                      </label>
                    </div>
                  </div>
                )}

                {/* Funding Gap Calculation Display */}
                {Number(editingEvent.weddingCost || 0) > (userAssets + spouseAssets) && (
                  <div style={{ border: '1px solid var(--warning)', backgroundColor: 'var(--warning-light)', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                    <strong style={{ color: 'var(--warning)' }}>⚠️ Funding Gap Identified</strong>
                    <span>
                      Wedding cost exceeds combined available savings by <strong>{formatCurrency(Number(editingEvent.weddingCost || 0) - (userAssets + spouseAssets))}</strong>.
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {(editingEvent.weddingFundingMethod || 'savings') === 'savings' && 'Note: This gap will result in negative liquid assets at the wedding age.'}
                      {(editingEvent.weddingFundingMethod || 'savings') === 'save_targeted' && 'Note: You will need to save this difference before the wedding.'}
                      {(editingEvent.weddingFundingMethod || 'savings') === 'debt' && `Financing this wedding adds ${formatCurrency(Number(editingEvent.weddingCost || 0) - (userAssets + spouseAssets))} of debt. Your net worth may go negative until the debt is paid down.`}
                    </span>
                    {editingEvent.weddingFundingMethod === 'debt' && isNetWorthBelowZero && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 'bold', marginTop: '0.15rem' }}>
                        Your net worth is below $0 because the wedding debt is larger than your available assets.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: LIFE TOGETHER */}
        {stepId === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Life Together</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Review automatic savings estimated from sharing housing, utilities, and services.
              </p>
            </div>

            {/* Shared Household Benefits */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                🏠 Shared Household Benefits
              </span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Housing Shared</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '0.1rem' }}>
                    Estimated Savings: +50% of current housing cost
                  </div>
                </div>
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Utilities Shared</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '0.1rem' }}>
                    Estimated Savings: +25% of utilities budget
                  </div>
                </div>
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Internet Shared</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '0.1rem' }}>
                    Estimated Savings: +50% of internet budget
                  </div>
                </div>
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Streaming Shared</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '0.1rem' }}>
                    Estimated Savings: +50% of streaming budget
                  </div>
                </div>
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border)', gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Household Goods Shared</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '0.1rem' }}>
                    Estimated Savings: +10% of household goods budget
                  </div>
                </div>
              </div>
            </div>

            {/* Savings Breakdown */}
            {estimates && estimates.savingsBreakdown && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>
                  Estimated Monthly Household Savings
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Housing</span>
                    <strong style={{ color: 'var(--success)' }}>+{formatCurrency(estimates.savingsBreakdown.housing)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Utilities</span>
                    <strong style={{ color: 'var(--success)' }}>+{formatCurrency(estimates.savingsBreakdown.utilities)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Internet</span>
                    <strong style={{ color: 'var(--success)' }}>+{formatCurrency(estimates.savingsBreakdown.internet)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Streaming</span>
                    <strong style={{ color: 'var(--success)' }}>+{formatCurrency(estimates.savingsBreakdown.streaming)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Other Shared</span>
                    <strong style={{ color: 'var(--success)' }}>+{formatCurrency(estimates.savingsBreakdown.otherShared)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Total Savings</span>
                    <strong style={{ color: 'var(--success)', fontSize: '0.95rem' }}>
                      +{formatCurrency(estimates.savingsBreakdown.total)}/mo
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Large CTA - Update Household Budget */}
            <button
              key="open-budget-wizard"
              type="button"
              onClick={() => {
                setIsBudgetOpenFromMarriageWizard(true);
                handleSetBudgetClick('workSave', true);
              }}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                marginTop: '0.5rem',
                background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a5f 100%)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)',
                transition: 'all 0.2s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              📊 Adjust Budget Details
            </button>
          </div>
        )}

        {/* STEP 4: MARRIAGE IMPACT */}
        {stepId === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Marriage Impact</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Compare your household financials and retirement readiness before and after marriage.
              </p>
            </div>

            {/* Tax Filing Status */}
            {showTaxesStep && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.01)', padding: '0.75rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Tax Filing Status</span>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filingStatus"
                      value="jointly"
                      checked={editingEvent.filingStatus === 'jointly'}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { filingStatus: e.target.value }))}
                    />
                    Married Filing Jointly
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filingStatus"
                      value="separately"
                      checked={editingEvent.filingStatus === 'separately'}
                      onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { filingStatus: e.target.value }))}
                    />
                    Married Filing Separately
                  </label>
                </div>
              </div>
            )}

            {/* Comparison Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Before Marriage Card */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'var(--bg-tertiary)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem', marginBottom: '0.5rem' }}>
                  Before Marriage
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Income:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userIncome / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Savings:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userSavings)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Spending:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userSpendingPreRetirement / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Savings Rate:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{Math.round(userSavingsRate)}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Net Worth:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userAssets - userDebt)}</strong>
                  </div>
                </div>
              </div>

              {/* After Marriage Card */}
              <div style={{ border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(139, 92, 246, 0.04) 100%)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', display: 'block', borderBottom: '1px solid var(--primary)', paddingBottom: '0.35rem', marginBottom: '0.5rem' }}>
                  After Marriage
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Income:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(combinedIncome / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Savings:</span>
                    <strong style={{ color: 'var(--success)' }}>{formatCurrency(combinedSavings)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Spending:</span>
                    <strong style={{ color: 'var(--danger)' }}>{formatCurrency(combinedSpendingVal / 12)}/mo</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Savings Rate:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{Math.round(((combinedSavings + Math.max(0, leftoverGap)) / (combinedIncome / 12)) * 100)}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--primary)', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Net Worth:</span>
                    <strong style={{ color: 'var(--success)' }}>{formatCurrency(combinedAssets - combinedDebt)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Wedding details summary */}
            {editingEvent.includeWeddingCost && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Wedding Cost:</span>
                  <strong style={{ color: 'var(--danger)' }}>{formatCurrency(editingEvent.weddingCost || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Funding Method:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {(editingEvent.weddingFundingMethod === 'savings') && 'Available Savings'}
                    {(editingEvent.weddingFundingMethod === 'save_targeted') && 'Save Until Wedding'}
                    {(editingEvent.weddingFundingMethod === 'debt') && 'Finance Difference'}
                  </strong>
                </div>
                {editingEvent.weddingFundingMethod === 'debt' && Number(editingEvent.weddingCost || 0) > (userAssets + spouseAssets) && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 'bold' }}>
                      <span>Debt Created:</span>
                      <span>+{formatCurrency(Number(editingEvent.weddingCost || 0) - (userAssets + spouseAssets))}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Financing this wedding adds {formatCurrency(Number(editingEvent.weddingCost || 0) - (userAssets + spouseAssets))} of debt. Your net worth may go negative until the debt is paid down.
                    </div>
                  </>
                )}
                {isNetWorthBelowZero && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.15rem', fontWeight: 'bold' }}>
                    Your net worth is below $0 because the wedding debt is larger than your available assets.
                  </div>
                )}
              </div>
            )}

            {/* Retirement Readiness Impact Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem', marginTop: '0.2rem' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Before Work Optional Age</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {beforeReadyAge ? `Age ${beforeReadyAge}` : 'Never Ready'}
                </div>
              </div>
              <div style={{
                border: '1px solid',
                borderColor: afterReadyAge && beforeReadyAge && afterReadyAge < beforeReadyAge ? 'var(--success)' : afterReadyAge && beforeReadyAge && afterReadyAge > beforeReadyAge ? 'var(--danger)' : 'var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                background: 'linear-gradient(135deg, var(--secondary-light) 0%, var(--secondary-light) 100%)',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>After Work Optional Age</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.2rem' }}>
                  {afterReadyAge ? `Age ${afterReadyAge}` : 'Never Ready'}
                </div>
                {afterReadyAge && beforeReadyAge && afterReadyAge !== beforeReadyAge && (
                  <div style={{ fontSize: '0.65rem', color: afterReadyAge < beforeReadyAge ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', marginTop: '0.1rem' }}>
                    {afterReadyAge < beforeReadyAge ? `Ready ${beforeReadyAge - afterReadyAge} years earlier! 🎉` : `Ready ${afterReadyAge - beforeReadyAge} years later`}
                  </div>
                )}
              </div>
            </div>

            {/* SWR display */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-0.5rem' }}>
              Retirement target calculated at <strong>{inputs.swr || 4.0}% SWR</strong> supporting both spouses.
            </div>

            {/* Warnings & Confirmations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* 1. Low Combined Spending Warning */}
              {combinedSpendingVal <= userSpendingPreRetirement && (
                <div style={{ border: '1px solid var(--danger)', backgroundColor: 'var(--danger-light)', padding: '0.75rem', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    id="confirm-zero-spending-preview"
                    checked={isZeroSpendingConfirmed}
                    onChange={(e) => setIsZeroSpendingConfirmed(e.target.checked)}
                    style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', marginTop: '0.1rem' }}
                  />
                  <label htmlFor="confirm-zero-spending-preview" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                    <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Low Combined Spending</strong>
                    I confirm that combined household spending after marriage is less than or equal to my single spending (meaning my spouse has no additional spending needs).
                  </label>
                </div>
              )}

              {/* 2. Zero Partner Personal Spending Warning */}
              {partnerPersonalSpending === 0 && (
                <div style={{ border: '1px solid var(--danger)', backgroundColor: 'var(--danger-light)', padding: '0.75rem', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    id="confirm-partner-zero-spending"
                    checked={isPartnerZeroSpendingConfirmed}
                    onChange={(e) => setIsPartnerZeroSpendingConfirmed(e.target.checked)}
                    style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', marginTop: '0.1rem' }}
                  />
                  <label htmlFor="confirm-partner-zero-spending" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                    <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Zero Partner Personal Spending</strong>
                    I confirm that partner personal spending is set to $0/month.
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {editingEvent.id ? (
              <>
                <button
                  type="button"
                  className="list-builder-remove-btn"
                  onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}
                  style={{ alignSelf: 'center', margin: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="list-builder-remove-btn"
                  onClick={handleDeleteEvent}
                  style={{
                    alignSelf: 'center',
                    margin: 0,
                    background: 'var(--danger)',
                    color: '#fff',
                    borderColor: 'var(--danger)',
                    cursor: 'pointer',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '4px',
                    fontWeight: '600',
                    fontSize: '0.8rem'
                  }}
                >
                  Delete Event
                </button>
              </>
            ) : stepId === 1 ? (
              <button
                type="button"
                onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '0.5rem 1rem',
                  transition: 'color 0.2s',
                  alignSelf: 'center',
                  margin: 0
                }}
              >
                Skip
              </button>
            ) : (
              <button
                type="button"
                className="list-builder-remove-btn"
                onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}
                style={{ alignSelf: 'center', margin: 0 }}
              >
                Cancel
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {stepId > 1 && (
              <button
                type="button"
                className="list-builder-edit-btn"
                onClick={handleBack}
                style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1rem', cursor: 'pointer' }}
              >
                Back
              </button>
            )}
            {stepId < 4 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleNext}
                style={stepId === 1 ? {
                  background: '#5850ec',
                  borderColor: '#5850ec',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.6rem 2.25rem',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(88, 80, 236, 0.2)',
                  border: 'none',
                  alignSelf: 'center',
                  margin: 0
                } : { alignSelf: 'center', margin: 0, padding: '0.4rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveEvent}
                style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1.2rem', fontWeight: 'bold', background: 'var(--success)', borderColor: 'var(--success)', cursor: 'pointer' }}
                disabled={isStep4Invalid}
              >
                Save Marriage Event
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
