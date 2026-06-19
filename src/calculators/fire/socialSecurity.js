import { getNormalizedPhases } from './phases.js';

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
    } else {
      startWorkingAge = Math.min(currentAge, 22);
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
    const rawIncomeItem = (inputs.incomeList || []).find(inc => inc.startAge <= currentAge && inc.endAge > currentAge && !inc.id.startsWith('simple-inc-childcare') && !inc.id.startsWith('simple-inc-prechild'));
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
      const activeIncomeItem = (inputs.incomeList || []).find(inc => age >= inc.startAge && age < inc.endAge && !inc.id.startsWith('simple-inc-childcare') && !inc.id.startsWith('simple-inc-prechild'));
      if (activeIncomeItem) {
        baseIncomeMonthly = activeIncomeItem.frequency === 'monthly' ? Number(activeIncomeItem.amount) : Number(activeIncomeItem.amount) / 12;
        growthRate = (activeIncomeItem.growthRate !== undefined && activeIncomeItem.growthRate !== null && activeIncomeItem.growthRate !== '') ? Number(activeIncomeItem.growthRate) : 0.03;
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
