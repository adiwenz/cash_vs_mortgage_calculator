import { calculateMonthlyPayment } from './calculations.js';

// U.S. Federal Tax Data (2026 guidelines)
export const U_S_TAX_DATA = {
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

/**
 * Calculates US Federal Income Tax
 */
export function calculateUSTax(grossIncome, standardDeduction, brackets) {
  const taxable = Math.max(0, grossIncome - standardDeduction);
  let tax = 0;
  let prevLimit = 0;
  for (const bracket of brackets) {
    if (taxable > bracket.limit) {
      tax += (bracket.limit - prevLimit) * bracket.rate;
      prevLimit = bracket.limit;
    } else {
      tax += (taxable - prevLimit) * bracket.rate;
      break;
    }
  }
  return tax;
}

/**
 * Returns the marginal tax rate for a given gross income
 */
export function getMarginalTaxRate(grossIncome, standardDeduction, brackets) {
  const taxable = Math.max(0, grossIncome - standardDeduction);
  if (taxable <= 0) return 0;
  for (const bracket of brackets) {
    if (taxable <= bracket.limit) {
      return bracket.rate;
    }
  }
  return 0.37;
}

/**
 * Estimate additional monthly savings needed to fill a gap
 */
export function estimateAdditionalMonthlySavings(gap, years, annualRate) {
  if (years <= 0 || gap <= 0) return 0;
  const r = (annualRate || 7) / 100 / 12;
  const n = years * 12;
  if (r === 0) return gap / n;
  const fvFactor = (Math.pow(1 + r, n) - 1) / r;
  return gap / fvFactor;
}

/**
 * Distributes a savings total reasonably across standard tax-advantaged and brokerage accounts
 */
export function getReasonableSavingsAllocation(total) {
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
}

/**
 * Unified tax calculator for the budget modal
 */
export function calculateUSTaxForModal(grossIncome, preTaxDeductions, filingStatus) {
  const status = (filingStatus === 'jointly' || filingStatus === 'marriedJointly' || filingStatus === 'married') ? 'married' : 'single';
  const taxConfig = U_S_TAX_DATA[status];
  return calculateUSTax(grossIncome - preTaxDeductions, taxConfig.standardDeduction, taxConfig.brackets);
}

/**
 * Projects payoff timeline for standard loans or credit cards
 */
export function calculateLoanPayoff(debt, currentAge) {
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
}

/**
 * Calculates annual P&I mortgage payment
 */
export function propPIAmount(ev) {
  const p = Number(ev.homePrice) || 0;
  const dp = Number(ev.downPayment) || 0;
  const rate = (Number(ev.mortgageRate) || 6.5) / 100;
  const mortgageTerm = Number(ev.loanTerm) || 30;
  const loanAmount = Math.max(0, p - dp);
  return calculateMonthlyPayment(loanAmount, rate, mortgageTerm) * 12;
}

/**
 * Gets count of children active in timeline at specific age
 */
export function getActiveChildrenCountAtAge(age, lifeEvents) {
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
}

/**
 * Estimates peak child costs across pre-retirement years in today's dollars
 */
export function calculatePeakChildCosts(inp) {
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
}

/**
 * Gets base career income for user at specific age
 */
export function getBaseCareerIncomeAtAge(age, inputs) {
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
}

/**
 * Gets intervals where the active children count is constant
 */
export function getChildCountIntervals(startAge, endAge, lifeEvents, incomeList = []) {
  const intervals = [];
  if (startAge >= endAge) return intervals;
  
  const boundaries = new Set();
  boundaries.add(startAge);
  boundaries.add(endAge);
  
  for (let age = startAge + 1; age < endAge; age++) {
    const prevCount = getActiveChildrenCountAtAge(age - 1, lifeEvents);
    const count = getActiveChildrenCountAtAge(age, lifeEvents);
    if (count !== prevCount) {
      boundaries.add(age);
    }
  }
  
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
}

/**
 * Returns child cost for a timeline interval
 */
export function getChildCostsForInterval(interval, inputs) {
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
}

// IRS retirement limits configuration (configurable for each tax year)
export const RETIREMENT_LIMITS = {
  '401k': {
    employeeLimit: 23500,
    catchUp50Plus: 7500
  },
  '403b': {
    employeeLimit: 23500,
    catchUp50Plus: 7500
  },
  '457b': {
    employeeLimit: 23500,
    catchUp50Plus: 7500
  },
  'traditionalIRA': {
    limit: 7000,
    catchUp50Plus: 1000
  },
  'rothIRA': {
    limit: 7000,
    catchUp50Plus: 1000
  },
  'hsa': {
    individual: 4300,
    family: 8550,
    catchUp55Plus: 1000
  }
};

/**
 * Returns the annual contribution limit for a specific retirement account
 */
export function getAnnualContributionLimit(accountType, age, filingStatus = 'single', hsaCoverageType = null) {
  let limitKey = accountType;
  if (accountType === 'trad401k') limitKey = '401k';
  if (accountType === 'tradIra') limitKey = 'traditionalIRA';
  if (accountType === 'rothIra') limitKey = 'rothIRA';
  if (accountType === 'hsa') limitKey = 'hsa';

  const config = RETIREMENT_LIMITS[limitKey];
  if (!config) return Infinity;

  if (limitKey === '401k' || limitKey === '403b' || limitKey === '457b') {
    let limit = config.employeeLimit;
    if (age >= 50) {
      limit += config.catchUp50Plus;
    }
    return limit;
  }
  if (limitKey === 'traditionalIRA' || limitKey === 'rothIRA') {
    let limit = config.limit;
    if (age >= 50) {
      limit += config.catchUp50Plus;
    }
    return limit;
  }
  if (limitKey === 'hsa') {
    let limit;
    if (hsaCoverageType) {
      limit = hsaCoverageType === 'family' ? config.family : config.individual;
    } else {
      const isMarried = (filingStatus === 'married' || filingStatus === 'jointly' || filingStatus === 'marriedJointly');
      limit = isMarried ? config.family : config.individual;
    }
    if (age >= 55) {
      limit += config.catchUp55Plus;
    }
    return limit;
  }
  return Infinity;
}

/**
 * Returns the monthly contribution limit derived from the annual limit
 */
export function getMonthlyContributionLimit(accountType, age, filingStatus = 'single', hsaCoverageType = null) {
  const annualLimit = getAnnualContributionLimit(accountType, age, filingStatus, hsaCoverageType);
  if (annualLimit === Infinity) return Infinity;
  return annualLimit / 12;
}

/**
 * Caps a monthly contribution amount to the IRS limit and returns metadata
 */
export function capMonthlyContribution(accountType, monthlyAmount, context = {}) {
  const age = context.age ?? 30;
  const filingStatus = context.filingStatus ?? 'single';
  const hsaCoverageType = context.hsaCoverageType ?? null;

  const annualLimit = getAnnualContributionLimit(accountType, age, filingStatus, hsaCoverageType);
  if (annualLimit === Infinity) {
    return {
      cappedAmount: monthlyAmount,
      wasCapped: false,
      annualLimit: Infinity,
      monthlyLimit: Infinity,
      message: ''
    };
  }

  const monthlyLimit = Math.round((annualLimit / 12) * 100) / 100;
  const wasCapped = monthlyAmount > monthlyLimit;
  const cappedAmount = wasCapped ? monthlyLimit : monthlyAmount;

  const formattedAnnual = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(annualLimit);

  const message = wasCapped
    ? `Can't contribute more than the IRS limit of ${formattedAnnual}/yr for this account.`
    : '';

  return {
    cappedAmount,
    wasCapped,
    annualLimit,
    monthlyLimit,
    message
  };
}

/**
 * Returns the contribution limit for a specific account, age, and filing status
 */
export function getRetirementLimit(accountKey, age, filingStatus = 'single') {
  return getAnnualContributionLimit(accountKey, age, filingStatus);
}

export function roundCurrency(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}


