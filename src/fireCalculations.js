/**
 * Mathematical Calculation Engine for the FIRE & Retirement Life Simulator (Refined for Cash Flow Planner)
 */
// Verification comment for playwright only-changed test run

/**
 * Runs a year-by-year simulation from currentAge to lifeExpectancy.
 *
 * @param {Object} inputs - All parameters entered by the user
 * @returns {Object} Results containing year-by-year breakdown and summary metrics
 */
const U_S_TAX_DATA = {
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

function calculateUSTax(grossIncome, standardDeduction, brackets) {
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

function getMarginalTaxRate(grossIncome, standardDeduction, brackets) {
  const taxable = Math.max(0, grossIncome - standardDeduction);
  if (taxable <= 0) return 0;
  for (const bracket of brackets) {
    if (taxable <= bracket.limit) {
      return bracket.rate;
    }
  }
  return 0.37;
}

function solveTraditionalWithdrawal(remainingDeficit, maxPreTaxAvailable, I_0, standardDeduction, nominalBrackets, penaltyRate = 0.0) {
  const P = penaltyRate;
  if (remainingDeficit <= 0) return 0;
  const T_0 = calculateUSTax(I_0, standardDeduction, nominalBrackets);
  const netMax = maxPreTaxAvailable * (1 - P) - (calculateUSTax(I_0 + maxPreTaxAvailable, standardDeduction, nominalBrackets) - T_0);
  if (remainingDeficit >= netMax) {
    return maxPreTaxAvailable;
  }
  let W = remainingDeficit / (1 - P - getMarginalTaxRate(I_0, standardDeduction, nominalBrackets));
  for (let iter = 0; iter < 10; iter++) {
    const taxCurrent = calculateUSTax(I_0 + W, standardDeduction, nominalBrackets);
    const netCurrent = W * (1 - P) - (taxCurrent - T_0);
    const diff = netCurrent - remainingDeficit;
    if (Math.abs(diff) < 0.01) break;
    const marginalRate = getMarginalTaxRate(I_0 + W, standardDeduction, nominalBrackets);
    const slope = 1 - P - marginalRate;
    W -= diff / slope;
    if (W < 0) {
      W = 0;
      break;
    }
    if (W > maxPreTaxAvailable) {
      W = maxPreTaxAvailable;
      break;
    }
  }
  return W;
}

export function getSocialSecurityFactor(claimingAge) {
  const age = Math.max(62, Math.min(70, claimingAge));
  if (age === 67) return 1.0;
  if (age < 67) {
    const monthsEarly = (67 - age) * 12;
    if (monthsEarly <= 36) {
      return 1 - monthsEarly * (5 / 900);
    } else {
      return 1 - (36 * (5 / 900) + (monthsEarly - 36) * (5 / 1200));
    }
  } else {
    const monthsLate = Math.min(36, (age - 67) * 12);
    return 1 + monthsLate * (8 / 1200);
  }
}

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

export function runFireSimulation(inputs) {
  const currentAge = Math.max(0, Number(inputs.currentAge) || 30);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const lifeEvents = inputs.lifeEvents || [];
  const enabledEvents = lifeEvents.filter(e => e.enabled);
  // Find retirement event dynamically
  const retireEvent = enabledEvents.find(e => e.type === 'retire');
  const targetRetirementAge = retireEvent 
    ? Math.max(currentAge, Number(retireEvent.age) || 65) 
    : lifeExpectancy; // default to lifeExpectancy if no retirement event
    
  const retirementSpendingPercent = retireEvent
    ? Number(retireEvent.spendingPercent !== undefined ? retireEvent.spendingPercent : 70) / 100
    : 0.7;

  const expectedReturn = (Number(inputs.expectedReturn) || 7) / 100;
  const postRetirementReturn = inputs.postRetirementReturn !== undefined
    ? (Number(inputs.postRetirementReturn) || 0) / 100
    : expectedReturn;
  const inflationRate = (Number(inputs.inflationRate) || 3) / 100;
  const lifestyleUpgrades = (Number(inputs.lifestyleUpgrades) || 0) / 100;
  const swr = (Number(inputs.swr) || 4) / 100;
  const fireMode = inputs.fireMode || 'traditional'; // 'traditional' | 'coast' | 'barista' | 'lean' | 'fat'

  const includeTaxes = !!inputs.includeTaxes;
  const enableHealthcareModel = inputs.enableHealthcareModel !== false;
  let filingStatus = inputs.filingStatus || 'single';
  if (filingStatus === 'jointly' || filingStatus === 'marriedJointly') {
    filingStatus = 'married';
  }
  const enforceEarlyWithdrawalPenalty = true;
  const isAdvanced = inputs.isAdvancedMode === true || (inputs.allocationRules && inputs.allocationRules.length > 1);

  const ssEvent = enabledEvents.find(e => e.type === 'socialSecurity');
  let socialSecurityDetails = {
    claimAge: 67,
    workingYears: 0,
    isEligible: false,
    indexedEarningsHistory: [],
    top35AnnualEarnings: 0,
    averageTop35AnnualIncome: 0,
    aimeMonthly: 0,
    piaMonthly: 0,
    claimingAgeMultiplier: 0,
    monthlyBenefit: 0,
    annualBenefit: 0,
    adjustmentType: 'Not eligible'
  };

  if (ssEvent) {
    const claimAge = Number(ssEvent.claimingAge !== undefined ? ssEvent.claimingAge : (ssEvent.startAge !== undefined ? ssEvent.startAge : ssEvent.age)) || 67;
    if (claimAge < 62) {
      socialSecurityDetails = {
        claimAge,
        workingYears: (getIncomeHistory(inputs, ssEvent) || []).filter(v => Number(v) > 0).length,
        isEligible: false,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: 0,
        claimingAgeMultiplier: 0,
        monthlyBenefit: 0,
        annualBenefit: 0,
        adjustmentType: 'Not eligible'
      };
    } else if (ssEvent.useEarnings) {
      const incomeHistory = getIncomeHistory(inputs, ssEvent);
      socialSecurityDetails = calculateSocialSecurityBenefit({
        incomeHistory,
        claimAge,
        fullRetirementAge: 67,
        firstBendPoint: ssEvent.firstBendPoint !== undefined ? Number(ssEvent.firstBendPoint) : 1286,
        secondBendPoint: ssEvent.secondBendPoint !== undefined ? Number(ssEvent.secondBendPoint) : 7749
      });
    } else {
      const monthlyBenefitBase = Number(ssEvent.monthlyBenefit) || 0;
      const multRes = calculateClaimingAgeMultiplier({
        claimAge,
        fullRetirementAge: 67
      });
      const monthlyBenefit = monthlyBenefitBase * multRes.multiplier;
      socialSecurityDetails = {
        claimAge,
        workingYears: (getIncomeHistory(inputs, ssEvent) || []).filter(v => Number(v) > 0).length,
        isEligible: true,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: monthlyBenefitBase,
        claimingAgeMultiplier: multRes.multiplier,
        monthlyBenefit,
        annualBenefit: monthlyBenefit * 12,
        adjustmentType: multRes.adjustmentType
      };
    }
  }

  let year0Taxes = 0;
  if (includeTaxes) {
    const simpleIncome = Number(inputs.simpleIncome) || 50000;
    const simpleExpenses = Number(inputs.simpleExpenses) || 42500;
    const rate = simpleIncome > 0 ? ((simpleIncome - simpleExpenses) / simpleIncome) : 0.15;
    const preTaxSavings = simpleIncome * rate;
    const taxableIncome0 = Math.max(0, simpleIncome - preTaxSavings);
    
    const taxConfig = U_S_TAX_DATA[filingStatus] || U_S_TAX_DATA.single;
    const stdDeduction0 = taxConfig.standardDeduction;
    const brackets0 = taxConfig.brackets;
    year0Taxes = calculateUSTax(taxableIncome0, stdDeduction0, brackets0);
  }

  const marriageEvent = enabledEvents.find(e => e.type === 'marriage');
  const spouseMember = (inputs.householdMembers || []).find(m => m.id === 'spouse');
  const hasMarriage = !!marriageEvent;
  const marriageAge = marriageEvent ? (Number(marriageEvent.age) || 40) : 999;
  const weddingAge = marriageEvent ? (Number(marriageEvent.weddingAge) || marriageAge) : 999;
  const includeWeddingCost = marriageEvent ? !!marriageEvent.includeWeddingCost : false;
  const weddingCost = marriageEvent ? (Number(marriageEvent.weddingCost) || 0) : 0;

  const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined ? Number(spouseMember.currentAge) : (marriageEvent && marriageEvent.spouseCurrentAge !== undefined ? Number(marriageEvent.spouseCurrentAge) : currentAge);
  const spouseLifeExpectancy = spouseMember && spouseMember.lifeExpectancy !== undefined ? Number(spouseMember.lifeExpectancy) : (marriageEvent && marriageEvent.spouseLifeExpectancy !== undefined ? Number(marriageEvent.spouseLifeExpectancy) : lifeExpectancy);
  const userAgeWhenSpouseDies = currentAge + (spouseLifeExpectancy - spouseCurrentAge);
  const ageDifference = spouseCurrentAge - currentAge; // spouseAge = age + ageDifference
  
  let spouseIncome = spouseMember ? (Number(spouseMember.income) || 0) : (marriageEvent ? (Number(marriageEvent.spouseIncome) || 0) : 0);
  let spouseGrowth = spouseMember 
    ? (Number(spouseMember.incomeGrowthRate !== undefined ? spouseMember.incomeGrowthRate : spouseMember.growthRate) || 0)
    : (marriageEvent ? (Number(marriageEvent.incomeGrowthRate !== undefined ? marriageEvent.incomeGrowthRate : marriageEvent.growthRate) || 0) : 0);
  if (spouseGrowth > 0.5) spouseGrowth /= 100;

  let spouseSavingsRate = spouseMember ? (Number(spouseMember.savingsRate) || 0) : (marriageEvent ? (Number(marriageEvent.savingsRate) || 0) : 0);
  let spouseCash = spouseMember?.assets ? (Number(spouseMember.assets.cash) || 0) : (marriageEvent ? (Number(marriageEvent.cash) || 0) : 0);
  let spouseInvestments = spouseMember?.assets ? (Number(spouseMember.assets.investments) || 0) : (marriageEvent ? (Number(marriageEvent.investments) || 0) : 0);
  let spouseRetirement = spouseMember?.assets ? (Number(spouseMember.assets.retirement) || 0) : (marriageEvent ? (Number(marriageEvent.retirement) || 0) : 0);

  const spouseDebtStudent = Number(spouseMember?.debts?.student) || Number(marriageEvent?.debtStudent) || 0;
  const spouseDebtCredit = Number(spouseMember?.debts?.credit) || Number(marriageEvent?.debtCredit) || 0;
  const spouseDebtOther = Number(spouseMember?.debts?.other) || Number(marriageEvent?.debtOther) || 0;

  const spouseRetirementSpendingNeed = spouseMember ? (Number(spouseMember.spouseRetirementSpending) || 0) : (marriageEvent ? (Number(marriageEvent.spouseRetirementSpending) || 0) : 0);
  const combinedSpendingAfterMarriage = marriageEvent ? (Number(marriageEvent.combinedSpendingAfterMarriage) || 0) : 0;
  const lifestyleAdjustment = marriageEvent ? (Number(marriageEvent.lifestyleAdjustment) || 0) : 0;
  const housingSavings = marriageEvent ? (Number(marriageEvent.housingSavings) || 0) : 0;
  const housingCost = marriageEvent ? (Number(marriageEvent.housingCost) || 0) : 0;
  
  // Calculate Spouse Social Security details
  let spouseSocialSecurityDetails = null;
  const isSpouseEnabled = hasMarriage;
  if (isSpouseEnabled && spouseMember) {
    const spouseClaimAge = Number(spouseMember.spouseSocialSecurityAge !== undefined ? spouseMember.spouseSocialSecurityAge : 67);
    if (spouseMember.spouseEstimatedSocialSecurityBenefit !== undefined && spouseMember.spouseEstimatedSocialSecurityBenefit !== null && spouseMember.spouseEstimatedSocialSecurityBenefit !== '' && Number(spouseMember.spouseEstimatedSocialSecurityBenefit) > 0) {
      const baseBenefit = Number(spouseMember.spouseEstimatedSocialSecurityBenefit);
      const factor = getSocialSecurityFactor(spouseClaimAge);
      spouseSocialSecurityDetails = {
        claimAge: spouseClaimAge,
        annualBenefit: baseBenefit * factor * 12,
        monthlyBenefit: baseBenefit * factor
      };
    } else if (spouseMember.income > 0) {
      const spouseRetAge = spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== ''
        ? Number(spouseMember.desiredRetirementAge)
        : (targetRetirementAge + (spouseMember.currentAge !== undefined ? spouseMember.currentAge : spouseCurrentAge) - currentAge);
      const spouseWorkYears = Math.max(0, spouseRetAge - 22);
      const spouseIncomeHistory = new Array(spouseWorkYears).fill(Number(spouseMember.income) || 0);
      spouseSocialSecurityDetails = calculateSocialSecurityBenefit({
        incomeHistory: spouseIncomeHistory,
        claimAge: spouseClaimAge
      });
    }
  }

  let maxLifeExpectancy = lifeExpectancy;
  if (hasMarriage) {
    maxLifeExpectancy = Math.max(lifeExpectancy, userAgeWhenSpouseDies);
  }

  const assets = inputs.assets || {};
  const currentConditions = inputs.currentConditions || [];
  
  const customHousesStartingValue = currentConditions
    .filter(c => c.type === 'house')
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);

  const customAssetsStartingValue = currentConditions
    .filter(c => ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type))
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    
  let homeEquityBaseline = (Number(assets.realEstate) || 0) + customHousesStartingValue;
  let debtBalance = 0; // Removed from starting assets, tracked dynamically via debtList

  const hasActiveChild = enabledEvents.some(e => e.type === 'haveChild');
  let incomeList = inputs.incomeList || [];
  let spendingPhases = inputs.spendingPhases || [];

  if (hasActiveChild) {
    const childEvents = enabledEvents.filter(e => e.type === 'haveChild');
    let minChildParentAge = Infinity;
    let maxChildParentAge = -Infinity;
    childEvents.forEach(ev => {
      const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
      const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
      const maxAge = includeCollege ? 22 : 18;
      if (birthAge < minChildParentAge) minChildParentAge = birthAge;
      if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
    });

    const childEndAge = Math.min(maxLifeExpectancy, Math.max(currentAge, maxChildParentAge));
    const childcareStartAge = Math.max(currentAge, minChildParentAge);
    const childcareEndAge = childEndAge;
    const expectedIncEndAge = Math.min(targetRetirementAge, childcareEndAge);
    const hasChildcarePhase = minChildParentAge < maxChildParentAge && maxChildParentAge > currentAge;

    if (hasChildcarePhase) {
      const existingIncChildcare = incomeList.find(inc => inc.id === 'simple-inc-childcare');
      const existingSpendChildcare = spendingPhases.find(p => p.id === 'simple-spend-childcare');

      const needsRegen = !existingIncChildcare || !existingSpendChildcare ||
        existingIncChildcare.startAge !== childcareStartAge ||
        existingIncChildcare.endAge !== expectedIncEndAge ||
        existingSpendChildcare.startAge !== childcareStartAge ||
        existingSpendChildcare.endAge !== childcareEndAge;

      if (needsRegen) {
        // Splitting incomeList
        const cleanIncomeList = incomeList.filter(inc => 
          inc.id !== 'inc-1' && 
          inc.id !== 'simple-inc' && 
          inc.id !== 'simple-inc-prechild' &&
          inc.id !== 'simple-inc-childcare' && 
          inc.id !== 'simple-inc-worksave'
        );
        const wsIncomeAnnual = (Number(inputs.budgetDetails?.income) || (Number(inputs.simpleIncome) / 12) || 4167) * 12;
        const finalChildcareBudgets = inputs.budgetDetails?.childcareBudgets || {};
        let childcareIncome = inputs.budgetDetails?.childcareIncome;
        if (Object.keys(finalChildcareBudgets).length > 0) {
          const minC = Math.min(...Object.keys(finalChildcareBudgets).map(Number));
          childcareIncome = finalChildcareBudgets[minC].income;
        }
        const ccIncomeAnnual = (Number(childcareIncome) || (wsIncomeAnnual / 12)) * 12;

        if (childcareStartAge > currentAge) {
          cleanIncomeList.push({
            id: 'simple-inc-prechild',
            name: 'Salary / Main Income (Standard Work Phase)',
            amount: wsIncomeAnnual,
            frequency: 'yearly',
            startAge: currentAge,
            endAge: childcareStartAge,
            growthRate: 0.03,
            isTaxable: true
          });
        }

        if (expectedIncEndAge > childcareStartAge) {
          cleanIncomeList.push({
            id: 'simple-inc-childcare',
            name: 'Salary / Main Income (Childcare Phase)',
            amount: ccIncomeAnnual,
            frequency: 'yearly',
            startAge: childcareStartAge,
            endAge: expectedIncEndAge,
            growthRate: 0.03,
            isTaxable: true
          });
        }
        if (targetRetirementAge > childcareEndAge) {
          cleanIncomeList.push({
            id: 'simple-inc-worksave',
            name: 'Salary / Main Income (Standard Work Phase)',
            amount: wsIncomeAnnual,
            frequency: 'yearly',
            startAge: childcareEndAge,
            endAge: targetRetirementAge,
            growthRate: 0.03,
            isTaxable: true
          });
        }
        incomeList = cleanIncomeList;

        // Splitting spendingPhases
        const cleanSpendingPhases = spendingPhases.filter(p => 
          p.id !== 'spend-1' && 
          p.id !== 'simple-spend' && 
          p.id !== 'simple-spend-prechild' &&
          p.id !== 'simple-spend-childcare' && 
          p.id !== 'simple-spend-worksave'
        );
        const wsExpensesAnnual = (Number(inputs.budgetDetails?.expenses ? Object.values(inputs.budgetDetails.expenses).reduce((sum, val) => sum + val, 0) : 0) || (Number(inputs.simpleExpenses) / 12) || 3542) * 12;
        let childcareExpensesVal = inputs.budgetDetails?.childcareExpenses;
        if (Object.keys(finalChildcareBudgets).length > 0) {
          const minC = Math.min(...Object.keys(finalChildcareBudgets).map(Number));
          childcareExpensesVal = finalChildcareBudgets[minC].expenses;
        }
        const ccExpensesAnnual = childcareExpensesVal
          ? Object.values(childcareExpensesVal).reduce((sum, val) => sum + val, 0) * 12
          : wsExpensesAnnual;

        if (childcareStartAge > currentAge) {
          cleanSpendingPhases.push({
            id: 'simple-spend-prechild',
            name: 'Lifestyle Spending (Standard Work Phase)',
            amount: wsExpensesAnnual,
            frequency: 'yearly',
            startAge: currentAge,
            endAge: childcareStartAge,
            annualSpending: wsExpensesAnnual
          });
        }

        if (childcareEndAge > childcareStartAge) {
          cleanSpendingPhases.push({
            id: 'simple-spend-childcare',
            name: 'Lifestyle Spending (Childcare Phase)',
            amount: ccExpensesAnnual,
            frequency: 'yearly',
            startAge: childcareStartAge,
            endAge: childcareEndAge,
            annualSpending: ccExpensesAnnual
          });
        }
        if (maxLifeExpectancy > childcareEndAge) {
          cleanSpendingPhases.push({
            id: 'simple-spend-worksave',
            name: 'Lifestyle Spending (Standard Work Phase)',
            amount: wsExpensesAnnual,
            frequency: 'yearly',
            startAge: childcareEndAge,
            endAge: maxLifeExpectancy,
            annualSpending: wsExpensesAnnual
          });
        }
        spendingPhases = cleanSpendingPhases;
      }
    }
  }

  if (!isAdvanced) {
    incomeList = incomeList.map(inc => {
      if (inc.id === 'inc-1' || inc.id === 'simple-inc-worksave' || inc.id === 'simple-inc-prechild' || inc.name.toLowerCase().includes('salary') || inc.name.toLowerCase().includes('main')) {
        if (!inc.id.includes('childcare') && !inc.name.toLowerCase().includes('childcare')) {
          const end = (inc.id === 'simple-inc-prechild') ? inc.endAge : targetRetirementAge;
          return { ...inc, amount: Number(inputs.simpleIncome) || inc.amount, endAge: end };
        }
      }
      return inc;
    });
  }
  if (!hasActiveChild) {
    incomeList = incomeList
      .filter(inc => inc.id !== 'simple-inc-childcare' && inc.id !== 'simple-inc-prechild')
      .map(inc => {
        if (inc.id === 'simple-inc-worksave') {
          return { ...inc, startAge: currentAge };
        }
        return inc;
      });
  }
  const customIncomes = currentConditions
    .filter(c => c.type === 'income')
    .map(c => ({
      id: c.id || `custom-income-${Date.now()}`,
      name: c.name || 'Income Source',
      amount: Number(c.monthlyAmount || 0) * 12,
      startAge: currentAge,
      endAge: c.endAge ? Number(c.endAge) : lifeExpectancy,
      growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : 0.03,
      frequency: 'yearly',
      isTaxable: true
    }));
  const combinedIncomeList = [...incomeList, ...customIncomes];

  // Calculate initial child costs at parent's currentAge in today's dollars
  let initialChildCostsAnnual = 0;
  enabledEvents.forEach(ev => {
    if (ev.type === 'haveChild') {
      const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
      const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
      const childAge = currentAge - birthAge;

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
          initialChildCostsAnnual += annualCost;
        }
      }
    }
  });

  // Calculate excess childcare income boost above standard income
  let excessBoost = 0;
  if (inputs.budgetDetails && inputs.budgetDetails.childcareIncome !== undefined) {
    const ccIncomeAnnual = (Number(inputs.budgetDetails.childcareIncome) || 0) * 12;
    const wsIncomeAnnual = (Number(inputs.budgetDetails.income) || 0) * 12;
    excessBoost = Math.max(0, ccIncomeAnnual - wsIncomeAnnual);
  }

  // Calculate peak childcare cost across the timeline in today's dollars
  let maxChildCostsAnnual = 0;
  const childEventsForPeak = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
  if (childEventsForPeak.length > 0) {
    for (let age = currentAge; age < targetRetirementAge; age++) {
      let yearCost = 0;
      childEventsForPeak.forEach(ev => {
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

  // spendingPhases is already defined and split above if hasActiveChild was true
  if (!isAdvanced) {
    spendingPhases = spendingPhases.map(p => {
      if (p.id === 'spend-1' || p.id === 'simple-spend-worksave' || p.name.toLowerCase().includes('spending') || p.name.toLowerCase().includes('lifestyle')) {
        const amt = Number(inputs.simpleExpenses) || p.amount;
        return { ...p, amount: amt, annualSpending: amt };
      }
      return p;
    });
  }
  if (!hasActiveChild) {
    spendingPhases = spendingPhases
      .filter(p => p.id !== 'simple-spend-childcare' && p.id !== 'simple-spend-prechild')
      .map(p => {
        if (p.id === 'simple-spend-worksave') {
          return { ...p, startAge: currentAge };
        }
        return p;
      });
  }
  const allocationRules = inputs.allocationRules || [];
  const debtList = inputs.debtList || [];

  const yearsToCompute = Math.max(1, maxLifeExpectancy - currentAge);

  // Initialize Debts & Loans Schedule (including custom debts)
  const customDebts = currentConditions
    .filter(c => c.type === 'debt' && c.creditCardHandling !== 'payoff' && (Number(c.value) || 0) > 0)
    .map(c => ({
      id: c.id || `custom-debt-${Date.now()}`,
      name: c.name || c.subtype || 'Debt',
      balance: Number(c.value) || 0,
      interestRate: (Number(c.rate) || 0) / 100,
      payment: Number(c.monthlyAmount || 0) * 12,
      extraPayment: 0,
      frequency: 'monthly',
      paydownPlanEnabled: false,
      startAge: currentAge,
      endAge: c.endAge ? Number(c.endAge) : null
    }));

  let baseActiveLoans = debtList.map(d => ({
    id: d.id,
    name: d.name || 'Loan',
    balance: Number(d.balance) || 0,
    interestRate: (Number(d.interestRate) || 0) / 100,
    payment: d.frequency === 'monthly' ? (Number(d.payment) || 0) * 12 : (Number(d.payment) || 0),
    extraPayment: d.frequency === 'monthly' ? (Number(d.extraPayment) || 0) * 12 : (Number(d.extraPayment) || 0),
    frequency: d.frequency || 'monthly',
    paydownPlanEnabled: !!d.paydownPlanEnabled,
    startAge: d.startAge !== undefined ? Number(d.startAge) : currentAge
  }));

  const startingLoans = [...baseActiveLoans, ...customDebts];

  // Initial sum of loan balances
  let initialDebtSum = startingLoans.reduce((sum, l) => sum + l.balance, 0);

  // Track Milestones state
  let retirementIncomeSourcesInTodayDollars = 0;
  enabledEvents.forEach(ev => {
    if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
      let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
      if (ev.type === 'socialSecurity') {
        monthlyBenefit = socialSecurityDetails.monthlyBenefit;
      }
      retirementIncomeSourcesInTodayDollars += monthlyBenefit * 12;
    }
  });

  let retirementReadyAge = null;

  const cashReturnRate = 0.025; // 2.5% conservative growth rate for cash and emergency fund

  // Helper to format currency
  function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  }

  function getAssetLabel(key) {
    const labels = {
      cash: 'Cash',
      emergencyFund: 'Emergency Fund',
      brokerage: 'Taxable Brokerage',
      trad401k: 'Traditional 401k',
      tradIra: 'Traditional IRA',
      rothIra: 'Roth IRA',
      hsa: 'HSA',
      other: 'Other Assets'
    };
    return labels[key] || key;
  }

  const executeSimulation = (targetRetirementAge, customLifeExpectancy = null) => {
    const simLifeExpectancy = customLifeExpectancy || maxLifeExpectancy;
    const simYearsToCompute = Math.max(1, simLifeExpectancy - currentAge);
    const simPhases = getNormalizedPhases(inputs);
    const preRetirementPhases = simPhases.filter(p => p.type !== 'retire');
    let balances = {
      cash: Number(assets.cash) || 0,
      emergencyFund: Number(assets.emergencyFund) || 0,
      brokerage: Number(assets.brokerage) || 0,
      trad401k: Number(assets.trad401k) || 0,
      tradIra: Number(assets.tradIra) || 0,
      rothIra: Number(assets.rothIra) || 0,
      hsa: Number(assets.hsa) || 0,
      other: Number(assets.other) || 0
    };

    // Add starting balances from currentConditions
    currentConditions.forEach(cond => {
      const val = Number(cond.value) || 0;
      if (val <= 0) return;
      if (cond.type === 'checkingSavings') {
        balances.cash += val;
      } else if (cond.type === 'brokerage') {
        balances.brokerage += val;
      } else if (cond.type === 'retirement') {
        const sub = cond.subtype || 'trad401k';
        if (balances[sub] !== undefined) {
          balances[sub] += val;
        }
      } else if (cond.type === 'asset') {
        balances.other += val;
      }
    });

    let activeLoans = startingLoans.map(l => ({
      ...l,
      totalInterestPaid: 0,
      payoffAge: null
    }));

    // Set up custom conditions lists
    let customAssets = currentConditions
      .filter(c => ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type))
      .map(c => ({
        id: c.id,
        type: c.type,
        subtype: c.subtype,
        name: c.name,
        balance: Number(c.value) || 0,
        growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : null,
        monthlyContribution: Number(c.monthlyAmount) || 0,
        endAge: c.endAge ? Number(c.endAge) : null
      }));

    let customHouses = currentConditions
      .filter(c => c.type === 'house')
      .map(c => ({
        id: c.id,
        name: c.name,
        value: Number(c.value) || 0,
        growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : 0.03, // 3% default appreciation
        monthlyCost: Number(c.monthlyAmount) || 0,
        endAge: c.endAge ? Number(c.endAge) : null
      }));

    let customChildren = currentConditions
      .filter(c => c.type === 'child')
      .map(c => ({
        id: c.id,
        name: c.name,
        monthlyCost: Number(c.monthlyAmount) || 0,
        growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : inflationRate,
        endAge: c.endAge ? Number(c.endAge) : null
      }));

    let customObligations = currentConditions
      .filter(c => c.type === 'obligation' || (c.type === 'debt' && (c.creditCardHandling === 'payoff' || !(Number(c.value) > 0))))
      .map(c => ({
        id: c.id,
        name: c.name || (c.type === 'debt' ? `${c.subtype || 'Debt'} Payment` : 'Obligation'),
        monthlyCost: Number(c.monthlyAmount) || 0,
        growthRate: (c.type === 'debt') ? 0 : (c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : inflationRate),
        endAge: c.endAge ? Number(c.endAge) : null
      }));

    let hasRunOut = false;
    let runOutAge = null;
    let endingSurplusShortfall = 0;
    let cumulativeShortfall = 0;
    let initialSpending;
    const initialPhase = spendingPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge);
    if (initialPhase) {
      if (initialPhase.frequency === 'monthly') {
        initialSpending = (Number(initialPhase.amount) || 0) * 12;
      } else if (initialPhase.frequency === 'yearly') {
        initialSpending = Number(initialPhase.amount) || 0;
      } else {
        initialSpending = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
      }
    } else if (spendingPhases.length > 0) {
      const firstPhase = spendingPhases[0];
      if (firstPhase.frequency === 'monthly') {
        initialSpending = (Number(firstPhase.amount) || 0) * 12;
      } else if (firstPhase.frequency === 'yearly') {
        initialSpending = Number(firstPhase.amount) || 0;
      } else {
        initialSpending = Number(firstPhase.annualSpending) || Number(firstPhase.amount) || 0;
      }
    } else {
      initialSpending = Number(inputs.currentExpenses) || Number(inputs.simpleExpenses) || 42500;
    }

    if (!isAdvanced && includeTaxes) {
      initialSpending = Math.max(0, initialSpending - year0Taxes);
    }
    
    let lastWorkingYearSpendingNominal = initialSpending;
    let userLastWorkingSpendingNominal = initialSpending;
    let lastWorkingYearUserSpendingNominal = initialSpending;
    let purchasedProperties = [];
    let isCoasting = false;
    let coastAge = null;
    let logs = [];
    let dynamicMilestones = [];
    let retirementReadyReached = false;

    let standardDeduction = 0;
    let nominalBrackets = [];
    let taxableIncome = 0;
    let annualEarlyWithdrawalPenalties = 0;

    const withdrawFromCategory = (category, amountNeeded) => {
      let remaining = amountNeeded;
      
      const matchingCustoms = customAssets.filter(ca => {
        if (category === 'cash') return ca.type === 'checkingSavings';
        if (category === 'emergencyFund') return ca.type === 'emergencyFund';
        if (category === 'brokerage') return ca.type === 'brokerage';
        if (category === 'other') return ca.type === 'asset';
        if (ca.type === 'retirement') return ca.subtype === category;
        return false;
      });

      const baseBal = balances[category] || 0;
      const customSum = matchingCustoms.reduce((sum, ca) => sum + ca.balance, 0);
      const totalCategoryVal = baseBal + customSum;

      if (totalCategoryVal <= 0) return 0;

      const totalToWithdraw = Math.min(totalCategoryVal, remaining);

      // Proportional deduction
      const baseRatio = totalCategoryVal > 0 ? (baseBal / totalCategoryVal) : 0;
      const withdrawnBase = totalToWithdraw * baseRatio;
      if (balances[category] !== undefined) {
        balances[category] = Math.max(0, balances[category] - withdrawnBase);
      }

      matchingCustoms.forEach(ca => {
        const caRatio = totalCategoryVal > 0 ? (ca.balance / totalCategoryVal) : 0;
        ca.balance = Math.max(0, ca.balance - (totalToWithdraw * caRatio));
      });

      remaining -= totalToWithdraw;
      return totalToWithdraw;
    };

    // Drawdowns / Shortfall coverage order
    const coverShortfall = (amountToDeduct, age) => {
      let remaining = amountToDeduct;
      
      // Withdrawal order: Cash -> Emergency Fund -> Brokerage -> Trad accounts (grossed for taxes) -> Roth IRA -> HSA -> Other
      const drawdownSequence = ['cash', 'emergencyFund', 'brokerage'];
    
      for (const key of drawdownSequence) {
        const withdrawn = withdrawFromCategory(key, remaining);
        remaining -= withdrawn;
        if (remaining <= 0) return 0;
      }

      // Pre-tax accounts (Traditional 401k & IRA) withdrawals are taxable post-retirement
      if (includeTaxes) {
        const customPreTaxSum = customAssets
          .filter(ca => ca.type === 'retirement' && (ca.subtype === 'trad401k' || ca.subtype === 'tradIra'))
          .reduce((sum, ca) => sum + ca.balance, 0);
        const maxPreTaxAvailable = (balances.trad401k || 0) + (balances.tradIra || 0) + customPreTaxSum;
        if (maxPreTaxAvailable > 0 && remaining > 0) {
          const pRate = (enforceEarlyWithdrawalPenalty && age < 59.5) ? 0.10 : 0.0;
          const totalGrossPreTaxWithdrawal = solveTraditionalWithdrawal(
            remaining,
            maxPreTaxAvailable,
            taxableIncome,
            standardDeduction,
            nominalBrackets,
            pRate
          );

          const T_0 = calculateUSTax(taxableIncome, standardDeduction, nominalBrackets);
          const T_final = calculateUSTax(taxableIncome + totalGrossPreTaxWithdrawal, standardDeduction, nominalBrackets);
          const penalty = totalGrossPreTaxWithdrawal * pRate;
          const actualNetProceeds = totalGrossPreTaxWithdrawal - (T_final - T_0) - penalty;
          annualEarlyWithdrawalPenalties += penalty;

          let withdrawalRemaining = totalGrossPreTaxWithdrawal;
          const preTaxSequence = ['trad401k', 'tradIra'];
          for (const key of preTaxSequence) {
            const withdrawn = withdrawFromCategory(key, withdrawalRemaining);
            withdrawalRemaining -= withdrawn;
          }

          remaining -= actualNetProceeds;
          taxableIncome += totalGrossPreTaxWithdrawal;
        }
      } else {
        const preTaxSequence = ['trad401k', 'tradIra'];
        for (const key of preTaxSequence) {
          const customPreTaxSum = customAssets
            .filter(ca => ca.type === 'retirement' && ca.subtype === key)
            .reduce((sum, ca) => sum + ca.balance, 0);
          const totalAvail = (balances[key] || 0) + customPreTaxSum;
          if (totalAvail > 0) {
            const pRate = (enforceEarlyWithdrawalPenalty && age < 59.5) ? 0.10 : 0.0;
            const grossNeeded = remaining / (1 - pRate);
            const withdrawn = withdrawFromCategory(key, grossNeeded);
            const penalty = withdrawn * pRate;
            const netProceeds = withdrawn - penalty;
            remaining -= netProceeds;
            annualEarlyWithdrawalPenalties += penalty;
            if (remaining <= 0.01) return 0;
          }
        }
      }

      // Roth IRA, HSA, Other
      const taxFreeSequence = ['rothIra', 'hsa', 'other'];
      for (const key of taxFreeSequence) {
        const withdrawn = withdrawFromCategory(key, remaining);
        remaining -= withdrawn;
        if (remaining <= 0) return 0;
      }

      return remaining; // Leftover shortfall
    };

    // Helper to withdraw for down payments
    const deductFromLiquidAssets = (amountToDeduct, age) => {
      let remaining = amountToDeduct;
      // Prefer cash / emergency fund / brokerage / other for large capital expenditures
      const order = ['cash', 'emergencyFund', 'brokerage', 'other', 'rothIra', 'tradIra', 'trad401k', 'hsa'];
      for (const assetKey of order) {
        const customPreTaxSum = customAssets
          .filter(ca => ca.type === 'retirement' && ca.subtype === assetKey)
          .reduce((sum, ca) => sum + ca.balance, 0);
        const totalAvail = (balances[assetKey] || 0) + customPreTaxSum;
        if (totalAvail > 0) {
          if (assetKey === 'tradIra' || assetKey === 'trad401k') {
            const pRate = (enforceEarlyWithdrawalPenalty && age < 59.5) ? 0.10 : 0.0;
            const grossNeeded = remaining / (1 - pRate);
            const withdrawn = withdrawFromCategory(assetKey, grossNeeded);
            const penalty = withdrawn * pRate;
            const netProceeds = withdrawn - penalty;
            remaining -= netProceeds;
            annualEarlyWithdrawalPenalties += penalty;
          } else {
            const withdrawn = withdrawFromCategory(assetKey, remaining);
            remaining -= withdrawn;
          }
          if (remaining <= 0.01) break;
        }
      }
      return remaining;
    };

  // Run simulation year-by-year
  for (let year = 0; year <= simYearsToCompute; year++) {
    const age = currentAge + year;
    const nominalFactor = Math.pow(1 + inflationRate, year);
    annualEarlyWithdrawalPenalties = 0;
    const isUserAlive = age <= lifeExpectancy;
    const spouseAge = age + ageDifference;
    const isSpouseActive = hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies;
    const isSpouseAlive = isSpouseActive && spouseAge <= spouseLifeExpectancy;
    const spouseRetirementAge = (spouseMember && spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== '')
      ? Number(spouseMember.desiredRetirementAge)
      : (marriageEvent && marriageEvent.spouseDesiredRetirementAge !== undefined && marriageEvent.spouseDesiredRetirementAge !== null && marriageEvent.spouseDesiredRetirementAge !== ''
         ? Number(marriageEvent.spouseDesiredRetirementAge)
         : (targetRetirementAge + ageDifference));
    const isSpouseWorking = isSpouseAlive && spouseAge < spouseRetirementAge;
    const spouseSocialSecurityAge = spouseMember ? (Number(spouseMember.spouseSocialSecurityAge) || 67) : 67;

    // Spouse assets injection
    if (hasMarriage && age === marriageAge) {
      balances.cash += spouseCash * nominalFactor;
      balances.brokerage += spouseInvestments * nominalFactor;
      balances.trad401k += spouseRetirement * nominalFactor;
      dynamicMilestones.push({
        age,
        label: `Married! Spouse assets injected: +${formatCurrency((spouseCash + spouseInvestments + spouseRetirement) * nominalFactor)}`,
        type: 'marriage',
        isMilestone: true
      });
    }

    // Wedding cost deduction
    if (hasMarriage && includeWeddingCost && age === weddingAge) {
      const leftoverWedding = deductFromLiquidAssets(weddingCost * nominalFactor, age);
      if (leftoverWedding > 0.01) {
        hasRunOut = true;
        if (runOutAge === null) {
          runOutAge = age;
        }
      }
      dynamicMilestones.push({
        age,
        label: `Wedding Cost: -${formatCurrency(weddingCost * nominalFactor)}`,
        type: 'wedding',
        isMilestone: false
      });
    }

    // Spouse debts injection
    if (hasMarriage && age === marriageAge) {
      if (spouseDebtStudent > 0) {
        activeLoans.push({
          id: 'spouse-student',
          name: 'Spouse Student Loan',
          balance: spouseDebtStudent * nominalFactor,
          interestRate: 0.05,
          payment: Math.max(1200, spouseDebtStudent * 0.12) * nominalFactor,
          extraPayment: 0,
          frequency: 'monthly',
          paydownPlanEnabled: false,
          startAge: marriageAge,
          totalInterestPaid: 0,
          payoffAge: null
        });
      }
      if (spouseDebtCredit > 0) {
        activeLoans.push({
          id: 'spouse-credit',
          name: 'Spouse Credit Card',
          balance: spouseDebtCredit * nominalFactor,
          interestRate: 0.18,
          payment: Math.max(600, spouseDebtCredit * 0.24) * nominalFactor,
          extraPayment: 0,
          frequency: 'monthly',
          paydownPlanEnabled: false,
          startAge: marriageAge,
          totalInterestPaid: 0,
          payoffAge: null
        });
      }
      if (spouseDebtOther > 0) {
        activeLoans.push({
          id: 'spouse-other',
          name: 'Spouse Other Loan',
          balance: spouseDebtOther * nominalFactor,
          interestRate: 0.07,
          payment: Math.max(600, spouseDebtOther * 0.12) * nominalFactor,
          extraPayment: 0,
          frequency: 'monthly',
          paydownPlanEnabled: false,
          startAge: marriageAge,
          totalInterestPaid: 0,
          payoffAge: null
        });
      }
    }

    // Calculate child costs for this year (in today's dollars, then inflated)
    let yearChildCostsToday = 0;
    enabledEvents.forEach(ev => {
      if (ev.type === 'haveChild') {
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
            if (childAge >= 0 && childAge <= 4) {
              annualCost = ages0to4;
            } else if (childAge >= 5 && childAge <= 12) {
              annualCost = ages5to12;
            } else if (childAge >= 13 && childAge <= 18) {
              annualCost = ages13to18;
            } else if (childAge >= 19 && childAge <= 22) {
              annualCost = ages19to22;
            }
            yearChildCostsToday += annualCost;
          }
        }
      }
    });
    let yearChildCosts = yearChildCostsToday * nominalFactor;

    // Set progressive tax values for this year (adjusted for inflation)
    let currentFilingStatus = filingStatus;
    if (hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies) {
      currentFilingStatus = (marriageEvent && marriageEvent.filingStatus) || 'jointly';
    }
    if (currentFilingStatus === 'jointly' || currentFilingStatus === 'marriedJointly') {
      currentFilingStatus = 'married';
    }
    const taxConfig = U_S_TAX_DATA[currentFilingStatus] || U_S_TAX_DATA.single;
    standardDeduction = taxConfig.standardDeduction * nominalFactor;
    nominalBrackets = taxConfig.brackets.map(b => ({
      limit: b.limit === Infinity ? Infinity : b.limit * nominalFactor,
      rate: b.rate
    }));

    // ----------------------------------------------------
    // 0. Asset Compounding (only from year > 0)
    // ----------------------------------------------------
    if (year > 0) {
      const activeReturnRate = (age - 1) >= targetRetirementAge ? postRetirementReturn : expectedReturn;
      balances.brokerage *= (1 + activeReturnRate);
      balances.trad401k *= (1 + activeReturnRate);
      balances.tradIra *= (1 + activeReturnRate);
      balances.rothIra *= (1 + activeReturnRate);
      balances.hsa *= (1 + activeReturnRate);
      balances.other *= (1 + activeReturnRate);
      balances.cash *= (1 + activeReturnRate);
      balances.emergencyFund *= (1 + activeReturnRate);

      if (cumulativeShortfall > 0) {
        const activeReturnRate = (age - 1) >= targetRetirementAge ? postRetirementReturn : expectedReturn;
        cumulativeShortfall *= (1 + activeReturnRate);
      }

      // Compound custom assets
      customAssets.forEach(ca => {
        if (ca.balance <= 0) return;
        if (ca.endAge !== null && age > ca.endAge) {
          ca.balance = 0;
          return;
        }
        let rateToApply = ca.growthRate;
        if (rateToApply === null) {
          if (ca.type === 'checkingSavings') rateToApply = activeReturnRate;
          else rateToApply = activeReturnRate;
        }
        ca.balance *= (1 + rateToApply);
      });

      // Compound custom houses
      customHouses.forEach(h => {
        if (h.value <= 0) return;
        if (h.endAge !== null && age > h.endAge) {
          h.value = 0;
          return;
        }
        h.value *= (1 + h.growthRate);
      });
    }

    // ----------------------------------------------------
    // 0.5. One-time Asset Transfers
    // ----------------------------------------------------
    enabledEvents.forEach(ev => {
      if (ev.type === 'assetTransfer' && age === Number(ev.transferAge)) {
        const fromAsset = ev.fromAsset;
        const toAsset = ev.toAsset;
        const amount = Number(ev.amount) || 0;
        
        if (balances[fromAsset] !== undefined && balances[toAsset] !== undefined) {
          const actualTransfer = Math.max(0, Math.min(balances[fromAsset], amount));
          balances[fromAsset] -= actualTransfer;
          balances[toAsset] += actualTransfer;
          if (actualTransfer > 0) {
            dynamicMilestones.push({
              age,
              label: `Transfer: ${formatCurrency(actualTransfer)} from ${getAssetLabel(fromAsset)} to ${getAssetLabel(toAsset)}`,
              type: 'assetTransfer',
              isMilestone: false
            });
          }
        }
      }
    });

    // ----------------------------------------------------
    // 1. Incomes Calculations
    // ----------------------------------------------------
    let annualIncome = 0;
    taxableIncome = 0;

    combinedIncomeList.forEach(inc => {
      let effectiveEndAge = Math.min(inc.endAge !== undefined ? inc.endAge : targetRetirementAge, targetRetirementAge);
      if (inc.id && typeof inc.id === 'string' && inc.id.startsWith('child-income-boost')) {
        effectiveEndAge = inc.endAge;
      } else if (!isAdvanced) {
        if (inc.id === 'inc-1' || inc.id === 'simple-inc-worksave' || inc.id === 'simple-inc-prechild' || inc.name.toLowerCase().includes('salary') || inc.name.toLowerCase().includes('main')) {
          if (!inc.id.includes('childcare') && !inc.id.includes('prechild') && !inc.name.toLowerCase().includes('childcare')) {
            effectiveEndAge = targetRetirementAge;
          }
        }
      }
      if (age >= inc.startAge && age < effectiveEndAge) {
        // Grow incomes from currentAge instead of startAge so that future-starting phases 
        // maintain their specified purchasing power in today's dollars.
        const yearsGrown = age - currentAge;
        let amount;
        if (inc.id === 'simple-inc-childcare') {
          const C = getActiveChildrenCountAtAge(age, inputs.lifeEvents);
          const wsIncome = Number(inputs.budgetDetails?.income) || (Number(inputs.simpleIncome) / 12) || 4167;
          let baseCcIncome = wsIncome; // DEFAULT: NO AUTO-BUMP
          
          const activePhaseForAge = simPhases.find(p => age >= p.startAge && age < p.endAge && p.type === 'childcare');
          let hasSavedPhase = false;
          if (activePhaseForAge && inputs.budgetDetails?.phases) {
            hasSavedPhase = inputs.budgetDetails.phases.some(p => p.id === activePhaseForAge.id || Number(p.startAge) === activePhaseForAge.startAge);
          }
          if (activePhaseForAge && hasSavedPhase) {
            baseCcIncome = activePhaseForAge.income;
          } else if (inputs.budgetDetails?.childcareBudgets?.[C]) {
            baseCcIncome = Number(inputs.budgetDetails.childcareBudgets[C].income);
          } else if (inputs.budgetDetails?.childcareBudgets && Object.keys(inputs.budgetDetails.childcareBudgets).length > 0) {
            if (C > 0) {
              const occurringCounts = Object.keys(inputs.budgetDetails.childcareBudgets).map(Number).filter(k => k <= C);
              if (occurringCounts.length > 0) {
                const bestC = Math.max(...occurringCounts);
                baseCcIncome = Number(inputs.budgetDetails.childcareBudgets[bestC].income);
              } else {
                const configuredKeys = Object.keys(inputs.budgetDetails.childcareBudgets).map(Number);
                const refC = configuredKeys[0];
                const refIncome = Number(inputs.budgetDetails.childcareBudgets[refC].income);
                let boostPerChild = 0;
                if (refC > 0 && refIncome > wsIncome) {
                  boostPerChild = (refIncome - wsIncome) / refC;
                }
                baseCcIncome = wsIncome + boostPerChild * C;
              }
            } else {
              baseCcIncome = wsIncome;
            }
          } else if (C > 0 && inputs.budgetDetails?.childcareIncome !== undefined) {
            // Keep backwards compatibility for old childcareIncome
            const oldCcIncome = Number(inputs.budgetDetails.childcareIncome);
            if (oldCcIncome > wsIncome) {
              let initialCount = 0;
              const currentAgeVal = Number(inputs.currentAge) || 30;
              (inputs.lifeEvents || []).forEach(ev => {
                if (ev.type === 'haveChild' && ev.enabled) {
                  const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
                  const childAge = currentAgeVal - birthAge;
                  const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
                  const maxAge = includeCollege ? 22 : 18;
                  if (childAge >= 0 && childAge < maxAge) {
                    initialCount++;
                  }
                }
              });
              let boostForOne = 0;
              if (initialCount > 0) {
                boostForOne = (oldCcIncome - wsIncome) / initialCount;
              } else {
                boostForOne = oldCcIncome - wsIncome;
              }
              baseCcIncome = wsIncome + boostForOne * C;
            } else {
              baseCcIncome = oldCcIncome;
            }
          } else if (C === 0) {
            baseCcIncome = wsIncome;
          }
          
          // Subtract any child-income-boost items already in combinedIncomeList to prevent double counting
          let activeBoostMonthly = 0;
          combinedIncomeList.forEach(otherInc => {
            if (otherInc.id && typeof otherInc.id === 'string' && otherInc.id.startsWith('child-income-boost')) {
              let otherEffectiveEndAge = Math.min(otherInc.endAge !== undefined ? otherInc.endAge : targetRetirementAge, targetRetirementAge);
              if (age >= otherInc.startAge && age < otherEffectiveEndAge) {
                const boostYearly = otherInc.frequency === 'monthly' ? Number(otherInc.amount) * 12 : Number(otherInc.amount);
                activeBoostMonthly += boostYearly / 12;
              }
            }
          });
          const boostAlreadyIncluded = Math.max(0, baseCcIncome - wsIncome);
          const overlap = Math.min(activeBoostMonthly, boostAlreadyIncluded);
          baseCcIncome = Math.max(0, baseCcIncome - overlap);

          const baseIncomeAnnual = baseCcIncome * 12;
          amount = baseIncomeAnnual * Math.pow(1 + (Number(inc.growthRate) || 0), yearsGrown);
        } else {
          const baseAmount = inc.frequency === 'monthly' ? Number(inc.amount) * 12 : Number(inc.amount);
          amount = baseAmount * Math.pow(1 + (Number(inc.growthRate) || 0), yearsGrown);
        }

        // Apply Barista FIRE salary overrides: job salary drops to 0
        const hasBaristaActive = enabledEvents.some(e => e.type === 'baristaFire' && age >= Number(e.startAge));
        if (hasBaristaActive) {
          if (inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
            amount = 0;
          }
        }

        // Apply Sabbaticals
        enabledEvents.forEach(ev => {
          if (ev.type === 'sabbatical') {
            const start = Number(ev.startAge);
            const end = Number(ev.endAge);
            if (age >= start && age < end) {
              const reduction = Number(ev.incomeReduction) || 0;
              amount = Math.max(0, amount * (1 - reduction / 100));
            }
          }
        });

        annualIncome += amount;
        if (inc.isTaxable) {
          taxableIncome += amount;
        }
      }
    });

    let spouseIncomeThisYear = 0;
    if (hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies && spouseAge < spouseRetirementAge && age < targetRetirementAge) {
      spouseIncomeThisYear = spouseIncome * Math.pow(1 + spouseGrowth, age - marriageAge);
      annualIncome += spouseIncomeThisYear;
      taxableIncome += spouseIncomeThisYear;
    }


    // Add Barista FIRE part-time incomes
    enabledEvents.forEach(ev => {
      if (ev.type === 'baristaFire' && age >= Number(ev.startAge)) {
        const partTimeInc = Number(ev.partTimeIncome) || 0;
        const nominalPartTime = partTimeInc * nominalFactor;
        annualIncome += nominalPartTime;
        taxableIncome += nominalPartTime;
      }
    });

    // Add retirement income sources (Social Security, pension, rentalIncome, annuity, otherRetirementIncome)
    enabledEvents.forEach(ev => {
      if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
        const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
        if (age >= claimingAge) {
          let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
          if (ev.type === 'socialSecurity') {
            monthlyBenefit = socialSecurityDetails.monthlyBenefit;
          }
          let annualAmt = monthlyBenefit * 12;
          if (ev.inflationAdjusted || ev.type === 'socialSecurity') {
            annualAmt = annualAmt * nominalFactor;
          }
          annualIncome += annualAmt;
          taxableIncome += annualAmt;
        }
      }
    });

    // Add spouse Social Security if married and spouse is alive and claiming age is reached
    if (isSpouseAlive && spouseSocialSecurityDetails && spouseAge >= spouseSocialSecurityDetails.claimAge) {
      const spouseSSAmt = spouseSocialSecurityDetails.annualBenefit * nominalFactor;
      annualIncome += spouseSSAmt;
      taxableIncome += spouseSSAmt;
    }

    // Add windfalls/inheritances / business sales
    let windfallReceived = 0;
    enabledEvents.forEach(ev => {
      if ((ev.type === 'windfall' || ev.type === 'inheritance' || ev.type === 'sellBusiness') && age === Number(ev.ageReceived || ev.age)) {
        const amt = Number(ev.amount) || 0;
        const tax = (Number(ev.taxRate) || 0) / 100;
        windfallReceived += amt * (1 - tax);
      }
    });

    // ----------------------------------------------------
    // 2. Expenses Calculations
    // ----------------------------------------------------
    let annualExpenses = 0;

    // Load spending phase
    const activePhase = spendingPhases.find(p => age >= p.startAge && age < p.endAge);
    let baseSpending;
    if (activePhase) {
      if (activePhase.id === 'simple-spend-childcare') {
        const C = getActiveChildrenCountAtAge(age, inputs.lifeEvents);
        const wsExpenses = Number(inputs.budgetDetails?.expenses ? Object.values(inputs.budgetDetails.expenses).reduce((sum, val) => sum + val, 0) : 0) || (Number(inputs.simpleExpenses) / 12) || 3542;
        let baseCcExpenses = wsExpenses;
        
        const activePhaseForAge = simPhases.find(p => age >= p.startAge && age < p.endAge && p.type === 'childcare');
        let hasSavedPhase = false;
        if (activePhaseForAge && inputs.budgetDetails?.phases) {
          hasSavedPhase = inputs.budgetDetails.phases.some(p => p.id === activePhaseForAge.id || Number(p.startAge) === activePhaseForAge.startAge);
        }
        if (activePhaseForAge && hasSavedPhase && activePhaseForAge.expenses) {
          baseCcExpenses = Object.values(activePhaseForAge.expenses).reduce((sum, val) => sum + val, 0);
        } else if (inputs.budgetDetails?.childcareBudgets?.[C]) {
          const ccExp = inputs.budgetDetails.childcareBudgets[C].expenses;
          baseCcExpenses = Object.values(ccExp).reduce((sum, val) => sum + val, 0);
        } else if (inputs.budgetDetails?.childcareBudgets && Object.keys(inputs.budgetDetails.childcareBudgets).length > 0) {
          if (C > 0) {
            const occurringCounts = Object.keys(inputs.budgetDetails.childcareBudgets).map(Number).filter(k => k <= C);
            if (occurringCounts.length > 0) {
              const bestC = Math.max(...occurringCounts);
              const ccExp = inputs.budgetDetails.childcareBudgets[bestC].expenses;
              baseCcExpenses = Object.values(ccExp).reduce((sum, val) => sum + val, 0);
            } else {
              const configuredKeys = Object.keys(inputs.budgetDetails.childcareBudgets).map(Number);
              const refC = configuredKeys[0];
              const ccExp = inputs.budgetDetails.childcareBudgets[refC].expenses;
              baseCcExpenses = Object.values(ccExp).reduce((sum, val) => sum + val, 0);
            }
          } else {
            baseCcExpenses = wsExpenses;
          }
        } else if (C > 0 && inputs.budgetDetails?.childcareExpenses) {
          baseCcExpenses = Object.values(inputs.budgetDetails.childcareExpenses).reduce((sum, val) => sum + val, 0);
        } else if (C === 0) {
          baseCcExpenses = wsExpenses;
        }
        baseSpending = baseCcExpenses * 12;
      } else {
        if (activePhase.frequency === 'monthly') {
          baseSpending = (Number(activePhase.amount) || 0) * 12;
        } else if (activePhase.frequency === 'yearly') {
          baseSpending = Number(activePhase.amount) || 0;
        } else {
          baseSpending = Number(activePhase.annualSpending) || Number(activePhase.amount) || 0;
        }
      }
    } else if (spendingPhases.length > 0) {
      const firstPhase = spendingPhases[0];
      if (firstPhase.frequency === 'monthly') {
        baseSpending = (Number(firstPhase.amount) || 0) * 12;
      } else if (firstPhase.frequency === 'yearly') {
        baseSpending = Number(firstPhase.amount) || 0;
      } else {
        baseSpending = Number(firstPhase.annualSpending) || Number(firstPhase.amount) || 0;
      }
    } else {
      baseSpending = Number(inputs.currentExpenses) || Number(inputs.simpleExpenses) || 42500;
    }

    const rate = (activePhase && activePhase.inflationOverride !== null && activePhase.inflationOverride !== undefined && activePhase.inflationOverride !== '')
      ? (Number(activePhase.inflationOverride) / 100)
      : inflationRate;

    let adjustedBase = baseSpending;
    if (!isAdvanced && includeTaxes) {
      adjustedBase = Math.max(0, baseSpending - year0Taxes);
    }

    let spendingForYear = adjustedBase * Math.pow(1 + rate + lifestyleUpgrades, age - currentAge);
    
    // Check if marriage is active this year (pre-retirement)
    if (hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies && age < targetRetirementAge) {
      if (!isAdvanced && combinedSpendingAfterMarriage > 0) {
        spendingForYear = combinedSpendingAfterMarriage * Math.pow(1 + rate + lifestyleUpgrades, age - currentAge);
      } else if (!isAdvanced) {
        // Auto-estimate combined spending
        const spouseIncomeNominal = spouseIncome * Math.pow(1 + spouseGrowth, age - marriageAge);
        let partnerTax = 0;
        if (includeTaxes) {
          const taxConfigSingle = U_S_TAX_DATA.single;
          const stdDeductionSingleNominal = taxConfigSingle.standardDeduction * nominalFactor;
          const bracketsSingleNominal = taxConfigSingle.brackets.map(b => ({
            limit: b.limit === Infinity ? Infinity : b.limit * nominalFactor,
            rate: b.rate
          }));
          partnerTax = calculateUSTax(spouseIncomeNominal, stdDeductionSingleNominal, bracketsSingleNominal);
        }
        const partnerTakeHome = spouseIncomeNominal - partnerTax;
        const partnerPersonalSpending = partnerTakeHome * (1 - spouseSavingsRate / 100);
        
        const housingSavingsYearly = housingSavings * nominalFactor;
        const housingCostYearly = housingCost * nominalFactor;
        const lifestyleAdjustmentYearly = lifestyleAdjustment * nominalFactor;
        
        spendingForYear = spendingForYear + partnerPersonalSpending + housingSavingsYearly + housingCostYearly + lifestyleAdjustmentYearly;
      }
    }

    if (age >= targetRetirementAge) {
      const activePhaseForAge = simPhases.find(p => age >= p.startAge && age < p.endAge);
      if (activePhaseForAge && activePhaseForAge.expenses && Object.keys(activePhaseForAge.expenses).length > 0) {
        const monthlyExpenses = Object.values(activePhaseForAge.expenses).reduce((a, b) => a + b, 0);
        spendingForYear = (monthlyExpenses * 12) * Math.pow(1 + inflationRate, age - currentAge);
      } else {
        const pct = retirementSpendingPercent;
        const yearsPostRet = age - Math.max(currentAge, targetRetirementAge - 1);
        if (hasMarriage && age <= userAgeWhenSpouseDies) {
          if (spouseRetirementSpendingNeed > 0) {
            const userPortion = userLastWorkingSpendingNominal * pct * Math.pow(1 + inflationRate, yearsPostRet);
            const spouseRetNeedNominal = spouseRetirementSpendingNeed * nominalFactor;
            spendingForYear = userPortion + spouseRetNeedNominal;
          } else {
            spendingForYear = lastWorkingYearSpendingNominal * pct * Math.pow(1 + inflationRate, yearsPostRet);
          }
        } else {
          // Spouse is dead (or no marriage) - only user spending
          spendingForYear = userLastWorkingSpendingNominal * pct * Math.pow(1 + inflationRate, yearsPostRet);
        }
      }
    } else {
      // Pre-retirement: save last working year spending
      lastWorkingYearSpendingNominal = spendingForYear;
      
      // Track user portion of spending (joint spending minus spouse personal spending)
      if (hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies) {
        const spouseIncomeNominal = spouseIncome * Math.pow(1 + spouseGrowth, age - marriageAge);
        let partnerTax = 0;
        if (includeTaxes) {
          const taxConfigSingle = U_S_TAX_DATA.single;
          const stdDeductionSingleNominal = taxConfigSingle.standardDeduction * nominalFactor;
          const bracketsSingleNominal = taxConfigSingle.brackets.map(b => ({
            limit: b.limit === Infinity ? Infinity : b.limit * nominalFactor,
            rate: b.rate
          }));
          partnerTax = calculateUSTax(spouseIncomeNominal, stdDeductionSingleNominal, bracketsSingleNominal);
        }
        const partnerTakeHome = spouseIncomeNominal - partnerTax;
        const partnerPersonalSpending = partnerTakeHome * (1 - spouseSavingsRate / 100);
        userLastWorkingSpendingNominal = Math.max(0, spendingForYear - partnerPersonalSpending);
      } else {
        userLastWorkingSpendingNominal = spendingForYear;
      }
    }
    annualExpenses += spendingForYear;

    // Add Healthcare Bridge & Medicare costs if enabled and retired
    if (enableHealthcareModel && age >= targetRetirementAge) {
      const preMedicarePremium = Number(inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000);
      const medicarePremium = Number(inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000);
      
      if (age < 65) {
        annualExpenses += preMedicarePremium * nominalFactor;
      } else {
        annualExpenses += medicarePremium * nominalFactor;
      }
    }

    // Child costs for this year calculated at the top of the year loop


    // Add custom children expenses (legacy currentCondition type)
    customChildren.forEach(c => {
      if (age >= currentAge && (c.endAge === null || age < c.endAge)) {
        const yearsElapsed = age - currentAge;
        const costForYear = (c.monthlyCost * 12) * Math.pow(1 + c.growthRate, yearsElapsed);
        yearChildCosts += costForYear;
      }
    });

    annualExpenses += yearChildCosts;

    // Add colleges events
    enabledEvents.forEach(ev => {
      if (ev.type === 'college' && age >= Number(ev.startAge)) {
        const start = Number(ev.startAge);
        const duration = Number(ev.duration) || 4;
        if (age >= start && age < start + duration) {
          annualExpenses += (Number(ev.tuitionCost) || 0) * nominalFactor;
        }
      }
    });

    // Add medical / windfall custom expenses
    enabledEvents.forEach(ev => {
      if (ev.type === 'medicalExpense' && age === Number(ev.age)) {
        annualExpenses += (Number(ev.amount) || 0) * nominalFactor;
      }
    });

    // Add Sabbaticals
    enabledEvents.forEach(ev => {
      if (ev.type === 'sabbatical') {
        const start = Number(ev.startAge);
        const end = Number(ev.endAge);
        if (age >= start && age < end) {
          const change = Number(ev.expenseChange) || 0;
          annualExpenses += change * nominalFactor;
        }
      }
    });

    // Add Barista FIRE overrides
    enabledEvents.forEach(ev => {
      if (ev.type === 'baristaFire' && age >= Number(ev.startAge)) {
        const baristaExp = Number(ev.annualExpenses) || 42500;
        const hcChange = Number(ev.healthcareCostChange) || 0;
        annualExpenses = (baristaExp + hcChange) * nominalFactor;
      }
    });

    // Custom children handled above in yearChildCosts

    // Add custom obligations expenses
    customObligations.forEach(o => {
      if (age >= currentAge && (o.endAge === null || age < o.endAge)) {
        const yearsElapsed = age - currentAge;
        const costForYear = (o.monthlyCost * 12) * Math.pow(1 + o.growthRate, yearsElapsed);
        annualExpenses += costForYear;
      }
    });

    // Add custom houses expenses
    customHouses.forEach(h => {
      if (age >= currentAge && (h.endAge === null || age < h.endAge)) {
        const costForYear = h.monthlyCost * 12;
        annualExpenses += costForYear;
      }
    });

    // Resolve property buying events down payments
    enabledEvents.forEach(ev => {
      if (ev.type === 'buyHouse' && age === Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age)) {
        const asset = (ev.houseId && inputs.houseAssets)
          ? inputs.houseAssets.find(h => h.id === ev.houseId)
          : ev;

        if (!asset) return;

        const p = Number(asset.homePrice !== undefined ? asset.homePrice : (asset.purchasePrice !== undefined ? asset.purchasePrice : 0)) || 0;
        const dp = Number(asset.downPayment) || 0;
        const isCash = dp >= p || asset.purchaseType === 'cash';

        const closingCostsRate = asset.closingCosts !== undefined ? Number(asset.closingCosts) : 3;
        const closingCosts = p * (closingCostsRate / 100);
        const points = asset.points !== undefined ? Number(asset.points) : 0;
        const renovationCost = asset.renovationCost !== undefined ? Number(asset.renovationCost) : 0;

        let totalCashNeeded = closingCosts + points + renovationCost;
        if (isCash) {
          totalCashNeeded += p;
        } else {
          totalCashNeeded += dp;
        }

        const houseShortfall = deductFromLiquidAssets(totalCashNeeded, age);
        if (houseShortfall > 0.01) {
          hasRunOut = true;
          if (runOutAge === null) {
            runOutAge = age;
          }
        }

        if (isCash) {
          purchasedProperties.push({
            id: asset.id || ev.id,
            purchaseAge: age,
            purchaseType: 'cash',
            homePrice: p,
            currentValue: p,
            mortgageBalance: 0,
            annualPI: 0,
            loanTerm: 0,
            propertyTaxRate: (asset.propertyTax !== undefined ? Number(asset.propertyTax) : (asset.propertyTaxRate !== undefined ? Number(asset.propertyTaxRate) : 1.1)) / 100,
            insuranceRate: (asset.insurance !== undefined ? Number(asset.insurance) : (asset.insuranceCost !== undefined ? Number(asset.insuranceCost) : 0.35)) / 100,
            maintenanceRate: (asset.maintenance !== undefined ? Number(asset.maintenance) : (asset.maintenanceRate !== undefined ? Number(asset.maintenanceRate) : 1.0)) / 100,
            appreciationRate: (asset.appreciationRate !== undefined ? Number(asset.appreciationRate) : 3.0) / 100,
            hoa: asset.hoa !== undefined ? Number(asset.hoa) : (asset.hoaCost !== undefined ? Number(asset.hoaCost) : 0),
            utilitiesIncrease: asset.utilitiesIncrease !== undefined ? Number(asset.utilitiesIncrease) : 0,
            sellingCostRate: asset.sellingCost !== undefined ? Number(asset.sellingCost) : (asset.sellingCostRate !== undefined ? Number(asset.sellingCostRate) : 6),
            yearsUntilSale: asset.yearsUntilSale !== undefined ? asset.yearsUntilSale : '',
            inflation: asset.inflation !== undefined ? Number(asset.inflation) : 3
          });
        } else {
          const rate = (asset.mortgageRate !== undefined ? Number(asset.mortgageRate) : 6.5) / 100;
          const mortgageTerm = asset.loanTerm !== undefined ? Number(asset.loanTerm) : (asset.loanTermYears !== undefined ? Number(asset.loanTermYears) : 30);
          const loanAmount = Math.max(0, p - dp);
          let annualPI = 0;

          if (loanAmount > 0 && mortgageTerm > 0) {
            const r = rate / 12;
            const n = mortgageTerm * 12;
            const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            annualPI = monthlyPayment * 12;
          }

          purchasedProperties.push({
            id: asset.id || ev.id,
            purchaseAge: age,
            purchaseType: 'mortgage',
            homePrice: p,
            downPayment: dp,
            mortgageRate: rate,
            loanTerm: mortgageTerm,
            loanAmount,
            annualPI,
            currentValue: p,
            mortgageBalance: loanAmount,
            propertyTaxRate: (asset.propertyTax !== undefined ? Number(asset.propertyTax) : (asset.propertyTaxRate !== undefined ? Number(asset.propertyTaxRate) : 1.1)) / 100,
            insuranceRate: (asset.insurance !== undefined ? Number(asset.insurance) : (asset.insuranceCost !== undefined ? Number(asset.insuranceCost) : 0.35)) / 100,
            maintenanceRate: (asset.maintenance !== undefined ? Number(asset.maintenance) : (asset.maintenanceRate !== undefined ? Number(asset.maintenanceRate) : 1.0)) / 100,
            pmiRate: asset.pmi !== undefined ? Number(asset.pmi) : 0.5,
            appreciationRate: (asset.appreciationRate !== undefined ? Number(asset.appreciationRate) : 3.0) / 100,
            hoa: asset.hoa !== undefined ? Number(asset.hoa) : (asset.hoaCost !== undefined ? Number(asset.hoaCost) : 0),
            utilitiesIncrease: asset.utilitiesIncrease !== undefined ? Number(asset.utilitiesIncrease) : 0,
            sellingCostRate: asset.sellingCost !== undefined ? Number(asset.sellingCost) : (asset.sellingCostRate !== undefined ? Number(asset.sellingCostRate) : 6),
            yearsUntilSale: asset.yearsUntilSale !== undefined ? asset.yearsUntilSale : '',
            inflation: asset.inflation !== undefined ? Number(asset.inflation) : 3
          });
        }
      }
    });

    // Sell properties if they reach their sale age
    const activeProperties = [];
    purchasedProperties.forEach(prop => {
      let shouldSell = false;
      let sellingCostRate = prop.sellingCostRate || 6;
      let proceedsDestination = 'investments';
      let sellEvId = null;

      // Check linked SellHouseEvent
      const sellEv = enabledEvents.find(e => e.type === 'sellHouse' && e.houseId === prop.id && age === Number(e.age));
      if (sellEv) {
        shouldSell = true;
        if (sellEv.sellingCost !== undefined) {
          sellingCostRate = Number(sellEv.sellingCost);
        }
        if (sellEv.proceedsDestination) {
          proceedsDestination = sellEv.proceedsDestination;
        }
        sellEvId = sellEv.id;
      } else {
        // Fallback to old format yearsUntilSale/move-out age
        let saleAge = null;
        if (prop.yearsUntilSale !== undefined && prop.yearsUntilSale !== null && prop.yearsUntilSale !== '') {
          const val = Number(prop.yearsUntilSale);
          if (!isNaN(val) && val > 0) {
            if (val < currentAge) {
              saleAge = prop.purchaseAge + val;
            } else {
              saleAge = val;
            }
          }
        }
        if (saleAge !== null && age === saleAge) {
          shouldSell = true;
        }
      }

      if (shouldSell) {
        const sellingCosts = prop.currentValue * (sellingCostRate / 100);
        const netProceeds = prop.currentValue - sellingCosts - prop.mortgageBalance;
        
        if (proceedsDestination === 'cash') {
          balances.cash += netProceeds;
        } else {
          balances.brokerage += netProceeds;
        }

        dynamicMilestones.push({
          age,
          label: `Sold Home`,
          type: 'sellHouse',
          isMilestone: true,
          originalId: sellEvId || prop.id,
          description: `Sold home for ${formatCurrency(prop.currentValue)}. Net proceeds after ${sellingCostRate}% selling costs (${formatCurrency(sellingCosts)}) and mortgage payoff (${formatCurrency(prop.mortgageBalance)}) were ${formatCurrency(netProceeds)} injected into ${proceedsDestination === 'cash' ? 'cash' : 'investments'}.`
        });
      } else {
        activeProperties.push(prop);
      }
    });
    purchasedProperties = activeProperties;

    // Appreciate home values and compile mortgage payments / property costs
    let totalHomeValue = homeEquityBaseline * nominalFactor;
    customHouses.forEach(h => {
      if (age >= currentAge && (h.endAge === null || age < h.endAge)) {
        totalHomeValue += h.value;
      }
    });
    let totalMortgageBalance = 0;

    purchasedProperties.forEach(prop => {
      prop.currentValue = prop.currentValue * (1 + prop.appreciationRate);
      totalHomeValue += prop.currentValue;

      // Mortgage payments
      if (prop.purchaseType === 'mortgage') {
        if (age >= prop.purchaseAge && age < prop.purchaseAge + prop.loanTerm) {
          annualExpenses += prop.annualPI;

          // Amortize
          const elapsedYears = age - prop.purchaseAge;
          const r = prop.mortgageRate / 12;
          const n = prop.loanTerm * 12;
          const elapsedMonths = elapsedYears * 12;
          const remainingMonths = n - elapsedMonths;
          const pmt = prop.annualPI / 12;

          prop.mortgageBalance = r === 0 ? pmt * remainingMonths : pmt * (1 - Math.pow(1 + r, -remainingMonths)) / r;
        } else {
          prop.mortgageBalance = 0;
        }

        totalMortgageBalance += prop.mortgageBalance;
      }

      // Taxes, Insurance, Maintenance (applies to both cash and mortgage purchases)
      const propTax = prop.currentValue * prop.propertyTaxRate;
      const ins = prop.currentValue * prop.insuranceRate;
      const maint = prop.currentValue * prop.maintenanceRate;
      annualExpenses += propTax + ins + maint;

      // HOA & Utilities (inflated)
      const propInflationRate = prop.inflation !== undefined ? (prop.inflation / 100) : inflationRate;
      const hoaCost = (prop.hoa || 0) * 12 * Math.pow(1 + propInflationRate, age - prop.purchaseAge);
      const utilitiesCost = (prop.utilitiesIncrease || 0) * 12 * Math.pow(1 + propInflationRate, age - prop.purchaseAge);
      annualExpenses += hoaCost + utilitiesCost;

      // PMI: 0.5% (or custom) annually if down payment < 20%, drops off when LTV <= 80%
      if (prop.purchaseType === 'mortgage' && prop.downPayment < prop.homePrice * 0.2) {
        if (prop.mortgageBalance > prop.homePrice * 0.8) {
          const pmiCost = prop.mortgageBalance * ((prop.pmiRate || 0.5) / 100);
          annualExpenses += pmiCost;
        }
      }
    });

    // Amortize ongoing debts (minimum payments + extra paydown plans)
    let annualDebtPayments = 0;
    activeLoans.forEach(loan => {
      if (loan.balance > 0) {
        const interest = loan.balance * loan.interestRate;
        loan.totalInterestPaid = (loan.totalInterestPaid || 0) + interest;
        
        let totalPayment = loan.payment;
        if (loan.paydownPlanEnabled && age >= loan.startAge) {
          totalPayment += loan.extraPayment;
        }

        let actualPaid;

        if (loan.balance + interest <= totalPayment) {
          actualPaid = loan.balance + interest;
          loan.balance = 0;
          loan.payoffAge = age;
          dynamicMilestones.push({
            age,
            label: `${loan.name} Paid Off`,
            type: 'debtPayoff',
            isMilestone: true
          });
        } else {
          actualPaid = totalPayment;
          loan.balance = loan.balance + interest - actualPaid;
        }

        annualDebtPayments += actualPaid;
      }
    });

    annualExpenses += annualDebtPayments;

    // Debt payoff event (legacy template option - reduces portfolio, sets debtBalance to 0)
    enabledEvents.forEach(ev => {
      if (ev.type === 'debtPayoff' && age === Number(ev.payoffAge)) {
        const amt = Number(ev.remainingBalance !== undefined ? ev.remainingBalance : ev.amount) || 0;
        const debtShortfall = deductFromLiquidAssets(amt, age);
        if (debtShortfall > 0.01) {
          hasRunOut = true;
          if (runOutAge === null) {
            runOutAge = age;
          }
        }
        debtBalance = 0;
      }
    });

    // ----------------------------------------------------
    // 3. Coast FIRE targets
    // ----------------------------------------------------
    let isCoastAchieved = false;
    let coastFireNumber = 0;
    const currentLiquidWorth = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other;

    if (age < targetRetirementAge) {
      const yearsToRetire = targetRetirementAge - age;
      let projectedExpensesAtRetirement = annualExpenses * Math.pow(1 + inflationRate, yearsToRetire);
      if (includeTaxes) {
        const factor = Math.pow(1 + inflationRate, yearsToRetire);
        const stdDeductionAtRetirement = standardDeduction * factor;
        const bracketsAtRetirement = nominalBrackets.map(b => ({
          limit: b.limit === Infinity ? Infinity : b.limit * factor,
          rate: b.rate
        }));

        const pRateAtRetirement = (enforceEarlyWithdrawalPenalty && targetRetirementAge < 59.5) ? 0.10 : 0.0;
        projectedExpensesAtRetirement = solveTraditionalWithdrawal(
          projectedExpensesAtRetirement,
          Infinity,
          0,
          stdDeductionAtRetirement,
          bracketsAtRetirement,
          pRateAtRetirement
        );
      }
      const targetPortfolioAtRetirement = projectedExpensesAtRetirement / swr;
      coastFireNumber = targetPortfolioAtRetirement / Math.pow(1 + expectedReturn, yearsToRetire);

      if (currentLiquidWorth >= coastFireNumber) {
        isCoastAchieved = true;
        const hasCoastEventActive = enabledEvents.some(e => e.type === 'coastFire' && age >= Number(e.startAge));
        if (fireMode === 'coast' || hasCoastEventActive) {
          isCoasting = true;
          if (coastAge === null) {
            coastAge = age;
          }
        }
      }
    }

    // ----------------------------------------------------
    // 4. Allocation Rules & Surplus Cash Flows
    // ----------------------------------------------------
    let totalPreTaxAllocations = 0;
    let savingsContribution = 0;
    let employerMatchContribution = 0;
    let taxes = 0;
    let grossSurplus = annualIncome - annualExpenses;

    // Sort allocation rules by priority and filter by active age range
    const sortedAllocations = [...allocationRules]
      .filter(rule => {
        const start = rule.startAge !== undefined ? Number(rule.startAge) : 0;
        const end = rule.endAge !== undefined ? Number(rule.endAge) : Infinity;
        return age >= start && age < end;
      })
      .map(r => ({ ...r, priority: Number(r.priority) || 99 }))
      .sort((a, b) => a.priority - b.priority);

    // Only save/allocate if not coasting and not retired
    const isSavingPeriod = !isCoasting && age < targetRetirementAge;

    // Step 1: Pre-Tax allocations dry run
    let customPreTaxAllocationsThisYear = 0;
    let simpleUserPreTax = 0;
    let simpleSpousePreTax = 0;

    if (isSavingPeriod) {
      if (!isAdvanced) {
        // User pre-tax savings
        const userPreTaxRate = Number(inputs.preTaxSavingsRate) || 0;
        const userIncomeThisYear = annualIncome - spouseIncomeThisYear;
        simpleUserPreTax = userIncomeThisYear * (userPreTaxRate / 100);
        
        // Spouse pre-tax savings
        if (hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies) {
          simpleSpousePreTax = spouseIncomeThisYear * (spouseSavingsRate / 100);
        }

        totalPreTaxAllocations += simpleUserPreTax + simpleSpousePreTax;
      } else if (grossSurplus > 0) {
        customAssets.forEach(ca => {
          if (ca.endAge !== null && age >= ca.endAge) return;
          if (ca.monthlyContribution > 0) {
            const isPreTax = ca.type === 'retirement' && (ca.subtype === 'trad401k' || ca.subtype === 'tradIra' || ca.subtype === 'hsa');
            if (isPreTax) {
              const annualContribution = ca.monthlyContribution * 12;
              customPreTaxAllocationsThisYear += annualContribution;
            }
          }
        });
        customPreTaxAllocationsThisYear = Math.min(grossSurplus, customPreTaxAllocationsThisYear);
        totalPreTaxAllocations += customPreTaxAllocationsThisYear;

        let tempGrossSurplus = grossSurplus - customPreTaxAllocationsThisYear;

        sortedAllocations.forEach(rule => {
          const dest = rule.destination;
          const isPreTax = dest === 'trad401k' || dest === 'tradIra' || dest === 'hsa';
          if (isPreTax && tempGrossSurplus > 0) {
            let incomeBase = annualIncome;
            if (rule.belongsTo === 'spouse') {
              incomeBase = spouseIncomeThisYear;
            } else if (rule.belongsTo === 'user') {
              incomeBase = annualIncome - spouseIncomeThisYear;
            }

            // Determine amount
            let amt = 0;
            if (rule.type === 'fixed') {
              amt = rule.frequency === 'monthly' ? Number(rule.value) * 12 : Number(rule.value);
            } else if (rule.type === 'percentIncome') {
              amt = incomeBase * (Number(rule.value) / 100);
            } else if (rule.type === 'percentSurplus') {
              amt = tempGrossSurplus * (Number(rule.value) / 100);
            }

            // Smart Target cap
            if (rule.smartRule && rule.smartRule.enabled) {
              const targetVal = Number(rule.smartRule.targetValue) || 0;
              const space = Math.max(0, targetVal - (balances[dest] || 0));
              amt = Math.min(amt, space);
            }

            const allocatedAmt = Math.max(0, Math.min(tempGrossSurplus, amt));
            tempGrossSurplus -= allocatedAmt;
            rule.computedPreTaxAmt = allocatedAmt;
            totalPreTaxAllocations += allocatedAmt;
          }
        });
      }
    }

    // Step 2: Taxes computation
    if (includeTaxes) {
      const isPostRet = age >= targetRetirementAge;
      if (!isPostRet) {
        const adjustedTaxable = Math.max(0, taxableIncome - totalPreTaxAllocations);
        taxes = calculateUSTax(adjustedTaxable, standardDeduction, nominalBrackets);
      } else {
        // Post-retirement base tax (on Social Security and part-time income before withdrawals)
        taxes = calculateUSTax(taxableIncome, standardDeduction, nominalBrackets);
      }
    }

    // Step 3: Cash allocation execution
    let netSurplus = grossSurplus - taxes + windfallReceived - totalPreTaxAllocations;
    let netCashFlow = netSurplus; // Tracker for total cash flow this year

    if (isSavingPeriod) {
      if (!isAdvanced) {
        balances.trad401k += simpleUserPreTax + simpleSpousePreTax;
        savingsContribution += simpleUserPreTax + simpleSpousePreTax;
      } else {
        // Run custom pre-tax allocations for real
        customAssets.forEach(ca => {
          if (ca.endAge !== null && age >= ca.endAge) return;
          if (ca.monthlyContribution > 0) {
            const isPreTax = ca.type === 'retirement' && (ca.subtype === 'trad401k' || ca.subtype === 'tradIra' || ca.subtype === 'hsa');
            if (isPreTax) {
              const annualContribution = ca.monthlyContribution * 12;
              ca.balance += annualContribution;
              savingsContribution += annualContribution;
            }
          }
        });

        // Run pre-tax allocations for real
        sortedAllocations.forEach(rule => {
          const dest = rule.destination;
          const isPreTax = dest === 'trad401k' || dest === 'tradIra' || dest === 'hsa';
          if (isPreTax) {
            const amt = rule.computedPreTaxAmt || 0;
            if (amt > 0) {
              balances[dest] += amt;
              savingsContribution += amt;
              // Matches
              if (rule.employerMatch) {
                const matchAmt = rule.frequency === 'monthly' ? Number(rule.employerMatch) * 12 : Number(rule.employerMatch);
                balances[dest] += matchAmt;
                employerMatchContribution += matchAmt;
              }
            }
          }
        });
      }

      // Run custom post-tax allocations
      if (netSurplus > 0) {
        customAssets.forEach(ca => {
          if (ca.endAge !== null && age >= ca.endAge) return;
          if (ca.monthlyContribution > 0) {
            const isPreTax = ca.type === 'retirement' && (ca.subtype === 'trad401k' || ca.subtype === 'tradIra' || ca.subtype === 'hsa');
            if (!isPreTax) {
              const annualContribution = ca.monthlyContribution * 12;
              const actualContributed = Math.min(netSurplus, annualContribution);
              ca.balance += actualContributed;
              netSurplus -= actualContributed;
              savingsContribution += actualContributed;
            }
          }
        });
      }

      // Run post-tax allocations
      sortedAllocations.forEach(rule => {
        const dest = rule.destination;
        const isPreTax = dest === 'trad401k' || dest === 'tradIra' || dest === 'hsa';
        if (!isPreTax && netSurplus > 0) {
          let amt = 0;
          if (rule.type === 'fixed') {
            amt = rule.frequency === 'monthly' ? Number(rule.value) * 12 : Number(rule.value);
          } else if (rule.type === 'percentIncome') {
            amt = annualIncome * (Number(rule.value) / 100);
          } else if (rule.type === 'percentSurplus') {
            amt = netSurplus * (Number(rule.value) / 100);
          }

          let finalDest = dest;
          let spaceLimit = Infinity;

          // Goal-based Smart redirects
          if (rule.smartRule && rule.smartRule.enabled) {
            const targetVal = Number(rule.smartRule.targetValue) || 0;
            
            if (dest === 'extraMortgage') {
              // Redirect if no mortgage active
              const activeMortgageSum = purchasedProperties.reduce((sum, p) => sum + p.mortgageBalance, 0);
              if (activeMortgageSum <= 0) {
                finalDest = rule.smartRule.redirectDestination || 'brokerage';
              } else {
                spaceLimit = activeMortgageSum;
              }
            } else if (dest.startsWith('loan-') || dest === 'debtPaydown') {
              // Redirect if loan paid off
              const loanId = dest.startsWith('loan-') ? dest.replace('loan-', '') : null;
              const targetLoan = activeLoans.find(l => l.id === loanId || l.id === dest);
              if (!targetLoan || targetLoan.balance <= 0) {
                finalDest = rule.smartRule.redirectDestination || 'brokerage';
              } else {
                spaceLimit = targetLoan.balance;
              }
            } else {
              // Standard asset target limit redirect
              const currentBal = balances[dest] || 0;
              if (currentBal >= targetVal) {
                finalDest = rule.smartRule.redirectDestination || 'brokerage';
              } else {
                spaceLimit = Math.max(0, targetVal - currentBal);
              }
            }
          }

          let allocatedAmt = Math.max(0, Math.min(netSurplus, amt));
          if (allocatedAmt > spaceLimit) {
            // Redirect remainder
            const spillOver = allocatedAmt - spaceLimit;
            allocatedAmt = spaceLimit;
            
            const redirectDest = (rule.smartRule && rule.smartRule.redirectDestination) || 'brokerage';
            const spillAlloc = Math.max(0, Math.min(netSurplus - allocatedAmt, spillOver));
            if (spillAlloc > 0) {
              if (balances[redirectDest] !== undefined) {
                balances[redirectDest] += spillAlloc;
              }
            }
          }

          if (allocatedAmt > 0) {
            netSurplus -= allocatedAmt;
            if (balances[finalDest] !== undefined) {
              balances[finalDest] += allocatedAmt;
              savingsContribution += allocatedAmt;
            } else if (finalDest === 'extraMortgage') {
              // Pay extra mortgage
              let mortgageRemaining = allocatedAmt;
              for (const prop of purchasedProperties) {
                if (prop.purchaseType === 'mortgage' && prop.mortgageBalance > 0) {
                  const pay = Math.min(prop.mortgageBalance, mortgageRemaining);
                  prop.mortgageBalance -= pay;
                  mortgageRemaining -= pay;
                  if (mortgageRemaining <= 0) break;
                }
              }
            } else {
              // Specific loan paydown
              const loanId = finalDest.startsWith('loan-') ? finalDest.replace('loan-', '') : null;
              const targetLoan = activeLoans.find(l => l.id === loanId || l.id === finalDest);
              if (targetLoan) {
                targetLoan.balance = Math.max(0, targetLoan.balance - allocatedAmt);
              }
            }
          }
        }
      });

      if (cumulativeShortfall > 0 && netSurplus > 0) {
        const payDown = Math.min(cumulativeShortfall, netSurplus);
        cumulativeShortfall -= payDown;
        netSurplus -= payDown;
      }
      // Leftover Surplus Sweep into Brokerage
      if (netSurplus > 0) {
        balances.brokerage += netSurplus;
        savingsContribution += netSurplus;
        netSurplus = 0;
      }
    } else {
      // In retirement or coasting: we do not save new contributions.
      // Leftover surplus (if positive, e.g. from SS or pensions) is swept into Brokerage.
      if (cumulativeShortfall > 0 && netSurplus > 0) {
        const payDown = Math.min(cumulativeShortfall, netSurplus);
        cumulativeShortfall -= payDown;
        netSurplus -= payDown;
      }
      if (netSurplus > 0) {
        balances.brokerage += netSurplus;
        netSurplus = 0;
      }
    }

    // ----------------------------------------------------
    // 5. Drawdowns & Deficit Funding
    // ----------------------------------------------------
    let withdrawal = 0;
    let shortfall = 0;

    if (netCashFlow < 0) {
      const deficit = -netCashFlow;
      const leftShortfall = coverShortfall(deficit, age);
      withdrawal = deficit - leftShortfall;

      if (leftShortfall > 0.01) {
        shortfall = leftShortfall;
        cumulativeShortfall += leftShortfall;
        hasRunOut = true;
        if (runOutAge === null) {
          runOutAge = age;
        }
      }
    }

    if (includeTaxes) {
      const isPostRet = age >= targetRetirementAge;
      if (isPostRet) {
        taxes = calculateUSTax(taxableIncome, standardDeduction, nominalBrackets);
      } else {
        const adjustedTaxable = Math.max(0, taxableIncome - totalPreTaxAllocations);
        taxes = calculateUSTax(adjustedTaxable, standardDeduction, nominalBrackets);
      }
    }

    taxes += annualEarlyWithdrawalPenalties;

    // Sum of remaining loan balances
    const currentDebtSum = activeLoans.reduce((sum, l) => sum + l.balance, 0) + debtBalance;

    // ----------------------------------------------------
    // 6. Net Worth & FI Targets
    // ----------------------------------------------------
    // Net Worth = Liquid Assets + Real Estate Value - Mortgage Balances - Debt balances
    const customAssetsSum = customAssets.reduce((sum, ca) => sum + ca.balance, 0);
    const liquidNW = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other + customAssetsSum;
    const netWorth = liquidNW + totalHomeValue - totalMortgageBalance - currentDebtSum;

    // Apply FIRE Mode Multipliers for retirement spending target
    let retirementBaseExpenses = spendingForYear + taxes;
    if (age < targetRetirementAge) {
      const estRetSpending = spendingForYear * retirementSpendingPercent;
      retirementBaseExpenses = estRetSpending + taxes;
    }
    if (age >= targetRetirementAge) {
      if (fireMode === 'lean') {
        retirementBaseExpenses *= 0.8;
      } else if (fireMode === 'fat') {
        retirementBaseExpenses *= 1.3;
      }
    }

    // Add Healthcare Bridge & Medicare costs to retirement base expenses if enabled
    if (enableHealthcareModel) {
      const preMedicarePremium = Number(inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000);
      const medicarePremium = Number(inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000);
      
      const referenceAge = Math.max(age, targetRetirementAge);
      if (referenceAge < 65) {
        retirementBaseExpenses += preMedicarePremium * nominalFactor;
      } else {
        retirementBaseExpenses += medicarePremium * nominalFactor;
      }
    }

    // Calculate active retirement income sources for the current age, and discount future ones
    let activeRetirementIncomeThisYearInTodayDollars = 0;
    let futureRetirementIncomeDiscountedSumInTodayDollars = 0;

    enabledEvents.forEach(ev => {
      if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
        const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
        let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
        if (ev.type === 'socialSecurity') {
          monthlyBenefit = socialSecurityDetails.monthlyBenefit;
        }
        let annualAmt = monthlyBenefit * 12;
        const isInflationAdjusted = ev.type === 'socialSecurity' || ev.inflationAdjusted;
        
        if (age >= claimingAge) {
          if (!isInflationAdjusted) {
            annualAmt = annualAmt / nominalFactor;
          }
          activeRetirementIncomeThisYearInTodayDollars += annualAmt;
        } else {
          let deflatedAnnualAmt = annualAmt;
          if (!isInflationAdjusted) {
            deflatedAnnualAmt = annualAmt / Math.pow(1 + inflationRate, claimingAge - currentAge);
          }
          
          let discountedValue;
          if (age >= targetRetirementAge) {
            const realReturn = Math.max(0.001, postRetirementReturn - inflationRate);
            const yearsToClaim = claimingAge - age;
            discountedValue = deflatedAnnualAmt / Math.pow(1 + realReturn, yearsToClaim);
          } else {
            const yearsPre = Math.max(0, Math.min(claimingAge, targetRetirementAge) - age);
            const yearsPost = Math.max(0, claimingAge - Math.max(age, targetRetirementAge));
            const realPre = Math.max(0.001, expectedReturn - inflationRate);
            const realPost = Math.max(0.001, postRetirementReturn - inflationRate);
            discountedValue = deflatedAnnualAmt / (Math.pow(1 + realPre, yearsPre) * Math.pow(1 + realPost, yearsPost));
          }
          futureRetirementIncomeDiscountedSumInTodayDollars += discountedValue;
        }
      }
    });

    // Retirement Ready Target (portfolio + active retirement income sources cover spending, discounting future ones)
    const nominalActiveSS = activeRetirementIncomeThisYearInTodayDollars * nominalFactor;
    const nominalDiscountedSS = futureRetirementIncomeDiscountedSumInTodayDollars * nominalFactor;

    const retirementReadyTargetForYear = Math.max(0, 
      retirementBaseExpenses - nominalActiveSS - nominalDiscountedSS
    ) / swr;

    if (liquidNW >= retirementReadyTargetForYear && !retirementReadyReached) {
      retirementReadyReached = true;
      retirementReadyAge = age;
    }

    if (age === simLifeExpectancy) {
      endingSurplusShortfall = cumulativeShortfall > 0 ? -cumulativeShortfall : liquidNW;
    }

    const totalPortfolio = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other + customAssetsSum;

    // Compute total planned savings for lifestyle gap calculation
    let plannedPreTaxSavings = 0;
    let plannedPostTaxSavings = 0;
    if (isSavingPeriod) {
      if (!isAdvanced) {
        plannedPreTaxSavings += simpleUserPreTax + simpleSpousePreTax;
      } else {
        customAssets.forEach(ca => {
          if (ca.endAge === null || age < ca.endAge) {
            const isPreTax = ca.type === 'retirement' && (ca.subtype === 'trad401k' || ca.subtype === 'tradIra' || ca.subtype === 'hsa');
            if (isPreTax) {
              plannedPreTaxSavings += ca.monthlyContribution * 12;
            } else {
              plannedPostTaxSavings += ca.monthlyContribution * 12;
            }
          }
        });
        sortedAllocations.forEach(rule => {
          const dest = rule.destination;
          const isPreTax = dest === 'trad401k' || dest === 'tradIra' || dest === 'hsa';
          
          let incomeBase = annualIncome;
          if (rule.belongsTo === 'spouse') {
            incomeBase = spouseIncomeThisYear;
          } else if (rule.belongsTo === 'user') {
            incomeBase = annualIncome - spouseIncomeThisYear;
          }
          
          let amt = 0;
          if (rule.type === 'fixed') {
            amt = rule.frequency === 'monthly' ? Number(rule.value) * 12 : Number(rule.value);
          } else if (rule.type === 'percentIncome') {
            amt = incomeBase * (Number(rule.value) / 100);
          }
          if (isPreTax) {
            plannedPreTaxSavings += amt;
          } else {
            plannedPostTaxSavings += amt;
          }
        });
      }
    }
    const totalPlannedSavings = plannedPreTaxSavings + plannedPostTaxSavings;
    const incomeAvailable = annualIncome + windfallReceived;
    const gapForYear = incomeAvailable - taxes - annualExpenses - totalPlannedSavings;
    const lifestyleGapValue = (age < targetRetirementAge && gapForYear < 0) ? -gapForYear : 0;

    logs.push({
      year,
      age,
      income: annualIncome + windfallReceived,
      expenses: annualExpenses + taxes,
      taxes,
      savings: savingsContribution,
      employerMatch: employerMatchContribution,
      withdrawals: withdrawal,
      shortfall,
      cumulativeShortfall,
      portfolio: totalPortfolio,
      homeValue: totalHomeValue,
      homeEquity: Math.max(0, totalHomeValue - totalMortgageBalance),
      mortgageBalance: totalMortgageBalance,
      debtBalance: currentDebtSum,
      netWorth,
      isFI: liquidNW >= retirementReadyTargetForYear,
      fiNumber: retirementReadyTargetForYear,
      retirementReadyTarget: retirementReadyTargetForYear,
      coastFireNumber,
      isCoastAchieved,
      childCosts: yearChildCosts,
      lifestyleGap: lifestyleGapValue,
      // Record detailed asset allocations for breakdowns
      cashBalance: balances.cash + customAssets.filter(ca => ca.type === 'checkingSavings').reduce((sum, ca) => sum + ca.balance, 0),
      emergencyFundBalance: balances.emergencyFund,
      brokerageBalance: balances.brokerage + customAssets.filter(ca => ca.type === 'brokerage').reduce((sum, ca) => sum + ca.balance, 0),
      trad401kBalance: balances.trad401k + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'trad401k').reduce((sum, ca) => sum + ca.balance, 0),
      tradIraBalance: balances.tradIra + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'tradIra').reduce((sum, ca) => sum + ca.balance, 0),
      rothIraBalance: balances.rothIra + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'rothIra').reduce((sum, ca) => sum + ca.balance, 0),
      hsaBalance: balances.hsa + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'hsa').reduce((sum, ca) => sum + ca.balance, 0),
      otherBalance: balances.other + customAssets.filter(ca => ca.type === 'asset').reduce((sum, ca) => sum + ca.balance, 0)
    });
  }

    const debtSummaries = activeLoans.map(loan => ({
      id: loan.id,
      name: loan.name,
      totalInterestPaid: loan.totalInterestPaid || 0,
      payoffAge: loan.balance <= 0 ? loan.payoffAge : null
    }));

    return {
      moneyLasts: !hasRunOut,
      runOutAge,
      endingSurplusShortfall,
      logs,
      dynamicMilestones,
      coastAge,
      lastWorkingYearSpendingNominal,
      debtSummaries
    };
  };

  const plannedResults = executeSimulation(targetRetirementAge);

  // Deflate all logged money values to Today's (Real) Dollars
  const deflatedLogs = plannedResults.logs.map(log => {
    const yearsElapsed = log.age - currentAge;
    const factor = Math.pow(1 + inflationRate, yearsElapsed);
    
    return {
      ...log,
      income: log.income / factor,
      expenses: log.expenses / factor,
      taxes: (log.taxes || 0) / factor,
      savings: log.savings / factor,
      employerMatch: log.employerMatch / factor,
      withdrawals: log.withdrawals / factor,
      shortfall: log.shortfall / factor,
      portfolio: log.portfolio / factor,
      homeValue: log.homeValue / factor,
      homeEquity: log.homeEquity / factor,
      mortgageBalance: log.mortgageBalance / factor,
      debtBalance: log.debtBalance / factor,
      netWorth: (log.netWorth - (log.cumulativeShortfall || 0)) / factor,
      assets: (log.portfolio + log.homeValue) / factor,
      debt: (log.debtBalance + log.mortgageBalance + (log.cumulativeShortfall || 0)) / factor,
      fiNumber: log.fiNumber / factor,
      retirementReadyTarget: log.retirementReadyTarget / factor,
      coastFireNumber: log.coastFireNumber / factor,
      childCosts: log.childCosts / factor,
      lifestyleGap: log.lifestyleGap / factor,
      cashBalance: log.cashBalance / factor,
      emergencyFundBalance: log.emergencyFundBalance / factor,
      brokerageBalance: log.brokerageBalance / factor,
      trad401kBalance: log.trad401kBalance / factor,
      tradIraBalance: log.tradIraBalance / factor,
      rothIraBalance: log.rothIraBalance / factor,
      hsaBalance: log.hsaBalance / factor,
      otherBalance: log.otherBalance / factor
    };
  });

  let retirementReadyAgeSWR = null;
  let retirementReadyAgeComfortable = null;
  let retirementReadyAgeSurvival = null;

  if (!inputs.skipReadyAgeSearch) {
    // Binary search for retirementReadyAgeSWR
    let lowSWR = currentAge;
    let highSWR = lifeExpectancy;
    while (lowSWR <= highSWR) {
      const mid = Math.floor((lowSWR + highSWR) / 2);
      const testRes = executeSimulation(mid);
      if (testRes.moneyLasts) {
        const lastLog = testRes.logs[testRes.logs.length - 1];
        if (lastLog && lastLog.portfolio >= lastLog.retirementReadyTarget) {
          retirementReadyAgeSWR = mid;
          highSWR = mid - 1; // Try to retire even earlier
        } else {
          lowSWR = mid + 1; // Need to work longer
        }
      } else {
        lowSWR = mid + 1;
      }
    }

    // Binary search for retirementReadyAgeComfortable
    let lowC = currentAge;
    let highC = lifeExpectancy;
    while (lowC <= highC) {
      const mid = Math.floor((lowC + highC) / 2);
      const testRes = executeSimulation(mid, lifeExpectancy + 10);
      if (testRes.moneyLasts) {
        retirementReadyAgeComfortable = mid;
        highC = mid - 1;
      } else {
        lowC = mid + 1;
      }
    }

    // Binary search for retirementReadyAgeSurvival
    let lowS = currentAge;
    let highS = lifeExpectancy;
    while (lowS <= highS) {
      const mid = Math.floor((lowS + highS) / 2);
      const testRes = executeSimulation(mid);
      if (testRes.moneyLasts) {
        retirementReadyAgeSurvival = mid;
        highS = mid - 1;
      } else {
        lowS = mid + 1;
      }
    }
  }

  const readinessCriteria = inputs.readinessCriteria || 'lastsIndefinitely';
  if (readinessCriteria === 'lastsLifeExp') {
    retirementReadyAge = retirementReadyAgeSurvival;
  } else if (readinessCriteria === 'lastsComfortable') {
    retirementReadyAge = retirementReadyAgeComfortable;
  } else {
    retirementReadyAge = retirementReadyAgeSWR;
  }

  let retirementReadyTarget = 0;
  if (retirementReadyAge !== null) {
    const readyLog = deflatedLogs.find(l => l.age === retirementReadyAge);
    if (readyLog) {
      retirementReadyTarget = readyLog.fiNumber;
    } else {
      const factor = Math.pow(1 + inflationRate, retirementReadyAge - currentAge);
      const initialPhase = spendingPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge) || spendingPhases[0];
      let baseSpending = 42500;
      if (initialPhase) {
        baseSpending = Number(initialPhase.amount) || Number(initialPhase.annualSpending) || 42500;
        if (initialPhase.frequency === 'monthly') baseSpending *= 12;
      }
      const rate = (initialPhase && initialPhase.inflationOverride !== null && initialPhase.inflationOverride !== undefined && initialPhase.inflationOverride !== '')
        ? (Number(initialPhase.inflationOverride) / 100)
        : inflationRate;
      let estRetSpending = baseSpending * Math.pow(1 + rate + lifestyleUpgrades, retirementReadyAge - currentAge) * retirementSpendingPercent;
      
      if (enableHealthcareModel) {
        const preMedicarePremium = Number(inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000);
        const medicarePremium = Number(inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000);
        
        if (retirementReadyAge < 65) {
          estRetSpending += preMedicarePremium * factor;
        } else {
          estRetSpending += medicarePremium * factor;
        }
      }
      
      let activeRetIncome = 0;
      let futureRetIncomeDiscountedSum = 0;
      const realReturn = Math.max(0.001, postRetirementReturn - inflationRate);
      
      enabledEvents.forEach(ev => {
        if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
          const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
          let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
          if (ev.type === 'socialSecurity') {
            monthlyBenefit = socialSecurityDetails.monthlyBenefit;
          }
          let annualAmt = monthlyBenefit * 12; // in today's dollars
          const isInflationAdjusted = ev.type === 'socialSecurity' || ev.inflationAdjusted;
          
          if (retirementReadyAge >= claimingAge) {
            if (!isInflationAdjusted) {
              annualAmt = annualAmt / factor;
            }
            activeRetIncome += annualAmt;
          } else {
            const yearsToClaim = claimingAge - retirementReadyAge;
            let deflatedAnnualAmt = annualAmt;
            if (!isInflationAdjusted) {
              deflatedAnnualAmt = annualAmt / Math.pow(1 + inflationRate, claimingAge - currentAge);
            }
            const discountedValue = deflatedAnnualAmt / Math.pow(1 + realReturn, yearsToClaim);
            futureRetIncomeDiscountedSum += discountedValue;
          }
        }
      });
      retirementReadyTarget = Math.max(0, (estRetSpending / factor) - activeRetIncome - futureRetIncomeDiscountedSum) / swr;
    }
  }

  const retirementLog = deflatedLogs.find(log => log.age === targetRetirementAge) || deflatedLogs[deflatedLogs.length - 1];
  
  // Also deflate ending surplus/shortfall
  const finalSurplusShortfall = plannedResults.endingSurplusShortfall / Math.pow(1 + inflationRate, yearsToCompute);

  // Compute Retirement Outcome
  let retirementOutcome;
  if (plannedResults.runOutAge === null) {
    if (retirementReadyAgeComfortable !== null && targetRetirementAge >= retirementReadyAgeComfortable) {
      retirementOutcome = 'comfortable';
    } else {
      retirementOutcome = 'sustainable';
    }
  } else {
    // runs out before life expectancy
    retirementOutcome = 'retirementGap';
  }

  const nominalRetirementLog = plannedResults.logs.find(log => log.age === targetRetirementAge) || plannedResults.logs[plannedResults.logs.length - 1];

  let nominalRetirementReadyTarget = 0;
  if (retirementReadyAge !== null) {
    const readyLogNominal = plannedResults.logs.find(l => l.age === retirementReadyAge);
    nominalRetirementReadyTarget = readyLogNominal ? readyLogNominal.fiNumber : (retirementReadyTarget * Math.pow(1 + inflationRate, retirementReadyAge - currentAge));
  }

  let nominalRetirementIncomeSources = 0;
  enabledEvents.forEach(ev => {
    if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
      const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
      let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
      if (ev.type === 'socialSecurity') {
        monthlyBenefit = socialSecurityDetails.monthlyBenefit;
      }
      let annualAmt = monthlyBenefit * 12;
      const isInflationAdjusted = ev.type === 'socialSecurity' || ev.inflationAdjusted !== false;
      if (isInflationAdjusted) {
        const factor = Math.pow(1 + inflationRate, claimingAge - currentAge);
        annualAmt = annualAmt * factor;
      }
      nominalRetirementIncomeSources += annualAmt;
    }
  });

  return {
    currentNetWorth: (Number(assets.cash) || 0) +
                     (Number(assets.emergencyFund) || 0) +
                     (Number(assets.brokerage) || 0) +
                     (Number(assets.trad401k) || 0) +
                     (Number(assets.tradIra) || 0) +
                     (Number(assets.rothIra) || 0) +
                     (Number(assets.hsa) || 0) +
                     (Number(assets.other) || 0) +
                     customAssetsStartingValue +
                     homeEquityBaseline -
                     initialDebtSum -
                     plannedResults.logs[plannedResults.logs.length - 1].debtBalance,
    fiNumber: retirementReadyTarget,
    fiAge: retirementReadyAge,
    yearsToFI: retirementReadyAge !== null ? Math.max(0, retirementReadyAge - currentAge) : null,
    retirementReadyAge: retirementReadyAge,
    retirementReadyTarget: retirementReadyTarget,
    retirementReadyAgeSWR,
    retirementReadyAgeComfortable,
    retirementReadyAgeSurvival,
    readinessCriteria,
    retirementIncomeSources: retirementIncomeSourcesInTodayDollars,
    targetRetirementAge,
    portfolioAtRetirement: retirementLog ? retirementLog.portfolio : 0,
    netWorthAtRetirement: retirementLog ? retirementLog.netWorth : 0,
    annualRetirementSpending: retirementLog ? retirementLog.expenses : 0,
    retirementOutcome,
    moneyLasts: plannedResults.moneyLasts,
    runOutAge: plannedResults.runOutAge,
    endingSurplusShortfall: finalSurplusShortfall,
    coastAge: plannedResults.coastAge,
    dynamicMilestones: plannedResults.dynamicMilestones,
    debtSummaries: plannedResults.debtSummaries,
    data: deflatedLogs,
    socialSecurityDetails,
    
    // Nominal vs Deflated support
    deflatedData: deflatedLogs,
    nominalData: plannedResults.logs,
    nominalRetirementReadyTarget,
    deflatedRetirementReadyTarget: retirementReadyTarget,
    nominalPortfolioAtRetirement: nominalRetirementLog ? nominalRetirementLog.portfolio : 0,
    deflatedPortfolioAtRetirement: retirementLog ? retirementLog.portfolio : 0,
    nominalNetWorthAtRetirement: nominalRetirementLog ? nominalRetirementLog.netWorth : 0,
    deflatedNetWorthAtRetirement: retirementLog ? retirementLog.netWorth : 0,
    nominalAnnualRetirementSpending: nominalRetirementLog ? nominalRetirementLog.expenses : 0,
    deflatedAnnualRetirementSpending: retirementLog ? retirementLog.expenses : 0,
    nominalEndingSurplusShortfall: plannedResults.endingSurplusShortfall,
    deflatedEndingSurplusShortfall: finalSurplusShortfall,
    nominalRetirementIncomeSources,
    deflatedRetirementIncomeSources: retirementIncomeSourcesInTodayDollars,
    socialSecurityDetails
  };
}

