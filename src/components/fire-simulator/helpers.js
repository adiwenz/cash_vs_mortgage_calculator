import { getNormalizedPhases, getEditableBudgetPhases, getTimelineRowInfo, getPhaseChangeExplanations } from '../../fireCalculations';
import { calculateUSTaxForModal, getRetirementLimit, roundCurrency } from '../../simulatorMathUtils';
import formatCompactCurrency, { formatCompactFinancial } from '../../utils/formatCompactCurrency';
import { getEventEmoji, getEventLabel } from '../../features/fire/events';

export { formatCompactCurrency, formatCompactFinancial, getTimelineRowInfo };

export const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val) || val === '') return '';
  const numVal = Number(val);
  const rounded = Math.round(numVal * 100) / 100;
  const hasCents = rounded % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0
  }).format(rounded);
};

export const formatAnnualSummaryCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val) || val === '') return '';
  const numVal = Number(val);
  const rounded = Math.round(numVal);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(rounded);
};

export const formatBudgetCurrency = formatCurrency;

export const clampMoneyValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = parseFloat(val);
  if (!Number.isFinite(num)) return 0;
  return Math.min(999999999999, Math.max(0, num));
};

export const clampAgeValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = parseInt(val, 10);
  if (!Number.isFinite(num)) return 0;
  return Math.min(120, Math.max(0, num));
};

export const clampPercentageValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = parseFloat(val);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, num));
};


export const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  if (val < 0) return `-$${Math.abs(val)}`;
  return `$${val}`;
};

export const getOutcomeDetails = (outcome, runOutAge, readinessCriteria, retirementReadyAge, lifeExpectancy) => {
  switch (outcome) {
    case 'comfortable':
      return {
        label: 'Comfortable Plan',
        badge: '🟢 Comfortable',
        color: 'var(--success)',
        bg: 'var(--success-light)',
        desc: `Your projected assets remain positive through your life expectancy plus 10 years safety buffer (Age ${Number(lifeExpectancy || 85) + 10}).`
      };
    case 'sustainable':
      return {
        label: 'Sustainable Plan',
        badge: '🟡 Sustainable',
        color: 'var(--warning)',
        bg: 'var(--warning-light)',
        desc: `Your projected assets remain positive through life expectancy (Age ${lifeExpectancy || 85}), but do not meet the 10-year safety buffer.`
      };
    case 'retirementGap':
      return {
        label: 'Stop Working Gap',
        badge: '⚪ Stop Working Gap',
        color: 'var(--text-secondary)',
        bg: 'rgba(148, 163, 184, 0.15)',
        desc: `Your projected portfolio is projected to run out at Age ${runOutAge} (before life expectancy). Additional savings, working longer, or reduced spending may be needed.`
      };
    default:
      return {
        label: 'Sustainable Plan',
        badge: '🟡 Sustainable',
        color: 'var(--warning)',
        bg: 'var(--warning-light)',
        desc: 'Your projected assets remain positive through life expectancy. Your portfolio gradually declines but is projected to last.'
      };
  }
};

export const applyScenarioToInputs = (currentInputs, type, value) => {
  const currentIncome = Number(currentInputs.simpleIncome) || 0;
  const currentExpenses = Number(currentInputs.simpleExpenses) || 0;

  if (type === 'savings' || type === 'spending') {
    const bestDeltaRate = value;
    const annualSavingsDelta = (bestDeltaRate * currentIncome) / 100;
    const newExpenses = Math.round(Math.max(0, currentExpenses - annualSavingsDelta));

    return {
      ...currentInputs,
      simpleExpenses: newExpenses,
      spendingPhases: currentInputs.spendingPhases.map((phase, idx) => {
        if (idx === 0 || phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
          return {
            ...phase,
            amount: newExpenses,
            annualSpending: newExpenses
          };
        }
        return phase;
      })
    };
  }

  if (type === 'workLonger') {
    const yearsDelay = value;
    const newRetirementAge = currentInputs.targetRetirementAge + yearsDelay;

    return {
      ...currentInputs,
      targetRetirementAge: newRetirementAge,
      incomeList: currentInputs.incomeList.map(inc => {
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: newRetirementAge };
        }
        return inc;
      }),
      lifeEvents: currentInputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: newRetirementAge };
        }
        return ev;
      })
    };
  }

  if (type === 'income') {
    const extraIncome = value;
    const newIncome = currentInputs.simpleIncome + extraIncome;

    return {
      ...currentInputs,
      simpleIncome: newIncome,
      incomeList: currentInputs.incomeList.map(inc => {
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, amount: (Number(inc.amount) || 0) + extraIncome };
        }
        return inc;
      })
    };
  }

  if (type === 'combined') {
    const savingsPercent = value && typeof value === 'object' ? value.savings : 3;
    const yearsDelay = value && typeof value === 'object' ? value.delay : 2;

    const savingsDelta = (savingsPercent / 100 * currentIncome);
    const newExpenses = Math.round(Math.max(0, currentExpenses - savingsDelta));
    const newRetirementAge = currentInputs.targetRetirementAge + yearsDelay;

    return {
      ...currentInputs,
      targetRetirementAge: newRetirementAge,
      simpleExpenses: newExpenses,
      spendingPhases: currentInputs.spendingPhases.map((phase, idx) => {
        if (idx === 0 || phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
          return {
            ...phase,
            amount: newExpenses,
            annualSpending: newExpenses
          };
        }
        return phase;
      }),
      incomeList: currentInputs.incomeList.map(inc => {
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: newRetirementAge };
        }
        return inc;
      }),
      lifeEvents: currentInputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: newRetirementAge };
        }
        return ev;
      })
    };
  }

  if (type === 'retire65') {
    const target65Age = currentInputs.currentAge < 65 ? 65 : currentInputs.currentAge;
    const deltaRate = value;
    const annualSavingsDelta = (deltaRate * currentIncome) / 100;
    const newExpenses = Math.round(Math.max(0, currentExpenses - annualSavingsDelta));

    return {
      ...currentInputs,
      targetRetirementAge: target65Age,
      simpleExpenses: newExpenses,
      spendingPhases: currentInputs.spendingPhases.map((phase, idx) => {
        if (idx === 0 || phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
          return {
            ...phase,
            amount: newExpenses,
            annualSpending: newExpenses
          };
        }
        return phase;
      }),
      incomeList: currentInputs.incomeList.map(inc => {
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: target65Age };
        }
        return inc;
      }),
      lifeEvents: currentInputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: target65Age };
        }
        return ev;
      })
    };
  }

  return currentInputs;
};

