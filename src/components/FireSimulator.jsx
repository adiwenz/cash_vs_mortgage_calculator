/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useFireSimulation } from '../hooks/useFireSimulation';
import { useTimelineEvents } from '../hooks/useTimelineEvents';
import { useBudgetPhases } from '../hooks/useBudgetPhases';
import { useRecommendations } from '../hooks/useRecommendations';
import { useBudgetState } from '../hooks/useBudgetState';
import { useEventActions } from '../hooks/useEventActions';
import { useRecommendationController } from '../features/fire/recommendations/useRecommendationController';
import { applyBalancedBudgetAdjustments, splitPhasesAtAge, applyBudgetAdjustmentsForLevel, resolveBuyHouseEvent } from '../calculators/fire/rebalance';
import { eventSaveRouter } from '../features/fire/events/eventSaveRouter';

import DesktopFireSimulatorView from './fire-simulator/DesktopFireSimulatorView';
import MobileFireSimulatorView from './fire-simulator/MobileFireSimulatorView';

import { isEditableEvent, calculateMarriageEstimates } from './fire-simulator/helpers';
import { createMarriageEventObject, createSpouseRecord } from '../domain/events/marriage/marriageEventFactory';
import { 
  validateSocialSecurityClaimAge, 
  getIncomeHistory, 
  calculateTop35AverageIncome, 
  calculateSocialSecurityBenefit, 
  calculateClaimingAgeMultiplier,
  getNormalizedPhases
} from '../fireCalculations';
import { calculateUSTaxForModal } from '../simulatorMathUtils';
import { applyChildRecommendation } from '../domain/events/child/childRecommendations';
import './FireSimulator.css';

/**
 * @typedef {Object} SimulationViewModel
 * @property {Object} activeResults
 * @property {Object} baselineResults
 * @property {Object} displayedResults
 * @property {Object} displayedBaselineResults
 * @property {Array} chartData
 * @property {Array} baselineChartData
 * @property {Object} validation
 * @property {number} totalNetWorth
 * @property {number} todayAssets
 * @property {number} todayDebt
 * @property {number} todayNetWorth
 * @property {Object} tempSocialSecurityDetails
 */

/**
 * @typedef {Object} ScenarioModel
 * @property {Object} inputs
 * @property {Function} updateInput
 * @property {Function} updateAsset
 * @property {Function} handleStep1Change
 * @property {Function} getInputsWithEvent
 */

/**
 * @typedef {Object} EventController
 * @property {Object|null} editingEvent
 * @property {Function} setEditingEvent
 * @property {Function} handleCreateEvent
 * @property {Function} handleEditRoadmapEvent
 * @property {Function} handleSaveEvent
 * @property {Function} handleDeleteEvent
 * @property {Function} handleDeleteRoadmapEvent
 * @property {Object|null} childImpactSummary
 * @property {Function} setChildImpactSummary
 * @property {Object|null} houseImpactSummary
 * @property {Function} setHouseImpactSummary
 * @property {Object|null} houseRebalanceSummary
 * @property {Function} setHouseRebalanceSummary
 * @property {boolean} isFullPartnerProfileOpen
 * @property {Function} setIsFullPartnerProfileOpen
 * @property {boolean} isZeroSpendingConfirmed
 * @property {Function} setIsZeroSpendingConfirmed
 * @property {boolean} isPartnerZeroSpendingConfirmed
 * @property {Function} setIsPartnerZeroSpendingConfirmed
 * @property {Object} dragOccurredRef
 */

