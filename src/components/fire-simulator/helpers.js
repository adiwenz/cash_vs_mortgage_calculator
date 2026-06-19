import { calculateUSTaxForModal } from '../../simulatorMathUtils';

export const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
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
        color: 'var(--accent-emerald)',
        bg: 'rgba(16, 185, 129, 0.1)',
        desc: `Your projected assets remain positive through your life expectancy plus 10 years safety buffer (Age ${Number(lifeExpectancy || 85) + 10}).`
      };
    case 'sustainable':
      return {
        label: 'Sustainable Plan',
        badge: '🟡 Sustainable',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.1)',
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
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.1)',
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
    border: '1px solid var(--border-color)'
  };
  const focusLower = savingsFocus.toLowerCase();
  if (focusLower.includes('tip')) {
    return {
      color: 'var(--primary)',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.3)'
    };
  }
  if (focusLower.includes('steady')) {
    return {
      color: '#10b981',
      background: 'rgba(16, 185, 129, 0.12)',
      border: '1px solid rgba(16, 185, 129, 0.3)'
    };
  }
  if (focusLower.includes('gentle') || focusLower.includes('work')) {
    return {
      color: '#3b82f6',
      background: 'rgba(59, 130, 246, 0.12)',
      border: '1px solid rgba(59, 130, 246, 0.3)'
    };
  }
  if (focusLower.includes('balanced')) {
    return {
      color: '#6366f1',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.3)'
    };
  }
  if (focusLower.includes('moderate') || focusLower.includes('save')) {
    return {
      color: '#f59e0b',
      background: 'rgba(245, 158, 11, 0.12)',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    };
  }
  if (focusLower.includes('earnings') || focusLower.includes('active') || focusLower.includes('earn')) {
    return {
      color: '#8b5cf6',
      background: 'rgba(139, 92, 246, 0.12)',
      border: '1px solid rgba(139, 92, 246, 0.3)'
    };
  }
  if (focusLower.includes('accelerated') || focusLower.includes('proactive') || focusLower.includes('dynamic')) {
    return {
      color: '#ec4899',
      background: 'rgba(236, 72, 153, 0.12)',
      border: '1px solid rgba(236, 72, 153, 0.3)'
    };
  }
  return {
    color: 'var(--text-secondary)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-color)'
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
  if (evt.type === 'today' || evt.type === 'lifeExpectancy') {
    return ''; // neutral endpoint circle only
  }
  if (evt.type?.startsWith('retirementReady')) {
    return '🎉';
  }
  if (evt.type === 'retire') {
    return '🏖️';
  }
  if (evt.type === 'socialSecurity') {
    return '💰';
  }
  if (evt.type === 'medicareEligibility') {
    return '🏥';
  }
  return evt.icon || '';
};