/**
 * Validates inputs for the FIRE simulator calculator
 *
 * @param {Object} inputs - User inputs
 * @returns {Object} Errors, warnings, and info arrays
 */
export function validateFireInputs(inputs) {
  const errors = [];
  const warnings = [];

  const currentAge = Number(inputs.currentAge);
  const targetRetirementAge = inputs.targetRetirementAge ? Number(inputs.targetRetirementAge) : null;
  const lifeExpectancy = Number(inputs.lifeExpectancy);
  const expectedReturn = Number(inputs.expectedReturn);
  const inflationRate = Number(inputs.inflationRate);
  const swr = Number(inputs.swr);

  // Validation Rules
  if (isNaN(currentAge) || currentAge < 0) {
    errors.push("Current age cannot be negative.");
  }
  if (targetRetirementAge !== null && targetRetirementAge < currentAge) {
    errors.push("Target retirement age cannot be lower than your current age.");
  }
  if (isNaN(lifeExpectancy) || lifeExpectancy <= currentAge) {
    errors.push("Life expectancy must be greater than your current age.");
  }
  if (isNaN(swr) || swr <= 0) {
    errors.push("Safe withdrawal rate must be greater than 0%.");
  }
  const lifestyleUpgrades = Number(inputs.lifestyleUpgrades);
  if (isNaN(lifestyleUpgrades) || lifestyleUpgrades < 0) {
    errors.push("Lifestyle upgrades rate cannot be negative.");
  }

  // Warnings
  if (expectedReturn < inflationRate) {
    warnings.push("Your expected investment return is lower than the inflation rate. This means your investments will lose purchasing power over time.");
  }

  const postRetirementReturn = inputs.postRetirementReturn !== undefined ? Number(inputs.postRetirementReturn) : expectedReturn;
  if (postRetirementReturn < inflationRate) {
    warnings.push("Your post-retirement expected return rate is lower than the inflation rate. This means your investments will lose purchasing power in retirement.");
  }

  if (Number(inputs.currentExpenses) > Number(inputs.currentIncome)) {
    warnings.push("Your current annual expenses exceed your current annual income. This indicates deficit spending and will drain your portfolio unless you adjust your plan.");
  }

  const incomeList = inputs.incomeList || [];
  const spendingPhases = inputs.spendingPhases || [];
  const debtList = inputs.debtList || [];
  const lifeEvents = inputs.lifeEvents || [];

  incomeList.forEach((inc, i) => {
    if (inc.endAge < inc.startAge) {
      errors.push(`Income Phase #${i+1} ("${inc.name}") has an end age (${inc.endAge}) that is earlier than its start age (${inc.startAge}).`);
    }
  });

  spendingPhases.forEach((p, i) => {
    if (p.endAge < p.startAge) {
      errors.push(`Spending Phase #${i+1} ("${p.name}") has an end age (${p.endAge}) that is earlier than its start age (${p.startAge}).`);
    }
  });

  debtList.forEach((debt, i) => {
    if (debt.balance < 0) {
      errors.push(`Debt entry #${i+1} ("${debt.name}") cannot have a negative balance.`);
    }
    if (debt.payment < 0) {
      errors.push(`Debt entry #${i+1} ("${debt.name}") cannot have a negative payment.`);
    }
  });

  // Verify life events
  lifeEvents.forEach((ev, i) => {
    if (ev.type === 'buyHouse' && ev.enabled) {
      const purchaseAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
      if (purchaseAge < currentAge) {
        errors.push(`Home Purchase age (${purchaseAge}) for event #${i+1} cannot be in the past.`);
      }
    }
    if (ev.type === 'sellHouse' && ev.enabled) {
      const saleAge = Number(ev.age);
      if (saleAge < currentAge) {
        errors.push(`Home Sale age (${saleAge}) for event #${i+1} cannot be in the past.`);
      }
    }
    if (ev.type === 'haveChild' && ev.enabled) {
      const birthAge = Number(ev.birthAge);
      const childStartAge = Number(ev.childStartAge || 0);
      if (birthAge < currentAge && childStartAge === 0) {
        errors.push(`Child birth age (${birthAge}) for event #${i+1} cannot be in the past unless the child is already born.`);
      }
    }
    if (ev.type === 'sabbatical' && ev.enabled) {
      const start = Number(ev.startAge);
      const end = Number(ev.endAge);
      if (end < start) {
        errors.push(`Sabbatical end age (${end}) for event #${i+1} cannot be earlier than start age (${start}).`);
      }
    }
    if (ev.type === 'college' && ev.enabled) {
      const start = Number(ev.startAge);
      if (start < currentAge) {
        errors.push(`College start age (${start}) for event #${i+1} cannot be in the past.`);
      }
    }
  });

  return {
    errors,
    warnings
  };
}

