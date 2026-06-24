/* eslint-disable no-unused-vars, react-hooks/refs, react-hooks/exhaustive-deps */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { formatCurrency, formatCompactCurrency, getAssetLabel, isEditableEvent, formatYAxis, getOutcomeDetails, getEventIcon, getEventMarkerPosition, clampAgeValue, clampMoneyValue, clampPercentageValue } from './helpers';
import { getNormalizedPhases } from '../../fireCalculations';
import {
  MobileGoalSection,
  MobileTimelineSection,
  MobileChartSection,
  MobileActionSection,
  MobileSituationSection,
  MobileModalLayer,
  MobileSimulatorShell
} from './mobile';
import './MobileFireSimulator.css';

function calculateTicks(min, max, targetTickCount = 5) {
  if (min > max) {
    [min, max] = [max, min];
  }
  
  const finalMin = Math.min(0, min);
  const finalMax = Math.max(0, max);
  
  if (finalMin === finalMax) {
    return [0];
  }
  
  const range = finalMax - finalMin;
  let roughStep = range / (targetTickCount - 1);
  
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / Math.pow(10, exponent);
  
  let cleanStep;
  if (fraction < 1.5) cleanStep = 1;
  else if (fraction < 3.5) cleanStep = 2;
  else if (fraction < 7.5) cleanStep = 5;
  else cleanStep = 10;
  
  const step = cleanStep * Math.pow(10, exponent);
  
  const ticks = [0];
  
  // Go up from 0
  let current = step;
  while (ticks[ticks.length - 1] < finalMax - 1e-9) {
    ticks.push(current);
    current += step;
  }
  
  // Go down from 0
  current = -step;
  while (ticks[0] > finalMin + 1e-9) {
    ticks.unshift(current);
    current -= step;
  }
  
  return ticks;
}