export const getPaceBadgeStyles = (savingsFocus) => {
  if (!savingsFocus) return {
    color: 'var(--text-secondary)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border)'
  };
  const focusLower = savingsFocus.toLowerCase();
  if (focusLower.includes('tip')) {
    return {
      color: 'var(--primary)',
      background: 'var(--primary-light)',
      border: '1px solid rgba(22, 163, 74, 0.3)'
    };
  }
  if (focusLower.includes('steady')) {
    return {
      color: 'var(--success)',
      background: 'var(--success-light)',
      border: '1px solid rgba(22, 163, 74, 0.3)'
    };
  }
  if (focusLower.includes('gentle') || focusLower.includes('work')) {
    return {
      color: 'var(--secondary)',
      background: 'var(--secondary-light)',
      border: '1px solid rgba(30, 58, 95, 0.3)'
    };
  }
  if (focusLower.includes('balanced')) {
    return {
      color: 'var(--primary)',
      background: 'var(--primary-light)',
      border: '1px solid rgba(22, 163, 74, 0.3)'
    };
  }
  if (focusLower.includes('moderate') || focusLower.includes('save')) {
    return {
      color: 'var(--warning)',
      background: 'var(--warning-light)',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    };
  }
  if (focusLower.includes('earnings') || focusLower.includes('active') || focusLower.includes('earn')) {
    return {
      color: 'var(--secondary)',
      background: 'var(--secondary-light)',
      border: '1px solid rgba(30, 58, 95, 0.3)'
    };
  }
  if (focusLower.includes('accelerated') || focusLower.includes('proactive') || focusLower.includes('dynamic')) {
    return {
      color: 'var(--danger)',
      background: 'var(--danger-light)',
      border: '1px solid rgba(220, 38, 38, 0.3)'
    };
  }
  return {
    color: 'var(--text-secondary)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border)'
  };
};

export const getAssetLabel = (key) => {
  const labels = {
    cash: 'Cash / Reserves',
    emergencyFund: 'Emergency Fund',
    brokerage: 'Taxable Brokerage',
    trad401k: 'Traditional 401k',
    tradIra: 'Traditional IRA',
    rothIra: 'Roth IRA',
    hsa: 'HSA (Health Savings)',
    other: 'Other Investments'
  };
  return labels[key] || key;
};

export const getLifestyleGaps = (logs) => {
  if (!logs) return [];
  const gaps = [];
  let currentGap = null;
  
  logs.forEach(log => {
    if (log.lifestyleGap && log.lifestyleGap > 0) {
      if (currentGap && currentGap.endAge === log.age - 1) {
        currentGap.endAge = log.age;
        currentGap.maxGap = Math.max(currentGap.maxGap, log.lifestyleGap);
        currentGap.totalGap += log.lifestyleGap;
        currentGap.yearsCount++;
      } else {
        if (currentGap) {
          gaps.push(currentGap);
        }
        currentGap = {
          startAge: log.age,
          endAge: log.age,
          maxGap: log.lifestyleGap,
          totalGap: log.lifestyleGap,
          yearsCount: 1
        };
      }
    } else {
      if (currentGap) {
        gaps.push(currentGap);
        currentGap = null;
      }
    }
  });
  if (currentGap) {
    gaps.push(currentGap);
  }
  return gaps;
};

import { getSavingsBreakdown as domainGetSavingsBreakdown, calculateMarriageEstimates as domainCalculateMarriageEstimates } from '../../domain/events/marriage/marriageImpact.js';

