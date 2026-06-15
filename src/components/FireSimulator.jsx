/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { runFireSimulation, validateFireInputs, getSocialSecurityFactor, validateSocialSecurityClaimAge, calculateSocialSecurityBenefit, getIncomeHistory, calculateTop35AverageIncome, calculateClaimingAgeMultiplier, getNormalizedPhases } from '../fireCalculations';
import { 
  calculateRetireAt65Recommendation, 
  calculateSaveMoreRecommendation, 
  calculateEarnMoreRecommendation,
  getChildCostOffsetRecommendations
} from '../recommendations';
import './FireSimulator.css';

import { DEFAULT_FIRE_INPUTS } from '../defaultInputs';

// Help formatters
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

const estimateAdditionalMonthlySavings = (gap, years, annualRate) => {
  if (years <= 0 || gap <= 0) return 0;
  const r = (annualRate || 7) / 100 / 12;
  const n = years * 12;
  if (r === 0) return gap / n;
  const fvFactor = (Math.pow(1 + r, n) - 1) / r;
  return gap / fvFactor;
};

const getReasonableSavingsAllocation = (total) => {
  const cash = Math.round(total * 0.10);
  const emergencyFund = Math.round(total * 0.15);
  const trad401k = Math.round(total * 0.35);
  const tradIra = Math.round(total * 0.10);
  const rothIra = Math.round(total * 0.15);
  const hsa = Math.round(total * 0.05);
  const brokerage = Math.max(0, total - (cash + emergencyFund + trad401k + tradIra + rothIra + hsa));
  return {
    cash,
    emergencyFund,
    trad401k,
    tradIra,
    rothIra,
    hsa,
    brokerage,
    other: 0
  };
};

