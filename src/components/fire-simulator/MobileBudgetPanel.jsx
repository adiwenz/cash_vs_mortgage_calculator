import { useState } from 'react';
import { formatCurrency } from './helpers';

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
  budgetExpenses,
  setBudgetExpenses,
  budgetSavings,
  setBudgetSavings,
  budgetPartnerSavings,
  setBudgetPartnerSavings,
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
  handleClearSavings
}) {
  const [expandedSection, setExpandedSection] = useState('needs'); // 'needs', 'wants', or 'savings'

  return (
    <div className="mobile-budget-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--text-primary)', padding: '1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
            🎯 {modalTitle} {activePhaseObj && `(Age ${activePhaseObj.startAge}–${activePhaseObj.endAge})`}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Tap a section below to expand & edit.
          </span>
        </div>
        <button 
          type="button" 
          onClick={handleCloseBudgetModal}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: '0.5rem' }}
        >
          ✖
        </button>
      </div>

      {/* Swipeable Tabs for Budget Phases */}
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
        {normalizedPhases.map((p) => {
          const isActive = p.id === activeBudgetPhase;
          const icons = p.activeEvents && p.activeEvents.slice(0, 3).map(evId => getEventDetails(evId).icon) || [];
          const themeClass = getBudgetPhaseThemeClass(p);
          return (
            <button
              key={p.id}
              type="button"
              className={`budget-modal-tab ${themeClass} ${isActive ? 'active' : ''}`}
              style={{
                flex: '0 0 auto',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: isActive ? '2px solid var(--accent-violet)' : '1px solid var(--border-color)'
              }}
              onClick={() => handleSwitchBudgetPhase(p.id)}
            >
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>Age {p.startAge}–{p.endAge}</div>
              <div style={{ fontWeight: '600' }}>{icons.join('')} {p.label}</div>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingBottom: '2rem' }}>
        
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
            <span style={{ color: '#c084fc', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>
              💡 Applying: {pendingImprovement.scenario.title}
            </span>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Detailed allocations updated. Please review below and tap <strong>Save Budget</strong>.
            </p>
          </div>
        )}

        {/* Phase Summary card */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block' }}>Monthly Net Salary</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{formatCurrency(takeHomeIncome)}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block' }}>Remaining Balance</span>
              <strong style={{ fontSize: '1.2rem', color: remainingBalance < 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                {formatCurrency(remainingBalance)}
              </strong>
            </div>
          </div>
          <div style={{ display: 'flex', height: '0.5rem', borderRadius: '4px', overflow: 'hidden', background: '#334155', marginTop: '0.25rem' }}>
            <div style={{ width: `${takeHomeIncome > 0 ? (needsTotal / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-emerald)' }} />
            <div style={{ width: `${takeHomeIncome > 0 ? (wantsTotal / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-amber)' }} />
            <div style={{ width: `${takeHomeIncome > 0 ? (activeSavings / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-violet)' }} />
          </div>
        </div>

        {/* Accordion 1: Needs */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.01)', overflow: 'hidden' }}>
          <button 
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'needs' ? null : 'needs')}
            style={{ 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '0.85rem 1rem', 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-primary)',
              cursor: 'pointer' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🏠</span>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Needs</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({formatCurrency(needsTotal)}/mo)</span>
            </div>
            <span>{expandedSection === 'needs' ? '▼' : '▶'}</span>
          </button>

          {expandedSection === 'needs' && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {(() => {
                  const needsItems = [
                    { key: 'housing', label: 'Housing (Rent/Mortgage)' },
                    { key: 'utilities', label: 'Utilities & Subs' },
                    { key: 'food', label: 'Food (Groceries)' },
                    { key: 'transportation', label: 'Transportation / Gas' },
                    { key: 'healthcare', label: 'Healthcare & Ins' }
                  ];
                  if (isMarriedMode) {
                    needsItems.push({ key: 'debt', label: 'Debt Payments' });
                  }
                  if (activeC > 0 || (budgetExpenses.childcare && budgetExpenses.childcare > 0)) {
                    needsItems.push({ key: 'childcare', label: 'Childcare' });
                  }
                  return needsItems;
                })().map(item => {
                  const isChildcare = item.key === 'childcare';
                  return (
                    <div 
                      key={item.key} 
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}
                    >
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {isChildcare ? '👶 ' : ''}{item.label} {isChildcare && '🔒'}
                      </span>
                      {isEditingNeeds && !isChildcare ? (
                        <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                          <span className="currency-symbol">$</span>
                          <input
                            type="number"
                            className="input-number-box"
                            style={{ width: '100%', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                            value={budgetExpenses[item.key] || 0}
                            onChange={(e) => setBudgetExpenses({
                              ...budgetExpenses,
                              [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                            })}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.85rem', fontWeight: '500', color: isChildcare ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                          {formatCurrency(budgetExpenses[item.key] || 0)}
                        </span>
                      )}
                    </div>
                  );
                })}

                {activeDebts.map(debt => (
                  <div key={debt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{debt.icon} {debt.name}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      {formatCurrency(budgetExpenses[`debt_${debt.id}`] || debt.monthlyPayment)}
                    </span>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem' }}
                    onClick={() => setIsEditingNeeds(!isEditingNeeds)}
                  >
                    {isEditingNeeds ? 'Done ✓' : 'Edit Section'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem', color: 'var(--accent-rose, #f43f5e)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    onClick={handleClearNeeds}
                  >
                    Clear 🗑️
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: Wants */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.01)', overflow: 'hidden' }}>
          <button 
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'wants' ? null : 'wants')}
            style={{ 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '0.85rem 1rem', 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-primary)',
              cursor: 'pointer' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🎉</span>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Wants</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({formatCurrency(wantsTotal)}/mo)</span>
            </div>
            <span>{expandedSection === 'wants' ? '▼' : '▶'}</span>
          </button>

          {expandedSection === 'wants' && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  { key: 'leisure', label: 'Leisure & Travel' },
                  { key: 'diningOut', label: 'Dining Out' },
                  { key: 'misc', label: 'Miscellaneous' }
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                    {isEditingWants ? (
                      <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                        <span className="currency-symbol">$</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          value={budgetExpenses[item.key] || 0}
                          onChange={(e) => setBudgetExpenses({
                            ...budgetExpenses,
                            [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                          })}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                        {formatCurrency(budgetExpenses[item.key] || 0)}
                      </span>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem' }}
                    onClick={() => setIsEditingWants(!isEditingWants)}
                  >
                    {isEditingWants ? 'Done ✓' : 'Edit Section'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem', color: 'var(--accent-rose, #f43f5e)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    onClick={handleClearWants}
                  >
                    Clear 🗑️
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: Save & Invest */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.01)', overflow: 'hidden' }}>
          <button 
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'savings' ? null : 'savings')}
            style={{ 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '0.85rem 1rem', 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-primary)',
              cursor: 'pointer' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>💰</span>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Save & Invest</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo)</span>
            </div>
            <span>{expandedSection === 'savings' ? '▼' : '▶'}</span>
          </button>

          {expandedSection === 'savings' && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {isRetirementPhase ? (
                  <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                    🏖️ Savings are disabled during retirement. You are now drawing down from your portfolio.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {isMarriedMode ? '👤 Your Savings' : 'Monthly Savings'}
                      </span>
                    </div>

                    {(isMarriedMode ? [
                      { key: 'trad401k', label: '401(k) (Pre-Tax)' },
                      { key: 'rothIra', label: 'Roth IRA' },
                      { key: 'tradIra', label: 'Traditional IRA' },
                      { key: 'hsa', label: 'HSA' },
                      { key: 'brokerage', label: 'Taxable Brokerage' },
                      { key: 'checking', label: 'Checking Account' },
                      { key: 'hysa', label: 'High-Yield Savings' },
                      { key: 'emergency', label: 'Emergency Fund' },
                      { key: 'cash', label: 'Cash Savings' },
                      { key: 'debt', label: 'Debt Paydown' },
                      { key: 'other', label: 'Other Savings' }
                    ] : [
                      { key: 'trad401k', label: '401(k) (Pre-Tax)' },
                      { key: 'rothIra', label: 'Roth IRA' },
                      { key: 'tradIra', label: 'Traditional IRA' },
                      { key: 'hsa', label: 'HSA' },
                      { key: 'brokerage', label: 'Taxable Brokerage' },
                      { key: 'checking', label: 'Checking Account' },
                      { key: 'hysa', label: 'High-Yield Savings' },
                      { key: 'emergency', label: 'Emergency Fund' },
                      { key: 'debt', label: 'Debt Payoff' },
                      { key: 'other', label: 'Other Savings' }
                    ]).map(item => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                        {isEditingSavings ? (
                          <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                            <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                            <input
                              type="number"
                              className="input-number-box"
                              style={{ width: '100%', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                              value={budgetSavings[item.key] || 0}
                              onChange={(e) => setBudgetSavings({
                                ...budgetSavings,
                                [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                              })}
                            />
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                            {savingsAllocMode === 'percentSurplus' 
                              ? `${budgetSavings[item.key] || 0}%` 
                              : formatCurrency(budgetSavings[item.key] || 0)}
                          </span>
                        )}
                      </div>
                    ))}

                    {isMarriedMode && (
                      <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                          👥 Partner Savings
                        </span>
                        
                        {[
                          { key: 'trad401k', label: 'Partner 401(k)' },
                          { key: 'rothIra', label: 'Partner Roth IRA' },
                          { key: 'tradIra', label: 'Partner Trad IRA' },
                          { key: 'hsa', label: 'Partner HSA' },
                          { key: 'brokerage', label: 'Partner Brokerage' },
                          { key: 'checking', label: 'Partner Checking' },
                          { key: 'hysa', label: 'Partner HYSA' },
                          { key: 'emergency', label: 'Partner Emergency' },
                          { key: 'cash', label: 'Partner Cash' },
                          { key: 'debt', label: 'Partner Debt' },
                          { key: 'other', label: 'Partner Other' }
                        ].map(item => (
                          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                            {isEditingSavings ? (
                              <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                                <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                                <input
                                  type="number"
                                  className="input-number-box"
                                  style={{ width: '100%', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                                  value={budgetPartnerSavings[item.key] || 0}
                                  onChange={(e) => setBudgetPartnerSavings({
                                    ...budgetPartnerSavings,
                                    [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                  })}
                                />
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                                {savingsAllocMode === 'percentSurplus' 
                                  ? `${budgetPartnerSavings[item.key] || 0}%` 
                                  : formatCurrency(budgetPartnerSavings[item.key] || 0)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem' }}
                        onClick={() => setIsEditingSavings(!isEditingSavings)}
                      >
                        {isEditingSavings ? 'Done ✓' : 'Edit Section'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem', color: 'var(--accent-rose, #f43f5e)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        onClick={handleClearSavings}
                      >
                        Clear 🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

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

    </div>
  );
}
