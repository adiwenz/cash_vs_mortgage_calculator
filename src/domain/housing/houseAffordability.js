import { runFireSimulation, getNormalizedPhases } from '../../fireCalculations.js';
import { calculateUSTaxForModal } from '../../simulatorMathUtils.js';

/**
 * Calculates the total upfront cash required to complete a home purchase.
 */
export function calculateTotalCashRequired(event) {
  if (!event) return 0;
  const homePrice = Number(event.homePrice) || 0;
  const downPayment = Number(event.downPayment) || 0;
  let closingCostsRate = 3;
  if (event.closingCosts !== undefined && event.closingCosts !== null) {
    const parsed = Number(event.closingCosts);
    if (!isNaN(parsed)) {
      closingCostsRate = parsed;
    }
  }
  const closingCosts = homePrice * (closingCostsRate / 100);
  const points = Number(event.points) || 0;
  const renovationCosts = Number(event.renovationCost) || Number(event.renovationCosts) || 0;
  const movingCosts = Number(event.movingCost) || Number(event.movingCosts) || 0;

  return downPayment + closingCosts + points + renovationCosts + movingCosts;
}

/**
 * Calculates the available liquid assets (cash + brokerage) at the year before purchase age.
 */
export function calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults) {
  const targetAge = Number(purchaseAge) || Number(inputs?.currentAge) || 35;

  if (simulationResults) {
    const results = simulationResults.baselineResults || simulationResults.activeResults || simulationResults;
    if (results && (results.nominalData || results.data)) {
      const logs = results.nominalData || results.data;
      const logBefore = logs.find(l => l.age === targetAge - 1);
      if (logBefore) {
        const cash = Number(logBefore.cashBalance) || 0;
        const brokerage = Number(logBefore.brokerageBalance) || 0;
        return cash + brokerage;
      }
    }
  }

  // Fallback to starting assets
  const assets = inputs?.assets || {};
  const cash = Number(assets.cash) || 0;
  const brokerage = Number(assets.brokerage) || 0;
  return cash + brokerage;
}

export function getAvailableLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults) {
  return calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
}

/**
 * Calculates the cash shortfall.
 */
export function calculateCashShortfall(totalCashRequired, liquidAssets) {
  return Math.max(0, totalCashRequired - liquidAssets);
}

/**
 * Calculates the cash affordable home price.
 */
export function calculateCashAffordableHomePrice({
  liquidAssets,
  downPaymentPercent,
  closingCostPercent,
  variableUpfrontPercent = 0,
  fixedUpfrontCosts = 0
}) {
  const denominator = downPaymentPercent + closingCostPercent + variableUpfrontPercent;
  if (denominator <= 0) return 0;
  const price = (liquidAssets - fixedUpfrontCosts) / denominator;
  return Math.max(0, Math.floor(price));
}

/**
 * Calculates additional cash needed.
 */
export function calculateAdditionalCashNeeded({ totalCashRequired, liquidAssets }) {
  return Math.max(0, totalCashRequired - liquidAssets);
}

/**
 * Verifies if the home purchase is affordable with current liquid assets.
 */
export function isCashAffordable(event, liquidAssets) {
  const totalCashRequired = calculateTotalCashRequired(event);
  return totalCashRequired <= liquidAssets;
}

/**
 * Calculates the monthly principal and interest payment.
 */
export function getMonthlyPIForPrice(price, buyHouseEv) {
  const p = price;
  const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
  let dp = buyHouseEv.downPayment || 0;
  if (originalPrice > 0 && buyHouseEv.purchaseType !== 'cash') {
    const ratio = (buyHouseEv.downPayment || 0) / originalPrice;
    dp = p * ratio;
  }
  dp = Math.min(dp, p);
  
  const isCash = dp >= p || buyHouseEv.purchaseType === 'cash';
  if (isCash) return 0;
  
  const rate = (buyHouseEv.mortgageRate !== undefined ? Number(buyHouseEv.mortgageRate) : 6.5) / 100;
  const mortgageTerm = buyHouseEv.loanTerm !== undefined ? Number(buyHouseEv.loanTerm) : 30;
  const loanAmount = Math.max(0, p - dp);
  if (loanAmount > 0 && mortgageTerm > 0) {
    const r = rate / 12;
    const n = mortgageTerm * 12;
    return r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }
  return 0;
}

/**
 * Calculates the total monthly housing cost (P&I + tax + insurance + maintenance + HOA + utilities + PMI).
 */
