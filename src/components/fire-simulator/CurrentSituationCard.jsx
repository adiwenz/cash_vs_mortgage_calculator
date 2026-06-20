import React, { useState, useMemo } from 'react';
import { formatCurrency, clampAgeValue, clampMoneyValue, clampPercentageValue } from './helpers';
import { CurrencyInput, PercentInput, NumberInput } from '../ui/PlainInputs';

export default function CurrentSituationCard({
  inputs,
  handleStep1Change,
  handleSetBudgetClick,
  handleOpenSavingsDetails,
  lastNonZeroSavingsRateRef,
  setEditingCondition,
  handleRemoveCurrentCondition,
  setIsCurrentSituationModalOpen,
  onOpenAdvancedSettings
}) {
  const [isHovered, setIsHovered] = useState(false);
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
      if (newIncome !== null && !inputs.hasCustomizedBudget) {
        const rate = activeSavingsRate !== null ? activeSavingsRate : simpleSavingsRate;
        const newExpenses = Math.round(newIncome * (1 - rate / 100));
        handleStep1Change('simpleExpenses', newExpenses);
      }
    } else if (field === 'simpleExpenses') {
      if (inputs.hasCustomizedBudget) return;
      handleStep1Change('simpleExpenses', val === '' ? null : (parseFloat(val) || 0));
    } else if (field === 'simpleInvestments') {
      handleStep1Change('simpleInvestments', val === '' ? null : (parseFloat(val) || 0));
    }
  };

  const handleSavingsRateChange = (val) => {
    if (inputs.hasCustomizedBudget) return;
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
      </div>

      {/* Values List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* Row 1: Age */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>🎂 Age</span>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <NumberInput
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
            onChange={(e) => handleFieldChange('currentAge', e.target.value)}
            onBlur={(e) => {
              const clamped = clampAgeValue(e.target.value);
              handleStep1Change('currentAge', clamped);
            }}
          />
        </div>

        {/* Row 2: Annual Income */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>💰 Annual Income</span>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <CurrencyInput
              className="input-number-box borderless-input"
              style={{
                width: '100px',
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
              value={inputs.simpleIncome === null ? '' : inputs.simpleIncome}
              placeholder="e.g. 120000"
              useCompact={true}
              onFocus={() => {
                setActiveSavingsRate(simpleSavingsRate);
              }}
              onBlur={(e) => {
                setActiveSavingsRate(null);
                const clamped = clampMoneyValue(e.target.value);
                handleStep1Change('simpleIncome', clamped);
                if (clamped !== null && !inputs.hasCustomizedBudget) {
                  const rate = simpleSavingsRate;
                  const newExpenses = Math.round(clamped * (1 - rate / 100));
                  handleStep1Change('simpleExpenses', newExpenses);
                }
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
            <CurrencyInput
              className="input-number-box borderless-input"
              style={{
                width: '100px',
                height: '25px',
                fontSize: '0.98rem',
                padding: '0.1rem 0.35rem',
                textAlign: 'right',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid transparent',
                color: 'var(--text-primary)',
                fontWeight: '700',
                outline: 'none',
                opacity: inputs.hasCustomizedBudget ? 0.6 : 1
              }}
              disabled={inputs.hasCustomizedBudget}
              value={inputs.simpleExpenses === null ? '' : inputs.simpleExpenses}
              useCompact={true}
              onChange={(e) => handleFieldChange('simpleExpenses', e.target.value)}
              onBlur={(e) => {
                if (inputs.hasCustomizedBudget) return;
                const clamped = clampMoneyValue(e.target.value);
                handleStep1Change('simpleExpenses', clamped);
              }}
            />
          </div>
        </div>

        {/* Row 4: Current Savings */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '30px', padding: '0.1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>🏦 Current Savings</span>
            <button
              type="button"
              onClick={handleOpenSavingsDetails}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--success)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Details
            </button>
          </div>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.08)', margin: '0 0.4rem', alignSelf: 'flex-end', marginBottom: '6px' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <CurrencyInput
              className="input-number-box borderless-input"
              style={{
                width: '100px',
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
              value={inputs.simpleInvestments === null ? '' : inputs.simpleInvestments}
              placeholder="e.g. 250000"
              useCompact={true}
              onChange={(e) => handleFieldChange('simpleInvestments', e.target.value)}
              onBlur={(e) => {
                const clamped = clampMoneyValue(e.target.value);
                handleStep1Change('simpleInvestments', clamped);
              }}
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
            <PercentInput
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
                outline: 'none',
                opacity: inputs.hasCustomizedBudget ? 0.6 : 1
              }}
              disabled={inputs.hasCustomizedBudget}
              max={100}
              value={savingsRateOverride !== null ? savingsRateOverride : simpleSavingsRate}
              placeholder="e.g. 20"
              onFocus={() => {
                if (inputs.hasCustomizedBudget) return;
                setSavingsRateOverride(savingsRateOverride !== null ? savingsRateOverride : String(simpleSavingsRate));
              }}
              onChange={(e) => handleSavingsRateChange(e.target.value)}
              onBlur={(e) => {
                if (inputs.hasCustomizedBudget) return;
                setSavingsRateOverride(null);
                const clamped = clampPercentageValue(e.target.value);
                if (clamped !== null) {
                  if (lastNonZeroSavingsRateRef) {
                    lastNonZeroSavingsRateRef.current = clamped;
                  }
                  const income = Number(inputs.simpleIncome) || 0;
                  const newExpenses = Math.round(income * (1 - clamped / 100));
                  handleStep1Change('simpleExpenses', newExpenses);
                }
              }}
            />
            <span style={{ position: 'absolute', right: '4px', color: 'var(--success)', fontSize: '0.82rem', fontWeight: 'bold' }}>%</span>
          </div>
        </div>
        {simpleSavingsRate === 100 && (
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--success)',
            marginTop: '0.15rem',
            padding: '0.35rem 0.5rem',
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <span>Savings target set to 100%.</span>
            <button
              type="button"
              onClick={() => handleSetBudgetClick()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--success)',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontSize: '0.72rem'
              }}
            >
              Budget details updated →
            </button>
          </div>
        )}
      </div>


      {/* Show Details Trigger */}
      <button
        type="button"
        style={{
          background: 'none',
          border: 'none',
          color: isHovered ? 'var(--primary)' : 'var(--text-secondary)',
          fontSize: '0.75rem',
          fontWeight: '600',
          cursor: 'pointer',
          padding: '0.2rem 0',
          textAlign: 'left',
          marginTop: '0.2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          transition: 'color var(--transition-fast, 0.2s)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onOpenAdvancedSettings}
      >
        Show Details ▾
      </button>
    </div>
  );
}