export const getSavingsBreakdown = domainGetSavingsBreakdown;
export const calculateMarriageEstimates = domainCalculateMarriageEstimates;

export const getDefaultValuesForType = (type, currentAge) => {
  switch (type) {
    case 'checkingSavings':
      return {
        name: 'Cash / Savings',
        value: 10000,
        monthlyAmount: 200,
        rate: 4,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
    case 'brokerage':
      return {
        name: 'Investment Account',
        value: 50000,
        monthlyAmount: 500,
        rate: 7,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
    case 'house':
      return {
        name: 'Primary Home',
        value: 350000,
        monthlyAmount: 2000,
        rate: 3,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
    case 'child':
      return {
        name: 'Child 1',
        value: 0,
        monthlyAmount: 800,
        rate: 3,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
    case 'studentLoan':
      return {
        name: 'Student Loan',
        value: 20000,
        monthlyAmount: 250,
        rate: 4.5,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
    case 'creditCard':
      return {
        name: 'Credit Card',
        value: 5000,
        monthlyAmount: 150,
        rate: 18,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
    case 'carLoan':
      return {
        name: 'Car Loan',
        value: 15000,
        monthlyAmount: 350,
        rate: 5.5,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
    default:
      return {
        name: '',
        value: 0,
        monthlyAmount: 0,
        rate: 0,
        notes: '',
        startAge: currentAge,
        endAge: ''
      };
  }
};

export const isEditableEvent = (evt) => {
  if (!evt) return false;
  if (evt.type === 'socialSecurity') return true;
  const calculatedTypes = [
    'medicareEligibility',
    'socialSecurity',
    'mortgageOff',
    'retirementReadySurvival',
    'retirementReadyComfortable',
    'retirementReadySWR',
    'payoffPlanEnd',
    'childSupportEnds',
    'coastFire'
  ];
  if (calculatedTypes.includes(evt.type)) {
    return false;
  }
  return !!evt.originalId || evt.type === 'retire';
};

export const isFinancialEvent = (evt) => {
  if (!evt) return false;
  if (evt.type === 'today' || evt.type === 'lifeExpectancy') return false;
  if (isEditableEvent(evt)) return false;
  const financialTypes = [
    'mortgageOff',
    'childSupportEnds',
    'medicareEligibility',
    'socialSecurity',
    'debtPayoff',
    'pension',
    'rentalIncome',
    'annuity',
    'otherRetirementIncome'
  ];
  if (financialTypes.includes(evt.type)) {
    return true;
  }
  const mainMilestoneTypes = [
    'retire',
    'buyHouse',
    'sellHouse',
    'haveChild',
    'marriage',
    'retirementReadySurvival',
    'retirementReadyComfortable',
    'retirementReadySWR',
    'coastFire'
  ];
  if (evt.isMilestone && !evt.originalId && !mainMilestoneTypes.includes(evt.type)) {
    return true;
  }
  return false;
};

export const getEventIcon = (evt) => {
  if (!evt) return '';
  // Special override for retirement in getEventIcon, where it has historically been ⭐ on charts/timeline
  if (evt.type === 'retire') {
    return '⭐';
  }
  return getEventEmoji(evt);
};

export function getEventMarkerPosition(event, chartData, xScale, yScale, displayAge) {
  if (!chartData || chartData.length === 0) {
    return { x: 0, y: 0 };
  }
  const eventAge = Number(displayAge !== undefined ? displayAge : event.age);
  const closestPoint = chartData.reduce((best, point) =>
    Math.abs(point.age - eventAge) < Math.abs(best.age - eventAge)
      ? point
      : best
  , chartData[0]);

  const xVal = xScale(eventAge) !== undefined ? xScale(eventAge) : xScale(closestPoint.age);
  return {
    x: xVal,
    y: yScale(closestPoint.netWorth ?? 0)
  };
}

export function getEventsForAge(inputs, age) {
  const currentAge = Number(inputs.currentAge) || 35;
  const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
  const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled !== false);
  
  const events = [];

  enabledEvents.forEach(e => {
    let matches = false;
    
    if (e.age !== undefined && e.age !== '' && Number(e.age) === age) {
      matches = true;
    } else if (e.startAge !== undefined && e.startAge !== '' && Number(e.startAge) === age) {
      matches = true;
    } else if (e.purchaseAge !== undefined && e.purchaseAge !== '' && Number(e.purchaseAge) === age) {
      matches = true;
    } else if (e.claimingAge !== undefined && e.claimingAge !== '' && Number(e.claimingAge) === age) {
      matches = true;
    } else if (e.type === 'haveChild') {
      const birthAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
      if (birthAge === age) matches = true;
    }

    if (matches) {
      const emoji = getEventEmoji(e) || '❓';
      const name = getEventLabel(e) || e.name || e.type;

      events.push({
        ...e,
        name,
        emoji,
        icon: emoji
      });
    }
  });

  // Today marker
  if (age === currentAge && !events.some(e => e.type === 'today')) {
    events.unshift({
      id: 'today',
      type: 'today',
      name: 'Today',
      emoji: '●',
      icon: '●',
      age: currentAge
    });
  }

  // Automatic retirement event if target retirement age reached and not custom retire
  if (age === targetRetirementAge && !events.some(e => e.type === 'retire')) {
    events.push({
      id: 'retire-auto',
      type: 'retire',
      name: 'Retirement',
      emoji: '🏖️',
      icon: '🏖️',
      age: targetRetirementAge
    });
  }

  return events;
}

export function getTimelineAges(inputs) {
  const currentAge = Number(inputs.currentAge) || 35;
  const lifeExpectancy = Number(inputs.lifeExpectancy) || 85;
  const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;

  const ages = new Set();
  ages.add(currentAge);
  
  const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled !== false);
  
  enabledEvents.forEach(e => {
    if (e.id && typeof e.id === 'string' && e.id.startsWith('child-income-boost')) {
      return;
    }
    const possibleAges = [
      e.age,
      e.startAge,
      e.purchaseAge,
      e.claimingAge,
      e.birthAge,
      e.payoffAge
    ];

    if (e.type === 'haveChild') {
      const birthAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
      possibleAges.push(birthAge);
    }
    
    possibleAges.forEach(val => {
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val);
        if (!isNaN(num) && num >= currentAge && num < lifeExpectancy) {
          ages.add(num);
        }
      }
    });
  });

  if (targetRetirementAge >= currentAge && targetRetirementAge < lifeExpectancy) {
    ages.add(targetRetirementAge);
  }

  const sortedAges = Array.from(ages).sort((a, b) => a - b);
  return sortedAges.map(age => {
    const events = getEventsForAge(inputs, age);
    const emojis = events.map(e => e.emoji).filter(Boolean);
    const isToday = age === currentAge;
    
    return {
      age,
      year: (inputs.startYear || 2026) + (age - currentAge),
      events,
      emojis: Array.from(new Set(emojis)),
      label: isToday ? 'Today' : events.map(e => e.name).join(', ')
    };
  });
}

export function getAppliedEventsThroughAge(inputs, age) {
  const currentAge = Number(inputs.currentAge) || 35;
  const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled !== false);
  const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;

  const applied = [];

  enabledEvents.forEach(e => {
    let eventAge = null;
    if (e.age !== undefined && e.age !== '') eventAge = Number(e.age);
    else if (e.startAge !== undefined && e.startAge !== '') eventAge = Number(e.startAge);
    else if (e.purchaseAge !== undefined && e.purchaseAge !== '') eventAge = Number(e.purchaseAge);
    else if (e.claimingAge !== undefined && e.claimingAge !== '') eventAge = Number(e.claimingAge);
    else if (e.type === 'haveChild') {
      eventAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
    }

    if (eventAge !== null && eventAge <= age && eventAge > currentAge) {
      const emoji = getEventEmoji(e) || '❓';
      const name = getEventLabel(e) || e.name || e.type;

      applied.push({
        ...e,
        name,
        emoji,
        icon: emoji,
        eventAge
      });
    }
  });

  if (targetRetirementAge <= age && targetRetirementAge > currentAge && !applied.some(e => e.type === 'retire')) {
    applied.push({
      id: 'retire-auto',
      type: 'retire',
      name: 'Retirement',
      emoji: '🏖️',
      icon: '🏖️',
      eventAge: targetRetirementAge
    });
  }

  return applied;
}

export function getBudgetForAge(inputs, age) {
  const currentAge = Number(inputs.currentAge) || 35;
  const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
  const normalizedPhases = (age === currentAge && currentAge < targetRetirementAge)
    ? getEditableBudgetPhases(inputs)
    : getNormalizedPhases(inputs);
  
  const phase = normalizedPhases.find(p => age >= p.startAge && age < p.endAge)
                || normalizedPhases[normalizedPhases.length - 1]
                || normalizedPhases[0];

  const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled);
  const spouseMember = (inputs.lifeEvents || []).find(e => e.type === 'spouseMember');
  const isMarriedMode = !!(phase.isMarried || marriageEvent || spouseMember || inputs.filingStatus === 'married' || inputs.filingStatus === 'jointly');
  const budgetMonthlyIncome = phase.income || 0;
  const budgetExpenses = phase.expenses || {};
  const budgetSavings = phase.savings || {};
  const budgetPartnerSavings = phase.partnerSavings || {};
  const savingsAllocMode = phase.savingsAllocMode || 'fixed';

  const filingStatus = inputs.filingStatus || 'single';
  const partnerMonthlyIncome = isMarriedMode ? roundCurrency(Number(marriageEvent?.spouseIncome || phase.spouseIncome || 0) / 12) : 0;
  const combinedIncome = isMarriedMode ? (budgetMonthlyIncome + partnerMonthlyIncome) : budgetMonthlyIncome;

  const totalExpensesMonthly = Object.values(budgetExpenses).reduce((sum, val) => sum + val, 0);
  const activeDebtsTotal = Object.keys(budgetExpenses)
    .filter(k => k.startsWith('debt_'))
    .reduce((sum, k) => sum + (Number(budgetExpenses[k]) || 0), 0);

  const needsTotal = (Number(budgetExpenses.housing) || 0) +
                     (Number(budgetExpenses.utilities) || 0) +
                     (Number(budgetExpenses.food) || 0) +
                     (Number(budgetExpenses.transportation) || 0) +
                     (Number(budgetExpenses.healthcare) || 0) +
                     (isMarriedMode ? (Number(budgetExpenses.debt) || 0) : 0) +
                     (Number(budgetExpenses.childcare) || 0) +
                     (Number(budgetExpenses['🏠 Mortgage']) || Number(budgetExpenses['mortgage']) || 0) +
                     activeDebtsTotal;
  const wantsTotal = (Number(budgetExpenses.leisure) || 0) +
                     (Number(budgetExpenses.diningOut) || 0) +
                     (Number(budgetExpenses.misc) || 0);

  const surplusMonthly = Math.max(0, combinedIncome - totalExpensesMonthly);
  const filingStatusForModal = isMarriedMode ? (marriageEvent?.filingStatus || 'jointly') : filingStatus;

  const budgetHsaCoverage = inputs.budgetDetails?.hsaCoverage || 'single';
  const est401kMonthly = savingsAllocMode === 'percentSurplus' ? roundCurrency(surplusMonthly * ((budgetSavings.trad401k || 0) / 100)) : (budgetSavings.trad401k || 0);
  const estTradIraMonthly = savingsAllocMode === 'percentSurplus' ? roundCurrency(surplusMonthly * ((budgetSavings.tradIra || 0) / 100)) : (budgetSavings.tradIra || 0);
  const estHsaMonthly = savingsAllocMode === 'percentSurplus' ? roundCurrency(surplusMonthly * ((budgetSavings.hsa || 0) / 100)) : (budgetSavings.hsa || 0);

  const userAge = phase.startAge || currentAge;
  const limit401k = getRetirementLimit('401k', userAge, filingStatusForModal);
  const limitTradIra = getRetirementLimit('traditionalIRA', userAge, filingStatusForModal);
  const limitHsa = getRetirementLimit('hsa', userAge, budgetHsaCoverage === 'family' ? 'married' : 'single');

  const capped401k = Math.min(limit401k, est401kMonthly * 12);
  const cappedTradIra = Math.min(limitTradIra, estTradIraMonthly * 12);
  const cappedHsa = Math.min(limitHsa, estHsaMonthly * 12);
  let preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;

  if (isMarriedMode) {
    const spouseMember = (inputs.lifeEvents || []).find(e => e.type === 'spouseMember');
    const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
      ? Number(spouseMember.currentAge)
      : (marriageEvent && marriageEvent.spouseCurrentAge !== undefined ? Number(marriageEvent.spouseCurrentAge) : inputs.currentAge || 30);
    const ageDifference = spouseCurrentAge - (inputs.currentAge || 30);
    const spouseAge = userAge + ageDifference;

    const estPartner401k = savingsAllocMode === 'percentSurplus' ? roundCurrency(surplusMonthly * ((budgetPartnerSavings.trad401k || 0) / 100)) : (budgetPartnerSavings.trad401k || 0);
    const estPartnerTradIra = savingsAllocMode === 'percentSurplus' ? roundCurrency(surplusMonthly * ((budgetPartnerSavings.tradIra || 0) / 100)) : (budgetPartnerSavings.tradIra || 0);
    const estPartnerHsa = savingsAllocMode === 'percentSurplus' ? roundCurrency(surplusMonthly * ((budgetPartnerSavings.hsa || 0) / 100)) : (budgetPartnerSavings.hsa || 0);

    const partnerLimit401k = getRetirementLimit('401k', spouseAge, filingStatusForModal);
    const partnerLimitTradIra = getRetirementLimit('traditionalIRA', spouseAge, filingStatusForModal);
    const partnerLimitHsa = getRetirementLimit('hsa', spouseAge, budgetHsaCoverage === 'family' ? 'married' : 'single');

    const partnerCapped401k = Math.min(partnerLimit401k, estPartner401k * 12);
    const partnerCappedTradIra = Math.min(partnerLimitTradIra, estPartnerTradIra * 12);
    const partnerCappedHsa = Math.min(partnerLimitHsa, estPartnerHsa * 12);
    preTaxDeductionsAnnual += partnerCapped401k + partnerCappedTradIra + partnerCappedHsa;
  }

  const annualTax = inputs.includeTaxes
    ? calculateUSTaxForModal(combinedIncome * 12, preTaxDeductionsAnnual, filingStatusForModal)
    : 0;
  const monthlyTax = roundCurrency(annualTax / 12);
  const takeHomeIncome = inputs.includeTaxes ? (combinedIncome - monthlyTax) : combinedIncome;

  const totalUserAllocationPct = Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);
  const totalPartnerAllocationPct = isMarriedMode ? Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0) : 0;
  
  const userSavingsMonthly = savingsAllocMode === 'percentSurplus'
    ? roundCurrency(surplusMonthly * (totalUserAllocationPct / 100))
    : Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);

  const partnerSavingsMonthly = isMarriedMode 
    ? (savingsAllocMode === 'percentSurplus'
       ? roundCurrency(surplusMonthly * (totalPartnerAllocationPct / 100))
       : Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0))
    : 0;

  const activeSavings = userSavingsMonthly + partnerSavingsMonthly;

  const needsPct = takeHomeIncome > 0 ? Math.round((needsTotal / takeHomeIncome) * 100) : 0;
  const wantsPct = takeHomeIncome > 0 ? Math.round((wantsTotal / takeHomeIncome) * 100) : 0;
  const savingsPct = takeHomeIncome > 0 ? Math.round((activeSavings / takeHomeIncome) * 100) : 0;

  const eventImpacts = [];
  if (age > currentAge) {
    const explanations = [];
    normalizedPhases.forEach(p => {
      if (p.startAge > currentAge && p.startAge <= age) {
        const pExps = getPhaseChangeExplanations(p, normalizedPhases);
        pExps.forEach(exp => {
          if (exp.text && !exp.text.includes("Starting phase") && !exp.text.includes("Transitioned to")) {
            if (exp.impacts && exp.impacts.length > 0) {
              exp.impacts.forEach(imp => {
                const label = exp.type === 'childcare' ? 'Child' : (exp.type === 'marriage' ? 'Marriage' : (exp.type === 'housing' ? 'Home Purchase' : (exp.type === 'retirement' ? 'Retirement' : exp.type)));
                explanations.push(`${imp} from ${label}`);
              });
            } else {
              explanations.push(exp.text);
            }
          }
        });
      }
    });
    eventImpacts.push(...explanations);
  }

  const isSpendingExceedingIncome = totalExpensesMonthly > takeHomeIncome;
  const activeSavingsRate = isSpendingExceedingIncome
    ? 0
    : (combinedIncome > 0 
       ? Math.min(100, Math.max(0, Math.round((activeSavings / combinedIncome) * 100))) 
       : 0);

  return {
    income: combinedIncome,
    takeHomeIncome,
    categoryTotals: {
      needs: needsTotal,
      wants: wantsTotal,
      savings: activeSavings
    },
    allocationPercentages: {
      needs: needsPct,
      wants: wantsPct,
      savings: savingsPct
    },
    eventImpactsApplied: eventImpacts,
    monthlySavings: activeSavings,
    savingsRate: activeSavingsRate,
    totalMonthlySpending: totalExpensesMonthly,
    phase
  };
}

