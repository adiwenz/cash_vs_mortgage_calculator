/**
 * Recommendation 1: Retire at 65
 * A conditional recommendation. If the user's current targetRetirementAge is < 65,
 * calculate if working until 65 resolves the shortfall using a simple projection formula.
 * 
 * @param {number} currentAge - User's current age.
 * @param {number} targetRetirementAge - User's target retirement age.
 * @param {number} currentAssets - User's current assets/portfolio value.
 * @param {number} annualSavings - User's current annual savings amount.
 * @param {number} rateOfReturn - Expected annual rate of return as a decimal (e.g., 0.07 for 7%).
 * @param {number} swr - Safe withdrawal rate as a decimal (e.g., 0.04 for 4%).
 * @param {number} retirementExpenses - User's projected annual retirement expenses.
 * @returns {Object} Result indicating applicability, shortfall resolution, and new shortfall amount.
 */
export function calculateRetireAt65Recommendation(
  currentAge,
  targetRetirementAge,
  currentAssets,
  annualSavings,
  rateOfReturn,
  swr,
  retirementExpenses
) {
  if (targetRetirementAge >= 65 || currentAge >= 65) {
    return {
      applicable: false,
      resolvesShortfall: false,
      newShortfall: null
    };
  }

  const yearsTo65 = 65 - currentAge;
  
  // Project assets to age 65:
  // Future Value of Current Assets + Future Value of Annual Savings
  let projectedAssets = currentAssets * Math.pow(1 + rateOfReturn, yearsTo65);
  
  if (rateOfReturn > 0) {
    const fvFactor = (Math.pow(1 + rateOfReturn, yearsTo65) - 1) / rateOfReturn;
    projectedAssets += annualSavings * fvFactor;
  } else {
    projectedAssets += annualSavings * yearsTo65;
  }

  // Required Assets at retirement (using SWR)
  const targetAssets = swr > 0 ? retirementExpenses / swr : 0;

  const newShortfall = Math.max(0, targetAssets - projectedAssets);
  const resolvesShortfall = newShortfall <= 0;

  return {
    applicable: true,
    resolvesShortfall,
    newShortfall
  };
}

/**
 * Recommendation 2: Save More
 * Calculate the additional annual savings required to bridge a given percentage of the shortfall.
 * Uses the future value of an ordinary annuity formula.
 * 
 * @param {number} shortfall - The projected shortfall amount (positive value).
 * @param {number} rateOfReturn - Expected annual rate of return as a decimal (e.g., 0.07 for 7%).
 * @param {number} yearsUntilRetirement - Years until retirement (targetRetirementAge - currentAge).
 * @param {number} [targetPercentage=1.0] - Fraction of shortfall to bridge (default is 1.0 for 100%).
 * @returns {number} Additional annual savings required.
 */
export function calculateSaveMoreRecommendation(shortfall, rateOfReturn, yearsUntilRetirement, targetPercentage = 1.0) {
  if (shortfall <= 0 || yearsUntilRetirement <= 0) {
    return 0;
  }
  
  const targetAmount = shortfall * targetPercentage;
  
  if (rateOfReturn <= 0) {
    return targetAmount / yearsUntilRetirement;
  }
  
  const r = rateOfReturn;
  const n = yearsUntilRetirement;
  
  // Future Value of Annuity Factor: ((1 + r)^n - 1) / r
  const fvFactor = (Math.pow(1 + r, n) - 1) / r;
  return targetAmount / fvFactor;
}

/**
 * Recommendation 3: Earn More
 * Calculate the required gross salary increase to bridge a given percentage of the shortfall.
 * Accounts for marginal tax rate so that the net increase covers the shortfall.
 * 
 * @param {number} shortfall - The projected shortfall amount (positive value).
 * @param {number} rateOfReturn - Expected annual rate of return as a decimal (e.g., 0.07 for 7%).
 * @param {number} yearsUntilRetirement - Years until retirement (targetRetirementAge - currentAge).
 * @param {number} marginalTaxRate - Marginal tax rate as a decimal (e.g., 0.25 for 25%).
 * @param {number} [targetPercentage=1.0] - Fraction of shortfall to bridge (default is 1.0 for 100%).
 * @returns {number} Required gross salary increase.
 */
export function calculateEarnMoreRecommendation(shortfall, rateOfReturn, yearsUntilRetirement, marginalTaxRate, targetPercentage = 1.0) {
  if (shortfall <= 0 || yearsUntilRetirement <= 0) {
    return 0;
  }
  
  if (marginalTaxRate >= 1 || marginalTaxRate < 0) {
    return 0; // Prevent division by zero or negative results
  }
  
  const netSavingsRequired = calculateSaveMoreRecommendation(shortfall, rateOfReturn, yearsUntilRetirement, targetPercentage);
  
  // gross * (1 - tax) = net => gross = net / (1 - tax)
  return netSavingsRequired / (1 - marginalTaxRate);
}

export function getChildCostOffsetRecommendations(inputs) {
  const childEvents = (inputs.lifeEvents || []).filter(
    e => e.type === 'haveChild' && e.enabled
  );
  if (childEvents.length === 0) {
    return [];
  }
  
  return childEvents.map(ev => {
    // Avoid duplicate promotion creation
    const hasPromo = (inputs.incomeList || []).some(
      inc => inc.id === ev.linkedEventId || inc.parentEventId === ev.id
    );
    if (hasPromo) {
      return null;
    }

    const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
    const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
    const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
    const maxAge = includeCollege ? 22 : 18;
    
    // Determine the cost in each age bracket
    const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
    const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
    const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
    const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);
    
    const peakCost = Math.max(
      ages0to4,
      ages5to12,
      ages13to18,
      includeCollege ? ages19to22 : 0
    );
    
    const parentStartAge = birthAge + childStartAge;
    const parentEndAge = birthAge + maxAge;
    const duration = maxAge - childStartAge;
    
    return {
      childEventId: ev.id,
      childName: ev.childName || '',
      peakCost,
      duration,
      parentStartAge,
      parentEndAge
    };
  }).filter(Boolean);
}
