import React, { useState, useMemo } from 'react';
import { formatCurrency } from './helpers';
import CurrentConditionsPanel from './CurrentConditionsPanel';

export default function CurrentSituationCard({
  inputs,
  handleStep1Change,
  handleSetBudgetClick,
  handleOpenSavingsDetails,
  lastNonZeroSavingsRateRef,
  setEditingCondition,
  handleRemoveCurrentCondition,
  setIsCurrentSituationModalOpen
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [savingsRateOverride, setSavingsRateOverride] = useState(null);
  const [activeSavingsRate, setActiveSavingsRate] = useState(null);

  const simpleSavingsRate = useMemo(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income <= 0) return 0;
    return Math.round(((income - expenses) / income) * 100);
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  const handleFieldChange = (field, val) => {
    if (field === 'currentAge') {
      handleStep1Change('currentAge', val === '' ? null : (parseInt(val) || 0));
    } else if (field === 'simpleIncome') {
      const newIncome = val === '' ? null : (parseFloat(val) || 0);
      handleStep1Change('simpleIncome', newIncome);
      if (newIncome !== null) {
        const rate = activeSavingsRate !== null ? activeSavingsRate : simpleSavingsRate;
        const newExpenses = Math.round(newIncome * (1 - rate / 100));
        handleStep1Change('simpleExpenses', newExpenses);
      }
    } else if (field === 'simpleExpenses') {
      handleStep1Change('simpleExpenses', val === '' ? null : (parseFloat(val) || 0));
    } else if (field === 'simpleInvestments') {
      handleStep1Change('simpleInvestments', val === '' ? null : (parseFloat(val) || 0));
    }
  };

  const handleSavingsRateChange = (val) => {
    setSavingsRateOverride(val);
    if (val === '') return;
    const rate = parseFloat(val) || 0;
    const clampedRate = Math.min(100, Math.max(0, rate));
    if (lastNonZeroSavingsRateRef) {
      lastNonZeroSavingsRateRef.current = clampedRate;
    }
    const income = Number(inputs.simpleIncome) || 0;
    const newExpenses = Math.round(income * (1 - clampedRate / 100));
    handleStep1Change('simpleExpenses', newExpenses);
  };

  return (
    <div className="glass-card situation-summary-card" style={{
      padding: '0.65rem 1rem',
      marginBottom: '0.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
      border: '1px solid var(--border-color)',
      borderRadius: '12px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <h3 
          style={{ fontSize: '0.98rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
          onClick={() => setIsCurrentSituationModalOpen(true)}
        >
          🌱 Your Current Situation
        </h3>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '0.1rem 0.25rem'
            }}
            onClick={() => setIsCurrentSituationModalOpen(true)}
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            onClick={handleOpenSavingsDetails}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '0.1rem 0.25rem'
            }}
          >
            Details
          </button>
        </div>
      </div>

      {/* Values List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* Row 1: Age */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>🎂 Age</span>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <input
            type="number"
            className="input-number-box borderless-input"
            style={{
              width: '90px',
              height: '25px',
              fontSize: '0.98rem',
              padding: '0.1rem 0.35rem',
              textAlign: 'right',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid transparent',
              color: 'var(--text-primary)',
              fontWeight: '700',
              outline: 'none'
            }}
            value={inputs.currentAge === null ? '' : inputs.currentAge}
            placeholder="e.g. 35"
            onClick={() => handleStep1Change('currentAge', null)}
            onChange={(e) => handleFieldChange('currentAge', e.target.value)}
          />
        </div>

        {/* Row 2: Annual Income */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>💰 Annual Income</span>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '4px', color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: '600' }}>$</span>
            <input
              type="number"
              className="input-number-box borderless-input"
              style={{
                width: '100px',
                height: '25px',
                fontSize: '0.98rem',
                padding: '0.1rem 0.35rem 0.1rem 0.9rem',
                textAlign: 'right',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid transparent',
                color: 'var(--text-primary)',
                fontWeight: '700',
                outline: 'none'
              }}
              value={inputs.simpleIncome === null ? '' : inputs.simpleIncome}
              placeholder="e.g. 120000"
              onClick={() => {
                setActiveSavingsRate(simpleSavingsRate);
                handleStep1Change('simpleIncome', null);
              }}
              onBlur={() => {
                setActiveSavingsRate(null);
              }}
              onChange={(e) => handleFieldChange('simpleIncome', e.target.value)}
            />
          </div>
        </div>

        {/* Row 3: Annual Spending */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>🛒 Annual Spending</span>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '4px', color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: '600' }}>$</span>
            <input
              type="number"
              className="input-number-box borderless-input"
              style={{
                width: '100px',
                height: '25px',
                fontSize: '0.98rem',
                padding: '0.1rem 0.35rem 0.1rem 0.9rem',
                textAlign: 'right',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid transparent',
                color: 'var(--text-primary)',
                fontWeight: '700',
                outline: 'none'
              }}
              value={inputs.simpleExpenses === null ? '' : inputs.simpleExpenses}
              onChange={(e) => handleFieldChange('simpleExpenses', e.target.value)}
            />
          </div>
        </div>

        {/* Row 4: Current Savings */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>🏦 Current Savings</span>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '4px', color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: '600' }}>$</span>
            <input
              type="number"
              className="input-number-box borderless-input"
              style={{
                width: '100px',
                height: '25px',
                fontSize: '0.98rem',
                padding: '0.1rem 0.35rem 0.1rem 0.9rem',
                textAlign: 'right',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid transparent',
                color: 'var(--text-primary)',
                fontWeight: '700',
                outline: 'none'
              }}
              value={inputs.simpleInvestments === null ? '' : inputs.simpleInvestments}
              placeholder="e.g. 250000"
              onClick={() => handleStep1Change('simpleInvestments', null)}
              onChange={(e) => handleFieldChange('simpleInvestments', e.target.value)}
            />
          </div>
        </div>

        {/* Row 5: Savings Rate */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>📈 Savings Rate</span>
            <button
              type="button"
              onClick={() => handleSetBudgetClick()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Budget
            </button>
          </div>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              max="100"
              className="input-number-box borderless-input"
              style={{
                width: '90px',
                height: '25px',
                fontSize: '0.98rem',
                padding: '0.1rem 0.55rem 0.1rem 0.35rem',
                textAlign: 'right',
                color: 'var(--success)',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid transparent',
                fontWeight: '700',
                outline: 'none'
              }}
              value={savingsRateOverride !== null ? savingsRateOverride : simpleSavingsRate}
              placeholder="e.g. 20"
              onClick={() => setSavingsRateOverride('')}
              onChange={(e) => handleSavingsRateChange(e.target.value)}
              onBlur={() => setSavingsRateOverride(null)}
            />
            <span style={{ position: 'absolute', right: '4px', color: 'var(--success)', fontSize: '0.82rem', fontWeight: 'bold' }}>%</span>
          </div>
        </div>
      </div>

      {/* Show Details Toggle */}
      <button
        type="button"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          fontWeight: '600',
          cursor: 'pointer',
          padding: '0.2rem 0',
          textAlign: 'left',
          marginTop: '0.2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '3px'
        }}
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? 'Show Less ▴' : 'Show Details ▾'}
      </button>

      {/* Expanded Details Sub-Panel */}
      {showDetails && (
        <div style={{ 
          marginTop: '0.25rem', 
          borderTop: '1px solid var(--border-color)', 
          paddingTop: '0.5rem',
          maxHeight: '180px',
          overflowY: 'auto'
        }}>
          <CurrentConditionsPanel
            inputs={inputs}
            setEditingCondition={setEditingCondition}
            handleRemoveCurrentCondition={handleRemoveCurrentCondition}
          />
        </div>
      )}
    </div>
  );
}
