import React, { useState, useMemo } from 'react';
import { formatCurrency } from './helpers';
import { getNormalizedPhases } from '../../fireCalculations';

export default function ChildPlanningModal({
  scenario,
  eventController,
  simulation,
  uiState,
  onClose
}) {
  const inputs = scenario?.inputs || {};
  const editingEvent = eventController?.editingEvent;
  const handleSaveEvent = eventController?.handleSaveEvent;
  const handleDeleteEvent = eventController?.handleDeleteEvent;

  const isMobile = uiState?.isMobile || false;
  const isNew = !editingEvent || !editingEvent.id || editingEvent.isNew;

  // Step 1 local state
  const [childName, setChildName] = useState(editingEvent?.childName || '');
  const [birthAge, setBirthAge] = useState(editingEvent?.birthAge !== undefined ? editingEvent.birthAge : (inputs.currentAge || 35));
  
  // Estimate preset levels
  const getInitialCostLevel = () => {
    if (isNew) return 'average';
    const monthlyVal = Math.round((editingEvent.customAges0to4 || 15000) / 12);
    if (monthlyVal === 800) return 'low';
    if (monthlyVal === 1500) return 'average';
    if (monthlyVal === 2500) return 'high';
    return 'custom';
  };

  const getInitialCustomCost = () => {
    if (!editingEvent) return 1500;
    return Math.round((editingEvent.customAges0to4 || 15000) / 12);
  };

  const [costLevel, setCostLevel] = useState(getInitialCostLevel());
  const [customCost, setCustomCost] = useState(getInitialCustomCost());
  
  const [step, setStep] = useState(1);

  // Compute selected monthly childcare cost
  const childcareCostMonthly = useMemo(() => {
    if (costLevel === 'low') return 800;
    if (costLevel === 'average') return 1500;
    if (costLevel === 'high') return 2500;
    return Number(customCost) || 0;
  }, [costLevel, customCost]);

  // Compute Wants Budget from the active pre-child budget phase
  const wantsBudget = useMemo(() => {
    const normalizedPhases = getNormalizedPhases(inputs);
    const currentAgeVal = Number(birthAge) || inputs.currentAge || 30;
    
    // Find phase matching parent's age when child arrives, or fallback to current age
    const matchPhase = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normalizedPhases[0];
    if (!matchPhase || !matchPhase.expenses) return 0;
    
    return (Number(matchPhase.expenses.leisure) || 0) +
           (Number(matchPhase.expenses.diningOut) || 0) +
           (Number(matchPhase.expenses.misc) || 0);
  }, [inputs, birthAge]);

  const hasEnoughBudget = wantsBudget >= childcareCostMonthly;
  const incomeGap = Math.max(0, childcareCostMonthly - wantsBudget);

  const handleContinue = () => {
    setStep(2);
  };

  // Perform Save Action
  const onSave = (actionType) => {
    const otherChildren = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.id !== editingEvent?.id);
    const activeChildCount = otherChildren.length + 1;
    
    let updatedEvent = {
      ...editingEvent,
      childName,
      birthAge: Number(birthAge),
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: childcareCostMonthly * 12,
      customAges5to12: childcareCostMonthly * 12,
      customAges13to18: childcareCostMonthly * 12,
      customAges19to22: childcareCostMonthly * 12
    };

    if (actionType === 'rebalance') {
      // 1. Set noPromo to true
      updatedEvent.noPromo = true;
      updatedEvent.customPromoAmount = undefined;

      // 2. Perform budget reduction
      const normalizedPhases = getNormalizedPhases(inputs);
      const currentAgeVal = Number(birthAge) || inputs.currentAge || 30;
      const matchPhase = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normalizedPhases[0];
      const standardExpenses = matchPhase ? { ...matchPhase.expenses } : {};
      
      const X = Number(standardExpenses.leisure) || 0;
      const Y = Number(standardExpenses.diningOut) || 0;
      const Z = Number(standardExpenses.misc) || 0;
      const W = X + Y + Z;
      const C = childcareCostMonthly;

      const factor = W > 0 ? Math.max(0, (W - C) / W) : 0;
      const newExpenses = {
        ...standardExpenses,
        leisure: Math.round(X * factor),
        diningOut: Math.round(Y * factor),
        misc: Math.round(Z * factor)
      };

      // Correct for rounding difference
      const diff = Math.round(W - C) - (newExpenses.leisure + newExpenses.diningOut + newExpenses.misc);
      newExpenses.misc = Math.max(0, newExpenses.misc + diff);

      const standardIncome = Number(matchPhase?.income) || (Number(inputs.simpleIncome) / 12) || 4167;
      const newBudgets = { ...(inputs.budgetDetails?.childcareBudgets || {}) };
      newBudgets[activeChildCount] = {
        income: standardIncome,
        expenses: newExpenses,
        savings: { ...(matchPhase?.savings || {}) },
        partnerSavings: { ...(matchPhase?.partnerSavings || {}) },
        savingsAllocMode: matchPhase?.savingsAllocMode || 'fixed'
      };

      inputs.budgetDetails = {
        ...(inputs.budgetDetails || {}),
        childcareIncome: standardIncome,
        childcareExpenses: newExpenses,
        childcareBudgets: newBudgets
      };
    } else if (actionType === 'incomeGoal') {
      // 1. Create linked Income Goal event via custom promo amount
      updatedEvent.noPromo = false;
      updatedEvent.customPromoAmount = incomeGap * 12;
      updatedEvent.recommendationApplied = true;
    } else {
      // Save Anyway / Standard
      updatedEvent.noPromo = true;
      updatedEvent.customPromoAmount = undefined;

      // Clean up rebalanced budget for this child count
      const newBudgets = { ...(inputs.budgetDetails?.childcareBudgets || {}) };
      delete newBudgets[activeChildCount];
      inputs.budgetDetails = {
        ...(inputs.budgetDetails || {}),
        childcareBudgets: newBudgets
      };
    }

    handleSaveEvent(updatedEvent);
    onClose();
  };

  const handleDelete = () => {
    handleDeleteEvent(editingEvent);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="event-form-overlay-card modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '450px', 
          width: '90%', 
          padding: '1.75rem',
          margin: isMobile ? 'auto 1rem' : 'auto'
        }}
      >
        {step === 1 ? (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👶 {isNew ? 'Add Child' : 'Edit Child Details'}
            </h3>

            <div className="input-wrapper">
              <span className="input-name">Child's Name (Optional)</span>
              <input
                type="text"
                className="input-number-box"
                style={{ width: '100%', textAlign: 'left', marginTop: '0.35rem' }}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Liam"
              />
            </div>

            <div className="input-wrapper">
              <span className="input-name">Age Child Arrives (Parent's Age)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%', marginTop: '0.35rem' }}
                value={birthAge}
                onChange={(e) => setBirthAge(Math.max(18, Math.min(85, parseInt(e.target.value) || birthAge)))}
              />
            </div>

            <div className="input-wrapper">
              <span className="input-name" style={{ marginBottom: '0.5rem', display: 'block' }}>Estimated Childcare Cost</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { level: 'low', label: 'Low ($800/mo)' },
                  { level: 'average', label: 'Average ($1,500/mo)' },
                  { level: 'high', label: 'High ($2,500/mo)' },
                  { level: 'custom', label: 'Custom Monthly Cost' }
                ].map((item) => (
                  <label 
                    key={item.level} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.65rem', 
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="costLevel" 
                      value={item.level} 
                      checked={costLevel === item.level}
                      onChange={() => setCostLevel(item.level)}
                      style={{ cursor: 'pointer' }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              {costLevel === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>$</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '120px', textAlign: 'left' }}
                    value={customCost}
                    onChange={(e) => setCustomCost(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>/ month</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', alignItems: 'center' }}>
              {!isNew ? (
                <button 
                  type="button" 
                  onClick={handleDelete}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#ef4444', 
                    cursor: 'pointer', 
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    padding: 0
                  }}
                >
                  Delete Child
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={onClose}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleContinue}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👶 Affordability Check
            </h3>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>👶 Childcare Cost:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(childcareCostMonthly)}/mo</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>💜 Wants Budget:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(wantsBudget)}/mo</strong>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
              {hasEnoughBudget ? (
                <span>
                  Good news! Your current Wants budget can cover this childcare cost.
                </span>
              ) : (
                <span>
                  Childcare is <strong>{formatCurrency(incomeGap)}/mo</strong> more than your current Wants budget. To keep your current lifestyle, you may need about <strong>{formatCurrency(incomeGap)}/mo</strong> more income.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem' }}>
              {hasEnoughBudget ? (
                <>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={() => onSave('rebalance')}
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                  >
                    Rebalance Budget
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => onSave('save')}
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                  >
                    Save Child Event
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={() => onSave('incomeGoal')}
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                  >
                    Add Income Goal (+{formatCurrency(incomeGap)}/mo)
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => onSave('save')}
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                  >
                    Save Child Event Anyway
                  </button>
                </>
              )}
              
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setStep(1)}
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', background: 'none', border: '1px solid transparent' }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