/**
 * @typedef {Object} BudgetController
 * @property {boolean} isBudgetModalOpen
 * @property {Function} setIsBudgetModalOpen
 * @property {string|null} activeBudgetPhase
 * @property {Function} handleSwitchBudgetPhase
 * @property {string} savingsAllocMode
 * @property {Function} handleToggleSavingsAllocMode
 * @property {string} budgetScalingMode
 * @property {Function} handleToggleBudgetScalingMode
 * @property {Object} budgetSavings
 * @property {Function} setBudgetSavings
 * @property {Object} budgetPartnerSavings
 * @property {Function} setBudgetPartnerSavings
 * @property {Object} budgetExpenses
 * @property {Function} setBudgetExpenses
 * @property {number} budgetMonthlyIncome
 * @property {Function} setBudgetMonthlyIncome
 * @property {number} budgetMonthlySpending
 * @property {Function} setBudgetMonthlySpending
 * @property {number} budgetMonthlySavings
 * @property {Function} setBudgetMonthlySavings
 * @property {Object|null} pendingImprovement
 * @property {Function} setPendingImprovement
 * @property {Object} budgetDiffs
 * @property {Function} setBudgetDiffs
 * @property {Function} handleSetBudgetClick
 * @property {Function} handleCloseBudgetModal
 * @property {Function} handleSaveBudget
 * @property {boolean} isBudgetOpenFromMarriageWizard
 * @property {Function} setIsBudgetOpenFromMarriageWizard
 * @property {boolean} isSavingsDetailsOpen
 * @property {Function} setIsSavingsDetailsOpen
 * @property {Object} savingsDetails
 * @property {Function} setSavingsDetails
 * @property {Function} handleOpenSavingsDetails
 * @property {Function} handleSaveSavingsDetails
 * @property {Object} lastNonZeroSavingsRateRef
 */

/**
 * @typedef {Object} RecommendationController
 * @property {Object|null} improvementPlan
 * @property {boolean} showImprovementModal
 * @property {Function} setShowImprovementModal
 * @property {Function} handleApplyImprovementScenario
 * @property {Function} handleApplyRebalanceStrategy
 * @property {Function} handleApplyMobileRecommendation
 */

/**
 * @typedef {Object} TimelineViewModel
 * @property {Array} timelineEvents
 * @property {Array} normalizedPhases
 * @property {Object} currentAgePhase
 * @property {number|null} selectedYear
 * @property {Function} setSelectedYear
 * @property {Function} handleNodeDragStart
 * @property {Object|null} draggingInfo
 * @property {Function} setDraggingInfo
 * @property {Object} dragOccurredRef
 */

/**
 * @typedef {Object} UiState
 * @property {number} activeStep
 * @property {Function} setActiveStep
 * @property {string} displayMode
 * @property {Function} setDisplayMode
 * @property {Object|null} editingCondition
 * @property {Function} setEditingCondition
 * @property {Function} handleSaveCurrentCondition
 * @property {Function} handleRemoveCurrentCondition
 * @property {string|null} notification
 * @property {Function} setNotification
 * @property {boolean} isMobile
 */

