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

