import TodayScreen from './TodayScreen';
import LifePlanScreen from './LifePlanScreen';
import EventModalForm from './EventModalForm';
import ChildImpactModal from './ChildImpactModal';
import BudgetModal from './BudgetModal';
import SavingsDetailsModal from './SavingsDetailsModal';
import { CurrentConditionModal } from './CurrentConditionsPanel';

const getPaceBadgeStyles = (pace) => {
  if (pace === 'Aggressive') {
    return {
      background: 'rgba(16, 185, 129, 0.1)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.2)'
    };
  }
  if (pace === 'Moderate') {
    return {
      background: 'rgba(245, 158, 11, 0.1)',
      color: '#f59e0b',
      border: '1px solid rgba(245, 158, 11, 0.2)'
    };
  }
  return {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  };
};

export default function DesktopFireSimulatorView({
  activeStep,
  setActiveStep,
  inputs,
  handleStep1Change,
  handleSetBudgetClick,
  handleOpenSavingsDetails,
  lastNonZeroSavingsRateRef,
  todayAssets,
  todayDebt,
  todayNetWorth,
  displayedResults,
  updateInput,
  displayMode,
  setDisplayMode,
  activeResults,
  selectedYear,
  setSelectedYear,
  chartData,
  validation,
  handleCreateEvent,
  handleEditRoadmapEvent,
  handleApplyImprovementScenario,
  improvementPlan,
  showImprovementModal,
  setShowImprovementModal,
  handleRemoveCurrentCondition,
  setEditingCondition,
  isMobile,
  totalNetWorth,
  handleNodeDragStart,
  draggingInfo,
  timelineEvents,
  editingEvent,
  setEditingEvent,
  dragOccurredRef,
  isFullPartnerProfileOpen,
  setIsFullPartnerProfileOpen,
  isZeroSpendingConfirmed,
  setIsZeroSpendingConfirmed,
  isPartnerZeroSpendingConfirmed,
  setIsPartnerZeroSpendingConfirmed,
  handleDeleteEvent,
  handleSaveEvent,
  setIsBudgetOpenFromMarriageWizard,
  isBudgetOpenFromMarriageWizard,
  tempSocialSecurityDetails,
  childImpactSummary,
  setChildImpactSummary,
  isBudgetModalOpen,
  handleCloseBudgetModal,
  budgetMonthlyIncome,
  setBudgetMonthlyIncome,
  budgetExpenses,
  setBudgetExpenses,
  budgetSavings,
  setBudgetSavings,
  budgetPartnerSavings,
  setBudgetPartnerSavings,
  activeBudgetPhase,
  handleSwitchBudgetPhase,
  savingsAllocMode,
  handleToggleSavingsAllocMode,
  budgetHsaCoverage,
  setBudgetHsaCoverage,
  budgetFilingStatus,
  setBudgetFilingStatus,
  budgetMonthlySpending,
  setBudgetMonthlySpending,
  budgetMonthlySavings,
  setBudgetMonthlySavings,
  pendingImprovement,
  handleSaveBudget,
  isSavingsDetailsOpen,
  savingsDetails,
  setSavingsDetails,
  setIsSavingsDetailsOpen,
  handleSaveSavingsDetails,
  editingCondition,
  handleSaveCurrentCondition,
  notification,
  displayedBaselineResults,
  baselineResults
}) {
  return (
    <div className="fire-simulator-container" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      
      {/* Wizard Steps Navigation Header */}
      <div className="wizard-steps-container">
        <div 
          className={`wizard-step-node ${activeStep === 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}
          onClick={() => setActiveStep(1)}
        >
          <div className="wizard-step-icon">1</div>
          <span className="wizard-step-label">Today</span>
        </div>
        <div className={`wizard-step-divider ${activeStep >= 2 ? 'active' : ''}`} />
        <div 
          className={`wizard-step-node ${activeStep === 2 ? 'active' : ''}`}
          onClick={() => {
            setActiveStep(2);
          }}
        >
          <div className="wizard-step-icon">2</div>
          <span className="wizard-step-label">Life Plan</span>
        </div>
      </div>

      {/* Screen 1: Your Life Today */}
      {activeStep === 1 && (
        <TodayScreen
          inputs={inputs}
          handleStep1Change={handleStep1Change}
          handleSetBudgetClick={handleSetBudgetClick}
          handleOpenSavingsDetails={handleOpenSavingsDetails}
          lastNonZeroSavingsRateRef={lastNonZeroSavingsRateRef}
          todayAssets={todayAssets}
          todayDebt={todayDebt}
          todayNetWorth={todayNetWorth}
          setActiveStep={setActiveStep}
          displayedResults={displayedResults}
        />
      )}

      {/* Screen 2: Life Plan */}
      {activeStep === 2 && (
        <LifePlanScreen
          inputs={inputs}
          updateInput={updateInput}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          activeResults={activeResults}
          displayedResults={displayedResults}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          chartData={chartData}
          validation={validation}
          handleCreateEvent={handleCreateEvent}
          handleEditRoadmapEvent={handleEditRoadmapEvent}
          handleApplyImprovementScenario={handleApplyImprovementScenario}
          improvementPlan={improvementPlan}
          showImprovementModal={showImprovementModal}
          setShowImprovementModal={setShowImprovementModal}
          handleSetBudgetClick={handleSetBudgetClick}
          handleRemoveCurrentCondition={handleRemoveCurrentCondition}
          setEditingCondition={setEditingCondition}
          isMobile={isMobile}
          totalNetWorth={totalNetWorth}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
          handleNodeDragStart={handleNodeDragStart}
          draggingInfo={draggingInfo}
          timelineEvents={timelineEvents}
          editingEvent={editingEvent}
          dragOccurredRef={dragOccurredRef}
          displayedBaselineResults={displayedBaselineResults}
          baselineResults={baselineResults}
        />
      )}

      {/* Overlays / Modals */}
      {editingEvent && (
        <EventModalForm
          inputs={inputs}
          editingEvent={editingEvent}
          setEditingEvent={setEditingEvent}
          isFullPartnerProfileOpen={isFullPartnerProfileOpen}
          setIsFullPartnerProfileOpen={setIsFullPartnerProfileOpen}
          isZeroSpendingConfirmed={isZeroSpendingConfirmed}
          setIsZeroSpendingConfirmed={setIsZeroSpendingConfirmed}
          isPartnerZeroSpendingConfirmed={isPartnerZeroSpendingConfirmed}
          setIsPartnerZeroSpendingConfirmed={setIsPartnerZeroSpendingConfirmed}
          handleDeleteEvent={handleDeleteEvent}
          handleSaveEvent={handleSaveEvent}
          handleSetBudgetClick={handleSetBudgetClick}
          setIsBudgetOpenFromMarriageWizard={setIsBudgetOpenFromMarriageWizard}
          tempSocialSecurityDetails={tempSocialSecurityDetails}
        />
      )}
      <ChildImpactModal
        childImpactSummary={childImpactSummary}
        inputs={inputs}
        setChildImpactSummary={setChildImpactSummary}
        setEditingEvent={setEditingEvent}
        setShowImprovementModal={setShowImprovementModal}
      />
      {isBudgetModalOpen && (
        <BudgetModal
          inputs={inputs}
          isBudgetOpenFromMarriageWizard={isBudgetOpenFromMarriageWizard}
          editingEvent={editingEvent}
          budgetMonthlyIncome={budgetMonthlyIncome}
          setBudgetMonthlyIncome={setBudgetMonthlyIncome}
          budgetExpenses={budgetExpenses}
          setBudgetExpenses={setBudgetExpenses}
          budgetSavings={budgetSavings}
          setBudgetSavings={setBudgetSavings}
          budgetPartnerSavings={budgetPartnerSavings}
          setBudgetPartnerSavings={setBudgetPartnerSavings}
          activeBudgetPhase={activeBudgetPhase}
          handleSwitchBudgetPhase={handleSwitchBudgetPhase}
          savingsAllocMode={savingsAllocMode}
          handleToggleSavingsAllocMode={handleToggleSavingsAllocMode}
          budgetHsaCoverage={budgetHsaCoverage}
          setBudgetHsaCoverage={setBudgetHsaCoverage}
          budgetFilingStatus={budgetFilingStatus}
          setBudgetFilingStatus={setBudgetFilingStatus}
          budgetMonthlySpending={budgetMonthlySpending}
          setBudgetMonthlySpending={setBudgetMonthlySpending}
          budgetMonthlySavings={budgetMonthlySavings}
          setBudgetMonthlySavings={setBudgetMonthlySavings}
          pendingImprovement={pendingImprovement}
          handleCloseBudgetModal={handleCloseBudgetModal}
          handleSaveBudget={handleSaveBudget}
          isMobile={isMobile}
        />
      )}
      {isSavingsDetailsOpen && (
        <SavingsDetailsModal
          savingsDetails={savingsDetails}
          setSavingsDetails={setSavingsDetails}
          setIsSavingsDetailsOpen={setIsSavingsDetailsOpen}
          handleSaveSavingsDetails={handleSaveSavingsDetails}
        />
      )}
      <CurrentConditionModal
        editingCondition={editingCondition}
        inputs={inputs}
        setEditingCondition={setEditingCondition}
        handleSaveCurrentCondition={handleSaveCurrentCondition}
      />

      {showImprovementModal && improvementPlan && improvementPlan.rankedPlan.length > 0 && (
        <div className="modal-backdrop" onClick={() => setShowImprovementModal(false)}>
          <div className="improvement-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="improvement-modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                💡 Retirement Improvement Plan
              </h3>
              <button 
                type="button" 
                className="improvement-modal-close-btn"
                onClick={() => setShowImprovementModal(false)}
              >
                &times;
              </button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: '1.45' }}>
              Your current path may not fully support retirement. We've generated a personalized action plan with adjustments that could improve your projection. Earning more, saving more, or retiring slightly later can make a massive difference:
            </p>

            <div className="improvement-plan-grid">
              {improvementPlan.rankedPlan.map((scenario) => {
                const isBalanced = scenario.type === 'combined';
                const badgeStyle = getPaceBadgeStyles(scenario.savingsFocus);
                return (
                  <div 
                    key={scenario.type} 
                    className={`improvement-plan-card ${isBalanced ? 'improvement-plan-card-balanced' : ''} ${isBalanced ? 'improvement-plan-grid-balanced' : ''}`}
                  >
                    <div className="improvement-plan-card-main-content">
                      <div className="improvement-plan-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h4 className="improvement-plan-card-title" style={{ margin: 0 }}>
                          <span style={{ marginRight: '0.3rem' }}>{scenario.icon}</span>
                          <span>{scenario.title}</span>
                        </h4>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {isBalanced && (
                            <span className="improvement-plan-card-badge improvement-plan-card-badge-recommended" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.3)', letterSpacing: '0.05em' }}>
                              {scenario.badge}
                            </span>
                          )}
                          <span 
                            className="improvement-plan-card-badge" 
                            style={{ 
                              fontSize: '0.65rem', 
                              textTransform: 'uppercase', 
                              fontWeight: '800', 
                              padding: '0.15rem 0.45rem', 
                              borderRadius: '4px', 
                              letterSpacing: '0.05em',
                              background: badgeStyle.background,
                              color: badgeStyle.color,
                              border: badgeStyle.border
                            }}
                          >
                            {scenario.savingsFocus}
                          </span>
                        </div>
                      </div>
                      <div className="improvement-plan-card-details">
                        <p className="improvement-plan-card-description">
                          {scenario.details}
                        </p>
                        {scenario.bulletPoints && scenario.bulletPoints.length > 0 && (
                          <ul className="improvement-plan-card-bullets">
                            {scenario.bulletPoints.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        )}
                        {scenario.extraAction && (
                          <p className="improvement-plan-card-extra">
                            {scenario.extraAction}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="improvement-plan-card-kpi-block">
                      <div className="improvement-plan-kpi-item">
                        <span className="kpi-item-label">Estimated Ready Age</span>
                        <strong className="kpi-item-value">Age {scenario.readyAge}</strong>
                      </div>
                      <div className="improvement-plan-kpi-item">
                        <span className="kpi-item-label">Retirement Gain</span>
                        <strong className="kpi-item-value gain-value" style={{ fontSize: '0.8rem' }}>
                          {scenario.yearsImprovement !== null && scenario.yearsImprovement > 0 ? (
                            `⚡ ${scenario.yearsImprovement} ${scenario.yearsImprovement === 1 ? 'Year' : 'Years'} Sooner (vs. Age ${activeResults.retirementReadyAge} on current path)`
                          ) : (
                            '✨ Sustainable!'
                          )}
                        </strong>
                      </div>
                    </div>

                    {scenario.isInfoOnly ? (
                      <button
                        type="button"
                        className="improvement-plan-card-apply-btn"
                        style={{ background: 'var(--border-color)', color: 'var(--text-secondary)' }}
                        onClick={() => setShowImprovementModal(false)}
                      >
                        Got it
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="improvement-plan-card-apply-btn"
                        onClick={() => handleApplyImprovementScenario(scenario)}
                      >
                        Apply Scenario
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', borderRadius: '6px' }}
                onClick={() => setShowImprovementModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (() => {
        const isSuccess = notification.startsWith('✓');
        return (
          <div style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: 'var(--bg-secondary, #1f2937)',
            borderLeft: isSuccess ? '4px solid var(--accent-emerald, #10b981)' : '4px solid var(--accent-rose, #f43f5e)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
            color: 'var(--text-primary, #f3f4f6)',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.375rem',
            zIndex: 9999,
            fontSize: '0.875rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'pre-line'
          }}>
            {!isSuccess && '⚠️ '}
            {notification}
          </div>
        );
      })()}

    </div>
  );
}
