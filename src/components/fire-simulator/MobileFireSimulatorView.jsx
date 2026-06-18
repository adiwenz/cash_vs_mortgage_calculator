/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect } from 'react';
import { 
  Home, 
  Map, 
  TrendingUp, 
  Settings, 
  ChevronRight, 
  ArrowLeft, 
  Sparkles,
  Info
} from 'lucide-react';
import { formatCurrency, getAssetLabel, isEditableEvent, formatYAxis } from './helpers';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot } from 'recharts';
import { getNormalizedPhases } from '../../fireCalculations';
import MobileTimeline, { getRoadmapDetails } from './MobileTimeline';
import MobileResults from './MobileResults';
import MobileEventWizard from './MobileEventWizard';
import EventModalForm from './EventModalForm';
import ChildImpactModal from './ChildImpactModal';
import BudgetModal from './BudgetModal';
import SavingsDetailsModal from './SavingsDetailsModal';
import { CurrentConditionModal } from './CurrentConditionsPanel';
import './MobileFireSimulator.css';

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
          const badgeColor = scenario.savingsFocus === 'Earn More' ? '#10b981' : scenario.savingsFocus === 'Save More' ? '#6366f1' : '#f59e0b';
          const badgeBg = scenario.savingsFocus === 'Earn More' ? 'rgba(16, 185, 129, 0.12)' : scenario.savingsFocus === 'Save More' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.12)';
          
          return (
            <div className="mobile-rec-card" key={scenario.type || idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
              <div className="mobile-rec-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 className="mobile-rec-card-title" style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>
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
  if (evt.type === 'retire') return 'Retire';
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
  if (evt.type.startsWith('retirementReady')) return 'Retire Ready';
  
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

export default function MobileFireSimulatorView({
  inputs,
  updateInput,
  displayMode,
  setDisplayMode,
  activeResults,
  displayedResults,
  selectedYear,
  setSelectedYear,
  chartData,
  validation,
  handleCreateEvent,
  handleEditRoadmapEvent,
  handleSetBudgetClick,
  handleOpenSavingsDetails,
  isMobile,
  totalNetWorth,
  activeStep,
  setActiveStep,
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
  getInputsWithEvent,
  handleApplyMobileRecommendation,
  setIsBudgetOpenFromMarriageWizard,
  isBudgetOpenFromMarriageWizard,
  tempSocialSecurityDetails,
  childImpactSummary,
  setChildImpactSummary,
  houseImpactSummary,
  setHouseImpactSummary,
  houseRebalanceSummary,
  setHouseRebalanceSummary,
  handleApplyRebalanceStrategy,
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
  budgetScalingMode,
  handleToggleBudgetScalingMode,
  isSavingsDetailsOpen,
  savingsDetails,
  setSavingsDetails,
  setIsSavingsDetailsOpen,
  handleSaveSavingsDetails,
  editingCondition,
  handleSaveCurrentCondition,
  setEditingCondition,
  notification,
  displayedBaselineResults,
  baselineResults,
  handleApplyImprovementScenario,
  improvementPlan,
  showImprovementModal,
  setShowImprovementModal
}) {
  const [activeTab, setActiveTab] = useState('Roadmap'); // 'Overview' | 'Roadmap' | 'Results' | 'Details'
  const [selectedMobilePhaseId, setSelectedMobilePhaseId] = useState(null);
  const [whyPhaseExistsOpen, setWhyPhaseExistsOpen] = useState(true);
  const [activeChart, setActiveChart] = useState('netWorth'); // 'netWorth' | 'assetsDebt' | 'progress' | 'incomeSpending'
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [isMobileLedgerExpanded, setIsMobileLedgerExpanded] = useState(false);
  const [expandedPhaseId, setExpandedPhaseId] = useState(null);

  // Sync scroll positions
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab, selectedMobilePhaseId]);

  // Derive Normalized Phases
  const normalizedPhases = useMemo(() => {
    return getNormalizedPhases(inputs);
  }, [inputs]);

  // Current Phase for Overview
  const currentAgePhase = useMemo(() => {
    const curAge = inputs.currentAge || 35;
    return normalizedPhases.find(p => curAge >= p.startAge && curAge < p.endAge) || normalizedPhases[0] || null;
  }, [normalizedPhases, inputs.currentAge]);

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
      tags.push({ text: 'Retirement', color: 'green' });
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
      items.push({ label: 'Retirement', value: 'Income reduced', isPositive: false });
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
        {/* OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <div>
            <h1 className="mobile-tab-title">Overview</h1>
            <p className="mobile-tab-subtitle">Your plan performance at a glance</p>

            {/* Hero Card */}
            <div className={`mobile-card ${isPlanOnTrack ? 'mobile-card-glow-green' : 'mobile-card-glow-purple'}`}>
              <div className="mobile-hero-status">
                <span className="mobile-hero-badge">Status</span>
                <span className="mobile-hero-msg">
                  {isPlanOnTrack 
                    ? "✨ You're fully on track!" 
                    : activeResults.retirementReadyAge === null
                      ? "⚠️ Plan requires adjustments"
                      : `⏳ Retirement delayed by ${retirementReadyDifference} years`
                  }
                </span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  {isPlanOnTrack 
                    ? "Your projected assets are sustainable and will last through your full life expectancy with safety margin."
                    : "Your budget or events cause a shortfall. Check the roadmap and recommendations to optimize your trajectory."
                  }
                </p>
              </div>
            </div>

            {/* Retirement Snapshot */}
            <div className="mobile-snapshot-grid">
              <div className="mobile-snapshot-item">
                <div className="mobile-snapshot-label">Retirement Age</div>
                <div className="mobile-snapshot-val" style={{ color: isPlanOnTrack ? '#10b981' : '#f59e0b' }}>
                  {activeResults.retirementReadyAge || 'N/A'}
                </div>
              </div>
              <div className="mobile-snapshot-item">
                <div className="mobile-snapshot-label">FI Number</div>
                <div className="mobile-snapshot-val">
                  {formatCurrency(displayedResults.fiNumber || 0)}
                </div>
              </div>
              <div className="mobile-snapshot-item">
                <div className="mobile-snapshot-label">Proj. Portfolio</div>
                <div className="mobile-snapshot-val">
                  {formatCurrency(displayedResults.portfolioAtRetirement || 0)}
                </div>
              </div>
            </div>

            {!isPlanOnTrack && (
              <div style={{ padding: '0 0.75rem' }}>
                <MobileRecommendationsPanel
                  improvementPlan={improvementPlan}
                  handleApplyMobileRecommendation={handleApplyMobileRecommendation || handleApplyImprovementScenario}
                  targetRetirementAge={inputs.targetRetirementAge}
                  showHeader={true}
                />
              </div>
            ) }

            {/* Current Phase Card */}
            {currentAgePhase && (
              <div 
                className="mobile-card" 
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedMobilePhaseId(currentAgePhase.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                      You are currently in
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{currentAgePhase.icon}</span>
                      <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{currentAgePhase.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: '600', marginTop: '0.1rem' }}>
                      Age {currentAgePhase.startAge}–{currentAgePhase.endAge}
                    </div>
                  </div>
                  <ChevronRight size={20} className="mobile-rec-arrow" />
                </div>
              </div>
            )}

            {/* Upcoming Event Card */}
            {upcomingEvent && (
              <div 
                className="mobile-card"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const idx = timelineEvents.findIndex(e => e.originalId === upcomingEvent.id || e.label === upcomingEvent.label);
                  if (idx !== -1) {
                    setSelectedEventIndex(idx);
                  }
                  setActiveTab('Roadmap');
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                      Next milestone
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>
                        {upcomingEvent.type === 'haveChild' ? '👶' : 
                         upcomingEvent.type === 'buyHouse' ? '🏠' : 
                         upcomingEvent.type === 'marriage' ? '💍' : 
                         upcomingEvent.type === 'retire' ? '🏖️' : '📅'}
                      </span>
                      <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                        {upcomingEvent.type === 'haveChild' 
                          ? `${upcomingEvent.childName || 'Child'} arrives` 
                          : upcomingEvent.type === 'buyHouse'
                            ? 'Buy home'
                            : upcomingEvent.type === 'marriage'
                              ? 'Get married'
                              : upcomingEvent.name || upcomingEvent.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: '600', marginTop: '0.1rem' }}>
                      In {upcomingEvent.diff} years (Age {upcomingEvent.eventAge})
                    </div>
                  </div>
                  <ChevronRight size={20} className="mobile-rec-arrow" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROADMAP TAB */}
        {activeTab === 'Roadmap' && (() => {
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

          const formatCompact = (val) => {
            if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
            if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}k`;
            return formatCurrency(val);
          };

          return (
            <div>
              <h1 className="mobile-tab-title">Interactive Roadmap</h1>
              <p className="mobile-tab-subtitle">Your life plan at a glance</p>

              {/* Status Card (Avatar & circular track gauge) */}
              <div className="mobile-status-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(20, 27, 47, 0.65)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '20px', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#1e293b', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', position: 'relative' }}>
                    👤
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Roadmap: <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>Path to FIRE</span></div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffffff', marginTop: '0.15rem' }}>
                      Current Status: <span style={{ color: '#60a5fa' }}>{inputs.currentAge < (activeResults.retirementReadyAge || 65) ? 'Working' : 'Retired'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffffff', marginTop: '0.1rem' }}>
                      Projected Retirement: <span style={{ color: isPlanOnTrack ? 'var(--accent-emerald)' : 'var(--accent-orange)' }}>
                        {activeResults.retirementReadyAge || 'N/A'} {isPlanOnTrack ? '(On track)' : '(Delayed)'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '58px', height: '58px' }}>
                  <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                    <circle cx="29" cy="29" r="24" fill="none" stroke={isPlanOnTrack ? 'var(--accent-emerald)' : 'var(--accent-orange)'} strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - (isPlanOnTrack ? 0.78 : 0.45))}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#ffffff', lineHeight: 1 }}>{isPlanOnTrack ? '78%' : '45%'}</span>
                    <span style={{ fontSize: '0.45rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '1px' }}>Track</span>
                  </div>
                </div>
              </div>




              {/* Life Journey Timeline */}
              <MobileTimeline
                inputs={inputs}
                timelineEvents={timelineEvents}
                selectedEventIndex={selectedEventIndex}
                setSelectedEventIndex={setSelectedEventIndex}
                handleEditRoadmapEvent={handleEditRoadmapEvent}
              />

              {/* Net Worth Graph & Projections KPIs Card */}
              {(() => {
                const selectedAge = timelineEvents[selectedEventIndex]?.age || inputs.currentAge;
                const selectedPoint = chartData.find(d => Number(d.age) === Number(selectedAge));
                const selectedNetWorth = selectedPoint ? selectedPoint.netWorth : 0;
                
                const eventAges = Array.from(new Set([
                  inputs.currentAge,
                  ...timelineEvents.map(e => Number(e.age)),
                  inputs.lifeExpectancy
                ])).sort((a, b) => a - b);

                return (
                  <div className="mobile-card" style={{ marginTop: '1.25rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <div>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                          📈 Net Worth Curve
                        </h3>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Highlighting Age {selectedAge}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '8px', height: '2px', background: '#a78bfa', display: 'inline-block' }}></span>
                          <span>Net Worth</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '8px', height: '2px', borderTop: '2px dashed #3b82f6', display: 'inline-block' }}></span>
                          <span>Income</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '8px', height: '2px', borderTop: '2px dashed #10b981', display: 'inline-block' }}></span>
                          <span>Expenses</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ height: '180px', width: '100%', marginLeft: '-15px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
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
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="custom-chart-tooltip" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.7rem' }}>
                                    <p style={{ fontWeight: '700', marginBottom: '0.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Age {label}</p>
                                    {payload.map((item) => (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', margin: '0.05rem 0' }}>
                                        <span style={{ color: item.stroke || item.color, fontWeight: '500' }}>{item.name}:</span>
                                        <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
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
                            stroke="#a78bfa"
                            strokeWidth={3}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="income"
                            name="Income"
                            stroke="#3b82f6"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="expenses"
                            name="Expenses"
                            stroke="#10b981"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={false}
                          />
                          {selectedAge !== null && (
                            <ReferenceLine
                              x={selectedAge}
                              stroke="var(--primary)"
                              strokeDasharray="3 3"
                              strokeWidth={1.5}
                            />
                          )}
                          {selectedAge !== null && selectedPoint && (
                            <ReferenceDot
                              x={selectedAge}
                              y={selectedNetWorth}
                              r={6}
                              fill="#a78bfa"
                              stroke="#ffffff"
                              strokeWidth={2}
                              isFront={true}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Projections KPIs stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Proj. NW</span>
                        <strong style={{ fontSize: '0.75rem', color: '#10b981', display: 'block', marginTop: '0.15rem' }}>
                          {formatCompact(finalNetWorth)}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em' }}>FI Conf.</span>
                        <strong style={{ fontSize: '0.75rem', color: '#a78bfa', display: 'block', marginTop: '0.15rem' }}>
                          {fiConfidence}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Monthly Burn</span>
                        <strong style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'block', marginTop: '0.15rem' }}>
                          {formatCurrency(burnVal)}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Success Rate</span>
                        <strong style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'block', marginTop: '0.15rem' }}>
                          {successRate}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}



              {/* Collapsible Budget Phases */}
              <section style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                <div className="mobile-section-header">
                  <h2 className="mobile-section-title">Budget Phases</h2>
                  <span className="mobile-section-subtitle">Tap a phase to view budget details</span>
                </div>

                <div className="mobile-phase-card-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {normalizedPhases.map((p, idx) => {
                    const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];
                    const badgeColor = colors[idx % colors.length];
                    const isExpanded = expandedPhaseId === p.id;

                    const totalExpenses = Object.values(p.expenses || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
                    const totalSavings = Object.values(p.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) +
                                         (p.isMarried ? Object.values(p.partnerSavings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0);

                    return (
                      <div 
                        key={p.id}
                        className={`mobile-phase-card ${isExpanded ? 'expanded' : ''}`}
                        style={{ display: 'flex', flexDirection: 'column', padding: '1rem', background: 'rgba(20, 27, 47, 0.65)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', cursor: 'pointer' }}
                        onClick={() => setExpandedPhaseId(isExpanded ? null : p.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div 
                              className="mobile-phase-badge-num"
                              style={{ backgroundColor: badgeColor, width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800', color: '#ffffff' }}
                            >
                              {idx + 1}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '0.95rem' }}>{p.icon}</span>
                                <span className="mobile-phase-card-title" style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ffffff' }}>{p.label}</span>
                              </div>
                              <span className="mobile-phase-card-age" style={{ fontSize: '0.8rem', color: '#a78bfa', display: 'block', marginTop: '0.1rem', fontWeight: '600' }}>Age {p.startAge}–{p.endAge}</span>
                            </div>
                          </div>
                          <ChevronRight size={18} style={{ color: 'var(--text-tertiary)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
                        </div>

                        {isExpanded && (
                          <div 
                            className="mobile-phase-expanded-content" 
                            style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem 0.5rem', textAlign: 'left' }}>
                              <div className="phase-metric-item">
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>💵 Income</span>
                                <strong style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', display: 'block', marginTop: '0.1rem' }}>
                                  {formatCurrency(p.income || 0)}/mo
                                </strong>
                              </div>
                              <div className="phase-metric-item">
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>💸 Expenses</span>
                                <strong style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', display: 'block', marginTop: '0.1rem' }}>
                                  {formatCurrency(totalExpenses)}/mo
                                </strong>
                              </div>
                              <div className="phase-metric-item">
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>💰 Savings</span>
                                <strong style={{ fontSize: '0.8rem', color: '#3b82f6', display: 'block', marginTop: '0.1rem' }}>
                                  {formatCurrency(totalSavings)}/mo
                                </strong>
                              </div>
                              <div className="phase-metric-item">
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>🏠 Housing Cost</span>
                                <strong style={{ fontSize: '0.8rem', color: '#ffffff', display: 'block', marginTop: '0.1rem' }}>
                                  {formatCurrency(p.expenses?.housing || 0)}/mo
                                </strong>
                              </div>
                              <div className="phase-metric-item">
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>👶 Children Cost</span>
                                <strong style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'block', marginTop: '0.1rem' }}>
                                  {formatCurrency(p.expenses?.childcare || 0)}/mo
                                </strong>
                              </div>
                              <div className="phase-metric-item">
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'block' }}>⚖️ Tax Status</span>
                                <strong style={{ fontSize: '0.8rem', color: '#ffffff', display: 'block', marginTop: '0.1rem' }}>
                                  {p.isMarried ? 'Married Joint' : 'Single'}
                                </strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="mobile-phase-edit-btn"
                              style={{ 
                                width: '100%', 
                                padding: '0.45rem', 
                                background: 'rgba(255,255,255,0.04)', 
                                border: '1px solid rgba(255,255,255,0.08)', 
                                borderRadius: '8px', 
                                fontSize: '0.7rem', 
                                color: 'var(--primary)', 
                                fontWeight: '600', 
                                cursor: 'pointer',
                                marginTop: '0.85rem'
                              }}
                              onClick={() => handleSetBudgetClick(p.id)}
                            >
                              ⚙️ Edit Budget Configuration
                            </button>

                            {/* Phase Recommendations Section */}
                            <div className="mobile-phase-recs-section" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                              <h4 style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ffffff' }}>
                                💡 Recommendations
                              </h4>
                              
                              {!isPlanOnTrack && improvementPlan?.rankedPlan?.length > 0 ? (
                                <MobileRecommendationsPanel
                                  improvementPlan={improvementPlan}
                                  handleApplyMobileRecommendation={handleApplyMobileRecommendation || handleApplyImprovementScenario}
                                  targetRetirementAge={inputs.targetRetirementAge}
                                  showHeader={false}
                                />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {p.label?.toLowerCase().includes('retirement') || p.icon === '🏖️' || p.icon === '🏖' ? (
                                    <>
                                      <div 
                                        className="mobile-rec-card"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}
                                        onClick={() => {
                                          const ssEv = inputs.lifeEvents?.find(e => e.type === 'socialSecurity' && e.enabled);
                                          if (ssEv) handleEditRoadmapEvent(ssEv);
                                        }}
                                      >
                                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                          <div style={{ fontSize: '1.25rem' }}>📅</div>
                                          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffffff' }}>Delay Social Security</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Delaying claiming to age 70 increases annual benefits by ~8% per year.</span>
                                          </div>
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                      </div>
                                      
                                      <div 
                                        className="mobile-rec-card"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}
                                        onClick={() => handleSetBudgetClick(p.id)}
                                      >
                                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                          <div style={{ fontSize: '1.25rem' }}>💸</div>
                                          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffffff' }}>Reduce Spending</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Cutting spending by $200/mo improves portfolio longevity projection.</span>
                                          </div>
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                      </div>
                                    </>
                                  ) : p.label?.toLowerCase().includes('child') || p.icon === '👶' ? (
                                    <div 
                                      className="mobile-rec-card"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}
                                    >
                                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                        <div style={{ fontSize: '1.25rem' }}>🍼</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffffff' }}>Optimize Childcare Costs</span>
                                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Look into tax-free Dependent Care FSAs to save up to 30% on childcare.</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div 
                                      className="mobile-rec-card"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}
                                      onClick={() => handleSetBudgetClick(p.id)}
                                    >
                                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                        <div style={{ fontSize: '1.25rem' }}>📈</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffffff' }}>Increase Savings Rate</span>
                                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Try allocating 1% more of your monthly income to investments.</span>
                                        </div>
                                      </div>
                                      <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="mobile-roadmap-edit-btn"
                  style={{ marginTop: '1rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  onClick={() => setEditingEvent({ type: 'selectType', isNew: true })}
                >
                  + Add Life Event
                </button>
              </section>

              {!editingEvent && (
                <button
                  type="button"
                  className="mobile-fab-btn animate-scale-in"
                  onClick={() => setEditingEvent({ type: 'selectType', isNew: true })}
                >
                  ➕ Add Life Event
                </button>
              )}
            </div>
          );
        })()}

        {/* RESULTS TAB */}
        {activeTab === 'Results' && (
          <div>
            <h1 className="mobile-tab-title">Results</h1>
            <p className="mobile-tab-subtitle">Compare projections and view progress charts</p>

            {/* Swipe Tab Bar */}
            <div className="mobile-chart-tabs-scroller">
              {[
                { id: 'netWorth', label: 'Net Worth' },
                { id: 'assetsDebt', label: 'Assets vs Debt' },
                { id: 'progress', label: 'Retirement Progress' },
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
              chartData={chartData}
              activeResults={activeResults}
              activeChart={activeChart}
              setActiveChart={setActiveChart}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
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
                        {formatCurrency(yearData.netWorth)}
                      </strong>
                    </div>
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Portfolio / Assets</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                        {formatCurrency(yearData.assets)}
                      </strong>
                    </div>
                    {yearData.debt > 0 && (
                      <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Total Debt</span>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--accent-rose)', display: 'block', marginTop: '0.15rem' }}>
                          {formatCurrency(yearData.debt)}
                        </strong>
                      </div>
                    )}
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Income</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                        {formatCurrency(yearData.income)}
                      </strong>
                    </div>
                    <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Spending</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                        {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
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
                        {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
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

            {/* Advanced Configuration */}
            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <div className="mobile-details-group-title">🛠️ Advanced Configuration</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                <div className="mobile-input-row-align-start">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Readiness Criteria</span>
                    <span className="mobile-input-desc">What determines a successful plan</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <select
                      className="mobile-input-box"
                      style={{ textAlign: 'left', paddingRight: '0.2rem', fontSize: '0.75rem' }}
                      value={inputs.readinessCriteria || 'lastsComfortable'}
                      onChange={(e) => updateInput('readinessCriteria', e.target.value)}
                    >
                      <option value="lastsLifeExp">Sustainable (Lasts Life Exp)</option>
                      <option value="lastsComfortable">Comfortable (Life Exp + 10 yrs)</option>
                      <option value="lastsIndefinitely">SWR Capital Preservation</option>
                    </select>
                  </div>
                </div>

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
                <div className="mobile-budget-income-val">{formatCurrency(selectedPhaseObj.income || 0)}</div>
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
                      <div className="mobile-budget-cat-val val-red">{formatCurrency(phaseNeedsTotal)}</div>
                      <div className="mobile-budget-cat-pct">{needsPct}%</div>
                    </div>
                    <div className="mobile-budget-cat">
                      <div className="mobile-budget-cat-label">Wants</div>
                      <div className="mobile-budget-cat-val val-orange">{formatCurrency(phaseWantsTotal)}</div>
                      <div className="mobile-budget-cat-pct">{wantsPct}%</div>
                    </div>
                    <div className="mobile-budget-cat">
                      <div className="mobile-budget-cat-label">Save & Invest</div>
                      <div className="mobile-budget-cat-val val-blue">
                        {phaseSavingsTotal < 0 ? '-' : ''}{formatCurrency(Math.abs(phaseSavingsTotal))}
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
                      <div className="mobile-impact-label">Retirement Age</div>
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

            {/* Recommendations stack */}
            <div className="mobile-card" style={{ textAlign: 'left' }}>
              <h3 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                💡 Recommendations
              </h3>

              <div className="mobile-recs-stack">
                {!isPlanOnTrack && improvementPlan?.rankedPlan?.length > 0 ? (
                  <MobileRecommendationsPanel
                    improvementPlan={improvementPlan}
                    handleApplyMobileRecommendation={handleApplyMobileRecommendation || handleApplyImprovementScenario}
                    targetRetirementAge={inputs.targetRetirementAge}
                    showHeader={false}
                  />
                ) : selectedPhaseObj.label?.toLowerCase().includes('retirement') || selectedPhaseObj.icon === '🏖️' || selectedPhaseObj.icon === '🏖' ? (
                  <>
                    <div 
                      className="mobile-rec-card"
                      onClick={() => {
                        const ssEv = inputs.lifeEvents?.find(e => e.type === 'socialSecurity' && e.enabled);
                        if (ssEv) handleEditRoadmapEvent(ssEv);
                      }}
                    >
                      <div className="mobile-rec-left">
                        <div className="mobile-rec-icon-box">📅</div>
                        <div className="mobile-rec-info">
                          <span className="mobile-rec-title">Delay Social Security</span>
                          <span className="mobile-rec-desc">Delaying claiming to age 70 increases annual benefits by ~8% per year.</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="mobile-rec-arrow" />
                    </div>
                    
                    <div 
                      className="mobile-rec-card"
                      onClick={() => handleSetBudgetClick(selectedPhaseObj.id)}
                    >
                      <div className="mobile-rec-left">
                        <div className="mobile-rec-icon-box">💸</div>
                        <div className="mobile-rec-info">
                          <span className="mobile-rec-title">Reduce Spending</span>
                          <span className="mobile-rec-desc">Cutting spending by $200/mo improves portfolio longevity projection.</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="mobile-rec-arrow" />
                    </div>
                  </>
                ) : selectedPhaseObj.label?.toLowerCase().includes('child') || selectedPhaseObj.icon === '👶' ? (
                  <>
                    <div 
                      className="mobile-rec-card"
                      onClick={() => {
                        handleCreateEvent('careerChange');
                      }}
                    >
                      <div className="mobile-rec-left">
                        <div className="mobile-rec-icon-box">💼</div>
                        <div className="mobile-rec-info">
                          <span className="mobile-rec-title">Increase income</span>
                          <span className="mobile-rec-desc">+$500/mo extra income could offset childcare costs.</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="mobile-rec-arrow" />
                    </div>

                    <div 
                      className="mobile-rec-card"
                      onClick={() => handleSetBudgetClick(selectedPhaseObj.id)}
                    >
                      <div className="mobile-rec-left">
                        <div className="mobile-rec-icon-box">⚙️</div>
                        <div className="mobile-rec-info">
                          <span className="mobile-rec-title">Adjust savings allocation</span>
                          <span className="mobile-rec-desc">Optimize pre-tax vs brokerage funding in this high-expense phase.</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="mobile-rec-arrow" />
                    </div>
                  </>
                ) : (
                  <>
                    <div 
                      className="mobile-rec-card"
                      onClick={() => handleSetBudgetClick(selectedPhaseObj.id)}
                    >
                      <div className="mobile-rec-left">
                        <div className="mobile-rec-icon-box">💰</div>
                        <div className="mobile-rec-info">
                          <span className="mobile-rec-title">Increase savings rate</span>
                          <span className="mobile-rec-desc">Boost 401(k) allocations by 3% to take advantage of compound growth.</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="mobile-rec-arrow" />
                    </div>

                    <div 
                      className="mobile-rec-card"
                      onClick={() => {
                        setSelectedMobilePhaseId(null);
                        setActiveTab('Details');
                      }}
                    >
                      <div className="mobile-rec-left">
                        <div className="mobile-rec-icon-box">📈</div>
                        <div className="mobile-rec-info">
                          <span className="mobile-rec-title">Adjust asset allocation</span>
                          <span className="mobile-rec-desc">Review expected pre-retirement returns for long-term growth.</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="mobile-rec-arrow" />
                    </div>
                  </>
                )}
              </div>
            </div>
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
            className={`mobile-nav-item ${activeTab === 'Overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('Overview')}
          >
            <Home size={20} />
            Overview
          </button>

          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'Roadmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('Roadmap')}
          >
            <Map size={20} />
            Roadmap
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

      {/* Overlays / Modals */}
      {editingEvent && (
        <MobileEventWizard
          inputs={inputs}
          editingEvent={editingEvent}
          setEditingEvent={setEditingEvent}
          handleSaveEvent={handleSaveEvent}
          handleDeleteEvent={handleDeleteEvent}
          onClose={() => setEditingEvent(null)}
          getInputsWithEvent={getInputsWithEvent}
          baselineResults={baselineResults}
          handleApplyMobileRecommendation={handleApplyMobileRecommendation}
          improvementPlan={improvementPlan}
          houseImpactSummary={houseImpactSummary}
          setHouseImpactSummary={setHouseImpactSummary}
          houseRebalanceSummary={houseRebalanceSummary}
          setHouseRebalanceSummary={setHouseRebalanceSummary}
          handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
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