// U.S. Federal Tax Data (2026 guidelines) for the Budget Modal
const MODAL_TAX_DATA = {
  single: {
    standardDeduction: 16100,
    brackets: [
      { limit: 12400, rate: 0.10 },
      { limit: 50400, rate: 0.12 },
      { limit: 105700, rate: 0.22 },
      { limit: 201775, rate: 0.24 },
      { limit: 256225, rate: 0.32 },
      { limit: 640600, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  },
  married: {
    standardDeduction: 32200,
    brackets: [
      { limit: 24800, rate: 0.10 },
      { limit: 100800, rate: 0.12 },
      { limit: 211400, rate: 0.22 },
      { limit: 403550, rate: 0.24 },
      { limit: 512450, rate: 0.32 },
      { limit: 768700, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  }
};

const calculateUSTaxForModal = (grossIncome, preTaxDeductions, filingStatus) => {
  const taxConfig = MODAL_TAX_DATA[filingStatus] || MODAL_TAX_DATA.single;
  const taxable = Math.max(0, grossIncome - taxConfig.standardDeduction - preTaxDeductions);
  
  let tax = 0;
  let prevLimit = 0;
  for (const bracket of taxConfig.brackets) {
    if (taxable > bracket.limit) {
      tax += (bracket.limit - prevLimit) * bracket.rate;
      prevLimit = bracket.limit;
    } else {
      tax += (taxable - prevLimit) * bracket.rate;
      break;
    }
  }
  return tax;
};


const calculateLoanPayoff = (debt, currentAge) => {
  const balance = Number(debt.balance) || 0;
  const apr = Number(debt.interestRate) || 0;
  const monthlyMin = debt.frequency === 'yearly' ? (Number(debt.payment) || 0) / 12 : (Number(debt.payment) || 0);
  const monthlyExtra = debt.frequency === 'yearly' ? (Number(debt.extraPayment) || 0) / 12 : (Number(debt.extraPayment) || 0);
  const startAge = Number(debt.startAge) || Number(currentAge) || 30;
  const paydownEnabled = !!debt.paydownPlanEnabled;
  const initAge = Number(currentAge) || 30;

  if (balance <= 0) {
    return { success: true, months: 0, years: 0, endAge: initAge, msg: 'Fully paid off!' };
  }

  const monthlyRate = (apr / 100) / 12;
  let currentBalance = balance;
  let months = 0;
  const maxMonths = 1200; // 100 years limit

  while (currentBalance > 0 && months < maxMonths) {
    months++;
    const currentAgeForMonth = initAge + (months - 1) / 12;
    const interest = currentBalance * monthlyRate;

    let payment = monthlyMin;
    if (paydownEnabled && currentAgeForMonth >= startAge) {
      payment += monthlyExtra;
    }

    if (payment <= interest) {
      return {
        success: false,
        msg: 'Payment too low. Interest exceeds payment; debt will grow indefinitely.'
      };
    }

    if (currentBalance + interest <= payment) {
      currentBalance = 0;
    } else {
      currentBalance = currentBalance + interest - payment;
    }
  }

  if (months >= maxMonths) {
    return {
      success: false,
      msg: 'Takes more than 100 years to pay off.'
    };
  }

  const years = months / 12;
  const endAge = initAge + years;

  return {
    success: true,
    months,
    years: parseFloat(years.toFixed(1)),
    endAge: parseFloat(endAge.toFixed(1))
  };
};

const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

const propPIAmount = (ev) => {
  const p = Number(ev.homePrice) || 0;
  const dp = Number(ev.downPayment) || 0;
  const rate = (Number(ev.mortgageRate) || 6.5) / 100;
  const mortgageTerm = Number(ev.loanTerm) || 30;
  const loanAmount = Math.max(0, p - dp);
  if (loanAmount <= 0 || mortgageTerm <= 0) return 0;
  const r = rate / 12;
  const n = mortgageTerm * 12;
  const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return monthlyPayment * 12;
};

const getOutcomeDetails = (outcome, runOutAge, readinessCriteria, retirementReadyAge, lifeExpectancy) => {
  switch (outcome) {
    case 'comfortable':
      return {
        label: 'Comfortable Retirement',
        badge: '🟢 Comfortable',
        color: 'var(--accent-emerald)',
        bg: 'rgba(16, 185, 129, 0.1)',
        desc: `Your projected assets remain positive through your life expectancy plus 10 years safety buffer (Age ${Number(lifeExpectancy || 85) + 10}).`
      };
    case 'sustainable':
      return {
        label: 'Sustainable Retirement',
        badge: '🟡 Sustainable',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.1)',
        desc: `Your projected assets remain positive through life expectancy (Age ${lifeExpectancy || 85}), but do not meet the 10-year safety buffer.`
      };
    case 'retirementGap':
      return {
        label: 'Retirement Gap',
        badge: '⚪ Retirement Gap',
        color: 'var(--text-secondary)',
        bg: 'rgba(148, 163, 184, 0.15)',
        desc: `Your projected assets are projected to run out at Age ${runOutAge} (before life expectancy). Additional savings, later retirement, or reduced spending may be needed.`
      };
    default:
      return {
        label: 'Sustainable Retirement',
        badge: '🟡 Sustainable',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.1)',
        desc: 'Your projected assets remain positive through life expectancy. Your portfolio gradually declines but is projected to last.'
      };
  }
};

const applyScenarioToInputs = (currentInputs, type, value) => {
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
        if (inc.id === 'simple-inc-childcare' || inc.id === 'simple-inc-prechild' || inc.id.startsWith('child-income-boost')) return inc;
        if (inc.id === 'simple-inc' || inc.id === 'simple-inc-worksave' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
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
        if (inc.id === 'simple-inc-childcare' || inc.id === 'simple-inc-prechild' || inc.id.startsWith('child-income-boost')) return inc;
        if (inc.id === 'simple-inc' || inc.id === 'simple-inc-worksave' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
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
        if (inc.id === 'simple-inc-childcare' || inc.id === 'simple-inc-prechild' || inc.id.startsWith('child-income-boost')) return inc;
        if (inc.id === 'simple-inc' || inc.id === 'simple-inc-worksave' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
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
        if (inc.id === 'simple-inc-childcare' || inc.id === 'simple-inc-prechild' || inc.id.startsWith('child-income-boost')) return inc;
        if (inc.id === 'simple-inc' || inc.id === 'simple-inc-worksave' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
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

const getPaceBadgeStyles = (savingsFocus) => {
  if (!savingsFocus) return {
    color: 'var(--text-secondary)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-color)'
  };
  const focusLower = savingsFocus.toLowerCase();
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

const calculatePeakChildCosts = (inp) => {
  const childEvents = (inp.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
  if (childEvents.length === 0) return 0;
  
  let minChildParentAge = Infinity;
  let maxChildParentAge = -Infinity;
  childEvents.forEach(ev => {
    const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
    const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
    const maxAge = includeCollege ? 22 : 18;
    if (birthAge < minChildParentAge) minChildParentAge = birthAge;
    if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
  });
  
  const currentAge = inp.currentAge !== undefined ? Number(inp.currentAge) : 30;
  const targetRetirementAge = inp.targetRetirementAge !== undefined ? Number(inp.targetRetirementAge) : 60;
  const hasChildcarePhase = minChildParentAge < maxChildParentAge && maxChildParentAge > currentAge;
  if (!hasChildcarePhase) return 0;
  
  let maxChildCostsAnnual = 0;
  for (let age = currentAge; age < targetRetirementAge; age++) {
    let yearCost = 0;
    childEvents.forEach(ev => {
      const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
      const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
      const childAge = age - birthAge;
      if (childAge >= childStartAge) {
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (childAge < maxAge) {
          const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inp.childCosts?.ages0to4 !== undefined ? Number(inp.childCosts.ages0to4) : 15000);
          const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inp.childCosts?.ages5to12 !== undefined ? Number(inp.childCosts.ages5to12) : 15000);
          const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inp.childCosts?.ages13to18 !== undefined ? Number(inp.childCosts.ages13to18) : 15000);
          const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inp.childCosts?.ages19to22 !== undefined ? Number(inp.childCosts.ages19to22) : 15000);

          let annualCost = 0;
          if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
          else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
          else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
          else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
          
          yearCost += annualCost;
        }
      }
    });
    if (yearCost > maxChildCostsAnnual) {
      maxChildCostsAnnual = yearCost;
    }
  }
  return maxChildCostsAnnual;
};

const getActiveChildrenCountAtAge = (age, lifeEvents) => {
  let count = 0;
  const childEvents = (lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
  childEvents.forEach(ev => {
    const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
    const startAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
    const childAge = age - birthAge;
    if (childAge >= startAge) {
      const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
      const maxAge = includeCollege ? 22 : 18;
      if (childAge < maxAge) {
        count++;
      }
    }
  });
  return count;
};

const getBaseCareerIncomeAtAge = (age, inputs) => {
  const cleanIncomeList = (inputs.incomeList || []).filter(inc => 
    inc.id !== 'inc-1' && 
    !inc.id.startsWith('simple-inc') &&
    !inc.id.startsWith('child-income-boost')
  );
  let totalAnnual = 0;
  cleanIncomeList.forEach(inc => {
    const sAge = Number(inc.startAge);
    const eAge = Number(inc.endAge);
    if (age >= sAge && age < eAge) {
      if (inc.frequency === 'monthly') {
        totalAnnual += Number(inc.amount) * 12;
      } else {
        totalAnnual += Number(inc.amount);
      }
    }
  });
  if (totalAnnual === 0) {
    return Number(inputs.budgetDetails?.income) || (Number(inputs.simpleIncome) / 12) || 4167;
  }
  return Math.round(totalAnnual / 12);
};

const getChildCountIntervals = (startAge, endAge, lifeEvents, incomeList = []) => {
  const intervals = [];
  if (startAge >= endAge) return intervals;
  
  const boundaries = new Set();
  boundaries.add(startAge);
  boundaries.add(endAge);
  
  // Child count boundaries
  for (let age = startAge + 1; age < endAge; age++) {
    const prevCount = getActiveChildrenCountAtAge(age - 1, lifeEvents);
    const count = getActiveChildrenCountAtAge(age, lifeEvents);
    if (count !== prevCount) {
      boundaries.add(age);
    }
  }
  
  // Custom career change boundaries
  const cleanIncomes = (incomeList || []).filter(inc => 
    inc.id !== 'inc-1' && 
    !inc.id.startsWith('simple-inc') &&
    !inc.id.startsWith('child-income-boost')
  );
  cleanIncomes.forEach(inc => {
    const sAge = Number(inc.startAge);
    if (sAge > startAge && sAge < endAge) {
      boundaries.add(sAge);
    }
  });
  
  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 1; i++) {
    const sAge = sorted[i];
    const eAge = sorted[i + 1];
    const count = getActiveChildrenCountAtAge(sAge, lifeEvents);
    intervals.push({ startAge: sAge, endAge: eAge, childCount: count });
  }
  return intervals;
};

const getChildCostsForInterval = (interval, inputs) => {
  if (!interval || interval.childCount === 0) return 0;
  
  let totalAnnualCost = 0;
  const refAge = interval.startAge;
  const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
  
  childEvents.forEach(ev => {
    const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
    const startAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
    const childAge = refAge - birthAge;
    
    if (childAge >= startAge) {
      const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
      const maxAge = includeCollege ? 22 : 18;
      if (childAge < maxAge) {
        const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
        const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
        const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
        const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

        let annualCost = 0;
        if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
        else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
        else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
        else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
        
        totalAnnualCost += annualCost;
      }
    }
  });
  
  return Math.round(totalAnnualCost / 12);
};

const syncChildcarePhasesAndRules = (newInputs) => {
  // Budget calculations and rules are now built dynamically from getNormalizedPhases
};

export default function FireSimulator() {
  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [currentScenarioId, setCurrentScenarioId] = useState('baseline');
  const [newEventSelectorType, setNewEventSelectorType] = useState('buyHouse');
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showAssets, setShowAssets] = useState(true);
  const [showDebt, setShowDebt] = useState(true);
  const [showNetWorth, setShowNetWorth] = useState(true);
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(false);
  const [isZeroSpendingConfirmed, setIsZeroSpendingConfirmed] = useState(false);
  const [isPartnerZeroSpendingConfirmed, setIsPartnerZeroSpendingConfirmed] = useState(false);

  // 2-Step Wizard Navigation states
  const [activeStep, setActiveStep] = useState(1);
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

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isBudgetOpenFromMarriageWizard, setIsBudgetOpenFromMarriageWizard] = useState(false);
  const [activeBudgetPhase, setActiveBudgetPhase] = useState('workSave'); // 'workSave' | 'childcare'
  const [editedPhases, setEditedPhases] = useState({});
  
  // Storage for standard work phase budget details
  const [workSaveIncome, setWorkSaveIncome] = useState(4167);
  const [workSaveSavings, setWorkSaveSavings] = useState({});
  const [workSavePartnerSavings, setWorkSavePartnerSavings] = useState({});
  const [workSaveExpenses, setWorkSaveExpenses] = useState({});
  const [workSaveAllocMode, setWorkSaveAllocMode] = useState('fixed');

  // Storage for childcare phase budget details
  const [childcareIncome, setChildcareIncome] = useState(4167);
  const [childcareSavings, setChildcareSavings] = useState({});
  const [childcareExpenses, setChildcareExpenses] = useState({});
  const [childcareAllocMode, setChildcareAllocMode] = useState('fixed');
  const [childcareBudgets, setChildcareBudgets] = useState({});
  const [applyToFutureBudgets, setApplyToFutureBudgets] = useState(true);

  const [budgetGrossIncome, setBudgetGrossIncome] = useState(50000);
  const [budgetFilingStatus, setBudgetFilingStatus] = useState('single');
  const [budgetHsaCoverage, setBudgetHsaCoverage] = useState('single');
  const [savingsAllocMode, setSavingsAllocMode] = useState('fixed'); // 'fixed' | 'percentSurplus'
  const [budgetSavings, setBudgetSavings] = useState({
    trad401k: 100,
    rothIra: 50,
    tradIra: 0,
    hsa: 50,
    brokerage: 0,
    checking: 50,
    hysa: 50,
    emergency: 26,
    debt: 0,
    other: 0
  });
  const [budgetPartnerSavings, setBudgetPartnerSavings] = useState({
    trad401k: 0,
    rothIra: 0,
    tradIra: 0,
    hsa: 0,
    brokerage: 0,
    cash: 0,
    debt: 0
  });
  const [budgetExpenses, setBudgetExpenses] = useState({
    housing: 1500,
    utilities: 300,
    food: 600,
    transportation: 400,
    healthcare: 300,
    leisure: 300,
    misc: 141
  });
  const [activeBudgetTab, setActiveBudgetTab] = useState('userSavings'); // 'userSavings' | 'partnerSavings' | 'householdExpenses'
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [editingEvent, setEditingEvent] = useState(null);
  const [childImpactSummary, setChildImpactSummary] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [budgetMonthlyIncome, setBudgetMonthlyIncome] = useState(4167);
  const [budgetMonthlySpending, setBudgetMonthlySpending] = useState(3542);
  const [budgetMonthlySavings, setBudgetMonthlySavings] = useState(625);
  const [expandedAdvancedDetail, setExpandedAdvancedDetail] = useState(false);
  const [expandedMethodology, setExpandedMethodology] = useState(false);
  const [draggingInfo, setDraggingInfo] = useState(null);
  const [notification, setNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);
  const showNotification = (message) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(message);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 2000);
  };
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [wasShortfall, setWasShortfall] = useState(false);
  const [pendingImprovement, setPendingImprovement] = useState(null);
  const [budgetDiffs, setBudgetDiffs] = useState(null);
  const [displayMode, setDisplayMode] = useState('future'); // 'future' | 'today'

  const handleCloseBudgetModal = () => {
    setIsBudgetModalOpen(false);
    setPendingImprovement(null);
    setBudgetDiffs(null);
    setIsBudgetOpenFromMarriageWizard(false);
  };
  const dragOccurredRef = useRef(false);
  const lastNonZeroSavingsRateRef = useRef(15); // default to 15% pre-tax savings rate

  // Scenarios state
  const [scenarios, setScenarios] = useState([
    {
      id: 'baseline',
      name: 'Baseline Plan',
      inputs: JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS))
    },
    {
      id: 'compare1',
      name: 'Retire Early (Age 50)',
      inputs: (() => {
        const cloned = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
        cloned.targetRetirementAge = 50;
        cloned.lifeEvents = cloned.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 50 } : e);
        return cloned;
      })()
    }
  ]);

  // Sidebar accordions expansion states
  const [expandedSections, setExpandedSections] = useState({
    assets: true,
    income: false,
    spending: false,
    allocation: false,
    events: false,
    assumptions: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleDuplicateScenario = () => {
    const newId = `compare-${Date.now()}`;
    const newScenario = {
      id: newId,
      name: `${activeScenario.name} (Copy)`,
      inputs: JSON.parse(JSON.stringify(activeScenario.inputs))
    };
    setScenarios(prev => [...prev, newScenario]);
    setCurrentScenarioId(newId);
  };

  const handleDeleteScenario = (idToDelete) => {
    if (scenarios.length <= 1) return;
    setScenarios(prev => prev.filter(s => s.id !== idToDelete));
    if (currentScenarioId === idToDelete) {
      const remaining = scenarios.filter(s => s.id !== idToDelete);
      setCurrentScenarioId(remaining[0]?.id || 'baseline');
    }
  };

  // Get active inputs
  const activeScenario = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
  const inputs = activeScenario.inputs;

  // Compute temporary Social Security details for real-time modal preview
  const tempSocialSecurityDetails = useMemo(() => {
    if (!editingEvent || editingEvent.type !== 'socialSecurity') return null;
    
    const claimAge = Number(editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : 67);
    const useEarnings = editingEvent.useEarnings === true;
    
    const incomeHistory = getIncomeHistory(inputs, editingEvent);
    const { workingYears, isEligible } = calculateTop35AverageIncome(incomeHistory);
    
    if (useEarnings) {
      return calculateSocialSecurityBenefit({
        incomeHistory,
        claimAge,
        fullRetirementAge: 67,
        firstBendPoint: 1286,
        secondBendPoint: 7749,
        indexingMode: "simple"
      });
    } else {
      const fixedAnnual = (Number(editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 2000) || 0) * 12;
      const claimingMultiplierDetails = calculateClaimingAgeMultiplier({ claimAge, fullRetirementAge: 67 });
      let annualBenefit = fixedAnnual * claimingMultiplierDetails.multiplier;
      let adjustmentType = claimingMultiplierDetails.adjustmentType;
      let adjustmentMultiplier = claimingMultiplierDetails.multiplier;
      
      if (!isEligible) {
        adjustmentType = 'Not eligible';
        adjustmentMultiplier = 0;
        annualBenefit = 0;
      }
      
      return {
        claimAge,
        workingYears,
        isEligible,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: fixedAnnual / 12,
        claimingAgeMultiplier: adjustmentMultiplier,
        monthlyBenefit: annualBenefit / 12,
        annualBenefit,
        adjustmentType
      };
    }
  }, [editingEvent, inputs]);

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

  // Sync state helpers
  const updateInput = (key, value) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            [key]: value
          }
        };
      }
      return scen;
    }));
  };

  const updateAsset = (assetKey, value) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            assets: {
              ...scen.inputs.assets,
              [assetKey]: value
            }
          }
        };
      }
      return scen;
    }));
  };

  // Synchronize Simple Mode inputs to Schedules in the background
  useEffect(() => {
    const inp = activeScenario.inputs;
    if (!inp.isAdvancedMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const simpleIncVal = Number(scen.inputs.simpleIncome) || 0;
          const simpleExpVal = Number(scen.inputs.simpleExpenses) || 0;
          const currentAgeVal = Number(scen.inputs.currentAge) || 30;
          const targetRetAgeVal = Number(scen.inputs.targetRetirementAge) || 65;
          const lifeExpVal = Number(scen.inputs.lifeExpectancy) || 85;
          const simpleInvestmentsVal = Number(scen.inputs.simpleInvestments) || 0;
          const simpleSavingsRateVal = simpleIncVal > 0 ? Math.round(((simpleIncVal - simpleExpVal) / simpleIncVal) * 100) : 15;

          const existingEvents = scen.inputs.lifeEvents || [];
          let hasRetire = false;
          const updatedEvents = existingEvents.map(ev => {
            if (ev.type === 'retire') {
              hasRetire = true;
              return {
                ...ev,
                age: targetRetAgeVal
              };
            }
            return ev;
          });
          if (!hasRetire && targetRetAgeVal < lifeExpVal) {
            updatedEvents.push({
              id: 'retire-1',
              type: 'retire',
              name: 'Retirement',
              enabled: true,
              age: targetRetAgeVal,
              spendingPercent: 70
            });
          }

          const baseInputsUpdate = {
            ...scen.inputs,
            lifeEvents: updatedEvents
          };

          if (scen.inputs.budgetDetails) {
            baseInputsUpdate.incomeList = (scen.inputs.incomeList || []).map(inc => {
              if (
                (inc.id === 'simple-inc' ||
                inc.id === 'inc-1' ||
                inc.name.toLowerCase().includes('salary') ||
                inc.name.toLowerCase().includes('main income')) &&
                !inc.id.startsWith('simple-inc-childcare') &&
                !inc.id.startsWith('simple-inc-worksave') &&
                !inc.id.startsWith('simple-inc-prechild')
              ) {
                return {
                  ...inc,
                  startAge: currentAgeVal,
                  endAge: targetRetAgeVal
                };
              }
              return inc;
            });
            baseInputsUpdate.spendingPhases = (scen.inputs.spendingPhases || []).map(phase => {
              if (
                (phase.id === 'simple-spend' ||
                phase.id === 'spend-1' ||
                phase.name.toLowerCase().includes('lifestyle') ||
                phase.name.toLowerCase().includes('spending')) &&
                !phase.id.startsWith('simple-spend-childcare') &&
                !phase.id.startsWith('simple-spend-worksave') &&
                !phase.id.startsWith('simple-spend-prechild')
              ) {
                return {
                  ...phase,
                  startAge: currentAgeVal,
                  endAge: lifeExpVal
                };
              }
              return phase;
            });
          } else {
            baseInputsUpdate.assets = {
              ...scen.inputs.assets,
              cash: 0,
              brokerage: simpleInvestmentsVal,
              emergencyFund: 0,
              trad401k: 0,
              tradIra: 0,
              rothIra: 0,
              hsa: 0,
              realEstate: 0,
              other: 0,
              debts: 0
            };
            baseInputsUpdate.debtList = [];
            baseInputsUpdate.incomeList = [
              {
                id: 'simple-inc',
                name: 'Salary / Main Income',
                amount: simpleIncVal,
                frequency: 'yearly',
                startAge: currentAgeVal,
                endAge: targetRetAgeVal,
                growthRate: 0.03,
                isTaxable: true
              }
            ];
            baseInputsUpdate.spendingPhases = [
              {
                id: 'simple-spend',
                name: 'Base Lifestyle Spending',
                startAge: currentAgeVal,
                endAge: lifeExpVal,
                amount: simpleExpVal,
                frequency: 'yearly',
                annualSpending: simpleExpVal,
                inflationOverride: null,
                notes: 'Simple Mode lifestyle cost'
              }
            ];
            baseInputsUpdate.allocationRules = [
              {
                id: 'simple-alloc-pretax',
                destination: 'trad401k',
                type: 'percentIncome',
                value: simpleSavingsRateVal,
                frequency: 'yearly',
                priority: 1,
                smartRule: {
                  enabled: false,
                  targetValue: 0,
                  redirectDestination: 'brokerage'
                }
              },
              {
                id: 'simple-alloc-surplus',
                destination: 'brokerage',
                type: 'percentSurplus',
                value: 100,
                frequency: 'yearly',
                priority: 2,
                smartRule: {
                  enabled: false,
                  targetValue: 0,
                  redirectDestination: 'brokerage'
                }
              }
            ];
          }

          return {
            ...scen,
            inputs: baseInputsUpdate
          };
        }
        return scen;
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeScenario.inputs.isAdvancedMode,
    activeScenario.inputs.simpleIncome,
    activeScenario.inputs.simpleExpenses,
    activeScenario.inputs.simpleInvestments,
    activeScenario.inputs.currentAge,
    activeScenario.inputs.targetRetirementAge,
    activeScenario.inputs.lifeExpectancy,
    currentScenarioId
  ]);

  // Run financial calculations
  const baselineResults = useMemo(() => {
    return runFireSimulation(scenarios.find(s => s.id === 'baseline')?.inputs || DEFAULT_FIRE_INPUTS);
  }, [scenarios]);

  const activeResults = useMemo(() => {
    const res = runFireSimulation(inputs);
    console.log('[FIRE Debug] RAW INPUTS:', inputs);
    const inf = (Number(inputs.inflationRate) || 3) / 100;
    const curAge = Number(inputs.currentAge) || 35;
    const logLines = [];
    res.data.forEach(d => {
      const factor = Math.pow(1 + inf, d.age - curAge);
      logLines.push(
        `Age ${d.age}: ` +
        `Income=${Math.round(d.income * factor)}, ` +
        `ChildCosts=${Math.round(d.childCosts * factor)}, ` +
        `Expenses=${Math.round(d.expenses * factor)}, ` +
        `Savings=${Math.round(d.savings * factor)}, ` +
        `Taxes=${Math.round(d.taxes * factor)}, ` +
        `Portfolio=${Math.round(d.portfolio * factor)}, ` +
        `NetWorth=${Math.round(d.netWorth * factor)}`
      );
    });
    console.log('[FIRE Debug] YEAR-BY-YEAR LOGS:\n' + logLines.join('\n'));
    return res;
  }, [inputs]);

  const displayedResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...activeResults,
      data: isNominal ? activeResults.nominalData : activeResults.deflatedData,
      retirementReadyTarget: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      portfolioAtRetirement: isNominal ? activeResults.nominalPortfolioAtRetirement : activeResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? activeResults.nominalNetWorthAtRetirement : activeResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? activeResults.nominalAnnualRetirementSpending : activeResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? activeResults.nominalEndingSurplusShortfall : activeResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? activeResults.nominalRetirementIncomeSources : activeResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget
    };
  }, [activeResults, displayMode]);

  const displayedBaselineResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...baselineResults,
      data: isNominal ? baselineResults.nominalData : baselineResults.deflatedData,
      retirementReadyTarget: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget,
      portfolioAtRetirement: isNominal ? baselineResults.nominalPortfolioAtRetirement : baselineResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? baselineResults.nominalNetWorthAtRetirement : baselineResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? baselineResults.nominalAnnualRetirementSpending : baselineResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? baselineResults.nominalEndingSurplusShortfall : baselineResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? baselineResults.nominalRetirementIncomeSources : baselineResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget
    };
  }, [baselineResults, displayMode]);

  // Validate inputs
  const validation = useMemo(() => {
    return validateFireInputs(inputs);
  }, [inputs]);

  // Suggestion engine for Retirement Improvement Plan
  // Suggestion engine for Retirement Improvement Plan
  const improvementPlan = useMemo(() => {
    const currentAge = Number(inputs.currentAge) || 30;
    const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
    const yearsUntilRetirement = Math.max(0, targetRetirementAge - currentAge);
    const rateOfReturn = (Number(inputs.expectedReturn) || 7) / 100;
    const swr = (Number(inputs.swr) || 4) / 100;
    const marginalTaxRate = inputs.includeTaxes ? 0.25 : 0.0;

    // Run a temporary simulation with the default childcare boost enabled
    // so recommendations are calculated against the post-boost baseline.
    const recInputs = JSON.parse(JSON.stringify(inputs));
    const normPhases = getNormalizedPhases(recInputs);
    if (!recInputs.budgetDetails) recInputs.budgetDetails = {};
    recInputs.budgetDetails.phases = normPhases.map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      startAge: p.startAge,
      endAge: p.endAge,
      income: p.income,
      savingsAllocMode: p.smartRule || p.savingsAllocMode || 'fixed',
      savings: p.savings,
      partnerSavings: p.partnerSavings,
      expenses: p.expenses
    }));
    const recResults = runFireSimulation(recInputs);

    const retirementExpenses = recResults.annualRetirementSpending || 40000;
    const shortfall = recResults.endingSurplusShortfall < 0 ? -recResults.endingSurplusShortfall : 0;

    // Determine childcare phase and peak monthly child cost
    const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
    let hasChildcarePhase = false;
    let maxChildCostsAnnual = 0;
    if (childEvents.length > 0) {
      let minChildParentAge = Infinity;
      let maxChildParentAge = -Infinity;
      childEvents.forEach(ev => {
        const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (birthAge < minChildParentAge) minChildParentAge = birthAge;
        if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
      });
      hasChildcarePhase = minChildParentAge < maxChildParentAge && maxChildParentAge > currentAge;

      if (hasChildcarePhase) {
        // Find the maximum child cost in today's dollars for any year from currentAge to targetRetirementAge
        for (let age = currentAge; age < targetRetirementAge; age++) {
          let yearCost = 0;
          childEvents.forEach(ev => {
            const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
            const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
            const childAge = age - birthAge;
            if (childAge >= childStartAge) {
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (childAge < maxAge) {
                const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
                const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
                const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
                const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

                let annualCost = 0;
                if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
                else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
                else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
                else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
                
                yearCost += annualCost;
              }
            }
          });
          if (yearCost > maxChildCostsAnnual) {
            maxChildCostsAnnual = yearCost;
          }
        }
      }
    }
    const maxChildCostsMonthly = Math.round(maxChildCostsAnnual / 12);

    let peakCount = 0;
    const currentAgeVal = Number(inputs.currentAge) || 30;
    const targetRetAgeVal = Number(inputs.targetRetirementAge) || 65;
    for (let age = currentAgeVal; age < targetRetAgeVal; age++) {
      const count = getActiveChildrenCountAtAge(age, inputs.lifeEvents);
      if (count > peakCount) {
        peakCount = count;
      }
    }
    const savingIntervals = getChildCountIntervals(currentAgeVal, targetRetAgeVal, inputs.lifeEvents, inputs.incomeList);
    const peakIntervalIdx = savingIntervals.findIndex(inv => inv.childCount === peakCount);
    let ccIncomeVal = (Number(inputs.simpleIncome) || 50000) / 12;
    if (inputs.budgetDetails) {
      if (inputs.budgetDetails.childcareBudgets && peakIntervalIdx !== -1 && inputs.budgetDetails.childcareBudgets[peakIntervalIdx]) {
        ccIncomeVal = Number(inputs.budgetDetails.childcareBudgets[peakIntervalIdx].income);
      } else if (inputs.budgetDetails.childcareIncome !== undefined) {
        ccIncomeVal = Number(inputs.budgetDetails.childcareIncome);
      }
    }
    const wsIncomeVal = inputs.budgetDetails && inputs.budgetDetails.income !== undefined
      ? Number(inputs.budgetDetails.income)
      : (Number(inputs.simpleIncome) || 50000) / 12;
    const currentChildcareIncomeBoostMonthly = Math.max(0, ccIncomeVal - wsIncomeVal);

    const unfundedMaxChildCostsMonthly = Math.max(0, maxChildCostsMonthly - currentChildcareIncomeBoostMonthly);

    const currentReadyAge = recResults.retirementReadyAge;
    const hasShortfall = recResults.endingSurplusShortfall < 0 || 
                         !recResults.moneyLasts ||
                         (recResults.retirementReadyAge && inputs.targetRetirementAge < recResults.retirementReadyAge) ||
                         (hasChildcarePhase && unfundedMaxChildCostsMonthly > 0);

    if (!hasShortfall) return null;

    // Calculate sum of current liquid assets
    const currentAssets = (Number(inputs.assets?.cash) || 0) +
                          (Number(inputs.assets?.emergencyFund) || 0) +
                          (Number(inputs.assets?.brokerage) || 0) +
                          (Number(inputs.assets?.trad401k) || 0) +
                          (Number(inputs.assets?.tradIra) || 0) +
                          (Number(inputs.assets?.rothIra) || 0) +
                          (Number(inputs.assets?.hsa) || 0) +
                          (Number(inputs.assets?.other) || 0);

    const annualSavings = (Number(inputs.simpleIncome) || 0) - (Number(inputs.simpleExpenses) || 0);
    const standardMonthlySavings = Math.round(annualSavings / 12);
    const childcarePeakGrossBoost = Math.round(unfundedMaxChildCostsMonthly / (1 - marginalTaxRate));
    const childcarePeakGrossBoostZeroSavings = Math.round(Math.max(0, unfundedMaxChildCostsMonthly - standardMonthlySavings) / (1 - marginalTaxRate));

    const list = [];

    // 1. Retire at Age 65 (and changes needed to do that)
    if (currentAge >= 65) {
      list.push({
        type: 'retire65',
        icon: '📅',
        title: 'Retire at Age 65',
        details: 'You are already age 65 or older.',
        bulletPoints: [
          'This option is not applicable because your current age is 65 or older.'
        ],
        readyAge: currentAge,
        yearsImprovement: null,
        value: 0,
        savingsFocus: 'Retire at 65',
        savingsEffortScore: 1
      });
    } else {
      const yearsTo65 = 65 - currentAge;
      let projectedAssetsAt65 = currentAssets * Math.pow(1 + rateOfReturn, yearsTo65);
      if (rateOfReturn > 0) {
        const fvFactor = (Math.pow(1 + rateOfReturn, yearsTo65) - 1) / rateOfReturn;
        projectedAssetsAt65 += annualSavings * fvFactor;
      } else {
        projectedAssetsAt65 += annualSavings * yearsTo65;
      }

      const targetAssetsAt65 = swr > 0 ? retirementExpenses / swr : 0;
      const newShortfall = Math.max(0, targetAssetsAt65 - projectedAssetsAt65);
      const saveMoreAmtAt65 = calculateSaveMoreRecommendation(
        newShortfall,
        rateOfReturn,
        yearsTo65,
        1.0
      );
      const hasShortfallAt65 = newShortfall > 0;

      list.push({
        type: 'retire65',
        icon: '📅',
        title: 'Retire at Age 65',
        details: hasShortfallAt65
          ? 'Delay your retirement to Age 65 and adjust your budget to save more to bridge the remaining shortfall.'
          : 'Delay your retirement to Age 65. Under your current plan, your assets are projected to fully support you at age 65 with no additional savings needed.',
        bulletPoints: [
          `Working until 65 adds ${65 - targetRetirementAge} more working/saving years to your plan.`,
          ...(hasShortfallAt65
            ? [
                `Save and invest an additional ${formatCurrency(saveMoreAmtAt65)}/year (approx. ${formatCurrency(Math.round(saveMoreAmtAt65 / 12))}/month) starting now.`,
                `This will compound over your remaining ${65 - currentAge} working years to bridge the remaining ${formatCurrency(newShortfall)} shortfall at age 65.`
              ]
            : [
                'This completely resolves your projected retirement shortfall with no other changes needed!'
              ])
        ],
        readyAge: 65,
        yearsImprovement: currentReadyAge ? Math.max(0, currentReadyAge - 65) : null,
        value: saveMoreAmtAt65,
        savingsFocus: 'Retire at 65',
        savingsEffortScore: 1
      });
    }

    // 2. Retire at the retirement ready age
    if (currentReadyAge) {
      list.push({
        type: 'retireReadyAge',
        icon: '⏳',
        title: 'Retire at Retirement Ready Age',
        details: `Delay your retirement to Age ${currentReadyAge} (your Retirement Ready Age) so that your current saving and spending rates are sufficient to support you without any additional changes.`,
        bulletPoints: [
          `Working until Age ${currentReadyAge} allows your assets to compound for ${currentReadyAge - targetRetirementAge} more years.`,
          'No additional savings or income changes are required under your current budget.',
          'This completely resolves your projected retirement gap.'
        ],
        readyAge: currentReadyAge,
        yearsImprovement: null,
        value: currentReadyAge,
        savingsFocus: 'Retire Ready',
        savingsEffortScore: 2
      });
    }

    // 3. Retire at the requested retirement date
    const saveMoreAmt100 = calculateSaveMoreRecommendation(
      shortfall,
      rateOfReturn,
      yearsUntilRetirement,
      1.0
    );

    list.push({
      type: 'retireRequestedDate',
      icon: '🎯',
      title: 'Retire at Requested Retirement Date',
      details: `Maintain your target retirement age of Age ${targetRetirementAge} and adjust your budget to save more to bridge the shortfall.`,
      bulletPoints: [
        `Save and invest an additional ${formatCurrency(saveMoreAmt100)}/year (approx. ${formatCurrency(Math.round(saveMoreAmt100 / 12))}/month) before retirement.`,
        `This will compound over your remaining ${yearsUntilRetirement} working years at an assumed ${(rateOfReturn * 100).toFixed(0)}% annual rate of return.`,
        `This completely bridges your projected retirement gap at Age ${targetRetirementAge}.`
      ],
      readyAge: targetRetirementAge,
      yearsImprovement: currentReadyAge ? Math.max(0, currentReadyAge - targetRetirementAge) : null,
      value: saveMoreAmt100,
      savingsFocus: 'Save More',
      savingsEffortScore: 3
    });

    // 4. Temporary Childcare Offset Recommendation
    const childRecommendations = getChildCostOffsetRecommendations(inputs);
    childRecommendations.forEach(rec => {
      const clonedInputs = JSON.parse(JSON.stringify(inputs));
      clonedInputs.incomeList = [...(clonedInputs.incomeList || []), ...rec.incomeBoosts];
      
      const boostResults = runFireSimulation(clonedInputs);
      const readyAge = boostResults.retirementReadyAge;
      
      const currentReadyAge = recResults.retirementReadyAge;
      const yearsImprovement = currentReadyAge ? Math.max(0, currentReadyAge - (readyAge || currentReadyAge)) : null;
      
      list.push({
        type: `childOffset-${rec.childEventId}`,
        icon: '👶',
        title: 'Offset child costs with temporary income',
        details: `Your plan includes about ${formatCurrency(rec.peakCost)}/year in child-related costs for ${rec.duration} years. One way to keep your retirement plan on track is to earn an extra ${formatCurrency(rec.peakCost)}/year during those years.`,
        bulletPoints: [
          `Earn an extra ${formatCurrency(rec.peakCost)}/year from parent age ${rec.parentStartAge} to ${rec.parentEndAge}.`,
          `This temporary income boost is designed to align precisely with your child-rearing years.`,
          `This recommendation improves or preserves your retirement readiness without requiring a permanent budget cut.`
        ],
        readyAge: readyAge || targetRetirementAge,
        yearsImprovement: yearsImprovement,
        value: rec.peakCost,
        incomeBoosts: rec.incomeBoosts,
        savingsFocus: 'Earn More',
        savingsEffortScore: 2
      });
    });

    return {
      showImprovementPlan: true,
      rankedPlan: list,
      currentReadyAge
    };
  }, [inputs, activeResults, activeStep]);

  // Reset wasShortfall when switching scenarios or active step
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWasShortfall(false);
  }, [currentScenarioId, activeStep]);

  // Auto-pop the improvement plan modal when a plan becomes available or transitions to shortfall
  useEffect(() => {
    const hasShortfall = activeStep === 2 && (
      !activeResults.moneyLasts || 
      activeResults.runOutAge !== null || 
      (activeResults.retirementReadyAge && inputs.targetRetirementAge < activeResults.retirementReadyAge)
    );
    const hasImprovementPlan = !!(improvementPlan && improvementPlan.rankedPlan && improvementPlan.rankedPlan.length > 0);
    if (hasShortfall && hasImprovementPlan && !wasShortfall && !childImpactSummary && !draggingInfo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowImprovementModal(true);
    }
    setWasShortfall(hasShortfall);
  }, [activeResults.moneyLasts, activeResults.runOutAge, activeResults.retirementReadyAge, inputs.targetRetirementAge, activeStep, wasShortfall, childImpactSummary, draggingInfo, improvementPlan]);

  const handleApplyImprovementScenario = (scenario) => {
    const scen = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
    let inp = scen.inputs;
    if (scenario.type.startsWith('childOffset')) {
      inp = JSON.parse(JSON.stringify(scen.inputs));
      inp.incomeList = [...(inp.incomeList || []), ...(scenario.incomeBoosts || [])];
    }
    const currentAgeVal = Number(inp.currentAge) || 30;
    const targetRetAgeVal = Number(inp.targetRetirementAge) || 65;

    let targetIncome = Number(inp.simpleIncome) || 50000;
    const targetFilingStatus = inp.filingStatus || 'single';
    const targetHsaCoverage = inp.budgetDetails?.hsaCoverage || 'single';

    let targetExpensesMap = {};
    let targetSavingsMap = {};

    const currentIncome = Number(inp.simpleIncome) || 0;
    const currentExpenses = Number(inp.simpleExpenses) || 0;
    const simMonthlyExpenses = currentExpenses / 12;
    const simMonthlySavings = Math.max(0, currentIncome - currentExpenses) / 12;

    const monthlyGross = Math.round(currentIncome / 12);

    if (inp.budgetDetails) {
      targetSavingsMap = { ...inp.budgetDetails.savings };
      targetExpensesMap = { ...inp.budgetDetails.expenses };

      const totalSavingsInModal = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);

      // Scale savings map to align with simulation totals first
      if (totalSavingsInModal > 0 && Math.abs(totalSavingsInModal - simMonthlySavings) > 1) {
        const savingsScale = simMonthlySavings / totalSavingsInModal;
        Object.keys(targetSavingsMap).forEach(key => {
          targetSavingsMap[key] = Math.round(targetSavingsMap[key] * savingsScale);
        });
      } else if (totalSavingsInModal === 0 && simMonthlySavings > 0) {
        targetSavingsMap.brokerage = Math.round(simMonthlySavings);
      }

      // Adjust savings rounding error
      const scaledSavingsSum = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const targetSavingsTotal = Math.round(simMonthlySavings);
      const savingsDiff = targetSavingsTotal - scaledSavingsSum;
      if (savingsDiff !== 0) {
        let maxKey = 'brokerage';
        if (targetSavingsMap[maxKey] === undefined) {
          maxKey = Object.keys(targetSavingsMap)[0];
        }
        Object.keys(targetSavingsMap).forEach(key => {
          if ((targetSavingsMap[key] || 0) > (targetSavingsMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        targetSavingsMap[maxKey] = Math.max(0, (targetSavingsMap[maxKey] || 0) + savingsDiff);
      }

      // Calculate taxes to find available net income for expenses
      const capped401k = Math.min(23500, (targetSavingsMap.trad401k || 0) * 12);
      const cappedTradIra = Math.min(7000, (targetSavingsMap.tradIra || 0) * 12);
      const cappedHsa = Math.min(targetHsaCoverage === 'family' ? 8300 : 4150, (targetSavingsMap.hsa || 0) * 12);
      const preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;
      const annualTax = inp.includeTaxes
        ? calculateUSTaxForModal(currentIncome, preTaxDeductionsAnnual, targetFilingStatus)
        : 0;
      const monthlyTax = Math.round(annualTax / 12);

      const actualSavingsMonthly = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const availableMonthlyExpenses = Math.max(0, monthlyGross - actualSavingsMonthly - monthlyTax);
      const totalExpensesInModal = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);

      // Scale expenses map to align with simulation net income first
      if (totalExpensesInModal > 0 && Math.abs(totalExpensesInModal - availableMonthlyExpenses) > 1) {
        const expensesScale = availableMonthlyExpenses / totalExpensesInModal;
        Object.keys(targetExpensesMap).forEach(key => {
          targetExpensesMap[key] = Math.round(targetExpensesMap[key] * expensesScale);
        });
      } else if (totalExpensesInModal === 0 && availableMonthlyExpenses > 0) {
        targetExpensesMap = {
          housing: Math.round(availableMonthlyExpenses * 0.40),
          utilities: Math.round(availableMonthlyExpenses * 0.10),
          food: Math.round(availableMonthlyExpenses * 0.15),
          transportation: Math.round(availableMonthlyExpenses * 0.10),
          healthcare: Math.round(availableMonthlyExpenses * 0.10),
          leisure: Math.round(availableMonthlyExpenses * 0.10),
          misc: Math.round(availableMonthlyExpenses * 0.05)
        };
      }

      // Adjust expenses rounding error
      const scaledExpensesSum = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);
      const expenseDiff = availableMonthlyExpenses - scaledExpensesSum;
      if (expenseDiff !== 0 && Object.keys(targetExpensesMap).length > 0) {
        let maxKey = Object.keys(targetExpensesMap)[0];
        Object.keys(targetExpensesMap).forEach(key => {
          if (targetExpensesMap[key] > targetExpensesMap[maxKey]) {
            maxKey = key;
          }
        });
        targetExpensesMap[maxKey] = Math.max(0, targetExpensesMap[maxKey] + expenseDiff);
      }
    } else {
      const defaultSavings = {
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
        checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      };
      if (inp.allocationRules && inp.allocationRules.length > 0) {
        inp.allocationRules.forEach(r => {
          const key = r.destination === 'cash' ? 'checking' :
                      r.destination === 'other' ? 'hysa' :
                      r.destination === 'emergencyFund' ? 'emergency' :
                      r.destination === 'debtPaydown' ? 'debt' : r.destination;
          if (defaultSavings[key] !== undefined) {
            if (r.type === 'fixed') {
              defaultSavings[key] = r.frequency === 'monthly' ? r.value : Math.round(r.value / 12);
            } else {
              const pool = Math.max(0, (Number(inp.simpleIncome) - Number(inp.simpleExpenses)) / 12);
              defaultSavings[key] = Math.round(pool * (r.value / 100));
            }
          }
        });
      } else {
        defaultSavings.brokerage = Math.round(simMonthlySavings);
      }
      targetSavingsMap = defaultSavings;

      // Adjust savings rounding error
      const scaledSavingsSum = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const targetSavingsTotal = Math.round(simMonthlySavings);
      const savingsDiff = targetSavingsTotal - scaledSavingsSum;
      if (savingsDiff !== 0) {
        let maxKey = 'brokerage';
        if (targetSavingsMap[maxKey] === undefined) {
          maxKey = Object.keys(targetSavingsMap)[0];
        }
        Object.keys(targetSavingsMap).forEach(key => {
          if ((targetSavingsMap[key] || 0) > (targetSavingsMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        targetSavingsMap[maxKey] = Math.max(0, (targetSavingsMap[maxKey] || 0) + savingsDiff);
      }

      const capped401k = Math.min(23500, (targetSavingsMap.trad401k || 0) * 12);
      const cappedTradIra = Math.min(7000, (targetSavingsMap.tradIra || 0) * 12);
      const cappedHsa = Math.min(targetHsaCoverage === 'family' ? 8300 : 4150, (targetSavingsMap.hsa || 0) * 12);
      const preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;
      const annualTax = inp.includeTaxes
        ? calculateUSTaxForModal(currentIncome, preTaxDeductionsAnnual, targetFilingStatus)
        : 0;
      const monthlyTax = Math.round(annualTax / 12);

      const actualSavingsMonthly = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const availableMonthlyExpenses = Math.max(0, monthlyGross - actualSavingsMonthly - monthlyTax);

      targetExpensesMap = {
        housing: Math.round(availableMonthlyExpenses * 0.40),
        utilities: Math.round(availableMonthlyExpenses * 0.10),
        food: Math.round(availableMonthlyExpenses * 0.15),
        transportation: Math.round(availableMonthlyExpenses * 0.10),
        healthcare: Math.round(availableMonthlyExpenses * 0.10),
        leisure: Math.round(availableMonthlyExpenses * 0.10),
        misc: Math.round(availableMonthlyExpenses * 0.05)
      };

      // Adjust targetExpensesMap rounding error
      const scaledExpensesSum = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);
      const expenseDiff = availableMonthlyExpenses - scaledExpensesSum;
      if (expenseDiff !== 0) {
        targetExpensesMap.housing = Math.max(0, targetExpensesMap.housing + expenseDiff);
      }
    }
    // Calculate baseline savings rate
    const currentSavingsRate = currentIncome > 0 ? Math.round((1 - currentExpenses / currentIncome) * 100) : 0;

    // Save baseline scaled maps to compute clean visual differences
    const baselineSavingsMap = { ...targetSavingsMap };
    const baselineExpensesMap = { ...targetExpensesMap };

    // Adjust target values based on our new recommendation types
    if (scenario.type === 'savings' || scenario.type === 'retireRequestedDate' || (scenario.type === 'retire65' && scenario.value > 0)) {
      // Save More: increase monthly savings by scenario.value / 12
      const additionalSavingsAnnual = scenario.value;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      
      // Reduce monthly expenses by the same amount to keep it balanced
      if (targetExpensesMap && Object.keys(targetExpensesMap).length > 0) {
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      }
    } else if (scenario.type === 'income') {
      // Earn More: increase gross income by gross salary increase
      const grossIncreaseAnnual = scenario.value;
      const netSavingsAnnual = scenario.netSavingsValue || 0;
      
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    } else if (scenario.type === 'combined') {
      // Balanced Plan (50/50): Apply BOTH 50% savings reduction and 50% earnings increase
      const additionalSavingsAnnual = scenario.value.savings;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      
      // Reduce monthly expenses by the savings portion
      if (targetExpensesMap && Object.keys(targetExpensesMap).length > 0) {
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      }

      // Apply the income increase portion
      const grossIncreaseAnnual = scenario.value.income;
      const netSavingsAnnual = scenario.value.netSavings || 0;
      
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    } else if (scenario.type === 'retire65') {
      // Retire at 65 with no changes needed (scenario.value === 0) doesn't change current income/expenses
    } else if (scenario.type === 'retireReadyAge') {
      // Retire at ready age doesn't change current income/expenses
    } else if (scenario.type.startsWith('childOffset')) {
      // Offset child costs with temporary income doesn't change current base income/expenses/savings
    }

    // Calculate differences for glow effect
    const diffs = { savings: {}, expenses: {} };

    Object.keys(targetSavingsMap).forEach(key => {
      const oldVal = baselineSavingsMap[key] || 0;
      const newVal = targetSavingsMap[key] || 0;
      if (newVal !== oldVal) {
        diffs.savings[key] = newVal - oldVal;
      }
    });

    Object.keys(targetExpensesMap).forEach(key => {
      const oldVal = baselineExpensesMap[key] || 0;
      const newVal = targetExpensesMap[key] || 0;
      if (newVal !== oldVal) {
        diffs.expenses[key] = newVal - oldVal;
      }
    });

    setBudgetDiffs(diffs);

    setBudgetGrossIncome(targetIncome);
    setBudgetFilingStatus(targetFilingStatus);
    setBudgetHsaCoverage(targetHsaCoverage);
    setBudgetSavings(targetSavingsMap);
    setBudgetExpenses(targetExpensesMap);

    // Initialize phase states to prevent unallocated toggles
    const appliedWsIncome = Math.round(targetIncome / 12);
    setWorkSaveIncome(appliedWsIncome);
    setWorkSaveSavings(targetSavingsMap);
    setWorkSaveExpenses(targetExpensesMap);
    setWorkSaveAllocMode(inp.budgetDetails?.savingsAllocMode || 'fixed');

    // Calculate childcare costs
    let currentChildCostsAnnual = 0;
    const currentAgeForApplied = Number(inp.currentAge) || 30;
    const childEventsForApplied = (inp.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
    childEventsForApplied.forEach(ev => {
      const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
      const startAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
      const childAge = currentAgeForApplied - birthAge;
      if (childAge >= startAge) {
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (childAge < maxAge) {
          const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inp.childCosts?.ages0to4 !== undefined ? Number(inp.childCosts.ages0to4) : 15000);
          const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inp.childCosts?.ages5to12 !== undefined ? Number(inp.childCosts.ages5to12) : 15000);
          const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inp.childCosts?.ages13to18 !== undefined ? Number(inp.childCosts.ages13to18) : 15000);
          const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inp.childCosts?.ages19to22 !== undefined ? Number(inp.childCosts.ages19to22) : 15000);

          let annualCost = 0;
          if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
          else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
          else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
          else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
          
          currentChildCostsAnnual += annualCost;
        }
      }
    });
    const currentChildCostsMonthlyForApplied = Math.round(currentChildCostsAnnual / 12);

    // Calculate peak childcare costs to determine recommended income boost
    let maxChildCostsAnnualForApplied = 0;
    if (childEventsForApplied.length > 0) {
      let minChildParentAge = Infinity;
      let maxChildParentAge = -Infinity;
      childEventsForApplied.forEach(ev => {
        const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (birthAge < minChildParentAge) minChildParentAge = birthAge;
        if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
      });
      const hasChildcarePhaseForApplied = minChildParentAge < maxChildParentAge && maxChildParentAge > currentAgeForApplied;

      if (hasChildcarePhaseForApplied) {
        for (let age = currentAgeForApplied; age < (Number(inp.targetRetirementAge) || 65); age++) {
          let yearCost = 0;
          childEventsForApplied.forEach(ev => {
            const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
            const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
            const childAge = age - birthAge;
            if (childAge >= childStartAge) {
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (childAge < maxAge) {
                const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inp.childCosts?.ages0to4 !== undefined ? Number(inp.childCosts.ages0to4) : 15000);
                const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inp.childCosts?.ages5to12 !== undefined ? Number(inp.childCosts.ages5to12) : 15000);
                const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inp.childCosts?.ages13to18 !== undefined ? Number(inp.childCosts.ages13to18) : 15000);
                const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inp.childCosts?.ages19to22 !== undefined ? Number(inp.childCosts.ages19to22) : 15000);

                let annualCost = 0;
                if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
                else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
                else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
                else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
                yearCost += annualCost;
              }
            }
          });
          if (yearCost > maxChildCostsAnnualForApplied) {
            maxChildCostsAnnualForApplied = yearCost;
          }
        }
      }
    }
    const maxChildCostsMonthlyForApplied = Math.round(maxChildCostsAnnualForApplied / 12);
    const marginalTaxRateForApplied = inp.includeTaxes ? 0.25 : 0.0;
    const childcarePeakGrossBoostForApplied = Math.round(maxChildCostsMonthlyForApplied / (1 - marginalTaxRateForApplied));

    const normalizedPhases = getNormalizedPhases(inp);
    const initialEdited = {};
    normalizedPhases.forEach(p => {
      initialEdited[p.id] = { ...p };
    });

    const currentPhase = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normalizedPhases[0];
    if (currentPhase) {
      let childBoostForCurrent = 0;
      (inp.incomeList || []).forEach(inc => {
        if (inc.id && typeof inc.id === 'string' && inc.id.startsWith('child-income-boost')) {
          if (currentPhase.startAge >= inc.startAge && currentPhase.startAge < inc.endAge) {
            const boostYearly = inc.frequency === 'monthly' ? Number(inc.amount) * 12 : Number(inc.amount);
            childBoostForCurrent += boostYearly / 12;
          }
        }
      });
      const baseSalaryMonthly = (currentPhase.startAge >= targetRetAgeVal) ? 0 : Math.round(targetIncome / 12);
      initialEdited[currentPhase.id] = {
        ...currentPhase,
        income: baseSalaryMonthly + childBoostForCurrent,
        savings: targetSavingsMap,
        expenses: targetExpensesMap,
        savingsAllocMode: inp.budgetDetails?.savingsAllocMode || 'fixed'
      };
    }
    setEditedPhases(initialEdited);

    let startPhaseId = currentPhase ? currentPhase.id : (normalizedPhases[0]?.id || null);
    setActiveBudgetPhase(startPhaseId);

    if (startPhaseId) {
      const startPhase = initialEdited[startPhaseId];
      setBudgetMonthlyIncome(startPhase.income);
      setBudgetSavings(startPhase.savings);
      setBudgetPartnerSavings(startPhase.partnerSavings || {});
      setBudgetExpenses(startPhase.expenses);
      setSavingsAllocMode(startPhase.savingsAllocMode);
      setBudgetMonthlySpending(Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0));
      
      const totalSavings = startPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, startPhase.income - Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setPendingImprovement({
      scenario,
      originalInputs: inp
    });

    setShowImprovementModal(false);
    setIsBudgetModalOpen(true);
  };

  // Income Phases handlers
  const addIncomeItem = () => {
    const newItem = {
      id: `inc-${Date.now()}`,
      name: 'Side Hustle',
      amount: 15000,
      frequency: 'yearly',
      startAge: inputs.currentAge,
      endAge: inputs.targetRetirementAge,
      growthRate: 0.03,
      isTaxable: true
    };
    updateInput('incomeList', [...inputs.incomeList, newItem]);
  };

  const removeIncomeItem = (id) => {
    updateInput('incomeList', inputs.incomeList.filter(item => item.id !== id));
  };

  const updateIncomeItemField = (id, field, value) => {
    updateInput('incomeList', inputs.incomeList.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Spending Phases handlers
  const addSpendingPhase = () => {
    const newItem = {
      id: `spend-${Date.now()}`,
      name: 'Lifestyle Phase',
      startAge: inputs.targetRetirementAge,
      endAge: inputs.lifeExpectancy,
      amount: 45000,
      frequency: 'yearly',
      annualSpending: 45000,
      inflationOverride: null,
      notes: ''
    };
    updateInput('spendingPhases', [...inputs.spendingPhases, newItem]);
  };

  const removeSpendingPhase = (id) => {
    updateInput('spendingPhases', inputs.spendingPhases.filter(item => item.id !== id));
  };

  const updateSpendingPhaseField = (id, field, value) => {
    updateInput('spendingPhases', inputs.spendingPhases.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        const amt = Number(updated.amount !== undefined ? updated.amount : updated.annualSpending) || 0;
        updated.annualSpending = (updated.frequency || 'yearly') === 'monthly' ? amt * 12 : amt;
        return updated;
      }
      return item;
    }));
  };

  // Allocation Rules handlers
  const addAllocationRule = () => {
    const newItem = {
      id: `alloc-${Date.now()}`,
      destination: 'brokerage',
      type: 'fixed',
      value: 500,
      frequency: 'monthly',
      priority: inputs.allocationRules.length + 1,
      smartRule: {
        enabled: false,
        targetValue: 20000,
        redirectDestination: 'brokerage'
      }
    };
    updateInput('allocationRules', [...inputs.allocationRules, newItem]);
  };

  const removeAllocationRule = (id) => {
    const remaining = inputs.allocationRules.filter(item => item.id !== id);
    updateInput('allocationRules', remaining.map((r, idx) => ({ ...r, priority: idx + 1 })));
  };

  const moveAllocationRule = (index, direction) => {
    const rules = [...inputs.allocationRules];
    if (direction === 'up' && index > 0) {
      const temp = rules[index];
      rules[index] = rules[index - 1];
      rules[index - 1] = temp;
    } else if (direction === 'down' && index < rules.length - 1) {
      const temp = rules[index];
      rules[index] = rules[index + 1];
      rules[index + 1] = temp;
    }
    updateInput('allocationRules', rules.map((r, idx) => ({ ...r, priority: idx + 1 })));
  };

  const updateAllocationRuleField = (id, field, value) => {
    updateInput('allocationRules', inputs.allocationRules.map(item => {
      if (item.id === id) {
        if (field.startsWith('smartRule.')) {
          const smartKey = field.split('.')[1];
          return {
            ...item,
            smartRule: {
              ...item.smartRule,
              [smartKey]: value
            }
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Debts and Loans handlers
  const addDebtItem = () => {
    const newItem = {
      id: `debt-${Date.now()}`,
      name: 'New Loan Account',
      balance: 15000,
      interestRate: 6.5,
      payment: 300,
      frequency: 'monthly',
      extraPayment: 0,
      paydownPlanEnabled: false,
      startAge: inputs.currentAge || 30
    };
    updateInput('debtList', [...inputs.debtList, newItem]);
  };

  const removeDebtItem = (id) => {
    updateInput('debtList', inputs.debtList.filter(item => item.id !== id));
  };

  const updateDebtItemField = (id, field, value) => {
    updateInput('debtList', inputs.debtList.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Life Events & Asset Transfers handlers
  const addLifeEvent = () => {
    const type = newEventSelectorType;
    let newEvent = {
      id: `${type}-${Date.now()}`,
      type,
      enabled: true
    };

    if (type === 'buyHouse') {
      newEvent = {
        ...newEvent,
        name: 'Buy a House',
        purchaseType: 'mortgage',
        purchaseAge: 35,
        homePrice: 400000,
        downPayment: 80000,
        mortgageRate: 6.5,
        loanTerm: 30,
        propertyTax: 1.2,
        insurance: 0.5,
        maintenance: 1.0,
        appreciationRate: 3.0
      };
    } else if (type === 'haveChild') {
      newEvent = {
        ...newEvent,
        name: 'Have a Child',
        birthAge: 32,
        oneTimeBirthCost: 10000,
        annualChildcareCost: 12000,
        annualChildExpense: 6000,
        childcareEndAge: 5,
        supportEndAge: 18
      };
    } else if (type === 'college') {
      newEvent = {
        ...newEvent,
        name: 'Go to College',
        startAge: 18,
        tuitionCost: 25000,
        duration: 4
      };
    } else if (type === 'sabbatical') {
      newEvent = {
        ...newEvent,
        name: 'Sabbatical / Break',
        startAge: 40,
        endAge: 41,
        incomeReduction: 100,
        expenseChange: 5000
      };
    } else if (type === 'socialSecurity') {
      newEvent = {
        ...newEvent,
        name: 'Social Security',
        claimingAge: 67,
        monthlyBenefit: 2000,
        inflationAdjusted: true
      };
    } else if (type === 'windfall') {
      newEvent = {
        ...newEvent,
        name: 'Windfall / Inheritance',
        ageReceived: 50,
        amount: 100000,
        taxRate: 15
      };
    } else if (type === 'assetTransfer') {
      newEvent = {
        ...newEvent,
        name: 'Asset Transfer',
        transferAge: 35,
        amount: 25000,
        fromAsset: 'cash',
        toAsset: 'brokerage'
      };
    }

    updateInput('lifeEvents', [...inputs.lifeEvents, newEvent]);
  };

  const removeLifeEvent = (id) => {
    updateInput('lifeEvents', inputs.lifeEvents.filter(ev => ev.id !== id));
  };

  const updateLifeEventField = (id, field, value) => {
    updateInput('lifeEvents', inputs.lifeEvents.map(ev => {
      if (ev.id === id) {
        return { ...ev, [field]: value };
      }
      return ev;
    }));
  };

  const handleStep1Change = (field, val) => {
    const scaleBudgetMap = (map, scale, targetTotal, defaultKeyForSurplus = 'brokerage') => {
      if (!map || Object.keys(map).length === 0) return {};
      const newMap = {};
      Object.keys(map).forEach(key => {
        newMap[key] = Math.round((map[key] || 0) * scale);
      });
      const sum = Object.values(newMap).reduce((acc, v) => acc + v, 0);
      const diff = targetTotal - sum;
      if (diff !== 0) {
        let maxKey = defaultKeyForSurplus;
        if (newMap[maxKey] === undefined) {
          maxKey = Object.keys(newMap)[0];
        }
        Object.keys(newMap).forEach(key => {
          if ((newMap[key] || 0) > (newMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        newMap[maxKey] = Math.max(0, (newMap[maxKey] || 0) + diff);
      }
      return newMap;
    };

    updateInput(field, val);
    if (field === 'simpleInvestments') {
      const allocated = getReasonableSavingsAllocation(val);
      updateInput('assets', {
        ...inputs.assets,
        ...allocated,
        realEstate: inputs.assets?.realEstate || 0,
        debts: inputs.assets?.debts || 0
      });
    } else if (field === 'simpleIncome') {
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const updatedIncomeList = scen.inputs.incomeList.map(inc => {
            if (inc.id === 'simple-inc' || inc.name === 'Salary / Main Income') {
              return { ...inc, amount: val };
            }
            return inc;
          });

          // Preserve the pre-tax savings rate percentage from the ref
          const rate = lastNonZeroSavingsRateRef.current / 100;
          const newExpenses = Math.round(val * (1 - rate));

          const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
            if (phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
              return { ...phase, amount: newExpenses, annualSpending: newExpenses };
            }
            return phase;
          });

          // Scale budget details and allocation rules
          let updatedBudgetDetails = scen.inputs.budgetDetails ? { ...scen.inputs.budgetDetails } : null;
          let updatedRules = scen.inputs.allocationRules ? [...scen.inputs.allocationRules] : [];

          if (updatedBudgetDetails) {
            const oldIncome = Number(scen.inputs.simpleIncome) || 50000;
            const incomeScale = oldIncome > 0 ? (val / oldIncome) : 1;

            if (incomeScale > 0 && isFinite(incomeScale)) {
              // 1. Scale standard work phase expenses
              const newMonthlyExpenses = newExpenses / 12;
              updatedBudgetDetails.expenses = scaleBudgetMap(
                scen.inputs.budgetDetails.expenses,
                incomeScale,
                Math.round(newMonthlyExpenses),
                'housing'
              );

              // 2. Scale standard work phase savings
              const newMonthlySavings = (val - newExpenses) / 12;
              updatedBudgetDetails.savings = scaleBudgetMap(
                scen.inputs.budgetDetails.savings,
                incomeScale,
                Math.round(newMonthlySavings),
                'brokerage'
              );

              // 3. Scale childcare phase expenses if they exist
              if (scen.inputs.budgetDetails.childcareExpenses) {
                const oldCCExpensesTotal = Object.values(scen.inputs.budgetDetails.childcareExpenses).reduce((sum, v) => sum + v, 0);
                const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * incomeScale);
                updatedBudgetDetails.childcareExpenses = scaleBudgetMap(
                  scen.inputs.budgetDetails.childcareExpenses,
                  incomeScale,
                  targetCCExpensesTotal,
                  'housing'
                );
              }

              // 4. Scale childcare phase savings if they exist
              if (scen.inputs.budgetDetails.childcareSavings) {
                const oldCCSavingsTotal = Object.values(scen.inputs.budgetDetails.childcareSavings).reduce((sum, v) => sum + v, 0);
                const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * incomeScale);
                updatedBudgetDetails.childcareSavings = scaleBudgetMap(
                  scen.inputs.budgetDetails.childcareSavings,
                  incomeScale,
                  targetCCSavingsTotal,
                  'brokerage'
                );
              }

              // 5. Update income fields
              updatedBudgetDetails.income = Math.round(val / 12);
              if (updatedBudgetDetails.childcareIncome !== undefined) {
                updatedBudgetDetails.childcareIncome = Math.round(updatedBudgetDetails.childcareIncome * incomeScale);
              }
              if (updatedBudgetDetails.childcareBudgets) {
                const nextChildcareBudgets = { ...updatedBudgetDetails.childcareBudgets };
                Object.keys(nextChildcareBudgets).forEach(cKey => {
                  const c = Number(cKey);
                  const budget = { ...nextChildcareBudgets[c] };
                  budget.income = Math.round(budget.income * incomeScale);
                  const oldCCExpensesTotal = Object.values(budget.expenses || {}).reduce((sum, v) => sum + v, 0);
                  const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * incomeScale);
                  budget.expenses = scaleBudgetMap(
                    budget.expenses || {},
                    incomeScale,
                    targetCCExpensesTotal,
                    'housing'
                  );
                  const oldCCSavingsTotal = Object.values(budget.savings || {}).reduce((sum, v) => sum + v, 0);
                  const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * incomeScale);
                  budget.savings = scaleBudgetMap(
                    budget.savings || {},
                    incomeScale,
                    targetCCSavingsTotal,
                    'brokerage'
                  );
                  nextChildcareBudgets[c] = budget;
                });
                updatedBudgetDetails.childcareBudgets = nextChildcareBudgets;
              }
            }
          }

          // Sync allocation rules values
          if (updatedBudgetDetails && updatedRules.length > 0) {
            const childEvents = (scen.inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
            let maxChildParentAge = -Infinity;
            childEvents.forEach(ev => {
              const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
            });
            const childEndAge = Math.min(scen.inputs.lifeExpectancy || 85, Math.max(scen.inputs.currentAge, maxChildParentAge));

            updatedRules = updatedRules.map(rule => {
              if (rule.type === 'fixed') {
                let savingsMap = updatedBudgetDetails.savings;
                if (rule.id.includes('budget-alloc-cc-')) {
                  const parts = rule.id.split('-');
                  const ccIdx = parts.indexOf('cc');
                  if (ccIdx !== -1 && parts[ccIdx + 1]) {
                    const c = Number(parts[ccIdx + 1]);
                    if (updatedBudgetDetails.childcareBudgets?.[c]) {
                      savingsMap = updatedBudgetDetails.childcareBudgets[c].savings;
                    } else {
                      savingsMap = updatedBudgetDetails.childcareSavings;
                    }
                  } else {
                    savingsMap = updatedBudgetDetails.childcareSavings;
                  }
                } else if (rule.id.includes('-cc-') || (rule.endAge && rule.endAge === childEndAge)) {
                  savingsMap = updatedBudgetDetails.childcareSavings;
                }

                const key = rule.destination === 'cash' ? 'checking' :
                            rule.destination === 'other' ? 'hysa' :
                            rule.destination === 'emergencyFund' ? 'emergency' :
                            rule.destination === 'debtPaydown' ? 'debt' : rule.destination;

                if (savingsMap && savingsMap[key] !== undefined) {
                  return { ...rule, value: savingsMap[key] };
                }
              }
              return rule;
            });
          }

          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              incomeList: updatedIncomeList,
              spendingPhases: updatedSpendingPhases,
              simpleIncome: val,
              simpleExpenses: newExpenses,
              budgetDetails: updatedBudgetDetails,
              allocationRules: updatedRules
            }
          };
        }
        return scen;
      }));
    } else if (field === 'simpleExpenses') {
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
            if (phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
              return { ...phase, amount: val, annualSpending: (phase.frequency === 'monthly' ? val * 12 : val) };
            }
            return phase;
          });

          // Scale budget details and allocation rules
          let updatedBudgetDetails = scen.inputs.budgetDetails ? { ...scen.inputs.budgetDetails } : null;
          let updatedRules = scen.inputs.allocationRules ? [...scen.inputs.allocationRules] : [];

          if (updatedBudgetDetails) {
            const oldExpenses = Number(scen.inputs.simpleExpenses) || 42500;
            const currentIncome = Number(scen.inputs.simpleIncome) || 50000;
            const expenseScale = oldExpenses > 0 ? (val / oldExpenses) : 1;

            // 1. Scale expenses (standard and childcare)
            if (expenseScale > 0 && isFinite(expenseScale)) {
              const newMonthlyExpenses = val / 12;
              updatedBudgetDetails.expenses = scaleBudgetMap(
                scen.inputs.budgetDetails.expenses,
                expenseScale,
                Math.round(newMonthlyExpenses),
                'housing'
              );

              if (scen.inputs.budgetDetails.childcareExpenses) {
                const oldCCExpensesTotal = Object.values(scen.inputs.budgetDetails.childcareExpenses).reduce((sum, v) => sum + v, 0);
                const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * expenseScale);
                updatedBudgetDetails.childcareExpenses = scaleBudgetMap(
                  scen.inputs.budgetDetails.childcareExpenses,
                  expenseScale,
                  targetCCExpensesTotal,
                  'housing'
                );
              }
            }

            // 2. Scale savings (standard and childcare)
            const oldSavings = Math.max(0, currentIncome - oldExpenses);
            const newSavings = Math.max(0, currentIncome - val);

            const oldMonthlySavings = oldSavings / 12;
            const newMonthlySavings = newSavings / 12;

            if (oldMonthlySavings <= 0 && newMonthlySavings > 0) {
              // Transition from 0 to positive savings: allocate entirely to brokerage
              const defaultSavings = {
                trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
              };
              defaultSavings.brokerage = Math.round(newMonthlySavings);
              updatedBudgetDetails.savings = defaultSavings;

              if (updatedBudgetDetails.childcareSavings) {
                const defaultCC = { ...defaultSavings };
                const ccIncome = updatedBudgetDetails.childcareIncome || Math.round(currentIncome / 12);
                const ccExpenses = Object.values(updatedBudgetDetails.childcareExpenses || {}).reduce((sum, v) => sum + v, 0);
                defaultCC.brokerage = Math.round(Math.max(0, ccIncome - ccExpenses));
                updatedBudgetDetails.childcareSavings = defaultCC;
              }
            } else if (newMonthlySavings <= 0) {
              const zeroSavings = {
                trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
              };
              updatedBudgetDetails.savings = zeroSavings;
              if (updatedBudgetDetails.childcareSavings) {
                updatedBudgetDetails.childcareSavings = { ...zeroSavings };
              }
            } else {
              const savingsScale = newMonthlySavings / oldMonthlySavings;
              if (isFinite(savingsScale)) {
                updatedBudgetDetails.savings = scaleBudgetMap(
                  scen.inputs.budgetDetails.savings,
                  savingsScale,
                  Math.round(newMonthlySavings),
                  'brokerage'
                );

                if (updatedBudgetDetails.childcareSavings) {
                  const oldCCSavingsTotal = Object.values(scen.inputs.childcareSavings).reduce((sum, v) => sum + v, 0);
                  const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * savingsScale);
                  updatedBudgetDetails.childcareSavings = scaleBudgetMap(
                    scen.inputs.childcareSavings,
                    savingsScale,
                    targetCCSavingsTotal,
                    'brokerage'
                  );
                }
              }
              if (updatedBudgetDetails.childcareBudgets) {
                const nextChildcareBudgets = { ...updatedBudgetDetails.childcareBudgets };
                Object.keys(nextChildcareBudgets).forEach(cKey => {
                  const c = Number(cKey);
                  const budget = { ...nextChildcareBudgets[c] };
                  const oldCCExpensesTotal = Object.values(budget.expenses || {}).reduce((sum, v) => sum + v, 0);
                  const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * expenseScale);
                  budget.expenses = scaleBudgetMap(
                    budget.expenses || {},
                    expenseScale,
                    targetCCExpensesTotal,
                    'housing'
                  );
                  const oldCCSavings = Math.max(0, budget.income - oldCCExpensesTotal);
                  const newCCSavings = Math.max(0, budget.income - targetCCExpensesTotal);
                  if (oldCCSavings <= 0 && newCCSavings > 0) {
                    const defaultSavings = {
                      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                      checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
                    };
                    defaultSavings.brokerage = newCCSavings;
                    budget.savings = defaultSavings;
                  } else if (newCCSavings <= 0) {
                    const zeroSavings = {
                      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                      checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
                    };
                    budget.savings = zeroSavings;
                  } else {
                    const cSavingsScale = newCCSavings / oldCCSavings;
                    if (isFinite(cSavingsScale)) {
                      budget.savings = scaleBudgetMap(
                        budget.savings || {},
                        cSavingsScale,
                        newCCSavings,
                        'brokerage'
                      );
                    }
                  }
                  nextChildcareBudgets[c] = budget;
                });
                updatedBudgetDetails.childcareBudgets = nextChildcareBudgets;
              }
            }
          }

          // Sync allocation rules values
          if (updatedBudgetDetails && updatedRules.length > 0) {
            const childEvents = (scen.inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
            let maxChildParentAge = -Infinity;
            childEvents.forEach(ev => {
              const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
            });
            const childEndAge = Math.min(scen.inputs.lifeExpectancy || 85, Math.max(scen.inputs.currentAge, maxChildParentAge));

            updatedRules = updatedRules.map(rule => {
              if (rule.type === 'fixed') {
                let savingsMap = updatedBudgetDetails.savings;
                if (rule.id.includes('budget-alloc-cc-')) {
                  const parts = rule.id.split('-');
                  const ccIdx = parts.indexOf('cc');
                  if (ccIdx !== -1 && parts[ccIdx + 1]) {
                    const c = Number(parts[ccIdx + 1]);
                    if (updatedBudgetDetails.childcareBudgets?.[c]) {
                      savingsMap = updatedBudgetDetails.childcareBudgets[c].savings;
                    } else {
                      savingsMap = updatedBudgetDetails.childcareSavings;
                    }
                  } else {
                    savingsMap = updatedBudgetDetails.childcareSavings;
                  }
                } else if (rule.id.includes('-cc-') || (rule.endAge && rule.endAge === childEndAge)) {
                  savingsMap = updatedBudgetDetails.childcareSavings;
                }

                const key = rule.destination === 'cash' ? 'checking' :
                            rule.destination === 'other' ? 'hysa' :
                            rule.destination === 'emergencyFund' ? 'emergency' :
                            rule.destination === 'debtPaydown' ? 'debt' : rule.destination;

                if (savingsMap && savingsMap[key] !== undefined) {
                  return { ...rule, value: savingsMap[key] };
                }
              }
              return rule;
            });
          }

          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              spendingPhases: updatedSpendingPhases,
              budgetDetails: updatedBudgetDetails,
              allocationRules: updatedRules,
              simpleExpenses: val
            }
          };
        }
        return scen;
      }));
    } else if (field === 'currentAge') {
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const oldAge = scen.inputs.currentAge;
          const updatedIncomeList = scen.inputs.incomeList.map(inc => {
            if (inc.id === 'simple-inc' || inc.startAge === oldAge) {
              return { ...inc, startAge: val };
            }
            return inc;
          });
          const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
            if (phase.id === 'simple-spend' || phase.startAge === oldAge) {
              return { ...phase, startAge: val };
            }
            return phase;
          });
          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              currentAge: val,
              incomeList: updatedIncomeList,
              spendingPhases: updatedSpendingPhases
            }
          };
        }
        return scen;
      }));
    }
  };

  const handleStartOver = () => {
    setScenarios([
      {
        id: 'baseline',
        name: 'Baseline Plan',
        inputs: JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS))
      },
      {
        id: 'compare1',
        name: 'Retire Early (Age 50)',
        inputs: (() => {
          const cloned = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
          cloned.targetRetirementAge = 50;
          cloned.lifeEvents = cloned.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 50 } : e);
          return cloned;
        })()
      }
    ]);
    setCurrentScenarioId('baseline');
    setActiveStep(1);
  };

  const handleSetBudgetClick = (initialPhaseId = null) => {
    const scen = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
    const inp = scen.inputs;

    const normalizedPhases = getNormalizedPhases(inp);
    
    // Initialize editedPhases mapping
    const initialEdited = {};
    normalizedPhases.forEach(p => {
      initialEdited[p.id] = { ...p };
    });
    setEditedPhases(initialEdited);

    // Determine starting activeBudgetPhase ID
    let startPhaseId = null;
    if (initialPhaseId && initialEdited[initialPhaseId]) {
      startPhaseId = initialPhaseId;
    } else {
      // Find phase matching current age
      const currentAgeVal = Number(inp.currentAge) || 30;
      const match = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge);
      if (match) {
        startPhaseId = match.id;
      } else if (normalizedPhases.length > 0) {
        startPhaseId = normalizedPhases[0].id;
      }
    }

    if (startPhaseId) {
      const startPhase = initialEdited[startPhaseId];
      setActiveBudgetPhase(startPhaseId);
      setBudgetMonthlyIncome(startPhase.income);
      setBudgetSavings(startPhase.savings);
      setBudgetPartnerSavings(startPhase.partnerSavings || {});
      setBudgetExpenses(startPhase.expenses);
      setSavingsAllocMode(startPhase.savingsAllocMode);
      
      setBudgetMonthlySpending(Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0));
      const totalSavings = startPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, startPhase.income - Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setBudgetGrossIncome(Number(inp.simpleIncome) || 50000);
    setBudgetFilingStatus(inp.filingStatus || 'single');
    setBudgetHsaCoverage(inp.budgetDetails?.hsaCoverage || 'single');
    
    setIsBudgetModalOpen(true);
  };

  const handleSwitchBudgetPhase = (newPhaseId) => {
    if (newPhaseId === activeBudgetPhase) return;

    // Save current modal inputs to the old phase's state
    setEditedPhases(prev => ({
      ...prev,
      [activeBudgetPhase]: {
        ...prev[activeBudgetPhase],
        income: budgetMonthlyIncome,
        savings: budgetSavings,
        partnerSavings: budgetPartnerSavings,
        expenses: budgetExpenses,
        savingsAllocMode: savingsAllocMode
      }
    }));

    // Load new phase inputs
    const nextPhase = editedPhases[newPhaseId];
    if (nextPhase) {
      setBudgetMonthlyIncome(nextPhase.income);
      setBudgetSavings(nextPhase.savings);
      setBudgetPartnerSavings(nextPhase.partnerSavings || {});
      setBudgetExpenses(nextPhase.expenses);
      setSavingsAllocMode(nextPhase.savingsAllocMode);
      setBudgetMonthlySpending(Object.values(nextPhase.expenses).reduce((sum, val) => sum + val, 0));
      
      const totalSavings = nextPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, nextPhase.income - Object.values(nextPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(nextPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(nextPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setActiveBudgetPhase(newPhaseId);
  };

  const handleToggleSavingsAllocMode = (newMode) => {
    if (newMode === savingsAllocMode) return;
    
    if (newMode === 'percentSurplus') {
      const totalSavings = Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);
      const newSavings = {};
      Object.keys(budgetSavings).forEach(key => {
        const val = budgetSavings[key] || 0;
        newSavings[key] = totalSavings > 0 ? Math.round((val / totalSavings) * 100) : 0;
      });
      
      if (totalSavings > 0) {
        const newSum = Object.values(newSavings).reduce((sum, val) => sum + val, 0);
        const diff = 100 - newSum;
        if (diff !== 0) {
          const keys = Object.keys(newSavings);
          let maxKey = 'brokerage';
          keys.forEach(k => {
            if (newSavings[k] > (newSavings[maxKey] || 0)) {
              maxKey = k;
            }
          });
          newSavings[maxKey] = Math.max(0, newSavings[maxKey] + diff);
        }
      } else {
        newSavings.brokerage = 100;
      }
      setBudgetSavings(newSavings);
    } else {
      const totalExpenses = Object.values(budgetExpenses).reduce((sum, val) => sum + val, 0);
      const estimatedSurplus = Math.max(0, budgetMonthlyIncome - totalExpenses);
      
      const newSavings = {};
      Object.keys(budgetSavings).forEach(key => {
        const val = budgetSavings[key] || 0;
        newSavings[key] = Math.round(estimatedSurplus * (val / 100));
      });
      
      const newSum = Object.values(newSavings).reduce((sum, val) => sum + val, 0);
      const diff = estimatedSurplus - newSum;
      if (diff !== 0) {
        const keys = Object.keys(newSavings);
        let maxKey = 'brokerage';
        keys.forEach(k => {
          if (newSavings[k] > (newSavings[maxKey] || 0)) {
            maxKey = k;
          }
        });
        newSavings[maxKey] = Math.max(0, newSavings[maxKey] + diff);
      }
      setBudgetSavings(newSavings);
    }
    
    setSavingsAllocMode(newMode);
  };

  const handleSaveBudget = () => {
    // Capture the current edits for the active phase
    const finalEdited = {
      ...editedPhases,
      [activeBudgetPhase]: {
        ...editedPhases[activeBudgetPhase],
        income: budgetMonthlyIncome,
        savings: budgetSavings,
        partnerSavings: budgetPartnerSavings,
        expenses: budgetExpenses,
        savingsAllocMode: savingsAllocMode
      }
    };

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

      let newInputs = { ...scen.inputs };
      
      newInputs.filingStatus = budgetFilingStatus;
      if (!newInputs.budgetDetails) newInputs.budgetDetails = {};
      newInputs.budgetDetails.hsaCoverage = budgetHsaCoverage;
      
      // Save all phases back to inputs.budgetDetails.phases
      newInputs.budgetDetails.phases = Object.values(finalEdited).map(p => ({
        id: p.id,
        type: p.type,
        name: p.name,
        startAge: p.startAge,
        endAge: p.endAge,
        income: p.income,
        savingsAllocMode: p.savingsAllocMode,
        savings: p.savings,
        partnerSavings: p.partnerSavings,
        expenses: p.expenses
      }));

      // Synchronize back to simpleIncome, simpleExpenses, incomeList, and spendingPhases
      const currentAgeVal = Number(newInputs.currentAge) || 30;
      const currentPhase = Object.values(finalEdited).find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || Object.values(finalEdited)[0];
      
      if (currentPhase) {
        const wsPhase = Object.values(finalEdited).find(p => p.type === 'workSave');
        const standardIncomeMonthly = wsPhase ? wsPhase.income : currentPhase.income;
        const childBoost = Math.max(0, currentPhase.income - standardIncomeMonthly);
        newInputs.simpleIncome = (currentPhase.income - childBoost) * 12;
        newInputs.simpleExpenses = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
      }

      // Sync career incomes in incomeList
      newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
        const matchingPhase = Object.values(finalEdited).find(p => p.startAge === inc.startAge && (p.type === 'careerChange' || p.type === 'current'));
        if (matchingPhase) {
          inc.amount = inc.frequency === 'monthly' ? matchingPhase.income : matchingPhase.income * 12;
        }
        return inc;
      });

      // Sync spendingPhases
      newInputs.spendingPhases = (newInputs.spendingPhases || []).map(sp => {
        const matchingPhase = Object.values(finalEdited).find(p => p.startAge === sp.startAge && p.type === 'move');
        if (matchingPhase) {
          const totalMonthlyExpenses = Object.values(matchingPhase.expenses).reduce((sum, v) => sum + v, 0);
          sp.amount = sp.frequency === 'monthly' ? totalMonthlyExpenses : totalMonthlyExpenses * 12;
          sp.annualSpending = totalMonthlyExpenses * 12;
        }
        return sp;
      });

      if (pendingImprovement) {
        const { scenario } = pendingImprovement;
        if (scenario.type === 'workLonger') {
          const yearsDelay = scenario.value;
          newInputs.targetRetirementAge = newInputs.targetRetirementAge + yearsDelay;
        } else if (scenario.type === 'retire65') {
          const target65Age = newInputs.currentAge < 65 ? 65 : newInputs.currentAge;
          newInputs.targetRetirementAge = target65Age;
        } else if (scenario.type === 'retireReadyAge') {
          newInputs.targetRetirementAge = scenario.value;
        } else if (scenario.type === 'combined') {
          const yearsDelay = scenario.value && typeof scenario.value === 'object' ? (scenario.value.delay || 0) : 0;
          newInputs.targetRetirementAge = newInputs.targetRetirementAge + yearsDelay;
        } else if (scenario.type.startsWith('childOffset')) {
          const boosts = scenario.incomeBoosts || [];
          newInputs.incomeList = [...(newInputs.incomeList || []), ...boosts];
        }

        const targetRetAge = newInputs.targetRetirementAge;
        newInputs.lifeEvents = newInputs.lifeEvents.map(ev => {
          if (ev.type === 'retire') {
            return { ...ev, age: targetRetAge };
          }
          return ev;
        });
      }

      // Update active marriage event and spouse household member in inputs
      const marriageEventIdx = (newInputs.lifeEvents || []).findIndex(e => e.type === 'marriage' && e.enabled);
      if (marriageEventIdx !== -1 && currentPhase) {
        const currentPhaseExpensesAnnual = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
        newInputs.lifeEvents[marriageEventIdx] = {
          ...newInputs.lifeEvents[marriageEventIdx],
          combinedSpendingAfterMarriage: currentPhaseExpensesAnnual
        };
        const spouseIdx = (newInputs.householdMembers || []).findIndex(m => m.id === 'spouse');
        if (spouseIdx !== -1) {
          newInputs.householdMembers[spouseIdx] = {
            ...newInputs.householdMembers[spouseIdx],
            combinedSpendingAfterMarriage: currentPhaseExpensesAnnual
          };
        }
      }

      // Let the single source of truth properly build suffix-indexed childcare phases, spending phases and rules
      syncChildcarePhasesAndRules(newInputs);

      console.log('>>> SAVE BUDGET:', {
        id: scen.id,
        simpleIncome: newInputs.simpleIncome,
        simpleExpenses: newInputs.simpleExpenses,
        phases: newInputs.budgetDetails?.phases
      });

      return {
        ...scen,
        inputs: newInputs
      };
    }));

    if (isBudgetOpenFromMarriageWizard) {
      const currentAgeVal = Number(inputs.currentAge) || 30;
      const currentPhase = Object.values(finalEdited).find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || Object.values(finalEdited)[0];
      if (currentPhase) {
        const currentPhaseExpensesAnnual = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
        setEditingEvent(prev => {
          if (!prev) return prev;
          let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
          const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
          if (initialPhase) {
            if (initialPhase.frequency === 'monthly') {
              userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
            } else if (initialPhase.frequency === 'yearly') {
              userSpendingPreRetirement = Number(initialPhase.amount) || 0;
            } else {
              userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
            }
          }
          const spousePersonalSpending = Math.round(Math.max(0, currentPhaseExpensesAnnual - userSpendingPreRetirement - (prev.housingCost !== undefined ? Number(prev.housingCost) : -6000) - (prev.lifestyleAdjustment !== undefined ? Number(prev.lifestyleAdjustment) : 0)) / 12);
          return {
            ...prev,
            combinedSpendingAfterMarriage: currentPhaseExpensesAnnual,
            spousePersonalSpending: spousePersonalSpending
          };
        });
      }
    }

    handleCloseBudgetModal();
  };

  const handleOpenSavingsDetails = () => {
    setSavingsDetails({
      cash: inputs.assets?.cash || 0,
      emergencyFund: inputs.assets?.emergencyFund || 0,
      brokerage: inputs.assets?.brokerage || 0,
      trad401k: inputs.assets?.trad401k || 0,
      tradIra: inputs.assets?.tradIra || 0,
      rothIra: inputs.assets?.rothIra || 0,
      hsa: inputs.assets?.hsa || 0,
      other: inputs.assets?.other || 0
    });
    setIsSavingsDetailsOpen(true);
  };

  const handleSaveSavingsDetails = () => {
    const total = Object.values(savingsDetails).reduce((sum, val) => sum + val, 0);
    
    // Save to inputs.assets
    updateInput('assets', {
      ...inputs.assets,
      ...savingsDetails
    });
    // Update simpleInvestments
    updateInput('simpleInvestments', total);
    
    setIsSavingsDetailsOpen(false);
  };

  const getDefaultValuesForType = (type, currentAge) => {
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

  const handleCreateCurrentCondition = () => {
    const currentAge = inputs.currentAge || 35;
    setEditingCondition({
      type: 'debt',
      subtype: 'studentLoan',
      ...getDefaultValuesForType('studentLoan', currentAge)
    });
  };

  const handleSaveCurrentCondition = () => {
    if (!editingCondition) return;
    
    let nextList = [...(inputs.currentConditions || [])];
    
    if (editingCondition.id) {
      // Update existing
      nextList = nextList.map(c => c.id === editingCondition.id ? editingCondition : c);
    } else {
      // Create new
      const newItem = {
        ...editingCondition,
        id: `cond-${Date.now()}`
      };
      nextList.push(newItem);
    }
    
    updateInput('currentConditions', nextList);
    setEditingCondition(null);
  };

  const handleRemoveCurrentCondition = (id) => {
    const nextList = (inputs.currentConditions || []).filter(c => c.id !== id);
    updateInput('currentConditions', nextList);
  };

  const handleCreateEvent = (type) => {
    if (type === 'retire' && (inputs.lifeEvents || []).some(e => e.type === 'retire')) {
      return;
    }
    let defaults = { type };
    const curAge = inputs.currentAge || 35;
    
    if (type === 'buyHouse') {
      defaults = { ...defaults, purchaseAge: 40, homePrice: 500000, downPayment: 100000 };
    } else if (type === 'haveChild') {
      defaults = {
        ...defaults,
        childName: '',
        childStartAge: 0,
        birthAge: inputs.currentAge || 35,
        costMethod: 'default',
        customAges0to4: 15000,
        customAges5to12: 9000,
        customAges13to18: 12000,
        customAges19to22: 20000,
        includeCollege: false
      };
    } else if (type === 'careerChange') {
      defaults = { ...defaults, name: 'Senior Manager', startAge: 40, amount: 150000, growthRate: 3.5 };
    } else if (type === 'move') {
      defaults = { ...defaults, location: 'Dominican Republic', moveAge: 55, newSpending: 40000 };
    } else if (type === 'retire') {
      defaults = { ...defaults, age: 55, spendingPercent: 70 };
    } else if (type === 'windfall') {
      defaults = { ...defaults, ageReceived: 50, amount: 100000, taxRate: 15 };
    } else if (type === 'college') {
      defaults = { ...defaults, startAge: 48, tuitionCost: 30000, duration: 4 };
    } else if (type === 'debtPayoff') {
      defaults = { ...defaults, payoffAge: 38, amount: 5000 };
    } else if (type === 'custom') {
      defaults = { ...defaults, name: 'Custom Event', age: 45, amount: -15000 };
    } else if (type === 'socialSecurity') {
      defaults = { ...defaults, claimingAge: 67, monthlyBenefit: 2000, inflationAdjusted: true, name: 'Social Security', ageStartedWorking: 22 };
    } else if (type === 'pension') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 1000, inflationAdjusted: true, name: 'Pension' };
    } else if (type === 'rentalIncome') {
      defaults = { ...defaults, claimingAge: 60, monthlyBenefit: 1500, inflationAdjusted: true, name: 'Rental Income' };
    } else if (type === 'annuity') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 500, inflationAdjusted: false, name: 'Annuity' };
    } else if (type === 'otherRetirementIncome') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 800, inflationAdjusted: true, name: 'Other Income' };
    } else if (type === 'marriage') {
      defaults = {
        ...defaults,
        age: inputs.currentAge || 35,
        spouseIncome: 60000,
        incomeGrowthRate: 3,
        cash: 10000,
        investments: 25000,
        retirement: 50000,
        debtStudent: 0,
        debtCredit: 0,
        debtOther: 0,
        savingsRate: 15,
        housingOption: 'savings',
        housingSavings: -500,
        housingCost: -6000,
        lifestyleAdjustment: 0,
        includeWeddingCost: false,
        weddingCost: 20000,
        weddingAge: inputs.currentAge || 35,
        filingStatus: 'jointly',
        wizardStep: 1,
        spouseCurrentAge: inputs.currentAge || 35,
        spouseLifeExpectancy: inputs.lifeExpectancy || 85,
        spouseSocialSecurityAge: 67,
        spouseEstimatedSocialSecurityBenefit: 0,
        spouseDesiredRetirementAge: '',
        retirementSpendingNeed: ''
      };
    }
    
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setEditingEvent(defaults);
  };

  const handleSaveEvent = () => {
    if (!editingEvent) return;
    const type = editingEvent.type;
    
    let beforeReadyAge = null;
    let afterReadyAge = null;
    let avgAnnualChildCost = 0;

    if (type === 'haveChild') {
      const currentScenObj = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
      const beforeRes = runFireSimulation(currentScenObj.inputs);
      beforeReadyAge = beforeRes.retirementReadyAge;

      const startAge = editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0;
      const includeCollege = !!editingEvent.includeCollege;
      const maxAge = includeCollege ? 22 : 18;
      let totalCost = 0;
      let activeYears = 0;
      for (let childAge = startAge; childAge < maxAge; childAge++) {
        const ages0to4 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges0to4 !== undefined ? Number(editingEvent.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
        const ages5to12 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges5to12 !== undefined ? Number(editingEvent.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
        const ages13to18 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges13to18 !== undefined ? Number(editingEvent.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
        const ages19to22 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

        if (childAge >= 0 && childAge <= 4) {
          totalCost += ages0to4;
        } else if (childAge >= 5 && childAge <= 12) {
          totalCost += ages5to12;
        } else if (childAge >= 13 && childAge <= 18) {
          totalCost += ages13to18;
        } else if (childAge >= 19 && childAge <= 22) {
          totalCost += ages19to22;
        }
        activeYears++;
      }
      avgAnnualChildCost = activeYears > 0 ? Math.round(totalCost / activeYears) : 0;
    }

    let savedEvent = null;
    const nextScenarios = scenarios.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      
      let newInputs = { ...scen.inputs };
      
      // 1. If editing an existing event, remove it first from the appropriate list
      if (editingEvent.id) {
        const oldEvent = newInputs.lifeEvents.find(e => e.id === editingEvent.id);
        if (oldEvent && oldEvent.type === 'haveChild') {
          const oldBirthAge = Number(oldEvent.birthAge !== undefined ? oldEvent.birthAge : oldEvent.parentAgeAtBirth) || 30;
          const newBirthAge = Number(editingEvent.birthAge !== undefined ? editingEvent.birthAge : editingEvent.parentAgeAtBirth) || 30;
          const ageDiff = newBirthAge - oldBirthAge;
          if (ageDiff !== 0) {
            newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
              if (inc.id && typeof inc.id === 'string' && inc.id.startsWith(`child-income-boost-${editingEvent.id}-`)) {
                return {
                  ...inc,
                  startAge: inc.startAge + ageDiff,
                  endAge: inc.endAge + ageDiff
                };
              }
              return inc;
            });
          }
        }
        if (newInputs.lifeEvents.some(e => e.id === editingEvent.id)) {
          newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== editingEvent.id);
        } else {
          const matchSpend = newInputs.spendingPhases.find(p => p.id === editingEvent.id);
          if (matchSpend) {
            const remaining = newInputs.spendingPhases.filter(p => p.id !== editingEvent.id);
            newInputs.spendingPhases = remaining.map(p => {
              if (p.endAge === matchSpend.startAge) {
                return { ...p, endAge: matchSpend.endAge };
              }
              return p;
            });
          } else {
            const matchInc = newInputs.incomeList.find(i => i.id === editingEvent.id);
            if (matchInc) {
              const remaining = newInputs.incomeList.filter(i => i.id !== editingEvent.id);
              newInputs.incomeList = remaining.map(i => {
                if (i.endAge === matchInc.startAge) {
                  return { ...i, endAge: matchInc.endAge };
                }
                return i;
              });
            }
          }
        }
      }
      
      // 2. Perform save/insert logic
      if (type === 'retire') {
        newInputs.targetRetirementAge = editingEvent.age;
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.type !== 'retire');
        let newEventObj = {
          id: editingEvent.id && editingEvent.id !== 'retire' ? editingEvent.id : `retire-${Date.now()}`,
          type: 'retire',
          enabled: true,
          name: 'Retirement',
          age: editingEvent.age,
          spendingPercent: editingEvent.spendingPercent !== undefined ? editingEvent.spendingPercent : 70
        };
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      } else if (type === 'move') {
        const newPhase = {
          id: editingEvent.id && editingEvent.id !== 'move' ? editingEvent.id : `spend-${Date.now()}`,
          name: `Moved to ${editingEvent.location}`,
          startAge: editingEvent.moveAge,
          endAge: newInputs.lifeExpectancy,
          amount: editingEvent.newSpending,
          frequency: 'yearly',
          annualSpending: editingEvent.newSpending,
          inflationOverride: null,
          notes: `Lifestyle after moving to ${editingEvent.location}`
        };
        const updatedPhases = newInputs.spendingPhases.map(p => {
          if (p.startAge < editingEvent.moveAge && p.endAge > editingEvent.moveAge) {
            return { ...p, endAge: editingEvent.moveAge };
          }
          return p;
        });
        newInputs.spendingPhases = [...updatedPhases, newPhase];
      } else if (type === 'careerChange') {
        const newInc = {
          id: editingEvent.id && editingEvent.id !== 'careerChange' ? editingEvent.id : `inc-${Date.now()}`,
          name: editingEvent.name,
          amount: editingEvent.amount,
          frequency: 'yearly',
          startAge: editingEvent.startAge,
          endAge: newInputs.targetRetirementAge,
          growthRate: (editingEvent.growthRate || 3.0) / 100,
          isTaxable: true
        };
        const updatedIncome = newInputs.incomeList.map(inc => {
          if (inc.startAge < editingEvent.startAge && inc.endAge > editingEvent.startAge) {
            return { ...inc, endAge: editingEvent.startAge };
          }
          return inc;
        });
        newInputs.incomeList = [...updatedIncome, newInc];
      } else {
        const isRetIncomeType = ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type);
        let defaultName = 'Other Income';
        if (type === 'socialSecurity') defaultName = 'Social Security';
        else if (type === 'pension') defaultName = 'Pension';
        else if (type === 'rentalIncome') defaultName = 'Rental Income';
        else if (type === 'annuity') defaultName = 'Annuity';

        let newEventObj = {
          id: editingEvent.id && !['buyHouse', 'haveChild', 'college', 'windfall', 'debtPayoff', 'custom', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(editingEvent.id)
            ? editingEvent.id
            : `${type}-${Date.now()}`,
          type,
          enabled: true,
          name: type === 'buyHouse' ? 'Buy a House' : type === 'haveChild' ? 'Have a Child' : type === 'college' ? 'College' : type === 'windfall' ? 'Windfall' : isRetIncomeType ? (editingEvent.name || defaultName) : editingEvent.name
        };
        
        if (type === 'buyHouse') {
          newEventObj = {
            ...newEventObj,
            purchaseAge: editingEvent.purchaseAge,
            homePrice: editingEvent.homePrice,
            downPayment: editingEvent.downPayment,
            purchaseType: 'mortgage',
            mortgageRate: 6.5,
            loanTerm: 30,
            propertyTax: 1.2,
            insurance: 0.5,
            maintenance: 1.0,
            appreciationRate: 3.0
          };
        } else if (type === 'haveChild') {
          newEventObj = {
            ...newEventObj,
            childName: editingEvent.childName || '',
            childStartAge: editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0,
            birthAge: editingEvent.birthAge !== undefined ? editingEvent.birthAge : newInputs.currentAge,
            costMethod: editingEvent.costMethod || 'default',
            customAges0to4: editingEvent.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000,
            customAges5to12: editingEvent.customAges5to12 !== undefined ? editingEvent.customAges5to12 : 9000,
            customAges13to18: editingEvent.customAges13to18 !== undefined ? editingEvent.customAges13to18 : 12000,
            customAges19to22: editingEvent.customAges19to22 !== undefined ? editingEvent.customAges19to22 : 20000,
            includeCollege: !!editingEvent.includeCollege
          };
        } else if (type === 'college') {
          newEventObj = {
            ...newEventObj,
            startAge: editingEvent.startAge,
            tuitionCost: editingEvent.tuitionCost,
            duration: editingEvent.duration
          };
        } else if (type === 'windfall') {
          newEventObj = {
            ...newEventObj,
            ageReceived: editingEvent.ageReceived,
            amount: editingEvent.amount,
            taxRate: editingEvent.taxRate
          };
        } else if (type === 'debtPayoff') {
          newEventObj = {
            ...newEventObj,
            payoffAge: editingEvent.payoffAge,
            amount: editingEvent.amount
          };
        } else if (isRetIncomeType) {
          let claimingAge = editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65);
          if (type === 'socialSecurity') {
            claimingAge = Math.max(62, Math.min(70, claimingAge));
          }
          newEventObj = {
            ...newEventObj,
            claimingAge,
            startAge: claimingAge,
            age: claimingAge,
            monthlyBenefit: editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 1000,
            inflationAdjusted: editingEvent.inflationAdjusted !== false,
            useEarnings: editingEvent.useEarnings === true,
            ageStartedWorking: editingEvent.ageStartedWorking !== undefined 
              ? Number(editingEvent.ageStartedWorking) 
              : 22
          };
        } else if (type === 'custom') {
          newEventObj = {
            ...newEventObj,
            age: editingEvent.age,
            amount: editingEvent.amount
          };
        } else if (type === 'marriage') {
          let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
          const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
          if (initialPhase) {
            if (initialPhase.frequency === 'monthly') {
              userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
            } else if (initialPhase.frequency === 'yearly') {
              userSpendingPreRetirement = Number(initialPhase.amount) || 0;
            } else {
              userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
            }
          }

          const combinedSpendingVal = editingEvent.combinedSpendingAfterMarriage !== undefined ? Number(editingEvent.combinedSpendingAfterMarriage) : Math.round(userSpendingPreRetirement * 1.5);
          const spousePreRetirementSpending = Math.max(0, combinedSpendingVal - userSpendingPreRetirement);
          const spouseRetSpendingVal = editingEvent.retirementSpendingNeed !== undefined && editingEvent.retirementSpendingNeed !== '' && editingEvent.retirementSpendingNeed !== null ? Number(editingEvent.retirementSpendingNeed) : Math.round(spousePreRetirementSpending * 0.7);

          newEventObj = {
            ...newEventObj,
            age: Number(editingEvent.age),
            spouseIncome: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate),
            cash: Number(editingEvent.cash),
            investments: Number(editingEvent.investments),
            retirement: Number(editingEvent.retirement),
            debtStudent: Number(editingEvent.debtStudent),
            debtCredit: Number(editingEvent.debtCredit),
            debtOther: Number(editingEvent.debtOther),
            savingsRate: Number(editingEvent.savingsRate),
            housingOption: editingEvent.housingOption || 'none',
            housingSavings: Number(editingEvent.housingSavings),
            housingCost: editingEvent.housingCost !== undefined ? Number(editingEvent.housingCost) : -6000,
            lifestyleAdjustment: Number(editingEvent.lifestyleAdjustment),
            includeWeddingCost: !!editingEvent.includeWeddingCost,
            weddingCost: Number(editingEvent.weddingCost),
            weddingAge: Number(editingEvent.weddingAge),
            filingStatus: editingEvent.filingStatus || 'jointly',
            spouseCurrentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            spouseLifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,
            spouseDesiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            retirementSpendingNeed: spouseRetSpendingVal,
            combinedSpendingAfterMarriage: combinedSpendingVal
          };
          
          let nextHouseholdMembers = [...(newInputs.householdMembers || [])];
          const spouseIdx = nextHouseholdMembers.findIndex(m => m.id === 'spouse');
          const spouseRecord = {
            id: 'spouse',
            name: 'Spouse',
            activeFromDate: Number(editingEvent.age),
            activeUntilDate: null,
            income: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate) / 100,
            assets: {
              cash: Number(editingEvent.cash),
              investments: Number(editingEvent.investments),
              retirement: Number(editingEvent.retirement)
            },
            debts: {
              student: Number(editingEvent.debtStudent),
              credit: Number(editingEvent.debtCredit),
              other: Number(editingEvent.debtOther)
            },
            savingsRate: Number(editingEvent.savingsRate),
            currentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            lifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,
            desiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            retirementSpendingNeed: spouseRetSpendingVal,
            growthRate: Number(editingEvent.incomeGrowthRate),
            combinedSpendingAfterMarriage: combinedSpendingVal,
            housingCost: editingEvent.housingCost !== undefined ? Number(editingEvent.housingCost) : -6000,
            lifestyleAdjustment: Number(editingEvent.lifestyleAdjustment)
          };
          if (spouseIdx !== -1) {
            nextHouseholdMembers[spouseIdx] = spouseRecord;
          } else {
            nextHouseholdMembers.push(spouseRecord);
          }
          newInputs.householdMembers = nextHouseholdMembers;
        }
        
        savedEvent = newEventObj;
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      }

      if (type === 'haveChild') {
        syncChildcarePhasesAndRules(newInputs);
        const afterRes = runFireSimulation(newInputs);
        afterReadyAge = afterRes.retirementReadyAge;
      }
      
      return {
        ...scen,
        inputs: newInputs
      };
    });

    setScenarios(nextScenarios);

    if (type === 'haveChild' && savedEvent) {
      const diff = (afterReadyAge && beforeReadyAge) ? (afterReadyAge - beforeReadyAge) : 0;
      const currentScenObj = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
      const targetRetAge = Number(currentScenObj?.inputs?.targetRetirementAge) || 65;
      const isStillReady = afterReadyAge !== null && (diff <= 0 || afterReadyAge <= targetRetAge);

      setChildImpactSummary({
        beforeAge: beforeReadyAge,
        afterAge: afterReadyAge,
        diffYears: diff,
        annualSpending: avgAnnualChildCost,
        event: savedEvent
      });
    }
    
    setEditingEvent(null);
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
  };

  const handleDeleteRoadmapEvent = (evt) => {
    if (!evt || evt.isMilestone) return;
    const matchEvent = inputs.lifeEvents.find(e => e.id === evt.originalId || (e.type === evt.type && (e.purchaseAge === evt.age || e.birthAge === evt.age || e.startAge === evt.age || e.claimingAge === evt.age || e.ageReceived === evt.age || e.age === evt.age)));
    if (matchEvent) {
      setScenarios(prev => prev.map(scen => {
        if (scen.id !== currentScenarioId) return scen;
        let newInputs = {
          ...scen.inputs,
          lifeEvents: scen.inputs.lifeEvents.filter(e => e.id !== matchEvent.id)
        };
        if (evt.type === 'retire') {
          newInputs.targetRetirementAge = scen.inputs.lifeExpectancy;
        }
        if (matchEvent.type === 'haveChild') {
          syncChildcarePhasesAndRules(newInputs);
        }
        if (matchEvent.type === 'marriage') {
          newInputs.householdMembers = (scen.inputs.householdMembers || []).filter(m => m.id !== 'spouse');
        }

        return {
          ...scen,
          inputs: newInputs
        };
      }));
      return;
    }
    const matchSpend = inputs.spendingPhases.find(p => p.id === evt.originalId || p.startAge === evt.age);
    if (matchSpend && inputs.spendingPhases.length > 1) {
      const remaining = inputs.spendingPhases.filter(p => p.id !== matchSpend.id);
      const updated = remaining.map(p => {
        if (p.endAge === matchSpend.startAge) {
          return { ...p, endAge: matchSpend.endAge };
        }
        return p;
      });
      updateInput('spendingPhases', updated);
      return;
    }
    const matchInc = inputs.incomeList.find(i => i.id === evt.originalId || i.startAge === evt.age);
    if (matchInc && inputs.incomeList.length > 1) {
      const remaining = inputs.incomeList.filter(i => i.id !== matchInc.id);
      const updated = remaining.map(i => {
        if (i.endAge === matchInc.startAge) {
          return { ...i, endAge: matchInc.endAge };
        }
        return i;
      });
      updateInput('incomeList', updated);
      return;
    }
  };

  const commitEventAgeChange = (evt, newAge) => {
    const oldAge = evt.age;
    if (newAge === oldAge) return;

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

      let newInputs = { ...scen.inputs };

      // 1. Retirement
      if (evt.type === 'retire') {
        newInputs.targetRetirementAge = newAge;
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.type === 'retire') {
            return { ...e, age: newAge };
          }
          return e;
        });
      }
      // 3. Relocation spending phase (move / lifestyle)
      else if (evt.type === 'move' || evt.type === 'lifestyle') {
        newInputs.spendingPhases = newInputs.spendingPhases.map(p => {
          if (p.id === evt.originalId) {
            return { ...p, startAge: newAge };
          }
          if (p.endAge === oldAge) {
            return { ...p, endAge: newAge };
          }
          return p;
        });
      }
      // 4. Career income phase
      else if (evt.type === 'careerChange' || evt.type === 'career') {
        newInputs.incomeList = newInputs.incomeList.map(i => {
          if (i.id === evt.originalId) {
            return { ...i, startAge: newAge };
          }
          if (i.endAge === oldAge) {
            return { ...i, endAge: newAge };
          }
          return i;
        });
      }
      // 5. General Life Events
      else {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId) {
            let updated = { ...e };
            if (e.type === 'buyHouse') {
              updated.purchaseAge = newAge;
            } else if (e.type === 'haveChild') {
              updated.birthAge = newAge;
              const oldBirthAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
              const ageDiff = newAge - oldBirthAge;
              if (ageDiff !== 0) {
                newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
                  if (inc.id && typeof inc.id === 'string' && inc.id.startsWith(`child-income-boost-${e.id}-`)) {
                    return {
                      ...inc,
                      startAge: inc.startAge + ageDiff,
                      endAge: inc.endAge + ageDiff
                    };
                  }
                  return inc;
                });
              }
            } else if (e.type === 'college') {
              updated.startAge = newAge;
            } else if (e.type === 'sabbatical') {
              const duration = (Number(e.endAge) || 0) - (Number(e.startAge) || 0);
              updated.startAge = newAge;
              updated.endAge = newAge + duration;
            } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(e.type)) {
              let finalAge = newAge;
              if (e.type === 'socialSecurity') {
                finalAge = Math.max(62, Math.min(70, newAge));
              }
              updated.claimingAge = finalAge;
              updated.startAge = finalAge;
              updated.age = finalAge;
            } else if (e.type === 'windfall') {
              updated.ageReceived = newAge;
              updated.age = newAge;
            } else if (e.type === 'assetTransfer') {
              updated.transferAge = newAge;
            } else if (e.type === 'debtPayoff') {
              updated.payoffAge = newAge;
            } else {
              updated.age = newAge;
            }
            return updated;
          }
          return e;
        });
      }

      if (evt.type === 'haveChild') {
        syncChildcarePhasesAndRules(newInputs);
      }

      return {
        ...scen,
        inputs: newInputs
      };
    }));
  };

  const handleNodeDragStart = (e, evt) => {
    // Exclude FI age, mortgageOff, or any other uneditable timeline element
    if (!isEditableEvent(evt) || evt.type === 'fiReached' || evt.type === 'mortgageOff') return;

    // Prevent default touch/click dragging behavior
    e.preventDefault();

    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;

    // Find the timeline track container
    const track = e.currentTarget.closest('.timeline-track-container');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width - 140; // Subtract padding of 70px on left and 70px on right
    const minAge = inputs.currentAge;
    const maxAge = inputs.lifeExpectancy;
    const totalYears = maxAge - minAge;
    const initialAge = evt.age;

    dragOccurredRef.current = false;

    // Initialize draggingInfo in state
    setDraggingInfo({
      originalId: evt.originalId || null,
      type: evt.type,
      initialAge,
      currentAge: initialAge,
      startX
    });

    const handleDragMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;

      // Calculate shift in years
      const deltaYears = trackWidth > 0 ? (deltaX / trackWidth) * totalYears : 0;
      const rawAge = Math.round(initialAge + deltaYears);
      let newAge = rawAge;
      if (evt.type === 'socialSecurity') {
        newAge = Math.max(62, Math.min(70, newAge));
      } else {
        newAge = Math.max(minAge, Math.min(maxAge, newAge));
      }

      if (Math.abs(deltaX) > 2) {
        dragOccurredRef.current = true;
      }

      // Prevent scrolling on mobile during drag
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

      // Read current dragged age to commit
      setDraggingInfo(currentDrag => {
        if (currentDrag && dragOccurredRef.current) {
          let targetAge = currentDrag.currentAge;
          if (evt.type === 'socialSecurity') {
            const rawAge = currentDrag.rawAge !== undefined ? currentDrag.rawAge : targetAge;
            const validation = validateSocialSecurityClaimAge(rawAge);
            targetAge = validation.validAge;
            if (validation.wasClamped) {
              showNotification(validation.message);
            }
          }
          commitEventAgeChange(evt, targetAge);
        }
        return null;
      });

      // Clear the drag flag after click event propagation passes
      setTimeout(() => {
        dragOccurredRef.current = false;
      }, 50);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  const isEditableEvent = (evt) => {
    if (!evt) return false;
    return !!evt.originalId || evt.type === 'retire';
  };

  const handleEditRoadmapEvent = (evt) => {
    if (!evt) return;

    // 1. Retirement
    if (evt.type === 'retire') {
      const existingRetire = inputs.lifeEvents.find(e => e.type === 'retire') || {};
      setEditingEvent({
        id: existingRetire.id || 'retire-1',
        type: 'retire',
        age: evt.age,
        spendingPercent: existingRetire.spendingPercent !== undefined ? existingRetire.spendingPercent : 70
      });
      return;
    }

    // 2. Life Events (using originalId or matching attributes)
    const matchEvent = inputs.lifeEvents.find(e => e.id === evt.originalId || (e.type === evt.type && (e.purchaseAge === evt.age || e.birthAge === evt.age || e.startAge === evt.age || e.claimingAge === evt.age || e.ageReceived === evt.age || e.age === evt.age)));
    if (matchEvent) {
      let defaults = {
        id: matchEvent.id,
        type: matchEvent.type,
      };
      if (matchEvent.type === 'buyHouse') {
        defaults = {
          ...defaults,
          purchaseAge: matchEvent.purchaseAge,
          homePrice: matchEvent.homePrice,
          downPayment: matchEvent.downPayment
        };
      } else if (matchEvent.type === 'haveChild') {
        defaults = {
          ...defaults,
          childName: matchEvent.childName || '',
          childStartAge: matchEvent.childStartAge !== undefined ? matchEvent.childStartAge : 0,
          birthAge: matchEvent.birthAge,
          costMethod: matchEvent.costMethod || 'default',
          customAges0to4: matchEvent.customAges0to4 !== undefined ? matchEvent.customAges0to4 : 15000,
          customAges5to12: matchEvent.customAges5to12 !== undefined ? matchEvent.customAges5to12 : 9000,
          customAges13to18: matchEvent.customAges13to18 !== undefined ? matchEvent.customAges13to18 : 12000,
          customAges19to22: matchEvent.customAges19to22 !== undefined ? matchEvent.customAges19to22 : 20000,
          includeCollege: !!matchEvent.includeCollege
        };
      } else if (matchEvent.type === 'college') {
        defaults = {
          ...defaults,
          startAge: matchEvent.startAge,
          tuitionCost: matchEvent.tuitionCost,
          duration: matchEvent.duration
        };
      } else if (matchEvent.type === 'windfall') {
        defaults = {
          ...defaults,
          ageReceived: matchEvent.ageReceived,
          amount: matchEvent.amount,
          taxRate: matchEvent.taxRate
        };
      } else if (matchEvent.type === 'debtPayoff') {
        defaults = {
          ...defaults,
          payoffAge: matchEvent.payoffAge,
          amount: matchEvent.amount
        };
      } else if (matchEvent.type === 'socialSecurity') {
        defaults = {
          ...defaults,
          claimingAge: matchEvent.claimingAge,
          monthlyBenefit: matchEvent.monthlyBenefit,
          inflationAdjusted: matchEvent.inflationAdjusted,
          useEarnings: matchEvent.useEarnings,
          ageStartedWorking: matchEvent.ageStartedWorking !== undefined ? matchEvent.ageStartedWorking : 22,
          yearStartedWorking: matchEvent.yearStartedWorking
        };
      } else if (matchEvent.type === 'custom') {
        defaults = {
          ...defaults,
          name: matchEvent.name,
          age: matchEvent.age,
          amount: matchEvent.amount
        };
      } else if (matchEvent.type === 'marriage') {
        defaults = {
          ...defaults,
          age: matchEvent.age,
          spouseIncome: matchEvent.spouseIncome,
          incomeGrowthRate: matchEvent.incomeGrowthRate,
          cash: matchEvent.cash,
          investments: matchEvent.investments,
          retirement: matchEvent.retirement,
          debtStudent: matchEvent.debtStudent,
          debtCredit: matchEvent.debtCredit,
          debtOther: matchEvent.debtOther,
          savingsRate: matchEvent.savingsRate,
          housingOption: matchEvent.housingOption || 'none',
          housingSavings: matchEvent.housingSavings,
          housingCost: matchEvent.housingCost,
          lifestyleAdjustment: matchEvent.lifestyleAdjustment,
          includeWeddingCost: !!matchEvent.includeWeddingCost,
          weddingCost: matchEvent.weddingCost,
          weddingAge: matchEvent.weddingAge,
          filingStatus: matchEvent.filingStatus || 'jointly',
          spouseCurrentAge: matchEvent.spouseCurrentAge !== undefined ? matchEvent.spouseCurrentAge : matchEvent.age,
          spouseLifeExpectancy: matchEvent.spouseLifeExpectancy !== undefined ? matchEvent.spouseLifeExpectancy : (inputs.lifeExpectancy || 85),
          spouseSocialSecurityAge: matchEvent.spouseSocialSecurityAge !== undefined ? matchEvent.spouseSocialSecurityAge : 67,
          spouseEstimatedSocialSecurityBenefit: matchEvent.spouseEstimatedSocialSecurityBenefit !== undefined ? matchEvent.spouseEstimatedSocialSecurityBenefit : 0,
          spouseDesiredRetirementAge: matchEvent.spouseDesiredRetirementAge !== undefined ? matchEvent.spouseDesiredRetirementAge : '',
          retirementSpendingNeed: matchEvent.retirementSpendingNeed !== undefined ? matchEvent.retirementSpendingNeed : '',
          combinedSpendingAfterMarriage: matchEvent.combinedSpendingAfterMarriage,
          spousePersonalSpending: matchEvent.spousePersonalSpending,
          wizardStep: 1
        };
      }
      setEditingEvent(defaults);
      return;
    }

    // 3. Spending Phases (lifestyle relocations, i.e. move)
    const matchSpend = inputs.spendingPhases.find(p => p.id === evt.originalId || p.startAge === evt.age);
    if (matchSpend) {
      const location = matchSpend.name.replace(/^Moved to /, '');
      setEditingEvent({
        id: matchSpend.id,
        type: 'move',
        location: location,
        moveAge: matchSpend.startAge,
        newSpending: matchSpend.annualSpending
      });
      return;
    }

    // 4. Income Phases (career changes)
    const matchInc = inputs.incomeList.find(i => i.id === evt.originalId || i.startAge === evt.age);
    if (matchInc) {
      setEditingEvent({
        id: matchInc.id,
        type: 'careerChange',
        name: matchInc.name,
        startAge: matchInc.startAge,
        amount: matchInc.amount,
        growthRate: matchInc.growthRate * 100
      });
      return;
    }
  };

  const generateLifeStory = (inp, results) => {
    const list = [];
    const curAge = inp.currentAge || 35;
    
    inp.incomeList.forEach(inc => {
      if (inc.startAge > curAge) {
        list.push({
          age: inc.startAge,
          text: `Start new career: "${inc.name}" earning ${formatCurrency(inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount)}/yr`
        });
      }
    });

    inp.spendingPhases.forEach(phase => {
      if (phase.startAge > curAge) {
        list.push({
          age: phase.startAge,
          text: `Change lifestyle: "${phase.name}" costing ${formatCurrency(phase.frequency === 'monthly' ? phase.amount * 12 : phase.amount)}/yr`
        });
      }
    });

    inp.lifeEvents.forEach(ev => {
      if (ev.enabled) {
        if (ev.type === 'buyHouse') {
          list.push({
            age: Number(ev.purchaseAge),
            text: `Buy a home for ${formatCurrency(ev.homePrice)} (${ev.purchaseType === 'cash' ? 'in cash' : 'with mortgage'})`
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



    const criteria = inputs.readinessCriteria;
    const roadmapLabel = criteria === 'lastsLifeExp' ? 'Sustainable' : criteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite';
    const retirementReadyAge = results.retirementReadyAge;
    if (retirementReadyAge) {
      list.push({
        age: retirementReadyAge,
        text: `<strong style="color: var(--accent-emerald)">Reach ${roadmapLabel} Retirement (Target: ${formatCurrency(results.retirementReadyTarget)})</strong>`
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

  // Compile timeline events
  const timelineEvents = useMemo(() => {
    const events = [];
    const inp = activeScenario.inputs;
    const calc = displayedResults;

    // 1. Income Phases
    inp.incomeList.forEach(inc => {
      if (inc.id && typeof inc.id === 'string' && (inc.id.startsWith('simple-inc') || inc.id.startsWith('child-income-boost'))) {
        return;
      }
      if (inc.startAge > inp.currentAge && inc.startAge <= inp.lifeExpectancy) {
        events.push({
          originalId: inc.id,
          age: Number(inc.startAge),
          title: `Career Phase: ${inc.name}`,
          label: inc.name,
          icon: '💼',
          type: 'career',
          description: `Started career phase "${inc.name}" earning ${formatCurrency(inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount)}/year (raises: ${(inc.growthRate * 100).toFixed(1)}%).`
        });
      }
    });

    // 2. Spending Phases
    inp.spendingPhases.forEach(phase => {
      if (phase.id && typeof phase.id === 'string' && phase.id.startsWith('simple-spend')) {
        return;
      }
      if (phase.startAge > inp.currentAge && phase.startAge <= inp.lifeExpectancy) {
        let emoji = '🏡';
        if (phase.name.toLowerCase().includes('dominican') || phase.name.toLowerCase().includes('dr')) {
          emoji = '🇩🇴';
        } else if (phase.name.toLowerCase().includes('retir')) {
          emoji = '🏖️';
        } else if (phase.name.toLowerCase().includes('child')) {
          emoji = '👶';
        }
        events.push({
          originalId: phase.id,
          age: Number(phase.startAge),
          title: `Lifestyle: ${phase.name}`,
          label: phase.name,
          icon: emoji,
          type: 'lifestyle',
          description: `Began lifestyle phase "${phase.name}" costing ${formatCurrency(phase.annualSpending)}/year (inflation override: ${phase.inflationOverride !== null ? phase.inflationOverride + '%' : 'default'}).`
        });
      }
    });

    // 3. Life Events & Asset Transfers
    inp.lifeEvents.forEach(ev => {
      if (ev.enabled) {
        const age = Number(ev.purchaseAge || ev.birthAge || ev.startAge || ev.claimingAge || ev.ageReceived || ev.transferAge || ev.age);
        if (age >= inp.currentAge && age <= inp.lifeExpectancy) {
          if (ev.type === 'buyHouse') {
            events.push({
              originalId: ev.id,
              age,
              title: `Buy House`,
              label: `Buy House`,
              icon: '🏠',
              type: 'buyHouse',
              description: `Purchased a home for ${formatCurrency(ev.homePrice)} (${ev.purchaseType === 'cash' ? 'Cash Purchase' : 'Mortgage with ' + formatCurrency(ev.downPayment) + ' down'}).`
            });
            if (ev.purchaseType !== 'cash') {
              const payoffAge = age + Number(ev.loanTerm);
              if (payoffAge <= inp.lifeExpectancy) {
                events.push({
                  age: payoffAge,
                  title: `Mortgage Paid Off`,
                  label: `Mortgage Off`,
                  icon: '🏠',
                  type: 'mortgageOff',
                  isMilestone: true,
                  description: `Mortgage on home is fully amortized, removing P&I payment of ${formatCurrency(propPIAmount(ev))} /yr from annual expenses.`
                });
              }
            }
          } else if (ev.type === 'haveChild') {
            events.push({
              originalId: ev.id,
              age,
              title: ev.childName ? `Have Child: ${ev.childName}` : `Have Child`,
              label: ev.childName ? `Have Child: ${ev.childName}` : `Have Child`,
              icon: '👶',
              type: 'haveChild',
              description: ev.childName 
                ? `Welcomed ${ev.childName}! Childcare/support runs until support ends at age ${ev.includeCollege ? 22 : 18}.`
                : `Welcomed a child! Childcare/support runs until support ends at age ${ev.includeCollege ? 22 : 18}.`
            });
            const supportEndAge = ev.includeCollege ? 22 : 18;
            const parentAgeAtEnd = age + supportEndAge;
            if (parentAgeAtEnd <= inp.lifeExpectancy) {
              events.push({
                age: parentAgeAtEnd,
                title: ev.childName ? `Support for ${ev.childName} Ends` : `Child Expenses End`,
                label: ev.childName ? `Support for ${ev.childName} Ends` : `Child Support Ends`,
                icon: '👶',
                type: 'childSupportEnds',
                isMilestone: true,
                description: ev.childName 
                  ? `General support and childcare expenses for ${ev.childName} born when you were Age ${age} have ended (support term: ${supportEndAge} years).`
                  : `General support and childcare expenses for child born when you were Age ${age} have ended (support term: ${supportEndAge} years).`
              });
            }
          } else if (ev.type === 'college') {
            events.push({
              originalId: ev.id,
              age,
              title: `College Tuition Starts`,
              label: `College`,
              icon: '🎓',
              type: 'college',
              description: `Paying college tuition of ${formatCurrency(ev.tuitionCost)}/year for ${ev.duration || 4} years.`
            });
          } else if (ev.type === 'sabbatical') {
            events.push({
              originalId: ev.id,
              age,
              title: `Sabbatical Starts`,
              label: `Sabbatical`,
              icon: '🌴',
              type: 'sabbatical',
              description: `Taking a sabbatical until age ${ev.endAge} (income reduced by ${ev.incomeReduction}%).`
            });
          } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
            let icon = '💰';
            let label = 'Social Security';
            if (ev.type === 'pension') { icon = '📜'; label = ev.name || 'Pension'; }
            else if (ev.type === 'rentalIncome') { icon = '🏢'; label = ev.name || 'Rental Income'; }
            else if (ev.type === 'annuity') { icon = '📈'; label = ev.name || 'Annuity'; }
            else if (ev.type === 'otherRetirementIncome') { icon = '💵'; label = ev.name || 'Other Income'; }

            let desc = `Receiving ${label} of ${formatCurrency(ev.monthlyBenefit)}/month (${formatCurrency(ev.monthlyBenefit * 12)}/year).`;
            let ssTitle = label;
            if (ev.type === 'socialSecurity') {
              const ss = calc.socialSecurityDetails;
              const isEligible = ss ? ss.isEligible : true;
              let annualBenefit = ss ? ss.annualBenefit : (Number(ev.monthlyBenefit) || 0) * 12 * getSocialSecurityFactor(age);
              let monthlyBenefitVal = annualBenefit / 12;
              
              if (!isEligible) {
                ssTitle = `Social Security starts at ${age}: Not Eligible`;
                desc = `Not eligible for Social Security benefits. At least 10 working years are required. (Working Years: ${ss ? ss.workingYears : 0} / 10)`;
              } else {
                ssTitle = `Social Security starts at ${age}: ~$${Math.round(annualBenefit).toLocaleString()}/yr`;
                
                if (age < 62) {
                  desc = `Social Security cannot be claimed before age 62 (Benefit: $0/mo).`;
                } else {
                  const factor = getSocialSecurityFactor(age);
                  const penaltyPct = 30; // 30% early reduction
                  const bonusPct = Math.round((factor - 1) * 100);
                  
                  desc = `Receiving Social Security of ${formatCurrency(monthlyBenefitVal)}/month (${formatCurrency(annualBenefit)}/year) claimed at age ${age}. `;
                  if (age === 67) {
                    desc += `Full retirement benefit (100%).`;
                  } else if (age < 67) {
                    desc += `Benefit is permanently reduced by ${penaltyPct}% from full benefit due to early claim.`;
                  } else {
                    desc += `Benefit is permanently increased by ${bonusPct}% from full benefit due to delayed claim (8% delayed credit per year after 67).`;
                  }
                }
              }
            }

            events.push({
              originalId: ev.id,
              age,
              title: ssTitle,
              label: ssTitle,
              icon: icon,
              type: ev.type,
              description: desc
            });
          } else if (ev.type === 'retire') {
            events.push({
              originalId: ev.id,
              age,
              title: `Target Retirement`,
              label: `Retirement`,
              icon: '🏖️',
              type: 'retire',
              description: `Target retirement age reached. Contributions stop, and you begin drawing down from your retirement portfolios at ${ev.spendingPercent !== undefined ? ev.spendingPercent : 70}% of your pre-retirement spending.`
            });
          } else if (ev.type === 'windfall') {
            events.push({
              originalId: ev.id,
              age,
              title: `Windfall / Inheritance`,
              label: `Windfall`,
              icon: '💰',
              type: 'windfall',
              description: `Received a one-time windfall inflow of ${formatCurrency(ev.amount)} (post-tax).`
            });
          } else if (ev.type === 'assetTransfer') {
            events.push({
              originalId: ev.id,
              age,
              title: `Asset Transfer`,
              label: `Transfer`,
              icon: '🔄',
              type: 'assetTransfer',
              description: `Moved ${formatCurrency(ev.amount)} from ${getAssetLabel(ev.fromAsset)} to ${getAssetLabel(ev.toAsset)}.`
            });
          } else if (ev.type === 'marriage') {
            const spouseAssets = (Number(ev.cash) || 0) + (Number(ev.investments) || 0) + (Number(ev.retirement) || 0);
            const spouseDebts = (Number(ev.debtStudent) || 0) + (Number(ev.debtCredit) || 0) + (Number(ev.debtOther) || 0);
            events.push({
              originalId: ev.id,
              age,
              title: `💍 Get Married`,
              label: `Get Married`,
              icon: '💍',
              type: 'marriage',
              description: `Married a spouse with ${formatCurrency(ev.spouseIncome)}/yr income, ${formatCurrency(spouseAssets)} starting assets, and ${formatCurrency(spouseDebts)} starting debts. ${ev.includeWeddingCost ? 'Wedding cost: ' + formatCurrency(ev.weddingCost) + ' at Age ' + ev.weddingAge + '.' : ''}`,
              spouseIncome: ev.spouseIncome,
              incomeGrowthRate: ev.incomeGrowthRate,
              cash: ev.cash,
              investments: ev.investments,
              retirement: ev.retirement,
              debtStudent: ev.debtStudent,
              debtCredit: ev.debtCredit,
              debtOther: ev.debtOther,
              savingsRate: ev.savingsRate,
              housingOption: ev.housingOption,
              housingSavings: ev.housingSavings,
              housingCost: ev.housingCost,
              lifestyleAdjustment: ev.lifestyleAdjustment,
              includeWeddingCost: ev.includeWeddingCost,
              weddingCost: ev.weddingCost,
              weddingAge: ev.weddingAge,
              filingStatus: ev.filingStatus
            });
          }
        }
      }
    });

    // 4. Mathematical Milestones (e.g. debt payoffs)
    const calculationMilestones = calc.dynamicMilestones || [];
    calculationMilestones.forEach(m => {
      events.push({
        age: m.age,
        title: m.label,
        label: m.label,
        icon: m.type === 'debtPayoff' ? '🛑' : '🔔',
        type: m.type,
        isMilestone: m.isMilestone,
        description: `Mathematical milestone: "${m.label}" was achieved.`
      });
    });

    // 5. FIRE Milestones
    if (inp.readinessCriteria === 'lastsLifeExp') {
      if (calc.retirementReadyAgeSurvival) {
        events.push({
          age: calc.retirementReadyAgeSurvival,
          title: `Sustainable Retirement (lasts to Life Expectancy)`,
          label: `Sustainable Retire`,
          icon: '🎉',
          type: 'retirementReadySurvival',
          isMilestone: true,
          description: `Age at which you can retire and have your portfolio survive through your life expectancy (Age ${inp.lifeExpectancy}) under current assumptions.`
        });
      }
    } else if (inp.readinessCriteria === 'lastsComfortable') {
      if (calc.retirementReadyAgeComfortable) {
        events.push({
          age: calc.retirementReadyAgeComfortable,
          title: `Comfortable Retirement (lasts to Life Expectancy + 10)`,
          label: `Comfortable Retire`,
          icon: '🎉',
          type: 'retirementReadyComfortable',
          isMilestone: true,
          description: `Age at which you can retire and have your portfolio survive through your life expectancy plus 10 years (Age ${inp.lifeExpectancy + 10}) under current assumptions.`
        });
      }
    } else {
      if (calc.retirementReadyAgeSWR) {
        events.push({
          age: calc.retirementReadyAgeSWR,
          title: `Indefinite Retirement (lasts indefinitely)`,
          label: `Indefinite Retire`,
          icon: '🎉',
          type: 'retirementReadySWR',
          isMilestone: true,
          description: `Age at which your portfolio meets the safe perpetual Safe Withdrawal Rate (SWR) target (${formatCurrency(calc.retirementReadyTarget)}), ensuring it lasts indefinitely.`
        });
      }
    }



    if (calc.coastAge) {
      events.push({
        age: calc.coastAge,
        title: `Coast FIRE Reached`,
        label: `Coast FIRE`,
        icon: '⛵',
        type: 'coastFire',
        isMilestone: true,
        description: `You reached Coast FIRE! Your current savings will grow to cover your target retirement expenses without any additional contributions.`
      });
    }

    // Medicare Milestone
    if (inp.enableHealthcareModel !== false) {
      events.push({
        age: 65,
        title: `Medicare Eligibility`,
        label: `Medicare`,
        icon: '🏥',
        type: 'medicareEligibility',
        isMilestone: true,
        description: `You become eligible for Medicare. Healthcare costs drop from your pre-Medicare private premium (${formatCurrency(inp.preMedicarePremium || 10000)}/yr) to Medicare rates (${formatCurrency(inp.medicarePremium || 4000)}/yr).`
      });
    }

    const sorted = events.sort((a, b) => {
      if (a.age !== b.age) {
        return a.age - b.age;
      }
      const aIsMilestone = !!a.isMilestone;
      const bIsMilestone = !!b.isMilestone;
      if (aIsMilestone && !bIsMilestone) return -1;
      if (!aIsMilestone && bIsMilestone) return 1;
      return 0;
    });

    const ageCounts = {};
    return sorted.map(evt => {
      const ageKey = Math.floor(evt.age);
      const stackIndex = ageCounts[ageKey] || 0;
      ageCounts[ageKey] = stackIndex + 1;
      return { ...evt, stackIndex };
    });
  }, [activeScenario.inputs, displayedResults]);

  function getAssetLabel(key) {
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
  }



  // Summary statistics
  const totalNetWorth = displayedResults.currentNetWorth;
  const targetGoal = displayedResults.fiNumber || 0;
  const rawPercent = targetGoal > 0 ? Math.round((totalNetWorth / targetGoal) * 100) : 0;
  const gaugePercent = rawPercent;
  const clampedPercentForGauge = Math.max(0, Math.min(100, rawPercent));

  const sqSize = 120;
  const radius = 50;
  const viewBox = `0 0 ${sqSize} ${sqSize}`;
  const dashArray = radius * Math.PI * 2;
  const dashOffset = dashArray - (dashArray * clampedPercentForGauge) / 100;

  const getLifestyleGaps = (logs) => {
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

  const renderChildImpactModal = () => {
    if (!childImpactSummary) return null;
    const { beforeAge, afterAge, diffYears, annualSpending, event } = childImpactSummary;

    const targetRet = Number(inputs.targetRetirementAge) || 65;
    const isBeforeReady = beforeAge !== null && beforeAge <= targetRet;
    const isAfterReady = afterAge !== null && afterAge <= targetRet;
    const isStillReady = afterAge !== null && (diffYears <= 0 || afterAge <= targetRet);

    const startAge = event.childStartAge !== undefined ? Number(event.childStartAge) : 0;
    const includeCollege = !!event.includeCollege;
    const maxAge = includeCollege ? 22 : 18;
    const years = Math.max(0, maxAge - startAge);

    return (
      <div className="modal-backdrop" onClick={() => setChildImpactSummary(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👶 {event.childName ? `Welcome, ${event.childName}!` : 'Child Event Added'}
          </h3>
          
          <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            {isStillReady 
              ? "Congratulations! Your retirement plan remains fully on track and sustainable with this child event. No further adjustments are needed."
              : "Adding child-related costs changes the timeline and may require adjustments to savings, spending, or retirement assumptions. Raising a child is a beautiful journey, and these figures help you plan with confidence. You can refine child spending details in your budget at any time."
            }
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Before Child:</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isBeforeReady ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', marginTop: '0.2rem' }}>
                {beforeAge 
                  ? (beforeAge <= targetRet ? `✓ Retirement Ready at Age ${beforeAge}` : `⚠ Retires Late at Age ${beforeAge}`)
                  : '⚠ Current Plan Needs Adjustment'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>After Child:</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isAfterReady ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', marginTop: '0.2rem' }}>
                {afterAge 
                  ? (afterAge <= targetRet ? `✓ Retirement Ready at Age ${afterAge}` : `⚠ Retires Late at Age ${afterAge}`)
                  : '⚠ Current Plan Needs Adjustment'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estimated Child Costs:</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {formatCurrency(annualSpending)}/year for {years} years
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => {
                setChildImpactSummary(null);
                setEditingEvent(event);
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Refine Child Costs
            </button>
            <button 
              type="button"
              className={isStillReady ? "btn-primary" : "btn-secondary"} 
              onClick={() => {
                setChildImpactSummary(null);
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Done
            </button>
            <button 
              type="button"
              className={isStillReady ? "btn-secondary" : "btn-primary"} 
              onClick={() => {
                setChildImpactSummary(null);
                setShowImprovementModal(true);
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Adjust Plan
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderChildCostsBuckets = () => {
    const childEvents = inputs.lifeEvents.filter(e => e.type === 'haveChild');
    if (childEvents.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
        {childEvents.map((ev, idx) => {
          const startAge = ev.childStartAge !== undefined ? ev.childStartAge : 0;
          const birthAge = ev.birthAge !== undefined ? ev.birthAge : inputs.currentAge;
          const childName = ev.childName || `Child #${idx + 1}`;
          
          const maxAge = ev.includeCollege ? 22 : 18;
          const parentStartAge = birthAge + startAge;
          const parentEndAge = birthAge + maxAge;
          
          const currentChildAge = Math.max(0, inputs.currentAge - birthAge);
          
          let currentAnnualCost = 0;
          const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
          const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
          const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
          const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

          if (currentChildAge >= 0 && currentChildAge <= 4) currentAnnualCost = ages0to4;
          else if (currentChildAge >= 5 && currentChildAge <= 12) currentAnnualCost = ages5to12;
          else if (currentChildAge >= 13 && currentChildAge <= 18) currentAnnualCost = ages13to18;
          else if (currentChildAge >= 19 && currentChildAge <= 22) currentAnnualCost = ages19to22;

          const monthlyCost = Math.round(currentAnnualCost / 12);

          return (
            <div className="glass-card" key={ev.id || idx} style={{ padding: '1.25rem 1.5rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  👶 {childName} Spending Bucket
                </h4>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', margin: 0 }}
                  onClick={() => handleEditRoadmapEvent({
                    ...ev,
                    age: birthAge
                  })}
                >
                  Adjust
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Current Monthly Cost</span>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{formatCurrency(monthlyCost)}/mo</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Current Annual Cost</span>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{formatCurrency(currentAnnualCost)}/yr</strong>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div>
                  Active Years: <strong>Parent Age {parentStartAge} to {parentEndAge}</strong> (Child Age {startAge} to {maxAge})
                </div>
                <div>
                  College Support: <strong>{ev.includeCollege ? 'Enabled (Ages 19-22)' : 'Disabled'}</strong>
                </div>
                <div>
                  Cost Method: <strong>{ev.costMethod === 'custom' ? 'Custom Brackets' : ev.costMethod === 'budget' ? 'Budget Builder' : 'Default Assumptions'}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMarriageWizard = () => {
    const stepId = editingEvent.wizardStep || 1;
    const showTaxesStep = !!inputs.includeTaxes;

    const handleNext = () => {
      if (stepId === 1) {
        setEditingEvent({ ...editingEvent, wizardStep: 2 });
      } else if (stepId === 2) {
        setEditingEvent({ ...editingEvent, wizardStep: 3 });
      } else if (stepId === 3) {
        setEditingEvent({ ...editingEvent, wizardStep: showTaxesStep ? 4 : 5 });
      } else if (stepId === 4) {
        setEditingEvent({ ...editingEvent, wizardStep: 5 });
      }
    };

    const handleBack = () => {
      if (stepId === 5) {
        setEditingEvent({ ...editingEvent, wizardStep: showTaxesStep ? 4 : 3 });
      } else if (stepId === 4) {
        setEditingEvent({ ...editingEvent, wizardStep: 3 });
      } else if (stepId === 3) {
        setEditingEvent({ ...editingEvent, wizardStep: 2 });
      } else if (stepId === 2) {
        setEditingEvent({ ...editingEvent, wizardStep: 1 });
      }
    };

    // Calculate Combined Live Summary
    const userIncome = Number(inputs.simpleIncome) || 50000;
    const spouseIncome = Number(editingEvent.spouseIncome) || 0;
    const combinedIncome = userIncome + spouseIncome;

    const userAssets = Number(inputs.assets?.cash || 0) +
                       Number(inputs.assets?.brokerage || 0) +
                       Number(inputs.assets?.trad401k || 0) +
                       Number(inputs.assets?.tradIra || 0) +
                       Number(inputs.assets?.rothIra || 0) +
                       Number(inputs.assets?.hsa || 0) +
                       Number(inputs.assets?.other || 0);
    const spouseAssets = Number(editingEvent.cash || 0) +
                         Number(editingEvent.investments || 0) +
                         Number(editingEvent.retirement || 0);
    const combinedAssets = userAssets + spouseAssets;

    const userDebt = Number(inputs.assets?.debts || 0) +
                     (inputs.debtList || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);
    const spouseDebt = Number(editingEvent.debtStudent || 0) +
                       Number(editingEvent.debtCredit || 0) +
                       Number(editingEvent.debtOther || 0);
    const combinedDebt = userDebt + spouseDebt;

    // Calculate user spending baseline pre-retirement
    let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
    const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
    if (initialPhase) {
      if (initialPhase.frequency === 'monthly') {
        userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
      } else if (initialPhase.frequency === 'yearly') {
        userSpendingPreRetirement = Number(initialPhase.amount) || 0;
      } else {
        userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
      }
    }

    const partnerSavings = spouseIncome * ((editingEvent.savingsRate || 0) / 100);
    const partnerTax = calculateUSTaxForModal(spouseIncome, partnerSavings, 'single');
    const partnerTakeHome = spouseIncome - partnerTax;
    const partnerTakeHomeRemaining = Math.max(0, partnerTakeHome - partnerSavings);
    const defaultPartnerSpendingAnnual = partnerTakeHomeRemaining * 0.7;
    const defaultPartnerSpendingMonthly = Math.round(defaultPartnerSpendingAnnual / 12);

    const partnerPersonalSpending = editingEvent.spousePersonalSpending !== undefined ? Number(editingEvent.spousePersonalSpending) : defaultPartnerSpendingMonthly;

    const housingCostAmount = editingEvent.housingCost !== undefined ? Number(editingEvent.housingCost) : -6000;
    const lifestyleAdjustmentAmount = Number(editingEvent.lifestyleAdjustment || 0);
    const weddingCostAmount = editingEvent.includeWeddingCost ? Number(editingEvent.weddingCost || 20000) : 0;

    const combinedSpendingVal = Math.round(userSpendingPreRetirement + (partnerPersonalSpending * 12) + housingCostAmount + lifestyleAdjustmentAmount);
    const spousePreRetirementSpending = Math.max(0, combinedSpendingVal - userSpendingPreRetirement);
    const spouseRetSpendingVal = editingEvent.retirementSpendingNeed !== undefined && editingEvent.retirementSpendingNeed !== '' && editingEvent.retirementSpendingNeed !== null ? Number(editingEvent.retirementSpendingNeed) : Math.round(spousePreRetirementSpending * 0.7);

    // Net Cash Flow Impact = Spouse Income - (Combined Spend - User Spend) - Housing Cost - Lifestyle Cost
    const netCashFlowImpact = spouseIncome - spousePreRetirementSpending - housingCostAmount - lifestyleAdjustmentAmount;

    const beforeSpendingNeed = userSpendingPreRetirement * (Number((inputs.lifeEvents || []).find(e => e.type === 'retire')?.spendingPercent || 70) / 100);
    const afterSpendingNeed = beforeSpendingNeed + spouseRetSpendingVal;

    // Monthly budget preview calculations
    const userSavingsMonthly = Object.values(inputs.budgetDetails?.savings || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const userFlatSavings = (Number(inputs.simpleIncome) || 50000) * ((Number(inputs.preTaxSavingsRate) || 15) / 100) / 12;
    const userSavings = userSavingsMonthly > 0 ? userSavingsMonthly : Math.round(userFlatSavings);

    const partnerSavingsMonthly = partnerSavings / 12;
    const combinedSavings = userSavings + partnerSavingsMonthly;
    const surplusMonthly = combinedIncome / 12 - combinedSpendingVal / 12;
    const leftoverGap = surplusMonthly - combinedSavings;

    const isStep3Invalid = (combinedSpendingVal <= userSpendingPreRetirement && !isZeroSpendingConfirmed) || (partnerPersonalSpending === 0 && !isPartnerZeroSpendingConfirmed);

    // Simulation Previews (Step 5 with Taxes, or Step 4 without Taxes)
    const isPreviewStep = stepId === (showTaxesStep ? 5 : 4);
    let beforeReadyAge = null;
    let afterReadyAge = null;
    if (isPreviewStep) {
      const beforeInputs = {
        ...inputs,
        lifeEvents: (inputs.lifeEvents || []).filter(e => e.type !== 'marriage')
      };
      const beforeRes = runFireSimulation(beforeInputs);
      beforeReadyAge = beforeRes.retirementReadyAge;

      const afterInputs = {
        ...inputs,
        lifeEvents: [
          ...(inputs.lifeEvents || []).filter(e => e.type !== 'marriage'),
          {
            ...editingEvent,
            enabled: true,
            retirementSpendingNeed: spouseRetSpendingVal,
            combinedSpendingAfterMarriage: combinedSpendingVal,
            housingCost: housingCostAmount
          }
        ],
        householdMembers: [
          ...(inputs.householdMembers || []).filter(m => m.id !== 'spouse'),
          {
            id: 'spouse',
            name: 'Spouse',
            activeFromDate: Number(editingEvent.age),
            activeUntilDate: null,
            income: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate) / 100,
            assets: {
              cash: Number(editingEvent.cash),
              investments: Number(editingEvent.investments),
              retirement: Number(editingEvent.retirement)
            },
            debts: {
              student: Number(editingEvent.debtStudent),
              credit: Number(editingEvent.debtCredit),
              other: Number(editingEvent.debtOther)
            },
            savingsRate: Number(editingEvent.savingsRate),
            currentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            lifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,
            desiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            retirementSpendingNeed: spouseRetSpendingVal,
            growthRate: Number(editingEvent.incomeGrowthRate),
            combinedSpendingAfterMarriage: combinedSpendingVal,
            housingCost: housingCostAmount,
            lifestyleAdjustment: lifestyleAdjustmentAmount
          }
        ]
      };
      const afterRes = runFireSimulation(afterInputs);
      afterReadyAge = afterRes.retirementReadyAge;
    }

    const showImprovementWarning = beforeReadyAge && afterReadyAge && (beforeReadyAge - afterReadyAge > 10);

    return (
      <div className="modal-backdrop" onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💍 Get Married
          </h3>

          {/* Stepper Headers */}
          <div className="wizard-steps-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            {/* Step 1: Partner Finances */}
            <div className={`wizard-step-node ${stepId === 1 ? 'active' : ''} ${stepId > 1 ? 'completed' : ''}`} onClick={() => setEditingEvent({ ...editingEvent, wizardStep: 1 })}>
              <div className="wizard-step-icon">1</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Partner Finances</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 2 ? 'active' : ''}`} />

            {/* Step 2: Changes */}
            <div className={`wizard-step-node ${stepId === 2 ? 'active' : ''} ${stepId > 2 ? 'completed' : ''}`} onClick={() => {
              setEditingEvent({ ...editingEvent, wizardStep: 2 });
            }}>
              <div className="wizard-step-icon">2</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Changes</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 3 ? 'active' : ''}`} />

            {/* Step 3: Budget Preview */}
            <div className={`wizard-step-node ${stepId === 3 ? 'active' : ''} ${stepId > 3 ? 'completed' : ''}`} onClick={() => {
              if (stepId > 3 || stepId === 2) {
                setEditingEvent({ ...editingEvent, wizardStep: 3 });
              }
            }}>
              <div className="wizard-step-icon">3</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Budget Preview</span>
            </div>

            {/* Step 4: Taxes (Only shown if showTaxesStep is true) */}
            {showTaxesStep && (
              <>
                <div className={`wizard-step-divider ${stepId >= 4 ? 'active' : ''}`} />
                <div className={`wizard-step-node ${stepId === 4 ? 'active' : ''} ${stepId > 4 ? 'completed' : ''}`} onClick={() => {
                  if (!isStep3Invalid) {
                    setEditingEvent({ ...editingEvent, wizardStep: 4 });
                  }
                }}>
                  <div className="wizard-step-icon">4</div>
                  <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Taxes</span>
                </div>
              </>
            )}

            <div className={`wizard-step-divider ${stepId === (showTaxesStep ? 5 : 4) ? 'active' : ''}`} />

            {/* Step 5 / 4: Preview */}
            <div className={`wizard-step-node ${stepId === 5 || (!showTaxesStep && stepId === 4) ? 'active' : ''}`} onClick={() => {
              if (!isStep3Invalid) {
                setEditingEvent({ ...editingEvent, wizardStep: showTaxesStep ? 5 : 4 });
              }
            }}>
              <div className="wizard-step-icon">{showTaxesStep ? 5 : 4}</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Preview</span>
            </div>
          </div>

          {/* STEP 1: PARTNER FINANCES */}
          {stepId === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Tell Us About Your Partner</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Marriage can improve or reduce retirement readiness depending on income, assets, debts, taxes, and spending.
                </p>
              </div>

              {/* Basic Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="input-wrapper">
                  <span className="input-name">Marriage Age</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.age}
                    onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || inputs.currentAge })}
                  />
                </div>
                <div className="input-wrapper">
                  <span className="input-name">Spouse Income ($/year)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.spouseIncome}
                    onChange={(e) => setEditingEvent({ ...editingEvent, spouseIncome: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="input-wrapper">
                  <span className="input-name">Savings Rate (%)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.savingsRate}
                    onChange={(e) => setEditingEvent({ ...editingEvent, savingsRate: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Collapsible toggle */}
              <button
                type="button"
                className="list-builder-edit-btn"
                onClick={() => setIsFullPartnerProfileOpen(!isFullPartnerProfileOpen)}
                style={{ width: '100%', margin: '0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', fontSize: '0.8rem' }}
              >
                👤 {isFullPartnerProfileOpen ? 'Hide Full Partner Profile' : 'Show Full Partner Profile'}
              </button>

              {isFullPartnerProfileOpen && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', border: '1px dashed var(--border-color)', padding: '0.85rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', maxHeight: '240px', overflowY: 'auto' }}>
                  <div className="input-wrapper">
                    <span className="input-name">Income Growth Rate (%)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.incomeGrowthRate !== undefined ? editingEvent.incomeGrowthRate : 3}
                      onChange={(e) => setEditingEvent({ ...editingEvent, incomeGrowthRate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Current Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseCurrentAge !== undefined ? editingEvent.spouseCurrentAge : (inputs.currentAge || 30)}
                      onChange={(e) => setEditingEvent({ ...editingEvent, spouseCurrentAge: parseInt(e.target.value) || (inputs.currentAge || 30) })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Desired Retirement Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== null ? editingEvent.spouseDesiredRetirementAge : ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, spouseDesiredRetirementAge: e.target.value !== '' ? parseInt(e.target.value) : '' })}
                      placeholder="e.g. 65 (optional)"
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Life Expectancy</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseLifeExpectancy !== undefined ? editingEvent.spouseLifeExpectancy : (inputs.lifeExpectancy || 85)}
                      onChange={(e) => setEditingEvent({ ...editingEvent, spouseLifeExpectancy: parseInt(e.target.value) || (inputs.lifeExpectancy || 85) })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse SS Claim Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseSocialSecurityAge !== undefined ? editingEvent.spouseSocialSecurityAge : 67}
                      onChange={(e) => setEditingEvent({ ...editingEvent, spouseSocialSecurityAge: parseInt(e.target.value) || 67 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Est. SS Benefit ($/month)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined ? editingEvent.spouseEstimatedSocialSecurityBenefit : 0}
                      onChange={(e) => setEditingEvent({ ...editingEvent, spouseEstimatedSocialSecurityBenefit: parseFloat(e.target.value) || 0 })}
                      placeholder="0 (auto-calculate)"
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Retirement Spending Need ($/year)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.retirementSpendingNeed !== undefined && editingEvent.retirementSpendingNeed !== null ? editingEvent.retirementSpendingNeed : ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, retirementSpendingNeed: e.target.value !== '' ? parseFloat(e.target.value) : '' })}
                      placeholder="optional"
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2', height: '1px', borderBottom: '1px solid var(--border-color)', margin: '0.4rem 0' }} />

                  {/* Assets */}
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Cash Savings ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.cash !== undefined ? editingEvent.cash : 10000}
                      onChange={(e) => setEditingEvent({ ...editingEvent, cash: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Investments ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.investments !== undefined ? editingEvent.investments : 25000}
                      onChange={(e) => setEditingEvent({ ...editingEvent, investments: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Retirement ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.retirement !== undefined ? editingEvent.retirement : 50000}
                      onChange={(e) => setEditingEvent({ ...editingEvent, retirement: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2', height: '1px', borderBottom: '1px solid var(--border-color)', margin: '0.4rem 0' }} />

                  {/* Debts */}
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Student Loans ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.debtStudent !== undefined ? editingEvent.debtStudent : 0}
                      onChange={(e) => setEditingEvent({ ...editingEvent, debtStudent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Credit Cards ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.debtCredit !== undefined ? editingEvent.debtCredit : 0}
                      onChange={(e) => setEditingEvent({ ...editingEvent, debtCredit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Spouse Other Debt ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.debtOther !== undefined ? editingEvent.debtOther : 0}
                      onChange={(e) => setEditingEvent({ ...editingEvent, debtOther: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}

              {/* Live Summary Card */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Live Household Summary</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Combined Income</div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>{formatCurrency(combinedIncome)}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Combined Assets</div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--accent-emerald)' }}>{formatCurrency(combinedAssets)}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Combined Debt</div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--accent-rose)' }}>{formatCurrency(combinedDebt)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: HOUSEHOLD CHANGES */}
          {stepId === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>How Does Life Change After Marriage?</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Adjust partner personal spending, shared housing changes, and lifestyle changes below.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {/* 1. Partner Personal Spending */}
                <div className="input-wrapper">
                  <span className="input-name">Partner Personal Spending ($/month)</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                    Default (70% net): {formatCurrency(defaultPartnerSpendingMonthly)}/mo
                  </span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.spousePersonalSpending !== undefined ? editingEvent.spousePersonalSpending : defaultPartnerSpendingMonthly}
                    onChange={(e) => setEditingEvent({ ...editingEvent, spousePersonalSpending: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {/* 2. Shared Housing Savings / Cost */}
                <div className="input-wrapper">
                  <span className="input-name">Shared Housing Savings / Cost ($/month)</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                    Use negative for savings (e.g. -500), positive for cost
                  </span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ 
                      width: '100%',
                      color: ((editingEvent.housingCost !== undefined ? editingEvent.housingCost : -6000) / 12) < 0 
                        ? '#10b981' 
                        : ((editingEvent.housingCost !== undefined ? editingEvent.housingCost : -6000) / 12) > 0 
                          ? '#f43f5e' 
                          : 'inherit',
                      fontWeight: (editingEvent.housingCost !== undefined ? editingEvent.housingCost : -6000) !== 0 ? 'bold' : 'normal'
                    }}
                    value={(editingEvent.housingCost !== undefined ? editingEvent.housingCost : -6000) / 12}
                    onChange={(e) => setEditingEvent({ ...editingEvent, housingCost: (parseFloat(e.target.value) || 0) * 12 })}
                  />
                </div>

                {/* 3. Shared Lifestyle Spending Change */}
                <div className="input-wrapper">
                  <span className="input-name">Shared Lifestyle Spending Change ($/month)</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                    Use positive for added costs (e.g. travel)
                  </span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ 
                      width: '100%',
                      color: ((editingEvent.lifestyleAdjustment !== undefined ? editingEvent.lifestyleAdjustment : 0) / 12) < 0 
                        ? '#10b981' 
                        : ((editingEvent.lifestyleAdjustment !== undefined ? editingEvent.lifestyleAdjustment : 0) / 12) > 0 
                          ? '#f43f5e' 
                          : 'inherit',
                      fontWeight: (editingEvent.lifestyleAdjustment !== undefined ? editingEvent.lifestyleAdjustment : 0) !== 0 ? 'bold' : 'normal'
                    }}
                    value={(editingEvent.lifestyleAdjustment !== undefined ? editingEvent.lifestyleAdjustment : 0) / 12}
                    onChange={(e) => setEditingEvent({ ...editingEvent, lifestyleAdjustment: (parseFloat(e.target.value) || 0) * 12 })}
                  />
                </div>

                {/* 4. Combined Household Spending */}
                <div className="input-wrapper">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="input-name" style={{ margin: 0 }}>Combined Household Spending</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsBudgetOpenFromMarriageWizard(true);
                        handleSetBudgetClick('workSave');
                      }}
                      className="list-builder-edit-btn"
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', height: '20px', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', margin: 0 }}
                    >
                      📊 Calculate from budget
                    </button>
                  </div>
                  <input
                    type="text"
                    className="input-number-box"
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                    value={`$${combinedSpendingVal.toLocaleString()}/yr ($${Math.round(combinedSpendingVal / 12).toLocaleString()}/mo)`}
                    readOnly
                  />
                </div>
              </div>

              {/* One-time Wedding Cost */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="include-wedding-cost"
                    checked={editingEvent.includeWeddingCost !== undefined ? !!editingEvent.includeWeddingCost : false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, includeWeddingCost: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="include-wedding-cost" className="input-name" style={{ margin: 0, cursor: 'pointer' }}>
                    Include One-time Wedding Cost
                  </label>
                </div>

                {(editingEvent.includeWeddingCost !== undefined ? !!editingEvent.includeWeddingCost : false) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.4rem' }}>
                    <div className="input-wrapper">
                      <span className="input-name">Wedding Cost ($)</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ 
                          width: '100%',
                          color: (editingEvent.weddingCost !== undefined ? editingEvent.weddingCost : 20000) > 0 
                            ? '#f43f5e' 
                            : 'inherit',
                          fontWeight: (editingEvent.weddingCost !== undefined ? editingEvent.weddingCost : 20000) > 0 ? 'bold' : 'normal'
                        }}
                        value={editingEvent.weddingCost !== undefined ? editingEvent.weddingCost : 20000}
                        onChange={(e) => setEditingEvent({ ...editingEvent, weddingCost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Wedding Age</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.weddingAge !== undefined ? editingEvent.weddingAge : editingEvent.age}
                        onChange={(e) => setEditingEvent({ ...editingEvent, weddingAge: parseInt(e.target.value) || editingEvent.age })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: BUDGET PREVIEW */}
          {stepId === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Household Budget Preview</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Here is a preview of your combined monthly household budget.
                </p>
              </div>

              {/* Individual changes grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Partner Monthly Income</div>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>+{formatCurrency(spouseIncome / 12)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Partner Monthly Savings</div>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>-{formatCurrency(partnerSavings / 12)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Household Expense Change</div>
                  <strong style={{ fontSize: '0.9rem', color: (housingCostAmount + lifestyleAdjustmentAmount) <= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {(housingCostAmount + lifestyleAdjustmentAmount) <= 0 ? '-' : '+'}{formatCurrency(Math.abs(housingCostAmount + lifestyleAdjustmentAmount) / 12)}
                  </strong>
                </div>
              </div>

              {/* Combined Monthly Budget Breakdown */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>Combined Monthly Budget</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Monthly Income</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(combinedIncome / 12)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Monthly Savings</span>
                    <strong style={{ color: 'var(--accent-emerald)' }}>-{formatCurrency(combinedSavings)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Monthly Spending</span>
                    <strong style={{ color: 'var(--accent-rose)' }}>-{formatCurrency(combinedSpendingVal / 12)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{leftoverGap >= 0 ? 'Leftover Surplus' : 'Monthly Gap'}</span>
                    <strong style={{ color: leftoverGap >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontSize: '0.95rem' }}>
                      {leftoverGap >= 0 ? '+' : ''}{formatCurrency(leftoverGap)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Warnings & Confirmations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* 1. Low Combined Spending Warning */}
                {combinedSpendingVal <= userSpendingPreRetirement && (
                  <div style={{ border: '1px solid var(--accent-rose)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      id="confirm-zero-spending-preview"
                      checked={isZeroSpendingConfirmed}
                      onChange={(e) => setIsZeroSpendingConfirmed(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', marginTop: '0.1rem' }}
                    />
                    <label htmlFor="confirm-zero-spending-preview" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                      <strong style={{ color: 'var(--accent-rose)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Low Combined Spending</strong>
                      I confirm that combined household spending after marriage is less than or equal to my single spending (meaning my spouse has no additional spending needs).
                    </label>
                  </div>
                )}

                {/* 2. Zero Partner Personal Spending Warning */}
                {partnerPersonalSpending === 0 && (
                  <div style={{ border: '1px solid var(--accent-rose)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      id="confirm-partner-zero-spending"
                      checked={isPartnerZeroSpendingConfirmed}
                      onChange={(e) => setIsPartnerZeroSpendingConfirmed(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', marginTop: '0.1rem' }}
                    />
                    <label htmlFor="confirm-partner-zero-spending" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                      <strong style={{ color: 'var(--accent-rose)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Zero Partner Personal Spending</strong>
                      I confirm that partner personal spending is set to $0/month.
                    </label>
                  </div>
                )}

                {/* 3. Savings Higher Than Surplus Warning */}
                {combinedSavings > surplusMonthly && (
                  <div style={{ border: '1px solid var(--accent-orange, #f59e0b)', backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '0.75rem', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: 0 }}>
                      <strong style={{ color: 'var(--accent-orange, #f59e0b)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Savings Exceed Surplus</strong>
                      Combined savings of {formatCurrency(combinedSavings)}/mo exceed the monthly surplus of {formatCurrency(surplusMonthly)}/mo. This results in a monthly gap of {formatCurrency(combinedSavings - surplusMonthly)}/mo that must be covered by assets.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: TAXES */}
          {stepId === 4 && showTaxesStep && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Tax Filing Status</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Choose how taxes should be filed starting on your marriage date.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', background: editingEvent.filingStatus === 'jointly' ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="marriage-filing-status"
                    checked={editingEvent.filingStatus === 'jointly'}
                    onChange={() => setEditingEvent({ ...editingEvent, filingStatus: 'jointly' })}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.85rem' }}>Married Filing Jointly</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Calculates progressive taxes using Married brackets and a standard deduction of $32,200 (inflated).</span>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', background: editingEvent.filingStatus === 'separately' ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="marriage-filing-status"
                    checked={editingEvent.filingStatus === 'separately'}
                    onChange={() => setEditingEvent({ ...editingEvent, filingStatus: 'separately' })}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.85rem' }}>Married Filing Separately</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Calculates progressive taxes using Single brackets and a standard deduction of $16,100 (inflated).</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 5: PREVIEW */}
          {(stepId === 5 || (!showTaxesStep && stepId === 4)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Marriage Impact Preview</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Compare retirement readiness metrics before and after saving this marriage event.
                </p>
              </div>

              {/* Ready Age Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Before Marriage</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {beforeReadyAge ? `Age ${beforeReadyAge}` : 'Never Ready'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Spending Need: {formatCurrency(beforeSpendingNeed)}/yr
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    People Supported: 1
                  </div>
                </div>
                <div style={{
                  border: '1px solid',
                  borderColor: afterReadyAge && beforeReadyAge && afterReadyAge < beforeReadyAge ? 'var(--accent-emerald)' : afterReadyAge && beforeReadyAge && afterReadyAge > beforeReadyAge ? 'var(--accent-rose)' : 'var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                  textAlign: 'center'
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>After Marriage</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.2rem' }}>
                    {afterReadyAge ? `Age ${afterReadyAge}` : 'Never Ready'}
                  </div>
                  {afterReadyAge && beforeReadyAge && afterReadyAge !== beforeReadyAge && (
                    <div style={{ fontSize: '0.65rem', color: afterReadyAge < beforeReadyAge ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 'bold', marginTop: '0.1rem' }}>
                      {afterReadyAge < beforeReadyAge ? `Ready ${beforeReadyAge - afterReadyAge} years earlier! 🎉` : `Ready ${afterReadyAge - beforeReadyAge} years later`}
                    </div>
                  )}
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Spending Need: {formatCurrency(afterSpendingNeed)}/yr
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    People Supported: 2
                  </div>
                </div>
              </div>

              {/* SWR display */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-0.5rem' }}>
                Retirement target calculated at <strong>{inputs.swr || 4.0}% SWR</strong>.
              </div>

              {/* Improvement Warning */}
              {showImprovementWarning && (
                <div style={{ border: '1px solid var(--accent-rose)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                  <strong style={{ color: 'var(--accent-rose)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Large Readiness Improvement</strong>
                  Check this result: marriage is adding substantial income/assets. Make sure combined spending and spouse retirement needs are included.
                </div>
              )}

              {/* Breakdown Card */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Marriage Impact Breakdown</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Income Added</span>
                    <strong style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(spouseIncome)}/year</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Assets Added</span>
                    <strong style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(spouseAssets)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Debt Added</span>
                    <strong style={{ color: spouseDebt > 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                      {spouseDebt > 0 ? `-${formatCurrency(spouseDebt)}` : '$0'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Spending</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(combinedSpendingVal)}/year</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Spouse Retirement Spending</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(spouseRetSpendingVal)}/year</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>People Supported</span>
                    <strong style={{ color: 'var(--text-primary)' }}>2 Adults</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Net Cash Flow Impact</span>
                    <strong style={{ color: netCashFlowImpact >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {netCashFlowImpact >= 0 ? '+' : ''}{formatCurrency(netCashFlowImpact)}/year
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="list-builder-remove-btn"
              onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}
              style={{ alignSelf: 'center', margin: 0 }}
            >
              Cancel
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {stepId > 1 && (
                <button
                  type="button"
                  className="list-builder-edit-btn"
                  onClick={handleBack}
                  style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1rem' }}
                >
                  Back
                </button>
              )}
              {stepId < (showTaxesStep ? 5 : 4) ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNext}
                  style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1.2rem', fontWeight: 'bold' }}
                  disabled={stepId === 3 && isStep3Invalid}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveEvent}
                  style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1.2rem', fontWeight: 'bold', background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}
                  disabled={isStep3Invalid}
                >
                  Save Marriage Event
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEventForm = (event) => {
    const type = event.type;
    if (type === 'marriage') {
      return renderMarriageWizard();
    }
    return (
      <div className="modal-backdrop" onClick={() => setEditingEvent(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
          {type === 'buyHouse' && '🏠 Buy a House'}
          {type === 'haveChild' && '👶 Have a Child'}
          {type === 'careerChange' && '💼 Career Change'}
          {type === 'move' && '📍 Move / Relocate'}
          {type === 'retire' && '🏖 Schedule Retirement'}
          {type === 'socialSecurity' && '💰 Claim Social Security'}
          {type === 'pension' && '📜 Add Pension'}
          {type === 'rentalIncome' && '🏢 Add Rental Income'}
          {type === 'annuity' && '📈 Add Annuity'}
          {type === 'otherRetirementIncome' && '💵 Add Other Retirement Income'}
          {type === 'windfall' && '💰 Windfall / Inheritance'}
          {type === 'college' && '🎓 College Tuition'}
          {type === 'debtPayoff' && '💸 Debt Payoff Plan'}
          {type === 'custom' && '➕ Custom Life Event'}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* BUY HOUSE FIELDS */}
          {type === 'buyHouse' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Purchase Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.purchaseAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, purchaseAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Home Price ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.homePrice}
                  onChange={(e) => setEditingEvent({ ...editingEvent, homePrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Down Payment ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.downPayment}
                  onChange={(e) => setEditingEvent({ ...editingEvent, downPayment: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {type === 'haveChild' && (
            <>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Child's Name (Optional)</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.childName || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, childName: e.target.value })}
                  placeholder="e.g. Liam"
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Child's Current Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0}
                  onChange={(e) => {
                    const startAge = Math.max(0, Math.min(22, parseInt(e.target.value) || 0));
                    const birthAge = Math.max(0, (inputs.currentAge || 35) - startAge);
                    setEditingEvent({
                      ...editingEvent,
                      childStartAge: startAge,
                      birthAge: birthAge
                    });
                  }}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Parent's Age when Born</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.birthAge !== undefined ? editingEvent.birthAge : inputs.currentAge}
                  onChange={(e) => {
                    const birthAge = Math.max(0, parseInt(e.target.value) || 0);
                    const startAge = Math.max(0, (inputs.currentAge || 35) - birthAge);
                    setEditingEvent({
                      ...editingEvent,
                      birthAge: birthAge,
                      childStartAge: startAge
                    });
                  }}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Cost Estimate Method</span>
                <select
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', padding: '0 0.5rem' }}
                  value={editingEvent.costMethod || 'default'}
                  onChange={(e) => setEditingEvent({ ...editingEvent, costMethod: e.target.value })}
                >
                  <option value="default">Use default estimate</option>
                  <option value="custom">Enter my own estimate</option>
                  <option value="budget">Refine in Budget Builder</option>
                </select>
              </div>

              {(editingEvent.costMethod === 'default' || !editingEvent.costMethod) && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Default Estimate:</div>
                  <ul style={{ paddingLeft: '1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li>Child-Rearing Years (Ages 0–18): {formatCurrency(15000)}/yr</li>
                    {editingEvent.includeCollege && (
                      <li>College / Young Adult Support (Ages 19–22): {formatCurrency(15000)}/yr</li>
                    )}
                  </ul>
                </div>
              )}

              {editingEvent.costMethod === 'custom' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Custom Annual Child Cost ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingEvent({
                        ...editingEvent,
                        customAges0to4: val,
                        customAges5to12: val,
                        customAges13to18: val,
                        customAges19to22: val
                      });
                    }}
                  />
                </div>
              )}

              {editingEvent.costMethod === 'budget' && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(124, 58, 237, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124, 58, 237, 0.15)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  ℹ️ This will save the child event with default estimates. You can then click <strong>Refine Child Costs</strong> or use the <strong>Set Budget</strong> button on your Life Plan dashboard to distribute child costs across specific categories (housing, food, childcare, etc.).
                </div>
              )}

              <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="include-college"
                    checked={!!editingEvent.includeCollege}
                    onChange={(e) => setEditingEvent({ ...editingEvent, includeCollege: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="include-college" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Include College / Young Adult Support (Ages 19–22)
                  </label>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.55rem', display: 'block' }}>
                  Adds an additional <strong>{formatCurrency(editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : 15000)}/yr</strong> per child from age 19 to 22.
                </span>
              </div>
            </>
          )}

          {/* CAREER CHANGE FIELDS */}
          {type === 'careerChange' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Job Title / Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Change Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">New Annual Income ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Raise / Growth Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.growthRate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, growthRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* MOVE FIELDS */}
          {type === 'move' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Where? (Location Name)</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.location}
                  placeholder="e.g. Dominican Republic"
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Moving Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.moveAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, moveAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">New Annual Spending ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.newSpending}
                  onChange={(e) => setEditingEvent({ ...editingEvent, newSpending: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* RETIRE FIELDS */}
          {type === 'retire' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Retirement Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.age}
                  onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Spending Replacement Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.spendingPercent !== undefined ? editingEvent.spendingPercent : 70}
                  onChange={(e) => setEditingEvent({ ...editingEvent, spendingPercent: parseInt(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* SOCIAL SECURITY FIELDS */}
          {/* RETIREMENT INCOME FIELDS (Social Security, Pension, Rental, Annuity, Other Income) */}
          {['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type) && (
            <>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Income Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">
                  {type === 'socialSecurity' ? 'Claiming Age' : 'Start Age'}
                </span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65)}
                  onChange={(e) => setEditingEvent({ ...editingEvent, claimingAge: parseInt(e.target.value) || 62, startAge: parseInt(e.target.value) || 62, age: parseInt(e.target.value) || 62 })}
                />
              </div>
              {type === 'socialSecurity' && editingEvent.useEarnings === true && (
                <div className="input-wrapper">
                  <span className="input-name">Age Started Working</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.ageStartedWorking !== undefined ? editingEvent.ageStartedWorking : 22}
                    onChange={(e) => setEditingEvent({ ...editingEvent, ageStartedWorking: parseInt(e.target.value) || 22 })}
                  />
                </div>
              )}
              {(!editingEvent.useEarnings || type !== 'socialSecurity') ? (
                <div className="input-wrapper">
                  <span className="input-name">Monthly Amount ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 1000}
                    onChange={(e) => setEditingEvent({ ...editingEvent, monthlyBenefit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              ) : (
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Estimated Monthly Amount ($)</span>
                  <div style={{ 
                    height: '2.5rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '0 0.75rem', 
                    background: 'var(--bg-primary, #111827)', 
                    borderRadius: 'var(--radius-sm, 6px)', 
                    border: '1px solid var(--border-color, #374151)', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold', 
                    color: tempSocialSecurityDetails?.isEligible ? 'var(--text-primary)' : 'var(--accent-rose, #f43f5e)'
                  }}>
                    <span>
                      {tempSocialSecurityDetails?.isEligible 
                        ? formatCurrency(tempSocialSecurityDetails.annualBenefit / 12) 
                        : '$0 (Not Eligible)'}
                    </span>
                    {tempSocialSecurityDetails?.isEligible && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-tertiary)' }}>
                        ({formatCurrency((tempSocialSecurityDetails.annualBenefit / 12) * Math.pow(1 + (Number(inputs.inflationRate || 3) / 100), tempSocialSecurityDetails.claimAge - (Number(inputs.currentAge) || 35)))}/mo in future nominal dollars at age {tempSocialSecurityDetails.claimAge})
                      </span>
                    )}
                  </div>
                </div>
              )}
              {type === 'socialSecurity' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <label htmlFor="ret-use-earnings" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Calculate from earning years
                  </label>
                  <input
                    type="checkbox"
                    id="ret-use-earnings"
                    checked={editingEvent.useEarnings === true}
                    onChange={(e) => setEditingEvent({ ...editingEvent, useEarnings: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </div>
              )}
              {type !== 'socialSecurity' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <label htmlFor="ret-inflation-adj" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Inflation Adjusted (increases with cost of living)
                  </label>
                  <input
                    type="checkbox"
                    id="ret-inflation-adj"
                    checked={editingEvent.inflationAdjusted !== false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, inflationAdjusted: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </div>
              )}
              {type === 'socialSecurity' && (
                <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                  💡 Calculated in Today's Dollars (purchasing power). In future dollars (nominal mode), the benefit is adjusted for inflation (currently {Number(inputs.inflationRate || 3)}% yearly) starting from your current age.
                </div>
              )}
            </>
          )}

          {/* WINDFALL FIELDS */}
          {type === 'windfall' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Age Received</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.ageReceived}
                  onChange={(e) => setEditingEvent({ ...editingEvent, ageReceived: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Amount ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Tax Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.taxRate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, taxRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* COLLEGE FIELDS */}
          {type === 'college' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Start Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Annual Tuition Cost ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.tuitionCost}
                  onChange={(e) => setEditingEvent({ ...editingEvent, tuitionCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Duration (years)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.duration}
                  onChange={(e) => setEditingEvent({ ...editingEvent, duration: parseInt(e.target.value) || 4 })}
                />
              </div>
            </>
          )}

          {/* DEBT PAYOFF FIELDS */}
          {type === 'debtPayoff' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Payoff Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.payoffAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, payoffAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Payoff Amount ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* CUSTOM FIELDS */}
          {type === 'custom' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Event Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.age}
                  onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Cash Flow ($: negative for cost)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setEditingEvent(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveEvent}
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  );
  };
  
  const renderCurrentConditionsList = () => {
    const list = inputs.currentConditions || [];
    if (list.length === 0) {
      return (
        <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
          No current conditions added yet. Start by adding items that are already true today.
        </div>
      );
    }

    const getTypeIcon = (c) => {
      if (c.type === 'debt') {
        if (c.subtype === 'studentLoan') return '🎓';
        if (c.subtype === 'creditCard') return '💳';
        if (c.subtype === 'carLoan') return '🚗';
        return '💳';
      }
      switch (c.type) {
        case 'checkingSavings': return '💰';
        case 'brokerage': return '📈';
        case 'retirement': return '🛡️';
        case 'asset': return '💎';
        case 'house': return '🏠';
        case 'child': return '👶';
        case 'obligation': return '📄';
        default: return '❓';
      }
    };

    const getTypeLabel = (c) => {
      if (c.type === 'debt') {
        if (c.subtype === 'studentLoan') return 'Student Loan';
        if (c.subtype === 'creditCard') return 'Credit Card';
        if (c.subtype === 'carLoan') return 'Car Loan';
        return 'Debt';
      }
      if (c.type === 'checkingSavings') return 'Cash';
      if (c.type === 'brokerage') return 'Investment Account';
      const labels = {
        house: 'House',
        child: 'Child',
        obligation: 'Obligation',
        retirement: 'Retirement Account',
        asset: 'Asset'
      };
      return labels[c.type] || c.type;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
        {list.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{getTypeIcon(c)}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{c.name || getTypeLabel(c)}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{getTypeLabel(c)}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
                {c.type !== 'child' && c.type !== 'obligation' && (
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(c.value)}
                  </strong>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {c.monthlyAmount > 0 ? (
                    ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type) ? (
                      <span style={{ color: 'var(--primary-light)' }}>+{formatCurrency(c.monthlyAmount)}/mo</span>
                    ) : (
                      <span style={{ color: 'var(--accent-rose)' }}>-{formatCurrency(c.monthlyAmount)}/mo</span>
                    )
                  ) : null}
                  {c.rate > 0 && ` (${c.rate}% ${c.type === 'debt' ? 'interest' : c.type === 'house' ? 'appr.' : 'growth'})`}
                </span>
                {c.endAge && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                    Ends at age {c.endAge}
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="list-builder-edit-btn"
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                  onClick={() => setEditingCondition(c)}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="list-builder-edit-btn"
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: 'var(--accent-rose)' }}
                  onClick={() => handleRemoveCurrentCondition(c.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCurrentConditionModal = () => {
    if (!editingCondition) return null;
    const type = editingCondition.type;
    const isAssetType = ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(type);
    
    // Choose labels and descriptions based on type
    let valueLabel = "Current Balance / Value ($)";
    let amountLabel = "Monthly Contribution ($/mo)";
    let amountDesc = "How much you save/invest into this account each month.";
    let rateLabel = "Annual Growth Rate (%)";
    let rateDesc = "Expected annual growth rate (before inflation).";

    if (type === 'checkingSavings') {
      amountLabel = "Monthly Savings ($/mo)";
      amountDesc = "Additional monthly savings added to this account.";
      rateLabel = "Interest Rate (%)";
      rateDesc = "Annual interest rate earned.";
    } else if (type === 'retirement') {
      amountLabel = "Monthly Contribution ($/mo)";
      amountDesc = "Pre-tax or post-tax contribution to this account.";
    } else if (type === 'debt') {
      valueLabel = "Current Outstanding Balance ($)";
      amountLabel = "Monthly Payment ($/mo)";
      amountDesc = "Minimum or standard monthly payment.";
      rateLabel = "Interest Rate (%)";
      rateDesc = "Annual interest rate on the debt.";
    } else if (type === 'house') {
      valueLabel = "Current Home Value ($)";
      amountLabel = "Monthly Cost ($/mo)";
      amountDesc = "Mortgage, taxes, maintenance, and insurance monthly total.";
      rateLabel = "Annual Appreciation Rate (%)";
      rateDesc = "Expected annual appreciation rate.";
    } else if (type === 'child') {
      valueLabel = "Not Applicable";
      amountLabel = "Monthly Cost ($/mo)";
      amountDesc = "Childcare, schooling, and general monthly expenses.";
      rateLabel = "Annual Cost Inflation (%)";
      rateDesc = "Optional: custom inflation rate for child costs.";
    } else if (type === 'obligation') {
      valueLabel = "Not Applicable";
      amountLabel = "Monthly Cost ($/mo)";
      amountDesc = "Monthly cost for this obligation.";
      rateLabel = "Annual Cost Inflation (%)";
      rateDesc = "Optional: custom inflation rate for this obligation.";
    }

    return (
      <div className="modal-backdrop" onClick={() => setEditingCondition(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '90%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
              {editingCondition.id ? '✏️ Edit Current Condition' : '📋 Add Current Condition'}
            </h3>
            <button 
              type="button" 
              onClick={() => setEditingCondition(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.15rem' }}
            >
              ✖
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Type Selector */}
            <div className="input-wrapper">
              <span className="input-name">Category Type</span>
              <select
                className="input-number-box"
                style={{ width: '100%', padding: '0.35rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                value={(() => {
                  if (editingCondition.type === 'debt') {
                    if (editingCondition.subtype) return editingCondition.subtype;
                    const nameLower = (editingCondition.name || '').toLowerCase();
                    if (nameLower.includes('student')) return 'studentLoan';
                    if (nameLower.includes('credit')) return 'creditCard';
                    if (nameLower.includes('car')) return 'carLoan';
                    return 'studentLoan';
                  }
                  return editingCondition.type;
                })()}
                onChange={(e) => {
                  const val = e.target.value;
                  let type = val;
                  let subtype = '';
                  if (['studentLoan', 'creditCard', 'carLoan'].includes(val)) {
                    type = 'debt';
                    subtype = val;
                  }
                  const currentAge = inputs.currentAge || 35;
                  const defaults = getDefaultValuesForType(val, currentAge);
                  setEditingCondition({
                    ...editingCondition,
                    type,
                    subtype,
                    name: defaults.name,
                    value: defaults.value,
                    monthlyAmount: defaults.monthlyAmount,
                    rate: defaults.rate,
                    notes: defaults.notes,
                    startAge: defaults.startAge,
                    endAge: defaults.endAge
                  });
                }}
              >
                <option value="house">🏠 House</option>
                <option value="child">👶 Child</option>
                <option value="studentLoan">🎓 Student Loan</option>
                <option value="creditCard">💳 Credit Card</option>
                <option value="carLoan">🚗 Car Loan</option>
              </select>
            </div>

            {/* Name */}
            <div className="input-wrapper">
              <span className="input-name">Name</span>
              <input
                type="text"
                className="input-number-box"
                style={{ width: '100%', textAlign: 'left' }}
                placeholder="e.g. Chase HYSA, Car Payment, Leo, etc."
                value={editingCondition.name}
                onChange={(e) => setEditingCondition({ ...editingCondition, name: e.target.value })}
              />
            </div>

            {/* Value/Balance (if applicable) */}
            {type !== 'child' && type !== 'obligation' && (
              <div className="input-wrapper">
                <span className="input-name">{valueLabel}</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingCondition.value || 0}
                  onChange={(e) => setEditingCondition({ ...editingCondition, value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {/* Monthly Cost/Contribution */}
            <div className="input-wrapper">
              <span className="input-name">{amountLabel}</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingCondition.monthlyAmount || 0}
                onChange={(e) => setEditingCondition({ ...editingCondition, monthlyAmount: parseFloat(e.target.value) || 0 })}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{amountDesc}</span>
            </div>

            {/* Growth Rate / Interest Rate */}
            <div className="input-wrapper">
              <span className="input-name">{rateLabel}</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingCondition.rate || 0}
                onChange={(e) => setEditingCondition({ ...editingCondition, rate: parseFloat(e.target.value) || 0 })}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{rateDesc}</span>
            </div>

            {/* Start Age (Readonly) */}
            <div className="input-wrapper">
              <span className="input-name">Starts at Age (Current Age)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: 'var(--text-tertiary)' }}
                value={inputs.currentAge || 35}
                disabled
              />
            </div>

            {/* End Age (Optional) */}
            <div className="input-wrapper">
              <span className="input-name">End Age (Optional)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                placeholder="e.g. 50 (lasts until age 50, empty if lifetime)"
                value={editingCondition.endAge || ''}
                onChange={(e) => setEditingCondition({ ...editingCondition, endAge: e.target.value ? parseInt(e.target.value) || null : '' })}
              />
            </div>

            {/* Notes/Assumptions */}
            <div className="input-wrapper">
              <span className="input-name">Notes / Assumptions</span>
              <textarea
                className="input-number-box"
                style={{ width: '100%', minHeight: '60px', textAlign: 'left', padding: '0.45rem' }}
                placeholder="Any special notes or assumptions for this condition."
                value={editingCondition.notes || ''}
                onChange={(e) => setEditingCondition({ ...editingCondition, notes: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="list-builder-edit-btn"
              style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              onClick={() => setEditingCondition(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveCurrentCondition}
            >
              Save Condition
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSavingsDetailsModal = () => {
    const totalDetails = Object.values(savingsDetails).reduce((sum, val) => sum + val, 0);

    return (
      <div className="modal-backdrop" onClick={() => setIsSavingsDetailsOpen(false)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
              🎯 Current Savings Breakdown
            </h3>
            <button 
              type="button" 
              onClick={() => setIsSavingsDetailsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.15rem' }}
            >
              ✖
            </button>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.45', textAlign: 'left' }}>
            Specify the starting balances for each of your savings and investment accounts below.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { key: 'cash', label: 'Cash / Checking Balance' },
              { key: 'emergencyFund', label: 'HYSA / Emergency Fund' },
              { key: 'brokerage', label: 'Taxable Brokerage' },
              { key: 'trad401k', label: 'Pre-Tax 401(k) / 403(b)' },
              { key: 'tradIra', label: 'Traditional IRA' },
              { key: 'rothIra', label: 'Roth IRA / Roth 401(k)' },
              { key: 'hsa', label: 'Health Savings Account (HSA)' },
              { key: 'other', label: 'Other Assets / Accounts' }
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span className="input-name" style={{ fontSize: '0.85rem' }}>{item.label}</span>
                <div className="input-prefix-wrapper" style={{ width: '130px' }}>
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%', textAlign: 'right', padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                    value={savingsDetails[item.key] || 0}
                    onChange={(e) => setSavingsDetails({
                      ...savingsDetails,
                      [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                    })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Savings:</span>
              <strong style={{ fontSize: '1rem', color: 'var(--primary)', marginLeft: '0.35rem' }}>
                {formatCurrency(totalDetails)}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                onClick={() => setIsSavingsDetailsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                onClick={handleSaveSavingsDetails}
              >
                Save Details
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderBudgetModal = () => {
    const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled) || (isBudgetOpenFromMarriageWizard ? editingEvent : null);
    const isMarriedMode = !!marriageEvent;
    const partnerMonthlyIncome = isMarriedMode ? Math.round(Number(marriageEvent.spouseIncome || 0) / 12) : 0;
    const combinedIncome = isMarriedMode ? (budgetMonthlyIncome + partnerMonthlyIncome) : budgetMonthlyIncome;

    const totalExpensesMonthly = Object.values(budgetExpenses).reduce((sum, val) => sum + val, 0);
    const surplusMonthly = Math.max(0, combinedIncome - totalExpensesMonthly);

    const totalUserAllocationPct = Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);
    const totalPartnerAllocationPct = isMarriedMode ? Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0) : 0;
    const totalAllocationPct = totalUserAllocationPct + totalPartnerAllocationPct;

    const currentAgeVal = Number(inputs.currentAge) || 30;
    const targetRetAgeVal = Number(inputs.targetRetirementAge) || 65;

    // Get normalized phases
    const normalizedPhases = getNormalizedPhases(inputs);
    const activePhaseObj = normalizedPhases.find(p => p.id === activeBudgetPhase) || normalizedPhases[0];
    const isRetirementPhase = activePhaseObj?.type === 'retire';

    let activeC = activePhaseObj?.childCount || 0;
    let activeChildBoost = 0;
    if (activeC > 0 && activePhaseObj) {
      const rawIncomeItem = (inputs.incomeList || []).find(inc => 
        activePhaseObj.startAge >= inc.startAge && 
        activePhaseObj.startAge < inc.endAge && 
        inc.id !== 'simple-inc-childcare' && 
        !inc.id.startsWith('simple-inc-childcare-') && 
        inc.id !== 'simple-inc-worksave' && 
        !inc.id.startsWith('simple-inc-worksave-') &&
        inc.id !== 'simple-inc-prechild' &&
        !inc.id.startsWith('simple-inc-prechild-') &&
        !inc.id.startsWith('child-income-boost')
      );
      let baseSalaryMonthly = 0;
      if (rawIncomeItem) {
        baseSalaryMonthly = Math.round(rawIncomeItem.frequency === 'monthly' ? Number(rawIncomeItem.amount) : Number(rawIncomeItem.amount) / 12);
      } else {
        baseSalaryMonthly = Math.round((Number(inputs.simpleIncome) || 50000) / 12);
      }
      activeChildBoost = Math.max(0, budgetMonthlyIncome - baseSalaryMonthly);
    }

    let currentChildCostsMonthly = 0;
    if (activeC > 0 && activePhaseObj) {
      currentChildCostsMonthly = activeC * 1250;
    }
    const surplusWithChild = Math.max(0, combinedIncome - totalExpensesMonthly - currentChildCostsMonthly);

    const est401kMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.trad401k || 0) / 100)) 
      : (budgetSavings.trad401k || 0);
    const estTradIraMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.tradIra || 0) / 100)) 
      : (budgetSavings.tradIra || 0);
    const estRothIraMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.rothIra || 0) / 100)) 
      : (budgetSavings.rothIra || 0);
    const estHsaMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.hsa || 0) / 100)) 
      : (budgetSavings.hsa || 0);

    const capped401k = Math.min(23500, est401kMonthly * 12);
    const cappedTradIra = Math.min(7000, estTradIraMonthly * 12);
    const cappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estHsaMonthly * 12);
    let preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;

    let partnerCapped401k = 0;
    let partnerCappedTradIra = 0;
    let partnerCappedHsa = 0;
    if (isMarriedMode) {
      const estPartner401k = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.trad401k || 0) / 100)) : (budgetPartnerSavings.trad401k || 0);
      const estPartnerTradIra = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.tradIra || 0) / 100)) : (budgetPartnerSavings.tradIra || 0);
      const estPartnerHsa = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.hsa || 0) / 100)) : (budgetPartnerSavings.hsa || 0);

      partnerCapped401k = Math.min(23500, estPartner401k * 12);
      partnerCappedTradIra = Math.min(7000, estPartnerTradIra * 12);
      partnerCappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estPartnerHsa * 12);
      preTaxDeductionsAnnual += partnerCapped401k + partnerCappedTradIra + partnerCappedHsa;
    }

    const filingStatusForModal = isMarriedMode ? (marriageEvent.filingStatus || 'jointly') : budgetFilingStatus;
    const annualTax = inputs.includeTaxes
      ? calculateUSTaxForModal(combinedIncome * 12, preTaxDeductionsAnnual, filingStatusForModal)
      : 0;
    const monthlyTax = Math.round(annualTax / 12);
    
    const userSavingsMonthly = savingsAllocMode === 'percentSurplus'
      ? Math.round(surplusMonthly * (totalUserAllocationPct / 100))
      : Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);

    const partnerSavingsMonthly = isMarriedMode 
      ? (savingsAllocMode === 'percentSurplus'
         ? Math.round(surplusMonthly * (totalPartnerAllocationPct / 100))
         : Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0))
      : 0;

    const combinedSavingsMonthly = userSavingsMonthly + partnerSavingsMonthly;
    const totalSavingsMonthly = combinedSavingsMonthly;
    const activeSavings = combinedSavingsMonthly;
    const activeSpending = totalExpensesMonthly > 0 ? totalExpensesMonthly : budgetMonthlySpending;
    
    const remainingMonthly = savingsAllocMode === 'percentSurplus'
      ? 100 - totalAllocationPct
      : combinedIncome - activeSavings - activeSpending - monthlyTax;
    
    const childAdjustedSavings = combinedSavingsMonthly;
    const netRemaining = combinedIncome - childAdjustedSavings - activeSpending - currentChildCostsMonthly - monthlyTax;
    
    const handleAllocateRemaining = (categoryKey) => {
      setBudgetSavings(prev => ({
        ...prev,
        [categoryKey]: Math.max(0, (prev[categoryKey] || 0) + remainingMonthly)
      }));
    };
    
    const handleAdjustGrossIncome = () => {
      setBudgetMonthlyIncome(Math.max(0, activeSavings + activeSpending + currentChildCostsMonthly + monthlyTax - partnerMonthlyIncome));
    };

    const handleAutoReduceSavingsToBalance = () => {
      const priority = ['brokerage', 'other', 'checking', 'hysa', 'emergency', 'rothIra', 'tradIra', 'hsa', 'trad401k', 'debt', 'cash'];
      const newSavings = { ...budgetSavings };
      const newPartnerSavings = { ...budgetPartnerSavings };

      if (savingsAllocMode === 'percentSurplus') {
        let pctDeficit = totalAllocationPct - 100;
        if (pctDeficit <= 0) return;
        
        if (isMarriedMode) {
          for (const key of priority) {
            const val = newPartnerSavings[key] || 0;
            if (val > 0) {
              const reduceAmount = Math.min(val, pctDeficit);
              newPartnerSavings[key] = Math.max(0, parseFloat((val - reduceAmount).toFixed(4)));
              pctDeficit -= reduceAmount;
              if (pctDeficit <= 0) break;
            }
          }
        }
        if (pctDeficit > 0) {
          for (const key of priority) {
            const currentVal = newSavings[key] || 0;
            if (currentVal > 0) {
              const reduceAmount = Math.min(currentVal, pctDeficit);
              newSavings[key] = Math.max(0, parseFloat((currentVal - reduceAmount).toFixed(4)));
              pctDeficit -= reduceAmount;
              if (pctDeficit <= 0) break;
            }
          }
        }
        setBudgetSavings(newSavings);
        if (isMarriedMode) setBudgetPartnerSavings(newPartnerSavings);
      } else {
        let deficitAmount = Math.abs(netRemaining);
        if (deficitAmount <= 0) return;

        if (isMarriedMode) {
          for (const key of priority) {
            const val = newPartnerSavings[key] || 0;
            if (val > 0) {
              const reduceAmount = Math.min(val, deficitAmount);
              newPartnerSavings[key] = Math.max(0, Math.round(val - reduceAmount));
              deficitAmount -= reduceAmount;
              if (deficitAmount <= 0) break;
            }
          }
        }
        if (deficitAmount > 0) {
          for (const key of priority) {
            const currentVal = newSavings[key] || 0;
            if (currentVal > 0) {
              const reduceAmount = Math.min(currentVal, deficitAmount);
              newSavings[key] = Math.max(0, Math.round(currentVal - reduceAmount));
              deficitAmount -= reduceAmount;
              if (deficitAmount <= 0) break;
            }
          }
        }
        setBudgetSavings(newSavings);
        if (isMarriedMode) setBudgetPartnerSavings(newPartnerSavings);
      }
    };

    const handleClearDetailedSavings = () => {
      setBudgetSavings({
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
        checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      });
      setBudgetMonthlySavings(0);
    };

    const handleClearDetailedExpenses = () => {
      setBudgetExpenses({
        housing: 0, utilities: 0, food: 0, transportation: 0, healthcare: 0, leisure: 0, misc: 0
      });
    };

    const handleMonthlyIncomeChange = (val) => {
      const newIncome = Math.max(0, val);
      setBudgetMonthlyIncome(newIncome);

      if (totalSavingsMonthly === 0) {
        setBudgetMonthlySavings(Math.max(0, newIncome - activeSpending));
      } else if (totalExpensesMonthly === 0) {
        setBudgetMonthlySpending(Math.max(0, newIncome - totalSavingsMonthly));
      }
    };

    const handleMonthlySpendingChange = (val) => {
      const newSpending = Math.max(0, val);
      setBudgetMonthlySpending(newSpending);
      if (totalSavingsMonthly === 0) {
        setBudgetMonthlySavings(Math.max(0, budgetMonthlyIncome - newSpending));
      }
    };

    const handleMonthlySavingsChange = (val) => {
      const newSavings = Math.max(0, val);
      setBudgetMonthlySavings(newSavings);
      if (totalExpensesMonthly === 0) {
        setBudgetMonthlySpending(Math.max(0, budgetMonthlyIncome - newSavings));
      }
    };

    let targetSavingsRate = null;
    if (pendingImprovement) {
      const { scenario, originalInputs } = pendingImprovement;
      const currentIncome = Number(originalInputs.simpleIncome) || 0;
      const currentExpenses = Number(originalInputs.simpleExpenses) || 0;
      const currentSavingsRate = currentIncome > 0 ? Math.round((1 - currentExpenses / currentIncome) * 100) : 0;
      
      if (scenario.type === 'savings' || scenario.type === 'retireRequestedDate' || (scenario.type === 'retire65' && scenario.value > 0)) {
        const savingsPercent = currentIncome > 0 ? (scenario.value / currentIncome) * 100 : 0;
        targetSavingsRate = currentSavingsRate + savingsPercent;
      } else if (scenario.type === 'retireReadyAge' || scenario.type === 'retire65') {
        targetSavingsRate = currentSavingsRate;
      } else if (scenario.type === 'combined') {
        const savingsPercent = scenario.value && typeof scenario.value === 'object' 
          ? (currentIncome > 0 ? (scenario.value.savings / currentIncome) * 100 : 0) 
          : 0;
        targetSavingsRate = currentSavingsRate + savingsPercent;
      } else if (scenario.type === 'income') {
        const grossIncrease = scenario.value;
        const netSavingsIncrease = scenario.netSavingsValue || 0;
        const newIncome = currentIncome + grossIncrease;
        const newSavings = Math.max(0, currentIncome - currentExpenses) + netSavingsIncrease;
        targetSavingsRate = newIncome > 0 ? Math.round((newSavings / newIncome) * 100) : 0;
      }
    }

    const activeSavingsRate = budgetMonthlyIncome > 0 
      ? Math.round((activeSavings / budgetMonthlyIncome) * 100) 
      : 0;

    let modalTitle = 'Work Phase Budget';
    if (activePhaseObj) {
      if (activePhaseObj.type === 'careerChange') {
        modalTitle = 'Career Change Budget';
      } else if (activePhaseObj.type === 'marriage') {
        modalTitle = 'Marriage Phase Budget';
      } else if (activePhaseObj.type === 'divorce') {
        modalTitle = 'Divorce Phase Budget';
      } else if (activePhaseObj.type === 'childcare') {
        modalTitle = `Childcare Phase Budget (${activePhaseObj.childCount} Child${activePhaseObj.childCount === 1 ? '' : 'ren'})`;
      } else if (activePhaseObj.type === 'move') {
        modalTitle = `Move Phase Budget (${activePhaseObj.name})`;
      } else if (activePhaseObj.type === 'buyHouse') {
        modalTitle = `Home Purchase Phase Budget (${activePhaseObj.name})`;
      } else if (activePhaseObj.type === 'retire') {
        modalTitle = activePhaseObj.childCount > 0 ? 'Retirement Childcare Phase Budget' : 'Retirement Phase Budget';
      } else {
        modalTitle = 'Work Phase Budget';
      }
    }

    return (
      <div className="modal-backdrop" onClick={handleCloseBudgetModal}>
        <style>{`
          @keyframes budgetGlow {
            0% { background: rgba(124, 58, 237, 0); box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
            50% { background: rgba(124, 58, 237, 0.08); box-shadow: 0 0 8px 1px rgba(124, 58, 237, 0.25); }
            100% { background: rgba(124, 58, 237, 0); box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
          }
          .budget-row-glow {
            animation: budgetGlow 2.5s infinite ease-in-out;
          }
        `}</style>
        <div className="budget-modal-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', display: 'flex', flexDirection: 'column' }}>
          <div className="budget-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
              🎯 {modalTitle} {activePhaseObj && `(${activePhaseObj.startAge}-${activePhaseObj.endAge})`}
            </h3>
            <button 
              type="button" 
              onClick={handleCloseBudgetModal}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.15rem' }}
            >
              ✖
            </button>
          </div>
          
          {pendingImprovement && (
            <div style={{
              background: 'rgba(124, 58, 237, 0.08)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ color: '#c084fc', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                💡 Applying Recommendation: {pendingImprovement.scenario.title}
              </span>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                This scenario changes your monthly budget targets (recommended adjustment: <strong>{pendingImprovement.scenario.savingsFocus}</strong>). 
                We have updated the gross salary and target savings, but your detailed allocations need to be aligned. Please review and adjust the categories below, then click <strong>Save Budget</strong> to apply the scenario.
              </p>
            </div>
          )}

          {normalizedPhases.length > 1 && (
            <div className="segmented-control-container" style={{ margin: '0 0 1.25rem 0', width: '100%', overflowX: 'auto' }}>
              <div className="segmented-control" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px', display: 'flex', width: 'max-content', gap: '4px' }}>
                {normalizedPhases.map((phase) => {
                  const isActive = activeBudgetPhase === phase.id;
                  return (
                    <button
                      key={phase.id}
                      type="button"
                      className={`segmented-control-btn ${isActive ? 'active' : ''}`}
                      style={{
                        fontSize: '0.78rem',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        background: isActive ? 'var(--primary)' : 'transparent',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => handleSwitchBudgetPhase(phase.id)}
                    >
                      <span>{phase.icon}</span>
                      <span>{phase.name.split(':')[0]} ({phase.startAge}-{phase.endAge})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Top Parameters */}
          {isMarriedMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              {/* User Income */}
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <span className="input-name" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', width: '100%' }}>
                  User Income ($)
                  {activeC > 0 && activeChildBoost > 0 && (
                    <span style={{ 
                      marginLeft: 'auto', 
                      fontSize: '0.65rem', 
                      padding: '0.1rem 0.35rem', 
                      background: 'rgba(245, 158, 11, 0.15)', 
                      border: '1px solid rgba(245, 158, 11, 0.35)', 
                      borderRadius: '4px', 
                      color: '#f59e0b',
                      fontWeight: '700'
                    }}>
                      +{formatCurrency(activeChildBoost)}/mo child boost
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ 
                    width: '100%', 
                    fontSize: '0.9rem', 
                    padding: '0.35rem 0.5rem',
                  }}
                  value={budgetMonthlyIncome}
                  onChange={(e) => handleMonthlyIncomeChange(parseFloat(e.target.value) || 0)}
                  disabled={isRetirementPhase}
                />
                {activePhaseObj && activePhaseObj.incomeGrowthRate > 0 && !isRetirementPhase && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.2rem', display: 'block' }}>
                    📈 Income grows {(activePhaseObj.incomeGrowthRate * 100).toFixed(1)}%/yr
                  </span>
                )}
              </div>

              {/* Partner Income */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.35rem 0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Partner Income</span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--accent-emerald)', marginTop: '0.25rem' }}>
                  +{formatCurrency(partnerMonthlyIncome)}/mo
                </strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                  ({formatCurrency(marriageEvent.spouseIncome || 0)}/yr)
                </span>
              </div>

              {/* Combined Income */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.35rem 0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Combined Income</span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {formatCurrency(combinedIncome)}/mo
                </strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                  ({formatCurrency(combinedIncome * 12)}/yr)
                </span>
              </div>

              {/* Combined Spending */}
              <div className="input-wrapper">
                <span className="input-name" style={{ fontSize: '0.8rem' }}>Combined Spending ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ 
                    width: '100%', 
                    fontSize: '0.9rem', 
                    padding: '0.35rem 0.5rem',
                    opacity: totalExpensesMonthly > 0 ? 0.6 : 1,
                    cursor: totalExpensesMonthly > 0 ? 'not-allowed' : 'auto',
                    borderColor: 'rgba(244, 63, 94, 0.35)'
                  }}
                  disabled={totalExpensesMonthly > 0}
                  value={totalExpensesMonthly > 0 ? totalExpensesMonthly : budgetMonthlySpending}
                  onChange={(e) => handleMonthlySpendingChange(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Combined Savings */}
              <div className="input-wrapper">
                <span className="input-name" style={{ fontSize: '0.8rem' }}>Combined Savings ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ 
                    width: '100%', 
                    fontSize: '0.9rem', 
                    padding: '0.35rem 0.5rem',
                    opacity: (savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase) ? 0.6 : 1,
                    cursor: (savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase) ? 'not-allowed' : 'auto',
                    borderColor: 'rgba(16, 185, 129, 0.35)'
                  }}
                  disabled={savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase}
                  value={isRetirementPhase ? 0 : (savingsAllocMode === 'percentSurplus' ? totalSavingsMonthly : (totalSavingsMonthly > 0 ? totalSavingsMonthly : budgetMonthlySavings))}
                  onChange={(e) => handleMonthlySavingsChange(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Savings Rate Card */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.5rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Household Savings Rate</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--accent-emerald)', marginTop: '0.15rem' }}>
                  {activeSavingsRate}%
                </strong>
                {targetSavingsRate !== null && (
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                    Target: {targetSavingsRate}%
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              
              {/* Monthly Take-home Income */}
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <span className="input-name" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', width: '100%' }}>
                  Monthly Take-home Income ($)
                  {activeC > 0 && activeChildBoost > 0 && (
                    <span style={{ 
                      marginLeft: 'auto', 
                      fontSize: '0.65rem', 
                      padding: '0.1rem 0.35rem', 
                      background: 'rgba(245, 158, 11, 0.15)', 
                      border: '1px solid rgba(245, 158, 11, 0.35)', 
                      borderRadius: '4px', 
                      color: '#f59e0b',
                      fontWeight: '700'
                    }}>
                      +{formatCurrency(activeChildBoost)}/mo child boost
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ 
                    width: '100%', 
                    fontSize: '0.9rem', 
                    padding: '0.35rem 0.5rem',
                  }}
                  value={budgetMonthlyIncome}
                  onChange={(e) => handleMonthlyIncomeChange(parseFloat(e.target.value) || 0)}
                  disabled={isRetirementPhase}
                />
                {activePhaseObj && activePhaseObj.incomeGrowthRate > 0 && !isRetirementPhase && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.2rem', display: 'block' }}>
                    📈 Income grows {(activePhaseObj.incomeGrowthRate * 100).toFixed(1)}%/yr
                  </span>
                )}
              </div>

              {/* Monthly Spending */}
              <div className="input-wrapper">
                <span className="input-name" style={{ fontSize: '0.8rem' }}>Monthly Spending ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ 
                    width: '100%', 
                    fontSize: '0.9rem', 
                    padding: '0.35rem 0.5rem',
                    opacity: (savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase) ? 0.6 : 1,
                    cursor: (savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase) ? 'not-allowed' : 'auto'
                  }}
                  disabled={savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase}
                  value={isRetirementPhase ? 0 : (savingsAllocMode === 'percentSurplus' ? totalSavingsMonthly : (totalSavingsMonthly > 0 ? totalSavingsMonthly : budgetMonthlySpending))}
                  onChange={(e) => handleMonthlySpendingChange(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Monthly Savings */}
              <div className="input-wrapper">
                <span className="input-name" style={{ fontSize: '0.8rem' }}>Monthly Savings ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ 
                    width: '100%', 
                    fontSize: '0.9rem', 
                    padding: '0.35rem 0.5rem',
                    opacity: (savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase) ? 0.6 : 1,
                    cursor: (savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase) ? 'not-allowed' : 'auto'
                  }}
                  disabled={savingsAllocMode === 'percentSurplus' || totalSavingsMonthly > 0 || isRetirementPhase}
                  value={isRetirementPhase ? 0 : (savingsAllocMode === 'percentSurplus' ? totalSavingsMonthly : (totalSavingsMonthly > 0 ? totalSavingsMonthly : budgetMonthlySavings))}
                  onChange={(e) => handleMonthlySavingsChange(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Savings Rate Card */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(124, 58, 237, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124, 58, 237, 0.25)', padding: '0.5rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Savings Rate</span>
                <strong style={{ fontSize: '1.25rem', color: '#c084fc', marginTop: '0.15rem' }}>
                  {activeSavingsRate}%
                </strong>
                {targetSavingsRate !== null && (
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                    Target: {targetSavingsRate}%
                  </span>
                )}
              </div>

            </div>
          )}
          
          {/* Mobile Tabs for Married mode */}
          {isMarriedMode && isMobile && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem', width: '100%' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeBudgetTab === 'userSavings' ? '2px solid var(--primary)' : 'none',
                  color: activeBudgetTab === 'userSavings' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeBudgetTab === 'userSavings' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveBudgetTab('userSavings')}
              >
                👤 User Savings
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeBudgetTab === 'partnerSavings' ? '2px solid var(--primary)' : 'none',
                  color: activeBudgetTab === 'partnerSavings' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeBudgetTab === 'partnerSavings' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveBudgetTab('partnerSavings')}
              >
                👥 Partner Savings
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeBudgetTab === 'householdExpenses' ? '2px solid var(--accent-emerald)' : 'none',
                  color: activeBudgetTab === 'householdExpenses' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                  fontWeight: activeBudgetTab === 'householdExpenses' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveBudgetTab('householdExpenses')}
              >
                🏠 Combined Expenses
              </button>
            </div>
          )}

          {/* Sections Container */}
          <div className="budget-sections-container" style={{ 
            display: 'grid', 
            gridTemplateColumns: isMarriedMode ? (isMobile ? '1fr' : '1fr 1fr 1fr') : '1fr 1fr', 
            gap: '1.5rem', 
            maxHeight: '400px', 
            overflowY: 'auto', 
            paddingRight: '0.5rem', 
            marginBottom: '1.25rem' 
          }}>
            
            {/* Savings Allocation Column (User) */}
            {(!isMarriedMode || !isMobile || activeBudgetTab === 'userSavings') && (
              <div className="budget-section-col">
                <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', borderBottom: '2px solid var(--primary)', paddingBottom: '0.4rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>💰 {isMarriedMode ? 'User Savings Allocation' : 'Monthly Savings Allocation'}</span>
                  {!isRetirementPhase && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                        {savingsAllocMode === 'percentSurplus' 
                          ? `${totalUserAllocationPct}% (Est. ${formatCurrency(userSavingsMonthly)}/mo)` 
                          : `${formatCurrency(userSavingsMonthly)}/mo`}
                      </span>
                      {savingsAllocMode === 'percentSurplus' && totalUserAllocationPct !== 100 && !isMarriedMode && (
                        <button
                          type="button"
                          onClick={() => {
                            const sum = totalUserAllocationPct;
                            if (sum === 0) {
                              setBudgetSavings(prev => ({ ...prev, brokerage: 100 }));
                              return;
                            }
                            const newSavings = {};
                            let newSum = 0;
                            Object.keys(budgetSavings).forEach(k => {
                              const val = budgetSavings[k] || 0;
                              const scaled = Math.round((val / sum) * 100);
                              newSavings[k] = scaled;
                              newSum += scaled;
                            });
                            const diff = 100 - newSum;
                            if (diff !== 0) {
                              const keys = Object.keys(newSavings);
                              let maxKey = 'brokerage';
                              keys.forEach(k => {
                                if (newSavings[k] > (newSavings[maxKey] || 0)) {
                                  maxKey = k;
                                }
                              });
                              newSavings[maxKey] = Math.max(0, newSavings[maxKey] + diff);
                            }
                            setBudgetSavings(newSavings);
                          }}
                          style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}
                        >
                          (Auto-Balance to 100%)
                        </button>
                      )}
                      {userSavingsMonthly > 0 && (
                        <button
                          type="button"
                          onClick={handleClearDetailedSavings}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                        >
                          (Clear)
                        </button>
                      )}
                    </div>
                  )}
                </h4>

                {isRetirementPhase ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1rem',
                    background: 'rgba(255, 255, 255, 0.01)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-color)',
                    textAlign: 'center',
                    height: '100%',
                    minHeight: '200px'
                  }}>
                    <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏖️</span>
                    <h5 style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.85rem' }}>Retirement Phase Active</h5>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Savings are disabled during retirement. You are now drawing down from your portfolio to fund your living expenses.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Toggle Card */}
                    {!isMarriedMode && (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.5rem', 
                        marginBottom: '1rem', 
                        padding: '0.6rem 0.75rem', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)' 
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Savings Allocation Mode:</span>
                        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleSavingsAllocMode('fixed')}
                            style={{ 
                              flex: 1, 
                              background: savingsAllocMode === 'fixed' ? 'var(--primary)' : 'transparent', 
                              border: 'none', 
                              color: savingsAllocMode === 'fixed' ? '#ffffff' : 'var(--text-secondary)',
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              padding: '0.35rem 0.25rem', 
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            Fixed Amount ($)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSavingsAllocMode('percentSurplus')}
                            style={{ 
                              flex: 1, 
                              background: savingsAllocMode === 'percentSurplus' ? 'var(--primary)' : 'transparent', 
                              border: 'none', 
                              color: savingsAllocMode === 'percentSurplus' ? '#ffffff' : 'var(--text-secondary)',
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              padding: '0.35rem 0.25rem', 
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            Percent of Surplus (%)
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: '1.35' }}>
                          {savingsAllocMode === 'fixed' 
                            ? '💰 Saves fixed dollar amounts monthly. If expenses increase, you will draw from your brokerage/savings to fund these savings targets.' 
                            : '📊 Dynamically saves a percentage of your monthly surplus. If expenses rise and wipe out your surplus, savings automatically drop to 0%.'}
                        </p>
                      </div>
                    )}

                    <div className="budget-inputs-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(isMarriedMode ? [
                        { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                        { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr' },
                        { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr' },
                        { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                        { key: 'brokerage', label: 'Taxable Brokerage' },
                        { key: 'cash', label: 'Cash Savings' },
                        { key: 'debt', label: 'Debt Paydown' }
                      ] : [
                        { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                        { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr combined' },
                        { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr combined' },
                        { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                        { key: 'brokerage', label: 'Taxable Brokerage' },
                        { key: 'checking', label: 'Checking Account' },
                        { key: 'hysa', label: 'High-Yield Savings' },
                        { key: 'emergency', label: 'Emergency Fund' },
                        { key: 'debt', label: 'Debt Payoff' },
                        { key: 'other', label: 'Other Savings' }
                      ]).map(item => {
                        const diff = budgetDiffs?.savings?.[item.key];
                        const hasDiff = diff && diff !== 0;
                        return (
                          <div 
                            key={item.key} 
                            className={`budget-input-row ${hasDiff ? 'budget-row-glow' : ''}`} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              gap: '0.5rem',
                              transition: 'all 0.3s ease',
                              padding: hasDiff ? '0.25rem 0.5rem' : '0',
                              borderRadius: hasDiff ? '6px' : '0',
                              border: hasDiff ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="input-name" style={{ fontSize: '0.8rem', margin: 0 }}>{item.label}</span>
                                {hasDiff && (
                                  <span style={{ 
                                    fontSize: '0.7rem', 
                                    fontWeight: 'bold', 
                                    color: diff > 0 ? '#10b981' : '#f43f5e',
                                    background: diff > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}>
                                    {savingsAllocMode === 'percentSurplus'
                                      ? (diff > 0 ? `+${diff}%` : `${diff}%`)
                                      : (diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff))}
                                  </span>
                                )}
                              </div>
                              {item.desc && <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{item.desc}</span>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                              <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                                <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                                <input
                                  type="number"
                                  className="input-number-box"
                                  style={{ width: '100%', textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                  value={budgetSavings[item.key] || 0}
                                  onChange={(e) => setBudgetSavings({
                                    ...budgetSavings,
                                    [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                  })}
                                />
                              </div>
                              {savingsAllocMode === 'percentSurplus' && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', paddingRight: '0.25rem', textAlign: 'right' }}>
                                  Est. {formatCurrency(Math.round(surplusMonthly * ((budgetSavings[item.key] || 0) / 100)))}/mo
                                  {currentChildCostsMonthly > 0 && (
                                    <>
                                      <br />
                                      <span style={{ color: 'var(--accent-orange, #f59e0b)' }}>
                                        ({formatCurrency(Math.round(surplusWithChild * ((budgetSavings[item.key] || 0) / 100)))}/mo during child years)
                                      </span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Savings Allocation Column (Partner) */}
            {isMarriedMode && (!isMobile || activeBudgetTab === 'partnerSavings') && (
              <div className="budget-section-col">
                <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', borderBottom: '2px solid var(--primary)', paddingBottom: '0.4rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>💰 Partner Savings Allocation</span>
                  {!isRetirementPhase && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                        {savingsAllocMode === 'percentSurplus' 
                          ? `${totalPartnerAllocationPct}% (Est. ${formatCurrency(partnerSavingsMonthly)}/mo)` 
                          : `${formatCurrency(partnerSavingsMonthly)}/mo`}
                      </span>
                      {partnerSavingsMonthly > 0 && (
                        <button
                          type="button"
                          onClick={() => setBudgetPartnerSavings({ trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, cash: 0, debt: 0 })}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                        >
                          (Clear)
                        </button>
                      )}
                    </div>
                  )}
                </h4>

                {isRetirementPhase ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1rem',
                    background: 'rgba(255, 255, 255, 0.01)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-color)',
                    textAlign: 'center',
                    height: '100%',
                    minHeight: '200px'
                  }}>
                    <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏖️</span>
                    <h5 style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.85rem' }}>Retirement Phase Active</h5>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Savings are disabled during retirement. You are now drawing down from your portfolio to fund your living expenses.
                    </p>
                  </div>
                ) : (
                  <div className="budget-inputs-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      { key: 'trad401k', label: 'Partner 401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                      { key: 'rothIra', label: 'Partner Roth IRA', desc: 'Limit $7,000/yr' },
                      { key: 'tradIra', label: 'Partner Traditional IRA', desc: 'Limit $7,000/yr' },
                      { key: 'hsa', label: 'Partner HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                      { key: 'brokerage', label: 'Partner Brokerage' },
                      { key: 'cash', label: 'Partner Cash Savings' },
                      { key: 'debt', label: 'Partner Debt Paydown' }
                    ].map(item => {
                      const diff = budgetDiffs?.partnerSavings?.[item.key];
                      const hasDiff = diff && diff !== 0;
                      return (
                        <div 
                          key={item.key} 
                          className={`budget-input-row ${hasDiff ? 'budget-row-glow' : ''}`} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            transition: 'all 0.3s ease',
                            padding: hasDiff ? '0.25rem 0.5rem' : '0',
                            borderRadius: hasDiff ? '6px' : '0',
                            border: hasDiff ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span className="input-name" style={{ fontSize: '0.8rem', margin: 0 }}>{item.label}</span>
                              {hasDiff && (
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: 'bold', 
                                  color: diff > 0 ? '#10b981' : '#f43f5e',
                                  background: diff > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}>
                                  {savingsAllocMode === 'percentSurplus'
                                    ? (diff > 0 ? `+${diff}%` : `${diff}%`)
                                    : (diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff))}
                                </span>
                              )}
                            </div>
                            {item.desc && <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{item.desc}</span>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                            <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                              <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                value={budgetPartnerSavings[item.key] || 0}
                                onChange={(e) => setBudgetPartnerSavings({
                                  ...budgetPartnerSavings,
                                  [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                })}
                              />
                            </div>
                            {savingsAllocMode === 'percentSurplus' && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', paddingRight: '0.25rem', textAlign: 'right' }}>
                                Est. {formatCurrency(Math.round(surplusMonthly * ((budgetPartnerSavings[item.key] || 0) / 100)))}/mo
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Expenses Column */}
            {(!isMarriedMode || !isMobile || activeBudgetTab === 'householdExpenses') && (
              <div className="budget-section-col">
                <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', borderBottom: '2px solid var(--accent-emerald)', paddingBottom: '0.4rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🏠 {isMarriedMode ? 'Combined Expenses' : 'Monthly Expenses'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>{formatCurrency(totalExpensesMonthly)}/mo</span>
                    {totalExpensesMonthly > 0 && (
                      <button
                        type="button"
                        onClick={handleClearDetailedExpenses}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                      >
                        (Clear)
                      </button>
                    )}
                  </div>
                </h4>
                <div className="budget-inputs-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(isMarriedMode ? [
                    { key: 'housing', label: 'Housing (Rent/Mortgage)' },
                    { key: 'utilities', label: 'Utilities & Subscriptions' },
                    { key: 'food', label: 'Food & Dining Out' },
                    { key: 'transportation', label: 'Transportation / Gas / Car' },
                    { key: 'healthcare', label: 'Healthcare & Insurance' },
                    { key: 'leisure', label: 'Leisure & Leisure Travel' },
                    { key: 'misc', label: 'Miscellaneous Expenses' },
                    { key: 'debt', label: 'Debt Payments' }
                  ] : [
                    { key: 'housing', label: 'Housing (Rent/Mortgage)' },
                    { key: 'utilities', label: 'Utilities & Subscriptions' },
                    { key: 'food', label: 'Food & Dining Out' },
                    { key: 'transportation', label: 'Transportation / Gas / Car' },
                    { key: 'healthcare', label: 'Healthcare & Insurance' },
                    { key: 'leisure', label: 'Leisure & Leisure Travel' },
                    { key: 'misc', label: 'Miscellaneous Expenses' }
                  ]).map(item => {
                    const diff = budgetDiffs?.expenses?.[item.key];
                    const hasDiff = diff && diff !== 0;
                    return (
                      <div 
                        key={item.key} 
                        className={`budget-input-row ${hasDiff ? 'budget-row-glow' : ''}`} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          transition: 'all 0.3s ease',
                          padding: hasDiff ? '0.25rem 0.5rem' : '0',
                          borderRadius: hasDiff ? '6px' : '0',
                          border: hasDiff ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="input-name" style={{ fontSize: '0.8rem', margin: 0 }}>{item.label}</span>
                          </div>
                        </div>
                        <div className="input-prefix-wrapper" style={{ width: '110px' }}>
                          <span className="currency-symbol">$</span>
                          <input
                            type="number"
                            className="input-number-box"
                            style={{ width: '100%', textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                            value={budgetExpenses[item.key] || 0}
                            onChange={(e) => setBudgetExpenses({
                              ...budgetExpenses,
                              [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                            })}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {currentChildCostsMonthly > 0 && (
                    <div 
                      className="budget-input-row" 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        background: 'rgba(245, 158, 11, 0.04)',
                        borderRadius: '6px',
                        border: '1px dashed rgba(245, 158, 11, 0.25)',
                        marginTop: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="input-name" style={{ fontSize: '0.8rem', margin: 0, fontWeight: '700', color: 'var(--accent-orange, #f59e0b)' }}>
                            👶 Childcare & Support (Temporary)
                          </span>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                          Roadmap child event cost (Age {inputs.currentAge})
                        </span>
                      </div>
                      <div className="input-prefix-wrapper" style={{ width: '110px', opacity: 0.85 }}>
                        <span className="currency-symbol" style={{ color: 'var(--accent-orange, #f59e0b)' }}>$</span>
                        <input
                          type="text"
                          disabled
                          className="input-number-box"
                          style={{ width: '100%', textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.85rem', background: 'transparent', border: 'none', color: 'var(--accent-orange, #f59e0b)', fontWeight: 'bold' }}
                          value={currentChildCostsMonthly}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>
          
          {/* Live Reconciliation Panel */}
          {(() => {
            return (
              <div className="budget-reconciliation-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Monthly Take-home Income</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatCurrency(budgetMonthlyIncome)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                      {savingsAllocMode === 'percentSurplus' && currentChildCostsMonthly > 0 ? 'Monthly Savings (Base / Current)' : 'Monthly Savings'}
                    </span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>
                      {savingsAllocMode === 'percentSurplus' && currentChildCostsMonthly > 0 
                        ? `-${formatCurrency(activeSavings)} / -${formatCurrency(childAdjustedSavings)}` 
                        : `-${formatCurrency(activeSavings)}`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Monthly Spending (Base)</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>-{formatCurrency(activeSpending)}</strong>
                  </div>
                  {inputs.includeTaxes && monthlyTax > 0 && (
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Taxes (Est. Progressive)</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>-{formatCurrency(monthlyTax)}</strong>
                    </div>
                  )}
                  {currentChildCostsMonthly > 0 && (
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-orange, #f59e0b)', display: 'block' }}>Childcare Costs (Temp)</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--accent-orange, #f59e0b)' }}>-{formatCurrency(currentChildCostsMonthly)}</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Net Cash Flow (Current)</span>
                    {netRemaining > 0 ? (
                      <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>{formatCurrency(netRemaining)} Leftover</strong>
                    ) : netRemaining < 0 ? (
                      <strong style={{ fontSize: '0.9rem', color: 'var(--accent-rose)' }}>{formatCurrency(Math.abs(netRemaining))} Deficit</strong>
                    ) : (
                      <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>Balanced</strong>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    {currentChildCostsMonthly > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontSize: '0.78rem', color: netRemaining < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontWeight: 'bold' }}>
                          {netRemaining < 0 
                            ? `🔴 Cash Flow Deficit: ${formatCurrency(Math.abs(netRemaining))}/mo deficit at parent age ${inputs.currentAge}.`
                            : `🟢 Cash Flow Balanced: ${formatCurrency(netRemaining)}/mo surplus at parent age ${inputs.currentAge}.`}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                          {savingsAllocMode === 'percentSurplus'
                            ? (netRemaining < 0
                                ? `ℹ️ Your Percent of Surplus rules automatically dropped savings to 0% during child-rearing years, but childcare costs still exceed income. The simulator will draw ${formatCurrency(Math.abs(netRemaining))}/mo from your portfolio to cover this temporary deficit.`
                                : 'ℹ️ Your Percent of Surplus rules automatically dropped savings during child-rearing years to protect your cash.')
                            : '⚠️ Fixed savings targets are forcing drawdowns. Consider switching to "Percent of Surplus" savings mode or adjusting your spending/roadmap.'}
                        </span>
                      </div>
                    ) : (
                      <div>
                        {remainingMonthly > 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
                            🟢 Leftover: {formatCurrency(remainingMonthly)}/mo unallocated
                          </span>
                        ) : remainingMonthly < 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: 'bold' }}>
                            🔴 Deficit: {formatCurrency(Math.abs(remainingMonthly))}/mo over-allocated
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
                            ✅ Perfectly balanced! $0 leftover
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {(remainingMonthly !== 0 || netRemaining < 0) && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {remainingMonthly > 0 && (
                        <>
                          <button 
                            type="button" 
                            className="list-builder-edit-btn" 
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                            onClick={() => handleAllocateRemaining('hysa')}
                          >
                            📥 Put in HYSA
                          </button>
                          <button 
                            type="button" 
                            className="list-builder-edit-btn" 
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                            onClick={() => handleAllocateRemaining('brokerage')}
                          >
                            📥 Put in Brokerage
                          </button>
                        </>
                      )}
                      {((savingsAllocMode === 'fixed' && netRemaining < 0 && (totalSavingsMonthly > 0 || budgetMonthlySavings > 0)) ||
                        (savingsAllocMode === 'percentSurplus' && totalAllocationPct > 100)) && (
                        <button 
                          type="button" 
                          className="list-builder-edit-btn" 
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderColor: 'var(--accent-rose)', color: '#fda4af' }}
                          onClick={handleAutoReduceSavingsToBalance}
                        >
                          ⚖️ Auto-Reduce Savings
                        </button>
                      )}
                      <button 
                        type="button" 
                        className="list-builder-edit-btn" 
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                        onClick={handleAdjustGrossIncome}
                      >
                        ⚖️ Adjust Income to Match
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          
          {/* Warnings & Guardrails */}
          {(() => {
            const warnings = [];
            if (capped401k >= 23500 && (budgetSavings.trad401k || 0) * 12 > 23500) {
              warnings.push(`401(k) exceeds employee limit ($23,500/yr). Capping tax deduction.`);
            }
            if ((budgetSavings.tradIra || 0) * 12 + (budgetSavings.rothIra || 0) * 12 > 7000) {
              warnings.push(`Combined IRA contributions exceed the $7,000/yr limit.`);
            }
            if (cappedHsa >= (budgetHsaCoverage === 'family' ? 8300 : 4150) && (budgetSavings.hsa || 0) * 12 > (budgetHsaCoverage === 'family' ? 8300 : 4150)) {
              warnings.push(`HSA exceeds IRS limit ($${budgetHsaCoverage === 'family' ? '8,300' : '4,150'}/yr). Capping tax deduction.`);
            }
            
            if (warnings.length === 0) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                    ⚠️ {w}
                  </div>
                ))}
              </div>
            );
          })()}
          
          {/* Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
              onClick={handleCloseBudgetModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
              onClick={handleSaveBudget}
            >
              Save Budget
            </button>
          </div>
          
        </div>
      </div>
    );
  };

  const simpleSavingsRate = useMemo(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income <= 0) return 0;
    return Math.round(((income - expenses) / income) * 100);
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  return (
    <div className="fire-simulator-container" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      
      {/* Wizard Steps Navigation Header */}
      <div className="wizard-steps-container">
        <div 
          className={`wizard-step-node ${activeStep === 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}
          onClick={() => setActiveStep(1)}
        >
          <div className="wizard-step-icon">1</div>
          <span className="wizard-step-label">Today</span>
        </div>
        <div className={`wizard-step-divider ${activeStep >= 2 ? 'active' : ''}`} />
        <div 
          className={`wizard-step-node ${activeStep === 2 ? 'active' : ''}`}
          onClick={() => {
            setActiveStep(2);
          }}
        >
          <div className="wizard-step-icon">2</div>
          <span className="wizard-step-label">Life Plan</span>
        </div>
      </div>

      {/* Screen 1: Your Life Today */}
      {activeStep === 1 && (
        <div className="today-screen-layout" style={{ alignItems: 'stretch' }}>
          {/* Inputs Grid */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>Your Life Today</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.0rem', lineHeight: '1.45' }}>
              Let's estimate your path to financial independence. Fill in your current numbers to see your baseline projection instantly.
            </p>
            

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Current Age</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.currentAge}
                    placeholder="e.g. 35"
                    onChange={(e) => handleStep1Change('currentAge', parseInt(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Your current age today (e.g. 35)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Life Expectancy</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.lifeExpectancy}
                    placeholder="e.g. 85"
                    onChange={(e) => handleStep1Change('lifeExpectancy', parseInt(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Age you expect to live to (e.g. 85)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Annual Income ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.simpleIncome}
                    placeholder="e.g. 120000"
                    onChange={(e) => handleStep1Change('simpleIncome', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Your total yearly gross income (e.g. $120,000)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Pre-Tax Savings Rate (%)</span>
                    <button
                      type="button"
                      onClick={handleSetBudgetClick}
                      className="list-builder-edit-btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      📊 Calculate from budget
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={simpleSavingsRate}
                    placeholder="e.g. 20"
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || 0;
                      const clampedRate = Math.min(100, Math.max(0, rate));
                      lastNonZeroSavingsRateRef.current = clampedRate;
                      const income = Number(inputs.simpleIncome) || 0;
                      const newExpenses = Math.round(income * (1 - clampedRate / 100));
                      handleStep1Change('simpleExpenses', newExpenses);
                    }}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Percent of income saved pre-tax (e.g. 20%)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Current Savings ($)</span>
                    <button
                      type="button"
                      onClick={handleOpenSavingsDetails}
                      className="list-builder-edit-btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      ✏️ Details
                    </button>
                  </div>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.simpleInvestments}
                    placeholder="e.g. 250000"
                    onChange={(e) => handleStep1Change('simpleInvestments', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Your total savings, retirement, and investment accounts combined (e.g. $250,000)
                </span>
              </div>
            </div>

           </div>

          {/* Immediate Value Display Progress Board */}
          <div className="progress-board-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', padding: '1.25rem 1.5rem', height: 'auto' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Your Financial Snapshot</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Your current starting point parameters:
              </p>
            </div>

            {/* Positive Metrics Deck */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Annual Income
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.15' }}>
                  {formatCurrency(inputs.simpleIncome)}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Pre-Tax Savings Rate
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.15' }}>
                  {simpleSavingsRate}%
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Annual Surplus
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-emerald)', lineHeight: '1.15' }}>
                  {formatCurrency(Math.max(0, inputs.simpleIncome - inputs.simpleExpenses))}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Current Net Worth
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.15' }}>
                  {formatCurrency(totalNetWorth)}
                </span>
              </div>
            </div>

            {/* Encouraging Insights */}
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Starting Point Insights
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                  <span>💡</span>
                  <span>
                    {simpleSavingsRate >= 15 
                      ? `Strong Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax.`
                      : simpleSavingsRate > 0
                        ? `Good Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax.`
                        : `Action Plan: Try adjusting your spending to create a surplus and start saving.`}
                  </span>
                </div>
                {inputs.simpleIncome - inputs.simpleExpenses > 0 && (
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                    <span>🌱</span>
                    <span>
                      {`Annual Investing: You have ${formatCurrency(inputs.simpleIncome - inputs.simpleExpenses)}/yr to build wealth.`}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                  <span>✨</span>
                  <span>
                    {`Current Status: This is your starting point. Life choices can change your timeline.`}
                  </span>
                </div>
              </div>
            </div>

            {/* Next Step CTA */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: 'auto', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Next Step
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Now let’s see how future life choices affect your path.
                </span>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', padding: '0.65rem', fontSize: '1.05rem', fontWeight: '700', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' }}
                onClick={() => {
                  setActiveStep(2);
                }}
              >
                Build My Life Plan →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Your Life Plan */}
      {activeStep === 2 && (
        <div className="roadmap-step-container">
          
          {/* visual Retirement Plan Summary Card (Full-Width at Top) */}
          {(() => {
            const details = getOutcomeDetails(
              activeResults.retirementOutcome,
              activeResults.runOutAge,
              inputs.readinessCriteria,
              activeResults.retirementReadyAge,
              inputs.lifeExpectancy
            );

            const targetRetAge = Number(inputs.targetRetirementAge);
            const readyAge = activeResults.retirementReadyAge;
            const isNotAchieved = readyAge === null || targetRetAge < readyAge;

            const gapAmount = activeResults.endingSurplusShortfall < 0 
              ? -activeResults.endingSurplusShortfall 
              : Math.max(0, activeResults.retirementReadyTarget - activeResults.portfolioAtRetirement);
            
            const yearsAdditionalWork = readyAge ? Math.max(0, readyAge - targetRetAge) : 0;
            
            const yearsToRetire = targetRetAge - Number(inputs.currentAge);
            const additionalSavings = estimateAdditionalMonthlySavings(gapAmount, yearsToRetire, inputs.expectedReturn);
            
            const incomeVal = Number(inputs.simpleIncome) || 50000;
            const additionalSavingsPercent = incomeVal > 0 ? (additionalSavings * 12 / incomeVal) * 100 : 0;
            
            const yearsOfRetirement = Number(inputs.lifeExpectancy) - targetRetAge;
            const annualSpendingVal = activeResults.annualRetirementSpending || 40000;
            const spendingReductionPercent = Math.min(100, Math.max(1, Math.round((gapAmount / (annualSpendingVal * Math.max(1, yearsOfRetirement))) * 100)));

            return (
              <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    🏆 Retirement Plan Summary
                  </h3>
                  <div className="segmented-control-container" style={{ margin: 0, minWidth: '400px', width: '100%', maxWidth: '500px' }}>
                    <div className="segmented-control" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px', display: 'flex', width: '100%' }}>
                      <button
                        type="button"
                        className={`segmented-control-btn ${inputs.readinessCriteria === 'lastsLifeExp' ? 'active' : ''}`}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.7rem', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '6px', 
                          background: inputs.readinessCriteria === 'lastsLifeExp' ? 'var(--primary)' : 'transparent',
                          color: inputs.readinessCriteria === 'lastsLifeExp' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => updateInput('readinessCriteria', 'lastsLifeExp')}
                      >
                        Sustainable
                        <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                          <span className="toggle-tooltip-icon">i</span>
                          <span className="toggle-tooltip-text">
                            <strong style={{ color: 'var(--primary)' }}>Sustainable Retirement:</strong> Money is projected to last through planned Life Expectancy (Age {inputs.lifeExpectancy || 85}), drawing the portfolio down to $0.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`segmented-control-btn ${inputs.readinessCriteria === 'lastsComfortable' ? 'active' : ''}`}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.7rem', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '6px', 
                          background: inputs.readinessCriteria === 'lastsComfortable' ? 'var(--primary)' : 'transparent',
                          color: inputs.readinessCriteria === 'lastsComfortable' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => updateInput('readinessCriteria', 'lastsComfortable')}
                      >
                        Comfortable
                        <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                          <span className="toggle-tooltip-icon">i</span>
                          <span className="toggle-tooltip-text">
                            <strong style={{ color: '#fbbf24' }}>Comfortable Retirement:</strong> Money is projected to last 10 years beyond planned Life Expectancy (Age {Number(inputs.lifeExpectancy || 85) + 10}), providing a solid longevity safety buffer.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`segmented-control-btn ${inputs.readinessCriteria === 'lastsIndefinitely' ? 'active' : ''}`}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.7rem', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '6px', 
                          background: inputs.readinessCriteria === 'lastsIndefinitely' ? 'var(--primary)' : 'transparent',
                          color: inputs.readinessCriteria === 'lastsIndefinitely' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => updateInput('readinessCriteria', 'lastsIndefinitely')}
                      >
                        Indefinite
                        <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                          <span className="toggle-tooltip-icon">i</span>
                          <span className="toggle-tooltip-text">
                            <strong style={{ color: '#10b981' }}>Indefinite Retirement:</strong> Portfolio meets the Safe Withdrawal Rate (SWR) target, ensuring it remains intact or grows, lasting indefinitely.
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* View Values In Preference Toggle */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'flex-end', 
                  gap: '0.5rem', 
                  marginBottom: '0.65rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  <span>View Values In:</span>
                  <div className="segmented-control" style={{ 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px', 
                    padding: '2px', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      className={`segmented-control-btn ${displayMode === 'future' ? 'active' : ''}`}
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.7rem',
                        borderRadius: '4px',
                        background: displayMode === 'future' ? 'var(--primary)' : 'transparent',
                        color: displayMode === 'future' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setDisplayMode('future')}
                    >
                      Future Dollars
                    </button>
                    <button
                      type="button"
                      className={`segmented-control-btn ${displayMode === 'today' ? 'active' : ''}`}
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.7rem',
                        borderRadius: '4px',
                        background: displayMode === 'today' ? 'var(--primary)' : 'transparent',
                        color: displayMode === 'today' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      onClick={() => setDisplayMode('today')}
                    >
                      Today’s Dollars
                      <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                        <span className="toggle-tooltip-icon" style={{ width: '10px', height: '10px', fontSize: '7px', lineHeight: '10px' }}>i</span>
                        <span className="toggle-tooltip-text" style={{ textTransform: 'none', fontWeight: 'normal' }}>
                          Today’s Dollars adjusts future values for inflation to show equivalent purchasing power.
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Outcome Banner (Compact) */}
                <div style={{ 
                  background: details.bg, 
                  border: `1px solid ${details.color}44`, 
                  borderRadius: '6px', 
                  padding: '0.35rem 0.75rem',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: '800', color: details.color }}>
                    {details.badge}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.35', flex: 1, minWidth: '250px' }}>
                    {details.desc}
                  </p>
                </div>
                
                {/* Planning Concepts & Key Values Grid (6-Column Compact) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                  gap: '0.5rem', 
                  paddingTop: '0' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Planned Retirement</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>Age {inputs.targetRetirementAge}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                      {inputs.readinessCriteria === 'lastsLifeExp' 
                        ? 'Sustainable Age' 
                        : inputs.readinessCriteria === 'lastsComfortable' 
                        ? 'Comfortable Age' 
                        : 'Indefinite Age'}
                    </span>
                    <strong style={{ fontSize: readyAge ? '1.05rem' : '0.8rem', color: readyAge ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', fontWeight: '800' }}>
                      {readyAge ? `Age ${readyAge}` : 'Current Plan Needs Adjustment'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                      {inputs.readinessCriteria === 'lastsLifeExp' 
                        ? 'Sustainable Target' 
                        : inputs.readinessCriteria === 'lastsComfortable' 
                          ? 'Comfortable Target' 
                          : 'Indefinite Target'}
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {formatCurrency(displayedResults.retirementReadyTarget)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Projected Portfolio</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {displayedResults.targetRetirementAge === inputs.lifeExpectancy ? 'Adjust plan' : formatCurrency(displayedResults.portfolioAtRetirement)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Retirement Income</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>{formatCurrency(displayedResults.retirementIncomeSources)} / yr</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Annual Spending</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {formatCurrency(displayedResults.annualRetirementSpending)} / yr
                    </strong>
                  </div>
                </div>

                {/* Retirement Improvement Plan Banner (Compact) */}
                {activeStep === 2 && improvementPlan && improvementPlan.rankedPlan.length > 0 && (
                  <div className="improvement-banner-container" style={{ marginTop: '0.65rem', padding: '0.35rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--primary-light)' }}>💡 Action Plan Available:</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Adjustments are available to improve your projection.</span>
                    </div>
                    <button
                      type="button"
                      className="improvement-banner-btn"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', margin: 0 }}
                      onClick={() => setShowImprovementModal(true)}
                    >
                      View Action Plan
                    </button>
                  </div>
                )}

              </div>
            );
          })()}
          
          {/* Centerpiece Timeline */}
          <div className="glass-card timeline-card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Interactive Roadmap</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Click milestones to view details</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ width: '100%', minWidth: '150px', maxWidth: '200px' }}>
                  <button
                    type="button"
                    className="add-event-dropdown"
                    style={{
                      width: '100%',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundImage: 'none',
                      paddingRight: '1rem',
                      paddingLeft: '1rem',
                      fontSize: '0.78rem',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={handleSetBudgetClick}
                  >
                    Set Budget
                  </button>
                </div>
                <div style={{ width: '100%', minWidth: '150px', maxWidth: '200px' }}>
                  <select
                    className="add-event-dropdown"
                    style={{ width: '100%', height: '32px', padding: '0 2rem 0 1rem', fontSize: '0.78rem', lineHeight: '30px' }}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleCreateEvent(e.target.value);
                        e.target.value = ''; // reset selection
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
              </div>
            </div>

            {/* Horizontal Timeline (Desktop) */}
            <div className="timeline-wrapper">
              <style>{`
                .timeline-phase-band {
                  transition: all 0.2s ease !important;
                }
                .timeline-phase-band:hover {
                  filter: brightness(1.2) !important;
                  box-shadow: 0 0 10px rgba(255, 255, 255, 0.15) !important;
                  cursor: pointer;
                }
              `}</style>
              <div className="timeline-track-container" style={{ height: '220px' }}>
                {/* Household Phases Swimlanes */}
                {(() => {
                  const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                  if (totalYears <= 0) return null;

                  const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled);
                  const divorceEvent = (inputs.lifeEvents || []).find(e => e.type === 'divorce' && e.enabled);
                  
                  const marriageAge = marriageEvent ? Number(marriageEvent.age) : null;
                  const divorceAge = divorceEvent ? Number(divorceEvent.age) : null;

                  // Relationship swimlane intervals
                  const relIntervals = [];
                  if (!marriageAge) {
                    relIntervals.push({ label: '👤 Single', start: inputs.currentAge, end: inputs.lifeExpectancy, style: { background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' } });
                  } else {
                    if (marriageAge > inputs.currentAge) {
                      relIntervals.push({ label: '👤 Single', start: inputs.currentAge, end: marriageAge, style: { background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' } });
                    }
                    
                    const endOfMarried = divorceAge || inputs.lifeExpectancy;
                    if (endOfMarried > marriageAge) {
                      relIntervals.push({ label: '💍 Married', start: marriageAge, end: endOfMarried, style: { background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)', border: '1px solid rgba(99, 102, 241, 0.35)', color: '#a5b4fc' } });
                    }
                    
                    if (divorceAge && inputs.lifeExpectancy > divorceAge) {
                      relIntervals.push({ label: '👤 Single', start: divorceAge, end: inputs.lifeExpectancy, style: { background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' } });
                    }
                  }

                  // Child support interval
                  const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
                  let childBand = null;
                  if (childEvents.length > 0) {
                    const minChildAge = Math.min(...childEvents.map(ev => Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30));
                    const maxChildAge = Math.max(...childEvents.map(ev => (Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30) + (ev.includeCollege ? 22 : 18)));
                    if (minChildAge < maxChildAge && maxChildAge > inputs.currentAge) {
                      childBand = {
                        start: Math.max(inputs.currentAge, minChildAge),
                        end: Math.min(inputs.lifeExpectancy, maxChildAge)
                      };
                    }
                  }

                  // Determine lifecycle phases
                  const retAge = activeResults.targetRetirementAge || inputs.lifeExpectancy;
                  const workPct = Math.max(0, Math.min(100, ((retAge - inputs.currentAge) / totalYears) * 100));
                  const savingIntervals = getChildCountIntervals(inputs.currentAge, retAge, inputs.lifeEvents);

                  return (
                    <div style={{ position: 'absolute', bottom: '30px', left: '70px', right: '70px', pointerEvents: 'none', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '0px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Household Phases</div>
                      
                      {/* Relationship Swimlane */}
                      <div style={{ position: 'relative', width: '100%', height: '24px', display: 'flex', gap: '2px' }}>
                        {relIntervals.map((interval, idx) => {
                          const widthPct = Math.max(0, Math.min(100, ((interval.end - interval.start) / totalYears) * 100));
                          if (widthPct <= 0) return null;
                          return (
                            <div
                              key={idx}
                              style={{
                                width: `${widthPct}%`,
                                height: '100%',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.68rem',
                                fontWeight: '700',
                                ...interval.style
                              }}
                            >
                              {interval.label}
                            </div>
                          );
                        })}
                      </div>

                      {/* Child Swimlane */}
                      {childBand && (() => {
                        const startPct = Math.max(0, Math.min(100, ((childBand.start - inputs.currentAge) / totalYears) * 100));
                        const endPct = Math.max(0, Math.min(100, ((childBand.end - inputs.currentAge) / totalYears) * 100));
                        const widthPct = endPct - startPct;
                        if (widthPct <= 0) return null;
                        return (
                          <div style={{ position: 'relative', width: '100%', height: '24px' }}>
                            <div
                              style={{
                                position: 'absolute',
                                left: `${startPct}%`,
                                width: `${widthPct}%`,
                                height: '100%',
                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.12) 100%)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                color: '#fde047',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.68rem',
                                fontWeight: '700'
                              }}
                            >
                              👶 Child
                            </div>
                          </div>
                        );
                      })()}

                      {/* Budget Buckets (Bands) representing lifecycle phases */}
                      <div style={{ position: 'relative', width: '100%', height: '22px', display: 'flex', gap: '2px', userSelect: 'none' }}>
                        {/* Work & Save Band */}
                        {workPct > 0 && (
                          <div 
                            className="timeline-phase-band"
                            title="Click to adjust working budget & savings"
                            onClick={() => handleSetBudgetClick('workSave')}
                            style={{
                              width: `${workPct}%`,
                              background: 'rgba(99, 102, 241, 0.08)',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              borderRadius: '4px 0 0 4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.68rem',
                              color: '#a5b4fc',
                              fontWeight: '700',
                              pointerEvents: 'auto',
                              cursor: 'pointer'
                            }}
                          >
                            💼 Work & Save Phase
                          </div>
                        )}
                        {/* Retirement Band */}
                        {workPct < 100 && (
                          <div 
                            className="timeline-phase-band"
                            title="Click to adjust retirement age & spending"
                            onClick={(e) => {
                              e.stopPropagation();
                              const retireEvent = (inputs.lifeEvents || []).find(e => e.type === 'retire' && e.enabled);
                              if (retireEvent) {
                                setSelectedTimelineEvent(retireEvent);
                                setSelectedYear(Number(retireEvent.age));
                              }
                            }}
                            style={{
                              width: `${100 - workPct}%`,
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                              borderRadius: '0 4px 4px 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.68rem',
                              color: '#6ee7b7',
                              fontWeight: '700',
                              pointerEvents: 'auto',
                              cursor: 'pointer'
                            }}
                          >
                            🎉 Retirement Phase
                          </div>
                        )}

                        {/* Childcare overlay bands */}
                        {savingIntervals.map((interval, idx) => {
                          if (interval.childCount === 0) return null;
                          const startPct = Math.max(0, Math.min(100, ((interval.startAge - inputs.currentAge) / totalYears) * 100));
                          const endPct = Math.max(0, Math.min(100, ((interval.endAge - inputs.currentAge) / totalYears) * 100));
                          const widthPct = endPct - startPct;
                          if (widthPct <= 0) return null;
                          
                          return (
                            <div 
                              key={idx}
                              className="timeline-phase-band"
                              title={`Click to adjust budget for ${interval.childCount === 1 ? '1 Child' : interval.childCount + ' Kids'} childcare phase`}
                              onClick={() => handleSetBudgetClick(`interval_${idx}`)}
                              style={{
                                position: 'absolute',
                                left: `${startPct}%`,
                                width: `${widthPct}%`,
                                top: '0',
                                bottom: '0',
                                background: 'rgba(245, 158, 11, 0.06)',
                                border: '1.5px dashed rgba(245, 158, 11, 0.45)',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                color: '#f59e0b',
                                fontWeight: '800',
                                zIndex: 2,
                                boxShadow: '0 0 4px rgba(245, 158, 11, 0.1)',
                                pointerEvents: 'auto',
                                cursor: 'pointer'
                              }}
                            >
                              👶 {interval.childCount === 1 ? '1 Child' : `${interval.childCount} Kids`}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="timeline-line-axis" style={{ top: '190px' }} />
                <div
                  className="timeline-progress-line"
                  style={{
                    top: '190px',
                    width: activeResults.targetRetirementAge 
                      ? `calc((100% - 140px) * ${Math.max(0, Math.min(100, (((activeResults.targetRetirementAge) - inputs.currentAge) / (inputs.lifeExpectancy - inputs.currentAge)) * 100))} / 100)`
                      : '0px'
                  }}
                />

                {/* Chronological Axis Number Line Ticks */}
                <div className="timeline-ticks-container" style={{ position: 'absolute', top: '190px', left: 0, right: 0, height: '30px', zIndex: 1, pointerEvents: 'none' }}>
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
                      const leftOffset = `calc(70px + (100% - 140px) * ${percent} / 100)`;
                      return (
                        <div key={idx} className="timeline-tick" style={{ position: 'absolute', left: leftOffset, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div className="timeline-tick-mark" style={{ width: '2px', height: '6px', background: 'var(--border-color)', opacity: 0.8 }} />
                          <span className="timeline-tick-label" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-tertiary)', marginTop: '4px' }}>{age}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                <div className="timeline-events-container" style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 }}>
                  {timelineEvents.map((evt, idx) => {
                    const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                    const isDraggingThis = !!(draggingInfo && (
                      (evt.originalId && draggingInfo.originalId === evt.originalId) ||
                      (!evt.originalId && draggingInfo.type === evt.type)
                    ));

                    const displayAge = isDraggingThis ? draggingInfo.currentAge : evt.age;
                    const percent = totalYears > 0 ? ((displayAge - inputs.currentAge) / totalYears) * 100 : 0;
                    const leftOffset = `calc(70px + (100% - 140px) * ${percent} / 100)`;

                    return (
                      <div
                        key={idx}
                        className={`timeline-node ${evt.isMilestone ? 'milestone' : ''} ${evt.age <= activeResults.targetRetirementAge ? 'active' : ''} ${isDraggingThis ? 'dragging' : ''}`}
                        style={{ 
                          left: leftOffset, 
                          top: `${145 - (evt.stackIndex * 36)}px`, 
                          transform: 'translateX(-50%)',
                          cursor: isDraggingThis ? 'grabbing' : isEditableEvent(evt) ? 'grab' : 'pointer',
                          pointerEvents: 'auto'
                        }}
                        onMouseDown={(e) => handleNodeDragStart(e, evt)}
                        onTouchStart={(e) => handleNodeDragStart(e, evt)}
                        onClick={(e) => {
                          if (dragOccurredRef.current) {
                            e.stopPropagation();
                            return;
                          }
                          setSelectedTimelineEvent(evt);
                          setSelectedYear(Math.floor(evt.age));
                        }}
                      >
                        <div className="timeline-node-dot">
                          {evt.icon}
                          {/* Premium hover tooltip */}
                          <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''} ${evt.stackIndex >= 2 ? 'tooltip-below' : ''}`}>
                            <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                              {evt.title}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '150px', lineHeight: '1.3' }}>
                              Age {displayAge} • {evt.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Clickable Event Details Card Panel */}
            {selectedTimelineEvent && (
              <div className="timeline-event-details-card" style={{ marginTop: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTimelineEvent(null)}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  ✖
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{selectedTimelineEvent.icon}</span>
                  <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Age {selectedTimelineEvent.age} - {selectedTimelineEvent.title}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {selectedTimelineEvent.description}
                </p>
                {selectedTimelineEvent.type === 'socialSecurity' && (() => {
                  const ss = displayedResults.socialSecurityDetails;
                  if (!ss) return null;
                  
                  if (!ss.isEligible) {
                    return (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.75rem', 
                        background: 'rgba(244, 63, 94, 0.1)', 
                        borderRadius: 'var(--radius-sm, 4px)', 
                        border: '1px solid rgba(244, 63, 94, 0.3)', 
                        fontSize: '0.75rem',
                        lineHeight: '1.4'
                      }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent-rose, #f43f5e)', marginBottom: '0.25rem' }}>
                          Estimated Social Security
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          Not eligible yet. Social Security retirement benefits generally require about 10 years of work.
                        </div>
                        <div style={{ marginTop: '0.35rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                          Working years: {ss.workingYears} / 10
                        </div>
                      </div>
                    );
                  }
                  
                  let adjustmentText = "Full retirement age benefit";
                  if (ss.claimAge < 67) {
                    const monthsEarly = (67 - ss.claimAge) * 12;
                    let reduction = 0;
                    if (monthsEarly <= 36) {
                      reduction = monthsEarly * (5 / 9);
                    } else {
                      reduction = 36 * (5 / 9) + (monthsEarly - 36) * (5 / 12);
                    }
                    adjustmentText = `${Math.round(reduction)}% early-claiming reduction`;
                  } else if (ss.claimAge === 67) {
                    adjustmentText = "Full retirement age benefit";
                  } else {
                    const monthsDelayed = (ss.claimAge - 67) * 12;
                    const creditPct = Math.round(monthsDelayed * (2 / 3));
                    adjustmentText = `${creditPct}% delayed credit`;
                  }
                  
                  return (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                        Estimated Social Security
                      </div>
                      <div style={{ 
                        padding: '0.75rem', 
                        background: 'var(--bg-primary, rgba(0,0,0,0.15))', 
                        borderRadius: 'var(--radius-sm, 4px)', 
                        border: '1px solid var(--border-color)', 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '0.5rem', 
                        fontSize: '0.75rem' 
                      }}>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Claiming Age:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{ss.claimAge}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Monthly Benefit:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{formatCurrency(ss.monthlyBenefit)}/mo</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Annual Benefit:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{formatCurrency(ss.annualBenefit)}/yr</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Working Years:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{ss.workingYears}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Average of highest 35 earning years:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>
                            {ss.averageTop35AnnualIncome > 0 ? `${formatCurrency(ss.averageTop35AnnualIncome)}/yr` : 'N/A (Fixed SS)'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>AIME:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>
                            {ss.aimeMonthly > 0 ? `${formatCurrency(ss.aimeMonthly)}/mo` : 'N/A (Fixed SS)'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>PIA at full retirement age:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>
                            {ss.piaMonthly > 0 ? `${formatCurrency(ss.piaMonthly)}/mo` : 'N/A'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-tertiary)' }}>Claiming Adjustment:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--accent-emerald, #10b981)' }}>{adjustmentText}</strong>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.35rem' }}>
                        Estimated from your simulated earnings history, highest 35 earning years, and claiming age.
                      </div>
                    </div>
                  );
                })()}
                {selectedTimelineEvent.type === 'marriage' && (() => {
                  const ev = selectedTimelineEvent;
                  const spouseAssets = (Number(ev.cash) || 0) + (Number(ev.investments) || 0) + (Number(ev.retirement) || 0);
                  const spouseDebt = (Number(ev.debtStudent) || 0) + (Number(ev.debtCredit) || 0) + (Number(ev.debtOther) || 0);
                  
                  return (
                    <div style={{ 
                      marginTop: '0.75rem', 
                      padding: '0.75rem', 
                      background: 'var(--bg-primary, rgba(0,0,0,0.15))', 
                      borderRadius: 'var(--radius-sm, 4px)', 
                      border: '1px solid var(--border-color)', 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '0.75rem', 
                      fontSize: '0.75rem' 
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)' }}>Spouse Income:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--accent-emerald)' }}>{formatCurrency(ev.spouseIncome)}/yr</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)' }}>Income Growth:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{ev.incomeGrowthRate}%</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)' }}>Spouse Assets:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--accent-emerald)' }}>{formatCurrency(spouseAssets)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)' }}>Spouse Debt:</span>
                        <strong style={{ marginLeft: '0.25rem', color: spouseDebt > 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{formatCurrency(spouseDebt)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)' }}>Filing Status:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{ev.filingStatus === 'jointly' ? 'Jointly' : 'Separately'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)' }}>Savings Rate:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{ev.savingsRate}%</strong>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Adjustments:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>
                          Lifestyle: {ev.lifestyleAdjustment >= 0 ? '+' : ''}{formatCurrency(ev.lifestyleAdjustment)}/mo | Housing: {ev.housingOption === 'savings' ? `Save ${formatCurrency(Math.abs(ev.housingSavings))}/mo` : ev.housingOption === 'expensive' ? `Cost ${formatCurrency(ev.housingCost)}/mo` : 'No Change'}
                        </strong>
                      </div>
                      {ev.includeWeddingCost && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>Wedding Cost:</span>
                          <strong style={{ marginLeft: '0.25rem', color: 'var(--accent-rose)' }}>{formatCurrency(ev.weddingCost)} at Age {ev.weddingAge}</strong>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {isEditableEvent(selectedTimelineEvent) && (
                    <button
                      type="button"
                      className="list-builder-edit-btn"
                      onClick={() => {
                        handleEditRoadmapEvent(selectedTimelineEvent);
                        setSelectedTimelineEvent(null);
                      }}
                    >
                      ✏️ Edit Event
                    </button>
                  )}
                  {!selectedTimelineEvent.isMilestone && (
                    <button
                      type="button"
                      className="list-builder-remove-btn"
                      style={{ padding: '0.2rem 0.5rem', alignSelf: 'flex-start' }}
                      onClick={() => {
                        handleDeleteRoadmapEvent(selectedTimelineEvent);
                        setSelectedTimelineEvent(null);
                      }}
                    >
                      🗑️ Remove Event
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Vertical Timeline (Mobile Stacked) */}
            <div className="vertical-timeline-container">
              <div className="vertical-timeline-line" />
              {timelineEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className={`vertical-timeline-node ${evt.isMilestone ? 'milestone' : ''} ${evt.age <= activeResults.targetRetirementAge ? 'active' : ''}`}
                  onClick={() => setSelectedTimelineEvent(evt)}
                >
                  <div className="vertical-timeline-dot">
                    {evt.icon}
                  </div>
                  <div className="vertical-timeline-content">
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="vertical-timeline-age">Age {evt.age} - {evt.title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isEditableEvent(evt) && (
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRoadmapEvent(evt);
                            }}
                          >
                            ✏️
                          </button>
                        )}
                        {!evt.isMilestone && (
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRoadmapEvent(evt);
                              setSelectedTimelineEvent(null);
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="vertical-timeline-label">{evt.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wealth Journey Graph (Full Width, directly below timeline) */}
          {validation.errors.length === 0 && (
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Wealth Journey</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Updates live • Click chart to view detailed benchmarks below</span>
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
              <div className="chart-container-inner" style={{ height: '240px', cursor: 'crosshair' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={displayedResults.data}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        setSelectedYear(Number(data.activeLabel));
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="age"
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={10}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={10}
                      tickFormatter={formatYAxis}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="custom-chart-tooltip">
                              <p style={{ fontWeight: '700', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                                Age {label}
                              </p>
                              {payload.map((item) => (
                                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '0.2rem 0' }}>
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
                      dataKey="assets"
                      name="Total Assets"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      hide={!showAssets}
                    />
                    <Line
                      type="monotone"
                      dataKey="debt"
                      name="Total Debt"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      hide={!showDebt}
                    />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      name="Net Worth"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={false}
                      hide={!showNetWorth}
                    />

                    {/* 1. Planned Retirement Age */}
                    {displayedResults.targetRetirementAge && (
                      <ReferenceLine
                        x={displayedResults.targetRetirementAge}
                        stroke="#a855f7"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: `Retirement: Age ${displayedResults.targetRetirementAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 10
                        }}
                      />
                    )}

                    {/* 2. Retirement Ready Age */}
                    {displayedResults.retirementReadyAge && (
                      <ReferenceLine
                        x={displayedResults.retirementReadyAge}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `${inputs.readinessCriteria === 'lastsLifeExp' ? 'Sustainable' : inputs.readinessCriteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite'} Ready: Age ${displayedResults.retirementReadyAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 25
                        }}
                      />
                    )}

                    {/* 3. Assets Depleted Age */}
                    {displayedResults.runOutAge && (
                      <ReferenceLine
                        x={displayedResults.runOutAge}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Assets Run Out: Age ${displayedResults.runOutAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 40
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {((inputs.lifeEvents || []).some(e => e.type === 'haveChild' && e.enabled) || displayedResults.runOutAge !== null) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(99, 102, 241, 0.04)',
                  border: '1px dashed rgba(99, 102, 241, 0.25)',
                  borderRadius: '6px',
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.45'
                }}>
                  <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>💡</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Lifecycle Planning Note:</strong> Temporary deficits or portfolio drawdowns (where your Net Worth line dips or flattens, such as during high-expense childcare/daycare years or early retirement) are a normal and <strong>perfectly acceptable part of a long-term financial roadmap</strong>. As long as your portfolio recovery projections climb back up in the long run, your plan remains sustainable.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Things You’re Currently Managing Section */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, minWidth: '280px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                  📋 Things You’re Currently Managing
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Many people have student loans, car loans, mortgages, or credit card balances. Adding them helps make your plan more accurate.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', fontWeight: '700', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, height: '32px' }}
                onClick={handleCreateCurrentCondition}
              >
                ➕ Add Current Condition
              </button>
            </div>
            
            <div style={{ marginTop: '0.25rem' }}>
              {renderCurrentConditionsList()}
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
              {renderChildCostsBuckets()}
            </div>

            {/* Right Column: Graphs, Snapshot, and Settings */}
            <div className="roadmap-grid-col-right">

              {/* Benchmarks Snapshot */}
              {validation.errors.length === 0 && (() => {
                const activeYear = selectedYear !== null ? selectedYear : Number(inputs.currentAge);
                const yearData = displayedResults.data.find(d => d.age === activeYear);
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
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.netWorth)}</strong>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Portfolio Value</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.portfolio)}</strong>
                      </div>
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
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Taxes Paid</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                          {formatCurrency(yearData.taxes || 0)}
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
                    {(yearData.homeValue > 0 || yearData.mortgageBalance > 0 || yearData.debtBalance > 0) && (
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
      )}

      {/* Calculation Assumptions & Methodology Footer Section (Screen 2 Only, Collapsible) */}
      {activeStep === 2 && (
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
              </div>
            </div>
          )}
        </div>
      )}

      {editingEvent && renderEventForm(editingEvent)}
      {childImpactSummary && renderChildImpactModal()}
      {isBudgetModalOpen && renderBudgetModal()}
      {isSavingsDetailsOpen && renderSavingsDetailsModal()}
      {editingCondition && renderCurrentConditionModal()}

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

                    <button
                      type="button"
                      className="improvement-plan-card-apply-btn"
                      onClick={() => handleApplyImprovementScenario(scenario)}
                    >
                      Apply Scenario
                    </button>
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
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: 'var(--bg-secondary, #1f2937)',
          borderLeft: '4px solid var(--accent-rose, #f43f5e)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
          color: 'var(--text-primary, #f3f4f6)',
          padding: '0.75rem 1.25rem',
          borderRadius: '0.375rem',
          zIndex: 9999,
          fontSize: '0.875rem',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⚠️ {notification}
        </div>
      )}

    </div>
  );
}
