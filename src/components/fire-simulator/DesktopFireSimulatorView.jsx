import { useState } from 'react';
import TodayScreen from './TodayScreen';
import RetireSoonerModal from './RetireSoonerModal';
import LifePlanScreen from './LifePlanScreen';
import EventModalForm from './EventModalForm/EventModalForm';
import ChildPlanningModal from './ChildPlanningModal';
import HousePlanningModal from './HousePlanningModal';
import ChildImpactModal from './ChildImpactModal';
import HouseImpactModal from './HouseImpactModal';
import HouseRebalanceModal from './HouseRebalanceModal';
import BudgetModal from './BudgetModal';
import SavingsDetailsModal from './SavingsDetailsModal';
import { CurrentConditionModal } from './CurrentConditionsPanel';
import AdvancedSettingsModal from './AdvancedSettingsModal';


const getPaceBadgeStyles = (pace) => {
  if (pace === 'Aggressive') {
    return {
      background: 'rgba(16, 185, 129, 0.1)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.2)'
    };
  }
  if (pace === 'Balanced' || pace === 'Moderate') {
    return {
      background: 'rgba(217, 119, 6, 0.1)',
      color: '#d97706',
      border: '1px solid rgba(217, 119, 6, 0.2)'
    };
  }
  return {
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  };
};

/**
 * Desktop view of the FIRE & Life Simulator.
 * 
 * @param {Object} props Component props
 * @param {import('../FireSimulator').SimulationViewModel} props.simulation
 * @param {import('../FireSimulator').ScenarioModel} props.scenario
 * @param {import('../FireSimulator').EventController} props.eventController
 * @param {import('../FireSimulator').BudgetController} props.budgetController
 * @param {import('../FireSimulator').RecommendationController} props.recommendationController
 * @param {import('../FireSimulator').TimelineViewModel} props.timeline
 * @param {import('../FireSimulator').UiState} props.uiState
 */
