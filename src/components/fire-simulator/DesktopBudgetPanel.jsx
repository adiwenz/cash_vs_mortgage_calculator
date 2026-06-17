import { formatCurrency } from './helpers';
import { getRetirementLimit } from '../../simulatorMathUtils';

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
  showBreakdown,
  setShowBreakdown,
  activeBreakdownTab,
  setActiveBreakdownTab,
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
  handleClearSavings
}) {
  return (
    <div className="budget-modal-layout">
      {/* Left/Main Column */}
      <div className="budget-main-col">
        {/* Header */}
        <div className="budget-modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                margin: 0, 
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                verticalAlign: 'middle'
              }}>
                <span>🎯 {modalTitle} {activePhaseObj && `(Age ${activePhaseObj.startAge}–${activePhaseObj.endAge})`}</span>
                {activePhaseObj && (
                  <div 
                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                  >
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPopover(!showPopover);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '1.2rem',
                        height: '1.2rem',
                        borderRadius: '50%',
                        transition: 'all 0.2s',
                      }}
                      className="phase-info-icon-btn"
                      aria-label="Phase Info"
                    >
                      ⓘ
                    </button>
                    
                    {(showPopover || isHovering) && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                          marginTop: '0.5rem',
                          zIndex: 100,
                          width: '280px',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '0.85rem 1rem',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          textAlign: 'left',
                          lineHeight: '1.4',
                          fontWeight: 'normal'
                        }}
                        className="phase-info-popover"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ fontWeight: '600', fontSize: '0.88rem', marginBottom: '0.6rem', color: '#60a5fa' }}>
                          Why this phase exists
                        </div>
                        
                        <div style={{ marginBottom: '0.6rem' }}>
                          <div style={{ fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Active Events:</div>
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                            {getPopoverDetails().activeEvents.map((evt, idx) => (
                              <li key={idx} style={{ marginBottom: '0.15rem' }}>{evt}</li>
                            ))}
                          </ul>
                        </div>

                        {getPopoverDetails().phaseChanges.length > 0 && (
                          <div>
                            <div style={{ fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Phase Changes:</div>
                            <ul style={{ margin: 0, paddingLeft: '1.1rem', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                              {getPopoverDetails().phaseChanges.map((chg, idx) => (
                                <li key={idx} style={{ marginBottom: '0.15rem' }}>{chg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Set your monthly plan for this phase.
              </span>
            </div>
            <button 
              type="button" 
              onClick={handleCloseBudgetModal}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem' }}
            >
              ✖
            </button>
          </div>
        </div>

        {/* Tabs for Budget Phases */}
        <div className="budget-modal-tabs">
          {normalizedPhases.map((p) => {
            const isActive = p.id === activeBudgetPhase;
            const icons = p.activeEvents && p.activeEvents.slice(0, 3).map(evId => getEventDetails(evId).icon) || [];
            const themeClass = getBudgetPhaseThemeClass(p);
            return (
              <button
                key={p.id}
                type="button"
                className={`budget-modal-tab ${themeClass} ${isActive ? 'active' : ''}`}
                onClick={() => handleSwitchBudgetPhase(p.id)}
              >
                <span className="budget-modal-tab-age">Age {p.startAge}–{p.endAge}</span>
                <span className="budget-modal-tab-label">{icons.join('')} {p.label}</span>
              </button>
            );
          })}
        </div>

        <div className="budget-main-scroll-body">
          {pendingImprovement && (
            <div style={{
              background: 'rgba(124, 58, 237, 0.08)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ color: '#c084fc', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                💡 Applying Recommendation: {pendingImprovement.scenario.title}
              </span>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                This scenario changes your monthly budget targets (recommended adjustment: <strong>{pendingImprovement.scenario.savingsFocus}</strong>). 
                We have updated the gross salary and target savings, but your detailed allocations need to be aligned. Please review and adjust the categories below, then click <strong>Save Budget</strong> to apply the scenario.
              </p>
            </div>
          )}

          {/* Primary Section: Three Budget Cards */}
          <div className="budget-cards-grid">
            {/* Needs Card */}
            <div 
              className={`budget-card needs ${showBreakdown && activeBreakdownTab === 'needs' ? 'active' : ''}`}
              onClick={() => {
                if (showBreakdown && activeBreakdownTab === 'needs') {
                  setShowBreakdown(false);
                } else {
                  setShowBreakdown(true);
                  setActiveBreakdownTab('needs');
                }
              }}
            >
              <div className="budget-card-icon-circle">🏠</div>
              <div className="budget-card-title">Needs</div>
              <div className="budget-card-amount">{formatCurrency(needsTotal)}/mo</div>
              <div className="budget-card-pct">{takeHomeIncome > 0 ? Math.round((needsTotal / takeHomeIncome) * 100) : 0}%</div>
              <div className="budget-card-progress">
                <div 
                  className="budget-card-progress-fill" 
                  style={{ width: `${Math.min(100, takeHomeIncome > 0 ? Math.round((needsTotal / takeHomeIncome) * 100) : 0)}%` }}
                />
              </div>
            </div>

            {/* Wants Card */}
            <div 
              className={`budget-card wants ${showBreakdown && activeBreakdownTab === 'wants' ? 'active' : ''}`}
              onClick={() => {
                if (showBreakdown && activeBreakdownTab === 'wants') {
                  setShowBreakdown(false);
                } else {
                  setShowBreakdown(true);
                  setActiveBreakdownTab('wants');
                }
              }}
            >
              <div className="budget-card-icon-circle">🎉</div>
              <div className="budget-card-title">Wants</div>
              <div className="budget-card-amount">{formatCurrency(wantsTotal)}/mo</div>
              <div className="budget-card-pct">{takeHomeIncome > 0 ? Math.round((wantsTotal / takeHomeIncome) * 100) : 0}%</div>
              <div className="budget-card-progress">
                <div 
                  className="budget-card-progress-fill" 
                  style={{ width: `${Math.min(100, takeHomeIncome > 0 ? Math.round((wantsTotal / takeHomeIncome) * 100) : 0)}%` }}
                />
              </div>
            </div>

            {/* Save & Invest Card */}
            <div 
              className={`budget-card save ${showBreakdown && activeBreakdownTab === 'savings' ? 'active' : ''}`}
              onClick={() => {
                if (showBreakdown && activeBreakdownTab === 'savings') {
                  setShowBreakdown(false);
                } else {
                  setShowBreakdown(true);
                  setActiveBreakdownTab('savings');
                }
              }}
            >
              <div className="budget-card-icon-circle">💰</div>
              <div className="budget-card-title">Save & Invest</div>
              <div className="budget-card-amount">{isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo</div>
              <div className="budget-card-pct">{takeHomeIncome > 0 ? Math.round((activeSavings / takeHomeIncome) * 100) : 0}%</div>
              <div className="budget-card-progress">
                <div 
                  className="budget-card-progress-fill" 
                  style={{ width: `${Math.min(100, takeHomeIncome > 0 ? Math.round((activeSavings / takeHomeIncome) * 100) : 0)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Income & Allocation Progress Panel */}
          <div className="budget-summary-section" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Salary (Net)</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatCurrency(takeHomeIncome)}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block', marginTop: '0.15rem' }}>
                  Gross: {formatCurrency(combinedIncome)}/mo
                  {inputs.includeTaxes && ` (Taxes: -${formatCurrency(monthlyTax)})`}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Allocated</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatCurrency(totalAllocated)}</span>
                <span style={{ fontSize: '0.72rem', color: totalAllocated > takeHomeIncome ? 'var(--accent-red)' : 'var(--text-tertiary)', display: 'block', marginTop: '0.15rem' }}>
                  {totalAllocated > takeHomeIncome 
                    ? `Overallocated by ${formatCurrency(totalAllocated - takeHomeIncome)}`
                    : `Remaining: ${formatCurrency(remainingBalance)}`}
                </span>
              </div>
              <div style={{ minWidth: '180px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Allocation Breakdown</span>
                <div style={{ display: 'flex', height: '0.65rem', borderRadius: '9999px', overflow: 'hidden', background: '#334155' }}>
                  <div style={{ width: `${takeHomeIncome > 0 ? (needsTotal / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-emerald)', transition: 'width 0.3s' }} title={`Needs: ${Math.round((needsTotal/takeHomeIncome)*100)}%`} />
                  <div style={{ width: `${takeHomeIncome > 0 ? (wantsTotal / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-amber)', transition: 'width 0.3s' }} title={`Wants: ${Math.round((wantsTotal/takeHomeIncome)*100)}%`} />
                  <div style={{ width: `${takeHomeIncome > 0 ? (activeSavings / takeHomeIncome) * 100 : 0}%`, background: 'var(--accent-violet)', transition: 'width 0.3s' }} title={`Savings: ${Math.round((activeSavings/takeHomeIncome)*100)}%`} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }} /> Needs
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-amber)' }} /> Wants
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-violet)' }} /> Savings
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Mode Options */}
          {!isRetirementPhase && (
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block' }}>Savings Allocation Strategy</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {savingsAllocMode === 'percentSurplus' 
                    ? 'Savings targets are percentage allocations of remaining monthly surplus.'
                    : 'Savings targets are set to exact monthly dollar amounts.'}
                </span>
              </div>
              <button
                type="button"
                className="btn-strategy-switch"
                style={{ 
                  fontSize: '0.75rem', 
                  padding: '0.35rem 0.85rem',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
                onClick={handleToggleSavingsAllocMode}
              >
                Switch to {savingsAllocMode === 'percentSurplus' ? 'Fixed Dollar Amounts' : 'Percentage of Surplus'}
              </button>
            </div>
          )}

          {/* Status Banner */}
          <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
            {Math.abs(remainingBalance) <= 1 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                ✅ You’re on track. You’re saving {activeSavingsRate}% of your income.
              </div>
            ) : remainingBalance < 0 ? (
              activeDebts.length > 0 && !decideLater ? (
                <div className="deficit-warning-box" style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div>
                    <div style={{ color: 'var(--accent-rose, #f43f5e)', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.15rem' }}>
                      New obligation added.
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      This plan is currently running a monthly deficit of <strong>{formatCurrency(Math.abs(remainingBalance))}</strong>.
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="list-builder-edit-btn"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--primary)', color: 'var(--primary-light, #a5b4fc)' }}
                      onClick={handleReduceWants}
                    >
                      📉 Reduce Wants
                    </button>
                    <button
                      type="button"
                      className="list-builder-edit-btn"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--primary)', color: 'var(--primary-light, #a5b4fc)' }}
                      onClick={handleAutoReduceSavingsToBalance}
                    >
                      ⚖️ Reduce Savings
                    </button>
                    <button
                      type="button"
                      className="list-builder-edit-btn"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--primary)', color: 'var(--primary-light, #a5b4fc)' }}
                      onClick={handleIncreaseIncome}
                    >
                      💰 Increase Income
                    </button>
                    <button
                      type="button"
                      className="list-builder-edit-btn"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                      onClick={() => setDecideLater(true)}
                    >
                      ⏳ I’ll Decide Later
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span>⚠️ Over budget by {formatCurrency(Math.abs(remainingBalance))}/mo.</span>
                  <button 
                    type="button"
                    className="list-builder-edit-btn" 
                    style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem', borderColor: 'var(--accent-rose)', color: '#fda4af' }}
                    onClick={handleAutoReduceSavingsToBalance}
                  >
                    ⚖️ Auto-Reduce Savings
                  </button>
                </div>
              )
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>💡 {formatCurrency(remainingBalance)}/mo remains unallocated.</span>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button 
                    type="button" 
                    className="list-builder-edit-btn" 
                    style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                    onClick={() => handleAllocateRemaining('hysa')}
                  >
                    📥 Put in HYSA
                  </button>
                  <button 
                    type="button" 
                    className="list-builder-edit-btn" 
                    style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                    onClick={() => handleAllocateRemaining('brokerage')}
                  >
                    📥 Put in Brokerage
                  </button>
                </div>
              </div>
            )}
          </div>

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                    ⚠️ {w}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Footer Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
            onClick={handleCloseBudgetModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
            onClick={() => handleSaveBudget(defaultTemplate)}
          >
            Save Budget
          </button>
        </div>
      </div>

      {/* Right Column: Breakdown Sidebar */}
      <div className={`budget-breakdown-sidebar ${showBreakdown ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Breakdown</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>See what's included in each category.</span>
          </div>
          <button 
            type="button" 
            onClick={() => setShowBreakdown(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}
          >
            ✖
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, maxHeight: 'calc(85vh - 7rem)', overflowY: 'auto', paddingRight: '0.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Needs Breakdown */}
          {(!activeBreakdownTab || activeBreakdownTab === 'needs') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>🏠 Needs</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatCurrency(needsTotal)}/mo</strong>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                {(() => {
                  const needsItems = [
                    { key: 'housing', label: 'Housing (Rent/Mortgage)' },
                    { key: 'utilities', label: 'Utilities & Subscriptions' },
                    { key: 'food', label: 'Food (Groceries)' },
                    { key: 'transportation', label: 'Transportation / Gas / Car' },
                    { key: 'healthcare', label: 'Healthcare & Insurance' }
                  ];
                  if (isMarriedMode) {
                    needsItems.push({ key: 'debt', label: 'Debt Payments' });
                  }
                  if (activeC > 0 || (budgetExpenses.childcare && budgetExpenses.childcare > 0)) {
                    needsItems.push({ key: 'childcare', label: 'Childcare' });
                  }
                  if (budgetExpenses['🏠 Mortgage'] > 0 || budgetExpenses['mortgage'] > 0) {
                    needsItems.push({ key: '🏠 Mortgage', label: 'Mortgage' });
                  }
                  return needsItems;
                })().map(item => {
                  const isSpecialLocked = item.key === 'childcare' || item.key === '🏠 Mortgage';
                  const icon = item.key === 'childcare' ? '👶 ' : (item.key === '🏠 Mortgage' ? '🏠 ' : '');
                  return (
                    <div 
                      key={item.key} 
                      className={`breakdown-row budget-input-row ${isSpecialLocked ? 'childcare-locked-glow' : ''}`}
                    >
                      <span className="breakdown-row-label">
                        {icon}{item.label} {isSpecialLocked && <span style={{ fontSize: '0.72rem', opacity: 0.8, marginLeft: '0.2rem' }}>🔒</span>}
                      </span>
                      {isEditingNeeds && !isSpecialLocked ? (
                        <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                          <span className="currency-symbol">$</span>
                          <input
                            type="number"
                            className="input-number-box"
                            style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                            value={budgetExpenses[item.key] || 0}
                            onChange={(e) => setBudgetExpenses({
                              ...budgetExpenses,
                              [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                            })}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="breakdown-row-dots" />
                          <span className="breakdown-row-value" style={isSpecialLocked ? { color: 'var(--accent-amber)' } : undefined}>
                            {formatCurrency(budgetExpenses[item.key] || (item.key === '🏠 Mortgage' && budgetExpenses['mortgage']) || 0)}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}

                {activeDebts.filter(debt => debt.type !== 'mortgage').map(debt => (
                  <div key={debt.id} className="breakdown-row budget-input-row">
                    <span className="breakdown-row-label">{debt.icon} {debt.name}</span>
                    <div className="breakdown-row-dots" />
                    <span className="breakdown-row-value">{formatCurrency(budgetExpenses[`debt_${debt.id}`] || debt.monthlyPayment)}</span>
                  </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="breakdown-edit-link"
                    style={{ color: 'var(--accent-rose, #f43f5e)', marginTop: 0 }}
                    onClick={handleClearNeeds}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="breakdown-edit-link"
                    style={{ marginTop: 0 }}
                    onClick={() => setIsEditingNeeds(!isEditingNeeds)}
                  >
                    {isEditingNeeds ? 'Done Editing ✓' : 'Edit Needs →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Wants Breakdown */}
          {(!activeBreakdownTab || activeBreakdownTab === 'wants') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 'bold' }}>🎉 Wants</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatCurrency(wantsTotal)}/mo</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                {[
                  { key: 'leisure', label: 'Leisure & Leisure Travel' },
                  { key: 'diningOut', label: 'Dining Out' },
                  { key: 'misc', label: 'Miscellaneous Expenses' }
                ].map(item => (
                  <div key={item.key} className="breakdown-row budget-input-row">
                    <span className="breakdown-row-label">{item.label}</span>
                    {isEditingWants ? (
                      <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                        <span className="currency-symbol">$</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                          value={budgetExpenses[item.key] || 0}
                          onChange={(e) => setBudgetExpenses({
                            ...budgetExpenses,
                            [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                          })}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="breakdown-row-dots" />
                        <span className="breakdown-row-value">{formatCurrency(budgetExpenses[item.key] || 0)}</span>
                      </>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="breakdown-edit-link"
                    style={{ color: 'var(--accent-rose, #f43f5e)', marginTop: 0 }}
                    onClick={handleClearWants}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="breakdown-edit-link"
                    style={{ marginTop: 0 }}
                    onClick={() => setIsEditingWants(!isEditingWants)}
                  >
                    {isEditingWants ? 'Done Editing ✓' : 'Edit Wants →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save & Invest Breakdown */}
          {(!activeBreakdownTab || activeBreakdownTab === 'savings') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#c084fc', fontWeight: 'bold' }}>💰 Save & Invest</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo
                </strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                {isRetirementPhase ? (
                  <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                    🏖️ Savings are disabled during retirement. You are now drawing down from your portfolio to fund your living expenses.
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', margin: '0.25rem 0 0.15rem 0' }}>
                      {isMarriedMode ? '👤 Your Savings' : 'Monthly Savings'}
                    </span>
                    
                    {(isMarriedMode ? [
                      { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                      { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr' },
                      { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr' },
                      { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                      { key: 'brokerage', label: 'Taxable Brokerage' },
                      { key: 'checking', label: 'Checking Account' },
                      { key: 'hysa', label: 'High-Yield Savings' },
                      { key: 'emergency', label: 'Emergency Fund' },
                      { key: 'cash', label: 'Cash Savings' },
                      { key: 'debt', label: 'Debt Paydown' },
                      { key: 'other', label: 'Other Savings' }
                    ] : [
                      { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                      { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr combined' },
                      { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr combined' },
                      { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                      { key: 'brokerage', label: 'Taxable Brokerage' },
                      { key: 'checking', label: 'Checking Account' },
                      { key: 'hysa', label: 'High-Yield Savings' },
                      { key: 'emergency', label: 'Emergency Fund' },
                      { key: 'debt', label: 'Debt Payoff' },
                      { key: 'other', label: 'Other Savings' }
                    ]).map(item => (
                      <div key={item.key} className="breakdown-row budget-input-row" style={{ minHeight: '22px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="breakdown-row-label">{item.label}</span>
                          {item.desc && !isEditingSavings && (
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '-0.15rem' }}>
                              {item.desc}
                            </span>
                          )}
                        </div>
                        {isEditingSavings ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                            <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                              <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                value={budgetSavings[item.key] || 0}
                                onChange={(e) => handleSavingsChange(
                                  item.key,
                                  Math.max(0, parseFloat(e.target.value) || 0),
                                  false
                                )}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="breakdown-row-dots" />
                            <span className="breakdown-row-value">
                              {savingsAllocMode === 'percentSurplus' 
                                ? `${budgetSavings[item.key] || 0}%` 
                                : formatCurrency(budgetSavings[item.key] || 0)}
                            </span>
                          </>
                        )}
                      </div>
                    ))}

                    {isMarriedMode && (
                      <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                          👥 Partner Savings
                        </span>
                        
                        {[
                          { key: 'trad401k', label: 'Partner 401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                          { key: 'rothIra', label: 'Partner Roth IRA', desc: 'Limit $7,000/yr' },
                          { key: 'tradIra', label: 'Partner Traditional IRA', desc: 'Limit $7,000/yr' },
                          { key: 'hsa', label: 'Partner HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                          { key: 'brokerage', label: 'Partner Brokerage' },
                          { key: 'checking', label: 'Partner Checking Account' },
                          { key: 'hysa', label: 'Partner High-Yield Savings' },
                          { key: 'emergency', label: 'Partner Emergency Fund' },
                          { key: 'cash', label: 'Partner Cash Savings' },
                          { key: 'debt', label: 'Partner Other Debt' },
                          { key: 'other', label: 'Partner Other Savings' }
                        ].map(item => (
                          <div 
                            key={item.key} 
                            className="budget-input-row"
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              gap: '0.5rem',
                              padding: '0.4rem 0.5rem'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="breakdown-row-label">{item.label}</span>
                              {item.desc && !isEditingSavings && (
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '-0.15rem' }}>
                                  {item.desc}
                                </span>
                              )}
                            </div>
                            {isEditingSavings ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                                <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                                  <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                                  <input
                                    type="number"
                                    className="input-number-box"
                                    style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                    value={budgetPartnerSavings[item.key] || 0}
                                    onChange={(e) => handleSavingsChange(
                                      item.key,
                                      Math.max(0, parseFloat(e.target.value) || 0),
                                      true
                                    )}
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="breakdown-row-dots" />
                                <span className="breakdown-row-value">
                                  {savingsAllocMode === 'percentSurplus' 
                                    ? `${budgetPartnerSavings[item.key] || 0}%` 
                                    : formatCurrency(budgetPartnerSavings[item.key] || 0)}
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="breakdown-edit-link"
                        style={{ color: 'var(--accent-rose, #f43f5e)', marginTop: 0 }}
                        onClick={handleClearSavings}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="breakdown-edit-link"
                        style={{ marginTop: 0 }}
                        onClick={() => setIsEditingSavings(!isEditingSavings)}
                      >
                        {isEditingSavings ? 'Done Editing ✓' : 'Edit Savings →'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