export function getHousingCostForPrice(price, buyHouseEv) {
  const p = price;
  const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
  
  let dp = buyHouseEv.downPayment || 0;
  if (originalPrice > 0 && buyHouseEv.purchaseType !== 'cash') {
    const ratio = (buyHouseEv.downPayment || 0) / originalPrice;
    dp = p * ratio;
  }
  dp = Math.min(dp, p);
  
  const isCash = dp >= p || buyHouseEv.purchaseType === 'cash';
  
  const monthlyPI = getMonthlyPIForPrice(p, buyHouseEv);

  const propTaxRate = (buyHouseEv.propertyTax !== undefined ? Number(buyHouseEv.propertyTax) : 1.1) / 100;
  const insRate = (buyHouseEv.insurance !== undefined ? Number(buyHouseEv.insurance) : 0.35) / 100;
  const maintRate = (buyHouseEv.maintenance !== undefined ? Number(buyHouseEv.maintenance) : 1.0) / 100;
  
  const monthlyPropTax = (p * propTaxRate) / 12;
  const monthlyIns = (p * insRate) / 12;
  const monthlyMaint = (p * maintRate) / 12;
  const monthlyHoa = Number(buyHouseEv.hoa) || 0;
  const monthlyUtil = Number(buyHouseEv.utilitiesIncrease) || 0;
  
  let monthlyPmi = 0;
  if (!isCash && dp < p * 0.2) {
    const loanAmount = Math.max(0, p - dp);
    const pmiRate = buyHouseEv.pmi !== undefined ? Number(buyHouseEv.pmi) : 0.5;
    monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
  }
  
  return Math.round(monthlyPI + monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi);
}

/**
 * Calculates required down payment and closing/moving/renovation costs for a home price.
 */
export function getRequiredDownPaymentAndCosts(price, buyHouseEv) {
  const p = price;
  const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
  
  let dp = buyHouseEv.downPayment || 0;
  if (originalPrice > 0 && buyHouseEv.purchaseType !== 'cash') {
    const ratio = (buyHouseEv.downPayment || 0) / originalPrice;
    dp = p * ratio;
  }
  dp = Math.min(dp, p);
  
  return calculateTotalCashRequired({
    ...buyHouseEv,
    homePrice: p,
    downPayment: dp
  });
}

/**
 * Runs a local simulation with the house event applied and returns the resulting retirement ready age.
 */
export function getSimulatedRetirementAge(inputs, event) {
  if (!inputs || !event) return null;
  try {
    const tempInputs = JSON.parse(JSON.stringify(inputs));
    const houseId = event.houseId || `house-${Date.now()}`;
    const p = Number(event.homePrice) || 0;
    const dp = Number(event.downPayment) || 0;
    const purchaseAge = Number(event.purchaseAge || event.age || 35);
    
    const houseAssetObj = {
      id: houseId,
      name: event.name || 'Primary Home',
      purchasePrice: p,
      downPayment: dp,
      purchaseType: event.purchaseType || 'mortgage',
      mortgageRate: event.mortgageRate !== undefined ? Number(event.mortgageRate) : 6.5,
      loanTermYears: event.loanTerm !== undefined ? Number(event.loanTerm) : 30,
      propertyTaxRate: event.propertyTax !== undefined ? Number(event.propertyTax) : 1.1,
      insuranceCost: event.insurance !== undefined ? Number(event.insurance) : 0.35,
      hoaCost: event.hoa !== undefined ? Number(event.hoa) : 0,
      maintenanceRate: event.maintenance !== undefined ? Number(event.maintenance) : 1.0,
      renovationCost: event.renovationCost !== undefined ? Number(event.renovationCost) : 0,
      utilitiesIncrease: event.utilitiesIncrease !== undefined ? Number(event.utilitiesIncrease) : 0,
      appreciationRate: event.appreciationRate !== undefined ? Number(event.appreciationRate) : 3.0,
      sellingCostRate: event.sellingCost !== undefined ? Number(event.sellingCost) : 6,
      keepRent: event.keepRent !== undefined ? !!event.keepRent : false
    };
    
    if (!tempInputs.houseAssets) tempInputs.houseAssets = [];
    tempInputs.houseAssets = tempInputs.houseAssets.filter(h => h.id !== houseId);
    tempInputs.houseAssets.push(houseAssetObj);
    
    const buyEvId = event.id || `buy-${Date.now()}`;
    const buyEvObj = {
      id: buyEvId,
      type: 'buyHouse',
      enabled: true,
      name: 'Buy House',
      purchaseAge: purchaseAge,
      age: purchaseAge,
      houseId: houseId,
      keepRent: event.keepRent !== undefined ? !!event.keepRent : false
    };
    
    tempInputs.lifeEvents = (tempInputs.lifeEvents || []).filter(e => e.id !== buyEvId && e.houseId !== houseId);
    tempInputs.lifeEvents.push(buyEvObj);
    
    const res = runFireSimulation(tempInputs);
    return res?.retirementReadyAge || tempInputs.targetRetirementAge || 65;
  } catch (e) {
    console.error("Error in getSimulatedRetirementAge:", e);
    return inputs.targetRetirementAge || 65;
  }
}

/**
 * Calculates grossed up income for a net raise need.
 */
