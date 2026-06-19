/**
 * Pure handler for debt payoff plan recommendations.
 * 
 * @param {Object} inputs Original inputs
 * @param {Object} scenario Selected recommendation scenario
 * @param {Object} editingEvent Current editingEvent
 * @returns {Object} Standardized recommendation output
 */
export function handleDebtRecommendation(inputs, scenario, editingEvent) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  const currentAgeVal = Number(newInputs.currentAge) || 30;

  const activeLoan = scenario.activeDebts?.find(d => d.type !== 'mortgage');
  const payoffId = `payoff-plan-auto-${Date.now()}`;
  let payoffEvent = null;
  if (activeLoan) {
    payoffEvent = {
      id: payoffId,
      type: 'payoffPlan',
      borrowingId: activeLoan.id,
      extraPayment: 100,
      startAge: currentAgeVal,
      linked: true,
      enabled: true,
      name: `Payoff Plan: ${activeLoan.name}`
    };
    newInputs.lifeEvents = [...(newInputs.lifeEvents || []), payoffEvent];
  }

  let updatedEditingEvent = editingEvent ? { ...editingEvent } : null;

  return {
    updatedInputs: newInputs,
    updatedEditingEvent,
    linkedEventsCreated: payoffEvent ? [payoffEvent] : [],
    linkedEventsUpdated: [],
    linkedEventsDeleted: [],
    sideEffects: {
      notificationMsg: payoffEvent ? `✓ Payoff Plan added for ${activeLoan.name}` : null,
      showBudgetModal: false,
      pulsePhaseId: null,
      impactSummary: null,
      rebalanceStrategies: [],
      retirementTimingChanged: false
    },
    warnings: []
  };
}
