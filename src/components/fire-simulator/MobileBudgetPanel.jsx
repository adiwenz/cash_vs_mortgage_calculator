import { useState } from 'react';
import { 
  formatCurrency, 
  formatCompactCurrency, 
  clampMoneyValue, 
  clampPercentageValue,
  getTimelineAges,
  getEventsForAge,
  getAppliedEventsThroughAge,
  getBudgetForAge,
  getCategoryBreakdown,
  getChangesFromToday
} from './helpers';
import { getRetirementLimit, roundCurrency } from '../../simulatorMathUtils';
import { NumberInput } from '../ui/PlainInputs';
import { syncBudgetDetails } from '../../calculators/fire/index.js';

export default function MobileBudgetPanel({
  inputs,
  activePhaseObj,
  normalizedPhases,
  isMarriedMode,
  partnerMonthlyIncome,
  combinedIncome,
  needsTotal,
  wantsTotal,
  activeSavings,
  takeHomeIncome,
  activeDebts,
  activeC,
  isEditingNeeds,
  setIsEditingNeeds,
  isEditingWants,
  setIsEditingWants,
  isEditingSavings,
  setIsEditingSavings,
  defaultTemplate,
  budgetMonthlyIncome,
  setBudgetMonthlyIncome,
  budgetExpenses,
  setBudgetExpenses,
  budgetSavings,
  setBudgetSavings,
  budgetPartnerSavings,
  setBudgetPartnerSavings,
  handleSavingsChange,
  userAge,
  spouseAge,
  filingStatus,
  hsaCoverageType,
  activeBudgetPhase,
  handleSwitchBudgetPhase,
  savingsAllocMode,
  budgetHsaCoverage,
  pendingImprovement,
  handleCloseBudgetModal,
  handleSaveBudget,
  getPopoverDetails,
  getEventDetails,
  getBudgetPhaseThemeClass,
  totalAllocated,
  remainingBalance,
  modalTitle,
  isRetirementPhase,
  monthlyTax,
  handleClearNeeds,
  handleClearWants,
  handleClearSavings,
  handleToggleSavingsAllocMode,
  budgetScalingMode,
  handleToggleBudgetScalingMode,
  budgetShortfall,

  // Redesigned timeline properties
  selectedBudgetAge,
  setSelectedBudgetAge,
  handleSelectBudgetAge,
  selectedCategory,
  setSelectedCategory,
  handleLockedRowClick,
  handleAddEvent,
  eventController
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const syncResult = syncBudgetDetails(inputs.simpleIncome, inputs.simpleExpenses, inputs.budgetDetails);
  
  // Timeline unique age items
  const timelineAges = getTimelineAges(inputs);

  // Budget state for the selected age
  const ageBudget = getBudgetForAge(inputs, selectedBudgetAge);

  // Applied changes for selected age impact banner
  const appliedEvents = getAppliedEventsThroughAge(inputs, selectedBudgetAge);
  
  const getAppliedChangesExplanations = () => {
    const explanations = [];
    appliedEvents.forEach(evt => {
      if (evt.type === 'marriage') {
        const spouseIncome = Number(evt.spouseIncome) || 0;
        if (spouseIncome > 0) {
          explanations.push(`+$${(spouseIncome).toLocaleString()}/yr income from Marriage`);
        } else {
          explanations.push(`Combined finances from Marriage`);
        }
      } else if (evt.type === 'haveChild') {
        explanations.push(`+$1,250/mo childcare from Child`);
        explanations.push(`+$100/mo groceries from Child`);
      } else if (evt.type === 'buyHouse') {
        explanations.push(`Mortgage replaces rent from Home Purchase`);
        const p = Number(evt.homePrice || evt.purchasePrice) || 0;
        const dp = Number(evt.downPayment) || 0;
        const loanAmount = Math.max(0, p - dp);
        const rate = (evt.mortgageRate !== undefined ? Number(evt.mortgageRate) : 6.5) / 100;
        const term = evt.loanTerm !== undefined ? Number(evt.loanTerm) : 30;
        let monthlyPI = 0;
        if (loanAmount > 0 && term > 0) {
          const r = rate / 12;
          const n = term * 12;
          monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        }
        if (monthlyPI > 0) {
          explanations.push(`Housing +$${Math.round(monthlyPI)}/mo from Home Purchase`);
        }
      } else if (evt.type === 'socialSecurity') {
        const benefit = Number(evt.claimingAge !== undefined ? evt.claimingAge : evt.age) || 67;
        const actualBenefit = Number(evt.monthlyBenefit) || 2000;
        explanations.push(`+$${(actualBenefit).toLocaleString()}/mo Social Security`);
      } else if (evt.type === 'windfall') {
        explanations.push(`+$${(Number(evt.amount) || 0).toLocaleString()} windfall`);
      } else if (evt.type === 'careerChange' || evt.type === 'promotion') {
        const amt = Number(evt.amount || evt.salaryIncrease) || 0;
        explanations.push(`+$${(amt / 12).toLocaleString()}/mo income from Promotion`);
      } else if (evt.type === 'retire') {
        explanations.push(`Stop Working starts`);
      }
    });
    return explanations;
  };

  const impactExps = getAppliedChangesExplanations();
  const changesFromToday = getChangesFromToday(inputs, selectedBudgetAge);

  const totalExpensesMonthly = Object.values(budgetExpenses || {}).reduce((sum, val) => sum + val, 0);
  const surplusMonthly = Math.max(0, combinedIncome - totalExpensesMonthly);
  const estBrokerageMonthly = savingsAllocMode === 'percentSurplus'
    ? roundCurrency(surplusMonthly * ((budgetSavings.brokerage || 0) / 100))
    : (budgetSavings.brokerage || 0);
  const estPartnerBrokerageMonthly = savingsAllocMode === 'percentSurplus'
    ? roundCurrency(surplusMonthly * ((budgetPartnerSavings.brokerage || 0) / 100))
    : (budgetPartnerSavings.brokerage || 0);

  return (
    <div className="mobile-budget-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--text-primary)', padding: '1rem', position: 'relative', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
            🎯 {modalTitle}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Tap Needs, Wants, or Savings & Investing rings to view and edit details.
          </span>
        </div>
        <button 
          type="button" 
          onClick={handleCloseBudgetModal}
          className="modal-close-btn"
        >
          ✖
        </button>
      </div>

      {!inputs.hasCustomizedBudget && syncResult.autoReducedBudget === true && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '8px',
          padding: '0.6rem 0.85rem',
          marginBottom: '1rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>ℹ️</span>
          <div>
            <h5 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary, #3b82f6)' }}>
              Modeling budget
            </h5>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {syncResult.isFullSavingsRate
                ? "This savings target uses your full monthly income, so Needs and Wants are shown as $0 for this projection."
                : "Your savings target leaves less room for spending, so Wants were reduced first and Needs were reduced only as needed for this projection."}
            </p>
          </div>
        </div>
      )}

      {/* Swipeable Tabs for Life Events Timeline */}
      <h4 className="budget-phases-heading" style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
        Life Events Timeline
      </h4>
      <div 
        className="budget-modal-tabs" 
        style={{ 
          display: 'flex', 
          overflowX: 'auto', 
          gap: '0.5rem', 
          marginBottom: '1rem', 
          paddingBottom: '0.4rem', 
          WebkitOverflowScrolling: 'touch' 
        }}
      >
        {timelineAges.map((t) => {
          const isSelected = t.age === selectedBudgetAge;
          const isToday = t.age === inputs.currentAge;
          const labelText = isToday ? `Today (Age ${t.age})` : `Age ${t.age} (${t.year})`;
          
          return (
            <button
              key={t.age}
              type="button"
              className={`budget-modal-tab ${isSelected ? 'active' : ''}`}
              style={{
                flex: '0 0 auto',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                borderRadius: '8px',
                border: isSelected ? '2px solid var(--theme-border-selected, var(--primary))' : '1px solid var(--border-color)',
                background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'none'
              }}
              onClick={() => handleSelectBudgetAge(t.age)}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                {t.label && t.label !== 'Today' ? t.label : (isToday ? 'Today' : '')}
              </div>
              <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {t.emojis.length > 0 && <span>{t.emojis.join('')}</span>}
                <span>{labelText}</span>
              </div>
            </button>
          );
        })}

        {/* Add Event Tab */}
        <button
          type="button"
          className="budget-modal-tab"
          style={{
            flex: '0 0 auto',
            padding: '0.4rem 0.85rem',
            fontSize: '0.78rem',
            borderRadius: '8px',
            border: '1px dashed var(--primary)',
            background: 'rgba(59, 130, 246, 0.05)',
            color: 'var(--primary)',
            cursor: 'pointer'
          }}
          onClick={() => setShowAddMenu(true)}
        >
          <div style={{ fontWeight: '600' }}>+ Add Event</div>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        {/* Scenario Recommendation Apply Banner */}
        {pendingImprovement && (
          <div style={{
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.25)',
            borderRadius: '6px',
            padding: '0.75rem',
            fontSize: '0.78rem',
            lineHeight: '1.4'
          }}>
            <span style={{ color: '#7c3aed', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>
              💡 Applying: {pendingImprovement.scenario.title}
            </span>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Detailed allocations updated. Please review below and tap <strong>Save Budget</strong>.
            </p>
          </div>
        )}

        {/* Impact Banner */}
        <div style={{
          background: selectedBudgetAge === inputs.currentAge ? 'rgba(16, 185, 129, 0.05)' : 'rgba(59, 130, 246, 0.05)',
          border: selectedBudgetAge === inputs.currentAge ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '1.1rem', marginTop: '-0.1rem' }}>{selectedBudgetAge === inputs.currentAge ? '💡' : 'ℹ️'}</span>
          <div>
            {selectedBudgetAge === inputs.currentAge ? (
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Set your monthly plan for today.
              </p>
            ) : (
              <div>
                <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary, #3b82f6)' }}>
                  Previewing changes through Age {selectedBudgetAge}
                </h5>
                {impactExps.length > 0 ? (
                  <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {impactExps.map((exp, idx) => (
                      <li key={idx} style={{ marginBottom: '0.15rem' }}>{exp}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    No budget-impacting event effects applied yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Salary & Net Summary Card */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block' }}>Monthly Net Salary</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{formatCurrency(takeHomeIncome)}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block' }}>Remaining Balance</span>
              <strong style={{ fontSize: '1.2rem', color: remainingBalance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {formatCurrency(remainingBalance)}
              </strong>
            </div>
          </div>
          <div style={{ display: 'flex', height: '0.5rem', borderRadius: '4px', overflow: 'hidden', background: 'var(--border-color)', marginTop: '0.25rem' }}>
            <div style={{ width: `${takeHomeIncome > 0 ? (needsTotal / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-emerald)' }} />
            <div style={{ width: `${takeHomeIncome > 0 ? (wantsTotal / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-amber)' }} />
            <div style={{ width: `${takeHomeIncome > 0 ? (activeSavings / takeHomeIncome) * 100 : 0}%`, background: '#7c3aed' }} />
          </div>
        </div>

        {/* Circular Rings Selector */}
        <div className="budget-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', margin: '0.5rem 0' }}>
          
          {/* Needs Ring */}
          {(() => {
            const pct = ageBudget.allocationPercentages.needs;
            const radius = 38;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference * (1 - pct / 100);
            return (
              <div 
                className="budget-card-circular budget-card needs"
                style={{ 
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.5rem 0.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  aspectRatio: '1',
                  background: 'var(--bg-primary)'
                }}
                onClick={() => setSelectedCategory('needs')}
              >
                <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(16, 185, 129, 0.08)" strokeWidth="5px" />
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--success)" strokeWidth="5px" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, pointerEvents: 'none', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.1rem' }}>🏠</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.1rem' }}>Needs</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{formatCurrency(needsTotal)}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{pct}%</span>
                </div>
              </div>
            );
          })()}

          {/* Wants Ring */}
          {(() => {
            const pct = ageBudget.allocationPercentages.wants;
            const radius = 38;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference * (1 - pct / 100);
            return (
              <div 
                className="budget-card-circular budget-card wants"
                style={{ 
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.5rem 0.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  aspectRatio: '1',
                  background: 'var(--bg-primary)'
                }}
                onClick={() => setSelectedCategory('wants')}
              >
                <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(245, 158, 11, 0.08)" strokeWidth="5px" />
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--warning)" strokeWidth="5px" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, pointerEvents: 'none', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.1rem' }}>🎉</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.1rem' }}>Wants</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{formatCurrency(wantsTotal)}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{pct}%</span>
                </div>
              </div>
            );
          })()}

          {/* Savings Ring */}
          {(() => {
            const pct = ageBudget.allocationPercentages.savings;
            const radius = 38;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference * (1 - pct / 100);
            return (
              <div 
                className="budget-card-circular budget-card save"
                style={{ 
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.5rem 0.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  aspectRatio: '1',
                  background: 'var(--bg-primary)'
                }}
                onClick={() => setSelectedCategory('savings')}
              >
                <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(124, 58, 237, 0.08)" strokeWidth="5px" />
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#7c3aed" strokeWidth="5px" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, pointerEvents: 'none', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.1rem' }}>💰</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.1rem' }}>Savings</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{isRetirementPhase ? '$0' : formatCurrency(activeSavings)}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{pct}%</span>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Changes from Today Section */}
        {selectedBudgetAge > inputs.currentAge && changesFromToday.length > 0 && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', margin: '0.25rem 0' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>🔄</span> Changes from Today
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {changesFromToday.map((chg, idx) => (
                <li key={idx}><strong>{chg.event}:</strong> {chg.text}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Strategy Controls (Strategy & Scaling) */}
        {!isRetirementPhase && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.25rem' }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Savings Strategy</span>
                <button
                  type="button"
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                  onClick={handleToggleSavingsAllocMode}
                >
                  Use {savingsAllocMode === 'percentSurplus' ? 'Fixed Dollars' : 'Surplus %'}
                </button>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                {savingsAllocMode === 'percentSurplus' 
                  ? 'Savings targets are percentage allocations of remaining monthly surplus.'
                  : 'Savings targets are set to exact monthly dollar amounts.'}
              </span>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Budget Scaling</span>
                <button
                  type="button"
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                  onClick={handleToggleBudgetScalingMode}
                >
                  Use {budgetScalingMode === 'lifestyle' ? 'Fixed Dollar' : 'Lifestyle'}
                </button>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                {budgetScalingMode === 'lifestyle' 
                  ? 'Lifestyle-Based: Expenses & savings scale proportionally with income.'
                  : 'Fixed Dollar: Expenses & savings remain fixed (adjusted for inflation only).'}
              </span>
            </div>
          </div>
        )}

        {/* Warning banner */}
        {(() => {
          const warnings = [];
          if (!isRetirementPhase) {
            const userAge = activePhaseObj?.startAge || inputs.currentAge || 30;
            const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled);
            const spouseMember = (inputs.lifeEvents || []).find(e => e.type === 'spouseMember');
            const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
              ? Number(spouseMember.currentAge)
              : (marriageEvent && marriageEvent.spouseCurrentAge !== undefined ? Number(marriageEvent.spouseCurrentAge) : inputs.currentAge || 30);
            const ageDifference = spouseCurrentAge - (inputs.currentAge || 30);
            const spouseAge = userAge + ageDifference;

            const hasBrokerage = inputs.assets && inputs.assets.brokerage !== undefined;
            const redirectTargetName = hasBrokerage ? 'brokerage account' : 'cash account';

            // User 401(k)
            const user401kVal = (budgetSavings.trad401k || 0) * 12;
            const user401kLimit = getRetirementLimit('401k', userAge, 'single');
            if (user401kVal > user401kLimit) {
              warnings.push(`Your 401(k) contribution of $${user401kVal.toLocaleString()}/year exceeds the IRS limit of $${user401kLimit.toLocaleString()}. Excess contributions will automatically be redirected to your ${redirectTargetName}.`);
            }

            // Spouse 401(k)
            if (isMarriedMode) {
              const spouse401kVal = (budgetPartnerSavings.trad401k || 0) * 12;
              const spouse401kLimit = getRetirementLimit('401k', spouseAge, 'single');
              if (spouse401kVal > spouse401kLimit) {
                warnings.push(`Your spouse's 401(k) contribution of $${spouse401kVal.toLocaleString()}/year exceeds the IRS limit of $${spouse401kLimit.toLocaleString()}. Excess contributions will automatically be redirected to your ${redirectTargetName}.`);
              }
            }

            // User IRA
            const userTradIraVal = (budgetSavings.tradIra || 0) * 12;
            const userRothIraVal = (budgetSavings.rothIra || 0) * 12;
            const userIraTotal = userTradIraVal + userRothIraVal;
            const userIraLimit = getRetirementLimit('traditionalIRA', userAge, 'single');
            if (userIraTotal > userIraLimit) {
              warnings.push(`Your combined IRA contributions of $${userIraTotal.toLocaleString()}/year exceed the IRS limit of $${userIraLimit.toLocaleString()}. Excess contributions will automatically be redirected to your ${redirectTargetName}.`);
            }

            // Spouse IRA
            if (isMarriedMode) {
              const spouseTradIraVal = (budgetPartnerSavings.tradIra || 0) * 12;
              const spouseRothIraVal = (budgetPartnerSavings.rothIra || 0) * 12;
              const spouseIraTotal = spouseTradIraVal + spouseRothIraVal;
              const spouseIraLimit = getRetirementLimit('traditionalIRA', spouseAge, 'single');
              if (spouseIraTotal > spouseIraLimit) {
                warnings.push(`Your spouse's combined IRA contributions of $${spouseIraTotal.toLocaleString()}/year exceed the IRS limit of $${spouseIraLimit.toLocaleString()}. Excess contributions will automatically be redirected to your ${redirectTargetName}.`);
              }
            }

            // User HSA
            const userHsaVal = (budgetSavings.hsa || 0) * 12;
            const userHsaLimit = getRetirementLimit('hsa', userAge, budgetHsaCoverage === 'family' ? 'married' : 'single');
            if (userHsaVal > userHsaLimit) {
              warnings.push(`Your HSA contribution of $${userHsaVal.toLocaleString()}/year exceeds the IRS limit of $${userHsaLimit.toLocaleString()}. Excess contributions will automatically be redirected to your ${redirectTargetName}.`);
            }

            // Spouse HSA
            if (isMarriedMode) {
              const spouseHsaVal = (budgetPartnerSavings.hsa || 0) * 12;
              const spouseHsaLimit = getRetirementLimit('hsa', spouseAge, budgetHsaCoverage === 'family' ? 'married' : 'single');
              if (spouseHsaVal > spouseHsaLimit) {
                warnings.push(`Your spouse's HSA contribution of $${spouseHsaVal.toLocaleString()}/year exceeds the IRS limit of $${spouseHsaLimit.toLocaleString()}. Excess contributions will automatically be redirected to your ${redirectTargetName}.`);
              }
            }
          }
          if (warnings.length === 0) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.75rem', padding: '0 0.5rem' }}>
              {warnings.map((w, i) => (
                <div key={i} style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                  ⚠️ {w}
                </div>
              ))}
            </div>
          );
        })()}

      </div>

      {/* Footer controls for Mobile */}
      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem' }}
          onClick={handleCloseBudgetModal}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 2, padding: '0.65rem', fontSize: '0.85rem' }}
          onClick={() => handleSaveBudget(defaultTemplate)}
        >
          Save Budget
        </button>
      </div>

      {/* Category Editor Overlay */}
      {selectedCategory && (
        <div 
          className="mobile-category-editor-overlay"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'var(--bg-secondary)', 
            zIndex: 2100, 
            display: 'flex', 
            flexDirection: 'column',
            padding: '1rem',
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
                {selectedCategory === 'needs' && '🏠 Needs'}
                {selectedCategory === 'wants' && '🎉 Wants'}
                {selectedCategory === 'savings' && '💰 Savings & Investing'}
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {selectedCategory === 'needs' && `Total: ${formatCurrency(needsTotal)}/mo`}
                {selectedCategory === 'wants' && `Total: ${formatCurrency(wantsTotal)}/mo`}
                {selectedCategory === 'savings' && `Total: ${isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo`}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setSelectedCategory(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: '0.5rem' }}
            >
              ✖
            </button>
          </div>

          {/* Scrollable Body */}
          <div 
            className="mobile-category-editor-body"
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.25rem', paddingBottom: '1.5rem' }}
          >
            {isRetirementPhase && selectedCategory === 'savings' ? (
              <div style={{ padding: '1rem 0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                🏖️ Savings are disabled during your Stop Working years. You are now drawing down from your portfolio to fund your living expenses.
              </div>
            ) : (
              getCategoryBreakdown(ageBudget, selectedCategory, inputs, isMarriedMode).map(row => (
                <div 
                  key={row.isPartner ? 'partner_' + row.key : row.key} 
                  className={`breakdown-row budget-input-row ${row.isLocked ? 'childcare-locked-glow' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.65rem',
                    cursor: row.isLocked ? 'pointer' : 'default',
                    position: 'relative'
                  }}
                  onClick={() => row.isLocked && handleLockedRowClick(row)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {row.label}
                      {row.isLocked && <span title={row.lockedReason} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>🔒</span>}
                    </span>
                    
                    {row.isLocked ? (
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {formatCurrency(row.amount)}/mo
                      </span>
                    ) : (
                      <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                        <span className="currency-symbol" style={{ fontSize: '0.8rem' }}>
                          {selectedCategory === 'savings' && savingsAllocMode === 'percentSurplus' ? '%' : '$'}
                        </span>
                        <NumberInput
                          className="input-number-box"
                          style={{ width: '100%', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          value={selectedCategory === 'savings' ? (row.isPartner ? (budgetPartnerSavings[row.key] || 0) : (budgetSavings[row.key] || 0)) : (budgetExpenses[row.key] || 0)}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            if (selectedCategory === 'savings') {
                              handleSavingsChange(row.key, val, row.isPartner);
                            } else {
                              setBudgetExpenses(prev => ({
                                ...prev,
                                [row.key]: val
                              }));
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {row.isLocked && row.lockedReason && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {row.lockedReason} (Tap to edit event)
                    </span>
                  )}

                  {selectedBudgetAge > inputs.currentAge && row.changeFromToday !== 0 && (
                    <span style={{ 
                      fontSize: '0.68rem', 
                      color: row.changeFromToday > 0 ? 'var(--accent-rose, #ef4444)' : 'var(--accent-emerald, #10b981)',
                      fontWeight: 'bold',
                      marginTop: '0.1rem'
                    }}>
                      {row.changeFromToday > 0 ? '+' : ''}{formatCurrency(row.changeFromToday)}/mo from Today
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Sticky Footer */}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto', background: 'var(--bg-secondary)' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ 
                flex: 1, 
                padding: '0.65rem', 
                fontSize: '0.85rem', 
                background: 'var(--danger)', 
                borderColor: 'var(--danger)', 
                color: '#ffffff' 
              }}
              onClick={() => {
                if (selectedCategory === 'needs') handleClearNeeds();
                if (selectedCategory === 'wants') handleClearWants();
                if (selectedCategory === 'savings') handleClearSavings();
              }}
            >
              Clear Category
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 2, padding: '0.65rem', fontSize: '0.85rem' }}
              onClick={() => setSelectedCategory(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Add Event Dialog */}
      {showAddMenu && (
        <div 
          className="mobile-category-editor-overlay"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'var(--bg-secondary)', 
            zIndex: 2200, 
            display: 'flex', 
            flexDirection: 'column',
            padding: '1rem',
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
              ➕ Add Event
            </h4>
            <button 
              type="button" 
              onClick={() => setShowAddMenu(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: '0.5rem' }}
            >
              ✖
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {['Marriage', 'Child', 'Home Purchase', 'Borrowing', 'Income Change / Promotion', 'Windfall', 'Retirement / Social Security'].map(type => (
              <button
                key={type}
                type="button"
                className="btn-secondary"
                style={{ width: '100%', padding: '0.8rem', textAlign: 'left', fontSize: '0.9rem', borderRadius: '8px' }}
                onClick={() => {
                  handleAddEvent(type);
                  setShowAddMenu(false);
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
