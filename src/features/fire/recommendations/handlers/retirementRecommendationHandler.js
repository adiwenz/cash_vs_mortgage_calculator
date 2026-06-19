/**
 * Pure handler for retirement timing recommendation scenarios.
 * 
 * @param {Object} inputs Original inputs
 * @param {Object} scenario Selected recommendation scenario
 * @param {Object} editingEvent Current editingEvent
 * @returns {Object} Standardized recommendation output
 */
export function handleRetirementRecommendation(inputs, scenario, editingEvent) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  const targetRetAgeVal = Number(inputs.targetRetirementAge) || 65;
  const currentAgeVal = Number(inputs.currentAge) || 30;

  let newAge = targetRetAgeVal;
  if (scenario.type === 'delayRetirement' || scenario.type === 'retireRequestedDate') {
    newAge = targetRetAgeVal + (Number(scenario.value) || 0);
  } else if (scenario.type === 'retire65') {
    newAge = currentAgeVal < 65 ? 65 : currentAgeVal;
  } else if (scenario.type === 'retireReadyAge' || scenario.type === 'extendRetirementAge') {
    newAge = Number(scenario.value) || targetRetAgeVal;
  } else if (scenario.type === 'combined') {
    const yearsDelay = scenario.value && typeof scenario.value === 'object' ? (Number(scenario.value.delay) || 0) : 0;
    newAge = targetRetAgeVal + yearsDelay;
  }

  newInputs.targetRetirementAge = newAge;
  newInputs.lifeEvents = (newInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'retire') {
      return { ...ev, age: newAge };
    }
    return ev;
  });

  // Sync career incomes in incomeList
  newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
    if (inc.endAge === targetRetAgeVal) {
      return { ...inc, endAge: newAge };
    }
    return inc;
  });

  let updatedEditingEvent = editingEvent ? { ...editingEvent } : null;
  if (updatedEditingEvent) {
    updatedEditingEvent.recommendationApplied = true;
    updatedEditingEvent.appliedRecommendationType = scenario.type;
    updatedEditingEvent.appliedRecommendationAt = Date.now();
    updatedEditingEvent.retirementTimingChanged = true;
  }

  return {
    updatedInputs: newInputs,
    updatedEditingEvent,
    linkedEventsCreated: [],
    linkedEventsUpdated: [],
    linkedEventsDeleted: [],
    sideEffects: {
      notificationMsg: `✓ Retirement age adjusted to Age ${newAge}.`,
      showBudgetModal: false,
      pulsePhaseId: null,
      impactSummary: null,
      rebalanceStrategies: [],
      retirementTimingChanged: true
    },
    warnings: []
  };
}
