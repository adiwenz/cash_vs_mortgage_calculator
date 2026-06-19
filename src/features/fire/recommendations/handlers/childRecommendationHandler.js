import { applyChildRecommendation } from '../../../../domain/events/child/childRecommendations.js';

/**
 * Pure handler for childcare-related recommendations.
 * 
 * @param {Object} inputs Original inputs
 * @param {Object} scenario Selected recommendation scenario
 * @param {Object} editingEvent Current editingEvent
 * @returns {Object} Standardized recommendation output
 */
export function handleChildRecommendation(inputs, scenario, editingEvent) {
  const updatedInputs = applyChildRecommendation(inputs, scenario);
  
  let notificationMsg = '';
  if (scenario.type.startsWith('childPromotion') || scenario.type.startsWith('childOffset')) {
    notificationMsg = `✓ Promotion event added to your timeline\n+ $${scenario.promoEvent?.salaryIncrease?.toLocaleString() || ''}/year income\nRetirement plan updated`;
  } else if (scenario.type.startsWith('childBudgetRebalance')) {
    notificationMsg = `✓ Budget rebalanced during childcare years\nRetirement plan updated`;
  } else if (scenario.type.startsWith('childSaveMore')) {
    notificationMsg = `✓ Savings increased starting now\nRetirement plan updated`;
  }

  let updatedEditingEvent = editingEvent ? { ...editingEvent } : null;
  if (updatedEditingEvent && updatedEditingEvent.id === scenario.childEventId) {
    updatedEditingEvent.recommendationApplied = true;
    updatedEditingEvent.appliedRecommendationType = scenario.type;
    updatedEditingEvent.appliedRecommendationAt = Date.now();
    updatedEditingEvent.retirementTimingChanged = false;
  }

  return {
    updatedInputs,
    updatedEditingEvent,
    linkedEventsCreated: (scenario.type.startsWith('childPromotion') || scenario.type.startsWith('childOffset')) && scenario.promoEvent ? [scenario.promoEvent] : [],
    linkedEventsUpdated: [],
    linkedEventsDeleted: [],
    sideEffects: {
      notificationMsg,
      showBudgetModal: false,
      pulsePhaseId: 'childcare',
      impactSummary: null,
      rebalanceStrategies: [],
      retirementTimingChanged: false
    },
    warnings: []
  };
}