export function getSavingsPriority(key) {
  const priorities = {
    hsa: 1,
    trad401k: 2,
    tradIra: 3,
    rothIra: 4,
    brokerage: 5,
    checking: 6,
    hysa: 7,
    emergency: 8,
    debt: 9,
    other: 10
  };
  return priorities[key] || 99;
}

export function getNormalizedPhases(inputs) {
  const currentAge = Math.max(0, Number(inputs.currentAge) || 30);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled);
  const retireEvent = enabledEvents.find(e => e.type === 'retire');
  const targetRetirementAge = retireEvent 
    ? Math.max(currentAge, Number(retireEvent.age) || 65) 
    : lifeExpectancy;

  const boundaries = new Set();
  boundaries.add(currentAge);
  boundaries.add(targetRetirementAge);
  boundaries.add(lifeExpectancy);

  // Social Security Claiming Age Boundary
  const ssEv = enabledEvents.find(e => e.type === 'socialSecurity');
  if (ssEv) {
    const claimAge = Number(ssEv.claimingAge !== undefined ? ssEv.claimingAge : 67);
    if (claimAge > currentAge && claimAge < lifeExpectancy) {
      boundaries.add(claimAge);
    }
  }

  // A. Career Changes (from incomeList start ages)
  (inputs.incomeList || []).forEach(inc => {
    if (inc.id && typeof inc.id === 'string' && inc.id.startsWith('child-income-boost')) {
      return;
    }
    const start = Number(inc.startAge);
    if (start > currentAge && start < targetRetirementAge) {
      boundaries.add(start);
    }
  });

  // B. Moves (from spendingPhases start ages)
  (inputs.spendingPhases || []).forEach(sp => {
    const start = Number(sp.startAge);
    if (start > currentAge && start < targetRetirementAge) {
      boundaries.add(start);
    }
  });

  // C. Life Events (marriage, divorce, haveChild, buyHouse, sellHouse)
  enabledEvents.forEach(ev => {
    const age = Number(ev.age || ev.purchaseAge || ev.birthAge || ev.startAge);
    if (age > currentAge && age < targetRetirementAge) {
      if (['marriage', 'divorce', 'haveChild', 'buyHouse', 'sellHouse'].includes(ev.type)) {
        boundaries.add(age);
      }
    }
  });

  // Spouse Retirement boundary
  const marriageEventForBoundary = enabledEvents.find(e => e.type === 'marriage');
  if (marriageEventForBoundary) {
    const spouseCurrentAge = Number(marriageEventForBoundary.spouseCurrentAge) || currentAge;
    const spouseDesiredRetirementAge = marriageEventForBoundary.spouseDesiredRetirementAge;
    if (spouseDesiredRetirementAge !== undefined && spouseDesiredRetirementAge !== null && spouseDesiredRetirementAge !== '') {
      const spouseRetAge = Number(spouseDesiredRetirementAge);
      const userAgeWhenSpouseRetires = currentAge + (spouseRetAge - spouseCurrentAge);
      if (userAgeWhenSpouseRetires > currentAge && userAgeWhenSpouseRetires < targetRetirementAge) {
        boundaries.add(userAgeWhenSpouseRetires);
      }
    }
  }

  // D. Child count transitions (when active child count changes)
  for (let age = currentAge + 1; age < lifeExpectancy; age++) {
    const prevCount = getActiveChildrenCountAtAge(age - 1, inputs.lifeEvents);
    const count = getActiveChildrenCountAtAge(age, inputs.lifeEvents);
    if (count !== prevCount) {
      boundaries.add(age);
    }
  }

  const sortedBoundaries = Array.from(boundaries)
    .filter(age => age <= lifeExpectancy)
    .sort((a, b) => a - b);
  const phases = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];

    const childCount = getActiveChildrenCountAtAge(start, inputs.lifeEvents);

    const ssEvent = enabledEvents.find(e => e.type === 'socialSecurity');
    const ssClaimingAge = ssEvent ? (Number(ssEvent.claimingAge !== undefined ? ssEvent.claimingAge : (ssEvent.startAge !== undefined ? ssEvent.startAge : ssEvent.age)) || 67) : 67;
    const isReceivingSS = ssEvent && start >= ssClaimingAge;

    // Identify primary type, name, and icon
    let type = 'workSave';
    let name = isReceivingSS ? 'Working (Receiving SS)' : 'Standard Work Phase';
    let icon = isReceivingSS ? '🇺🇸' : '💼';

    if (start >= targetRetirementAge) {
      type = 'retire';
      if (isReceivingSS) {
        icon = '🇺🇸';
        name = childCount > 0
          ? (childCount === 1 ? '1 Child (Receiving SS)' : `${childCount} Kids (Receiving SS)`)
          : 'Receiving SS';
      } else {
        icon = childCount > 0 ? '👶' : '🌴';
        name = childCount > 0 
          ? (childCount === 1 ? '1 Child (Retired)' : `${childCount} Kids (Retired)`)
          : 'Retirement';
      }
    } else if (childCount > 0) {
      type = 'childcare';
      if (isReceivingSS) {
        icon = '🇺🇸';
        name = childCount === 1 ? '1 Child (Receiving SS)' : `${childCount} Kids (Receiving SS)`;
      } else {
        name = childCount === 1 ? '1 Child' : `${childCount} Kids`;
        icon = '👶';
      }
    } else {
      const marriageEv = enabledEvents.find(e => e.type === 'marriage' && Number(e.age) === start);
      const divorceEv = enabledEvents.find(e => e.type === 'divorce' && Number(e.age) === start);
      const childEv = enabledEvents.find(e => e.type === 'haveChild' && Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) === start);
      const buyHouseEv = enabledEvents.find(e => e.type === 'buyHouse' && Number(e.purchaseAge !== undefined ? e.purchaseAge : e.age) === start);
      const incomeItem = (inputs.incomeList || []).find(inc => Number(inc.startAge) === start && inc.id !== 'simple-inc-childcare' && !inc.id.startsWith('child-income-boost'));
      const spendingItem = (inputs.spendingPhases || []).find(sp => Number(sp.startAge) === start && sp.id !== 'simple-spend-childcare');

      if (marriageEv) {
        type = 'marriage';
        name = isReceivingSS ? 'Marriage Phase (Receiving SS)' : 'Marriage Phase';
        icon = isReceivingSS ? '🇺🇸' : '💍';
      }
    }

    const id = `${type}_${start}_${end}`;

    // Defaults calculations
    // User monthly income
    const rawIncomeItem = (inputs.incomeList || []).find(inc => start >= inc.startAge && start < inc.endAge && inc.id !== 'simple-inc-childcare' && !inc.id.startsWith('child-income-boost'));
    let baseSalaryMonthly = 0;
    let growthRate = 0.03;
    if (start >= targetRetirementAge) {
      baseSalaryMonthly = 0;
      growthRate = 0;
    } else if (rawIncomeItem) {
      baseSalaryMonthly = rawIncomeItem.frequency === 'monthly' ? Math.round(Number(rawIncomeItem.amount)) : Math.round(Number(rawIncomeItem.amount) / 12);
      growthRate = Number(rawIncomeItem.growthRate) || 0.03;
    } else {
      baseSalaryMonthly = Math.round((Number(inputs.simpleIncome) || 50000) / 12);
      growthRate = 0.03;
    }

    let childBoost = 0;
    if (childCount > 0) {
      let activeBoostMonthly = 0;
      (inputs.incomeList || []).forEach(inc => {
        if (inc.id && typeof inc.id === 'string' && inc.id.startsWith('child-income-boost')) {
          if (inc.startAge <= start && inc.endAge > start) {
            const boostYearly = inc.frequency === 'monthly' ? Number(inc.amount) * 12 : Number(inc.amount);
            activeBoostMonthly += boostYearly / 12;
          }
        }
      });
      childBoost = activeBoostMonthly;
    }

    // Add Social Security monthly benefit if receiving SS
    let ssMonthlyIncome = 0;
    if (isReceivingSS && ssEvent) {
      if (ssEvent.useEarnings) {
        const incomeHistory = getIncomeHistory(inputs, ssEvent, true);
        const ssCalculated = calculateSocialSecurityBenefit({
          incomeHistory,
          claimAge: ssClaimingAge,
          fullRetirementAge: 67
        });
        ssMonthlyIncome = Math.round(ssCalculated.monthlyBenefit);
      } else {
        const baseBenefit = Number(ssEvent.monthlyBenefit !== undefined ? ssEvent.monthlyBenefit : 2000);
        const factor = getSocialSecurityFactor(ssClaimingAge);
        ssMonthlyIncome = Math.round(baseBenefit * factor);
      }
    }

    const defaultIncome = baseSalaryMonthly + childBoost + ssMonthlyIncome;

    // User monthly expenses
    const rawSpendingItem = (inputs.spendingPhases || []).find(sp => start >= sp.startAge && start < sp.endAge && sp.id !== 'simple-spend-childcare');
    let baseExpensesMonthly = 0;
    if (start >= targetRetirementAge) {
      baseExpensesMonthly = 0;
    } else if (rawSpendingItem) {
      baseExpensesMonthly = rawSpendingItem.frequency === 'monthly' ? Math.round(Number(rawSpendingItem.amount)) : Math.round(Number(rawSpendingItem.amount) / 12);
    } else {
      baseExpensesMonthly = Math.round((Number(inputs.simpleExpenses) || 42500) / 12);
    }

    const marriageEvent = enabledEvents.find(e => e.type === 'marriage');
    const isMarried = marriageEvent && start >= Number(marriageEvent.age);
    const spouseCurrentAge = marriageEvent ? (Number(marriageEvent.spouseCurrentAge) || currentAge) : currentAge;
    const spouseAgeAtStart = spouseCurrentAge + (start - currentAge);
    const partnerRetirementAge = (marriageEvent && marriageEvent.spouseDesiredRetirementAge !== undefined && marriageEvent.spouseDesiredRetirementAge !== null && marriageEvent.spouseDesiredRetirementAge !== '')
      ? Number(marriageEvent.spouseDesiredRetirementAge)
      : (targetRetirementAge + (spouseCurrentAge - currentAge));
    const isPartnerRetiredInPhase = isMarried && spouseAgeAtStart >= partnerRetirementAge;

    let spouseIncome = 0;
    let spouseIncomeGrowthRate = 0;
    let spouseSavingsRate = 0;
    let spouseCash = 0;
    let spouseInvestments = 0;
    let spouseRetirement = 0;

    let partnerSSMonthlyIncome = 0;
    if (isMarried) {
      const spouseMember = (inputs.householdMembers || []).find(m => m.id === 'spouse');
      if (spouseMember) {
        const spouseClaimAge = Number(spouseMember.spouseSocialSecurityAge !== undefined ? spouseMember.spouseSocialSecurityAge : 67);
        if (start >= spouseClaimAge) {
          if (spouseMember.spouseEstimatedSocialSecurityBenefit !== undefined && spouseMember.spouseEstimatedSocialSecurityBenefit !== null && spouseMember.spouseEstimatedSocialSecurityBenefit !== '' && Number(spouseMember.spouseEstimatedSocialSecurityBenefit) > 0) {
            const baseBenefit = Number(spouseMember.spouseEstimatedSocialSecurityBenefit);
            const factor = getSocialSecurityFactor(spouseClaimAge);
            partnerSSMonthlyIncome = Math.round(baseBenefit * factor);
          } else if (spouseMember.income > 0) {
            const spouseRetAge = spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== ''
              ? Number(spouseMember.desiredRetirementAge)
              : (targetRetirementAge + (spouseMember.currentAge !== undefined ? spouseMember.currentAge : (marriageEvent.spouseCurrentAge !== undefined ? marriageEvent.spouseCurrentAge : currentAge)) - currentAge);
            const spouseWorkYears = Math.max(0, spouseRetAge - 22);
            const spouseIncomeHistory = new Array(spouseWorkYears).fill(Number(spouseMember.income) || 0);
            const spouseSSCalc = calculateSocialSecurityBenefit({
              incomeHistory: spouseIncomeHistory,
              claimAge: spouseClaimAge
            });
            partnerSSMonthlyIncome = Math.round(spouseSSCalc.monthlyBenefit);
          }
        }
      }
    }

    if (isMarried) {
      if (start < targetRetirementAge && !isPartnerRetiredInPhase) {
        const spouseMember = (inputs.householdMembers || []).find(m => m.id === 'spouse');
        spouseIncome = spouseMember ? Math.round((Number(spouseMember.income) || 0) / 12) : Math.round(Number(marriageEvent.spouseIncome || 0) / 12);
        spouseIncomeGrowthRate = spouseMember
          ? (Number(spouseMember.incomeGrowthRate !== undefined ? spouseMember.incomeGrowthRate : spouseMember.growthRate) || 0)
          : (Number(marriageEvent.incomeGrowthRate !== undefined ? marriageEvent.incomeGrowthRate : marriageEvent.growthRate) || 0);
        if (spouseIncomeGrowthRate > 0.5) spouseIncomeGrowthRate /= 100;

        spouseSavingsRate = spouseMember ? (Number(spouseMember.savingsRate) || 0) : (Number(marriageEvent.savingsRate) || 0);
        spouseCash = spouseMember?.assets ? (Number(spouseMember.assets.cash) || 0) : (Number(marriageEvent.cash) || 0);
        spouseInvestments = spouseMember?.assets ? (Number(spouseMember.assets.investments) || 0) : (Number(marriageEvent.investments) || 0);
        spouseRetirement = spouseMember?.assets ? (Number(spouseMember.assets.retirement) || 0) : (Number(marriageEvent.retirement) || 0);

        // default combined spending if married
        if (marriageEvent.combinedSpendingAfterMarriage) {
          baseExpensesMonthly = Math.round(Number(marriageEvent.combinedSpendingAfterMarriage) / 12);
        } else {
          const spousePersonal = Math.round(spouseIncome * (1 - spouseSavingsRate / 100)); // default spouse spending
          const lifestyle = Number(marriageEvent.lifestyleAdjustment || 0);
          const housing = Number(marriageEvent.housingSavings || 0);
          baseExpensesMonthly = baseExpensesMonthly + spousePersonal + lifestyle + housing;
        }
      } else {
        // Spouse is retired, set spouseIncome to spouse's SS benefit
        spouseIncome = partnerSSMonthlyIncome;
      }
    }

    let defaultExpenses = {
      housing: Math.round(baseExpensesMonthly * 0.4),
      utilities: Math.round(baseExpensesMonthly * 0.1),
      food: Math.round(baseExpensesMonthly * 0.1),
      diningOut: Math.round(baseExpensesMonthly * 0.05),
      transportation: Math.round(baseExpensesMonthly * 0.1),
      healthcare: Math.round(baseExpensesMonthly * 0.08),
      leisure: Math.round(baseExpensesMonthly * 0.08),
      misc: Math.round(baseExpensesMonthly * 0.09)
    };
    const sumVal = Object.values(defaultExpenses).reduce((a, b) => a + b, 0);
    const diff = Math.round(baseExpensesMonthly) - sumVal;
    defaultExpenses.misc += diff;

    if (start < targetRetirementAge) {
      if (childCount > 0) {
        if (inputs.budgetDetails?.childcareBudgets?.[childCount]?.expenses) {
          defaultExpenses = { ...inputs.budgetDetails.childcareBudgets[childCount].expenses };
        } else if (inputs.budgetDetails?.childcareExpenses) {
          defaultExpenses = { ...inputs.budgetDetails.childcareExpenses };
        } else if (inputs.budgetDetails?.expenses) {
          defaultExpenses = { ...inputs.budgetDetails.expenses };
        }
      } else {
        if (inputs.budgetDetails?.expenses) {
          defaultExpenses = { ...inputs.budgetDetails.expenses };
        }
      }
    } else {
      // Scale down from pre-retirement phase expenses
      let sourcePhase = [...phases].reverse().find(p => p.startAge < targetRetirementAge && p.childCount === childCount);
      if (!sourcePhase) {
        sourcePhase = [...phases].reverse().find(p => p.startAge < targetRetirementAge);
      }
      const sourceExpenses = sourcePhase ? sourcePhase.expenses : defaultExpenses;
      const spendingPercent = retireEvent && retireEvent.spendingPercent !== undefined ? Number(retireEvent.spendingPercent) : 70;
      const scale = spendingPercent / 100;
      let retirementExpenses = {};
      Object.keys(sourceExpenses).forEach(key => {
        retirementExpenses[key] = Math.round((sourceExpenses[key] || 0) * scale);
      });
      defaultExpenses = retirementExpenses;
    }

    // Default savings
    let defaultSavingsMonthly = 0;
    if (start < targetRetirementAge) {
      if (inputs.preTaxSavingsRate) {
        defaultSavingsMonthly = Math.round(((defaultIncome * 12) * (Number(inputs.preTaxSavingsRate) / 100)) / 12);
      } else {
        defaultSavingsMonthly = Math.max(0, Math.round(defaultIncome - baseExpensesMonthly));
      }
    }
    
    let defaultSavings = {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: defaultSavingsMonthly, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
    };
    if (start < targetRetirementAge) {
      if (childCount > 0) {
        if (inputs.budgetDetails?.childcareBudgets?.[childCount]?.savings) {
          defaultSavings = { ...inputs.budgetDetails.childcareBudgets[childCount].savings };
        } else if (inputs.budgetDetails?.childcareSavings) {
          defaultSavings = { ...inputs.budgetDetails.childcareSavings };
        } else if (inputs.budgetDetails?.savings) {
          defaultSavings = { ...inputs.budgetDetails.savings };
        }
      } else {
        if (inputs.budgetDetails?.savings) {
          defaultSavings = { ...inputs.budgetDetails.savings };
        }
      }
    }

    let defaultPartnerSavings = {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
    };
    if (isMarried && start < targetRetirementAge && !isPartnerRetiredInPhase) {
      const partnerPreTax = Math.round((spouseIncome * 12 * (spouseSavingsRate / 100)) / 12);
      defaultPartnerSavings.brokerage = partnerPreTax;
    }

    const savedPhase = (inputs.budgetDetails?.phases || []).find(p => p.id === id || (Number(p.startAge) === start && p.type === type));

    let resolvedIncome = defaultIncome;
    if (savedPhase && savedPhase.income !== undefined) {
      resolvedIncome = Number(savedPhase.income);
      if (childCount > 0 && childBoost > 0) {
        const standardBase = (start >= targetRetirementAge) ? ssMonthlyIncome : baseSalaryMonthly;
        if (resolvedIncome <= standardBase) {
          resolvedIncome += childBoost;
        }
      }
      if (type === 'childcare') {
        let savedChildCount = 0;
        if (savedPhase.type === 'childcare' && savedPhase.name) {
          if (savedPhase.name.includes('1 Child')) {
            savedChildCount = 1;
          } else {
            const match = savedPhase.name.match(/(\d+)\s+Kids?/i);
            if (match) {
              savedChildCount = parseInt(match[1], 10);
            }
          }
        }
        // No automatic boost adjustment here (user-initiated choice)
        // resolvedIncome += (childCount - savedChildCount) * 1250;
      }
    }

    const phase = {
      id,
      name,
      icon,
      type,
      startAge: start,
      endAge: end,
      childCount,
      income: resolvedIncome,
      incomeGrowthRate: growthRate,
      ssMonthlyIncome,
      savingsAllocMode: savedPhase?.savingsAllocMode || inputs.budgetDetails?.savingsAllocMode || 'fixed',
      savings: savedPhase?.savings ? { ...savedPhase.savings } : defaultSavings,
      partnerSavings: savedPhase?.partnerSavings ? { ...savedPhase.partnerSavings } : defaultPartnerSavings,
      expenses: savedPhase?.expenses ? { ...savedPhase.expenses } : defaultExpenses,
      
      // Married details
      isMarried,
      spouseIncome,
      spouseIncomeGrowthRate,
      spouseSavingsRate,
      spouseCash,
      spouseInvestments,
      spouseRetirement
    };

    phases.push(phase);
  }

  return phases;
}