export function MobileRecommendationsPanel({
  improvementPlan,
  handleApplyMobileRecommendation,
  targetRetirementAge,
  showHeader = true
}) {
  const rankedPlan = improvementPlan?.rankedPlan || [];

  if (rankedPlan.length === 0) return null;

  return (
    <div className="mobile-rec-container" style={{ marginTop: showHeader ? '1rem' : '0', padding: '0' }}>
      {showHeader && (
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', textAlign: 'left' }}>
          💡 Actionable Recommendations
        </h3>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rankedPlan.map((scenario, idx) => {
          const badgeColor = scenario.savingsFocus === 'Earn More' ? '#10b981' : scenario.savingsFocus === 'Save More' ? '#0ea5e9' : '#f59e0b';
          const badgeBg = scenario.savingsFocus === 'Earn More' ? 'rgba(16, 185, 129, 0.12)' : scenario.savingsFocus === 'Save More' ? 'rgba(14, 165, 233, 0.12)' : 'rgba(245, 158, 11, 0.12)';
          
          return (
            <div className="mobile-rec-card" key={scenario.type || idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
              <div className="mobile-rec-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 className="mobile-rec-card-title" style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {scenario.icon} {scenario.title}
                </h5>
                <span 
                  className="mobile-rec-focus-badge"
                  style={{ color: badgeColor, backgroundColor: badgeBg }}
                >
                  {scenario.savingsFocus}
                </span>
              </div>
              
              <p className="mobile-rec-details">
                {scenario.details}
              </p>

              {scenario.bulletPoints && scenario.bulletPoints.length > 0 && (
                <ul className="mobile-rec-bullets" style={{ textAlign: 'left' }}>
                  {scenario.bulletPoints.map((bp, bIdx) => (
                    <li key={bIdx}>{bp}</li>
                  ))}
                </ul>
              )}

              <div className="mobile-rec-kpis">
                <div>
                  <span className="mobile-rec-kpi-lbl">New Ready Age</span>
                  <strong className="mobile-rec-kpi-val" style={{ color: scenario.readyAge <= (targetRetirementAge || 65) ? 'var(--accent-emerald, #10b981)' : 'var(--accent-orange, #f59e0b)' }}>
                    Age {scenario.readyAge}
                  </strong>
                </div>
                <div>
                  <span className="mobile-rec-kpi-lbl">Effort / Difficulty</span>
                  <strong className="mobile-rec-kpi-val">
                    {scenario.savingsEffortScore === 1 ? '⚡ Low' : scenario.savingsEffortScore === 2 ? '⚡⚡ Medium' : '⚡⚡⚡ High'}
                  </strong>
                </div>
              </div>

              {!scenario.isInfoOnly && (
                <button 
                  type="button"
                  className="mobile-rec-apply-btn"
                  onClick={() => {
                    handleApplyMobileRecommendation(scenario);
                  }}
                >
                  Apply Recommendation
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



/**
 * @param {Object} props
 * @param {import('../FireSimulator').SimulationViewModel} props.simulation
 * @param {import('../FireSimulator').ScenarioModel} props.scenario
 * @param {import('../FireSimulator').EventController} props.eventController
 * @param {import('../FireSimulator').BudgetController} props.budgetController
 * @param {import('../FireSimulator').RecommendationController} props.recommendationController
 * @param {import('../FireSimulator').TimelineViewModel} props.timeline
 * @param {import('../FireSimulator').UiState} props.uiState
 */
export default function MobileFireSimulatorView({
  simulation,
  scenario,
  eventController,
  budgetController,
  recommendationController,
  timeline,
  uiState,
  
  // Legacy support for direct mounts in unit/UI tests:
  activeResults: legacyActiveResults,
  baselineResults: legacyBaselineResults,
  displayedResults: legacyDisplayedResults,
  displayedBaselineResults: legacyDisplayedBaselineResults,
  chartData: legacyChartData,
  baselineChartData: legacyBaselineChartData,
  validation: legacyValidation,
  totalNetWorth: legacyTotalNetWorth,
  todayAssets: legacyTodayAssets,
  todayDebt: legacyTodayDebt,
  todayNetWorth: legacyTodayNetWorth,
  tempSocialSecurityDetails: legacyTempSS,

  inputs: legacyInputs,
  updateInput: legacyUpdateInput,
  updateAsset: legacyUpdateAsset,
  handleStep1Change: legacyHandleStep1Change,
  getInputsWithEvent: legacyGetInputsWithEvent,

  editingEvent: legacyEditingEvent,
  setEditingEvent: legacySetEditingEvent,
  handleCreateEvent: legacyHandleCreateEvent,
  handleEditRoadmapEvent: legacyHandleEditRoadmapEvent,
  handleSaveEvent: legacySaveEvent,
  handleDeleteEvent: legacyDeleteEvent,
  handleDeleteRoadmapEvent: legacyHandleDeleteRoadmapEvent,
  childImpactSummary: legacyChildImpactSummary,
  setChildImpactSummary: legacySetChildImpactSummary,
  houseImpactSummary: legacyHouseImpactSummary,
  setHouseImpactSummary: legacySetHouseImpactSummary,
  houseRebalanceSummary: legacyHouseRebalanceSummary,
  setHouseRebalanceSummary: legacySetHouseRebalanceSummary,
  isFullPartnerProfileOpen: legacyIsFullPartnerOpen,
  setIsFullPartnerProfileOpen: legacySetIsFullPartnerOpen,
  isZeroSpendingConfirmed: legacyIsZeroSpending,
  setIsZeroSpendingConfirmed: legacySetIsZeroSpending,
  isPartnerZeroSpendingConfirmed: legacyIsPartnerZeroSpending,
  setIsPartnerZeroSpendingConfirmed: legacySetIsPartnerZeroSpending,

  isBudgetModalOpen: legacyIsBudgetModalOpen,
  setIsBudgetModalOpen: legacySetIsBudgetModalOpen,
  activeBudgetPhase: legacyActiveBudgetPhase,
  handleSwitchBudgetPhase: legacyHandleSwitchBudgetPhase,
  savingsAllocMode: legacySavingsAllocMode,
  handleToggleSavingsAllocMode: legacyHandleToggleSavingsAllocMode,
  budgetScalingMode: legacyBudgetScalingMode,
  handleToggleBudgetScalingMode: legacyHandleToggleBudgetScalingMode,
  budgetSavings: legacyBudgetSavings,
  setBudgetSavings: legacySetBudgetSavings,
  budgetPartnerSavings: legacyBudgetPartnerSavings,
  setBudgetPartnerSavings: legacySetBudgetPartnerSavings,
  budgetExpenses: legacyBudgetExpenses,
  setBudgetExpenses: legacySetBudgetExpenses,
  budgetMonthlyIncome: legacyBudgetMonthlyIncome,
  setBudgetMonthlyIncome: legacySetBudgetMonthlyIncome,
  budgetMonthlySpending: legacyBudgetMonthlySpending,
  setBudgetMonthlySpending: legacySetBudgetMonthlySpending,
  budgetMonthlySavings: legacyBudgetMonthlySavings,
  setBudgetMonthlySavings: legacySetBudgetMonthlySavings,
  pendingImprovement: legacyPendingImprovement,
  setPendingImprovement: legacySetPendingImprovement,
  budgetDiffs: legacyBudgetDiffs,
  setBudgetDiffs: legacySetBudgetDiffs,
  handleSetBudgetClick: legacyHandleSetBudgetClick,
  handleCloseBudgetModal: legacyHandleCloseBudgetModal,
  handleSaveBudget: legacyHandleSaveBudget,
  isBudgetOpenFromMarriageWizard: legacyIsBudgetOpenFromMarriageWizard,
  setIsBudgetOpenFromMarriageWizard: legacySetIsBudgetOpenFromMarriageWizard,
  isSavingsDetailsOpen: legacyIsSavingsDetailsOpen,
  setIsSavingsDetailsOpen: legacySetIsSavingsDetailsOpen,
  savingsDetails: legacySavingsDetails,
  setSavingsDetails: legacySetSavingsDetails,
  handleOpenSavingsDetails: legacyHandleOpenSavingsDetails,
  handleSaveSavingsDetails: legacyHandleSaveSavingsDetails,
  lastNonZeroSavingsRateRef: legacyLastNonZeroSavingsRateRef,
  budgetHsaCoverage: legacyBudgetHsaCoverage,
  setBudgetHsaCoverage: legacySetBudgetHsaCoverage,
  budgetFilingStatus: legacyBudgetFilingStatus,
  setBudgetFilingStatus: legacySetBudgetFilingStatus,

  improvementPlan: legacyImprovementPlan,
  showImprovementModal: legacyShowImprovementModal,
  setShowImprovementModal: legacySetShowImprovementModal,
  handleApplyImprovementScenario: legacyHandleApplyImprovementScenario,
  handleApplyRebalanceStrategy: legacyHandleApplyRebalanceStrategy,
  handleApplyMobileRecommendation: legacyHandleApplyMobileRecommendation,

  timelineEvents: legacyTimelineEvents,
  normalizedPhases: legacyNormalizedPhases,
  currentAgePhase: legacyCurrentAgePhase,
  selectedYear: legacySelectedYear,
  setSelectedYear: legacySetSelectedYear,
  handleNodeDragStart: legacyHandleNodeDragStart,
  draggingInfo: legacyDraggingInfo,
  setDraggingInfo: legacySetDraggingInfo,
  dragOccurredRef: legacyDragOccurredRef,

  activeStep: legacyActiveStep,
  setActiveStep: legacySetActiveStep,
  displayMode: legacyDisplayMode,
  setDisplayMode: legacySetDisplayMode,
  editingCondition: legacyEditingCondition,
  setEditingCondition: legacySetEditingCondition,
  handleSaveCurrentCondition: legacyHandleSaveCurrentCondition,
  handleRemoveCurrentCondition: legacyHandleRemoveCurrentCondition,
  notification: legacyNotification,
  setNotification: legacySetNotification,
  isMobile: legacyIsMobile
}) {
  const activeResults = simulation?.activeResults ?? legacyActiveResults;
  const baselineResults = simulation?.baselineResults ?? legacyBaselineResults;
  const displayedResults = simulation?.displayedResults ?? legacyDisplayedResults;
  const displayedBaselineResults = simulation?.displayedBaselineResults ?? legacyDisplayedBaselineResults;
  const chartData = simulation?.chartData ?? legacyChartData;
  const baselineChartData = simulation?.baselineChartData ?? legacyBaselineChartData;
  const validation = simulation?.validation ?? legacyValidation;
  const totalNetWorth = simulation?.totalNetWorth ?? legacyTotalNetWorth;
  const todayAssets = simulation?.todayAssets ?? legacyTodayAssets;
  const todayDebt = simulation?.todayDebt ?? legacyTodayDebt;
  const todayNetWorth = simulation?.todayNetWorth ?? legacyTodayNetWorth;
  const tempSocialSecurityDetails = simulation?.tempSocialSecurityDetails ?? legacyTempSS;

  const ticks = useMemo(() => {
    let min = 0;
    let max = 100000;
    if (chartData && chartData.length) {
      chartData.forEach((row) => {
        if (row.netWorth !== undefined) {
          if (row.netWorth < min) min = row.netWorth;
          if (row.netWorth > max) max = row.netWorth;
        }
        if (row.assets !== undefined) {
          if (row.assets < min) min = row.assets;
          if (row.assets > max) max = row.assets;
        }
        if (row.debt !== undefined) {
          if (row.debt < min) min = row.debt;
          if (row.debt > max) max = row.debt;
        }
      });
    }
    const range = max - min;
    const padding = range * 0.12;
    const finalMin = min < 0 ? min - padding : 0;
    const finalMax = max + padding;
    return calculateTicks(finalMin, finalMax);
  }, [chartData]);

  const inputs = scenario?.inputs ?? legacyInputs;
  const updateInput = scenario?.updateInput ?? legacyUpdateInput;
  const updateAsset = scenario?.updateAsset ?? legacyUpdateAsset;
  const handleStep1Change = scenario?.handleStep1Change ?? legacyHandleStep1Change;
  const getInputsWithEvent = scenario?.getInputsWithEvent ?? legacyGetInputsWithEvent;

  const editingEvent = eventController?.editingEvent ?? legacyEditingEvent;
  const setEditingEvent = eventController?.setEditingEvent ?? legacySetEditingEvent;
  const handleCreateEvent = eventController?.handleCreateEvent ?? legacyHandleCreateEvent;
  const handleEditRoadmapEvent = eventController?.handleEditRoadmapEvent ?? legacyHandleEditRoadmapEvent;
  const handleSaveEvent = eventController?.handleSaveEvent ?? legacySaveEvent;
  const handleDeleteEvent = eventController?.handleDeleteEvent ?? legacyDeleteEvent;
  const handleDeleteRoadmapEvent = eventController?.handleDeleteRoadmapEvent ?? legacyHandleDeleteRoadmapEvent;
  const childImpactSummary = eventController?.childImpactSummary ?? legacyChildImpactSummary;
  const setChildImpactSummary = eventController?.setChildImpactSummary ?? legacySetChildImpactSummary;
  const houseImpactSummary = eventController?.houseImpactSummary ?? legacyHouseImpactSummary;
  const setHouseImpactSummary = eventController?.setHouseImpactSummary ?? legacySetHouseImpactSummary;
  const houseRebalanceSummary = eventController?.houseRebalanceSummary ?? legacyHouseRebalanceSummary;
  const setHouseRebalanceSummary = eventController?.setHouseRebalanceSummary ?? legacySetHouseRebalanceSummary;
  const isFullPartnerProfileOpen = eventController?.isFullPartnerProfileOpen ?? legacyIsFullPartnerOpen;
  const setIsFullPartnerProfileOpen = eventController?.setIsFullPartnerProfileOpen ?? legacySetIsFullPartnerOpen;
  const isZeroSpendingConfirmed = eventController?.isZeroSpendingConfirmed ?? legacyIsZeroSpending;
  const setIsZeroSpendingConfirmed = eventController?.setIsZeroSpendingConfirmed ?? legacySetIsZeroSpending;
  const isPartnerZeroSpendingConfirmed = eventController?.isPartnerZeroSpendingConfirmed ?? legacyIsPartnerZeroSpending;
  const setIsPartnerZeroSpendingConfirmed = eventController?.setIsPartnerZeroSpendingConfirmed ?? legacySetIsPartnerZeroSpending;

  const isBudgetModalOpen = budgetController?.isBudgetModalOpen ?? legacyIsBudgetModalOpen;
  const setIsBudgetModalOpen = budgetController?.setIsBudgetModalOpen ?? legacySetIsBudgetModalOpen;
  const activeBudgetPhase = budgetController?.activeBudgetPhase ?? legacyActiveBudgetPhase;
  const handleSwitchBudgetPhase = budgetController?.handleSwitchBudgetPhase ?? legacyHandleSwitchBudgetPhase;
  const savingsAllocMode = budgetController?.savingsAllocMode ?? legacySavingsAllocMode;
  const handleToggleSavingsAllocMode = budgetController?.handleToggleSavingsAllocMode ?? legacyHandleToggleSavingsAllocMode;
  const budgetScalingMode = budgetController?.budgetScalingMode ?? legacyBudgetScalingMode;
  const handleToggleBudgetScalingMode = budgetController?.handleToggleBudgetScalingMode ?? legacyHandleToggleBudgetScalingMode;
  const budgetSavings = budgetController?.budgetSavings ?? legacyBudgetSavings;
  const setBudgetSavings = budgetController?.setBudgetSavings ?? legacySetBudgetSavings;
  const budgetPartnerSavings = budgetController?.budgetPartnerSavings ?? legacyBudgetPartnerSavings;
  const setBudgetPartnerSavings = budgetController?.setBudgetPartnerSavings ?? legacySetBudgetPartnerSavings;
  const budgetExpenses = budgetController?.budgetExpenses ?? legacyBudgetExpenses;
  const setBudgetExpenses = budgetController?.setBudgetExpenses ?? legacySetBudgetExpenses;
  const budgetMonthlyIncome = budgetController?.budgetMonthlyIncome ?? legacyBudgetMonthlyIncome;
  const setBudgetMonthlyIncome = budgetController?.setBudgetMonthlyIncome ?? legacySetBudgetMonthlyIncome;
  const budgetMonthlySpending = budgetController?.budgetMonthlySpending ?? legacyBudgetMonthlySpending;
  const setBudgetMonthlySpending = budgetController?.setBudgetMonthlySpending ?? legacySetBudgetMonthlySpending;
  const budgetMonthlySavings = budgetController?.budgetMonthlySavings ?? legacyBudgetMonthlySavings;
  const setBudgetMonthlySavings = budgetController?.setBudgetMonthlySavings ?? legacySetBudgetMonthlySavings;
  const pendingImprovement = budgetController?.pendingImprovement ?? legacyPendingImprovement;
  const setPendingImprovement = budgetController?.setPendingImprovement ?? legacySetPendingImprovement;
  const budgetDiffs = budgetController?.budgetDiffs ?? legacyBudgetDiffs;
  const setBudgetDiffs = budgetController?.setBudgetDiffs ?? legacySetBudgetDiffs;
  const handleSetBudgetClick = budgetController?.handleSetBudgetClick ?? legacyHandleSetBudgetClick;
  const handleCloseBudgetModal = budgetController?.handleCloseBudgetModal ?? legacyHandleCloseBudgetModal;
  const handleSaveBudget = budgetController?.handleSaveBudget ?? legacyHandleSaveBudget;
  const isBudgetOpenFromMarriageWizard = budgetController?.isBudgetOpenFromMarriageWizard ?? legacyIsBudgetOpenFromMarriageWizard;
  const setIsBudgetOpenFromMarriageWizard = budgetController?.setIsBudgetOpenFromMarriageWizard ?? legacySetIsBudgetOpenFromMarriageWizard;
  const isSavingsDetailsOpen = budgetController?.isSavingsDetailsOpen ?? legacyIsSavingsDetailsOpen;
  const setIsSavingsDetailsOpen = budgetController?.setIsSavingsDetailsOpen ?? legacySetIsSavingsDetailsOpen;
  const savingsDetails = budgetController?.savingsDetails ?? legacySavingsDetails;
  const setSavingsDetails = budgetController?.setSavingsDetails ?? legacySetSavingsDetails;
  const handleOpenSavingsDetails = budgetController?.handleOpenSavingsDetails ?? legacyHandleOpenSavingsDetails;
  const handleSaveSavingsDetails = budgetController?.handleSaveSavingsDetails ?? legacyHandleSaveSavingsDetails;
  const lastNonZeroSavingsRateRef = budgetController?.lastNonZeroSavingsRateRef ?? legacyLastNonZeroSavingsRateRef;
  const budgetHsaCoverage = budgetController?.budgetHsaCoverage ?? legacyBudgetHsaCoverage;
  const setBudgetHsaCoverage = budgetController?.setBudgetHsaCoverage ?? legacySetBudgetHsaCoverage;
  const budgetFilingStatus = budgetController?.budgetFilingStatus ?? legacyBudgetFilingStatus;
  const setBudgetFilingStatus = budgetController?.setBudgetFilingStatus ?? legacySetBudgetFilingStatus;

  const improvementPlan = recommendationController?.improvementPlan ?? legacyImprovementPlan;
  const showImprovementModal = recommendationController?.showImprovementModal ?? legacyShowImprovementModal;
  const setShowImprovementModal = recommendationController?.setShowImprovementModal ?? legacySetShowImprovementModal;
  const handleApplyImprovementScenario = recommendationController?.handleApplyImprovementScenario ?? legacyHandleApplyImprovementScenario;
  const handleApplyRebalanceStrategy = recommendationController?.handleApplyRebalanceStrategy ?? legacyHandleApplyRebalanceStrategy;
  const handleApplyMobileRecommendation = recommendationController?.handleApplyMobileRecommendation ?? legacyHandleApplyMobileRecommendation;

  const timelineEvents = timeline?.timelineEvents ?? legacyTimelineEvents;
  const normalizedPhases = timeline?.normalizedPhases ?? legacyNormalizedPhases ?? (inputs ? getNormalizedPhases(inputs) : []);
  const currentAgePhase = timeline?.currentAgePhase ?? legacyCurrentAgePhase ?? (inputs && normalizedPhases.length > 0 ? (normalizedPhases.find(p => (inputs.currentAge || 35) >= p.startAge && (inputs.currentAge || 35) < p.endAge) || normalizedPhases[0] || null) : null);
  const selectedYear = timeline?.selectedYear ?? legacySelectedYear;
  const setSelectedYear = timeline?.setSelectedYear ?? legacySetSelectedYear;
  const handleNodeDragStart = timeline?.handleNodeDragStart ?? legacyHandleNodeDragStart;
  const draggingInfo = timeline?.draggingInfo ?? legacyDraggingInfo;
  const setDraggingInfo = timeline?.setDraggingInfo ?? legacySetDraggingInfo;
  const dragOccurredRef = timeline?.dragOccurredRef ?? legacyDragOccurredRef;

  const activeStep = uiState?.activeStep ?? legacyActiveStep;
  const setActiveStep = uiState?.setActiveStep ?? legacySetActiveStep;
  const displayMode = uiState?.displayMode ?? legacyDisplayMode;
  const setDisplayMode = uiState?.setDisplayMode ?? legacySetDisplayMode;
  const editingCondition = uiState?.editingCondition ?? legacyEditingCondition;
  const setEditingCondition = uiState?.setEditingCondition ?? legacySetEditingCondition;
  const handleSaveCurrentCondition = uiState?.handleSaveCurrentCondition ?? legacyHandleSaveCurrentCondition;
  const handleRemoveCurrentCondition = uiState?.handleRemoveCurrentCondition ?? legacyHandleRemoveCurrentCondition;
  const notification = uiState?.notification ?? legacyNotification;
  const setNotification = uiState?.setNotification ?? legacySetNotification;
  const isMobile = uiState?.isMobile ?? legacyIsMobile;
  const [activeTab, setActiveTab] = useState('Plan'); // 'Plan' | 'Results' | 'Details'
  const [goalAgeInput, setGoalAgeInput] = useState(String(inputs.targetRetirementAge || 65));
  useEffect(() => {
    setGoalAgeInput(String(inputs.targetRetirementAge || 65));
  }, [inputs.targetRetirementAge]);

  const commitGoalAge = (valStr) => {
    let parsed = parseInt(valStr, 10);
    if (isNaN(parsed)) {
      parsed = 65;
    }
    const currentAge = Number(inputs.currentAge) || 35;
    const lifeExpectancy = Number(inputs.lifeExpectancy) || 85;
    const finalVal = Math.min(lifeExpectancy, Math.max(currentAge, parsed));
    setGoalAgeInput(String(finalVal));

    if (finalVal !== inputs.targetRetirementAge) {
      const retirementEvent = timelineEvents.find(e => e.type === 'retire');
      if (timeline?.commitEventAgeChange) {
        timeline.commitEventAgeChange(retirementEvent || { type: 'retire' }, finalVal);
      } else {
        updateInput('targetRetirementAge', finalVal);
      }
    }
  };

  const handleTapGoalAge = () => {
    const retirementEvent = timelineEvents.find(e => e.type === 'retire');
    if (retirementEvent) {
      handleEditRoadmapEvent(retirementEvent);
    } else {
      handleCreateEvent('retire');
    }
  };

  const [selectedMobilePhaseId, setSelectedMobilePhaseId] = useState(null);

  const [isLifeProfileOpen, setIsLifeProfileOpen] = useState(false);
  const [lifeProfileTab, setLifeProfileTab] = useState('timeline');
  const [savingsRateOverride, setSavingsRateOverride] = useState(null);
  const [activeSavingsRate, setActiveSavingsRate] = useState(null);
  const [isCurrentSituationExpanded, setIsCurrentSituationExpanded] = useState(true);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);
  const [isOutcomePreviewExpanded, setIsOutcomePreviewExpanded] = useState(true);

  const chartContainerRef = useRef(null);
  const [activeTooltipCoord, setActiveTooltipCoord] = useState(null);

  const tooltipPos = useMemo(() => {
    if (!activeTooltipCoord || !chartContainerRef.current) return undefined;

    const anchorX = activeTooltipCoord.x;
    const anchorY = activeTooltipCoord.y;

    const markerRadius = 13.5;
    const glowBlurRadius = 3;
    const EVENT_CLEARANCE = 24;

    const VISUAL_MARKER_RADIUS = markerRadius + glowBlurRadius;
    let tooltipX = anchorX + VISUAL_MARKER_RADIUS + EVENT_CLEARANCE;

    const chartWidth = chartContainerRef.current.clientWidth;
    const tooltipWidth = 150;
    tooltipX = Math.min(tooltipX, chartWidth - tooltipWidth - 12);

    const tooltipY = anchorY - 50;

    return { x: tooltipX, y: tooltipY };
  }, [activeTooltipCoord]);

  const hasUserEvents = useMemo(() => {
    const list = timelineEvents || [];
    const excludedTypes = [
      'today',
      'lifeExpectancy',
      'socialSecurity',
      'retire',
      'medicareEligibility',
      'retirementReadySurvival',
      'retirementReadyComfortable',
      'retirementReadySWR',
      'coastFire'
    ];
    return list.some(e => !excludedTypes.includes(e.type));
  }, [timelineEvents]);
  const [whyPhaseExistsOpen, setWhyPhaseExistsOpen] = useState(true);
  const [activeChart, setActiveChart] = useState('netWorth'); // 'netWorth' | 'assetsDebt' | 'progress' | 'incomeSpending'
  const selectedEventId = eventController?.selectedEventId;
  const setSelectedEventId = eventController?.setSelectedEventId;

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return timelineEvents[0] || null;
    const match = timelineEvents?.find(evt => 
      (evt.originalId && String(evt.originalId) === String(selectedEventId)) ||
      (!evt.originalId && evt.id && String(evt.id) === String(selectedEventId)) ||
      (!evt.originalId && evt.type === 'retire' && selectedEventId === 'retire')
    );
    if (match && match.originalId) {
      const existsInLifeEvents = inputs.lifeEvents?.some(e => String(e.id) === String(match.originalId));
      const existsInSpendingPhases = inputs.spendingPhases?.some(p => String(p.id) === String(match.originalId));
      const existsInIncomeList = inputs.incomeList?.some(i => String(i.id) === String(match.originalId));
      if (!existsInLifeEvents && !existsInSpendingPhases && !existsInIncomeList) return timelineEvents[0] || null;
    }
    return match || timelineEvents[0] || null;
  }, [selectedEventId, timelineEvents, inputs.lifeEvents]);

  const selectedEventIndex = useMemo(() => {
    if (!selectedEvent) return 0;
    const idx = timelineEvents.findIndex(evt => evt === selectedEvent);
    return idx >= 0 ? idx : 0;
  }, [selectedEvent, timelineEvents]);

  const setSelectedEventIndex = (idx) => {
    const evt = timelineEvents[idx];
    if (evt) {
      const id = evt.originalId || evt.id || (evt.type === 'retire' ? 'retire' : null);
      setSelectedEventId?.(id);
      eventController?.setSelectedEvent?.(evt);
    } else {
      setSelectedEventId?.(null);
      eventController?.setSelectedEvent?.(null);
    }
  };

  const [activeEventForSheet, setActiveEventForSheet] = useState(null);
  const [expandedClusterEvents, setExpandedClusterEvents] = useState(null);
  const [isMobileLedgerExpanded, setIsMobileLedgerExpanded] = useState(false);
  const [expandedPhaseId, setExpandedPhaseId] = useState(null);



  // Align event ages to closest discrete integer age point in chartData to lookup Net Worth coordinate
  const referenceDotsData = useMemo(() => {
    if (!timelineEvents || !chartData || chartData.length === 0) return [];
    
    return timelineEvents.map((evt, idx) => {
      let closestPoint = chartData[0];
      let minDiff = Infinity;
      chartData.forEach(d => {
        const diff = Math.abs(d.age - evt.age);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = d;
        }
      });
      
      const netWorthVal = closestPoint ? (closestPoint.netWorth ?? 0) : 0;
      
      return {
        event: evt,
        x: closestPoint.age,
        y: netWorthVal,
        key: evt.originalId || `${evt.type}-${evt.age}-${idx}`,
        index: idx
      };
    });
  }, [timelineEvents, chartData]);

  // Sync scroll positions
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab, selectedMobilePhaseId]);



  // Selected Phase Object for detail screen
  const selectedPhaseObj = useMemo(() => {
    if (!selectedMobilePhaseId) return null;
    return normalizedPhases.find(p => p.id === selectedMobilePhaseId) || null;
  }, [normalizedPhases, selectedMobilePhaseId]);

  // Previous Phase to calculate changes
  const prevPhaseObj = useMemo(() => {
    if (!selectedPhaseObj) return null;
    const index = normalizedPhases.findIndex(p => p.id === selectedPhaseObj.id);
    if (index <= 0) return null;
    return normalizedPhases[index - 1];
  }, [normalizedPhases, selectedPhaseObj]);

  // Next upcoming milestone event
  const upcomingEvent = useMemo(() => {
    const events = inputs.lifeEvents || [];
    const curAge = inputs.currentAge || 35;
    let nextEv = null;
    let minDiff = Infinity;

    events.forEach(e => {
      if (!e.enabled) return;
      const eventAge = e.type === 'haveChild' ? Number(e.birthAge)
        : e.type === 'buyHouse' ? Number(e.purchaseAge)
        : e.type === 'marriage' ? Number(e.marriageAge || e.age || e.startAge)
        : e.type === 'socialSecurity' ? Number(e.claimingAge)
        : e.type === 'retire' ? Number(e.age)
        : Number(e.age || e.startAge || e.purchaseAge || e.birthAge || e.claimingAge || e.ageReceived);

      if (eventAge && eventAge > curAge) {
        const diff = eventAge - curAge;
        if (diff < minDiff) {
          minDiff = diff;
          nextEv = { ...e, eventAge, diff };
        }
      }
    });
    return nextEv;
  }, [inputs.lifeEvents, inputs.currentAge]);

  // Helper to generate phase driver description
  const getPhaseDriverDesc = (p, index) => {
    if (p.label?.toLowerCase().includes('retirement') || p.icon === '🏖️' || p.icon === '🏖') {
      return 'Portfolio withdrawals begin';
    }
    if (p.label?.toLowerCase().includes('child') || p.icon === '👶') {
      return 'Increased spending for child support and activities';
    }
    if (index > 0 && (normalizedPhases[index - 1].label?.toLowerCase().includes('child') || normalizedPhases[index - 1].icon === '👶')) {
      return 'Childcare expenses ended';
    }
    return 'Standard working budget';
  };

  // Helper to generate phase tags
  const getPhaseTags = (p) => {
    const tags = [];
    if (p.label?.toLowerCase().includes('retirement') || p.icon === '🏖️' || p.icon === '🏖') {
      tags.push({ text: 'Stopped Working', color: 'green' });
      if (p.startAge >= 65 || p.endAge > 65) {
        tags.push({ text: 'Medicare', color: 'blue' });
      }
    } else {
      if (p.label?.toLowerCase().includes('child') || p.icon === '👶') {
        tags.push({ text: 'Child Support', color: 'orange' });
      }
      tags.push({ text: 'Working', color: 'purple' });
    }
    if (p.isMarried) {
      tags.push({ text: 'Married', color: 'blue' });
    }
    return tags;
  };

  // Helper for phase-specific why exists reasons
  const getWhyPhaseExistsItems = (p, prevP) => {
    const items = [];
    if (!p) return items;
    
    const isRetirement = p.label?.toLowerCase().includes('retirement') || p.icon === '🏖️' || p.icon === '🏖';
    
    if (isRetirement) {
      items.push({ label: 'Stopped Working', value: 'Income reduced', isPositive: false });
      const ssEvent = inputs.lifeEvents?.find(e => e.type === 'socialSecurity' && e.enabled);
      if (ssEvent) {
        const claimingAge = Number(ssEvent.claimingAge || 67);
        const monthly = Number(ssEvent.monthlyBenefit) || 0;
        if (p.startAge >= claimingAge || (p.startAge < claimingAge && p.endAge > claimingAge)) {
          items.push({ label: `Social Security (start age ${claimingAge})`, value: `+$${monthly.toLocaleString()}/mo (est.)`, isPositive: true });
        }
      }
      items.push({ label: 'Investment withdrawals', value: 'Cover remaining expenses', isPositive: true });
      return items;
    }

    const ccNow = Number(p.expenses?.childcare) || 0;
    const ccPrev = Number(prevP?.expenses?.childcare) || 0;
    const ccDiff = ccNow - ccPrev;
    if (ccDiff !== 0) {
      if (ccDiff > 0) {
        items.push({ label: 'Childcare & support', value: `+$${ccDiff.toLocaleString()}/yr`, isPositive: true });
        items.push({ label: 'Child activities, food, clothing', value: '+$2,400/yr', isPositive: true });
      } else {
        items.push({ label: 'Childcare ended', value: `-$${Math.abs(ccDiff).toLocaleString()}/yr`, isPositive: false });
        items.push({ label: 'Child activities & support ended', value: '-$2,400/yr', isPositive: false });
      }
    }

    // Debt payoff or additions
    const debtNow = (p.activeDebts || []).reduce((sum, d) => sum + (Number(p.expenses?.[`debt_${d.id}`]) || d.monthlyPayment || 0), 0) * 12;
    const debtPrev = (prevP?.activeDebts || []).reduce((sum, d) => sum + (Number(prevP?.expenses?.[`debt_${d.id}`]) || d.monthlyPayment || 0), 0) * 12;
    const debtDiff = debtNow - debtPrev;
    if (debtDiff !== 0) {
      if (debtDiff > 0) {
        items.push({ label: 'Debt service payments', value: `+$${debtDiff.toLocaleString()}/yr`, isPositive: true });
      } else {
        items.push({ label: 'Debt payoff / ended', value: `-$${Math.abs(debtDiff).toLocaleString()}/yr`, isPositive: false });
      }
    }

    // General lifestyle expenses
    const sumStandardExpenses = (phase) => {
      if (!phase?.expenses) return 0;
      return (
        (Number(phase.expenses.housing) || 0) +
        (Number(phase.expenses.utilities) || 0) +
        (Number(phase.expenses.food) || 0) +
        (Number(phase.expenses.transportation) || 0) +
        (Number(phase.expenses.healthcare) || 0) +
        (Number(phase.expenses.leisure) || 0) +
        (Number(phase.expenses.diningOut) || 0) +
        (Number(phase.expenses.misc) || 0)
      ) * 12;
    };
    const stdNow = sumStandardExpenses(p);
    const stdPrev = sumStandardExpenses(prevP);
    const stdDiff = stdNow - stdPrev;
    if (stdDiff !== 0 && items.length === 0) {
      if (stdDiff > 0) {
        items.push({ label: 'Lifestyle expenses', value: `+$${stdDiff.toLocaleString()}/yr`, isPositive: true });
      } else {
        items.push({ label: 'Lifestyle expenses reduced', value: `-$${Math.abs(stdDiff).toLocaleString()}/yr`, isPositive: false });
      }
    }

    // Net Change calculation
    let netChange = ccDiff;
    if (ccDiff > 0) netChange += 2400;
    else if (ccDiff < 0) netChange -= 2400;
    netChange += debtDiff + stdDiff;

    if (netChange !== 0) {
      items.push({ 
        label: 'Net change vs previous phase', 
        value: `${netChange > 0 ? '+' : '-'}$${Math.abs(netChange).toLocaleString()}/yr`, 
        isNetChange: true,
        isPositive: netChange > 0 
      });
    }

    return items;
  };

  // Helper to change asset values instantly
  const handleAssetChange = (key, val) => {
    const updatedAssets = {
      ...inputs.assets,
      [key]: Math.max(0, parseFloat(val) || 0)
    };
    updateInput('assets', updatedAssets);
    
    // Also update simpleInvestments total
    const total = Object.values(updatedAssets).reduce((sum, val) => sum + val, 0);
    updateInput('simpleInvestments', total);
  };

  const isPlanOnTrack = activeResults.retirementOutcome === 'comfortable' || activeResults.retirementOutcome === 'sustainable';
  const isRetirementReadyDelayed = activeResults.retirementReadyAge > inputs.targetRetirementAge;
  const retirementReadyDifference = activeResults.retirementReadyAge - inputs.targetRetirementAge;

  return (
    <MobileSimulatorShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      editingEvent={editingEvent}
    >
      {activeTab === 'Plan' && (
        <>
          <MobileGoalSection
            inputs={inputs}
            goalAgeInput={goalAgeInput}
            setGoalAgeInput={setGoalAgeInput}
            handleTapGoalAge={handleTapGoalAge}
            commitGoalAge={commitGoalAge}
            activeResults={activeResults}
            isPlanOnTrack={isPlanOnTrack}
          />
          
          <MobileTimelineSection
            inputs={inputs}
            timelineEvents={timelineEvents}
            selectedEventIndex={selectedEventIndex}
            setSelectedEventIndex={setSelectedEventIndex}
            setActiveEventForSheet={setActiveEventForSheet}
            setLifeProfileTab={setLifeProfileTab}
            setIsLifeProfileOpen={setIsLifeProfileOpen}
            formatCurrency={formatCurrency}
          />

          <MobileChartSection
            chartData={chartData}
            timelineEvents={timelineEvents}
            selectedEventIndex={selectedEventIndex}
            inputs={inputs}
            ticks={ticks}
            chartContainerRef={chartContainerRef}
            setActiveTooltipCoord={setActiveTooltipCoord}
            tooltipPos={tooltipPos}
            formatCurrency={formatCurrency}
          />

          <MobileActionSection
            setEditingEvent={setEditingEvent}
            handleSetBudgetClick={handleSetBudgetClick}
            handleCreateEvent={eventController?.handleCreateEvent || legacyHandleCreateEvent}
          />
        </>
      )}

      <MobileSituationSection
        activeTab={activeTab}
        simulation={simulation}
        timeline={timeline}
        chartData={chartData}
        activeResults={activeResults}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        activeChart={activeChart}
        setActiveChart={setActiveChart}
        inputs={inputs}
        displayedResults={displayedResults}
        displayedBaselineResults={displayedBaselineResults}
        formatCurrency={formatCurrency}
        formatCompactCurrency={formatCompactCurrency}
        isMobileLedgerExpanded={isMobileLedgerExpanded}
        setIsMobileLedgerExpanded={setIsMobileLedgerExpanded}
        updateInput={updateInput}
        handleAssetChange={handleAssetChange}
        selectedMobilePhaseId={selectedMobilePhaseId}
        setSelectedMobilePhaseId={setSelectedMobilePhaseId}
        selectedPhaseObj={selectedPhaseObj}
        prevPhaseObj={prevPhaseObj}
        whyPhaseExistsOpen={whyPhaseExistsOpen}
        setWhyPhaseExistsOpen={setWhyPhaseExistsOpen}
        getWhyPhaseExistsItems={getWhyPhaseExistsItems}
        getPhaseTags={getPhaseTags}
        handleSetBudgetClick={handleSetBudgetClick}
        isPlanOnTrack={isPlanOnTrack}
      />

      <MobileModalLayer
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        uiState={uiState}
        budgetController={budgetController}
        recommendationController={recommendationController}
        inputs={inputs}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        handleSaveEvent={handleSaveEvent}
        handleDeleteEvent={handleDeleteEvent}
        getInputsWithEvent={getInputsWithEvent}
        baselineResults={baselineResults}
        handleApplyMobileRecommendation={handleApplyMobileRecommendation}
        improvementPlan={improvementPlan}
        houseImpactSummary={houseImpactSummary}
        setHouseImpactSummary={setHouseImpactSummary}
        houseRebalanceSummary={houseRebalanceSummary}
        setHouseRebalanceSummary={setHouseRebalanceSummary}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
        setShowImprovementModal={setShowImprovementModal}
        childImpactSummary={childImpactSummary}
        setChildImpactSummary={setChildImpactSummary}
        isBudgetModalOpen={isBudgetModalOpen}
        isBudgetOpenFromMarriageWizard={isBudgetOpenFromMarriageWizard}
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
        budgetScalingMode={budgetScalingMode}
        handleToggleBudgetScalingMode={handleToggleBudgetScalingMode}
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
        isSavingsDetailsOpen={isSavingsDetailsOpen}
        savingsDetails={savingsDetails}
        setSavingsDetails={setSavingsDetails}
        setIsSavingsDetailsOpen={setIsSavingsDetailsOpen}
        handleSaveSavingsDetails={handleSaveSavingsDetails}
        editingCondition={editingCondition}
        setEditingCondition={setEditingCondition}
        handleSaveCurrentCondition={handleSaveCurrentCondition}
        showImprovementModal={showImprovementModal}
        isLifeProfileOpen={isLifeProfileOpen}
        setIsLifeProfileOpen={setIsLifeProfileOpen}
        updateInput={updateInput}
        lifeProfileTab={lifeProfileTab}
        notification={notification}
        expandedClusterEvents={expandedClusterEvents}
        setExpandedClusterEvents={setExpandedClusterEvents}
        handleEditRoadmapEvent={handleEditRoadmapEvent}
        activeEventForSheet={activeEventForSheet}
        setActiveEventForSheet={setActiveEventForSheet}
        formatCurrency={formatCurrency}
        handleDeleteRoadmapEvent={handleDeleteRoadmapEvent}
      />
    </MobileSimulatorShell>
  );
}