export function grossUpIncome(netNeed, currentGrossIncome, filingStatus) {
  if (netNeed <= 0) return 0;
  const taxAtCurrent = calculateUSTaxForModal(currentGrossIncome, 0, filingStatus);
  const currentNet = currentGrossIncome - taxAtCurrent;
  
  let low = netNeed;
  let high = netNeed * 2.5;
  let grossRaise = netNeed;
  
  for (let i = 0; i < 20; i++) {
    grossRaise = (low + high) / 2;
    const taxAtNew = calculateUSTaxForModal(currentGrossIncome + grossRaise, 0, filingStatus);
    const newNet = (currentGrossIncome + grossRaise) - taxAtNew;
    const netRaise = newNet - currentNet;
    
    if (Math.abs(netRaise - netNeed) < 1) {
      break;
    }
    if (netRaise < netNeed) {
      low = grossRaise;
    } else {
      high = grossRaise;
    }
  }
  return Math.round(grossRaise);
}

export function getOldRentBeforePurchase(originalInputs, purchaseAge) {
  const phases = getNormalizedPhases(originalInputs);
  if (phases && phases.length > 0) {
    const sortedPhases = [...phases]
      .filter(p => p.startAge < purchaseAge)
      .sort((a, b) => b.startAge - a.startAge);
    for (const phase of sortedPhases) {
      const rent = phase.expenses && (phase.expenses.housing || phase.expenses.rent || 0);
      if (rent > 0) return Number(rent) || 0;
    }
  }
  if (originalInputs.budgetDetails?.expenses) {
    const rent = originalInputs.budgetDetails.expenses.housing || originalInputs.budgetDetails.expenses.rent || 0;
    if (rent > 0) return Number(rent) || 0;
  }
  return 0;
}

export function calculateMaxAffordableHomePrice(inputs, profile, activeBudget, activeBuyHouseEv, simulationResults) {
  const buyHouseEv = activeBuyHouseEv || inputs?.lifeEvents?.find(e => e.type === 'buyHouse') || {};
  const purchaseAge = Number(buyHouseEv.purchaseAge || buyHouseEv.age || inputs?.currentAge || 35);
  
  // 1) Liquid assets
  const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);

  // 2) Rent (current rent)
  const rent = activeBudget?.expenses
    ? Number(activeBudget.expenses.housing || activeBudget.expenses.rent || 0)
    : getOldRentBeforePurchase(inputs, purchaseAge);

  // 3) Down payment and closing costs percentages
  let downPaymentPct = 20;
  if (buyHouseEv.downPaymentPct !== undefined && buyHouseEv.downPaymentPct !== null) {
    downPaymentPct = buyHouseEv.downPaymentPct;
  } else if (buyHouseEv.homePrice > 0 && buyHouseEv.downPayment !== undefined) {
    downPaymentPct = Math.round((buyHouseEv.downPayment / buyHouseEv.homePrice) * 100);
  }

  const closingCosts = Number(buyHouseEv.closingCosts !== undefined ? buyHouseEv.closingCosts : 3);
  const mortgageRate = Number(buyHouseEv.mortgageRate !== undefined ? buyHouseEv.mortgageRate : 6.5);
  const loanTerm = Number(buyHouseEv.loanTerm !== undefined ? buyHouseEv.loanTerm : 30);
  const renovationCost = buyHouseEv.renovationCost !== undefined && buyHouseEv.renovationCost !== null ? Number(buyHouseEv.renovationCost) : 0;
  const movingCosts = buyHouseEv.movingCosts !== undefined && buyHouseEv.movingCosts !== null ? Number(buyHouseEv.movingCosts) :
                     (buyHouseEv.movingCost !== undefined && buyHouseEv.movingCost !== null ? Number(buyHouseEv.movingCost) : 3000);

  const dpPct = downPaymentPct / 100;
  const ccPct = closingCosts / 100;
  
  // Cash limit / Suggested price based on cash available
  const denominator = dpPct + ccPct;
  const fixedCosts = renovationCost + movingCosts;
  const rawSuggestedPrice = denominator > 0 ? Math.max(0, (liquidAssets - fixedCosts) / denominator) : 0;
  const suggestedPrice = Math.floor(rawSuggestedPrice / 1000) * 1000;

  // Monthly payment limit
  const rate = mortgageRate / 100;
  const r = rate / 12;
  const n = loanTerm * 12;
  let factor = 0;
  if (n > 0) {
    if (r === 0) {
      factor = 1 / n;
    } else {
      factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
  }
  const pAndIFractionOfPrice = (1 - dpPct) * factor;
  
  let rawMonthlyPrice = null;
  if (rent > 0) {
    if (pAndIFractionOfPrice > 0) {
      rawMonthlyPrice = rent / pAndIFractionOfPrice;
    }
  }
  const monthlyAffordablePrice = rawMonthlyPrice == null ? null : Math.floor(Math.max(0, rawMonthlyPrice) / 1000) * 1000;

  const rawRecommendedPrice = rawMonthlyPrice == null
    ? rawSuggestedPrice
    : Math.min(rawSuggestedPrice, rawMonthlyPrice);
    
  const recommendedPrice = Math.floor(Math.max(0, rawRecommendedPrice) / 1000) * 1000;

  return {
    suggestedPrice,
    cashAffordablePrice: suggestedPrice, // alias for compatibility
    monthlyAffordablePrice,
    recommendedPrice
  };
}