export function getCategoryBreakdown(budget, category, inputs, isMarriedModeOverride) {
  const phase = budget.phase;
  const expenses = phase.expenses || {};
  const savings = phase.savings || {};
  const partnerSavings = phase.partnerSavings || {};
  const marriageEvent = (inputs?.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled);
  const spouseMember = (inputs?.lifeEvents || []).find(e => e.type === 'spouseMember');
  const isMarriedMode = isMarriedModeOverride !== undefined 
    ? isMarriedModeOverride 
    : !!(phase.isMarried || marriageEvent || spouseMember || inputs?.filingStatus === 'married' || inputs?.filingStatus === 'jointly');
  const childCount = phase.childCount || 0;
  const activeDebts = phase.activeDebts || [];
  const currentAge = Number(inputs.currentAge) || 35;
  const selectedBudgetAge = phase.startAge;

  const rows = [];

  const findEvent = (type) => {
    return (inputs?.lifeEvents || []).find(e => e.type === type && e.enabled);
  };

  const todayBudget = getBudgetForAge(inputs, currentAge);
  const todayExpenses = todayBudget.phase.expenses || {};
  const todaySavings = todayBudget.phase.savings || {};
  const todayPartnerSavings = todayBudget.phase.partnerSavings || {};

  if (category === 'needs') {
    // Housing
    const buyHouseEvent = findEvent('buyHouse');
    const isHousingLocked = !!(buyHouseEvent && Number(buyHouseEvent.purchaseAge || buyHouseEvent.age) <= selectedBudgetAge);
    const housingChange = (expenses.housing || 0) - (todayExpenses.housing || 0);
    rows.push({
      key: 'housing',
      label: 'Housing (Rent/Mortgage)',
      amount: expenses.housing || 0,
      isLocked: isHousingLocked,
      lockedReason: isHousingLocked ? 'Managed by Home Purchase Event' : null,
      eventType: isHousingLocked ? 'buyHouse' : null,
      eventId: isHousingLocked ? buyHouseEvent.id : null,
      changeFromToday: housingChange
    });

    // Utilities
    const utilChange = (expenses.utilities || 0) - (todayExpenses.utilities || 0);
    rows.push({
      key: 'utilities',
      label: 'Utilities & Subscriptions',
      amount: expenses.utilities || 0,
      isLocked: false,
      changeFromToday: utilChange
    });

    // Food
    const foodChange = (expenses.food || 0) - (todayExpenses.food || 0);
    rows.push({
      key: 'food',
      label: 'Food (Groceries)',
      amount: expenses.food || 0,
      isLocked: false,
      changeFromToday: foodChange
    });

    // Transportation
    const transChange = (expenses.transportation || 0) - (todayExpenses.transportation || 0);
    rows.push({
      key: 'transportation',
      label: 'Transportation / Gas / Car',
      amount: expenses.transportation || 0,
      isLocked: false,
      changeFromToday: transChange
    });

    // Healthcare
    const healthChange = (expenses.healthcare || 0) - (todayExpenses.healthcare || 0);
    rows.push({
      key: 'healthcare',
      label: 'Healthcare & Insurance',
      amount: expenses.healthcare || 0,
      isLocked: false,
      changeFromToday: healthChange
    });

    // Debt
    if (isMarriedMode) {
      const debtChange = (expenses.debt || 0) - (todayExpenses.debt || 0);
      rows.push({
        key: 'debt',
        label: 'Debt Payments',
        amount: expenses.debt || 0,
        isLocked: false,
        changeFromToday: debtChange
      });
    }

    // Childcare
    if (childCount > 0 || (expenses.childcare && expenses.childcare > 0)) {
      const childEvent = findEvent('haveChild');
      const ccChange = (expenses.childcare || 0) - (todayExpenses.childcare || 0);
      rows.push({
        key: 'childcare',
        label: 'Childcare',
        amount: expenses.childcare || 0,
        isLocked: true,
        lockedReason: 'Managed by Child Event',
        eventType: 'haveChild',
        eventId: childEvent?.id || 'child-auto',
        changeFromToday: ccChange
      });
    }

    // Mortgage
    const mortgageVal = expenses['🏠 Mortgage'] || expenses['mortgage'] || 0;
    const todayMortgageVal = todayExpenses['🏠 Mortgage'] || todayExpenses['mortgage'] || 0;
    if (mortgageVal > 0 || todayMortgageVal > 0) {
      rows.push({
        key: '🏠 Mortgage',
        label: 'Mortgage',
        amount: mortgageVal,
        isLocked: true,
        lockedReason: 'Managed by Home Purchase Event',
        eventType: 'buyHouse',
        eventId: buyHouseEvent?.id || 'house-auto',
        changeFromToday: mortgageVal - todayMortgageVal
      });
    }

    // Itemized Debts
    activeDebts.filter(debt => debt.type !== 'mortgage').forEach(debt => {
      const todayDebtVal = todayExpenses[`debt_${debt.id}`] || 0;
      const debtVal = expenses[`debt_${debt.id}`] || debt.monthlyPayment || 0;
      rows.push({
        key: `debt_${debt.id}`,
        label: `${debt.icon || '💸'} ${debt.name}`,
        amount: debtVal,
        isLocked: true,
        lockedReason: 'Managed by Debt/Loan Event',
        eventType: 'borrowing',
        eventId: debt.id,
        changeFromToday: debtVal - todayDebtVal
      });
    });
  } 
  
  else if (category === 'wants') {
    const leisureChange = (expenses.leisure || 0) - (todayExpenses.leisure || 0);
    rows.push({
      key: 'leisure',
      label: 'Leisure & Travel',
      amount: expenses.leisure || 0,
      isLocked: false,
      changeFromToday: leisureChange
    });

    const diningChange = (expenses.diningOut || 0) - (todayExpenses.diningOut || 0);
    rows.push({
      key: 'diningOut',
      label: 'Dining Out',
      amount: expenses.diningOut || 0,
      isLocked: false,
      changeFromToday: diningChange
    });

    const miscChange = (expenses.misc || 0) - (todayExpenses.misc || 0);
    rows.push({
      key: 'misc',
      label: 'Miscellaneous',
      amount: expenses.misc || 0,
      isLocked: false,
      changeFromToday: miscChange
    });
  } 
  
  else if (category === 'savings') {
    const isRetirement = phase.type === 'retire';
    
    const savingsItems = [
      { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
      { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr combined' },
      { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr combined' },
      { key: 'hsa', label: 'HSA', desc: 'HSA Coverage' },
      { key: 'brokerage', label: 'Brokerage' },
      { key: 'checking', label: 'Checking Account' },
      { key: 'hysa', label: 'High-Yield Savings' },
      { key: 'emergency', label: 'Emergency Fund' },
      { key: 'cash', label: 'Cash Savings' },
      { key: 'debt', label: 'Debt Payoff' },
      { key: 'other', label: 'Other Savings' }
    ];

    savingsItems.forEach(item => {
      const todayVal = todaySavings[item.key] || 0;
      const targetVal = savings[item.key] || 0;
      rows.push({
        key: item.key,
        label: item.label,
        amount: targetVal,
        desc: item.desc,
        isLocked: isRetirement,
        lockedReason: isRetirement ? 'Work-based savings are disabled during retirement' : null,
        isPartner: false,
        changeFromToday: targetVal - todayVal
      });
    });

    if (isMarriedMode) {
      const partnerItems = [
        { key: 'trad401k', label: 'Partner 401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
        { key: 'rothIra', label: 'Partner Roth IRA', desc: 'Limit $7,000/yr' },
        { key: 'tradIra', label: 'Partner Traditional IRA', desc: 'Limit $7,000/yr' },
        { key: 'hsa', label: 'Partner HSA', desc: 'HSA Coverage' },
        { key: 'brokerage', label: 'Partner Brokerage' },
        { key: 'checking', label: 'Partner Checking Account' },
        { key: 'hysa', label: 'Partner High-Yield Savings' },
        { key: 'emergency', label: 'Partner Emergency Fund' },
        { key: 'cash', label: 'Partner Cash Savings' },
        { key: 'debt', label: 'Partner Other Debt' },
        { key: 'other', label: 'Partner Other Savings' }
      ];

      partnerItems.forEach(item => {
        const todayVal = todayPartnerSavings[item.key] || 0;
        const targetVal = partnerSavings[item.key] || 0;
        rows.push({
          key: item.key,
          label: item.label,
          amount: targetVal,
          desc: item.desc,
          isLocked: isRetirement,
          lockedReason: isRetirement ? 'Work-based savings are disabled during retirement' : null,
          isPartner: true,
          changeFromToday: targetVal - todayVal
        });
      });
    }
  }

  return rows;
}

export function getChangesFromToday(inputs, selectedBudgetAge) {
  const currentAge = Number(inputs.currentAge) || 35;
  if (selectedBudgetAge <= currentAge) return [];

  const todayBudget = getBudgetForAge(inputs, currentAge);
  const targetBudget = getBudgetForAge(inputs, selectedBudgetAge);

  const changes = [];

  const incomeDiff = targetBudget.income - todayBudget.income;
  if (incomeDiff !== 0) {
    const isMarried = targetBudget.phase.isMarried && !todayBudget.phase.isMarried;
    const source = isMarried ? '💍 Marriage' : '💼 Income Change';
    changes.push({
      event: source,
      text: `${incomeDiff > 0 ? '+' : ''}${formatCurrency(incomeDiff)}/mo income`
    });
  }

  const todayChildcare = todayBudget.phase.expenses.childcare || 0;
  const targetChildcare = targetBudget.phase.expenses.childcare || 0;
  if (targetChildcare !== todayChildcare) {
    changes.push({
      event: '👶 Child',
      text: `+${formatCurrency(targetChildcare - todayChildcare)}/mo childcare`
    });
  }

  const todayMortgage = todayBudget.phase.expenses['🏠 Mortgage'] || todayBudget.phase.expenses['mortgage'] || 0;
  const targetMortgage = targetBudget.phase.expenses['🏠 Mortgage'] || targetBudget.phase.expenses['mortgage'] || 0;
  if (targetMortgage !== todayMortgage) {
    changes.push({
      event: '🏠 Home Purchase',
      text: `+${formatCurrency(targetMortgage - todayMortgage)}/mo mortgage`
    });
  }

  const todayHousing = todayBudget.phase.expenses.housing || 0;
  const targetHousing = targetBudget.phase.expenses.housing || 0;
  if (targetHousing !== todayHousing) {
    const hasBoughtHouse = targetBudget.phase.expenses['🏠 Mortgage'] > 0;
    const source = hasBoughtHouse ? '🏠 Home Purchase' : 'Lifestyle';
    changes.push({
      event: source,
      text: `${targetHousing - todayHousing > 0 ? '+' : ''}${formatCurrency(targetHousing - todayHousing)}/mo housing`
    });
  }

  const categories = ['utilities', 'food', 'transportation', 'healthcare'];
  categories.forEach(cat => {
    const todayVal = todayBudget.phase.expenses[cat] || 0;
    const targetVal = targetBudget.phase.expenses[cat] || 0;
    if (targetVal !== todayVal) {
      changes.push({
        event: 'Lifestyle',
        text: `${targetVal - todayVal > 0 ? '+' : ''}${formatCurrency(targetVal - todayVal)}/mo ${cat}`
      });
    }
  });

  const wantsCats = ['leisure', 'diningOut', 'misc'];
  wantsCats.forEach(cat => {
    const todayVal = todayBudget.phase.expenses[cat] || 0;
    const targetVal = targetBudget.phase.expenses[cat] || 0;
    if (targetVal !== todayVal) {
      changes.push({
        event: 'Lifestyle',
        text: `${targetVal - todayVal > 0 ? '+' : ''}${formatCurrency(targetVal - todayVal)}/mo ${cat}`
      });
    }
  });

  const rateDiff = Math.round(targetBudget.savingsRate - todayBudget.savingsRate);
  if (rateDiff !== 0) {
    changes.push({
      event: 'Savings Rate',
      text: `${rateDiff > 0 ? '+' : ''}${rateDiff}%`
    });
  }

  return changes;
}