export function getIncomeHistory(inputs, overrideEvent = null, skipNormalizedPhases = false) {
  const currentAge = Math.max(0, Number(inputs.currentAge) || 30);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  
  // Find Social Security event to get start working age info
  const ssEv = overrideEvent && overrideEvent.type === 'socialSecurity'
    ? overrideEvent
    : (inputs.lifeEvents || []).find(e => e.type === 'socialSecurity' && e.enabled);
  
  let startWorkingAge = currentAge;
  if (ssEv) {
    if (ssEv.ageStartedWorking !== undefined && ssEv.ageStartedWorking !== null && ssEv.ageStartedWorking !== '') {
      startWorkingAge = Math.min(currentAge, Number(ssEv.ageStartedWorking));
    } else if (ssEv.yearStartedWorking !== undefined && ssEv.yearStartedWorking !== null && ssEv.yearStartedWorking !== '') {
      const currentYear = new Date().getFullYear();
      const yearsWorked = currentYear - Number(ssEv.yearStartedWorking);
      startWorkingAge = Math.max(0, currentAge - yearsWorked);
    }
  }

  let startingIncomeAnnual = Number(inputs.simpleIncome) || 50000;
  let preRetirementPhases = [];
  
  if (!skipNormalizedPhases) {
    // Get normalized phases to know what the income is for each pre-retirement year
    const phases = getNormalizedPhases(inputs);
    preRetirementPhases = phases.filter(p => p.type !== 'retire');
    
    // Find current/starting income in today's dollars
    const currentPhase = preRetirementPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge) || preRetirementPhases[0];
    startingIncomeAnnual = currentPhase ? currentPhase.income * 12 : (Number(inputs.simpleIncome) || 50000);
  } else {
    const rawIncomeItem = (inputs.incomeList || []).find(inc => inc.startAge <= currentAge && inc.endAge > currentAge && inc.id !== 'simple-inc-childcare' && !inc.id.startsWith('child-income-boost'));
    startingIncomeAnnual = rawIncomeItem 
      ? (rawIncomeItem.frequency === 'monthly' ? rawIncomeItem.amount * 12 : rawIncomeItem.amount) 
      : (Number(inputs.simpleIncome) || 50000);
  }
  
  const earnings = [];
  
  // 1. Past working years (ages startWorkingAge to currentAge - 1)
  for (let age = startWorkingAge; age < currentAge; age++) {
    earnings.push(startingIncomeAnnual);
  }
  
  // 2. Future years (ages currentAge to lifeExpectancy - 1)
  const retireEvent = (inputs.lifeEvents || []).find(e => e.type === 'retire' && e.enabled);
  const targetRetirementAge = retireEvent ? Math.max(currentAge, Number(retireEvent.age) || 65) : lifeExpectancy;
  
  const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled);
  
  for (let age = currentAge; age < lifeExpectancy; age++) {
    if (age >= targetRetirementAge) {
      earnings.push(0);
      continue;
    }
    
    let baseIncomeMonthly = 0;
    let growthRate = 0.03;
    let startOfPhase = currentAge;
    
    if (!skipNormalizedPhases) {
      // Find active phase for this age
      const activePhase = preRetirementPhases.find(p => age >= p.startAge && age < p.endAge);
      if (activePhase) {
        baseIncomeMonthly = activePhase.income;
        growthRate = activePhase.incomeGrowthRate !== undefined ? activePhase.incomeGrowthRate : 0.03;
        startOfPhase = activePhase.startAge;
      } else {
        baseIncomeMonthly = (Number(inputs.simpleIncome) || 50000) / 12;
        growthRate = 0.03;
      }
    } else {
      const activeIncomeItem = (inputs.incomeList || []).find(inc => age >= inc.startAge && age < inc.endAge && inc.id !== 'simple-inc-childcare' && !inc.id.startsWith('child-income-boost'));
      if (activeIncomeItem) {
        baseIncomeMonthly = activeIncomeItem.frequency === 'monthly' ? Number(activeIncomeItem.amount) : Number(activeIncomeItem.amount) / 12;
        growthRate = Number(activeIncomeItem.growthRate) || 0.03;
        startOfPhase = activeIncomeItem.startAge;
      } else {
        baseIncomeMonthly = (Number(inputs.simpleIncome) || 50000) / 12;
        growthRate = 0.03;
      }
    }
    
    // Grow income based on growthRate from start of active phase (real growth rate in today's dollars)
    const inflationRate = (Number(inputs.inflationRate) || 3) / 100;
    const realGrowthRate = growthRate - inflationRate;
    const yearsGrown = age - startOfPhase;
    let annualIncome = (baseIncomeMonthly * 12) * Math.pow(1 + realGrowthRate, yearsGrown);
    
    // Apply Barista FIRE part-time income overrides
    const baristaEv = enabledEvents.find(e => e.type === 'baristaFire' && age >= Number(e.startAge));
    if (baristaEv) {
      annualIncome = Number(baristaEv.partTimeIncome) || 0;
    }
    
    // Apply Sabbaticals
    enabledEvents.forEach(ev => {
      if (ev.type === 'sabbatical') {
        const start = Number(ev.startAge);
        const end = Number(ev.endAge);
        if (age >= start && age < end) {
          const reduction = Number(ev.incomeReduction) || 0;
          annualIncome = Math.max(0, annualIncome * (1 - reduction / 100));
        }
      }
    });
    
    earnings.push(annualIncome);
  }
  
  return earnings;
}