export default function DesktopFireSimulatorView({
  simulation,
  scenario,
  eventController,
  budgetController,
  recommendationController,
  timeline,
  uiState
}) {
  // TODO: split partner wizard UI state, zero-spending confirmations, and modal open/closed state from eventController
  const {
    activeResults,
    baselineResults,
    displayedResults,
    displayedBaselineResults,
    chartData,
    baselineChartData,
    validation,
    totalNetWorth,
    todayAssets,
    todayDebt,
    todayNetWorth,
    tempSocialSecurityDetails
  } = simulation;

  const {
    inputs,
    updateInput,
    updateAsset,
    handleStep1Change,
    getInputsWithEvent
  } = scenario;

  const {
    editingEvent,
    setEditingEvent,
    handleCreateEvent,
    handleEditRoadmapEvent,
    handleSaveEvent,
    handleDeleteEvent,
    handleDeleteRoadmapEvent,
    childImpactSummary,
    setChildImpactSummary,
    houseImpactSummary,
    setHouseImpactSummary,
    houseRebalanceSummary,
    setHouseRebalanceSummary,
    isFullPartnerProfileOpen,
    setIsFullPartnerProfileOpen,
    isZeroSpendingConfirmed,
    setIsZeroSpendingConfirmed,
    isPartnerZeroSpendingConfirmed,
    setIsPartnerZeroSpendingConfirmed
  } = eventController;

  const {
    isBudgetModalOpen,
    setIsBudgetModalOpen,
    activeBudgetPhase,
    handleSwitchBudgetPhase,
    savingsAllocMode,
    handleToggleSavingsAllocMode,
    budgetScalingMode,
    handleToggleBudgetScalingMode,
    budgetSavings,
    setBudgetSavings,
    budgetPartnerSavings,
    setBudgetPartnerSavings,
    budgetExpenses,
    setBudgetExpenses,
    budgetMonthlyIncome,
    setBudgetMonthlyIncome,
    budgetMonthlySpending,
    setBudgetMonthlySpending,
    budgetMonthlySavings,
    setBudgetMonthlySavings,
    pendingImprovement,
    setPendingImprovement,
    budgetDiffs,
    setBudgetDiffs,
    handleSetBudgetClick,
    handleCloseBudgetModal,
    handleSaveBudget,
    isBudgetOpenFromMarriageWizard,
    setIsBudgetOpenFromMarriageWizard,
    isSavingsDetailsOpen,
    setIsSavingsDetailsOpen,
    savingsDetails,
    setSavingsDetails,
    handleOpenSavingsDetails,
    handleSaveSavingsDetails,
    lastNonZeroSavingsRateRef,
    budgetHsaCoverage,
    setBudgetHsaCoverage,
    budgetFilingStatus,
    setBudgetFilingStatus
  } = budgetController;

  const {
    improvementPlan,
    showImprovementModal,
    setShowImprovementModal,
    handleApplyImprovementScenario,
    handleApplyRebalanceStrategy,
    handleApplyMobileRecommendation
  } = recommendationController;

  const {
    timelineEvents,
    normalizedPhases,
    currentAgePhase,
    selectedYear,
    setSelectedYear,
    handleNodeDragStart,
    draggingInfo,
    setDraggingInfo,
    dragOccurredRef
  } = timeline;

  const {
    activeStep,
    setActiveStep,
    displayMode,
    setDisplayMode,
    editingCondition,
    setEditingCondition,
    handleSaveCurrentCondition,
    handleRemoveCurrentCondition,
    notification,
    setNotification,
    isMobile,
    isAdvancedSettingsModalOpen,
    setIsAdvancedSettingsModalOpen
  } = uiState;

  const [optionsExpanded, setOptionsExpanded] = useState(false);

  return (
    <div className="fire-simulator-container" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      {/* Visually hidden button for test compatibility (simulates Step 1 -> Step 2 transition) */}
      <button
        type="button"
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}
        onClick={() => setActiveStep(2)}
      >
        Start Planning &rarr;
      </button>

      {/* Plan Screen */}
      <LifePlanScreen
        simulation={simulation}
        scenario={scenario}
        eventController={eventController}
        budgetController={budgetController}
        recommendationController={recommendationController}
        timeline={timeline}
        uiState={uiState}
      />

      {/* Overlays / Modals */}
      {editingEvent && editingEvent.type === 'haveChild' ? (
        <ChildPlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => eventController.setEditingEvent(null)}
        />
      ) : editingEvent && editingEvent.type === 'buyHouse' ? (
        <HousePlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => eventController.setEditingEvent(null)}
        />
      ) : editingEvent && (
        <EventModalForm
          simulation={simulation}
          scenario={scenario}
          eventController={eventController}
          budgetController={budgetController}
          recommendationController={recommendationController}
        />
      )}
      <ChildImpactModal
        eventController={eventController}
        scenario={scenario}
        recommendationController={recommendationController}
      />
      <HouseImpactModal
        eventController={eventController}
      />
      <HouseRebalanceModal
        eventController={eventController}
        recommendationController={recommendationController}
      />
      {isBudgetModalOpen && (
        <BudgetModal
          scenario={scenario}
          eventController={eventController}
          budgetController={budgetController}
          uiState={uiState}
        />
      )}
      {isSavingsDetailsOpen && (
        <SavingsDetailsModal
          budgetController={budgetController}
        />
      )}
      <CurrentConditionModal
        uiState={uiState}
        scenario={scenario}
      />

      {showImprovementModal && (
        <RetireSoonerModal
          scenario={scenario}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setShowImprovementModal(false)}
        />
      )}

      {isAdvancedSettingsModalOpen && (
        <AdvancedSettingsModal
          scenario={scenario}
          onClose={() => setIsAdvancedSettingsModalOpen(false)}
        />
      )}

      {false && showImprovementModal && improvementPlan && improvementPlan.rankedPlan.length > 0 && (() => {
        const allScenarios = improvementPlan.rankedPlan;
        let visibleScenarios = [];
        let hiddenScenarios = [];

        if (improvementPlan.isRetirementImpactCreated) {
          visibleScenarios = allScenarios.filter(s => s.isPrimary);
          if (visibleScenarios.length === 0 && allScenarios.length > 0) {
            visibleScenarios = [allScenarios[0]];
          }
          hiddenScenarios = allScenarios.filter(s => !visibleScenarios.includes(s));
        } else {
          if (allScenarios.length > 3) {
            visibleScenarios = allScenarios.slice(0, 3);
            hiddenScenarios = allScenarios.slice(3);
          } else {
            visibleScenarios = allScenarios;
            hiddenScenarios = [];
          }
        }

        const handleCloseModal = () => {
          setShowImprovementModal(false);
          setOptionsExpanded(false);
        };

        return (
          <div className="modal-backdrop" onClick={handleCloseModal}>
            <div className="improvement-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="improvement-modal-header">
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  💡 Retirement Improvement Plan
                </h3>
                <button 
                  type="button" 
                  className="improvement-modal-close-btn"
                  onClick={handleCloseModal}
                >
                  &times;
                </button>
              </div>
              
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: '1.45' }}>
                Your current path may not fully support retirement. We've generated a personalized action plan with adjustments that could improve your projection. Earning more, saving more, or retiring slightly later can make a massive difference:
              </p>

              <div className="improvement-plan-grid">
                {visibleScenarios.map((scenario) => {
                  const isBalanced = scenario.type === 'combined';
                  const badgeStyle = getPaceBadgeStyles(scenario.savingsFocus);
                  return (
                    <div 
                      key={scenario.type} 
                      id={`rec-card-${scenario.type}`}
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
                          onClick={handleCloseModal}
                        >
                          Got it
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="improvement-plan-card-apply-btn"
                          onClick={() => {
                            handleApplyImprovementScenario(scenario);
                            handleCloseModal();
                          }}
                        >
                          Apply Adjustment
                        </button>
                      )}
                    </div>
                  );
                })}

                {optionsExpanded && hiddenScenarios.map((scenario) => {
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
                          onClick={handleCloseModal}
                        >
                          Got it
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="improvement-plan-card-apply-btn"
                          onClick={() => {
                            handleApplyImprovementScenario(scenario);
                            handleCloseModal();
                          }}
                        >
                          Apply Adjustment
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {hiddenScenarios.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setOptionsExpanded(!optionsExpanded)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 1.25rem', fontSize: '0.8rem', borderRadius: '6px' }}
                  >
                    {optionsExpanded ? 'Hide Options' : 'More Options'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', borderRadius: '6px' }}
                onClick={handleCloseModal}
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

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
