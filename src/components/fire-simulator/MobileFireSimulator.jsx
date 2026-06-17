import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Home, 
  Map, 
  TrendingUp, 
  Settings, 
  ChevronRight, 
  ArrowLeft, 
  Bell, 
  Sparkles,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { formatCurrency, formatYAxis, getOutcomeDetails, getAssetLabel, isEditableEvent } from './helpers';
import { getNormalizedPhases } from '../../fireCalculations';
import MobileEventWizard from './MobileEventWizard';
import './MobileFireSimulator.css';

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

const getRoadmapDetails = (evt, formatCurrency) => {
  if (!evt) return null;

  let title = getShortLabel(evt);
  let ageLabel = `Starts at Age ${evt.age}`;
  let benefitLabel = null;
  let benefitValue = null;
  let whyItMatters = '';

  if (evt.description) {
    const yrMatch = evt.description.match(/(\$[0-9,]+)\/year/);
    const moMatch = evt.description.match(/(\$[0-9,]+)\/month/);
    if (yrMatch) {
      benefitLabel = 'Estimated Benefit';
      benefitValue = `${yrMatch[1]}/year`;
      if (moMatch) {
        benefitValue += ` (${moMatch[1]}/month)`;
      }
    }
  }

  switch (evt.type) {
    case 'socialSecurity':
      title = 'Social Security';
      whyItMatters = 'Provides guaranteed, inflation-adjusted retirement income and reduces the drawdown rate required from your investment portfolios.';
      break;
    case 'medicareEligibility':
      title = 'Medicare';
      whyItMatters = 'You become eligible for Medicare. Healthcare insurance premium expenses drop significantly, which increases portfolio longevity.';
      const premMatch = evt.description?.match(/(\$[0-9,]+)\/yr/g);
      if (premMatch && premMatch.length >= 2) {
        benefitLabel = 'Healthcare Premium Impact';
        benefitValue = `Drops from ${premMatch[0]} to ${premMatch[1]} annually`;
      }
      break;
    case 'retire':
      title = 'Target Retirement';
      ageLabel = `Begins at Age ${evt.age}`;
      whyItMatters = 'Transition from the wealth accumulation stage to the wealth preservation and portfolio distribution stage.';
      break;
    case 'haveChild':
      whyItMatters = 'Welcoming a child introduces childcare, support, and education expenses, reducing your monthly savings capacity temporarily.';
      break;
    case 'childSupportEnds':
      whyItMatters = 'Child support and childcare expenses end, freeing up significant cash flow to accelerate retirement savings.';
      break;
    case 'marriage':
      title = 'Marriage';
      whyItMatters = 'Combines household incomes, tax brackets, and sharing living expenses (like housing and utilities) to increase savings rate.';
      if (evt.spouseIncome) {
        benefitLabel = 'Spouse Details';
        benefitValue = `Income: ${formatCurrency(evt.spouseIncome)}/yr | Savings: ${evt.savingsRate || 0}%`;
      }
      break;
    case 'buyHouse':
      whyItMatters = 'Purchasing a home builds equity but introduces mortgage debt, property taxes, and ongoing maintenance costs.';
      break;
    case 'sellHouse':
      whyItMatters = 'Liquidates home equity, converting real estate value into investable brokerage assets to generate passive income.';
      break;
    case 'mortgageOff':
      whyItMatters = 'Eliminates monthly mortgage payments, dramatically reducing core living expenses and decreasing FI requirements.';
      break;
    case 'college':
      title = 'College Tuition';
      whyItMatters = 'Covers tuition and college costs. Temporary high spending phase funded via cash flow or dedicated child savings.';
      break;
    case 'sabbatical':
      title = 'Sabbatical';
      whyItMatters = 'Temporary break from work. Reduces income short-term to prioritize life experiences and well-being.';
      break;
    case 'coastFire':
      title = 'Coast FIRE Reached';
      ageLabel = `Achieved at Age ${evt.age}`;
      whyItMatters = 'Your existing portfolio is large enough to grow and fully cover retirement expenses by your target age without further savings.';
      break;
    case 'retirementReadySurvival':
    case 'retirementReadyComfortable':
    case 'retirementReadySWR':
      title = 'Retirement Ready';
      ageLabel = `Achieved at Age ${evt.age}`;
      whyItMatters = 'Your assets have reached the sustainability threshold, meaning you can stop working and support your lifestyle forever.';
      break;
    default:
      whyItMatters = evt.description || 'Occurs as part of your financial and life journey.';
      break;
  }

  return {
    title,
    ageLabel,
    benefitLabel,
    benefitValue,
    whyItMatters,
    description: evt.description
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

export default function MobileFireSimulator({
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
  handleSaveEvent,
  handleDeleteEvent,
  getInputsWithEvent,
  displayedBaselineResults,
  baselineResults,
  handleApplyMobileRecommendation,
  improvementPlan
}) {
  const [activeTab, setActiveTab] = useState('Roadmap'); // 'Overview' | 'Roadmap' | 'Results' | 'Details'
  const [selectedMobilePhaseId, setSelectedMobilePhaseId] = useState(null);
  const [whyPhaseExistsOpen, setWhyPhaseExistsOpen] = useState(true);
  const [activeChart, setActiveChart] = useState('netWorth'); // 'netWorth' | 'assetsDebt' | 'progress' | 'incomeSpending'
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [pulsingPhaseId, setPulsingPhaseId] = useState(null);
  const prevEventsLength = useRef(inputs.lifeEvents?.length || 0);

  useEffect(() => {
    if (!editingEvent) {
      let phaseToPulse = null;
      if (window.pulsePhaseId) {
        phaseToPulse = window.pulsePhaseId;
        window.pulsePhaseId = null;
      } else {
        const currentLength = inputs.lifeEvents?.length || 0;
        if (currentLength > prevEventsLength.current) {
          const lastEvent = inputs.lifeEvents[inputs.lifeEvents.length - 1];
          if (lastEvent) {
            if (lastEvent.type === 'haveChild') phaseToPulse = 'childcare';
            else if (lastEvent.type === 'marriage') phaseToPulse = 'marriage';
            else if (lastEvent.type === 'retire') phaseToPulse = 'retire';
            else if (lastEvent.type === 'buyHouse') phaseToPulse = 'mortgage';
            else if (lastEvent.type === 'careerChange') phaseToPulse = 'careerChange';
            else phaseToPulse = lastEvent.type;
          }
        }
      }

      if (phaseToPulse) {
        setPulsingPhaseId(phaseToPulse);
        const timer = setTimeout(() => {
          setPulsingPhaseId(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
    prevEventsLength.current = inputs.lifeEvents?.length || 0;
  }, [editingEvent, inputs.lifeEvents]);

  // Sync scroll positions and tab state
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
      let eventAge = null;
      if (e.type === 'haveChild') eventAge = Number(e.birthAge);
      else if (e.type === 'buyHouse') eventAge = Number(e.purchaseAge);
      else if (e.type === 'marriage') eventAge = Number(e.marriageAge || e.age || e.startAge);
      else if (e.type === 'socialSecurity') eventAge = Number(e.claimingAge);
      else if (e.type === 'retire') eventAge = Number(e.age);
      else eventAge = Number(e.age || e.startAge || e.purchaseAge || e.birthAge || e.claimingAge || e.ageReceived);

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

  // Selected Event Object for Details Card
  const selectedEvent = useMemo(() => {
    if (!timelineEvents || timelineEvents.length === 0) return null;
    if (selectedEventIndex >= timelineEvents.length) {
      return timelineEvents[0];
    }
    return timelineEvents[selectedEventIndex];
  }, [timelineEvents, selectedEventIndex]);

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

  // Determine Retirement Delay/Outcome
  const isRetirementReadyDelayed = activeResults.retirementReadyAge > inputs.targetRetirementAge;
  const retirementReadyDifference = activeResults.retirementReadyAge - inputs.targetRetirementAge;
  const isPlanOnTrack = activeResults.retirementOutcome === 'comfortable' || activeResults.retirementOutcome === 'sustainable';

  return (
    <div className="mobile-layout-container">
      {/* Brand Header */}
      <header className="mobile-brand-header">
        <span className="mobile-logo-text">
          <Sparkles size={20} className="mobile-logo-sparkle" fill="#a78bfa" />
          Finley
        </span>
        <button type="button" className="mobile-icon-btn" aria-label="Notifications">
          <Bell size={18} />
        </button>
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
                  handleApplyMobileRecommendation={handleApplyMobileRecommendation}
                  targetRetirementAge={inputs.targetRetirementAge}
                  showHeader={true}
                />
              </div>
            )}

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
        {activeTab === 'Roadmap' && (
          <div>
            <h1 className="mobile-tab-title">Interactive Roadmap</h1>
            <p className="mobile-tab-subtitle">Your life plan at a glance</p>

            {/* Top Overview Badges (Retirement Age and Current Child Costs) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="mobile-snapshot-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>🏖️ Retirement Age</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.2rem 0' }}>{activeResults.retirementReadyAge || 'N/A'}</span>
                <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                  {isPlanOnTrack ? 'On track' : 'Adjustments needed'}
                </span>
              </div>
              
              {currentAgePhase && (
                <div className="mobile-snapshot-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{currentAgePhase.icon} Current Phase</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0.35rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {currentAgePhase.label}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: '#a78bfa', fontWeight: '700' }}>
                    Age {currentAgePhase.startAge}–{currentAgePhase.endAge}
                  </span>
                </div>
              )}
            </div>

            {/* Life Events Scrolling Row (Roadmap Style) */}
            <section className="mobile-milestones-section">
              <div className="mobile-section-header">
                <h2 className="mobile-section-title">Life Events</h2>
                <span className="mobile-section-subtitle">Tap a milestone to view details</span>
              </div>
              
              <div className="mobile-roadmap-track">
                <div className="mobile-roadmap-scroll-container">
                  {/* Connecting Roadmap Line */}
                  {timelineEvents.length > 0 && (
                    <div 
                      className="mobile-roadmap-line-container"
                      style={{
                        width: `${timelineEvents.length * 6}rem`,
                      }}
                    >
                      <div 
                        className="mobile-roadmap-line" 
                        style={{
                          left: '3rem',
                          right: '3rem',
                        }}
                      />
                      <div 
                        className="mobile-roadmap-line-active" 
                        style={{
                          left: '3rem',
                          width: `${selectedEventIndex * 6}rem`,
                        }}
                      />
                    </div>
                  )}

                  {timelineEvents.map((evt, idx) => {
                    let circleColor = 'circle-purple';
                    if (evt.type === 'haveChild') circleColor = 'circle-blue';
                    else if (evt.type === 'retire') circleColor = 'circle-green';
                    else if (evt.type === 'socialSecurity') circleColor = 'circle-gold';

                    const isSelected = selectedEventIndex === idx;
                    const shortLabel = getShortLabel(evt);

                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`mobile-roadmap-milestone ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedEventIndex(idx)}
                      >
                        <div className={`mobile-roadmap-circle ${isSelected ? 'active' : ''} ${circleColor}`}>
                          <span>{evt.icon}</span>
                        </div>
                        <span className="mobile-roadmap-age">{evt.age}</span>
                        <span className="mobile-roadmap-label-text">{shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Event Details Card */}
              {selectedEvent && (() => {
                const details = getRoadmapDetails(selectedEvent, formatCurrency);
                return (
                  <div className="mobile-roadmap-details-card">
                    <div className="mobile-roadmap-details-header">
                      <span className="mobile-roadmap-details-icon">{selectedEvent.icon}</span>
                      <div className="mobile-roadmap-details-title-col">
                        <h3 className="mobile-roadmap-details-title">{details.title}</h3>
                        <span className="mobile-roadmap-details-age-badge">{details.ageLabel}</span>
                      </div>
                    </div>
                    
                    <div className="mobile-roadmap-details-content">
                      {details.benefitLabel && (
                        <div className="mobile-roadmap-details-section-item">
                          <span className="mobile-roadmap-details-lbl">{details.benefitLabel}</span>
                          <span className="mobile-roadmap-details-val highlight-purple">{details.benefitValue}</span>
                        </div>
                      )}

                      {details.whyItMatters && (
                        <div className="mobile-roadmap-details-section-item">
                          <span className="mobile-roadmap-details-lbl">Why it matters</span>
                          <p className="mobile-roadmap-details-desc">{details.whyItMatters}</p>
                        </div>
                      )}

                      {details.description && details.description !== details.whyItMatters && (!details.whyItMatters || !details.whyItMatters.includes(details.description)) && (
                        <div className="mobile-roadmap-details-section-item">
                          <span className="mobile-roadmap-details-lbl">Details</span>
                          <p className="mobile-roadmap-details-desc">{details.description}</p>
                        </div>
                      )}
                    </div>

                    {isEditableEvent(selectedEvent) && (
                      <button
                        type="button"
                        className="mobile-roadmap-edit-btn"
                        onClick={() => handleEditRoadmapEvent(selectedEvent)}
                      >
                        ⚙️ Edit Event
                      </button>
                    )}
                  </div>
                );
              })()}
            </section>

            {/* Budget Phases Stack */}
            <section style={{ textAlign: 'left' }}>
              <div className="mobile-section-header">
                <h2 className="mobile-section-title">Budget Phases</h2>
                <span className="mobile-section-subtitle">Tap a phase to view budget details</span>
              </div>

              <div className="mobile-phase-card-list">
                {normalizedPhases.map((p, idx) => {
                  // Cycle phase badge colors
                  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];
                  const badgeColor = colors[idx % colors.length];

                  const isPulsing = pulsingPhaseId && (
                    p.type === pulsingPhaseId || 
                    p.id.startsWith(pulsingPhaseId) ||
                    (pulsingPhaseId === 'childcare' && p.type === 'childcare') ||
                    (pulsingPhaseId === 'marriage' && p.type === 'marriage') ||
                    (pulsingPhaseId === 'retire' && p.type === 'retire')
                  );

                  return (
                    <div 
                      key={p.id}
                      className={`mobile-phase-card ${isPulsing ? 'pulse-highlight-phase' : ''}`}
                      onClick={() => setSelectedMobilePhaseId(p.id)}
                    >
                      <div 
                        className="mobile-phase-badge-num"
                        style={{ backgroundColor: badgeColor }}
                      >
                        {idx + 1}
                      </div>
                      <div className="mobile-phase-card-info">
                        <div className="mobile-phase-card-header">
                          <span style={{ fontSize: '1.05rem' }}>{p.icon}</span>
                          <span className="mobile-phase-card-title">{p.label}</span>
                        </div>
                        <span className="mobile-phase-card-age">Age {p.startAge}–{p.endAge}</span>
                        <span className="mobile-phase-card-desc">{getPhaseDriverDesc(p, idx)}</span>
                      </div>
                      <ChevronRight size={20} className="mobile-phase-card-arrow" />
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
        )}

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
            <div className="mobile-card mobile-chart-carousel" style={{ padding: '1.0rem 0.5rem' }}>
              <div className="mobile-chart-header" style={{ padding: '0 0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                  {activeChart === 'netWorth' ? '📈 Projected Net Worth Timeline' :
                   activeChart === 'assetsDebt' ? '📊 Assets and Debt Breakdown' :
                   activeChart === 'progress' ? '🎯 Portfolio vs FI Target' :
                   '💵 Cash Flow (Income vs Expenses)'}
                </span>
              </div>

              <div style={{ height: '240px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis
                      dataKey="age"
                      stroke="var(--text-tertiary)"
                      fontSize={9}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontSize={9}
                      tickFormatter={formatYAxis}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="custom-chart-tooltip" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                              <p style={{ fontWeight: '700', marginBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Age {label}</p>
                              {payload.map((item) => (
                                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.0rem', margin: '0.1rem 0' }}>
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
                    
                    {activeChart === 'netWorth' && (
                      <Line
                        type="monotone"
                        dataKey="netWorth"
                        name="Net Worth"
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    )}

                    {activeChart === 'assetsDebt' && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="assets"
                          name="Assets"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="debt"
                          name="Debt"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          dot={false}
                        />
                      </>
                    )}

                    {activeChart === 'progress' && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="portfolio"
                          name="Portfolio Balance"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="fiNumber"
                          name="FI Target"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                        {activeResults.retirementReadyAge && (
                          <ReferenceLine
                            x={activeResults.retirementReadyAge}
                            stroke="#10b981"
                            strokeWidth={1.5}
                            label={{ value: `Age ${activeResults.retirementReadyAge} Ready`, fill: '#10b981', fontSize: 8, position: 'top' }}
                          />
                        )}
                      </>
                    )}

                    {activeChart === 'incomeSpending' && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="income"
                          name="Income"
                          stroke="#0d9488"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="expenses"
                          name="Expenses"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="taxes"
                          name="Taxes"
                          stroke="#64748b"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Dots Controls */}
              <div className="mobile-chart-dots">
                {['netWorth', 'assetsDebt', 'progress', 'incomeSpending'].map(chart => (
                  <span
                    key={chart}
                    className={`mobile-chart-dot ${activeChart === chart ? 'active' : ''}`}
                    onClick={() => setActiveChart(chart)}
                  />
                ))}
              </div>
            </div>
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
            <button type="button" className="mobile-icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </button>
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
                // Pre-retirement contributions
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
                // Post-retirement withdrawals
                const withdrawalAmt = Math.abs(phaseSavingsTotal);
                allocations.push(
                  { key: 'brokerage', label: 'Taxable Brokerage', amount: Math.round(withdrawalAmt * 0.5), pct: 50 },
                  { key: 'rothIra', label: 'Roth IRA', amount: Math.round(withdrawalAmt * 0.3), pct: 30 },
                  { key: 'cash', label: 'Cash Reserve', amount: Math.round(withdrawalAmt * 0.2), pct: 20 }
                );
              }

              // Color classes cycling
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
                    handleApplyMobileRecommendation={handleApplyMobileRecommendation}
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
                        // Open Career/Income addition
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
                        // Switch to Details to adjust return rates
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

      {/* MOBILE EVENT WIZARD OVERLAY */}
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
        />
      )}
    </div>
  );
}