export function buildSocialSecurityEarningsRecord({
  incomeHistory,
  indexingMode = "simple",
  wageIndexFactors = null
}) {
  return (incomeHistory || []).map(v => Number(v) || 0);
}

export function calculateAIME(indexedEarningsHistory) {
  const sorted = [...indexedEarningsHistory].sort((a, b) => b - a);
  const topYears = sorted.slice(0, 35);
  while (topYears.length < 35) {
    topYears.push(0);
  }
  const sum = topYears.reduce((a, b) => a + b, 0);
  const aimeMonthly = sum / 420;
  const averageTop35AnnualIncome = sum / 35;
  return {
    top35AnnualEarnings: sum,
    aimeMonthly,
    averageTop35AnnualIncome
  };
}

export function calculatePIA({
  aimeMonthly,
  firstBendPoint = 1286,
  secondBendPoint = 7749
}) {
  let pia = 0;
  if (aimeMonthly <= firstBendPoint) {
    pia = aimeMonthly * 0.90;
  } else if (aimeMonthly <= secondBendPoint) {
    pia = firstBendPoint * 0.90 + (aimeMonthly - firstBendPoint) * 0.32;
  } else {
    pia = firstBendPoint * 0.90 + (secondBendPoint - firstBendPoint) * 0.32 + (aimeMonthly - secondBendPoint) * 0.15;
  }
  return pia;
}

