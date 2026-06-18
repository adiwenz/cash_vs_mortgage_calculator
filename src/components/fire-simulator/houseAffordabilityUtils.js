import { runFireSimulation } from '../../fireCalculations';

/**
 * Calculates the total upfront cash required to complete a home purchase.
 *
 * @param {Object} event - Buy House event object
 * @returns {number} Total cash required
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
 * Fall back to current cash + brokerage if projections are unavailable.
 *
 * @param {Object} inputs - User inputs
 * @param {number} purchaseAge - House purchase age
 * @param {Object} simulationResults - Active or baseline simulation results
 * @returns {number} Available liquid assets
 */
export function calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults) {
  const targetAge = Number(purchaseAge) || Number(inputs?.currentAge) || 35;

  if (simulationResults && (simulationResults.nominalData || simulationResults.data)) {
    const logs = simulationResults.nominalData || simulationResults.data;
    // Look at the year before the purchase (targetAge - 1)
    const logBefore = logs.find(l => l.age === targetAge - 1);
    if (logBefore) {
      const cash = Number(logBefore.cashBalance) || 0;
      const brokerage = Number(logBefore.brokerageBalance) || 0;
      return cash + brokerage;
    }
  }

  // Fallback to starting assets
  const assets = inputs?.assets || {};
  const cash = Number(assets.cash) || 0;
  const brokerage = Number(assets.brokerage) || 0;
  return cash + brokerage;
}

// Keep alias just in case
export function getAvailableLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults) {
  return calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
}

/**
 * Calculates the cash shortfall.
 *
 * @param {number} totalCashRequired - Total cash required
 * @param {number} liquidAssets - Liquid assets available
 * @returns {number} Shortfall amount
 */
export function calculateCashShortfall(totalCashRequired, liquidAssets) {
  return Math.max(0, totalCashRequired - liquidAssets);
}

/**
 * Calculates the cash affordable home price.
 *
 * @param {Object} params
 * @param {number} params.liquidAssets - Available liquid assets
 * @param {number} params.downPaymentPercent - Down payment percentage (decimal, e.g. 0.20)
 * @param {number} params.closingCostPercent - Closing cost percentage (decimal, e.g. 0.03)
 * @param {number} [params.variableUpfrontPercent=0] - Additional variable upfront costs (decimal)
 * @param {number} [params.fixedUpfrontCosts=0] - Fixed upfront costs (dollars)
 * @returns {number} Cash affordable home price
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
 *
 * @param {Object} params
 * @param {number} params.totalCashRequired - Total cash required
 * @param {number} params.liquidAssets - Liquid assets available
 * @returns {number} Shortfall amount
 */
export function calculateAdditionalCashNeeded({ totalCashRequired, liquidAssets }) {
  return Math.max(0, totalCashRequired - liquidAssets);
}

/**
 * Verifies if the home purchase is affordable with current liquid assets.
 *
 * @param {Object} event - Buy House event object
 * @param {number} liquidAssets - Liquid assets available
 * @returns {boolean} True if affordable
 */
export function isCashAffordable(event, liquidAssets) {
  const totalCashRequired = calculateTotalCashRequired(event);
  return totalCashRequired <= liquidAssets;
}

/**
 * Runs a local simulation with the house event applied and returns the resulting retirement ready age.
 *
 * @param {Object} inputs - Active scenario inputs
 * @param {Object} event - Buy House event object
 * @returns {number} Simulated retirement ready age
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


