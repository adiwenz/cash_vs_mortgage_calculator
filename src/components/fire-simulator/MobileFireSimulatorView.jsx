/* eslint-disable no-unused-vars, react-hooks/refs, react-hooks/exhaustive-deps */
import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Home, 
  Map, 
  TrendingUp, 
  Settings, 
  ChevronRight, 
  ArrowLeft, 
  Sparkles,
  Info,
  X,
  Trash2,
  Edit2
} from 'lucide-react';
import { formatCurrency, formatCompactCurrency, getAssetLabel, isEditableEvent, formatYAxis, getOutcomeDetails, getEventIcon, getEventMarkerPosition, clampAgeValue, clampMoneyValue, clampPercentageValue } from './helpers';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot } from 'recharts';
import { getNormalizedPhases } from '../../fireCalculations';
import MobileTimeline, { getRoadmapDetails } from './MobileTimeline';
import OutcomeHeroCard from './OutcomeHeroCard';
import { CurrencyInput, PercentInput, NumberInput } from '../ui/PlainInputs';
import RetireSoonerModal from './RetireSoonerModal';
import MobileResults from './MobileResults';
import MobileEventWizard from './MobileEventWizard';
import MobileChildPlanningModal from './MobileChildPlanningModal';
import MobileHousePlanningModal from './MobileHousePlanningModal';
import MobileMarriagePlanningModal from './MobileMarriagePlanningModal';
import MobileIncomeChangeModal from './MobileIncomeChangeModal';
import EventModalForm from './EventModalForm/EventModalForm';
import ChildImpactModal from './ChildImpactModal';
import BudgetModal from './BudgetModal';
import SavingsDetailsModal from './SavingsDetailsModal';
import { CurrentConditionModal } from './CurrentConditionsPanel';
import LifeProfileModal from './LifeProfileModal';
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


const getShortLabel = (evt) => {
  if (!evt) return '';
  if (evt.type === 'socialSecurity') return 'Social Sec.';
  if (evt.type === 'medicareEligibility') return 'Medicare';
  if (evt.type === 'retire') return 'Stop Working';
  if (evt.type === 'haveChild') {
    return evt.label.replace('Have Child:', '').trim() || 'Have Child';
  }
  if (evt.type === 'childSupportEnds') return 'Support Ends';
  if (evt.type === 'marriage') return 'Marriage';
  if (evt.type === 'buyHouse') return 'Buy Home';
  if (evt.type === 'sellHouse') return 'Sell Home';
  if (evt.type === 'mortgageOff') return 'Mortgage Ends';
  if (evt.type === 'college') return 'College';
  if (evt.type === 'sabbatical') return 'Sabbatical';
  if (evt.type === 'career') return 'Career';
  if (evt.type === 'lifestyle') return 'Lifestyle';
  if (evt.type === 'windfall') return 'Windfall';
  if (evt.type === 'assetTransfer') return 'Transfer';
  if (evt.type === 'borrowing') return 'Borrowing';
  if (evt.type === 'payoffPlanEnd') return 'Loan Off';
  if (evt.type === 'coastFire') return 'Coast FIRE';
  if (evt.type.startsWith('retirementReady')) return 'Can Stop Working';
  
  let cleanLabel = evt.label || '';
  if (cleanLabel.includes(':')) {
    cleanLabel = cleanLabel.split(':')[0];
  }
  return cleanLabel;
};