export function calculateClaimingAgeMultiplier({
  claimAge,
  fullRetirementAge = 67
}) {
  const age = Math.max(62, Math.min(70, claimAge));
  let multiplier = 1.0;
  let adjustmentType = 'full-retirement';
  let monthsEarly = 0;
  let monthsDelayed = 0;
  
  if (age < fullRetirementAge) {
    monthsEarly = (fullRetirementAge - age) * 12;
    adjustmentType = 'early-claiming';
    
    let reduction = 0;
    if (monthsEarly <= 36) {
      reduction = monthsEarly * (5 / 900);
    } else {
      reduction = 36 * (5 / 900) + (monthsEarly - 36) * (5 / 1200);
    }
    multiplier = Math.max(0, 1.0 - reduction);
  } else if (age > fullRetirementAge) {
    monthsDelayed = (age - fullRetirementAge) * 12;
    adjustmentType = 'delayed-credit';
    multiplier = 1.0 + monthsDelayed * (8 / 1200);
  }
  
  return {
    multiplier,
    adjustmentType,
    monthsEarly,
    monthsDelayed
  };
}

export function calculateTop35AverageIncome(incomeHistory) {
  const aimeRes = calculateAIME(incomeHistory);
  const workingYears = (incomeHistory || []).filter(v => Number(v) > 0).length;
  const isEligible = workingYears >= 10;
  return {
    workingYears,
    isEligible,
    top35AnnualEarnings: aimeRes.top35AnnualEarnings,
    aimeMonthly: aimeRes.aimeMonthly,
    averageTop35AnnualIncome: aimeRes.averageTop35AnnualIncome
  };
}

