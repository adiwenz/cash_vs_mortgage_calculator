import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
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
import { formatCurrency, formatYAxis, getOutcomeDetails, isEditableEvent, isFinancialEvent } from './helpers';
import { ChildCostsBuckets } from './ChildImpactModal';
import CurrentSituationCard from './CurrentSituationCard';
import OutcomeHeroCard from './OutcomeHeroCard';
import ProjectionGraph from './ProjectionGraph';
import { propPIAmount, getActiveChildrenCountAtAge } from '../../simulatorMathUtils';
import { getSocialSecurityFactor, getProfileFromInputs, getEventsFromInputs, buildSimulationDebugSnapshot, getNormalizedPhases } from '../../fireCalculations';

const generateLifeStory = (inp, results) => {
  const list = [];
  const curAge = inp.currentAge || 35;
  
  inp.incomeList.forEach(inc => {
    if (inc.startAge > curAge) {
      const isIncrease = inc.incomeChangeType === 'increaseByAmount';
      const amountVal = isIncrease 
        ? (inc.salaryIncrease !== undefined ? inc.salaryIncrease : inc.amount) 
        : (inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount);
      list.push({
        age: inc.startAge,
        text: `Start new career: "${inc.name}" earning ${isIncrease ? 'an extra ' : ''}${formatCurrency(amountVal)}/yr`
      });
    }
  });

  inp.spendingPhases.forEach(phase => {
    if (phase.startAge > curAge) {
      list.push({
        age: phase.startAge,
        text: `Change lifestyle: "${phase.name}" costing ${formatCurrency(phase.frequency === 'monthly' ? phase.amount * 12 : phase.amount)}/yr${phase.movingCost ? ` (one-time moving cost: ${formatCurrency(phase.movingCost)})` : ''}`
      });
    }
  });

  inp.lifeEvents.forEach(ev => {
    if (ev.enabled) {
      if (ev.type === 'buyHouse') {
        const asset = (ev.houseId && inp.houseAssets)
          ? inp.houseAssets.find(h => h.id === ev.houseId)
          : ev;
        const price = asset ? (asset.homePrice !== undefined ? asset.homePrice : asset.purchasePrice) : ev.homePrice;
        const pType = asset ? asset.purchaseType : ev.purchaseType;
        const ageVal = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
        list.push({
          age: ageVal,
          text: `Buy a home for ${formatCurrency(price)} (${pType === 'cash' ? 'in cash' : 'with mortgage'})`
        });
      } else if (ev.type === 'haveChild') {
        const supportEndParentAge = Number(ev.birthAge) + (ev.includeCollege ? 22 : 18);
        const childCurrentAge = Math.max(0, curAge - Number(ev.birthAge));
        const bornText = Number(ev.birthAge) < curAge 
          ? `(already born, current age ${childCurrentAge}, support ends at parent age ${supportEndParentAge})` 
          : `(support ends at parent age ${supportEndParentAge})`;
        list.push({
          age: Number(ev.birthAge),
          text: `Have a child${ev.childName ? ` "${ev.childName}"` : ''} ${bornText}`
        });
      } else if (ev.type === 'college') {
        list.push({
          age: Number(ev.startAge),
          text: `Start paying college tuition of ${formatCurrency(ev.tuitionCost)}/yr`
        });
      } else if (ev.type === 'windfall') {
        list.push({
          age: Number(ev.ageReceived),
          text: `Receive a windfall of ${formatCurrency(ev.amount)}`
        });
      } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
        const label = ev.type === 'socialSecurity' ? 'Social Security' : ev.name || 'Retirement Income';
        let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
        const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
        if (ev.type === 'socialSecurity') {
          if (claimingAge < 62) {
            monthlyBenefit = 0;
          } else {
            monthlyBenefit = monthlyBenefit * getSocialSecurityFactor(claimingAge);
          }
        }
        list.push({
          age: claimingAge,
          text: `Receive ${label} benefits (${formatCurrency(monthlyBenefit)}/mo${ev.type === 'socialSecurity' && claimingAge !== 67 ? ' - claiming age adjusted' : ''})`
        });
      } else if (ev.type === 'marriage') {
        const startAge = ev.weddingAge !== undefined ? Number(ev.weddingAge) : Number(ev.age);
        let text = `Get married`;
        if (ev.includeWeddingCost) {
          const isFinanced = ['debt', 'finance', 'financed', 'loan'].includes(ev.weddingFundingMethod);
          const userAssets = (inp.assets?.cash || 0) + 
                             (inp.assets?.emergencyFund || 0) + 
                             (inp.assets?.brokerage || 0) + 
                             (inp.assets?.trad401k || 0) + 
                             (inp.assets?.tradIra || 0) + 
                             (inp.assets?.rothIra || 0) + 
                             (inp.assets?.hsa || 0) + 
                             (inp.assets?.other || 0);
          const spouseAssets = Number(ev.cash || 0) + Number(ev.investments || 0) + Number(ev.retirement || 0);
          const totalLiquidAssets = userAssets + spouseAssets;
          const inflationRateVal = (Number(inp.inflationRate) || 3) / 100;
          const nominalFactor = Math.pow(1 + inflationRateVal, Math.max(0, startAge - curAge));
          const totalCost = (Number(ev.weddingCost) || 0) * nominalFactor;

          if (isFinanced) {
            const isEntire = ['finance', 'financed', 'loan'].includes(ev.weddingFundingMethod);
            const financedAmount = isEntire ? totalCost : Math.max(0, totalCost - totalLiquidAssets);
            const paidFromSavings = totalCost - financedAmount;

            if (financedAmount > 0 && paidFromSavings > 0) {
              text = `Get married — ${formatCurrency(paidFromSavings)} paid from savings, ${formatCurrency(financedAmount)} financed`;
            } else if (financedAmount > 0) {
              text = `Get married — wedding financed, ${formatCurrency(financedAmount)} debt added`;
            } else {
              text = `Get married — ${formatCurrency(totalCost)} paid from savings`;
            }
          } else {
            text = `Get married — ${formatCurrency(totalCost)} paid from savings`;
          }
        }
        list.push({
          age: startAge,
          text
        });
      } else {
        const age = Number(ev.age || ev.startAge || ev.payoffAge || ev.purchaseAge || ev.birthAge || ev.ageReceived || ev.claimingAge || ev.transferAge || 0);
        let desc = `Event: ${ev.name || 'Custom'}`;
        if (ev.type === 'debtPayoff') {
          desc = `Pay off debt: "${ev.name || 'Debt Payoff'}" costing ${formatCurrency(ev.amount)}`;
        } else if (ev.type === 'sabbatical') {
          desc = `Take sabbatical "${ev.name || 'Sabbatical'}" until age ${ev.endAge}`;
        } else if (ev.type === 'baristaFire') {
          desc = `Transition to Barista FIRE (expenses: ${formatCurrency(ev.annualExpenses)}/yr)`;
        } else if (ev.type === 'coastFire') {
          desc = `Transition to Coast FIRE`;
        } else if (ev.type === 'assetTransfer') {
          desc = `Transfer ${formatCurrency(ev.amount)} from ${ev.fromAsset || 'portfolio'} to ${ev.toAsset || 'portfolio'}`;
        }
        list.push({
          age,
          text: desc
        });
      }
    }
  });

  list.sort((a, b) => a.age - b.age);

  const criteria = inp.readinessCriteria;
  const roadmapLabel = criteria === 'lastsLifeExp' ? 'Sustainable' : criteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite';
  const retirementReadyAge = results.retirementReadyAge;
  if (retirementReadyAge) {
    const targetValForStory = criteria === 'lastsLifeExp'
      ? results.retirementReadyTargetSurvival
      : criteria === 'lastsComfortable'
        ? results.retirementReadyTargetComfortable
        : results.retirementReadyTarget;
    list.push({
      age: retirementReadyAge,
      text: `<strong style="color: var(--accent-emerald)">Reach ${roadmapLabel} Financial Freedom (Target: ${formatCurrency(targetValForStory)})</strong>`
    });
  }

  if (results.runOutAge) {
    list.push({
      age: results.runOutAge,
      text: `<strong style="color: var(--accent-rose)">Assets Depleted: investable assets reach zero</strong>`
    });
  }

  if (list.length === 0) {
    return (
      <div className="plan-summary-story-card">
        <p className="plan-summary-story-text" style={{ margin: 0 }}>
          No future events yet. Add some life decisions using the dropdown above to build your roadmap!
        </p>
      </div>
    );
  }

  return (
    <div className="plan-summary-story-card">
      <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.50rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>
        Your Life Story Roadmap
      </h3>
      <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {list.map((item, idx) => (
          <li key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Age <strong>{item.age}</strong>: <span dangerouslySetInnerHTML={{ __html: item.text }} />
          </li>
        ))}
      </ul>
    </div>
  );
};



