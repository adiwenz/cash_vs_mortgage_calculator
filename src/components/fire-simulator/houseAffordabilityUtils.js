/**
 * Calculates the available liquid assets (cash + brokerage) at the year before purchase age.
 * Fall back to current cash + brokerage if projections are unavailable.
 *
 * @param {Object} inputs - User inputs
 * @param {number} purchaseAge - House purchase age
 * @param {Object} simulationResults - Active or baseline simulation results
 * @returns {number} Available liquid assets
 */
export function getAvailableLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults) {
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

/**
 * Calculates the maximum affordable home price given available liquid assets and down payment percentage.
 *
 * @param {Object} params
 * @param {number} params.liquidAssets - Available liquid assets
 * @param {number} params.downPaymentPercent - Down payment percentage (0-100)
 * @returns {number} Maximum affordable home price (rounded safely to prevent down payment overflow)
 */
export function calculateAffordableHomePrice({ liquidAssets, downPaymentPercent }) {
  if (liquidAssets <= 0 || downPaymentPercent <= 0) {
    return 0;
  }
  const pct = downPaymentPercent / 100;
  let affordablePrice = Math.floor(liquidAssets / pct);

  // Rounding safety check: make sure calculated down payment <= liquidAssets
  let calculatedDownPayment = Math.round(affordablePrice * pct);
  while (calculatedDownPayment > liquidAssets && affordablePrice > 0) {
    affordablePrice--;
    calculatedDownPayment = Math.round(affordablePrice * pct);
  }

  return affordablePrice;
}