export default function FireSimulator() {
  const [activeStep, setActiveStep] = useState(1);
  const [isBudgetOpenFromMarriageWizard, setIsBudgetOpenFromMarriageWizard] = useState(false);
  const [isSavingsDetailsOpen, setIsSavingsDetailsOpen] = useState(false);
  const [savingsDetails, setSavingsDetails] = useState({
    cash: 0,
    emergencyFund: 0,
    brokerage: 0,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    other: 0
  });

  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [wasShortfall, setWasShortfall] = useState(false);
  const lastNonZeroSavingsRateRef = useRef(15); // default to 15% pre-tax savings rate

  // 1. useFireSimulation hook
  const fireSim = useFireSimulation();
  const {
    scenarios,
    setScenarios,
    currentScenarioId,
    inputs,
    updateInput,
    updateAsset,
    displayMode,
    setDisplayMode,
    selectedYear,
    setSelectedYear,
    isMobile,
    baselineResults,
    activeResults,
    displayedResults,
    displayedBaselineResults,
    chartData,
    baselineChartData,
    validation,
    setEditingEvent: setEditingEventForSS
  } = fireSim;

  // Ref to proxy circular budget calls
  const handleSetBudgetClickRef = useRef(null);

  // 2. useEventActions hook
  const eventActions = useEventActions(
    scenarios,
    setScenarios,
    currentScenarioId,
    inputs,
    updateInput,
    (phaseId) => handleSetBudgetClickRef.current?.(phaseId),
    setIsBudgetOpenFromMarriageWizard,
    isMobile,
    setShowImprovementModal
  );
  const {
    editingEvent,
    setEditingEvent,
    childImpactSummary,
    setChildImpactSummary,
    houseImpactSummary,
    setHouseImpactSummary,
    houseRebalanceSummary,
    setHouseRebalanceSummary,
    editingCondition,
    setEditingCondition,
    draggingInfo,
    setDraggingInfo,
    notification,
    setNotification,
    isFullPartnerProfileOpen,
    setIsFullPartnerProfileOpen,
    isZeroSpendingConfirmed,
    setIsZeroSpendingConfirmed,
    isPartnerZeroSpendingConfirmed,
    setIsPartnerZeroSpendingConfirmed,
    dragOccurredRef,
    handleCreateEvent,
    handleEditRoadmapEvent,
    handleSaveEvent,
    handleDeleteEvent,
    handleDeleteRoadmapEvent
  } = eventActions;

  useEffect(() => {
    setEditingEventForSS(editingEvent);
  }, [editingEvent, setEditingEventForSS]);

  // 3. useBudgetState hook
  const budgetState = useBudgetState(
    scenarios,
    setScenarios,
    currentScenarioId,
    inputs,
    updateInput,
    activeResults,
    editingEvent,
    setEditingEvent,
    isBudgetOpenFromMarriageWizard,
    setIsBudgetOpenFromMarriageWizard
  );
  useEffect(() => {
    handleSetBudgetClickRef.current = budgetState.handleSetBudgetClick;
  }, [budgetState.handleSetBudgetClick]);

  const {
    isBudgetModalOpen,
    setIsBudgetModalOpen,
    activeBudgetPhase,
    setActiveBudgetPhase,
    editedPhases,
    setEditedPhases,
    expandedCategories,
    setExpandedCategories,
    budgetGrossIncome,
    setBudgetGrossIncome,
    budgetFilingStatus,
    setBudgetFilingStatus,
    budgetHsaCoverage,
    setBudgetHsaCoverage,
    savingsAllocMode,
    setSavingsAllocMode,
    budgetSavings,
    setBudgetSavings,
    budgetPartnerSavings,
    setBudgetPartnerSavings,
    budgetExpenses,
    setBudgetExpenses,
    activeBudgetTab,
    setActiveBudgetTab,
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
    handleSwitchBudgetPhase,
    handleToggleSavingsAllocMode,
    handleSaveBudget,
    budgetScalingMode,
    handleToggleBudgetScalingMode
  } = budgetState;

  // 3.5. useRecommendationController hook
  const recommendationControllerHook = useRecommendationController({
    setScenarios,
    currentScenarioId,
    inputs,
    editingEvent,
    setEditingEvent,
    houseRebalanceSummary,
    setNotification,
    setIsBudgetModalOpen,
    setShowImprovementModal,
    setBudgetDiffs,
    setBudgetGrossIncome,
    setBudgetFilingStatus,
    setBudgetHsaCoverage,
    setBudgetSavings,
    setBudgetPartnerSavings,
    setBudgetExpenses,
    setEditedPhases,
    setActiveBudgetPhase,
    setBudgetMonthlyIncome,
    setBudgetMonthlySpending,
    setBudgetMonthlySavings,
    setSavingsAllocMode,
    setPendingImprovement
  });

  // 4. useTimelineEvents hook
  const timelineEvents = useTimelineEvents(inputs, displayedResults);

  // 5. useBudgetPhases hook
  const { normalizedPhases, currentAgePhase } = useBudgetPhases(inputs);

  // 6. useRecommendations hook
  const { improvementPlan } = useRecommendations(inputs, activeResults);

  // Summary statistics
  const totalNetWorth = displayedResults.currentNetWorth;
  const todayLog = chartData[0] || { assets: 0, debt: 0, netWorth: 0 };
  const todayAssets = todayLog.assets || 0;
  const todayDebt = todayLog.debt || 0;
  const todayNetWorth = todayLog.netWorth !== undefined ? todayLog.netWorth : totalNetWorth;

  const handleOpenSavingsDetails = () => {
    setSavingsDetails({
      cash: Number(inputs.assets?.cash) || 0,
      emergencyFund: Number(inputs.assets?.emergencyFund) || 0,
      brokerage: Number(inputs.assets?.brokerage) || 0,
      trad401k: Number(inputs.assets?.trad401k) || 0,
      tradIra: Number(inputs.assets?.tradIra) || 0,
      rothIra: Number(inputs.assets?.rothIra) || 0,
      hsa: Number(inputs.assets?.hsa) || 0,
      other: Number(inputs.assets?.other) || 0
    });
    setIsSavingsDetailsOpen(true);
  };

  const handleSaveSavingsDetails = (newDetails) => {
    updateInput('assets', newDetails);
    const total = Object.values(newDetails).reduce((sum, val) => sum + val, 0);
    updateInput('simpleInvestments', total);
    setIsSavingsDetailsOpen(false);
  };

  const handleRemoveCurrentCondition = (id) => {
    const nextList = (inputs.currentConditions || []).filter(c => c.id !== id);
    updateInput('currentConditions', nextList);
  };

  const handleSaveCurrentCondition = () => {
    if (!editingCondition) return;
    let nextList = [...(inputs.currentConditions || [])];
    if (editingCondition.id) {
      nextList = nextList.map(c => c.id === editingCondition.id ? editingCondition : c);
    } else {
      const newItem = {
        ...editingCondition,
        id: `cond-${Date.now()}`
      };
      nextList.push(newItem);
    }
    updateInput('currentConditions', nextList);
    setEditingCondition(null);
  };

  // commitEventAgeChange is now delegated to useScenarioState

  const handleNodeDragStart = (e, evt) => {
    if (!isEditableEvent(evt) || evt.type === 'fiReached' || evt.type === 'mortgageOff') return;

    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;

    const track = e.currentTarget.closest('.timeline-track-inner') || e.currentTarget.closest('.mobile-roadmap-scroll-container');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width;
    const minAge = inputs.currentAge;
    const maxAge = inputs.lifeExpectancy;
    const totalYears = maxAge - minAge;
    const initialAge = typeof evt.age === 'number' && !isNaN(evt.age) ? evt.age : (inputs.currentAge || 35);

    let childEndOffset = 0;
    if (evt.type === 'haveChild') {
      const linkedEndEvent = timelineEvents.find(e => e.type === 'childSupportEnds' && String(e.childEventId) === String(evt.originalId));
      if (linkedEndEvent) {
        childEndOffset = linkedEndEvent.age - evt.age;
      } else {
        const lifeEv = inputs.lifeEvents?.find(e => e.id === evt.originalId);
        childEndOffset = lifeEv?.includeCollege ? 22 : 18;
      }
    }

    dragOccurredRef.current = false;

    setDraggingInfo({
      originalId: evt.originalId || null,
      type: evt.type,
      initialAge,
      currentAge: initialAge,
      startX,
      childEndOffset
    });

    const handleDragMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;

      const deltaYears = trackWidth > 0 ? (deltaX / trackWidth) * totalYears : 0;
      const rawAge = Math.round(initialAge + deltaYears);
      let newAge = rawAge;

      if (evt.type === 'socialSecurity') {
        newAge = Math.max(62, Math.min(70, newAge));
      } else if (evt.type === 'buyHouse' && evt.houseId) {
        const sellEv = inputs.lifeEvents?.find(e => e.type === 'sellHouse' && e.houseId === evt.houseId);
        const maxLimit = sellEv ? Number(sellEv.age) - 1 : maxAge;
        newAge = Math.max(minAge, Math.min(maxLimit, newAge));
      } else if (evt.type === 'sellHouse' && evt.houseId) {
        const buyEv = inputs.lifeEvents?.find(e => e.type === 'buyHouse' && e.houseId === evt.houseId);
        const minLimit = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : buyEv.age) + 1 : minAge;
        newAge = Math.max(minLimit, Math.min(maxAge, newAge));
      } else if (evt.type === 'haveChild') {
        const offset = childEndOffset || 18;
        newAge = Math.max(minAge, Math.min(maxAge - offset, newAge));
      } else {
        newAge = Math.max(minAge, Math.min(maxAge, newAge));
      }

      if (Math.abs(deltaX) > 2) {
        dragOccurredRef.current = true;
      }

      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      setDraggingInfo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentAge: newAge,
          rawAge: rawAge
        };
      });
    };

    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);

      setDraggingInfo(currentDrag => {
        if (currentDrag && dragOccurredRef.current) {
          let targetAge = currentDrag.currentAge;
          if (evt.type === 'socialSecurity') {
            const rawAge = currentDrag.rawAge !== undefined ? currentDrag.rawAge : targetAge;
            const valSS = validateSocialSecurityClaimAge(rawAge);
            targetAge = valSS.validAge;
            if (valSS.wasClamped) {
              setNotification(valSS.message);
              setTimeout(() => setNotification(null), 2000);
            }
          }
          fireSim.commitEventAgeChange(evt, targetAge);
        }
        return null;
      });

      setTimeout(() => {
        dragOccurredRef.current = false;
      }, 50);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  const handleApplyImprovementScenario = (scenario) => {
    recommendationControllerHook.applyRecommendationAction(scenario);
  };

  const handleApplyRebalanceStrategy = (strategyId) => {
    recommendationControllerHook.applyRecommendationAction({ type: strategyId });
  };

  // Track last non-zero savings rate to preserve it during empty/zero income editing states
  useEffect(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income > 0) {
      const rate = Math.round(((income - expenses) / income) * 100);
      lastNonZeroSavingsRateRef.current = rate;
    }
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  // Prevent body scroll when modal overlays are active
  useEffect(() => {
    if (isBudgetModalOpen || showImprovementModal || editingEvent || editingCondition) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBudgetModalOpen, showImprovementModal, editingEvent, editingCondition]);

  const syncChildcarePhasesAndRules = () => {};

  const handleApplyMobileRecommendation = (scenario) => {
    recommendationControllerHook.applyRecommendationAction(scenario);
  };

  const getInputsWithEvent = (baseInputs, event) => {
    const result = eventSaveRouter.routeSave(event, baseInputs, scenarios, currentScenarioId);
    return {
      newInputs: result?.updatedInputs || baseInputs,
      savedEvent: result?.savedEvent || null
    };
  };

  const simulation = useMemo(() => ({
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
    tempSocialSecurityDetails: fireSim.tempSocialSecurityDetails
  }), [
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
    fireSim.tempSocialSecurityDetails
  ]);

  const scenario = useMemo(() => ({
    inputs,
    updateInput,
    updateAsset,
    handleStep1Change: (key, value) => {
      if (key === 'simpleInvestments') {
        updateAsset('brokerage', value);
      } else {
        updateInput(key, value);
      }
    },
    getInputsWithEvent
  }), [
    inputs,
    updateInput,
    updateAsset,
    getInputsWithEvent
  ]);

  const eventController = useMemo(() => ({
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
  }), [
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
  ]);

  const budgetController = useMemo(() => ({
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
    lastNonZeroSavingsRateRef
  }), [
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
    lastNonZeroSavingsRateRef
  ]);

  const recommendationController = useMemo(() => ({
    improvementPlan,
    showImprovementModal,
    setShowImprovementModal,
    handleApplyImprovementScenario,
    handleApplyRebalanceStrategy,
    handleApplyMobileRecommendation
  }), [
    improvementPlan,
    showImprovementModal,
    setShowImprovementModal,
    handleApplyImprovementScenario,
    handleApplyRebalanceStrategy,
    handleApplyMobileRecommendation
  ]);

  const timeline = useMemo(() => ({
    timelineEvents,
    normalizedPhases,
    currentAgePhase,
    selectedYear,
    setSelectedYear,
    handleNodeDragStart,
    draggingInfo,
    setDraggingInfo,
    dragOccurredRef
  }), [
    timelineEvents,
    normalizedPhases,
    currentAgePhase,
    selectedYear,
    setSelectedYear,
    handleNodeDragStart,
    draggingInfo,
    setDraggingInfo,
    dragOccurredRef
  ]);

  const uiState = useMemo(() => ({
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
    isMobile
  }), [
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
    isMobile
  ]);

  return isMobile ? (
    <MobileFireSimulatorView
      simulation={simulation}
      scenario={scenario}
      eventController={eventController}
      budgetController={budgetController}
      recommendationController={recommendationController}
      timeline={timeline}
      uiState={uiState}
    />
  ) : (
    <DesktopFireSimulatorView
      simulation={simulation}
      scenario={scenario}
      eventController={eventController}
      budgetController={budgetController}
      recommendationController={recommendationController}
      timeline={timeline}
      uiState={uiState}
    />
  );
}