const downloadTimelineCSV = (timeline) => {
  if (!timeline || timeline.length === 0) return;
  const headers = [
    'Age', 'Year', 'Gross Income', 'Taxes', 'Net Income', 'Expenses',
    'Contributions', 'Withdrawals', 'Investment Growth', 'Debt Balance',
    'Asset Balance', 'Net Worth', 'Scaling Mode', 'Multiplier', 'Budget Drift',
    'Stop Working Status', 'Active Events', 'Warnings/Errors',
    'Routing Source', 'Ignored Rules', 'Routing Warning',
    'Brokerage Starting Balance', 'Brokerage Explicit Contribution',
    'Brokerage Allocation Rule Contribution', 'Brokerage Surplus Fallback Contribution',
    'Brokerage Transfer Contribution', 'Brokerage Growth', 'Brokerage Ending Balance',
    'Brokerage Expected Ending Balance', 'Brokerage Discrepancy'
  ];

  const csvRows = [headers.join(',')];

  timeline.forEach(row => {
    const activeEventsEscaped = `"${(row.activeEvents || []).join('; ')}"`;
    const warningsEscaped = `"${(row.warningsErrors || []).join('; ')}"`;
    const ignoredRulesEscaped = `"${(row.ignoredAllocationRules || []).join('; ')}"`;
    const routingWarningEscaped = `"${row.routingWarning || ''}"`;
    const routingSourceEscaped = `"${row.contributionRoutingSource || ''}"`;

    const audit = row.brokerageAudit || {};

    const line = [
      row.age,
      row.year,
      row.grossIncome,
      row.taxes,
      row.netIncome,
      row.expenses,
      row.contributions,
      row.withdrawals,
      row.investmentGrowth,
      row.debtBalance,
      row.assetBalance,
      row.netWorth,
      row.budgetScalingMode || 'lifestyle',
      row.scalingMultiplier !== undefined ? row.scalingMultiplier.toFixed(4) : '1.0000',
      row.budgetDrift !== undefined ? row.budgetDrift.toFixed(2) : '0.00',
      row.retirementStatus,
      activeEventsEscaped,
      warningsEscaped,
      routingSourceEscaped,
      ignoredRulesEscaped,
      routingWarningEscaped,
      audit.startingBalance !== undefined ? audit.startingBalance.toFixed(2) : '0.00',
      audit.explicitContribution !== undefined ? audit.explicitContribution.toFixed(2) : '0.00',
      audit.allocationRuleContribution !== undefined ? audit.allocationRuleContribution.toFixed(2) : '0.00',
      audit.surplusFallbackContribution !== undefined ? audit.surplusFallbackContribution.toFixed(2) : '0.00',
      audit.transferContribution !== undefined ? audit.transferContribution.toFixed(2) : '0.00',
      audit.growth !== undefined ? audit.growth.toFixed(2) : '0.00',
      audit.endingBalance !== undefined ? audit.endingBalance.toFixed(2) : '0.00',
      audit.expectedEndingBalance !== undefined ? audit.expectedEndingBalance.toFixed(2) : '0.00',
      audit.discrepancy !== undefined ? audit.discrepancy.toFixed(2) : '0.00'
    ];
    csvRows.push(line.join(','));
  });

  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join('\n'));
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `simulation-timeline-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${now.getHours()}-${now.getMinutes()}.csv`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", csvContent);
  downloadAnchor.setAttribute("download", filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
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
          fontSize: '0.8rem', 
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
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted, #a1a1aa)' }}>
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
          fontSize: '0.7rem', 
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
          fontSize: '0.75rem', 
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

export default function LifePlanScreen({
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
  improvementPlan,
  setShowImprovementModal,
  handleSetBudgetClick,
  activeStep,

  // Drag-and-drop
  handleNodeDragStart,
  draggingInfo,

  timelineEvents,
  editingEvent,
  dragOccurredRef,

  setEditingEvent,
  handleStep1Change,
  handleOpenSavingsDetails,
  lastNonZeroSavingsRateRef,
  todayAssets,
  todayDebt,
  todayNetWorth,
  setEditingCondition,
  handleRemoveCurrentCondition
}) {
  const [selectedPhaseId, setSelectedPhaseId] = useState(null);
  const [isCurrentSituationModalOpen, setIsCurrentSituationModalOpen] = useState(false);
  const [savingsRateOverride, setSavingsRateOverride] = useState(null);
  const [activeSavingsRate, setActiveSavingsRate] = useState(null);
  
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

  const trackRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(800);

  useEffect(() => {
    if (!trackRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setTrackWidth(entry.contentRect.width);
      }
    });
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, []);

  const normalizedPhases = useMemo(() => {
    return getNormalizedPhases(inputs);
  }, [inputs]);

  const currentAgePhase = useMemo(() => {
    return normalizedPhases.find(p => inputs.currentAge >= p.startAge && inputs.currentAge < p.endAge) || normalizedPhases[0] || null;
  }, [normalizedPhases, inputs.currentAge]);

  const activeSelectedPhaseId = selectedPhaseId || currentAgePhase?.id || null;

  const selectedPhaseObj = useMemo(() => {
    return normalizedPhases.find(p => p.id === activeSelectedPhaseId) || null;
  }, [normalizedPhases, activeSelectedPhaseId]);

  const getEventDetails = (idOrType) => {
    // Try to find in inputs.lifeEvents
    const le = (inputs.lifeEvents || []).find(e => e.id === idOrType || e.type === idOrType);
    if (le) {
      let icon = '❓';
      if (le.type === 'marriage') icon = '💍';
      else if (le.type === 'buyHouse') icon = '🏠';
      else if (le.type === 'haveChild') icon = '👶';
      else if (le.type === 'careerChange') icon = '💼';
      else if (le.type === 'socialSecurity') icon = '💰';
      else if (le.type === 'pension') icon = '📜';
      else if (le.type === 'rentalIncome') icon = '🏢';
      else if (le.type === 'annuity') icon = '📈';
      else if (le.type === 'otherRetirementIncome') icon = '💵';
      else if (le.type === 'windfall') icon = '💰';
      else if (le.type === 'college') icon = '🎓';
      else if (le.type === 'debtPayoff') icon = '💸';
      else if (le.type === 'retire') icon = '🏖️';
      
      return {
        name: le.name || le.type,
        icon,
        type: le.type
      };
    }
    
    // Try to find in inputs.debtList
    const debt = (inputs.debtList || []).find(d => d.id === idOrType);
    if (debt) {
      let icon = '💸';
      if (debt.type === 'studentLoan') icon = '🎓';
      else if (debt.type === 'carLoan') icon = '🚗';
      else if (debt.type === 'creditCard') icon = '💳';
      return {
        name: debt.name || 'Debt',
        icon,
        type: debt.type
      };
    }

    // Try to find in inputs.incomeList
    const inc = (inputs.incomeList || []).find(i => i.id === idOrType);
    if (inc) {
      return {
        name: inc.name || 'Income',
        icon: '💼',
        type: 'income'
      };
    }

    // Try to find in inputs.spendingPhases
    const sp = (inputs.spendingPhases || []).find(s => s.id === idOrType);
    if (sp) {
      return {
        name: sp.name || 'Spending',
        icon: '📉',
        type: 'spending'
      };
    }

    // Fallback
    if (idOrType === 'retire') return { name: 'Retirement', icon: '🏖️', type: 'retire' };
    if (idOrType === 'socialSecurity') return { name: 'Social Security', icon: '💰', type: 'socialSecurity' };
    
    return { name: idOrType, icon: '❓', type: idOrType };
  };

  const getPhaseClassNameAndStyle = (type, isSelected) => {
    let baseColor = 'rgba(99, 102, 241, 0.1)'; // indigo
    let borderColor = 'rgba(99, 102, 241, 0.35)';
    let textColor = 'var(--primary)';

    if (type === 'retire') {
      baseColor = 'rgba(16, 185, 129, 0.1)'; // emerald
      borderColor = 'rgba(16, 185, 129, 0.35)';
      textColor = 'var(--accent-emerald)';
    } else if (type === 'childcare') {
      baseColor = 'rgba(245, 158, 11, 0.1)'; // amber/orange
      borderColor = 'rgba(245, 158, 11, 0.35)';
      textColor = '#f59e0b';
    } else if (type?.toLowerCase().includes('loan') || type?.toLowerCase().includes('debt')) {
      baseColor = 'rgba(139, 92, 246, 0.1)'; // violet
      borderColor = 'rgba(139, 92, 246, 0.35)';
      textColor = '#8b5cf6';
    } else if (type === 'marriage') {
      baseColor = 'rgba(244, 63, 94, 0.1)'; // rose
      borderColor = 'rgba(244, 63, 94, 0.35)';
      textColor = '#f43f5e';
    } else if (type === 'careerChange') {
      baseColor = 'rgba(6, 182, 212, 0.1)'; // cyan
      borderColor = 'rgba(6, 182, 212, 0.35)';
      textColor = '#06b6d4';
    } else if (type === 'debtFree') {
      baseColor = 'rgba(20, 184, 166, 0.1)'; // teal
      borderColor = 'rgba(20, 184, 166, 0.35)';
      textColor = '#14b8a6';
    }

    const style = {
      backgroundColor: isSelected ? textColor : baseColor,
      border: `1px solid ${textColor}`,
      color: isSelected ? 'var(--bg-primary, #0f172a)' : textColor,
      cursor: 'pointer',
      boxShadow: isSelected ? `0 0 10px ${textColor}` : 'none'
    };

    return style;
  };

  const [expandedMethodology, setExpandedMethodology] = useState(false);
  const [showAssets, setShowAssets] = useState(true);
  const [showDebt, setShowDebt] = useState(true);
  const [showNetWorth, setShowNetWorth] = useState(true);
  const [expandedAdvancedDetail, setExpandedAdvancedDetail] = useState(false);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [debugTab, setDebugTab] = useState('assumptions'); // 'assumptions', 'balances', 'readiness', 'drawdowns', 'timeline', 'export'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(false);

  const showDebugButton = typeof window !== 'undefined' && (
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ||
    window.location?.search?.includes('debug=true') ||
    window.location?.href?.includes('debug=true')
  );

  const debugSnapshot = useMemo(() => {
    if (!showDebugDrawer) return null;
    const norm = getProfileFromInputs(inputs);
    const evs = getEventsFromInputs(inputs);
    return buildSimulationDebugSnapshot(inputs, norm, evs, activeResults, activeResults.nominalData);
  }, [showDebugDrawer, inputs, activeResults]);

  const handleDownloadJSON = (snapshot) => {
    if (!snapshot) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `simulation-inspector-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${now.getHours()}-${now.getMinutes()}.json`;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot.exportableJSON || snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const simpleSavingsRate = inputs.simpleIncome > 0
    ? Math.round(((inputs.simpleIncome - inputs.simpleExpenses) / inputs.simpleIncome) * 100)
    : 0;

  const getLifePhases = (inputs) => {
    const curAge = inputs.currentAge || 35;
    const retAge = inputs.targetRetirementAge || 60;
    const lifeExp = inputs.lifeExpectancy || 90;

    const childEvent = (inputs.lifeEvents || []).find(e => e.type === 'haveChild' && e.enabled);
    const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled);
    
    let familyStart = null;
    if (childEvent) {
      familyStart = Number(childEvent.birthAge || childEvent.age);
    }
    if (marriageEvent) {
      const weddingAge = Number(marriageEvent.weddingAge || marriageEvent.age);
      if (familyStart === null || weddingAge < familyStart) {
        familyStart = weddingAge;
      }
    }

    const phases = [];

    // Phase 1: Early Career
    let p1End = retAge;
    if (familyStart !== null && familyStart > curAge && familyStart < retAge) {
      p1End = familyStart;
    } else if (curAge < 45 && retAge > 45) {
      p1End = 45;
    }

    if (p1End > curAge) {
      phases.push({
        name: curAge < 45 ? "Early Career" : "Family Years",
        startAge: curAge,
        endAge: p1End
      });
    }

    // Phase 2: Family Years
    let p2Start = p1End;
    let p2End = retAge;
    if (p2End > p2Start) {
      phases.push({
        name: "Family Years",
        startAge: p2Start,
        endAge: p2End
      });
    }

    // Phase 3: Freedom
    let p3Start = retAge;
    let p3End = Math.min(lifeExp, Math.max(retAge, 80));
    if (p3End > p3Start) {
      phases.push({
        name: "Freedom",
        startAge: p3Start,
        endAge: p3End
      });
    }

    // Phase 4: Legacy
    let p4Start = p3End;
    let p4End = lifeExp;
    if (p4End > p4Start) {
      phases.push({
        name: "Legacy",
        startAge: p4Start,
        endAge: p4End
      });
    }

    return phases;
  };

  const getBudgetPhaseName = (p, inputs) => {
    const isRetired = p.startAge >= (inputs.targetRetirementAge || inputs.lifeExpectancy);
    if (isRetired) {
      const hasSS = p.activeEvents?.includes('socialSecurity') || p.label?.toLowerCase().includes('social security') || p.icon === '🏖️💰' || p.icon === '💰';
      return hasSS ? "Social Security" : "Retirement";
    }
    
    const lowerLabel = p.label?.toLowerCase() || '';
    if (lowerLabel.includes('childcare')) return "Childcare";
    if (lowerLabel.includes('mortgage')) return "Mortgage";
    if (lowerLabel.includes('student loan')) return "Student Loan";
    if (lowerLabel.includes('credit card')) return "Credit Card";
    if (lowerLabel.includes('auto loan') || lowerLabel.includes('car loan')) return "Auto Loan";
    if (lowerLabel.includes('debt-free')) return "Debt-Free";
    if (lowerLabel.includes('sabbatical')) return "Sabbatical";
    if (lowerLabel.includes('barista fire')) return "Barista FIRE";
    
    if (p.childCount > 0) return "Childcare";
    if (p.activeDebts && p.activeDebts.length > 0) {
      if (p.activeDebts.some(d => d.type === 'mortgage')) return "Mortgage";
      return "Debt Payoff";
    }
    
    return "Working";
  };

  const getBudgetPhaseCostImpact = (p, inputs, displayedResults) => {
    const isRetired = p.startAge >= (inputs.targetRetirementAge || inputs.lifeExpectancy);
    if (isRetired) {
      const hasSS = p.activeEvents?.includes('socialSecurity') || p.label?.toLowerCase().includes('social security') || p.icon === '🏖️💰' || p.icon === '💰';
      if (hasSS && displayedResults.socialSecurityDetails?.isEligible) {
        const ssAnnual = displayedResults.socialSecurityDetails.annualBenefit;
        return '-$' + Math.round(ssAnnual / 1000) + 'k/yr';
      }
      return '';
    }

    const hasChildcare = p.label?.toLowerCase().includes('childcare') || p.childCount > 0;
    if (hasChildcare) {
      let ccCost = 0;
      if (p.expenses?.childcare) {
        ccCost = Number(p.expenses.childcare) * 12;
      } else {
        ccCost = (p.childCount || 1) * 15000;
      }
      return '+$' + Math.round(ccCost / 1000) + 'k/yr';
    }

    const hasMortgage = p.label?.toLowerCase().includes('mortgage') || (p.activeDebts && p.activeDebts.some(d => d.type === 'mortgage'));
    if (hasMortgage) {
      const activeMortgages = (p.activeDebts || []).filter(d => d.type === 'mortgage');
      const mortgageAnnual = activeMortgages.reduce((sum, d) => sum + (Number(p.expenses?.['debt_' + d.id]) || d.monthlyPayment || 0), 0) * 12;
      if (mortgageAnnual > 0) {
        return '+$' + Math.round(mortgageAnnual / 1000) + 'k/yr';
      }
    }

    if (p.activeDebts && p.activeDebts.length > 0) {
      const debtAnnual = (p.activeDebts || []).reduce((sum, d) => sum + (Number(p.expenses?.['debt_' + d.id]) || d.monthlyPayment || 0), 0) * 12;
      if (debtAnnual > 0) {
        return '+$' + Math.round(debtAnnual / 1000) + 'k/yr';
      }
    }

    return '';
  };

  return (
    <>
              <div className="roadmap-step-container">
                
        <div className="desktop-dashboard-grid">
          
          {/* Left Column */}
          <div className="desktop-left-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <CurrentSituationCard
              inputs={inputs}
              handleStep1Change={handleStep1Change}
              handleSetBudgetClick={handleSetBudgetClick}
              handleOpenSavingsDetails={handleOpenSavingsDetails}
              lastNonZeroSavingsRateRef={lastNonZeroSavingsRateRef}
              setEditingCondition={setEditingCondition}
              handleRemoveCurrentCondition={handleRemoveCurrentCondition}
              setIsCurrentSituationModalOpen={setIsCurrentSituationModalOpen}
            />
            
            <button
              type="button"
              className="btn-secondary"
              style={{
                width: '100%',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: '700',
                boxSizing: 'border-box',
                marginBottom: '0.5rem'
              }}
              onClick={() => handleSetBudgetClick()}
            >
              💼 Set Budget
            </button>
            
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <div style={{ flex: 1 }}>
                <select
                  className="add-event-dropdown"
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 1.5rem 0 0.5rem',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    lineHeight: '34px',
                    boxSizing: 'border-box'
                  }}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCreateEvent(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>➕ Add Life Decision...</option>
                  <option value="marriage">💍 Get Married</option>
                  <option value="buyHouse">🏠 Buy a House</option>
                  <option value="haveChild">👶 Have a Child</option>
                  <option value="careerChange">💼 Career Change</option>
                  <option value="move">📍 Move / Relocate</option>
                  <option value="retire" disabled={(inputs.lifeEvents || []).some(e => e.type === 'retire')}>
                    🏖 Retire {(inputs.lifeEvents || []).some(e => e.type === 'retire') ? ' (Already Added)' : ''}
                  </option>
                  <option value="socialSecurity">💰 Social Security</option>
                  <option value="pension">📜 Pension</option>
                  <option value="rentalIncome">🏢 Rental Income</option>
                  <option value="annuity">📈 Annuity</option>
                  <option value="otherRetirementIncome">💵 Other Income</option>
                  <option value="windfall">💰 Windfall</option>
                  <option value="college">🎓 College Costs</option>
                  <option value="debtPayoff">💸 Debt Payoff</option>
                  <option value="custom">➕ Custom Event</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <select
                  className="add-event-dropdown"
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 1.5rem 0 0.5rem',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    lineHeight: '34px',
                    boxSizing: 'border-box'
                  }}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCreateEvent(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>💳 Borrowing...</option>
                  <option value="studentLoan">Student Loan</option>
                  <option value="carLoan">Car Loan</option>
                  <option value="personalLoan">Personal Loan</option>
                  <option value="creditCard">Credit Card Balance</option>
                </select>
              </div>
            </div>
            {showDebugButton && (
              <button
                type="button"
                className="btn-secondary"
                style={{
                  width: '100%',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  marginTop: '0.5rem'
                }}
                onClick={() => {
                  setDebugTab('assumptions');
                  setShowDebugDrawer(true);
                }}
              >
                ⚙️ Debug
              </button>
            )}
          </div>

          {/* Right Column */}
          <div className="desktop-right-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
            
            {/* Outcome Hero Card */}
            <OutcomeHeroCard
              readyAge={displayedResults.retirementReadyAge}
              targetRetirementAge={displayedResults.targetRetirementAge}
              freedomNumber={displayedResults.freedomNumber}
              planStatus={displayedResults.planStatus}
              onViewRecommendations={() => setShowImprovementModal(true)}
            />

            {/* Compact 3-Layer Timeline */}
            {validation.errors.length === 0 && (
              <div className="glass-card timeline-card" style={{ padding: '0.5rem 0.75rem', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="timeline-layout-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="timeline-wrapper" style={{ flexGrow: 1, overflowX: 'auto', minWidth: 0 }}>
                    <div className="timeline-grid" style={{ minWidth: '850px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      
                      {/* Layer 1: Events */}
                      {(() => {
                        const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                        if (totalYears <= 0) return null;

                        return (
                          <div className="timeline-row compact-row" style={{ height: '44px', minHeight: '44px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                            <div className="timeline-row-label" style={{ padding: '0.35rem 0.75rem', fontSize: '0.65rem', width: '120px', minWidth: '120px', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                              Events
                            </div>
                            <div className="timeline-row-content events-row-content" style={{ padding: '0 16px', position: 'relative', flexGrow: 1, height: '100%' }}>
                              <div className="timeline-track-inner" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
                                <div className="events-axis-line" style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'var(--border-color)', top: '50%', transform: 'translateY(-50%)', margin: 0 }} />
                                
                                {timelineEvents.map((evt, idx) => {
                                  const isPrimaryDragging = !!(draggingInfo && evt.originalId && String(draggingInfo.originalId) === String(evt.originalId));
                                  const isLinkedDragging = !!(draggingInfo && evt.childEventId && String(draggingInfo.originalId) === String(evt.childEventId));
                                  const isDraggingThis = isPrimaryDragging || isLinkedDragging || !!(draggingInfo && !evt.originalId && !evt.childEventId && evt.type === 'retire' && draggingInfo.type === 'retire');

                                  const isSelected = !!(editingEvent && (
                                    (evt.originalId && String(editingEvent.id) === String(evt.originalId)) ||
                                    (!evt.originalId && evt.type === 'retire' && editingEvent.type === 'retire')
                                  ));

                                  const displayAge = (() => {
                                    if (isPrimaryDragging) {
                                      return typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : evt.age;
                                    }
                                    if (isLinkedDragging) {
                                      const offset = draggingInfo.childEndOffset !== undefined ? draggingInfo.childEndOffset : 18;
                                      const draggedDisplayAge = typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : (evt.age - offset);
                                      const linkedEndDisplayAge = draggedDisplayAge + offset;
                                      return linkedEndDisplayAge;
                                    }
                                    if (isDraggingThis && evt.type === 'retire') {
                                      return typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : evt.age;
                                    }
                                    return evt.age;
                                  })();
                                  const percent = totalYears > 0 ? ((displayAge - inputs.currentAge) / totalYears) * 100 : 0;
                                  const isFinancial = isFinancialEvent(evt);
                                  const shouldPulse = window.pulseEventId && evt.originalId && String(window.pulseEventId) === String(evt.originalId);

                                  if (evt.type === 'lifeExpectancy') {
                                    return null;
                                  }

                                  return (
                                    <div
                                      key={idx}
                                      className={'financial-milestone-wrapper milestone-circle-wrapper' + (isDraggingThis ? ' dragging' : '') + (isSelected ? ' selected' : '') + (shouldPulse ? ' pulse-highlight-event' : '')}
                                      style={{
                                        position: 'absolute',
                                        left: percent + '%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: isDraggingThis ? 10 : 3,
                                        cursor: 'grab'
                                      }}
                                      onMouseDown={(e) => handleNodeDragStart(e, evt)}
                                      onTouchStart={(e) => handleNodeDragStart(e, evt)}
                                      onClick={(e) => {
                                        if (dragOccurredRef.current) {
                                          e.stopPropagation();
                                          return;
                                        }
                                        if (isEditableEvent(evt)) {
                                          handleEditRoadmapEvent(evt);
                                        }
                                      }}
                                    >
                                      <div className="financial-milestone-dot milestone-glow-circle" style={{ width: '26px', height: '26px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)', borderRadius: '50%', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                                        {evt.icon}
                                      </div>

                                      <div className={'timeline-tooltip' + (percent < 20 ? ' align-left' : percent > 80 ? ' align-right' : '')}>
                                        <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                                          {evt.icon} {evt.title}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                                          <div>Age {Math.floor(displayAge)} • {evt.description}</div>
                                          {(() => {
                                            if (evt.type === 'mortgageOff') {
                                              const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                                              if (asset) {
                                                return (
                                                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                                    P&I Savings: {formatCurrency(propPIAmount(asset))}/yr
                                                  </div>
                                                );
                                              }
                                            }
                                            if (evt.type === 'childSupportEnds') {
                                              return (
                                                <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-orange)' }}>
                                                  Support expenses have ended
                                                </div>
                                              );
                                            }
                                            if (evt.type === 'socialSecurity') {
                                              const ss = displayedResults.socialSecurityDetails;
                                              if (ss && ss.isEligible) {
                                                return (
                                                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                                    Benefit: {formatCurrency(ss.monthlyBenefit)}/mo ({formatCurrency(ss.annualBenefit)}/yr)
                                                  </div>
                                                );
                                              }
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Layer 2: Life Phases */}
                      {(() => {
                        const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                        if (totalYears <= 0) return null;

                        const phases = getLifePhases(inputs);

                        return (
                          <div className="timeline-row compact-row" style={{ height: '30px', minHeight: '30px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                            <div className="timeline-row-label" style={{ padding: '0.35rem 0.75rem', fontSize: '0.65rem', width: '120px', minWidth: '120px', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                              Life Phases
                            </div>
                            <div className="timeline-row-content life-phase-track" style={{ padding: '0 16px', position: 'relative', flexGrow: 1, height: '100%' }}>
                              <div className="timeline-track-inner" style={{ position: 'relative', height: '100%' }}>
                                {phases.map((p, idx) => {
                                  const startPct = Math.max(0, Math.min(100, ((p.startAge - inputs.currentAge) / totalYears) * 100));
                                  const endPct = Math.max(0, Math.min(100, ((p.endAge - inputs.currentAge) / totalYears) * 100));
                                  const widthPct = endPct - startPct;
                                  if (widthPct <= 0) return null;

                                  return (
                                    <div
                                      key={idx}
                                      className="life-phase-span pill-span"
                                      style={{
                                        position: 'absolute',
                                        left: startPct + '%',
                                        width: widthPct + '%',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.68rem',
                                        fontWeight: '700',
                                        boxSizing: 'border-box',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-secondary)',
                                        borderRadius: '12px',
                                        padding: '0 8px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {p.name} {p.startAge}–{p.endAge}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Layer 3: Budget Phases */}
                      {(() => {
                        const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                        if (totalYears <= 0) return null;

                        const getBudgetPhaseThemeClass = (p) => {
                          const label = p.label || '';
                          const isRetired = p.startAge >= (inputs.targetRetirementAge || inputs.lifeExpectancy);
                          const hasSS = p.activeEvents?.includes('socialSecurity') || label.includes('Social Security') || p.icon === '🏖️💰' || p.icon === '💰';
                          
                          if (isRetired) {
                            if (hasSS) return 'theme-retired-ss';
                            return 'theme-retired';
                          }
                          
                          const lowerLabel = label.toLowerCase();
                          const hasChildcare = lowerLabel.includes('childcare');
                          const hasStudentLoan = lowerLabel.includes('student loan') || p.activeDebts?.some(d => d.type === 'studentLoan');
                          const hasHouse = lowerLabel.includes('house') || lowerLabel.includes('mortgage') || p.activeDebts?.some(d => d.type === 'mortgage');
                          const hasOtherDebt = p.activeDebts && p.activeDebts.length > 0;
                          
                          if (hasChildcare) {
                            if (hasOtherDebt) return 'theme-working-childcare-debt';
                            return 'theme-working-childcare';
                          }
                          if (hasStudentLoan) return 'theme-working-student-loan';
                          if (hasHouse) return 'theme-working-house';
                          
                          return 'theme-working-standard';
                        };

                        return (
                          <div className="timeline-row compact-row budget-phases-timeline-row" style={{ height: '30px', minHeight: '30px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                            <div className="timeline-row-label" style={{ padding: '0.35rem 0.75rem', fontSize: '0.65rem', width: '120px', minWidth: '120px', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                              Budget Phases
                            </div>
                            <div className="timeline-row-content budget-phases-track" style={{ padding: '0 16px', position: 'relative', flexGrow: 1, height: '100%' }}>
                              <div ref={trackRef} className="timeline-track-inner" style={{ position: 'relative', height: '100%', display: 'flex' }}>
                                {normalizedPhases.map((p) => {
                                  const startPct = Math.max(0, Math.min(100, ((p.startAge - inputs.currentAge) / totalYears) * 100));
                                  const endPct = Math.max(0, Math.min(100, ((p.endAge - inputs.currentAge) / totalYears) * 100));
                                  const widthPct = endPct - startPct;
                                  if (widthPct <= 0) return null;

                                  const isCurrentAge = inputs.currentAge >= p.startAge && inputs.currentAge < p.endAge;
                                  const themeClass = getBudgetPhaseThemeClass(p);
                                  
                                  const phaseName = getBudgetPhaseName(p, inputs);
                                  const costImpact = getBudgetPhaseCostImpact(p, inputs, displayedResults);
                                  
                                  const pillLabelText = costImpact ? (p.icon || '') + ' ' + phaseName + ' ' + costImpact : (p.icon || '') + ' ' + phaseName;

                                  const phaseNeedsTotal = (Number(p.expenses?.housing) || 0) +
                                                         (Number(p.expenses?.utilities) || 0) +
                                                         (Number(p.expenses?.food) || 0) +
                                                         (Number(p.expenses?.transportation) || 0) +
                                                         (Number(p.expenses?.healthcare) || 0) +
                                                         (p.isMarried ? (Number(p.expenses?.debt) || 0) : 0) +
                                                         (Number(p.expenses?.childcare) || 0) +
                                                         (p.activeDebts || []).reduce((sum, d) => sum + (Number(p.expenses?.['debt_' + d.id]) || d.monthlyPayment || 0), 0);

                                  const phaseWantsTotal = (Number(p.expenses?.leisure) || 0) +
                                                         (Number(p.expenses?.diningOut) || 0) +
                                                         (Number(p.expenses?.misc) || 0);

                                  const phaseSavingsTotal = Object.values(p.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) +
                                                           (p.isMarried ? Object.values(p.partnerSavings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0);

                                  return (
                                    <div
                                      key={p.id}
                                      className={'budget-segment pill-span budget-timeline-lane-segment ' + themeClass + (isCurrentAge ? ' current-age-phase' : '') + (activeSelectedPhaseId === p.id ? ' selected' : '')}
                                      style={{
                                        position: 'absolute',
                                        left: startPct + '%',
                                        width: widthPct + '%',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        height: '24px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.68rem',
                                        fontWeight: '700',
                                        boxSizing: 'border-box',
                                        padding: '0 8px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetBudgetClick(p.id);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleSetBudgetClick(p.id);
                                        }
                                      }}
                                      tabIndex={0}
                                      aria-label={p.label + ' (Age ' + p.startAge + '–' + p.endAge + ')'}
                                    >
                                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        {pillLabelText}
                                      </span>

                                      <div className={'timeline-tooltip' + (startPct < 20 ? ' align-left' : startPct > 80 ? ' align-right' : '')}>
                                        <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.25rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <span>{p.icon}</span> <span>{p.label}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '200px', lineHeight: '1.4', textAlign: 'left' }}>
                                          <div><strong>Age:</strong> {p.startAge}–{p.endAge}</div>
                                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                                            <strong>Active Events:</strong> {p.activeEvents && p.activeEvents.length > 0 ? p.activeEvents.map(evId => getEventDetails(evId)?.name || evId).join(', ') : 'None'}
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.15rem 0.5rem', marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem' }}>
                                            <div>Monthly Income:</div>
                                            <div style={{ textAlign: 'right', color: 'var(--accent-emerald)', fontWeight: 600 }}>{formatCurrency(p.income || 0)}</div>
                                            <div>Needs:</div>
                                            <div style={{ textAlign: 'right' }}>{formatCurrency(phaseNeedsTotal)}</div>
                                            <div>Wants:</div>
                                            <div style={{ textAlign: 'right' }}>{formatCurrency(phaseWantsTotal)}</div>
                                            <div>Save & Invest:</div>
                                            <div style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>{formatCurrency(phaseSavingsTotal)}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Chronological Ticks */}
                      <div className="timeline-row" style={{ height: '20px', minHeight: '20px', position: 'relative' }}>
                        <div className="timeline-row-label" style={{ opacity: 0, borderRight: 'none', width: '120px', minWidth: '120px' }}>Ages</div>
                        <div className="timeline-row-content ticks-row-content" style={{ padding: '0 16px', position: 'relative', flexGrow: 1, height: '100%' }}>
                          <div className="timeline-track-inner" style={{ position: 'relative', height: '100%' }}>
                            {(() => {
                              const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                              const ticks = [];
                              const tickInterval = 5;
                              const startTick = Math.ceil(inputs.currentAge / tickInterval) * tickInterval;
                              const endTick = Math.floor(inputs.lifeExpectancy / tickInterval) * tickInterval;
                              for (let age = startTick; age <= endTick; age += tickInterval) {
                                ticks.push(age);
                              }
                              return ticks.map((age, idx) => {
                                const percent = totalYears > 0 ? ((age - inputs.currentAge) / totalYears) * 100 : 0;
                                return (
                                  <div key={idx} className="timeline-tick-new" style={{ left: percent + '%' }}>
                                    <div className="timeline-tick-mark-new" />
                                    <span className="timeline-tick-label-new">{age}</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Projection Graph */}
            {validation.errors.length === 0 && (
              <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      Wealth Journey
                      <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                        <span className="toggle-tooltip-icon">i</span>
                        <span className="toggle-tooltip-text" style={{ textTransform: 'none', fontWeight: 'normal' }}>
                          Shows values at the start of the fiscal year.
                        </span>
                      </span>
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Updates live • Click chart to view detailed benchmarks below</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={showAssets}
                        onChange={(e) => setShowAssets(e.target.checked)}
                        style={{ accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#10b981', fontWeight: '700' }}>Assets (Green)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={showDebt}
                        onChange={(e) => setShowDebt(e.target.checked)}
                        style={{ accentColor: '#ef4444', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#ef4444', fontWeight: '700' }}>Debt (Red)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={showNetWorth}
                        onChange={(e) => setShowNetWorth(e.target.checked)}
                        style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#8b5cf6', fontWeight: '700' }}>Net Worth (Purple)</span>
                    </label>
                  </div>
                </div>
                
                <ProjectionGraph
                  chartData={chartData}
                  inputs={inputs}
                  displayedResults={displayedResults}
                  showAssets={showAssets}
                  showDebt={showDebt}
                  showNetWorth={showNetWorth}
                  setSelectedYear={setSelectedYear}
                />

                {displayedResults.yearsWithLimitsReached > 0 && (
                  <div style={{
                    marginTop: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>ℹ️</span>
                    <span style={{ lineHeight: '1.3' }}>
                      Retirement account limits were reached in <strong>{displayedResults.yearsWithLimitsReached} years</strong> of the simulation. <strong>{formatCurrency(displayedResults.totalRedirectedSavings)}</strong> of additional savings were automatically invested in <strong>{displayedResults.redirectedToCash ? 'cash accounts' : 'taxable brokerage accounts'}</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      
                <div className="roadmap-grid-layout">
                  
                  {/* Left Column: Plan Story */}
                  <div className="roadmap-grid-col-left">
                    {/* Life Story Summary */}
                    <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                      <h2 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Life Plan</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                        Select a life decision or milestone from the dropdown above the timeline to add it. Drag events on the timeline above or edit them below to map out your roadmap.
                      </p>
                      {generateLifeStory(inputs, displayedResults)}
                    </div>
                    <ChildCostsBuckets
                      inputs={inputs}
                      handleEditRoadmapEvent={handleEditRoadmapEvent}
                    />
                  </div>
      
                  {/* Right Column: Graphs, Snapshot, and Settings */}
                  <div className="roadmap-grid-col-right">
      
                    {/* Benchmarks Snapshot */}
                    {validation.errors.length === 0 && (() => {
                      const activeYear = selectedYear !== null ? selectedYear : Number(inputs.currentAge);
                      const yearData = chartData.find(d => d.age === activeYear);
                      if (!yearData) return null;
      
                      const isWorking = activeYear < displayedResults.targetRetirementAge;
                      
                      return (
                        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                              🔍 Age {activeYear} Financial Snapshot
                            </h3>
                            <span className="badge" style={{ 
                              fontSize: '0.75rem', 
                              padding: '0.2rem 0.6rem', 
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
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Net Worth</span>
                              <strong style={{ fontSize: '1.05rem', color: yearData.netWorth < 0 ? 'var(--accent-rose)' : 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.netWorth)}</strong>
                            </div>
                            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Portfolio Value / Total Assets</span>
                              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.assets)}</strong>
                            </div>
                            {yearData.debt > 0 && (
                              <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Total Debt</span>
                                <strong style={{ fontSize: '1.05rem', color: 'var(--accent-rose)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.debt)}</strong>
                              </div>
                            )}
                            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Income</span>
                              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.income)}</strong>
                            </div>
                            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Spending</span>
                              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                                {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
                              </strong>
                            </div>
                            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                {yearData.withdrawals > 0 ? 'Withdrawals' : 'Net Savings'}
                              </span>
                              <strong style={{ 
                                fontSize: '1.05rem', 
                                color: yearData.withdrawals > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', 
                                display: 'block', 
                                marginTop: '0.25rem' 
                              }}>
                                {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
                              </strong>
                            </div>
                          </div>

                          {/* Net Worth Ledger */}
                          {yearData.netWorthLedger && (
                            <div style={{ marginTop: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', margin: 0 }}>
                                  📒 Net Worth Change This Year
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => setIsLedgerExpanded(!isLedgerExpanded)}
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--primary)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.15rem 0.4rem',
                                    fontWeight: '600'
                                  }}
                                >
                                  {isLedgerExpanded ? 'Hide details ▴' : 'Show details ▾'}
                                </button>
                              </div>
                              <div style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                padding: '0.75rem 1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.4rem'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  <span>Starting Net Worth:</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>
                                    {formatCurrency(yearData.netWorthLedger.startingNetWorth)}
                                  </strong>
                                </div>
                                
                                {isLedgerExpanded && [
                                   { key: 'incomeInvesting', label: 'Income & Investing' },
                                   { key: 'lifeEvents', label: 'Life Events' },
                                   { key: 'homeActivity', label: 'Home Purchase Activity' },
                                   { key: 'debtActivity', label: 'Debt Activity' }
                                 ].map(sec => {
                                   const secRows = yearData.netWorthLedger.rows.filter(r => r.section === sec.key);
                                   if (secRows.length === 0) return null;
                                   return (
                                     <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.35rem' }}>
                                       <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', opacity: 0.6 }}>
                                         {sec.label}
                                       </div>
                                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.4rem' }}>
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
                                                 <div style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-secondary)', opacity: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.1rem', marginBottom: '0.15rem' }}>
                                                   {sub.label}
                                                 </div>
                                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.4rem' }}>
                                                   {sub.key === 'equityTransfer' ? (
                                                      subRows.map((row, rIdx) => (
                                                        <div key={rIdx} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.15rem 0' }}>
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
                                  fontSize: '0.8rem',
                                  color: 'var(--text-primary)',
                                  borderTop: isLedgerExpanded ? '1px solid var(--border-color)' : 'none',
                                  paddingTop: isLedgerExpanded ? '0.4rem' : '0',
                                  marginTop: '0.1rem',
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
                          <div style={{ marginTop: '0.75rem' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                              📊 Cash Flow Details
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Base Annual Spending:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(Math.max(0, yearData.expenses - (yearData.taxes || 0) - (yearData.childCosts || 0)))}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Child Costs:</span>
                                <strong style={{ color: yearData.childCosts > 0 ? 'var(--accent-orange, #f59e0b)' : 'var(--text-primary)' }}>
                                  {formatCurrency(yearData.childCosts || 0)}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Total Annual Spending:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Net Savings:</span>
                                <strong style={{ color: yearData.withdrawals > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                                  {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
                                </strong>
                              </div>
                            </div>
                          </div>
      
                          {/* Account Balances Breakdown */}
                          <div style={{ marginTop: '0.5rem' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                              💼 Account Balances Breakdown
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Cash / Reserves:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency((yearData.cashBalance || 0) + (yearData.emergencyFundBalance || 0))}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Taxable Brokerage:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(yearData.brokerageBalance || 0)}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Pre-Tax (401k/IRA):</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency((yearData.trad401kBalance || 0) + (yearData.tradIraBalance || 0))}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Roth IRA:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(yearData.rothIraBalance || 0)}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>HSA Balance:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(yearData.hsaBalance || 0)}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Other Investments:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(yearData.otherBalance || 0)}
                                </strong>
                              </div>
                            </div>
                          </div>
      
                          {/* Baseline Simulation Assumptions */}
                          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                              ⚙️ Baseline Assumptions (Screen 1)
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Current Age:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {inputs.currentAge}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Life Expectancy:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {inputs.lifeExpectancy}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Starting Savings:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(inputs.simpleInvestments)}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Annual Income:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(inputs.simpleIncome)}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Pre-Tax Savings Rate:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {simpleSavingsRate}%
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                                <span>Annual Savings:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(Math.max(0, inputs.simpleIncome - inputs.simpleExpenses))}
                                </strong>
                              </div>
                            </div>
                          </div>
      
                          {/* Property / Debt info if active */}
                          {(yearData.homeValue > 0 || yearData.mortgageBalance > 0 || yearData.debtBalance > 0 || yearData.weddingDebtBalance > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                              {yearData.homeValue > 0 && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  🏠 <span>Property Value: </span>
                                  <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(yearData.homeValue)}</strong>
                                </div>
                              )}
                              {yearData.mortgageBalance > 0 && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  📝 <span>Mortgage Balance: </span>
                                  <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(yearData.mortgageBalance)}</strong>
                                </div>
                              )}
                              {yearData.weddingDebtBalance > 0 && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  💍 <span>Wedding Debt: </span>
                                  <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(yearData.weddingDebtBalance)}</strong>
                                </div>
                              )}
                              {yearData.debtBalance > 0 && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  🛑 <span>Outstanding Debt: </span>
                                  <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(yearData.debtBalance)}</strong>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
      
                    {/* Advanced Detail Collapsible Accordion (Simulation Assumptions) */}
                    <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                      <button
                        type="button"
                        className="collapsible-trigger-btn"
                        onClick={() => setExpandedAdvancedDetail(!expandedAdvancedDetail)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          ⚙️ Advanced Detail
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{expandedAdvancedDetail ? 'Hide ▲' : 'Show Details ▼'}</span>
                      </button>
                      
                      {expandedAdvancedDetail && (
                        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                            <div className="input-wrapper">
                              <span className="input-name">Pre-Retire Return (%)</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%' }}
                                value={inputs.expectedReturn}
                                step="0.1"
                                onChange={(e) => updateInput('expectedReturn', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="input-wrapper">
                              <span className="input-name">Post-Retire Return (%)</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%' }}
                                value={inputs.postRetirementReturn !== undefined ? inputs.postRetirementReturn : inputs.expectedReturn}
                                step="0.1"
                                onChange={(e) => updateInput('postRetirementReturn', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="input-wrapper">
                              <span className="input-name">Cash Return Rate (%)</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%' }}
                                value={inputs.cashReturnRate !== undefined ? inputs.cashReturnRate : 2.0}
                                step="0.1"
                                onChange={(e) => updateInput('cashReturnRate', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="input-wrapper">
                              <span className="input-name">Inflation Rate (%)</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%' }}
                                value={inputs.inflationRate}
                                step="0.1"
                                onChange={(e) => updateInput('inflationRate', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="input-wrapper" style={{ position: 'relative' }}>
                              <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span className="input-name">Lifestyle Upgrades (%)</span>
                                <span className="tooltip-icon">?</span>
                                <span className="tooltip-text">
                                  At 0%, your spending only increases with inflation. Increase this if you plan to upgrade your lifestyle over time (spending grows faster than inflation).
                                </span>
                              </div>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', marginTop: '0.15rem' }}
                                value={inputs.lifestyleUpgrades !== undefined ? inputs.lifestyleUpgrades : 0}
                                step="0.1"
                                min="0"
                                max="100"
                                onChange={(e) => updateInput('lifestyleUpgrades', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="input-wrapper">
                              <span className="input-name">SWR (%)</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%' }}
                                value={inputs.swr}
                                step="0.1"
                                onChange={(e) => updateInput('swr', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </div>
      
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={inputs.includeTaxes}
                                onChange={(e) => updateInput('includeTaxes', e.target.checked)}
                              />
                              Include Taxes (U.S. Federal Progressive)
                            </label>
                            {inputs.includeTaxes && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <div className="input-wrapper" style={{ maxWidth: '300px' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Filing Status</span>
                                  <select
                                    className="input-number-box"
                                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.25rem', textAlign: 'left' }}
                                    value={inputs.filingStatus || 'single'}
                                    onChange={(e) => updateInput('filingStatus', e.target.value)}
                                  >
                                    <option value="single">Single Filer</option>
                                    <option value="married">Married Filing Jointly</option>
                                  </select>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.15rem 0 0 0', lineHeight: '1.3' }}>
                                  ℹ️ Taxes are calculated using progressive brackets (10% to 37%) and standard deductions ($16,100 Single / $32,200 Married for 2026), inflated annually.
                                </p>
                              </div>
                            )}
                          </div>
      
                          {/* Healthcare & Medicare Bridge */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={inputs.enableHealthcareModel !== false}
                                onChange={(e) => updateInput('enableHealthcareModel', e.target.checked)}
                              />
                              🏥 Enable Healthcare & Medicare Bridge
                            </label>
                            {inputs.enableHealthcareModel !== false && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                                  <div className="input-wrapper">
                                    <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <span className="input-name">Pre-Medicare Cost ($/yr)</span>
                                      <span className="tooltip-icon">?</span>
                                      <span className="tooltip-text">
                                        Estimated annual cost of private health insurance (ACA/COBRA) if you retire before age 65.
                                      </span>
                                    </div>
                                    <input
                                      type="number"
                                      className="input-number-box"
                                      style={{ width: '100%', marginTop: '0.15rem' }}
                                      value={inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000}
                                      step="500"
                                      onChange={(e) => updateInput('preMedicarePremium', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div className="input-wrapper">
                                    <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <span className="input-name">Medicare Cost ($/yr)</span>
                                      <span className="tooltip-icon">?</span>
                                      <span className="tooltip-text">
                                        Estimated annual cost of Medicare premiums and out-of-pocket costs after age 65.
                                      </span>
                                    </div>
                                    <input
                                      type="number"
                                      className="input-number-box"
                                      style={{ width: '100%', marginTop: '0.15rem' }}
                                      value={inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000}
                                      step="200"
                                      onChange={(e) => updateInput('medicarePremium', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.15rem 0 0 0', lineHeight: '1.3' }}>
                                  ℹ️ Pre-Medicare costs apply from retirement age until age 65. Medicare eligibility starts at age 65. Both are adjusted for inflation.
                                </p>
                              </div>
                            )}
                          </div>
      
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>FIRE Strategy Mode</span>
                            <div className="segmented-control">
                              {[
                                { val: 'traditional', label: 'Traditional' },
                                { val: 'coast', label: 'Coast' },
                                { val: 'barista', label: 'Barista' },
                                { val: 'lean', label: 'Lean' },
                                { val: 'fat', label: 'Fat' }
                              ].map(modeItem => (
                                <button
                                  key={modeItem.val}
                                  type="button"
                                  className={`segmented-control-btn ${inputs.fireMode === modeItem.val ? 'active' : ''}`}
                                  onClick={() => updateInput('fireMode', modeItem.val)}
                                  style={{ fontSize: '0.7rem' }}
                                >
                                  {modeItem.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
      
                </div>
      
      
      
      
              </div>
      
      {/* Calculation Assumptions & Methodology Footer Section (Screen 2 Only, Collapsible) */}
              <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginTop: '2rem', textAlign: 'left' }}>
                <button
                  type="button"
                  className="collapsible-trigger-btn"
                  onClick={() => setExpandedMethodology(!expandedMethodology)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                    📝 Calculation Assumptions & Methodology
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{expandedMethodology ? 'Hide ▲' : 'Show Details ▼'}</span>
                </button>
                
                {expandedMethodology && (
                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                      To maintain financial realism, the FIRE Retirement Simulator operates under several standard U.S. financial planning and tax rules. Key calculations and background assumptions include:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          🏖 Retirement Spending Model
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          Target retirement spending defaults to <strong>{inputs.isAdvancedMode ? 'your customized spending phases' : '70% of pre-retirement lifestyle spending'}</strong> (not final salary), ensuring SWR targets scale with actual lifestyle costs rather than gross income.
                        </p>
                      </div>
                       <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          💰 Social Security & PIA Formula
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          Calculates benefits dynamically from your simulated earnings history using the official-style formula:
                          <span style={{ display: 'block', marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-color)' }}>
                            • <strong>Eligibility:</strong> Requires at least <strong>10 working years</strong> (earned income &gt; 0) to qualify; otherwise, benefits are $0.<br />
                            • <strong>AIME:</strong> Computes Average Indexed Monthly Earnings from your highest 35 earning years (padded with $0 if fewer) divided by 420 months.<br />
                            • <strong>PIA Bend Points (2026):</strong> Full retirement benefit (PIA) uses 2026 bend points: 90% of AIME up to $1,286 + 32% of AIME between $1,286 and $7,749 + 15% of AIME above $7,749.<br />
                            • <strong>Claiming Adjustments:</strong> FRA is 67. Claiming early (62–66) reduces benefit by 5/9% per month for the first 36 months and 5/12% per month thereafter (30% reduction at 62). Delaying (68–70) adds 8% per year (24% increase at 70).
                          </span>
                        </p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          🏥 Healthcare & Medicare Bridge
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          If enabled, retirees pay an unsubsidized pre-Medicare premium bridge (default <strong>$10,000/yr</strong>) until age <strong>65</strong>. At age 65, costs automatically transition to Medicare premiums (default <strong>$4,000/yr</strong>).
                        </p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          📈 Annual Inflation Adjustments
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          All variables—including standard salary growth, spending phases, Social Security benefits, pension income, tax brackets, and health insurance premiums—are adjusted annually using the inflation rate to report final values in constant, today's dollars.
                        </p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          🔄 Portfolio Drawdown Order
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          Deficits are covered from liquid accounts in a strict tax-efficient hierarchy: Cash → Emergency Fund → Taxable Brokerage → Pre-tax (Traditional 401k/IRA, grossed up to cover taxes) → Roth accounts → HSA → Other.
                        </p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          ⚖️ Taxation & Early Withdrawal Penalties
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          Pre-tax withdrawals (Traditional 401k/IRA) are taxed as ordinary income. The engine simulates standard deductions and progressive federal income tax brackets (Single or Married Filing Jointly) adjusted annually for inflation. Additionally, a <strong>10% early withdrawal tax penalty</strong> is automatically enforced for all Traditional 401k/IRA drawdowns made before age <strong>59.5</strong>.
                        </p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          🏠 Home Ownership & Mortgage Rules
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          Models realistic homebuying and ownership cash flows:
                          <span style={{ display: 'block', marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-color)' }}>
                            • <strong>Purchase Cash:</strong> Down payment + closing costs + points + renovation costs are deducted from liquid assets at the purchase age. If the down payment equals or exceeds the home price, it is treated as an all-cash purchase (no mortgage is created).<br />
                            • <strong>Mortgage P&I:</strong> Monthly Principal & Interest (P&I) is calculated using the standard amortization formula based on the loan amount (Home Price minus Down Payment), interest rate, and term.<br />
                            • <strong>Equity & Appreciation:</strong> Home value appreciates annually (default 3%), while the mortgage balance decreases over the loan term, increasing home equity.<br />
                            • <strong>Ongoing Costs:</strong> Property tax (default 1.1% of home value), homeowners insurance (default 0.35% of home value), and maintenance (default 1.0% of home value) scale with appreciated home value annually. HOA dues and utility increases are adjusted annually for inflation.<br />
                            • <strong>PMI & LTV Rules:</strong> If the down payment is less than 20% of the purchase price (initial Loan-to-Value, or LTV, ratio &gt; 80%), a Private Mortgage Insurance (PMI) fee (default 0.5% annually of the mortgage balance) is added to ongoing expenses. PMI automatically drops off once the outstanding mortgage balance falls to 80% or less of the original purchase price (LTV &le; 80%).<br />
                            • <strong>Home Sale:</strong> If a move-out age or sale year is configured, the property is sold, selling costs (default 6%) are deducted, the remaining mortgage is paid off, and net proceeds are added to brokerage assets. All homeownership expenses then cease.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

      {showDebugDrawer && debugSnapshot && (
        <div 
          id="debug-drawer-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          onClick={() => setShowDebugDrawer(false)}
        >
          <div 
            id="debug-drawer-content"
            style={{
              width: '850px',
              maxWidth: '95vw',
              height: '100%',
              background: 'var(--bg-primary, #090d16)',
              borderLeft: '1px solid var(--border-color, #1e293b)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              color: 'var(--text-primary, #f8fafc)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color, #1e293b)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary, #f8fafc)' }}>
                  ⚙️ Simulation Debugger
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                  Developer tool for simulation analysis & exporting
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  id="debug-download-json-btn"
                  type="button"
                  onClick={() => handleDownloadJSON(debugSnapshot)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    background: 'var(--primary, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  📥 Download JSON
                </button>
                <button
                  id="debug-close-btn"
                  type="button"
                  onClick={() => setShowDebugDrawer(false)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.9rem',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: 'var(--text-secondary, #94a3b8)',
                    border: '1px solid var(--border-color, #1e293b)',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs Bar */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color, #1e293b)',
              background: 'rgba(0,0,0,0.2)',
              padding: '0 1rem'
            }}>
              {[
                { id: 'assumptions', label: 'Assumptions & Growth' },
                { id: 'balances', label: 'Account Balances' },
                { id: 'readiness', label: 'Retirement Readiness' },
                { id: 'drawdowns', label: 'Drawdowns & Sustainability' },
                { id: 'timeline', label: 'Year-by-Year Timeline' },
                { id: 'export', label: 'Warnings & Export' }
              ].map(tab => (
                <button
                  key={tab.id}
                  id={`debug-tab-${tab.id}`}
                  type="button"
                  onClick={() => setDebugTab(tab.id)}
                  style={{
                    padding: '1rem 1.25rem',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    border: 'none',
                    background: 'transparent',
                    color: debugTab === tab.id ? 'var(--primary, #6366f1)' : 'var(--text-secondary, #94a3b8)',
                    borderBottom: debugTab === tab.id ? '2px solid var(--primary, #6366f1)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Content Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              background: '#070a13'
            }}>
              {debugTab === 'assumptions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Assumptions */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '0 0 0.75rem 0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📊 Simulation Assumptions</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Current Age', value: debugSnapshot.simulationAssumptions.currentAge },
                        { label: 'Retirement Age', value: debugSnapshot.simulationAssumptions.retirementAge },
                        { label: 'Life Expectancy', value: debugSnapshot.simulationAssumptions.lifeExpectancy },
                        { label: 'Inflation Rate', value: `${(debugSnapshot.simulationAssumptions.inflationRate * 100).toFixed(1)}%` },
                        { label: 'Salary Growth Rate', value: `${(debugSnapshot.simulationAssumptions.salaryGrowthRate * 100).toFixed(1)}%` },
                        { label: 'Pre-Retirement Return', value: `${(debugSnapshot.simulationAssumptions.preRetirementReturn * 100).toFixed(1)}%` },
                        { label: 'Post-Retirement Return', value: `${(debugSnapshot.simulationAssumptions.postRetirementReturn * 100).toFixed(1)}%` },
                        { label: 'Safe Withdrawal Rate (SWR)', value: `${(debugSnapshot.simulationAssumptions.safeWithdrawalRate * 100).toFixed(1)}%` },
                        { label: 'Tax Mode Enabled', value: debugSnapshot.simulationAssumptions.taxMode ? 'Yes' : 'No' },
                        { label: 'Social Security Enabled', value: debugSnapshot.simulationAssumptions.socialSecurityEnabled ? 'Yes' : 'No' }
                      ].map((item, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e293b', padding: '0.75rem 1rem', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>{item.label}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '0.25rem', color: '#f8fafc' }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Savings Allocation */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '1rem 0 0.75rem 0', color: '#38bdf8' }}>💰 Savings Allocation & Returns</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid #1e293b', padding: '1rem', borderRadius: '8px' }}>
                        <h4 style={{ fontSize: '0.8rem', fontWeight: '700', margin: '0 0 0.75rem 0', color: '#94a3b8' }}>Account Contributions %</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {[
                            { name: 'Cash / checking / HYSA / emergency', val: debugSnapshot.savingsAllocation.cash },
                            { name: 'Brokerage / taxable portfolio', val: debugSnapshot.savingsAllocation.brokerage },
                            { name: 'Traditional 401k / Traditional IRA', val: debugSnapshot.savingsAllocation['401k'] },
                            { name: 'Roth IRA / Roth portfolio', val: debugSnapshot.savingsAllocation.rothIRA },
                            { name: 'HSA / Health Savings Account', val: debugSnapshot.savingsAllocation.hsa }
                          ].map((ac, idx) => (
                            <div key={idx}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                                <span style={{ color: '#cbd5e1' }}>{ac.name}</span>
                                <span style={{ fontWeight: '700', color: '#f8fafc' }}>{ac.val}%</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${ac.val}%`, height: '100%', background: 'var(--primary, #6366f1)', borderRadius: '3px' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e293b', padding: '1rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>Effective Accumulation Return</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981', marginTop: '0.25rem' }}>
                            {(debugSnapshot.savingsAllocation.effectiveAccumulationReturn * 100).toFixed(2)}%
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Weighted average return before retirement</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e293b', padding: '1rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>Effective Retirement Return</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#6366f1', marginTop: '0.25rem' }}>
                            {(debugSnapshot.savingsAllocation.effectiveRetirementReturn * 100).toFixed(2)}%
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Weighted average return post-retirement</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Growth Audit */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '1rem 0 0.75rem 0', color: '#38bdf8' }}>🔍 Account Growth Audit</h3>
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid #1e293b', padding: '1rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#f8fafc' }}>Growth Applied Correctly?</div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Checks if configured growth rate matches simulated rate.</div>
                        </div>
                        <span style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: debugSnapshot.accountGrowthAudit.growthAppliedCorrectly ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: debugSnapshot.accountGrowthAudit.growthAppliedCorrectly ? '#10b981' : '#ef4444',
                          border: debugSnapshot.accountGrowthAudit.growthAppliedCorrectly ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)'
                        }}>
                          {debugSnapshot.accountGrowthAudit.growthAppliedCorrectly ? 'PASS' : 'WARNING / FAIL'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                        {[
                          { label: 'Cash Growth Rate', value: '0.00%', simulated: `${(debugSnapshot.simulationAssumptions.preRetirementReturn * 100).toFixed(1)}%` },
                          { label: 'Brokerage Growth Rate', value: `${(debugSnapshot.accountGrowthAudit.brokerageGrowthRate * 100).toFixed(1)}%`, simulated: `${(debugSnapshot.accountGrowthAudit.brokerageGrowthRate * 100).toFixed(1)}%` },
                          { label: '401k Growth Rate', value: `${(debugSnapshot.accountGrowthAudit['401kGrowthRate'] * 100).toFixed(1)}%`, simulated: `${(debugSnapshot.accountGrowthAudit['401kGrowthRate'] * 100).toFixed(1)}%` },
                          { label: 'Roth IRA Growth Rate', value: `${(debugSnapshot.accountGrowthAudit.rothGrowthRate * 100).toFixed(1)}%`, simulated: `${(debugSnapshot.accountGrowthAudit.rothGrowthRate * 100).toFixed(1)}%` },
                          { label: 'HSA Growth Rate', value: `${(debugSnapshot.accountGrowthAudit.hsaGrowthRate * 100).toFixed(1)}%`, simulated: `${(debugSnapshot.accountGrowthAudit.hsaGrowthRate * 100).toFixed(1)}%` }
                        ].map((ac, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', border: '1px solid #0f172a' }}>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{ac.label}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Configured: <strong style={{ color: '#cbd5e1' }}>{ac.value}</strong></span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Simulated: <strong style={{ color: ac.value !== ac.simulated ? '#ef4444' : '#cbd5e1' }}>{ac.simulated}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {debugTab === 'balances' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: 0, color: '#38bdf8' }}>🏢 Starting vs Retirement Account Balances</h3>
                  <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '0.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Account Type</th>
                          <th style={{ padding: '0.75rem' }}>Starting Balance</th>
                          <th style={{ padding: '0.75rem' }}>Annual Contribution (Y0)</th>
                          <th style={{ padding: '0.75rem' }}>Configured Return</th>
                          <th style={{ padding: '0.75rem' }}>Retirement Balance (Age {debugSnapshot.simulationAssumptions.retirementAge})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Cash (Checking/Savings/HYSA/Emergency)', data: debugSnapshot.accountBalancesAudit.cash },
                          { label: 'Taxable Brokerage', data: debugSnapshot.accountBalancesAudit.brokerage },
                          { label: 'Traditional 401(k) / Traditional IRA', data: debugSnapshot.accountBalancesAudit['401k'] },
                          { label: 'Roth IRA', data: debugSnapshot.accountBalancesAudit.rothIRA },
                          { label: 'HSA', data: debugSnapshot.accountBalancesAudit.hsa }
                        ].map((ac, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #1e293b', color: '#cbd5e1' }}>
                            <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>{ac.label}</td>
                            <td style={{ padding: '0.75rem' }}>{formatCurrency(ac.data.startingBalance)}</td>
                            <td style={{ padding: '0.75rem', color: ac.data.annualContribution > 0 ? '#10b981' : '#64748b' }}>{formatCurrency(ac.data.annualContribution)}</td>
                            <td style={{ padding: '0.75rem' }}>{(ac.data.growthRate * 100).toFixed(1)}%</td>
                            <td style={{ padding: '0.75rem', fontWeight: '700', color: ac.data.retirementBalance > 0 ? '#f8fafc' : '#64748b' }}>{formatCurrency(ac.data.retirementBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {debugTab === 'readiness' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Readiness Calc */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '0 0 0.75rem 0', color: '#38bdf8' }}>🔥 Retirement Readiness (FIRE Number Calculation)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Retirement Year Spending (Nominal)', value: formatCurrency(debugSnapshot.retirementReadinessCalc.retirementSpending) },
                        { label: 'Social Security Income (Nominal)', value: formatCurrency(debugSnapshot.retirementReadinessCalc.socialSecurityIncome), color: '#10b981' },
                        { label: 'Net Required Portfolio Income', value: formatCurrency(debugSnapshot.retirementReadinessCalc.netRequiredPortfolioIncome) },
                        { label: 'Safe Withdrawal Rate (SWR)', value: `${(debugSnapshot.retirementReadinessCalc.safeWithdrawalRate * 100).toFixed(1)}%` },
                        { label: 'Required Portfolio (FIRE Number)', value: formatCurrency(debugSnapshot.retirementReadinessCalc.requiredPortfolio), highlight: true }
                      ].map((item, idx) => (
                        <div key={idx} style={{
                          background: item.highlight ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: item.highlight ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #1e293b',
                          padding: '1rem',
                          borderRadius: '6px'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>{item.label}</div>
                          <div style={{
                            fontSize: '1.25rem',
                            fontWeight: '800',
                            marginTop: '0.25rem',
                            color: item.highlight ? '#38bdf8' : (item.color || '#f8fafc')
                          }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Retirement Year Snapshot */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '0 0 0.75rem 0', color: '#38bdf8' }}>📸 Retirement Year Snapshot (Age {debugSnapshot.retirementYearSnapshot.retirementAge})</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Assets', value: formatCurrency(debugSnapshot.retirementYearSnapshot.assets) },
                        { label: 'Debts', value: formatCurrency(debugSnapshot.retirementYearSnapshot.debts) },
                        { label: 'Net Worth', value: formatCurrency(debugSnapshot.retirementYearSnapshot.netWorth), highlight: true },
                        { label: 'Annual Spending', value: formatCurrency(debugSnapshot.retirementYearSnapshot.annualSpending) },
                        { label: 'Annual Social Security', value: formatCurrency(debugSnapshot.retirementYearSnapshot.annualSocialSecurity), color: '#10b981' },
                        { label: 'Annual Withdrawal Needed', value: formatCurrency(debugSnapshot.retirementYearSnapshot.annualWithdrawalNeeded) }
                      ].map((item, idx) => (
                        <div key={idx} style={{
                          background: item.highlight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: item.highlight ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #1e293b',
                          padding: '1rem',
                          borderRadius: '6px'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>{item.label}</div>
                          <div style={{
                            fontSize: '1.2rem',
                            fontWeight: '800',
                            marginTop: '0.25rem',
                            color: item.highlight ? '#10b981' : (item.color || '#f8fafc')
                          }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {debugTab === 'drawdowns' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Withdrawal Order */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#38bdf8' }}>🔄 Withdrawal Drawdown Sequence</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                      {debugSnapshot.withdrawalStrategy.withdrawalOrder.map((account, idx) => (
                        <Fragment key={idx}>
                          {idx > 0 && <span style={{ color: '#475569', fontWeight: '800' }}>➔</span>}
                          <div style={{ background: '#1e293b', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'capitalize' }}>
                            {account}
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Retirement Sustainability Table */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#38bdf8' }}>📉 Retirement Sustainability Table</h3>
                    <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '0.5rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'right' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Age</th>
                            <th style={{ padding: '0.5rem' }}>Start Assets</th>
                            <th style={{ padding: '0.5rem' }}>Growth</th>
                            <th style={{ padding: '0.5rem' }}>Withdrawals</th>
                            <th style={{ padding: '0.5rem' }}>End Assets</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugSnapshot.retirementSustainabilityTable.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #0f172a', color: '#cbd5e1' }}>
                              <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '700' }}>{row.age}</td>
                              <td style={{ padding: '0.5rem' }}>{formatCurrency(row.startAssets)}</td>
                              <td style={{ padding: '0.5rem', color: row.growth > 0 ? '#38bdf8' : 'inherit' }}>+{formatCurrency(row.growth)}</td>
                              <td style={{ padding: '0.5rem', color: '#ef4444' }}>-{formatCurrency(row.withdrawals)}</td>
                              <td style={{ padding: '0.5rem', fontWeight: '800', color: row.endAssets > 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(row.endAssets)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Withdrawals Breakdown */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#38bdf8' }}>📤 Yearly Withdrawal Strategy Breakdown</h3>
                    <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '0.5rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'right' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Age</th>
                            <th style={{ padding: '0.5rem' }}>Cash Withdrawals</th>
                            <th style={{ padding: '0.5rem' }}>Brokerage Withdrawals</th>
                            <th style={{ padding: '0.5rem' }}>401k Withdrawals</th>
                            <th style={{ padding: '0.5rem' }}>Roth Withdrawals</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugSnapshot.withdrawalStrategy.yearlyWithdrawals.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #0f172a', color: '#cbd5e1' }}>
                              <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '700' }}>{row.age}</td>
                              <td style={{ padding: '0.5rem', color: row.withdrawals.cash > 0 ? '#ef4444' : 'inherit' }}>{formatCurrency(row.withdrawals.cash)}</td>
                              <td style={{ padding: '0.5rem', color: row.withdrawals.brokerage > 0 ? '#ef4444' : 'inherit' }}>{formatCurrency(row.withdrawals.brokerage)}</td>
                              <td style={{ padding: '0.5rem', color: row.withdrawals["401k"] > 0 ? '#ef4444' : 'inherit' }}>{formatCurrency(row.withdrawals["401k"])}</td>
                              <td style={{ padding: '0.5rem', color: row.withdrawals.roth > 0 ? '#ef4444' : 'inherit' }}>{formatCurrency(row.withdrawals.roth)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {debugTab === 'timeline' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#38bdf8' }}>Year-by-Year Computed Timeline</h4>
                    <button
                      id="debug-download-csv-btn"
                      type="button"
                      onClick={() => downloadTimelineCSV(debugSnapshot.yearlyTimeline)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        borderRadius: '4px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      📊 Export CSV (Timeline Only)
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.4rem', textAlign: 'left' }}>Age (Year)</th>
                          <th style={{ padding: '0.4rem' }}>Gross Inc</th>
                          <th style={{ padding: '0.4rem' }}>Taxes</th>
                          <th style={{ padding: '0.4rem' }}>Net Inc</th>
                                        <th style={{ padding: '0.4rem' }}>Net Worth</th>
                          <th style={{ padding: '0.4rem' }}>Scaling Mode</th>
                          <th style={{ padding: '0.4rem' }}>Multiplier</th>
                          <th style={{ padding: '0.4rem' }}>Drift</th>
                          <th style={{ padding: '0.4rem' }}>Status</th>
                          <th style={{ padding: '0.4rem', textAlign: 'left' }}>Events</th>
                          <th style={{ padding: '0.4rem', textAlign: 'left' }}>Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debugSnapshot.yearlyTimeline.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #0f172a', color: '#cbd5e1' }}>
                            <td style={{ padding: '0.4rem', textAlign: 'left', fontWeight: '700' }}>{row.age} ({row.year})</td>
                            <td style={{ padding: '0.4rem' }}>{formatCurrency(row.grossIncome)}</td>
                            <td style={{ padding: '0.4rem', color: '#ef4444' }}>{formatCurrency(row.taxes)}</td>
                            <td style={{ padding: '0.4rem' }}>{formatCurrency(row.netIncome)}</td>
                            <td style={{ padding: '0.4rem', color: '#f59e0b' }}>{formatCurrency(row.expenses)}</td>
                            <td style={{ padding: '0.4rem', color: '#10b981' }}>{formatCurrency(row.contributions)}</td>
                            <td style={{ padding: '0.4rem', color: '#ef4444' }}>{formatCurrency(row.withdrawals)}</td>
                            <td style={{ padding: '0.4rem', color: '#38bdf8' }}>{formatCurrency(row.investmentGrowth)}</td>
                            <td style={{ padding: '0.4rem', color: '#ef4444' }}>{formatCurrency(row.debtBalance)}</td>
                            <td style={{ padding: '0.4rem', color: '#10b981' }}>{formatCurrency(row.assetBalance)}</td>
                            <td style={{ padding: '0.4rem', fontWeight: '700' }}>{formatCurrency(row.netWorth)}</td>
                            <td style={{ padding: '0.4rem' }}>{row.budgetScalingMode || 'lifestyle'}</td>
                            <td style={{ padding: '0.4rem' }}>{row.scalingMultiplier !== undefined ? row.scalingMultiplier.toFixed(2) + 'x' : '1.00x'}</td>
                            <td style={{ padding: '0.4rem', color: Math.abs(row.budgetDrift) > 1.0 ? '#ef4444' : 'inherit' }}>{formatCurrency(row.budgetDrift)}</td>
                            <td style={{ padding: '0.4rem' }}>
                              <span style={{
                                padding: '1px 4px',
                                borderRadius: '4px',
                                background: row.retirementStatus === 'Retired' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: row.retirementStatus === 'Retired' ? '#6366f1' : '#f59e0b'
                              }}>
                                {row.retirementStatus === 'Retired' ? 'Stopped Working' : row.retirementStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.4rem', textAlign: 'left', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.activeEvents.join(', ') || '-'}
                            </td>
                            <td style={{ padding: '0.4rem', textAlign: 'left', color: '#ef4444', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.warningsErrors.join(', ') || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {debugTab === 'export' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Warnings Panel */}
                  <div>
                    <h3 style={{ fontSize: '1.0rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#38bdf8' }}>⚠️ Simulation Inspector Warnings</h3>
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '8px',
                      padding: '1rem',
                      color: '#fcd34d',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {debugSnapshot.warnings.length === 0 ? (
                        <div>No warning flags triggered in this plan.</div>
                      ) : (
                        debugSnapshot.warnings.map((w, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'start', lineHeight: '1.4' }}>
                            <span>•</span>
                            <span>{w}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Exportable JSON Preview */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#38bdf8' }}>Exportable Inspector JSON Preview</h4>
                      <button
                        id="debug-copy-raw-btn"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(debugSnapshot.exportableJSON, null, 2));
                          setCopiedRaw(true);
                          setTimeout(() => setCopiedRaw(false), 2000);
                        }}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer' }}
                      >
                        {copiedRaw ? 'Copied!' : 'Copy Inspector JSON'}
                      </button>
                    </div>
                    <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', border: '1px solid #1e293b', maxHeight: '400px', color: '#94a3b8' }}>
                      {JSON.stringify(debugSnapshot.exportableJSON, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