export function calculateSocialSecurityBenefit({
  incomeHistory,
  claimAge,
  fullRetirementAge = 67,
  firstBendPoint = 1286,
  secondBendPoint = 7749,
  indexingMode = "simple"
}) {
  const workingYears = (incomeHistory || []).filter(v => Number(v) > 0).length;
  const isEligible = workingYears >= 10;
  
  if (!isEligible) {
    return {
      claimAge,
      workingYears,
      isEligible: false,
      indexedEarningsHistory: (incomeHistory || []).map(v => Number(v) || 0),
      top35AnnualEarnings: 0,
      averageTop35AnnualIncome: 0,
      aimeMonthly: 0,
      piaMonthly: 0,
      claimingAgeMultiplier: 0,
      monthlyBenefit: 0,
      annualBenefit: 0,
      adjustmentType: 'Not eligible'
    };
  }
  
  const indexedEarningsHistory = (incomeHistory || []).map(v => Number(v) || 0);
  const aimeRes = calculateAIME(indexedEarningsHistory);
  const piaMonthly = calculatePIA({
    aimeMonthly: aimeRes.aimeMonthly,
    firstBendPoint,
    secondBendPoint
  });
  
  const multRes = calculateClaimingAgeMultiplier({
    claimAge,
    fullRetirementAge
  });
  
  const monthlyBenefit = piaMonthly * multRes.multiplier;
  const annualBenefit = monthlyBenefit * 12;
  
  return {
    claimAge,
    workingYears,
    isEligible,
    indexedEarningsHistory,
    top35AnnualEarnings: aimeRes.top35AnnualEarnings,
    averageTop35AnnualIncome: aimeRes.averageTop35AnnualIncome,
    aimeMonthly: aimeRes.aimeMonthly,
    piaMonthly,
    claimingAgeMultiplier: multRes.multiplier,
    monthlyBenefit,
    annualBenefit,
    adjustmentType: multRes.adjustmentType
  };
}

export function validateSocialSecurityClaimAge(claimAge) {
  const age = Number(claimAge);
  if (isNaN(age) || age < 62) {
    return {
      validAge: 62,
      wasClamped: true,
      message: "Social Security must be taken between ages 62 and 70."
    };
  }
  if (age > 70) {
    return {
      validAge: 70,
      wasClamped: true,
      message: "Social Security must be taken between ages 62 and 70."
    };
  }
  return {
    validAge: age,
    wasClamped: false,
    message: ""
  };
}