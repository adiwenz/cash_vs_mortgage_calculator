import { handleChildRecommendation } from './handlers/childRecommendationHandler.js';
import { handleHousingRecommendation } from './handlers/housingRecommendationHandler.js';
import { handleBudgetRecommendation } from './handlers/budgetRecommendationHandler.js';
import { handleDebtRecommendation } from './handlers/debtRecommendationHandler.js';
import { handleRetirementRecommendation } from './handlers/retirementRecommendationHandler.js';

/**
 * Routes a recommendation application to its specific pure handler module.
 * 
 * @param {Object} inputs Original scenario inputs
 * @param {Object|string} scenario Selected recommendation/improvement scenario or type
 * @param {Object|null} editingEvent Current event in modal or wizard (if any)
 * @param {Object} options Additional parameters like houseRebalanceSummary
 * @returns {Object} Standard return shape of recommendation application
 */
export function applyRecommendation(inputs, scenario, editingEvent, options = {}) {
  const type = (scenario && typeof scenario === 'object') ? scenario.type : (scenario || '');
  const normalizedScenario = (scenario && typeof scenario === 'object') ? scenario : { type };

  if (type.startsWith('childPromotion') || 
      type.startsWith('childOffset') || 
      type.startsWith('childBudgetRebalance') || 
      type.startsWith('childSaveMore')) {
    return handleChildRecommendation(inputs, normalizedScenario, editingEvent);
  }

  if ([
    'reduceHomePrice', 'increaseDownPayment', 'delayHomePurchase', 'delayHomePurchaseDownPayment',
    'redirectSavingsDownPayment', 'pauseNonRetirementSavings', 'redirectBrokerageHouseFund',
    'increaseDownPaymentIncome', 'purchaseWithPartner', 'purchaseWithRoommate',
    'updatePrice', 'incomeBoost', 'increaseHomeIncome', 'saveForDownPayment'
  ].includes(type)) {
    return handleHousingRecommendation(inputs, normalizedScenario, editingEvent, options);
  }

  if (['savings', 'spending', 'reduceDiscretionary', 'increaseDebtIncome'].includes(type)) {
    return handleBudgetRecommendation(inputs, normalizedScenario, editingEvent);
  }

  if (['startDebtPayoff'].includes(type)) {
    return handleDebtRecommendation(inputs, normalizedScenario, editingEvent);
  }

  if (['retire65', 'retireReadyAge', 'retireRequestedDate', 'delayRetirement', 'combined', 'extendRetirementAge'].includes(type)) {
    return handleRetirementRecommendation(inputs, normalizedScenario, editingEvent);
  }

  // Fallback return shape
  return {
    updatedInputs: JSON.parse(JSON.stringify(inputs)),
    updatedEditingEvent: editingEvent ? { ...editingEvent } : null,
    linkedEventsCreated: [],
    linkedEventsUpdated: [],
    linkedEventsDeleted: [],
    sideEffects: {
      notificationMsg: null,
      showBudgetModal: false,
      pulsePhaseId: null,
      impactSummary: null,
      rebalanceStrategies: [],
      retirementTimingChanged: false
    },
    warnings: [`Unknown recommendation type: ${type}`]
  };
}
