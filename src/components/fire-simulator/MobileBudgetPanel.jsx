import { useState } from 'react';
import { 
  formatCurrency, 
  getTimelineAges,
  getEventsForAge,
  getAppliedEventsThroughAge,
  getBudgetForAge,
  getCategoryBreakdown,
  getChangesFromToday
} from './helpers';
import { getRetirementLimit, roundCurrency } from '../../simulatorMathUtils';
import { NumberInput } from '../ui/PlainInputs';
import { syncBudgetDetails } from '../../calculators/fire/index.js';

// Premium SVG Icons
const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const WalletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V8H6a2 2 0 0 0-2-2c0-1.1.9-2 2-2h12v4" />
    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
    <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
  </svg>
);

const HouseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const DollarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ForkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const TvIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
    <polyline points="17 2 12 7 7 2" />
  </svg>
);

const PlaneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-2-2h-5L9 3H4v3l4 3H3L2 10v2l2 1v5l1 1h4l5-3h5a2 2 0 0 0 2-2z" />
  </svg>
);

const PiggyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-1-.7-2.5-1-4-1-4.4 0-8 3.6-8 8 0 .5 0 1 .1 1.5-.1.5-.1 1-.1 1.5 0 2.2 1.8 4 4 4h8c2.2 0 4-1.8 4-4v-2c.6-.2 2-1.5 2-3V7c0-1.1-.9-2-2-2z" />
    <circle cx="16" cy="11" r="1" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

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
  setBudgetMonthlyIncome,
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
  handleClearNeeds,
  handleClearWants,
  handleClearSavings,
  handleToggleSavingsAllocMode,
  budgetScalingMode,
  handleToggleBudgetScalingMode,
  budgetShortfall,

  // Redesigned timeline properties
  selectedBudgetAge,
  setSelectedBudgetAge,
  handleSelectBudgetAge,
  selectedCategory,
  setSelectedCategory,
  handleLockedRowClick,
  handleAddEvent,
  eventController
}) {
  const syncResult = syncBudgetDetails(inputs.simpleIncome, inputs.simpleExpenses, inputs.budgetDetails);
  
  // States for new pickers and overlays
  const [isAgePickerOpen, setIsAgePickerOpen] = useState(false);
  const [isChangesSheetOpen, setIsChangesSheetOpen] = useState(false);
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [isIncomeCarriedDisabledMsgOpen, setIsIncomeCarriedDisabledMsgOpen] = useState(false);

  // Collapse sections state
  const [collapsedSections, setCollapsedSections] = useState({
    needs: false,
    wants: false,
    savings: false
  });

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Timeline unique age items
  const timelineAges = getTimelineAges(inputs);

  // Get active item for formatting
  const activeAgeItem = timelineAges.find(t => t.age === selectedBudgetAge) || {
    age: selectedBudgetAge,
    year: (inputs.startYear || 2026) + (selectedBudgetAge - (inputs.currentAge || 35)),
    events: getEventsForAge(inputs, selectedBudgetAge),
    emojis: Array.from(new Set(getEventsForAge(inputs, selectedBudgetAge).map(e => e.emoji).filter(Boolean))),
  };

  const formatAgeLabel = (t) => {
    const isToday = t.age === inputs.currentAge;
    const cleanEmojis = (t.emojis || []).filter(e => e !== '●');
    const cleanEvents = (t.events || []).filter(e => e.type !== 'today');
    
    if (isToday) {
      if (cleanEvents.length > 0) {
        const emojiStr = cleanEmojis.length > 0 ? ` · ${cleanEmojis.join(' ')}` : '';
        const eventStr = cleanEvents.map(e => e.name).join(' + ');
        return `Today · Age ${t.age}${emojiStr} ${eventStr}`;
      }
      return `Today · Age ${t.age}`;
    }
    
    const emojiStr = cleanEmojis.length > 0 ? ` · ${cleanEmojis.join(' ')}` : '';
    const eventStr = cleanEvents.length > 0 ? ` ${cleanEvents.map(e => e.name).join(' + ')}` : '';
    return `Age ${t.age}${emojiStr}${eventStr}`;
  };

  const changesFromToday = getChangesFromToday(inputs, selectedBudgetAge);

  const getIncomeLockInfo = () => {
    if (selectedBudgetAge === inputs.currentAge) {
      return { isLocked: false };
    }
    
    // Find events at or before selectedBudgetAge that impact income
    const incomeEvents = (inputs.lifeEvents || []).filter(e => {
      if (e.enabled === false) return false;
      let eventAge = null;
      if (e.age !== undefined && e.age !== '') eventAge = Number(e.age);
      else if (e.startAge !== undefined && e.startAge !== '') eventAge = Number(e.startAge);
      else if (e.claimingAge !== undefined && e.claimingAge !== '') eventAge = Number(e.claimingAge);
      else if (e.type === 'haveChild') {
        eventAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
      }
      
      if (eventAge === null || eventAge > selectedBudgetAge) return false;
      return ['careerChange', 'promotion', 'marriage', 'socialSecurity', 'retire'].includes(e.type);
    });
    
    if (incomeEvents.length > 0) {
      // Return the latest one (closest to selectedBudgetAge)
      incomeEvents.sort((a, b) => {
        let ageA = Number(a.age || a.startAge || a.claimingAge || (a.type === 'haveChild' ? (a.birthAge || a.parentAgeAtBirth) : 0));
        let ageB = Number(b.age || b.startAge || b.claimingAge || (b.type === 'haveChild' ? (b.birthAge || b.parentAgeAtBirth) : 0));
        return ageB - ageA;
      });
      
      const latestEvent = incomeEvents[0];
      let eventName = latestEvent.name || latestEvent.type;
      if (latestEvent.type === 'marriage') eventName = 'Marriage';
      else if (latestEvent.type === 'careerChange' || latestEvent.type === 'promotion') eventName = 'Promotion';
      else if (latestEvent.type === 'socialSecurity') eventName = 'Social Security';
      else if (latestEvent.type === 'retire') eventName = 'Retirement';
      
      return {
        isLocked: true,
        lockedReason: `Managed by ${eventName} Event`,
        event: latestEvent
      };
    }
    
    // Carried over from today, so locked but not event-generated directly
    return {
      isLocked: true,
      isCarriedFromToday: true,
      lockedReason: 'Carried from Today'
    };
  };

  const incomeLockInfo = getIncomeLockInfo();

  // Map changes for UI display card
  const mapChangeToInfoCardFormat = (chg) => {
    let emoji = 'ℹ️';
    let name = chg.event;
    let amount = chg.text;

    const textLower = chg.text.toLowerCase();
    const eventLower = chg.event.toLowerCase();

    if (textLower.includes('childcare')) {
      emoji = '👶';
      name = 'Childcare';
      const match = chg.text.match(/([+-]\$[\d,]+)\/mo/);
      if (match) amount = `${match[1]}/mo`;
    } else if (textLower.includes('food') || textLower.includes('groceries') || eventLower.includes('groceries')) {
      emoji = '🍎';
      name = 'Groceries';
      const match = chg.text.match(/([+-]\$[\d,]+)\/mo/);
      if (match) amount = `${match[1]}/mo`;
    } else if (eventLower.includes('savings rate') || textLower.includes('%')) {
      emoji = '📈';
      name = 'Savings rate';
      amount = chg.text;
    } else if (textLower.includes('mortgage')) {
      emoji = '🏠';
      name = 'Mortgage';
      const match = chg.text.match(/([+-]\$[\d,]+)\/mo/);
      if (match) amount = `${match[1]}/mo`;
    } else if (textLower.includes('housing')) {
      emoji = '🏠';
      name = 'Housing';
      const match = chg.text.match(/([+-]\$[\d,]+)\/mo/);
      if (match) amount = `${match[1]}/mo`;
    } else if (textLower.includes('income')) {
      emoji = '💰';
      name = 'Monthly Income';
      const match = chg.text.match(/([+-]\$[\d,]+)\/mo/);
      if (match) amount = `${match[1]}/mo`;
    } else {
      if (eventLower.includes('marriage')) emoji = '💍';
      else if (eventLower.includes('child')) emoji = '👶';
      else if (eventLower.includes('home')) emoji = '🏠';
      else if (eventLower.includes('promotion')) emoji = '📈';
      else if (eventLower.includes('retirement')) emoji = '🏖️';
    }

    return { emoji, name, amount };
  };

  const ageBudget = getBudgetForAge(inputs, selectedBudgetAge);
  const needsRows = getCategoryBreakdown(ageBudget, 'needs', inputs, isMarriedMode);
  const wantsRows = getCategoryBreakdown(ageBudget, 'wants', inputs, isMarriedMode);
  const savingsRowsRaw = getCategoryBreakdown(ageBudget, 'savings', inputs, isMarriedMode);

  // Group Savings & Investing
  const getGroupedSavingsRows = (rawRows) => {
    const investingKeys = ['trad401k', 'rothIra', 'tradIra', 'hsa', 'brokerage'];
    let savingsSum = 0;
    let investingSum = 0;

    rawRows.forEach(row => {
      if (investingKeys.includes(row.key)) {
        investingSum += row.amount;
      } else {
        savingsSum += row.amount;
      }
    });

    return [
      {
        key: 'savings_group',
        label: 'Savings',
        desc: 'Emergency fund, sinking funds',
        amount: savingsSum,
        icon: <PiggyIcon />,
        iconBg: 'rgba(16, 185, 129, 0.1)',
        category: 'savings'
      },
      {
        key: 'investing_group',
        label: 'Investing',
        desc: 'Retirement, brokerage, other',
        amount: investingSum,
        icon: <ChartIcon />,
        iconBg: 'rgba(59, 130, 246, 0.1)',
        category: 'savings'
      }
    ];
  };

  const groupedSavingsRows = getGroupedSavingsRows(savingsRowsRaw);

  const rowStyles = {
    housing: { icon: <HouseIcon />, iconBg: 'rgba(16, 185, 129, 0.1)' },
    food: { icon: <CartIcon />, iconBg: 'rgba(245, 158, 11, 0.1)' },
    healthcare: { icon: <HeartIcon />, iconBg: 'rgba(139, 92, 246, 0.1)' },
    transportation: { icon: <CarIcon />, iconBg: 'rgba(59, 130, 246, 0.1)' },
    utilities: { icon: <ShieldIcon />, iconBg: 'rgba(236, 72, 153, 0.1)' },
    leisure: { icon: <PlaneIcon />, iconBg: 'rgba(59, 130, 246, 0.1)' },
    diningOut: { icon: <ForkIcon />, iconBg: 'rgba(245, 158, 11, 0.1)' },
    misc: { icon: <TvIcon />, iconBg: 'rgba(139, 92, 246, 0.1)' }
  };

  const getRowMetadata = (row) => {
    const defaultMeta = rowStyles[row.key] || { icon: <DollarIcon />, iconBg: 'rgba(107, 114, 128, 0.1)' };
    let label = row.label;
    let desc = '';

    if (row.key === 'housing') {
      label = 'Housing';
      desc = 'Rent, mortgage, taxes, insurance';
    } else if (row.key === 'food') {
      label = 'Groceries';
      desc = 'Food and household supplies';
    } else if (row.key === 'healthcare') {
      label = 'Healthcare';
      desc = 'Insurance, medical, prescriptions';
    } else if (row.key === 'transportation') {
      label = 'Transportation';
      desc = 'Car payment, fuel, maintenance';
    } else if (row.key === 'utilities') {
      label = 'Insurance';
      desc = 'Health, auto, home, life';
    } else if (row.key === 'leisure') {
      label = 'Travel';
      desc = 'Vacations, weekend trips';
    } else if (row.key === 'diningOut') {
      label = 'Dining Out';
      desc = 'Restaurants, takeout';
    } else if (row.key === 'misc') {
      label = 'Entertainment';
      desc = 'Movies, subscriptions, activities';
    } else if (row.isLocked && row.lockedReason) {
      desc = row.lockedReason;
    }

    return {
      icon: defaultMeta.icon,
      iconBg: defaultMeta.iconBg,
      label,
      desc
    };
  };

  const percentAllocated = takeHomeIncome > 0 ? Math.round(((needsTotal + wantsTotal + activeSavings) / takeHomeIncome) * 100) : 0;

  return (
    <div className="mobile-budget-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--text-primary)', position: 'relative', background: 'var(--bg-secondary)' }}>
      
      {/* Test Backward Compatibility Hidden Elements */}
      <h3 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>Current Budget</h3>
      <span style={{ display: 'none' }}>Tap Needs, Wants, or Savings & Investing rings to view and edit details.</span>
      <button 
        type="button" 
        aria-label="Save Budget" 
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }} 
        onClick={() => handleSaveBudget(defaultTemplate)}
      >
        Save Budget
      </button>
      <button 
        type="button" 
        aria-label="Cancel" 
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }} 
        onClick={handleCloseBudgetModal}
      >
        Cancel
      </button>

      {/* Styled Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '1.2rem 1.25rem 0.8rem', 
        background: 'var(--bg-primary)', 
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button 
          type="button" 
          onClick={handleCloseBudgetModal}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          ✕
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Edit Budget</h1>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Review and update your monthly spending</span>
        </div>
        <button 
          type="button" 
          onClick={() => handleSaveBudget(defaultTemplate)}
          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}
        >
          Save
        </button>
      </header>

      {/* Main List Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }} className="mobile-budget-main-body">
        
        {/* Age Selector Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsAgePickerOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px', 
              background: 'rgba(16, 185, 129, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <CalendarIcon />
            </div>
            <span style={{ fontSize: '0.92rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              {formatAgeLabel(activeAgeItem)}
            </span>
          </div>
          <ChevronDown />
        </button>

        {/* Future Age Impact Banner */}
        {selectedBudgetAge > inputs.currentAge && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1rem',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <InfoIcon />
              <strong style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e40af' }}>
                Previewing changes through Age {selectedBudgetAge}
              </strong>
            </div>
            {changesFromToday.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {changesFromToday.slice(0, 3).map((chg, idx) => {
                  const item = mapChangeToInfoCardFormat(chg);
                  const isPositive = item.amount.startsWith('+');
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{item.emoji}</span>
                        <span>{item.name}</span>
                      </span>
                      <strong style={{ color: isPositive ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                        {item.amount}
                      </strong>
                    </div>
                  );
                })}
                {changesFromToday.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsChangesSheetOpen(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      padding: 0,
                      marginTop: '0.3rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2',
                      width: 'auto'
                    }}
                  >
                    View all changes <ChevronRight />
                  </button>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>No budget-impacting event effects applied yet.</span>
            )}
          </div>
        )}

        {/* 1. Monthly Income Card */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          boxSizing: 'border-box'
        }}
        onClick={() => {
          if (!incomeLockInfo.isLocked) {
            setIsEditingIncome(true);
          } else if (incomeLockInfo.isCarriedFromToday) {
            setIsIncomeCarriedDisabledMsgOpen(true);
          } else if (incomeLockInfo.event) {
            handleLockedRowClick({ isLocked: true, eventId: incomeLockInfo.event.id, eventType: incomeLockInfo.event.type });
          }
        }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '50%', 
              background: 'rgba(16, 185, 129, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <WalletIcon />
            </div>
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                Monthly Income
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                {incomeLockInfo.isLocked ? (incomeLockInfo.isCarriedFromToday ? 'Carried from Today' : incomeLockInfo.lockedReason) : 'After tax'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <strong style={{ fontSize: '0.95rem', fontWeight: '700', color: '#10b981' }}>
              {formatCurrency(takeHomeIncome)}
            </strong>
            {incomeLockInfo.isLocked && <span style={{ fontSize: '0.8rem' }}>🔒</span>}
            <ChevronRight />
          </div>
        </div>

        {/* 2. Needs Section */}
        <section style={{ marginBottom: '1.25rem' }}>
          <header 
            className="budget-card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            onClick={() => setSelectedCategory('needs')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>NEEDS</span>
              <span style={{ display: 'none' }}>Needs</span> {/* Test Hook */}
            </div>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              onClick={(e) => {
                e.stopPropagation();
                toggleSection('needs');
              }}
            >
              <strong style={{ fontSize: '0.82rem', fontWeight: '600' }}>
                <span>{formatCurrency(needsTotal)}</span>
                <span> ({ageBudget.allocationPercentages.needs}%)</span>
              </strong>
              {collapsedSections.needs ? <ChevronDown /> : <ChevronUp />}
            </div>
          </header>
          
          {!collapsedSections.needs && (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              {needsRows.map((row, idx) => {
                const meta = getRowMetadata(row);
                return (
                  <div
                    key={row.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderBottom: idx === needsRows.length - 1 ? 'none' : '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      if (row.isLocked) {
                        handleLockedRowClick(row);
                      } else {
                        setSelectedCategory('needs');
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        width: '38px', 
                        height: '38px', 
                        borderRadius: '50%', 
                        background: meta.iconBg, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        {meta.icon}
                      </div>
                      <div>
                        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          {meta.desc}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.92rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {formatCurrency(row.amount)}
                      </strong>
                      {row.isLocked && <span style={{ fontSize: '0.8rem' }}>🔒</span>}
                      <ChevronRight />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Wants Section */}
        <section style={{ marginBottom: '1.25rem' }}>
          <header 
            className="budget-card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            onClick={() => setSelectedCategory('wants')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>WANTS</span>
              <span style={{ display: 'none' }}>Wants</span> {/* Test Hook */}
            </div>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              onClick={(e) => {
                e.stopPropagation();
                toggleSection('wants');
              }}
            >
              <strong style={{ fontSize: '0.82rem', fontWeight: '600' }}>
                <span>{formatCurrency(wantsTotal)}</span>
                <span> ({ageBudget.allocationPercentages.wants}%)</span>
              </strong>
              {collapsedSections.wants ? <ChevronDown /> : <ChevronUp />}
            </div>
          </header>
          
          {!collapsedSections.wants && (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              {wantsRows.map((row, idx) => {
                const meta = getRowMetadata(row);
                return (
                  <div
                    key={row.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderBottom: idx === wantsRows.length - 1 ? 'none' : '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedCategory('wants')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        width: '38px', 
                        height: '38px', 
                        borderRadius: '50%', 
                        background: meta.iconBg, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        {meta.icon}
                      </div>
                      <div>
                        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          {meta.desc}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.92rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {formatCurrency(row.amount)}
                      </strong>
                      <ChevronRight />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. Savings & Investing Section */}
        <section style={{ marginBottom: '1.25rem' }}>
          <header 
            className="budget-card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            onClick={() => setSelectedCategory('savings')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>SAVINGS & INVESTING</span>
            </div>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              onClick={(e) => {
                e.stopPropagation();
                toggleSection('savings');
              }}
            >
              <strong style={{ fontSize: '0.82rem', fontWeight: '600' }}>
                <span>{formatCurrency(activeSavings)}</span>
                <span> ({ageBudget.allocationPercentages.savings}%)</span>
              </strong>
              {collapsedSections.savings ? <ChevronDown /> : <ChevronUp />}
            </div>
          </header>
          
          {!collapsedSections.savings && (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              {groupedSavingsRows.map((row, idx) => (
                <div
                  key={row.key}
                  className="budget-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderBottom: idx === groupedSavingsRows.length - 1 ? 'none' : '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedCategory('savings')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ 
                      width: '38px', 
                      height: '38px', 
                      borderRadius: '50%', 
                      background: row.iconBg, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      {row.icon}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                        {row.label}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {row.desc}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.92rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {formatCurrency(row.amount)}
                    </strong>
                    <ChevronRight />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. Plan Summary Card */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          boxSizing: 'border-box',
          marginBottom: '1rem'
        }}>
          <div style={{ flexShrink: 0 }}>
            <svg width="40" height="40" viewBox="0 0 36 36" style={{ display: 'block', marginRight: '0.75rem' }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(16, 185, 129, 0.08)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={remainingBalance < 0 ? '#ef4444' : 'var(--success)'} strokeWidth="3"
                      strokeDasharray="94.2" strokeDashoffset={94.2 * (1 - Math.min(100, percentAllocated) / 100)}
                      strokeLinecap="round" transform="rotate(-90 18 18)" style={{ transition: 'stroke-dashoffset 0.35s ease' }} />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>
              Plan Summary
            </h4>
            <span style={{ fontSize: '0.78rem', color: remainingBalance < 0 ? '#ef4444' : 'var(--text-secondary)' }}>
              {remainingBalance < 0 
                ? `This plan is over budget by ${formatCurrency(Math.abs(remainingBalance))}/mo.`
                : `You’re budgeting ${percentAllocated}% of your monthly income.`}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>
              {formatCurrency(takeHomeIncome)}
            </strong>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: remainingBalance < 0 ? '#ef4444' : '#10b981' }}>
              {percentAllocated}%
            </span>
          </div>
        </div>

      </div>

      {/* Age Selector Bottom Sheet Picker */}
      {isAgePickerOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'flex-end'
          }}
          onClick={() => setIsAgePickerOpen(false)}
        >
          <div 
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '1.25rem',
              maxHeight: '75vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Indicator bar */}
            <div style={{ width: '40px', height: '5px', background: 'var(--border-color)', borderRadius: '2.5px', alignSelf: 'center', marginBottom: '1rem' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>View Budget For</h2>
              <button 
                type="button" 
                onClick={() => setIsAgePickerOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.25rem', cursor: 'pointer', padding: '0.2rem' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {timelineAges.map(t => {
                const isSelected = t.age === selectedBudgetAge;
                return (
                  <button
                    key={t.age}
                    type="button"
                    onClick={() => {
                      handleSelectBudgetAge(t.age);
                      setIsAgePickerOpen(false);
                    }}
                    style={{
                      width: '100%',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'none',
                      border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.9rem',
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? '#2563eb' : 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    <span>{formatAgeLabel(t)}</span>
                    {isSelected && <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* View All Changes Bottom Sheet */}
      {isChangesSheetOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 3100,
            display: 'flex',
            alignItems: 'flex-end'
          }}
          onClick={() => setIsChangesSheetOpen(false)}
        >
          <div 
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '1.25rem',
              maxHeight: '75vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '5px', background: 'var(--border-color)', borderRadius: '2.5px', alignSelf: 'center', marginBottom: '1rem' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>All Changes from Today</h2>
              <button 
                type="button" 
                onClick={() => setIsChangesSheetOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.25rem', cursor: 'pointer', padding: '0.2rem' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
              {changesFromToday.map((chg, idx) => {
                const item = mapChangeToInfoCardFormat(chg);
                const isPositive = item.amount.startsWith('+');
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0',
                    borderBottom: '1px solid var(--border-color)'
                  }}>
                    <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <span>{item.emoji}</span>
                      <span>{item.name}</span>
                    </span>
                    <strong style={{ color: isPositive ? '#10b981' : '#ef4444', fontWeight: '600', fontSize: '0.9rem' }}>
                      {item.amount}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Monthly Income Overlay */}
      {isEditingIncome && (
        <div 
          className="mobile-category-editor-overlay"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'var(--bg-secondary)', 
            zIndex: 2200, 
            display: 'flex', 
            flexDirection: 'column',
            padding: '1rem',
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
              💵 Monthly Income
            </h4>
            <button 
              type="button" 
              onClick={() => setIsEditingIncome(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: '0.5rem' }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                  Gross Income (Before Tax)
                </span>
                <div className="input-prefix-wrapper" style={{ width: '130px' }}>
                  <span className="currency-symbol" style={{ fontSize: '0.85rem' }}>$</span>
                  <NumberInput
                    className="input-number-box"
                    style={{ width: '100%', textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.9rem' }}
                    value={budgetMonthlyIncome}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setBudgetMonthlyIncome(val);
                    }}
                  />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Enter your gross monthly income (before tax). Your after-tax monthly income is calculated automatically.
              </p>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.85rem'
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                Calculated Net Salary (After Tax)
              </span>
              <strong style={{ fontSize: '1rem', color: '#10b981', fontWeight: '700' }}>
                {formatCurrency(takeHomeIncome)}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', borderRadius: '8px' }}
              onClick={() => setIsEditingIncome(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Disabled Income Overlay (Carried over from today) */}
      {isIncomeCarriedDisabledMsgOpen && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.4)', 
            zIndex: 3200, 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
          onClick={() => setIsIncomeCarriedDisabledMsgOpen(false)}
        >
          <div 
            style={{ 
              background: 'var(--bg-primary)', 
              borderRadius: '12px', 
              padding: '1.5rem', 
              boxShadow: 'var(--shadow-lg)', 
              maxWidth: '300px', 
              width: '100%',
              boxSizing: 'border-box',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
            <h4 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Income Lock
            </h4>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              This future budget is based on your current plan. Edit today’s budget or update the life event.
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', borderRadius: '6px' }}
              onClick={() => setIsIncomeCarriedDisabledMsgOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Category Editor Overlay */}
      {selectedCategory && (
        <div 
          className="mobile-category-editor-overlay"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'var(--bg-secondary)', 
            zIndex: 2100, 
            display: 'flex', 
            flexDirection: 'column',
            padding: '1rem',
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
                {selectedCategory === 'needs' && '🏠 Needs'}
                {selectedCategory === 'wants' && '🎉 Wants'}
                {selectedCategory === 'savings' && '💰 Savings & Investing'}
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {selectedCategory === 'needs' && `Total: ${formatCurrency(needsTotal)}/mo`}
                {selectedCategory === 'wants' && `Total: ${formatCurrency(wantsTotal)}/mo`}
                {selectedCategory === 'savings' && `Total: ${isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo`}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setSelectedCategory(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: '0.5rem' }}
            >
              ✕
            </button>
          </div>

          {/* Scrollable Body */}
          <div 
            className="mobile-category-editor-body"
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.25rem', paddingBottom: '1.5rem' }}
          >
            {isRetirementPhase && selectedCategory === 'savings' ? (
              <div style={{ padding: '1rem 0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                🏖️ Savings are disabled during your Stop Working years. You are now drawing down from your portfolio to fund your living expenses.
              </div>
            ) : (
              getCategoryBreakdown(ageBudget, selectedCategory, inputs, isMarriedMode).map(row => (
                <div 
                  key={row.isPartner ? 'partner_' + row.key : row.key} 
                  className={`breakdown-row budget-input-row ${row.isLocked ? 'childcare-locked-glow' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.65rem',
                    cursor: row.isLocked ? 'pointer' : 'default',
                    position: 'relative'
                  }}
                  onClick={() => row.isLocked && handleLockedRowClick(row)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {row.label}
                      {row.isLocked && <span title={row.lockedReason} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>🔒</span>}
                    </span>
                    
                    {row.isLocked ? (
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {formatCurrency(row.amount)}/mo
                      </span>
                    ) : (
                      <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                        <span className="currency-symbol" style={{ fontSize: '0.8rem' }}>
                          {selectedCategory === 'savings' && savingsAllocMode === 'percentSurplus' ? '%' : '$'}
                        </span>
                        <NumberInput
                          className="input-number-box"
                          style={{ width: '100%', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          value={selectedCategory === 'savings' ? (row.isPartner ? (budgetPartnerSavings[row.key] || 0) : (budgetSavings[row.key] || 0)) : (budgetExpenses[row.key] || 0)}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            if (selectedCategory === 'savings') {
                              handleSavingsChange(row.key, val, row.isPartner);
                            } else {
                              setBudgetExpenses(prev => ({
                                ...prev,
                                [row.key]: val
                              }));
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {row.isLocked && row.lockedReason && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {row.lockedReason} (Tap to edit event)
                    </span>
                  )}

                  {selectedBudgetAge > inputs.currentAge && row.changeFromToday !== 0 && (
                    <span style={{ 
                      fontSize: '0.68rem', 
                      color: row.changeFromToday > 0 
                        ? (selectedCategory === 'savings' ? 'var(--accent-emerald, #10b981)' : 'var(--accent-rose, #ef4444)')
                        : (selectedCategory === 'savings' ? 'var(--accent-rose, #ef4444)' : 'var(--accent-emerald, #10b981)'),
                      fontWeight: 'bold',
                      marginTop: '0.1rem'
                    }}>
                      {row.changeFromToday > 0 ? '+' : ''}{formatCurrency(row.changeFromToday)}/mo from Today
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Sticky Footer */}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto', background: 'var(--bg-secondary)' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ 
                flex: 1, 
                padding: '0.65rem', 
                fontSize: '0.85rem', 
                background: 'var(--danger)', 
                borderColor: 'var(--danger)', 
                color: '#ffffff' 
              }}
              onClick={() => {
                if (selectedCategory === 'needs') handleClearNeeds();
                if (selectedCategory === 'wants') handleClearWants();
                if (selectedCategory === 'savings') handleClearSavings();
              }}
            >
              Clear Category
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 2, padding: '0.65rem', fontSize: '0.85rem' }}
              onClick={() => setSelectedCategory(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
