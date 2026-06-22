import { useState } from 'react';
import { 
  formatCurrency, 
  getTimelineAges, 
  getEventsForAge, 
  getAppliedEventsThroughAge, 
  getBudgetForAge, 
  getCategoryBreakdown, 
  getChangesFromToday 
} from './helpers';
import { getRetirementLimit, roundCurrency } from '../../simulatorMathUtils';
import { NumberInput, CurrencyInput } from '../ui/PlainInputs';
import { syncBudgetDetails } from '../../calculators/fire/index.js';

export default function DesktopBudgetPanel({
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
  showPopover,
  setShowPopover,
  isHovering,
  setIsHovering,
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
  activeSavingsRate,
  handleReduceWants,
  handleAutoReduceSavingsToBalance,
  handleIncreaseIncome,
  handleAllocateRemaining,
  handleToggleSavingsAllocMode,
  decideLater,
  setDecideLater,
  handleClearNeeds,
  handleClearWants,
  handleClearSavings,
  budgetScalingMode,
  handleToggleBudgetScalingMode,
  budgetShortfall,

  // Redesigned timeline props
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
  const breakdownRows = selectedCategory ? getCategoryBreakdown(ageBudget, selectedCategory, inputs, isMarriedMode) : [];

  return (
    <div className="budget-modal-layout" style={{ display: 'flex', height: '90vh', minHeight: '600px' }}>
      
      {/* Left Column: Life Events Timeline */}
      <aside className="budget-sidebar" style={{ display: 'flex', flexDirection: 'column', width: '260px', borderRight: '1px solid var(--border-color)', padding: '1.25rem', gap: '1rem', boxSizing: 'border-box' }}>
        <h4 className="budget-phases-heading budget-phases-heading-vertical" style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
          Life Events Timeline
        </h4>
        
        <div className="budget-sidebar-phases" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
          {/* Vertical line indicator */}
          <div style={{ position: 'absolute', left: '14px', top: '10px', bottom: '10px', width: '2px', background: 'var(--border-color)', zIndex: 0 }} />
          
          {timelineAges.map((t) => {
            const isSelected = t.age === selectedBudgetAge;
            const isToday = t.age === inputs.currentAge;
            
            return (
              <button
                key={t.age}
                type="button"
                className={`budget-sidebar-tab ${isSelected ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'none',
                  border: isSelected ? '1px solid var(--primary, #3b82f6)' : '1px solid transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  zIndex: 1,
                  position: 'relative',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleSelectBudgetAge(t.age)}
              >
                {/* Node Dot */}
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: isSelected ? 'var(--primary, #3b82f6)' : (isToday ? 'var(--text-primary)' : 'var(--bg-secondary)'),
                  border: `2px solid ${isSelected || isToday ? 'transparent' : 'var(--text-muted)'}`,
                  boxSizing: 'border-box',
                  marginLeft: '2px',
                  transition: 'all 0.2s'
                }} />
                
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                    {isToday ? `Today (Age ${t.age})` : `Age ${t.age} (${t.year})`}
                  </span>
                  {t.label && t.label !== 'Today' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {t.label}
                    </span>
                  )}
                </div>
                
                {t.emojis.length > 0 && (
                  <span style={{ fontSize: '1rem' }}>
                    {t.emojis.join(' ')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add Event bottom CTA */}
        <div style={{ position: 'relative', marginTop: 'auto', paddingTop: '0.5rem' }}>
          <button 
            type="button" 
            className="budget-sidebar-add-phase"
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem',
              padding: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: 'var(--primary, #3b82f6)',
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px dashed var(--primary, #3b82f6)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <span>+</span> Add Event
          </button>
          
          {showAddMenu && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              width: '100%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              marginBottom: '0.5rem'
            }}>
              {['Marriage', 'Child', 'Home Purchase', 'Borrowing', 'Income Change / Promotion', 'Windfall', 'Retirement / Social Security'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    handleAddEvent(type);
                    setShowAddMenu(false);
                  }}
                  style={{
                    padding: '0.55rem 0.75rem',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.2s'
                  }}
                  className="add-event-menu-item"
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Center Column: Budget Dashboard */}
      <main className="budget-main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem', overflowY: 'auto', boxSizing: 'border-box' }}>
        
        {/* Header */}
        <div className="budget-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🎯 {modalTitle}</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
              Configure your life event budget allocation details.
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

        {/* Impact Banner */}
        <div style={{
          background: selectedBudgetAge === inputs.currentAge ? 'rgba(16, 185, 129, 0.05)' : 'rgba(59, 130, 246, 0.05)',
          border: selectedBudgetAge === inputs.currentAge ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
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

        {/* Budget Rings */}
        <div className="budget-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', justifyItems: 'center', gap: '1.25rem', margin: '1rem 0' }}>
          
          {/* Needs Ring */}
          {(() => {
            const pct = ageBudget.allocationPercentages.needs;
            const radius = 72;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference * (1 - pct / 100);
            const isSelected = selectedCategory === 'needs';
            return (
              <div 
                className={`budget-card-circular budget-card needs ${isSelected ? 'active' : ''}`}
                style={{ 
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--success)' : '1px solid var(--border-color)',
                  boxShadow: isSelected ? '0 0 8px rgba(16, 185, 129, 0.2)' : 'none'
                }}
                onClick={() => setSelectedCategory(isSelected ? null : 'needs')}
              >
                <svg width="100%" height="100%" viewBox="0 0 180 180" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                  <circle cx="90" cy="90" r={radius} fill="transparent" stroke="rgba(16, 185, 129, 0.08)" strokeWidth="8px" />
                  <circle cx="90" cy="90" r={radius} fill="transparent" stroke="var(--success)" strokeWidth="8px" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                </svg>
                <div className="budget-card-circular-content">
                  <span className="budget-card-circular-icon">🏠</span>
                  <span className="budget-card-circular-label">Needs</span>
                  <span className="budget-card-circular-amount">{formatCurrency(needsTotal)}/mo</span>
                  <span className="budget-card-circular-pct">{pct}%</span>
                </div>
              </div>
            );
          })()}

          {/* Wants Ring */}
          {(() => {
            const pct = ageBudget.allocationPercentages.wants;
            const radius = 72;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference * (1 - pct / 100);
            const isSelected = selectedCategory === 'wants';
            return (
              <div 
                className={`budget-card-circular budget-card wants ${isSelected ? 'active' : ''}`}
                style={{ 
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--warning)' : '1px solid var(--border-color)',
                  boxShadow: isSelected ? '0 0 8px rgba(245, 158, 11, 0.2)' : 'none'
                }}
                onClick={() => setSelectedCategory(isSelected ? null : 'wants')}
              >
                <svg width="100%" height="100%" viewBox="0 0 180 180" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                  <circle cx="90" cy="90" r={radius} fill="transparent" stroke="rgba(245, 158, 11, 0.08)" strokeWidth="8px" />
                  <circle cx="90" cy="90" r={radius} fill="transparent" stroke="var(--warning)" strokeWidth="8px" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                </svg>
                <div className="budget-card-circular-content">
                  <span className="budget-card-circular-icon">🎉</span>
                  <span className="budget-card-circular-label">Wants</span>
                  <span className="budget-card-circular-amount">{formatCurrency(wantsTotal)}/mo</span>
                  <span className="budget-card-circular-pct">{pct}%</span>
                </div>
              </div>
            );
          })()}

          {/* Savings Ring */}
          {(() => {
            const pct = ageBudget.allocationPercentages.savings;
            const radius = 72;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference * (1 - pct / 100);
            const isSelected = selectedCategory === 'savings';
            return (
              <div 
                className={`budget-card-circular budget-card save ${isSelected ? 'active' : ''}`}
                style={{ 
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                  boxShadow: isSelected ? '0 0 8px rgba(124, 58, 237, 0.2)' : 'none'
                }}
                onClick={() => setSelectedCategory(isSelected ? null : 'savings')}
              >
                <svg width="100%" height="100%" viewBox="0 0 180 180" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                  <circle cx="90" cy="90" r={radius} fill="transparent" stroke="rgba(124, 58, 237, 0.08)" strokeWidth="8px" />
                  <circle cx="90" cy="90" r={radius} fill="transparent" stroke="#7c3aed" strokeWidth="8px" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                </svg>
                <div className="budget-card-circular-content">
                  <span className="budget-card-circular-icon">💰</span>
                  <span className="budget-card-circular-label">Savings & Investing</span>
                  <span className="budget-card-circular-amount">{isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo</span>
                  <span className="budget-card-circular-pct">{pct}%</span>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Income & Budget Summary Cards */}
        <div className="budget-summary-section" style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', margin: '0.75rem 0' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Monthly Income</span>
            <CurrencyInput
              style={{
                fontSize: '1.1rem',
                fontWeight: 'bold',
                padding: '0.2rem 0.4rem',
                width: '110px',
                color: 'var(--text-primary)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px'
              }}
              value={budgetMonthlyIncome}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                setBudgetMonthlyIncome(val);
              }}
            />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Salary (Net)</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatCurrency(takeHomeIncome)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>
              Gross: {formatCurrency(combinedIncome)}/mo
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spending</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatCurrency(needsTotal + wantsTotal)}/mo</span>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Savings Rate</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{activeSavingsRate}%</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>
              Savings: {formatCurrency(activeSavings)}/mo
            </span>
          </div>
        </div>

        {/* Shortfall warnings and strategy buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {budgetShortfall > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-rose, #ef4444)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '0.6rem 0.85rem', borderRadius: '6px', fontWeight: 'bold' }}>
              ⚠️ Budget Shortfall: {formatCurrency(budgetShortfall)}/mo. Required obligations exceed income.
            </div>
          )}
          {Math.abs(remainingBalance) <= 1 && budgetShortfall <= 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '0.6rem 0.85rem', borderRadius: '6px', fontWeight: 'bold' }}>
              ✅ You’re on track. You’re saving {activeSavingsRate}% of your income.
            </div>
          )}
          {remainingBalance < -1 && budgetShortfall <= 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-rose, #ef4444)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '0.6rem 0.85rem', borderRadius: '6px', fontWeight: 'bold' }}>
              ⚠️ Over budget by {formatCurrency(Math.abs(remainingBalance))}/mo.
            </div>
          )}
          {remainingBalance > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '0.6rem 0.85rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>💡 {formatCurrency(remainingBalance)}/mo remains unallocated.</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" className="list-builder-edit-btn" style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }} onClick={() => handleAllocateRemaining('hysa')}>Put in HYSA</button>
                <button type="button" className="list-builder-edit-btn" style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }} onClick={() => handleAllocateRemaining('brokerage')}>Put in Brokerage</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.4rem 1.1rem', fontSize: '0.8rem' }}
            onClick={handleCloseBudgetModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '0.4rem 1.1rem', fontSize: '0.8rem' }}
            onClick={() => handleSaveBudget(defaultTemplate)}
          >
            Save Budget
          </button>
        </div>
      </main>

      <div 
        className={`budget-breakdown-sidebar ${selectedCategory !== null ? 'open' : ''}`} 
        style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
      >
        {selectedCategory !== null && (
          /* Active Category details */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
                  {selectedCategory === 'needs' && 'Needs'}
                  {selectedCategory === 'wants' && 'Wants'}
                  {selectedCategory === 'savings' && 'Savings & Investing'}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    {selectedCategory === 'needs' && `${formatCurrency(needsTotal)}/mo`}
                    {selectedCategory === 'wants' && `${formatCurrency(wantsTotal)}/mo`}
                    {selectedCategory === 'savings' && (isRetirementPhase ? '$0' : `${formatCurrency(activeSavings)}/mo`)}
                  </strong>
                  <button 
                    type="button" 
                    onClick={() => setSelectedCategory(null)}
                    className="modal-close-btn section-close-btn"
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '1.2rem', 
                      marginLeft: '0.25rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer'
                    }}
                    title="Close section"
                  >
                    ✖
                  </button>
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                {selectedCategory === 'needs' && 'Essential living expenses (Housing, food, healthcare)'}
                {selectedCategory === 'wants' && 'Discretionary lifestyle expenses (Leisure, dining out)'}
                {selectedCategory === 'savings' && 'Wealth building allocations (Retirement accounts, brokerage)'}
              </span>
            </div>

            {/* Changes from Today Section */}
            {selectedBudgetAge > inputs.currentAge && changesFromToday.length > 0 && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
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

            {/* Rows list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
              {isRetirementPhase && selectedCategory === 'savings' ? (
                <div style={{ padding: '1rem 0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                  🏖️ Savings are disabled during your Stop Working years. You are now drawing down from your portfolio to fund your living expenses.
                </div>
              ) : (
                breakdownRows.map(row => (
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
                      <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {row.label}
                        {row.isLocked && <span title={row.lockedReason} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>🔒</span>}
                      </span>
                      
                      {row.isLocked ? (
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {formatCurrency(row.amount)}/mo
                        </span>
                      ) : (
                        <div className="input-prefix-wrapper" style={{ width: '90px' }}>
                          <span className="currency-symbol" style={{ fontSize: '0.72rem' }}>
                            {selectedCategory === 'savings' && savingsAllocMode === 'percentSurplus' ? '%' : '$'}
                          </span>
                          <NumberInput
                            className="input-number-box"
                            style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
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
                    
                    {/* Subtitles: Lock Reason or Change indicator */}
                    {row.isLocked && row.lockedReason && (
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                        {row.lockedReason} (Click to edit event)
                      </span>
                    )}

                    {selectedBudgetAge > inputs.currentAge && row.changeFromToday !== 0 && (
                      <span style={{ 
                        fontSize: '0.65rem', 
                        color: row.changeFromToday > 0 
                          ? (selectedCategory === 'savings' ? 'var(--accent-emerald)' : 'var(--accent-rose, #ef4444)')
                          : (selectedCategory === 'savings' ? 'var(--accent-rose, #ef4444)' : 'var(--accent-emerald)'),
                        fontWeight: '600'
                      }}>
                        {row.changeFromToday > 0 ? `+${formatCurrency(row.changeFromToday)}` : `${formatCurrency(row.changeFromToday)}`} from Today
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Clear category button */}
            {!isRetirementPhase && (
              <button
                type="button"
                className="breakdown-clear-btn"
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => {
                  if (selectedCategory === 'needs') handleClearNeeds();
                  else if (selectedCategory === 'wants') handleClearWants();
                  else if (selectedCategory === 'savings') handleClearSavings();
                }}
              >
                Clear Category Allocations
              </button>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