function LedgerRow({ row, formatCurrency }) {
  const [expanded, setExpanded] = useState(false);
  const isPos = row.type === 'positive';
  const isNeg = row.type === 'negative';
  const sign = isPos ? '+' : isNeg ? '-' : '';
  const color = isPos ? 'var(--accent-emerald)' : isNeg ? 'var(--accent-rose)' : 'var(--text-secondary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          fontSize: '0.75rem', 
          color: row.isSummary ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: row.expandable ? 'pointer' : 'default',
          padding: row.isSummary ? '0.3rem 0 0.15rem 0' : '0.15rem 0',
          borderRadius: '4px',
          transition: 'background-color 0.2s',
          borderTop: row.isSummary ? '1px dashed var(--border-color)' : 'none',
          marginTop: row.isSummary ? '0.2rem' : '0',
          fontWeight: row.isSummary ? '700' : 'normal'
        }}
        onClick={() => row.expandable && setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {row.isTransfer && <span>🔄</span>}
          <span>{sign} {row.label}</span>
          {row.expandable && (
            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted, #a1a1aa)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>
        <strong style={{ color: row.isSummary ? (row.type === 'neutral' ? 'var(--text-primary)' : 'var(--accent-emerald)') : color }}>
          {sign}{formatCurrency(Math.abs(row.value))}
        </strong>
      </div>

      {row.helperText && (
        <div style={{ 
          fontSize: '0.68rem', 
          color: 'var(--text-muted)', 
          opacity: 0.85, 
          paddingLeft: row.isTransfer ? '1.2rem' : '0.4rem', 
          marginTop: '-0.15rem', 
          marginBottom: '0.1rem',
          fontStyle: 'italic',
          lineHeight: '1.2'
        }}>
          {row.helperText}
        </div>
      )}
      
      {row.expandable && expanded && row.details && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.25rem', 
          paddingLeft: '1rem', 
          fontSize: '0.7rem', 
          color: 'var(--text-secondary)',
          opacity: 0.9,
          borderLeft: '1px dashed var(--border-color)',
          marginLeft: '0.25rem',
          marginTop: '0.1rem',
          marginBottom: '0.25rem'
        }}>
          {row.details.paidFromSavings !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid From Savings</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(row.details.paidFromSavings)}</span>
            </div>
          )}
          {row.details.financed !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Financed</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(row.details.financed)}</span>
            </div>
          )}
          {row.details.currentDebtBalance !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Current Debt Balance</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatCurrency(row.details.currentDebtBalance)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CustomEventMarker = (props) => {
  const {
    cx,
    cy,
    event,
    lane,
    xOffset,
    selectedMilestone,
    onSelectMilestone,
    onSelectCluster,
    isMobile,
    xScale,
    yScale,
    chartData,
    stackIndex = 0,
    stackCount = 1,
    stackEvents = []
  } = props;
  
  if (cx === undefined || cy === undefined) return null;

  const isSelected = selectedMilestone && (
    (event.originalId && String(selectedMilestone.originalId) === String(event.originalId)) ||
    (!event.originalId && event.type === selectedMilestone.type && event.age === selectedMilestone.age)
  );

  const isRetirement = event.type.startsWith('retirementReady') || event.type === 'retire';
  
  const marker = (xScale && yScale && chartData)
    ? getEventMarkerPosition(event, chartData, xScale, yScale)
    : { x: cx, y: cy };

  // Helper to compute radius of an event
  const getEventRadius = (evt) => {
    const isRet = evt.type.startsWith('retirementReady') || evt.type === 'retire';
    return isRet ? (isMobile ? 13.5 : 15) : (isMobile ? 11 : 12.5);
  };

  // Stacking/Collapsing logic
  const topEventIndex = stackCount - 1;
  const topOffset = isMobile ? (26 + topEventIndex * 22) : (36 + topEventIndex * 32);
  const topY = marker.y - topOffset;
  const topEvent = stackEvents.length > 0 ? stackEvents[topEventIndex] : event;
  const topR = getEventRadius(topEvent);
  const stackGoesOver = stackCount > 1 && (topY - topR < 0);

  const isCollapsedCluster = stackGoesOver && stackIndex === 0 && stackEvents?.length > 1;

  if (stackGoesOver && stackIndex > 0) {
    return null;
  }

  // Calculate lane height and offset (for collapsed stacks, stackIndex/lane is 0)
  const resolvedLane = stackGoesOver ? 0 : stackIndex;
  const laneOffset = isMobile ? (26 + resolvedLane * 22) : (36 + resolvedLane * 32);
  const y = marker.y - laneOffset;
  const targetX = marker.x;

  // Base radius and coordinates
  const baseR = getEventRadius(event);
  const r = isSelected ? baseR + 1.5 : baseR;

  const baseIconSize = isRetirement
    ? (isMobile ? '11px' : '13px')
    : (isMobile ? '9px' : '10.5px');

  const iconSize = isSelected
    ? `${parseFloat(baseIconSize) * 1.15}px`
    : baseIconSize;

  const textOffset = isRetirement
    ? (isMobile ? 4.5 : 5)
    : (isMobile ? 3.5 : 4);
  const currentTextOffset = isSelected ? textOffset * 1.15 : textOffset;

  const isMajorImpact = ['buyHouse', 'sellHouse', 'marriage', 'haveChild', 'college', 'windfall', 'retire'].includes(event.type) || event.type.startsWith('retirementReady');
  const eventIcon = getEventIcon(event);

  // Styling for the badge (+N)
  const strokeColor = isSelected ? '#ffffff' : isRetirement ? 'var(--accent-emerald, #10b981)' : 'rgba(255, 255, 255, 0.25)';
  const badgeFill = isSelected ? 'var(--primary)' : isRetirement ? '#064e3b' : 'var(--bg-secondary, #1e293b)';
  const badgeStroke = strokeColor;
  const badgeTextColor = '#ffffff';

  const countText = `+${stackCount - 1}`;
  const badgeW = isMobile ? (countText.length > 2 ? 20 : 16) : (countText.length > 2 ? 24 : 18);
  const badgeH = isMobile ? 16 : 18;
  const badgeX = targetX + r + 4;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        if (isCollapsedCluster) {
          if (onSelectCluster) {
            onSelectCluster(stackEvents);
          }
        } else {
          if (onSelectMilestone) {
            onSelectMilestone(event);
          }
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* 1. Vertical connector line from (marker.x, marker.y) to (marker.x, y + r) */}
      <path
        d={`M ${targetX} ${marker.y} L ${targetX} ${y + r}`}
        stroke={isSelected ? 'var(--primary)' : isMajorImpact ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.2)'}
        strokeWidth={isSelected ? 2 : isMajorImpact ? 1.5 : 1}
        strokeDasharray={isMajorImpact && !isSelected ? 'none' : '2 2'}
        fill="none"
      />

      {/* 2. Glow effect for retirement or selected */}
      {(isRetirement || isSelected) && (
        <circle
          cx={targetX}
          cy={y}
          r={r + 6}
          fill={
            isSelected
              ? (isRetirement ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)')
              : 'rgba(16, 185, 129, 0.18)'
          }
          filter="blur(3px)"
        />
      )}

      {/* 3. Outer Ring if selected */}
      {isSelected && (
        <circle
          cx={targetX}
          cy={y}
          r={r + 4}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      )}

      {/* 4. Main badge circle */}
      <circle
        cx={targetX}
        cy={y}
        r={r}
        fill={badgeFill}
        stroke={badgeStroke}
        strokeWidth={isSelected ? 1.5 : 1}
      />

      {/* 5. Emoji Icon */}
      <text
        x={targetX}
        y={y + currentTextOffset}
        textAnchor="middle"
        fontSize={iconSize}
        style={{ userSelect: 'none' }}
      >
        {eventIcon || '✨'}
      </text>

      {/* 6. Collapse count badge (+N) on the right side */}
      {stackGoesOver && stackIndex === 0 && (
        <text
          x={targetX + r * 0.55}
          y={y + r + 3}
          textAnchor="start"
          fontSize={isMobile ? "9px" : "10px"}
          fontWeight="bold"
          fill={badgeTextColor}
          style={{ userSelect: 'none' }}
        >
          {countText}
        </text>
      )}
    </g>
  );
};


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
    <div className="mobile-layout-container">
      {/* Brand Header */}
      <header className="mobile-brand-header">
        <span className="mobile-logo-text">
          <Sparkles size={20} className="mobile-logo-sparkle" fill="#a78bfa" />
          Finley
        </span>
      </header>

      {/* Main Tab Content */}
      <div style={{ flex: 1 }}>
        {/* PLAN TAB */}
        {activeTab === 'Plan' && (() => {
          const finalYearLog = chartData[chartData.length - 1];
          const finalNetWorth = finalYearLog ? finalYearLog.netWorth : 0;
          
          const fiConfidence = activeResults.retirementOutcome === 'comfortable' ? '95%' 
            : activeResults.retirementOutcome === 'sustainable' ? '85%'
            : activeResults.runOutAge !== null ? `${Math.max(10, Math.round(100 - ((inputs.lifeExpectancy || 85) - activeResults.runOutAge) * 5))}%`
            : '75%';

          const successRate = activeResults.retirementOutcome === 'comfortable' ? '92%' 
            : activeResults.retirementOutcome === 'sustainable' ? '85%'
            : activeResults.runOutAge !== null ? `${Math.max(5, Math.round(100 - ((inputs.lifeExpectancy || 85) - activeResults.runOutAge) * 6))}%`
            : '70%';

          const burnVal = inputs.currentAge < (activeResults.retirementReadyAge || 65) 
            ? (currentAgePhase ? Object.values(currentAgePhase.expenses || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) : 4250)
            : (activeResults.annualRetirementSpending || 51000) / 12;

          return (
            <div>
              {/* 1. TOP SECTION: GOAL CARD */}
              <div 
                className="glass-card mobile-goal-card"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  background: 'var(--bg-secondary, #ffffff)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '20px',
                  marginBottom: '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  textAlign: 'left'
                }}
              >
                {/* Left Panel: Goal Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    When would you like to stop working?
                  </h3>
                  
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    onClick={handleTapGoalAge}
                  >
                    <input
                      type="number"
                      value={goalAgeInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          setGoalAgeInput(val);
                        }
                      }}
                      onBlur={(e) => {
                        commitGoalAge(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitGoalAge(e.target.value);
                          e.target.blur();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()} // Prevent triggering parent onClick
                      style={{
                        width: '60px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '1.2rem',
                        fontWeight: '800',
                        padding: '0.35rem 0.5rem',
                        textAlign: 'center',
                        boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>years old</span>
                  </div>
                  {Number(inputs.currentAge) === Number(inputs.targetRetirementAge) && (
                    <div 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#fffbeb',
                        color: '#b45309',
                        border: '1px solid #fef3c7',
                        borderRadius: '9999px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        marginTop: '4px',
                        alignSelf: 'flex-start'
                      }}
                    >
                      <span>🏖️ Stop Working Today</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '0 1rem' }} />

                {/* Right Panel: Secondary Metric & Pill */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyRules: 'center', alignItems: 'flex-start', gap: '0.45rem', flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.25' }}>
                    You can currently stop working at{' '}
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {activeResults.retirementReadyAge || '—'}
                    </strong>
                  </div>

                  <div 
                    onClick={handleTapGoalAge}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      backgroundColor: isPlanOnTrack ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      border: `1px solid ${isPlanOnTrack ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                      color: isPlanOnTrack ? 'var(--accent-emerald, #10b981)' : 'var(--accent-orange, #f59e0b)',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {isPlanOnTrack ? '✓ On Track' : '⚠ Delayed'}
                  </div>
                </div>
              </div>

              {/* 2. LIFE PROFILE CARD */}
              {(() => {
                const lifeProfile = inputs.lifeProfile || {};
                const household = lifeProfile.household || {};
                const home = lifeProfile.home || {};
                const children = lifeProfile.children || [];
                const filingStatus = inputs.filingStatus || household.status || 'single';

                const statusLabel = filingStatus === 'married' || filingStatus === 'partnered' ? 'Married' : 'Single';
                const homeLabel = home.status === 'own' ? 'Homeowner' : 'Renting';
                const incomeLabel = `Income ${formatCurrency(inputs.simpleIncome || 0)}`;
                
                return (
                  <div 
                    onClick={() => {
                      setLifeProfileTab('timeline');
                      setIsLifeProfileOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.25rem',
                      background: 'var(--bg-secondary, #ffffff)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      borderRadius: '20px',
                      marginBottom: '1.25rem',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {/* Left: Avatar Circle Icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary, #6366f1)'
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>

                      {/* Middle Column Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                          Your Life
                        </h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {statusLabel} • {homeLabel}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {incomeLabel}{children.length > 0 ? ` • ${children.length} ${children.length === 1 ? 'Child' : 'Children'}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Right Column: CTA */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--primary, #6366f1)', fontSize: '0.78rem', fontWeight: '700' }}>
                      <span>Life Planner</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                );
              })()}

              {/* 3. TIMELINE SECTION (above the graph) */}
              <MobileTimeline
                timelineEvents={timelineEvents}
                selectedEventIndex={selectedEventIndex}
                setSelectedEventIndex={setSelectedEventIndex}
                onEventTap={(evt) => setActiveEventForSheet(evt)}
                inputs={inputs}
              />



              {/* 4. GRAPH SECTION */}
              {(() => {
                const selectedAge = timelineEvents[selectedEventIndex]?.age || inputs.currentAge;
                const selectedPoint = chartData.find(d => Number(d.age) === Number(selectedAge));
                
                const eventAges = Array.from(new Set([
                  inputs.currentAge,
                  ...timelineEvents.map(e => Number(e.age)),
                  inputs.lifeExpectancy
                ])).sort((a, b) => a - b);

                return (
                  <div 
                    className="mobile-card" 
                    style={{ 
                      marginTop: '1.25rem', 
                      textAlign: 'left', 
                      padding: '1.25rem 1rem',
                      background: '#ffffff',
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: '20px',
                      boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))'
                    }}
                  >
                    <div style={{ display: 'flex', justifyRules: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <div>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                          📈 Net Worth Projections
                        </h3>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Highlighting Age {selectedAge}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '8px', height: '2px', background: 'var(--net-worth, #1e3a5f)', display: 'inline-block' }}></span>
                          <span>Net Worth</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '8px', height: '2px', background: 'var(--asset, #16a34a)', display: 'inline-block' }}></span>
                          <span>Assets</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '8px', height: '2px', background: 'var(--debt, #dc2626)', display: 'inline-block' }}></span>
                          <span>Debt</span>
                        </div>
                      </div>
                    </div>

                    <div ref={chartContainerRef} style={{ height: '180px', width: '100%', marginLeft: '-15px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                          onMouseMove={(e) => {
                            if (e && e.activeCoordinate) {
                              setActiveTooltipCoord({
                                x: e.activeCoordinate.x,
                                y: e.activeCoordinate.y
                              });
                            } else {
                              setActiveTooltipCoord(null);
                            }
                          }}
                          onMouseLeave={() => {
                            setActiveTooltipCoord(null);
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
                          <XAxis
                            dataKey="age"
                            ticks={eventAges}
                            stroke="var(--text-tertiary)"
                            fontSize={8}
                          />
                          <YAxis
                            stroke="var(--text-tertiary)"
                            fontSize={8}
                            tickFormatter={formatYAxis}
                            domain={[ticks[0], ticks[ticks.length - 1]]}
                            ticks={ticks}
                          />
                          <ReferenceLine y={0} stroke="var(--text-secondary, #6b7280)" strokeWidth={1.5} strokeDasharray="3 3" />
                          <Tooltip
                            position={tooltipPos}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="custom-chart-tooltip" style={{ background: '#ffffff', border: '1px solid var(--border, #e5e7eb)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                    <p style={{ fontWeight: '700', marginBottom: '0.2rem', borderBottom: '1px solid var(--border, #e5e7eb)', color: 'var(--text-primary)', paddingBottom: '0.15rem' }}>Age {label}</p>
                                    {payload.map((item) => (
                                      <div key={item.name} style={{ display: 'flex', justifyRules: 'space-between', gap: '0.75rem', margin: '0.05rem 0' }}>
                                        <span style={{ color: item.stroke || item.color, fontWeight: '500' }}>{item.name}:</span>
                                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(item.value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="netWorth"
                            name="Net Worth"
                            stroke="var(--net-worth, #1e3a5f)"
                            strokeWidth={2.5}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="assets"
                            name="Total Assets"
                            stroke="var(--asset, #16a34a)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="debt"
                            name="Total Debt"
                            stroke="var(--debt, #dc2626)"
                            strokeWidth={2}
                            dot={false}
                          />

                          {selectedAge !== null && (
                            <>
                              <ReferenceLine
                                x={selectedAge}
                                stroke="var(--primary)"
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                              />
                              <ReferenceDot
                                x={selectedAge}
                                y={selectedPoint ? (selectedPoint.netWorth ?? 0) : 0}
                                r={5}
                                fill="var(--primary)"
                                stroke="#fff"
                                strokeWidth={1.5}
                                isFront={true}
                              />
                            </>
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* 5. ACTIONS SECTION */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem', marginBottom: '1rem' }}>
                {/* Add Life Event Card */}
                <button 
                  type="button"
                  aria-label="➕ Add Life Event"
                  onClick={() => setEditingEvent({ type: 'selectType', isNew: true })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '1rem 1.25rem',
                    background: 'var(--bg-secondary, #ffffff)',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    color: 'inherit'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                      fontWeight: 'bold',
                      fontSize: '1.2rem'
                    }}>
                      ＋
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>Add Life Event</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Plan for future milestones</span>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Edit Budget Card */}
                <div 
                  onClick={() => handleSetBudgetClick()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    background: 'var(--bg-secondary, #ffffff)',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3b82f6'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>Edit Budget</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Review and update your spending</span>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>

                {/* Add Borrowing Card */}
                <div 
                  onClick={() => handleCreateEvent('borrowing')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    background: 'var(--bg-secondary, #ffffff)',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(139, 92, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#8b5cf6',
                      fontWeight: 'bold',
                      fontSize: '1.1rem'
                    }}>
                      $
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>Add Borrowing</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add a loan or other debt</span>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })()}        {/* RESULTS TAB */}
        {activeTab === 'Results' && (
          <div>
            <h1 className="mobile-tab-title">Results</h1>
            <p className="mobile-tab-subtitle">Compare projections and view progress charts</p>

            {/* Swipe Tab Bar */}
            <div className="mobile-chart-tabs-scroller">
              {[
                { id: 'netWorth', label: 'Net Worth' },
                { id: 'assetsDebt', label: 'Assets vs Debt' },
                { id: 'progress', label: 'Financial Freedom Progress' },
                { id: 'incomeSpending', label: 'Income vs Spending' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`mobile-chart-tab-btn ${activeChart === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveChart(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active Chart Box */}
            <MobileResults
              simulation={simulation}
              timeline={timeline}
              chartData={chartData}
              activeResults={activeResults}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              activeChart={activeChart}
              setActiveChart={setActiveChart}
            />

            {/* Financial Snapshot Card */}
            {(() => {
              const activeYear = selectedYear !== null ? selectedYear : Number(inputs.currentAge);
              const yearData = chartData.find(d => d.age === activeYear);
              if (!yearData) return null;

              const isWorking = activeYear < displayedResults.targetRetirementAge;

              return (
                <div className="mobile-card" style={{ marginTop: '1.25rem', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', marginBottom: '0.8rem' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                      🔍 Age {activeYear} Financial Snapshot
                    </h3>
                    <span className="badge" style={{ 
                      fontSize: '0.65rem', 
                      padding: '0.15rem 0.45rem', 
                      background: isWorking ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                      color: isWorking ? 'var(--primary)' : 'var(--accent-emerald)',
                      border: `1px solid ${isWorking ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}>
                      {isWorking ? 'Working' : 'Retired'}
                    </span>
                  </div>

                  {/* KPI Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Net Worth</span>
                      <strong style={{ fontSize: '0.95rem', color: yearData.netWorth < 0 ? 'var(--accent-rose)' : 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                        {formatCompactCurrency(yearData.netWorth)}
                      </strong>
                    </div>
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Portfolio / Assets</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                        {formatCompactCurrency(yearData.assets)}
                      </strong>
                    </div>
                    {yearData.debt > 0 && (
                      <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Total Debt</span>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--accent-rose)', display: 'block', marginTop: '0.15rem' }}>
                          {formatCompactCurrency(yearData.debt)}
                        </strong>
                      </div>
                    )}
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Income</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                        {formatCompactCurrency(yearData.income)}
                      </strong>
                    </div>
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Spending</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                        {formatCompactCurrency(yearData.expenses - (yearData.taxes || 0))}
                      </strong>
                    </div>
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>
                        {yearData.withdrawals > 0 ? 'Withdrawals' : 'Net Savings'}
                      </span>
                      <strong style={{ 
                        fontSize: '0.95rem', 
                        color: yearData.withdrawals > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', 
                        display: 'block', 
                        marginTop: '0.15rem' 
                      }}>
                        {yearData.withdrawals > 0 ? `-${formatCompactCurrency(yearData.withdrawals)}` : `+${formatCompactCurrency(yearData.savings)}`}
                      </strong>
                    </div>
                  </div>

                  {/* Net Worth Ledger */}
                  {yearData.netWorthLedger && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', marginTop: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                          📒 Net Worth Change
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsMobileLedgerExpanded(!isMobileLedgerExpanded)}
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--primary)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.15rem 0.4rem',
                            fontWeight: '600'
                          }}
                        >
                          {isMobileLedgerExpanded ? 'Hide details ▴' : 'Show details ▾'}
                        </button>
                      </div>

                      <div style={{
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.6rem 0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>Starting Net Worth:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(yearData.netWorthLedger.startingNetWorth)}
                          </strong>
                        </div>

                        {isMobileLedgerExpanded && [
                          { key: 'incomeInvesting', label: 'Income & Investing' },
                          { key: 'lifeEvents', label: 'Life Events' },
                          { key: 'homeActivity', label: 'Home Purchase Activity' },
                          { key: 'debtActivity', label: 'Debt Activity' }
                        ].map(sec => {
                          const secRows = yearData.netWorthLedger.rows.filter(r => r.section === sec.key);
                          if (secRows.length === 0) return null;
                          return (
                            <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem' }}>
                              <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', opacity: 0.6 }}>
                                {sec.label}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.4rem' }}>
                                {sec.key === 'homeActivity' ? (
                                  [
                                    { key: 'homePurchased', label: '🏠 Home Purchased' },
                                    { key: 'equityTransfer', label: '🔄 Cash → Home Equity (No Net Worth Impact)' },
                                    { key: 'purchaseCosts', label: '💸 Purchase Costs' },
                                    { key: 'homeOwnership', label: '🏡 Home Ownership' }
                                  ].map(sub => {
                                    const subRows = secRows.filter(r => r.subgroup === sub.key);
                                    if (subRows.length === 0) return null;
                                    return (
                                      <div key={sub.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-secondary)', opacity: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.1rem', marginBottom: '0.15rem' }}>
                                          {sub.label}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.4rem' }}>
                                          {sub.key === 'equityTransfer' ? (
                                            subRows.map((row, rIdx) => (
                                              <div key={rIdx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.15rem 0' }}>
                                                {row.helperText}
                                              </div>
                                            ))
                                          ) : (
                                            subRows.map((row, rIdx) => (
                                              <LedgerRow key={rIdx} row={row} formatCurrency={formatCurrency} />
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  secRows.map((row, rIdx) => (
                                    <LedgerRow key={rIdx} row={row} formatCurrency={formatCurrency} />
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          color: 'var(--text-primary)',
                          borderTop: isMobileLedgerExpanded ? '1px solid var(--border-color)' : 'none',
                          paddingTop: isMobileLedgerExpanded ? '0.35rem' : '0',
                          fontWeight: '700'
                        }}>
                          <span>Ending Net Worth:</span>
                          <strong style={{ color: yearData.netWorthLedger.endingNetWorth < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                            {formatCurrency(yearData.netWorthLedger.endingNetWorth)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cash Flow Details Breakdown */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', marginTop: '0.8rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                      📊 Cash Flow Details
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Base Annual Spending:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(Math.max(0, yearData.expenses - (yearData.taxes || 0) - (yearData.childCosts || 0)))}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Child Costs:</span>
                        <strong style={{ color: yearData.childCosts > 0 ? 'var(--accent-orange, #f59e0b)' : 'var(--text-primary)' }}>
                          {formatCurrency(yearData.childCosts || 0)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Total Annual Spending:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Net Savings:</span>
                        <strong style={{ color: yearData.withdrawals > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                          {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* DETAILS TAB */}
        {activeTab === 'Details' && (
          <div className="mobile-details-section">
            <h1 className="mobile-tab-title">Settings & Details</h1>
            <p className="mobile-tab-subtitle">Configure advanced settings, starting balances, and assumptions</p>

            {/* Account Starting Balances Card */}
            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <div className="mobile-details-group-title">🎯 Starting Account Balances</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.35rem 0 1rem 0', lineHeight: '1.4' }}>
                Set starting assets. Changes update model outcomes instantly.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[
                  { key: 'cash', label: 'Cash / Checking Balance' },
                  { key: 'emergencyFund', label: 'HYSA / Emergency Fund' },
                  { key: 'brokerage', label: 'Taxable Brokerage' },
                  { key: 'trad401k', label: 'Pre-Tax 401(k) / 403(b)' },
                  { key: 'tradIra', label: 'Traditional IRA' },
                  { key: 'rothIra', label: 'Roth IRA' },
                  { key: 'hsa', label: 'Health Savings (HSA)' },
                  { key: 'other', label: 'Other Assets / Accounts' }
                ].map(item => (
                  <div key={item.key} className="mobile-input-row">
                    <div className="mobile-input-label-col">
                      <span className="mobile-input-title">{item.label}</span>
                    </div>
                    <div className="mobile-input-box-wrapper">
                      <input
                        type="number"
                        className="mobile-input-box"
                        value={inputs.assets?.[item.key] || 0}
                        onChange={(e) => handleAssetChange(item.key, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advanced Assumptions Card */}
            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <div className="mobile-details-group-title">⚙️ Global Plan Assumptions</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Pre-Retire Return (%)</span>
                    <span className="mobile-input-desc">Annual expected growth rate before retirement</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      step="0.1"
                      className="mobile-input-box"
                      value={inputs.expectedReturn}
                      onChange={(e) => updateInput('expectedReturn', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Post-Retire Return (%)</span>
                    <span className="mobile-input-desc">Expected return once retired</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      step="0.1"
                      className="mobile-input-box"
                      value={inputs.postRetirementReturn !== undefined ? inputs.postRetirementReturn : inputs.expectedReturn}
                      onChange={(e) => updateInput('postRetirementReturn', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Cash Return Rate (%)</span>
                    <span className="mobile-input-desc">Checking and cash return rate</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      step="0.1"
                      className="mobile-input-box"
                      value={inputs.cashReturnRate !== undefined ? inputs.cashReturnRate : 2.0}
                      onChange={(e) => updateInput('cashReturnRate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Inflation Rate (%)</span>
                    <span className="mobile-input-desc">Annual cost of living increase</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      step="0.1"
                      className="mobile-input-box"
                      value={inputs.inflationRate}
                      onChange={(e) => updateInput('inflationRate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">SWR / Withdrawal Rate (%)</span>
                    <span className="mobile-input-desc">Safe Withdrawal Rate target (e.g. 4%)</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      step="0.1"
                      className="mobile-input-box"
                      value={inputs.swr}
                      onChange={(e) => updateInput('swr', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Lifestyle Upgrades (%)</span>
                    <span className="mobile-input-desc">Annual spending growth over inflation</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      step="0.1"
                      className="mobile-input-box"
                      value={inputs.lifestyleUpgrades || 0}
                      onChange={(e) => updateInput('lifestyleUpgrades', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Settings Card */}
            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <div className="mobile-details-group-title">⚖️ Taxes & Progressive Logic</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                <div className="mobile-input-row">
                  <label className="mobile-checkbox-label">
                    <input
                      type="checkbox"
                      checked={inputs.includeTaxes}
                      onChange={(e) => updateInput('includeTaxes', e.target.checked)}
                    />
                    <span>Include Federal Progressive Taxes</span>
                  </label>
                </div>

                {inputs.includeTaxes && (
                  <div className="mobile-input-row">
                    <div className="mobile-input-label-col">
                      <span className="mobile-input-title">Filing Status</span>
                    </div>
                    <div className="mobile-input-box-wrapper">
                      <select
                        className="mobile-input-box"
                        style={{ textAlign: 'left', paddingRight: '0.2rem' }}
                        value={inputs.filingStatus || 'single'}
                        onChange={(e) => updateInput('filingStatus', e.target.value)}
                      >
                        <option value="single">Single</option>
                        <option value="married">Married Joint</option>
                        <option value="headOfHousehold">Head of Household</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <div className="mobile-details-group-title">🛠️ Advanced Configuration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                <div className="mobile-input-row">
                  <label className="mobile-checkbox-label">
                    <input
                      type="checkbox"
                      checked={inputs.enableHealthcareModel !== false}
                      onChange={(e) => updateInput('enableHealthcareModel', e.target.checked)}
                    />
                    <span>Enable Healthcare Cost Modeling</span>
                  </label>
                </div>

                {inputs.enableHealthcareModel !== false && (
                  <>
                    <div className="mobile-input-row">
                      <div className="mobile-input-label-col">
                        <span className="mobile-input-title">Pre-Medicare Premium</span>
                        <span className="mobile-input-desc">Annual private healthcare cost</span>
                      </div>
                      <div className="mobile-input-box-wrapper">
                        <input
                          type="number"
                          className="mobile-input-box"
                          value={inputs.preMedicarePremium || 10000}
                          onChange={(e) => updateInput('preMedicarePremium', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="mobile-input-row">
                      <div className="mobile-input-label-col">
                        <span className="mobile-input-title">Medicare Premium</span>
                        <span className="mobile-input-desc">Annual Medicare cost (age 65+)</span>
                      </div>
                      <div className="mobile-input-box-wrapper">
                        <input
                          type="number"
                          className="mobile-input-box"
                          value={inputs.medicarePremium || 4000}
                          onChange={(e) => updateInput('medicarePremium', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DEDICATED PHASE DETAIL FULL-SCREEN OVERLAY */}
      {selectedMobilePhaseId && selectedPhaseObj && (
        <div className="mobile-detail-overlay">
          {/* Overlay Navbar */}
          <nav className="mobile-detail-navbar">
            <button 
              type="button" 
              className="mobile-icon-btn"
              onClick={() => setSelectedMobilePhaseId(null)}
              aria-label="Back to Roadmap"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="mobile-logo-text" style={{ fontSize: '1.1rem' }}>
              <Sparkles size={16} className="mobile-logo-sparkle" fill="#a78bfa" />
              Finley
            </span>
          </nav>

          {/* Overlay Body */}
          <div className="mobile-detail-body">
            {/* Phase Hero Section */}
            <div className="mobile-detail-hero-section">
              <span className="mobile-detail-emoji">{selectedPhaseObj.icon}</span>
              <h1 className="mobile-detail-title">{selectedPhaseObj.label}</h1>
              <span className="mobile-detail-meta">
                Age {selectedPhaseObj.startAge}–{selectedPhaseObj.endAge} &nbsp;•&nbsp; 📅 {selectedPhaseObj.endAge - selectedPhaseObj.startAge} years
              </span>
              <div className="mobile-detail-tags-row">
                {getPhaseTags(selectedPhaseObj).map((tag, idx) => (
                  <span key={idx} className={`mobile-tag tag-${tag.color}`}>
                    {tag.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Why This Phase Exists Collapsible Dropdown */}
            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <button 
                type="button" 
                className="mobile-collapsible-btn"
                onClick={() => setWhyPhaseExistsOpen(!whyPhaseExistsOpen)}
              >
                <span> Why this phase exists</span>
                <span>{whyPhaseExistsOpen ? '▲' : '▼'}</span>
              </button>
              
              {whyPhaseExistsOpen && (
                <div className="mobile-collapsible-content">
                  {getWhyPhaseExistsItems(selectedPhaseObj, prevPhaseObj).map((item, idx) => {
                    if (item.isNetChange) {
                      return (
                        <div key={idx} className="mobile-dropdown-item mobile-dropdown-item-net">
                          <span>{item.label}</span>
                          <span className={item.isPositive ? 'mobile-dropdown-val-positive' : 'mobile-dropdown-val-negative'}>
                            {item.value}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="mobile-dropdown-item">
                        <span>{item.label}</span>
                        <span className={item.isPositive ? 'mobile-dropdown-val-positive' : 'mobile-dropdown-val-negative'}>
                          {item.value}
                        </span>
                      </div>
                    );
                  })}
                  {getWhyPhaseExistsItems(selectedPhaseObj, prevPhaseObj).length === 0 && (
                    <div className="mobile-dropdown-item" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                      Standard budget configuration remains unchanged.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Budget (Monthly) Card */}
            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <div className="mobile-budget-header-row">
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>Budget <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' }}>(Monthly)</span></span>
                <button 
                  type="button" 
                  className="mobile-budget-edit-btn"
                  onClick={() => {
                    setSelectedMobilePhaseId(null);
                    handleSetBudgetClick(selectedPhaseObj.id);
                  }}
                >
                  Edit
                </button>
              </div>

              {/* Large Typography Budget Layout */}
              <div className="mobile-budget-income-section">
                <div className="mobile-budget-income-label">Income</div>
                <div className="mobile-budget-income-val">{formatCompactCurrency(selectedPhaseObj.income || 0)}</div>
                <div className="mobile-budget-income-sub">After tax</div>
              </div>

              {(() => {
                const phaseNeedsTotal = (Number(selectedPhaseObj.expenses?.housing) || 0) +
                                       (Number(selectedPhaseObj.expenses?.utilities) || 0) +
                                       (Number(selectedPhaseObj.expenses?.food) || 0) +
                                       (Number(selectedPhaseObj.expenses?.transportation) || 0) +
                                       (Number(selectedPhaseObj.expenses?.healthcare) || 0) +
                                       (selectedPhaseObj.isMarried ? (Number(selectedPhaseObj.expenses?.debt) || 0) : 0) +
                                       (Number(selectedPhaseObj.expenses?.childcare) || 0) +
                                       (selectedPhaseObj.activeDebts || []).reduce((sum, d) => sum + (Number(selectedPhaseObj.expenses?.[`debt_${d.id}`]) || d.monthlyPayment || 0), 0);

                const phaseWantsTotal = (Number(selectedPhaseObj.expenses?.leisure) || 0) +
                                       (Number(selectedPhaseObj.expenses?.diningOut) || 0) +
                                       (Number(selectedPhaseObj.expenses?.misc) || 0);

                const phaseSavingsTotal = Object.values(selectedPhaseObj.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) +
                                         (selectedPhaseObj.isMarried ? Object.values(selectedPhaseObj.partnerSavings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0);

                const incomeVal = Math.max(1, selectedPhaseObj.income || 0);
                const needsPct = Math.round((phaseNeedsTotal / incomeVal) * 100);
                const wantsPct = Math.round((phaseWantsTotal / incomeVal) * 100);
                const savingsPct = Math.round((Math.abs(phaseSavingsTotal) / incomeVal) * 100);

                return (
                  <div className="mobile-budget-categories-row">
                    <div className="mobile-budget-cat">
                      <div className="mobile-budget-cat-label">Needs</div>
                      <div className="mobile-budget-cat-val val-red">{formatCompactCurrency(phaseNeedsTotal)}</div>
                      <div className="mobile-budget-cat-pct">{needsPct}%</div>
                    </div>
                    <div className="mobile-budget-cat">
                      <div className="mobile-budget-cat-label">Wants</div>
                      <div className="mobile-budget-cat-val val-orange">{formatCompactCurrency(phaseWantsTotal)}</div>
                      <div className="mobile-budget-cat-pct">{wantsPct}%</div>
                    </div>
                    <div className="mobile-budget-cat">
                      <div className="mobile-budget-cat-label">Save & Invest</div>
                      <div className="mobile-budget-cat-val val-blue">
                        {phaseSavingsTotal < 0 ? '-' : ''}{formatCompactCurrency(Math.abs(phaseSavingsTotal))}
                      </div>
                      <div className="mobile-budget-cat-pct">{savingsPct}%</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Savings Allocation progress bars */}
            {(() => {
              const phaseSavingsTotal = Object.values(selectedPhaseObj.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) +
                                       (selectedPhaseObj.isMarried ? Object.values(selectedPhaseObj.partnerSavings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0);

              const allocations = [];
              if (phaseSavingsTotal >= 0) {
                const combined = {};
                const addSavings = (obj) => {
                  if (!obj) return;
                  Object.entries(obj).forEach(([k, v]) => {
                    const val = Number(v) || 0;
                    if (val > 0) combined[k] = (combined[k] || 0) + val;
                  });
                };
                addSavings(selectedPhaseObj.savings);
                if (selectedPhaseObj.isMarried) addSavings(selectedPhaseObj.partnerSavings);

                const totalAlloc = Object.values(combined).reduce((sum, v) => sum + v, 0);
                Object.entries(combined).forEach(([k, v]) => {
                  allocations.push({
                    key: k,
                    label: getAssetLabel(k),
                    amount: v,
                    pct: totalAlloc > 0 ? Math.round((v / totalAlloc) * 100) : 0
                  });
                });
              } else {
                const withdrawalAmt = Math.abs(phaseSavingsTotal);
                allocations.push(
                  { key: 'brokerage', label: 'Taxable Brokerage', amount: Math.round(withdrawalAmt * 0.5), pct: 50 },
                  { key: 'rothIra', label: 'Roth IRA', amount: Math.round(withdrawalAmt * 0.3), pct: 30 },
                  { key: 'cash', label: 'Cash Reserve', amount: Math.round(withdrawalAmt * 0.2), pct: 20 }
                );
              }

              const barColors = ['bar-green', 'bar-blue', 'bar-purple', 'bar-orange', 'bar-teal'];

              return (
                <div className="mobile-card" style={{ textAlign: 'left' }}>
                  <div className="mobile-budget-header-row">
                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                      {phaseSavingsTotal >= 0 ? 'Savings Allocation' : 'Withdrawal Distribution'} 
                      <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' }}>(Monthly)</span>
                    </span>
                    <button 
                      type="button" 
                      className="mobile-budget-edit-btn"
                      onClick={() => {
                        setSelectedMobilePhaseId(null);
                        handleSetBudgetClick(selectedPhaseObj.id);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  
                  <div className="mobile-allocation-list" style={{ marginTop: '0.85rem' }}>
                    {allocations.map((alloc, idx) => {
                      const colorClass = barColors[idx % barColors.length];
                      return (
                        <div key={alloc.key} className="mobile-allocation-item">
                          <div className="mobile-alloc-header-row">
                            <span className="mobile-alloc-name">{alloc.label}</span>
                            <div className="mobile-alloc-metrics">
                              <span className="mobile-alloc-pct">{alloc.pct}%</span>
                              <span className="mobile-alloc-amount">{formatCurrency(alloc.amount)}</span>
                            </div>
                          </div>
                          <div className="mobile-progress-track">
                            <div 
                              className={`mobile-progress-fill ${colorClass}`}
                              style={{ width: `${alloc.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {allocations.length === 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
                        No contributions configured for this phase.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Impact This Phase */}
            {(() => {
              const logs = displayedResults.data.filter(d => d.age >= selectedPhaseObj.startAge && d.age < selectedPhaseObj.endAge);
              const avgIncome = logs.reduce((sum, d) => sum + (d.income || 0), 0) / Math.max(1, logs.length);
              const avgSavings = logs.reduce((sum, d) => sum + (d.savings || 0), 0) / Math.max(1, logs.length);
              const phaseSurplusVal = Math.round(avgSavings / 12);
              const phaseSavingsRateVal = avgIncome > 0 ? Math.round((avgSavings / avgIncome) * 100) : 0;

              // Baseline comparison
              const baseLogs = displayedBaselineResults.data.filter(d => d.age >= selectedPhaseObj.startAge && d.age < selectedPhaseObj.endAge);
              const baseAvgIncome = baseLogs.reduce((sum, d) => sum + (d.income || 0), 0) / Math.max(1, baseLogs.length);
              const baseAvgSavings = baseLogs.reduce((sum, d) => sum + (d.savings || 0), 0) / Math.max(1, baseLogs.length);
              const baseSurplus = Math.round(baseAvgSavings / 12);
              const baseSavingsRate = baseAvgIncome > 0 ? Math.round((baseAvgSavings / baseAvgIncome) * 100) : 0;

              // Net worth at 85 comparison
              const nwAt85 = Math.round(displayedResults.data.find(d => d.age === 85)?.netWorth || 0);
              const baseNwAt85 = Math.round(displayedBaselineResults.data.find(d => d.age === 85)?.netWorth || 0);

              const surplusDiff = phaseSurplusVal - baseSurplus;
              const rateDiff = phaseSavingsRateVal - baseSavingsRate;
              const nwDiff = nwAt85 - baseNwAt85;

              return (
                <div className="mobile-card" style={{ textAlign: 'left' }}>
                  <h3 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.85rem' }}>Impact of This Phase</h3>
                  
                  <div className="mobile-impact-grid">
                    <div className="mobile-impact-item">
                      <div className="mobile-impact-label">Monthly Surplus</div>
                      <div className="mobile-impact-val" style={{ color: phaseSurplusVal >= 0 ? '#10b981' : '#f43f5e' }}>
                        {formatCurrency(phaseSurplusVal)}/mo
                      </div>
                      {surplusDiff !== 0 && (
                        <div className="mobile-impact-was">
                          was {formatCurrency(baseSurplus)}
                          <span className={surplusDiff > 0 ? 'was-arrow-up' : 'was-arrow-down'}>
                            {surplusDiff > 0 ? '▲' : '▼'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mobile-impact-item">
                      <div className="mobile-impact-label">Savings Rate</div>
                      <div className="mobile-impact-val">{phaseSavingsRateVal}%</div>
                      {rateDiff !== 0 && (
                        <div className="mobile-impact-was">
                          was {baseSavingsRate}%
                          <span className={rateDiff > 0 ? 'was-arrow-up' : 'was-arrow-down'}>
                            {rateDiff > 0 ? '▲' : '▼'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mobile-impact-item">
                      <div className="mobile-impact-label">Can Stop Working Age</div>
                      <div className="mobile-impact-val" style={{ color: isPlanOnTrack ? '#10b981' : '#f59e0b' }}>
                        {isPlanOnTrack ? 'On Track' : 'Delayed'}
                      </div>
                      <div className="mobile-impact-was" style={{ fontSize: '0.65rem' }}>
                        Ready at {activeResults.retirementReadyAge || 'N/A'}
                      </div>
                    </div>

                    <div className="mobile-impact-item">
                      <div className="mobile-impact-label">NW at Age 85</div>
                      <div className="mobile-impact-val">{formatCurrency(nwAt85)}</div>
                      {nwDiff !== 0 && (
                        <div className="mobile-impact-was">
                          was {formatCurrency(baseNwAt85)}
                          <span className={nwDiff > 0 ? 'was-arrow-up' : 'was-arrow-down'}>
                            {nwDiff > 0 ? '▲' : '▼'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}


          </div>

          {/* Sticky CTA Button at Bottom */}
          <div className="mobile-sticky-footer">
            <button 
              type="button" 
              className="mobile-sticky-btn"
              onClick={() => {
                setSelectedMobilePhaseId(null);
                handleSetBudgetClick(selectedPhaseObj.id);
              }}
            >
              Edit This Phase
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM TAB NAVIGATION */}
      {!editingEvent && (
        <nav className="mobile-bottom-nav">
          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'Plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('Plan')}
          >
            <Map size={20} />
            Plan
          </button>

          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'Results' ? 'active' : ''}`}
            onClick={() => setActiveTab('Results')}
          >
            <TrendingUp size={20} />
            Results
          </button>

          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'Details' ? 'active' : ''}`}
            onClick={() => setActiveTab('Details')}
          >
            <Settings size={20} />
            Details
          </button>
        </nav>
      )}

      {editingEvent && editingEvent.type === 'haveChild' ? (
        <MobileChildPlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setEditingEvent(null)}
        />
      ) : editingEvent && editingEvent.type === 'buyHouse' ? (
        <MobileHousePlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setEditingEvent(null)}
        />
      ) : editingEvent && (editingEvent.type === 'marriage' || editingEvent.type === 'get-married') ? (
        <MobileMarriagePlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setEditingEvent(null)}
          handleSetBudgetClick={budgetController?.handleSetBudgetClick}
          setIsBudgetOpenFromMarriageWizard={budgetController?.setIsBudgetOpenFromMarriageWizard}
        />
      ) : editingEvent && editingEvent.type === 'careerChange' ? (
        <MobileIncomeChangeModal
          scenario={scenario}
          eventController={eventController}
          onClose={() => setEditingEvent(null)}
        />
      ) : editingEvent && (
        <MobileEventWizard
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
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
          onClose={() => setEditingEvent(null)}
        />
      )}

      <ChildImpactModal
        eventController={eventController}
        scenario={scenario}
        recommendationController={recommendationController}
        childImpactSummary={childImpactSummary}
        inputs={inputs}
        setChildImpactSummary={setChildImpactSummary}
        setEditingEvent={setEditingEvent}
        setShowImprovementModal={setShowImprovementModal}
      />
      {isBudgetModalOpen && (
        <BudgetModal
          scenario={scenario}
          budgetController={budgetController}
          uiState={uiState}
          eventController={eventController}
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
        />
      )}
      {isSavingsDetailsOpen && (
        <SavingsDetailsModal
          budgetController={budgetController}
          savingsDetails={savingsDetails}
          setSavingsDetails={setSavingsDetails}
          setIsSavingsDetailsOpen={setIsSavingsDetailsOpen}
          handleSaveSavingsDetails={handleSaveSavingsDetails}
        />
      )}
      <CurrentConditionModal
        uiState={uiState}
        scenario={scenario}
        editingCondition={editingCondition}
        inputs={inputs}
        setEditingCondition={setEditingCondition}
        handleSaveCurrentCondition={handleSaveCurrentCondition}
      />

      {showImprovementModal && (
        <RetireSoonerModal
          scenario={scenario}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setShowImprovementModal(false)}
        />
      )}

      <LifeProfileModal
        isOpen={isLifeProfileOpen}
        onClose={() => setIsLifeProfileOpen(false)}
        inputs={inputs}
        updateInput={updateInput}
        initialTab={lifeProfileTab}
        isMobile={true}
        simulation={simulation?.activeResults || legacyActiveResults}
        handleCreateEvent={eventController?.handleCreateEvent || legacyHandleCreateEvent}
        handleEditRoadmapEvent={eventController?.handleEditRoadmapEvent || legacyHandleEditRoadmapEvent}
      />

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


      {/* Expanded Collapsed Cluster Events Bottom Sheet */}
      {expandedClusterEvents && (
        <div 
          className="modal-backdrop" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(10, 10, 18, 0.6)', 
            backdropFilter: 'blur(4px)', 
            zIndex: 2500, 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'center',
            padding: 0
          }}
          onClick={() => setExpandedClusterEvents(null)}
        >
          <div 
            className="mobile-bottom-sheet"
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '1.75rem',
              boxSizing: 'border-box',
              position: 'relative',
              textAlign: 'left',
              boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Slide up drag handle visual decoration */}
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 1.25rem auto' }} />

            {/* Close button in top-right */}
            <button 
              type="button" 
              onClick={() => setExpandedClusterEvents(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1.25rem',
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'var(--text-secondary)',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.1rem'
              }}
            >
              ×
            </button>

            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 1.25rem 0' }}>
              Hidden Events ({expandedClusterEvents.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {expandedClusterEvents.map((evt, idx) => (
                <div 
                  key={`${evt.originalId || evt.type}-${evt.age}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '48px',
                    borderBottom: idx < expandedClusterEvents.length - 1 ? '1px solid var(--border)' : 'none',
                    padding: '0 0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getEventIcon(evt) || '✨'}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {evt.type === 'today' ? 'Today' : evt.type === 'lifeExpectancy' ? 'Life Expectancy' : (evt.title || evt.label)}
                    </span>
                  </div>
                  {isEditableEvent(evt) && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedClusterEvents(null);
                        if (handleEditRoadmapEvent) {
                          handleEditRoadmapEvent(evt);
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Event Options Bottom Sheet */}
      {activeEventForSheet && (
        <div 
          className="modal-backdrop" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(10, 10, 18, 0.6)', 
            backdropFilter: 'blur(4px)', 
            zIndex: 2500, 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'center',
            padding: 0
          }}
          onClick={() => setActiveEventForSheet(null)}
        >
          <div 
            className="mobile-bottom-sheet"
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '1.75rem',
              boxSizing: 'border-box',
              position: 'relative',
              textAlign: 'left',
              boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Slide up drag handle visual decoration */}
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 1.25rem auto' }} />

            {/* Close button in top-right */}
            <button 
              type="button" 
              onClick={() => setActiveEventForSheet(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1.25rem',
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'var(--text-secondary)',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.1rem'
              }}
            >
              ×
            </button>

            {/* Event Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                background: 'var(--primary-light)', 
                border: '1px solid rgba(99, 102, 241, 0.3)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '1.6rem' 
              }}>
                {activeEventForSheet.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                  {activeEventForSheet.label || activeEventForSheet.title}
                </h3>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)', marginTop: '0.15rem', display: 'inline-block' }}>
                  Age {activeEventForSheet.age}
                </span>
              </div>
            </div>

            {/* Description/matters */}
            {(() => {
              const details = getRoadmapDetails(activeEventForSheet, formatCurrency, inputs);
              return details?.whyItMatters ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {details.whyItMatters}
                </p>
              ) : null;
            })()}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {isEditableEvent(activeEventForSheet) ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveEventForSheet(null);
                      handleEditRoadmapEvent(activeEventForSheet);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: 'var(--primary)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    <span>Edit Event Details</span>
                    <span>→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveEventForSheet(null);
                      if (window.confirm("Are you sure you want to delete this event? This will immediately remove it from your roadmap and recalculate your projection.")) {
                        if (handleDeleteEvent) {
                          handleDeleteEvent(activeEventForSheet);
                        } else if (handleDeleteRoadmapEvent) {
                          handleDeleteRoadmapEvent(activeEventForSheet);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      color: 'var(--accent-rose)',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Delete Event</span>
                    <span>→</span>
                  </button>
                </>
              ) : (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--text-tertiary)', 
                  textAlign: 'center', 
                  padding: '0.75rem 1rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontWeight: '500'
                }}>
                  <span>ℹ️</span> This milestone is calculated from your plan.
                </div>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
