import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall,
  getSimulatedRetirementAge
} from '../../../domain/housing/houseAffordability.js';

/**
 * Checks if a home purchase event has resolved its tradeoffs (shortfalls or retirement delays).
 * 
 * Rules:
 * - If no recommendation is required, return true.
 * - If tradeoffs existed but recommendationApplied === true, return true.
 * - If the event still has unresolved cash shortfall/monthly shortfall and no applied recommendation, return false.
 * 
 * @param {Object} event The buyHouse event
 * @param {Object} inputs Current scenario inputs
 * @param {Object} simulationResults Current simulation results (activeResults or baselineResults)
 * @returns {boolean} True if tradeoffs are resolved or do not exist, false otherwise
 */
export function hasResolvedRecommendationTradeoffs(event, inputs, simulationResults) {
  if (!event || event.type !== 'buyHouse') {
    return true; // No recommendation is required for non-house events
  }
  
  if (event.recommendationApplied === true) {
    return true; // Tradeoffs existed but recommendationApplied is true
  }

  const purchaseAge = event.purchaseAge !== undefined ? event.purchaseAge : (event.age || 35);
  const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
  const totalCashRequired = calculateTotalCashRequired(event);
  const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
  const hasCashShortfall = cashShortfall > 0;

  const beforeReadyAge = simulationResults?.retirementReadyAge || inputs.targetRetirementAge || 65;
  const afterReadyAge = getSimulatedRetirementAge(inputs, event);
  const retirementDelayYears = Math.max(0, afterReadyAge - beforeReadyAge);
  const hasRetirementDelay = retirementDelayYears > 0;

  if (hasCashShortfall || hasRetirementDelay) {
    return false; // has unresolved shortfall/delay and no applied recommendation
  }

  return true;
}
