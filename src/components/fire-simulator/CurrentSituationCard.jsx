import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency, formatAnnualSummaryCurrency } from './helpers';
import { CurrencyInput, PercentInput } from '../ui/PlainInputs';
import { getNormalizedPhases, buildBaselineCurrentInputs } from '../../fireCalculations';
import { setLastChartChangeType } from './changeTypeTracker';

export default function CurrentSituationCard({
  inputs,
  handleSetBudgetClick,
  onOpenLifeProfile,
  handleCreateEvent,
  showDebugButton,
  setShowDebugDrawer,
  setDebugTab,
  updateInput
}) {
  const [activePopover, setActivePopover] = useState(null);
  const [showAdvancedEvents, setShowAdvancedEvents] = useState(false);

  // Close popovers on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activePopover && !e.target.closest('.action-card-container')) {
        setActivePopover(null);
        setShowAdvancedEvents(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activePopover]);

  const simpleSavingsRate = useMemo(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income <= 0) return 0;
    const rate = ((income - expenses) / income) * 100;
    return Math.min(100, Math.max(0, Math.round(rate * 10) / 10));
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  const baselineEffectiveInputs = useMemo(() => {
    return buildBaselineCurrentInputs(inputs);
  }, [inputs]);

  const baselinePhases = useMemo(() => {
    return getNormalizedPhases(baselineEffectiveInputs);
  }, [baselineEffectiveInputs]);

  const baselineCurrentPhase = useMemo(() => {
    const currentAge = Number(inputs.currentAge) || 35;
    return baselinePhases.find(p => currentAge >= p.startAge && currentAge < p.endAge) || baselinePhases[0];
  }, [baselinePhases, inputs.currentAge]);

  const baselineMonthlyShortfall = useMemo(() => {
    return baselineCurrentPhase ? baselineCurrentPhase.monthlyBudgetShortfall || 0 : 0;
  }, [baselineCurrentPhase]);

  const baselineAnnualSpending = useMemo(() => {
    if (!baselineCurrentPhase) return 0;
    if (!inputs.hasCustomizedBudget) {
      const annualIncome = Number(inputs.simpleIncome) || 0;
      
      let savingsRate = 0;
      if (inputs.displayedSavingsRate !== undefined && inputs.displayedSavingsRate !== null) {
        savingsRate = Number(inputs.displayedSavingsRate);
      } else if (inputs.savingsRate !== undefined && inputs.savingsRate !== null) {
        savingsRate = Number(inputs.savingsRate);
      } else if (baselineCurrentPhase.displayedSavingsRate !== undefined && baselineCurrentPhase.displayedSavingsRate !== null) {
        savingsRate = Number(baselineCurrentPhase.displayedSavingsRate);
      } else if (baselineCurrentPhase.savingsRate !== undefined && baselineCurrentPhase.savingsRate !== null) {
        savingsRate = Number(baselineCurrentPhase.savingsRate);
      } else {
        // Fallback: derive from precise annual budget
        const preciseMonthlyExpenseTotal = Object.values(baselineCurrentPhase.expenses || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
        const preciseAnnualBudget = preciseMonthlyExpenseTotal * 12;
        savingsRate = annualIncome > 0 ? ((annualIncome - preciseAnnualBudget) / annualIncome) * 100 : 0;
      }
      
      const calculatedSpending = annualIncome * (1 - savingsRate / 100);
      const preciseMonthlyExpenseTotal = Object.values(baselineCurrentPhase.expenses || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
      const preciseAnnualBudget = preciseMonthlyExpenseTotal * 12;
      return Math.max(calculatedSpending, preciseAnnualBudget);
    } else {
      const preciseMonthlyExpenseTotal = Object.values(baselineCurrentPhase.expenses || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
      return preciseMonthlyExpenseTotal * 12;
    }
  }, [baselineCurrentPhase, inputs.hasCustomizedBudget, inputs.simpleIncome, inputs.displayedSavingsRate, inputs.savingsRate]);

  const baselineProfile = inputs.lifeProfile || {};
  const baselineHousehold = baselineProfile.household || {};
  const baselineHome = baselineProfile.home || {};
  const baselineChildren = baselineProfile.children || [];
  const baselineDebts = baselineProfile.debts || [];

  const actionRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '1rem 0.5rem',
    background: '#ffffff',
    border: 'none',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'background-color 0.2s, padding-left 0.2s'
  };

  const popoverStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: '100%',
    background: '#ffffff',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    marginTop: '0.5rem',
    padding: '0.5rem',
    boxSizing: 'border-box'
  };

  const popoverItemStyle = (disabled) => ({
    width: '100%',
    textAlign: 'left',
    padding: '0.6rem 0.75rem',
    background: 'none',
    border: 'none',
    color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: '500',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: '8px',
    display: 'block',
    transition: 'background var(--transition-fast)',
    outline: 'none'
  });

  return (
    <div 
      className="current-situation-card"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        width: '100%',
        boxSizing: 'border-box',
        gap: '0.75rem'
      }}
    >
      <style>{`
        .sidebar-navigation-row {
          outline: none;
        }
        .sidebar-navigation-row:hover {
          background-color: #f9fafb !important;
          padding-left: 0.75rem !important;
          border-radius: 8px;
        }
        .sidebar-navigation-row:hover .chevron {
          color: var(--text-primary) !important;
        }
        .sidebar-navigation-row .chevron {
          color: var(--text-tertiary);
          font-size: 20px;
          transition: color 0.2s;
        }
        .financial-snapshot-row:hover {
          background-color: #f9fafb;
        }
        .popover-item-hover:hover:not(:disabled) {
          background-color: #f3f4f6 !important;
        }
      `}</style>

      {/* Header Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🌱</span>
          <h3 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Your Situation
          </h3>
        </div>

        {/* Primary Profile Row */}
        <div 
          onClick={() => onOpenLifeProfile('household')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '16px',
            fontWeight: '500',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            flexWrap: 'wrap'
          }}
        >
          <span>{inputs.currentAge || 35}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>•</span>
          <span style={{
            fontSize: '0.85rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            background: '#f3e8ff',
            color: '#7e22ce',
            fontWeight: '600'
          }}>
            {baselineHousehold.status === 'married' ? 'Married' : baselineHousehold.status === 'partnered' ? 'Partnered' : 'Single'}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>•</span>
          <span style={{
            fontSize: '0.85rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            background: '#dcfce7',
            color: '#15803d',
            fontWeight: '600'
          }}>
            {baselineHome.status === 'own' ? 'Homeowner' : 'Renting'}
          </span>
          {baselineChildren.length > 0 && (
            <>
              <span style={{ color: 'var(--text-tertiary)' }}>•</span>
              <span style={{
                fontSize: '0.85rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
                background: '#fef9c3',
                color: '#a16207',
                fontWeight: '600'
              }}>
                {baselineChildren.length} {baselineChildren.length === 1 ? 'Child' : 'Children'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Financial Snapshot */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Annual Income */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.25rem 0.5rem',
            margin: '0 -0.5rem',
            borderRadius: '8px',
            transition: 'background-color 0.2s'
          }}
          className="financial-snapshot-row"
        >
          <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Annual Income</span>
          <CurrencyInput
            value={inputs.simpleIncome || 0}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              setLastChartChangeType('income_change');
              updateInput('simpleIncome', val);
            }}
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              textAlign: 'right',
              width: '120px',
              outline: 'none',
              fontFamily: 'inherit',
              padding: 0
            }}
          />
        </div>

        {/* Invested Assets */}
        <div 
          onClick={() => onOpenLifeProfile('assets')}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '0.25rem 0.5rem',
            margin: '0 -0.5rem',
            borderRadius: '8px',
            transition: 'background-color 0.2s'
          }}
          className="financial-snapshot-row"
        >
          <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Invested Assets</span>
          <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {formatCurrency(inputs.simpleInvestments || 0)}
          </span>
        </div>

        {/* Savings Rate */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.25rem 0.5rem',
            margin: '0 -0.5rem',
            borderRadius: '8px',
            transition: 'background-color 0.2s'
          }}
          className="financial-snapshot-row"
        >
          <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Savings Rate</span>
          <PercentInput
            value={simpleSavingsRate}
            precision={1}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              const income = Number(inputs.simpleIncome) || 0;
              const newExpenses = Math.round(income * (1 - val / 100));
              setLastChartChangeType('savings_rate_change');
              updateInput('simpleExpenses', newExpenses);
            }}
            min={0}
            max={100}
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--success)',
              background: 'transparent',
              border: 'none',
              textAlign: 'right',
              width: '60px',
              outline: 'none',
              fontFamily: 'inherit',
              padding: 0
            }}
          />
        </div>
        {inputs.currentAge === inputs.targetRetirementAge && (
          <div 
            style={{
              textAlign: 'right',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              marginTop: '-0.2rem',
              marginBottom: '0.4rem',
              paddingRight: '0.5rem'
            }}
          >
            Paused in retirement plan
          </div>
        )}

        {/* Spending (budget) */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.25rem 0.5rem',
            margin: '0 -0.5rem',
            borderRadius: '8px',
            opacity: 0.65
          }}
        >
          <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Spending (budget)</span>
          <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            {formatAnnualSummaryCurrency(baselineAnnualSpending)}
          </span>
        </div>

        {/* Shortfall */}
        {baselineMonthlyShortfall > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0.25rem 0.5rem', margin: '0 -0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', color: 'var(--accent-rose, #ef4444)', fontWeight: '600' }}>Shortfall</span>
              <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--accent-rose, #ef4444)' }}>
                -{formatCurrency(Math.round(baselineMonthlyShortfall))}/mo
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #9ca3af)', fontWeight: '400', textAlign: 'right' }}>
              Based on your current budget and required expenses.
            </div>
          </div>
        )}
      </div>

      {/* Actions Section */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
        {/* Set Budget */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => handleSetBudgetClick()}
            style={{ ...actionRowStyle, borderBottom: '1px solid rgba(0,0,0,0.05)' }}
            className="sidebar-navigation-row"
          >
            <span>Set Budget</span>
            <span className="chevron">&rsaquo;</span>
          </button>
        </div>

        {/* Add Life Decision */}
        <div className="action-card-container" style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setActivePopover(activePopover === 'decision' ? null : 'decision');
              setShowAdvancedEvents(false);
            }}
            style={{ ...actionRowStyle, borderBottom: '1px solid rgba(0,0,0,0.05)' }}
            className="sidebar-navigation-row"
          >
            <span>Add Life Decision</span>
            <span className="chevron">&rsaquo;</span>
          </button>

          {activePopover === 'decision' && (
            <div style={popoverStyle}>
              {(() => {
                const allOpts = [
                  { type: 'marriage', label: '💍 Get Married' },
                  { type: 'buyHouse', label: '🏠 Buy a House' },
                  { type: 'haveChild', label: '👶 Have a Child' },
                  { type: 'careerChange', label: '💼 Income Change' },
                  { type: 'move', label: '📍 Move / Relocate' },
                  { 
                     type: 'retire', 
                     label: '🏖 Retire', 
                     disabled: (inputs.lifeEvents || []).some(e => e.type === 'retire') 
                  },
                  { 
                     type: 'socialSecurity', 
                     label: '💰 Social Security', 
                     disabled: inputs.includeSocialSecurity !== false 
                  },
                  { type: 'pension', label: '📜 Pension' },
                  { type: 'rentalIncome', label: '🏢 Rental Income' },
                  { type: 'annuity', label: '📈 Annuity' },
                  { type: 'otherRetirementIncome', label: '💵 Other Income' },
                  { type: 'windfall', label: '💰 Windfall' },
                  { type: 'college', label: '🎓 College Costs' },
                  { type: 'debtPayoff', label: '💸 Debt Payoff' },
                  { type: 'custom', label: '➕ Custom Event' }
                ];

                const primaryKeys = ['marriage', 'buyHouse', 'haveChild', 'careerChange', 'move', 'windfall'];
                const advancedKeys = ['retire', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome', 'college', 'debtPayoff', 'custom'];

                const primaryOpts = allOpts.filter(o => primaryKeys.includes(o.type));
                const sortedPrimaryOpts = primaryKeys.map(k => primaryOpts.find(o => o.type === k)).filter(Boolean);

                const advancedOpts = allOpts.filter(o => advancedKeys.includes(o.type));
                const sortedAdvancedOpts = advancedKeys.map(k => advancedOpts.find(o => o.type === k)).filter(Boolean);

                return (
                  <>
                    {sortedPrimaryOpts.map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => {
                          handleCreateEvent(opt.type);
                          setActivePopover(null);
                        }}
                        style={popoverItemStyle(opt.disabled)}
                        className="popover-item-hover"
                      >
                        {opt.label} {opt.disabled ? ' (Already Added)' : ''}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowAdvancedEvents(!showAdvancedEvents)}
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        padding: '0.4rem 0.75rem',
                        background: 'none',
                        border: '1px dashed var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        display: 'block',
                        marginTop: '0.25rem',
                        marginBottom: '0.25rem',
                        boxSizing: 'border-box'
                      }}
                    >
                      {showAdvancedEvents ? 'Show Less ↑' : 'Show More ↓'}
                    </button>

                    {showAdvancedEvents && (
                      <>
                        <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.35rem 0' }} />
                        {sortedAdvancedOpts.map((opt) => (
                          <button
                            key={opt.type}
                            type="button"
                            disabled={opt.disabled}
                            onClick={() => {
                              handleCreateEvent(opt.type);
                              setActivePopover(null);
                            }}
                            style={popoverItemStyle(opt.disabled)}
                            className="popover-item-hover"
                          >
                            {opt.label} {opt.disabled ? ' (Already Added)' : ''}
                          </button>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Add Borrowing */}
        <div className="action-card-container" style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setActivePopover(activePopover === 'borrowing' ? null : 'borrowing')}
            style={{ ...actionRowStyle, borderBottom: 'none' }}
            className="sidebar-navigation-row"
          >
            <span>Add Borrowing</span>
            <span className="chevron">&rsaquo;</span>
          </button>

          {activePopover === 'borrowing' && (
            <div style={popoverStyle}>
              {[
                { type: 'studentLoan', label: '🎓 Student Loan' },
                { type: 'carLoan', label: '🚗 Car Loan' },
                { type: 'personalLoan', label: '💵 Personal Loan' },
                { type: 'creditCard', label: '💳 Credit Card Balance' }
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    handleCreateEvent(opt.type);
                    setActivePopover(null);
                  }}
                  style={popoverItemStyle(false)}
                  className="popover-item-hover"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Debug button (DEV environment only) */}
        {showDebugButton && (
          <button
            type="button"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: '700',
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '0.5rem 1rem',
              marginTop: 'auto',
              transition: 'all 0.2s',
              boxSizing: 'border-box'
            }}
            onClick={() => {
              setDebugTab('assumptions');
              setShowDebugDrawer(true);
            }}
          >
            ⚙️ Debug
          </button>
        )}
      </div>
    </div>
  );
}
