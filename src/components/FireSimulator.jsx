import { useState, useMemo, useEffect } from 'react';
import { useResponsiveFireView } from '../features/fire/state/useResponsiveFireView';
import { useSimulationController } from '../features/fire/state/useSimulationController';
import { useTimelineEvents } from '../hooks/useTimelineEvents';
import { useBudgetPhases } from '../hooks/useBudgetPhases';
import { useRecommendations } from '../hooks/useRecommendations';
import { useBudgetState } from '../hooks/useBudgetState';
import { useEventEditingController } from '../features/fire/events/useEventEditingController';
import { useRecommendationController } from '../features/fire/recommendations/useRecommendationController';
import { eventSaveRouter } from '../features/fire/events/eventSaveRouter';

import DesktopFireSimulatorView from './fire-simulator/DesktopFireSimulatorView';
import MobileFireSimulatorView from './fire-simulator/MobileFireSimulatorView';
import './FireSimulator.css';

/**
 * FireSimulator composition shell. Coordinates and initializes simulation controllers,
 * compiles view models, and renders responsive desktop vs mobile views.
 */
export default function FireSimulator() {
  const [activeStep, setActiveStep] = useState(1);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isAdvancedSettingsModalOpen, setIsAdvancedSettingsModalOpen] = useState(false);

  // 1. Responsive View Detection
  const { isMobile } = useResponsiveFireView();

  // 2. Simulation Controller (scenarios, inputs, simulation results)
  const simulationController = useSimulationController({ editingEvent });
  
  // 3. Timeline & Budget phases
  const timelineEvents = useTimelineEvents(simulationController.inputs, simulationController.displayedResults);
  const { normalizedPhases, currentAgePhase } = useBudgetPhases(simulationController.inputs);
  const { improvementPlan } = useRecommendations(simulationController.inputs, simulationController.activeResults);

  // 4. Budget State Controller
  const budgetController = useBudgetState(
    simulationController.scenarios,
    simulationController.setScenarios,
    simulationController.currentScenarioId,
    simulationController.inputs,
    simulationController.updateInput,
    simulationController.activeResults,
    editingEvent,
    setEditingEvent
  );

  // 5. Event/Condition Editing Controller
  const eventController = useEventEditingController({
    scenarios: simulationController.scenarios,
    setScenarios: simulationController.setScenarios,
    currentScenarioId: simulationController.currentScenarioId,
    inputs: simulationController.inputs,
    updateInput: simulationController.updateInput,
    activeResults: simulationController.activeResults,
    timelineEvents,
    handleSetBudgetClick: (phaseId) => budgetController.handleSetBudgetClick(phaseId),
    setIsBudgetOpenFromMarriageWizard: (val) => budgetController.setIsBudgetOpenFromMarriageWizard(val),
    isMobile,
    setShowImprovementModal: (val) => recommendationController.setShowImprovementModal(val),
    commitEventAgeChange: simulationController.commitEventAgeChange,
    editingEvent,
    setEditingEvent
  });

  // 6. Recommendation Controller
  const recommendationController = useRecommendationController({
    setScenarios: simulationController.setScenarios,
    currentScenarioId: simulationController.currentScenarioId,
    inputs: simulationController.inputs,
    editingEvent,
    setEditingEvent,
    houseRebalanceSummary: eventController.houseRebalanceSummary,
    setNotification: eventController.setNotification,
    setIsBudgetModalOpen: budgetController.setIsBudgetModalOpen,
    setBudgetDiffs: budgetController.setBudgetDiffs,
    setBudgetGrossIncome: budgetController.setBudgetGrossIncome,
    setBudgetFilingStatus: budgetController.setBudgetFilingStatus,
    setBudgetHsaCoverage: budgetController.setBudgetHsaCoverage,
    setBudgetSavings: budgetController.setBudgetSavings,
    setBudgetPartnerSavings: budgetController.setBudgetPartnerSavings,
    setBudgetExpenses: budgetController.setBudgetExpenses,
    setEditedPhases: budgetController.setEditedPhases,
    setActiveBudgetPhase: budgetController.setActiveBudgetPhase,
    setBudgetMonthlyIncome: budgetController.setBudgetMonthlyIncome,
    setBudgetMonthlySpending: budgetController.setBudgetMonthlySpending,
    setBudgetMonthlySavings: budgetController.setBudgetMonthlySavings,
    setSavingsAllocMode: budgetController.setSavingsAllocMode,
    setPendingImprovement: budgetController.setPendingImprovement
  });

  // Prevent body scroll when modal overlays are active
  useEffect(() => {
    if (
      budgetController.isBudgetModalOpen ||
      recommendationController.showImprovementModal ||
      editingEvent ||
      eventController.editingCondition ||
      isAdvancedSettingsModalOpen
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [
    budgetController.isBudgetModalOpen,
    recommendationController.showImprovementModal,
    editingEvent,
    eventController.editingCondition,
    isAdvancedSettingsModalOpen
  ]);

  // View Models Compilation
  const simulationModel = useMemo(() => ({
    activeResults: simulationController.activeResults,
    baselineResults: simulationController.baselineResults,
    displayedResults: simulationController.displayedResults,
    displayedBaselineResults: simulationController.displayedBaselineResults,
    chartData: simulationController.chartData,
    baselineChartData: simulationController.baselineChartData,
    validation: simulationController.validation,
    totalNetWorth: simulationController.displayedResults.currentNetWorth,
    todayAssets: (simulationController.chartData[0] || {}).assets || 0,
    todayDebt: (simulationController.chartData[0] || {}).debt || 0,
    todayNetWorth: (simulationController.chartData[0] || {}).netWorth !== undefined 
      ? (simulationController.chartData[0] || {}).netWorth 
      : simulationController.displayedResults.currentNetWorth,
    tempSocialSecurityDetails: simulationController.tempSocialSecurityDetails
  }), [simulationController]);

  const scenarioModel = useMemo(() => ({
    inputs: simulationController.inputs,
    updateInput: simulationController.updateInput,
    updateAsset: simulationController.updateAsset,
    scenarios: simulationController.scenarios,
    setScenarios: simulationController.setScenarios,
    currentScenarioId: simulationController.currentScenarioId,
    handleStep1Change: (key, value) => {
      if (key === 'simpleInvestments') {
        simulationController.updateAsset('brokerage', value);
      } else {
        simulationController.updateInput(key, value);
      }
    },
    getInputsWithEvent: (baseInputs, event) => {
      const result = eventSaveRouter.routeSave(
        event,
        baseInputs,
        simulationController.scenarios,
        simulationController.currentScenarioId
      );
      return {
        newInputs: result?.updatedInputs || baseInputs,
        savedEvent: result?.savedEvent || null
      };
    }
  }), [simulationController]);

  const eventControllerModel = useMemo(() => ({
    editingEvent,
    setEditingEvent,
    selectedEventId: eventController.selectedEventId,
    setSelectedEventId: eventController.setSelectedEventId,
    selectedEvent: eventController.selectedEvent,
    setSelectedEvent: eventController.setSelectedEvent,
    handleCreateEvent: eventController.handleCreateEvent,
    handleEditRoadmapEvent: eventController.handleEditRoadmapEvent,
    handleSaveEvent: eventController.handleSaveEvent,
    handleDeleteEvent: eventController.handleDeleteEvent,
    handleDeleteRoadmapEvent: eventController.handleDeleteRoadmapEvent,
    childImpactSummary: eventController.childImpactSummary,
    setChildImpactSummary: eventController.setChildImpactSummary,
    houseImpactSummary: eventController.houseImpactSummary,
    setHouseImpactSummary: eventController.setHouseImpactSummary,
    houseRebalanceSummary: eventController.houseRebalanceSummary,
    setHouseRebalanceSummary: eventController.setHouseRebalanceSummary,
    isFullPartnerProfileOpen: eventController.isFullPartnerProfileOpen,
    setIsFullPartnerProfileOpen: eventController.setIsFullPartnerProfileOpen,
    isZeroSpendingConfirmed: eventController.isZeroSpendingConfirmed,
    setIsZeroSpendingConfirmed: eventController.setIsZeroSpendingConfirmed,
    isPartnerZeroSpendingConfirmed: eventController.isPartnerZeroSpendingConfirmed,
    setIsPartnerZeroSpendingConfirmed: eventController.setIsPartnerZeroSpendingConfirmed
  }), [editingEvent, eventController]);

  const budgetControllerModel = useMemo(() => ({
    isBudgetModalOpen: budgetController.isBudgetModalOpen,
    setIsBudgetModalOpen: budgetController.setIsBudgetModalOpen,
    activeBudgetPhase: budgetController.activeBudgetPhase,
    handleSwitchBudgetPhase: budgetController.handleSwitchBudgetPhase,
    savingsAllocMode: budgetController.savingsAllocMode,
    handleToggleSavingsAllocMode: budgetController.handleToggleSavingsAllocMode,
    budgetScalingMode: budgetController.budgetScalingMode,
    handleToggleBudgetScalingMode: budgetController.handleToggleBudgetScalingMode,
    budgetSavings: budgetController.budgetSavings,
    setBudgetSavings: budgetController.setBudgetSavings,
    budgetPartnerSavings: budgetController.budgetPartnerSavings,
    setBudgetPartnerSavings: budgetController.setBudgetPartnerSavings,
    budgetExpenses: budgetController.budgetExpenses,
    setBudgetExpenses: budgetController.setBudgetExpenses,
    budgetMonthlyIncome: budgetController.budgetMonthlyIncome,
    setBudgetMonthlyIncome: budgetController.setBudgetMonthlyIncome,
    budgetMonthlySpending: budgetController.budgetMonthlySpending,
    setBudgetMonthlySpending: budgetController.setBudgetMonthlySpending,
    budgetMonthlySavings: budgetController.budgetMonthlySavings,
    setBudgetMonthlySavings: budgetController.setBudgetMonthlySavings,
    pendingImprovement: budgetController.pendingImprovement,
    setPendingImprovement: budgetController.setPendingImprovement,
    budgetDiffs: budgetController.budgetDiffs,
    setBudgetDiffs: budgetController.setBudgetDiffs,
    handleSetBudgetClick: budgetController.handleSetBudgetClick,
    handleCloseBudgetModal: budgetController.handleCloseBudgetModal,
    handleSaveBudget: budgetController.handleSaveBudget,
    isBudgetOpenFromMarriageWizard: budgetController.isBudgetOpenFromMarriageWizard,
    setIsBudgetOpenFromMarriageWizard: budgetController.setIsBudgetOpenFromMarriageWizard,
    isSavingsDetailsOpen: budgetController.isSavingsDetailsOpen,
    setIsSavingsDetailsOpen: budgetController.setIsSavingsDetailsOpen,
    savingsDetails: budgetController.savingsDetails,
    setSavingsDetails: budgetController.setSavingsDetails,
    handleOpenSavingsDetails: budgetController.handleOpenSavingsDetails,
    handleSaveSavingsDetails: budgetController.handleSaveSavingsDetails,
    lastNonZeroSavingsRateRef: budgetController.lastNonZeroSavingsRateRef
  }), [budgetController]);

  const recommendationControllerModel = useMemo(() => ({
    improvementPlan,
    showImprovementModal: recommendationController.showImprovementModal,
    setShowImprovementModal: recommendationController.setShowImprovementModal,
    handleApplyImprovementScenario: (scenario) => recommendationController.applyRecommendationAction(scenario),
    handleApplyRebalanceStrategy: (strategyId) => recommendationController.applyRecommendationAction({ type: strategyId }),
    handleApplyMobileRecommendation: (scenario) => recommendationController.applyRecommendationAction(scenario)
  }), [improvementPlan, recommendationController]);

  const timelineModel = useMemo(() => ({
    timelineEvents,
    normalizedPhases,
    currentAgePhase,
    selectedYear: simulationController.selectedYear,
    setSelectedYear: simulationController.setSelectedYear,
    handleNodeDragStart: eventController.handleNodeDragStart,
    draggingInfo: eventController.draggingInfo,
    setDraggingInfo: eventController.setDraggingInfo,
    dragOccurredRef: eventController.dragOccurredRef,
    commitEventAgeChange: simulationController.commitEventAgeChange
  }), [
    timelineEvents,
    normalizedPhases,
    currentAgePhase,
    simulationController.selectedYear,
    simulationController.setSelectedYear,
    eventController,
    simulationController.commitEventAgeChange
  ]);

  const uiStateModel = useMemo(() => ({
    activeStep,
    setActiveStep,
    displayMode: simulationController.displayMode,
    setDisplayMode: simulationController.setDisplayMode,
    editingCondition: eventController.editingCondition,
    setEditingCondition: eventController.setEditingCondition,
    handleSaveCurrentCondition: eventController.handleSaveCurrentCondition,
    handleRemoveCurrentCondition: eventController.handleRemoveCurrentCondition,
    notification: eventController.notification,
    setNotification: eventController.setNotification,
    isMobile,
    isAdvancedSettingsModalOpen,
    setIsAdvancedSettingsModalOpen
  }), [
    activeStep,
    simulationController.displayMode,
    simulationController.setDisplayMode,
    eventController,
    isMobile,
    isAdvancedSettingsModalOpen
  ]);

  return isMobile ? (
    <MobileFireSimulatorView
      simulation={simulationModel}
      scenario={scenarioModel}
      eventController={eventControllerModel}
      budgetController={budgetControllerModel}
      recommendationController={recommendationControllerModel}
      timeline={timelineModel}
      uiState={uiStateModel}
    />
  ) : (
    <DesktopFireSimulatorView
      simulation={simulationModel}
      scenario={scenarioModel}
      eventController={eventControllerModel}
      budgetController={budgetControllerModel}
      recommendationController={recommendationControllerModel}
      timeline={timelineModel}
      uiState={uiStateModel}
    />
  );
}
