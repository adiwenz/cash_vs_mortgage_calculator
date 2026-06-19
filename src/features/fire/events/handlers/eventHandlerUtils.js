export function cloneInputs(inputs) {
  return JSON.parse(JSON.stringify(inputs));
}

export function findMatchingEvent(inputs, evt) {
  if (!evt) return null;
  
  if (evt.originalId) {
    const found = inputs.lifeEvents?.find(e => e.id === evt.originalId);
    if (found) return found;
    const foundPhase = inputs.spendingPhases?.find(p => p.id === evt.originalId);
    if (foundPhase) return foundPhase;
    const foundIncome = inputs.incomeList?.find(i => i.id === evt.originalId);
    if (foundIncome) return foundIncome;
  }
  
  const ageVal = Number(evt.age !== undefined ? evt.age : (evt.startAge !== undefined ? evt.startAge : (evt.purchaseAge !== undefined ? evt.purchaseAge : (evt.birthAge !== undefined ? evt.birthAge : (evt.claimingAge !== undefined ? evt.claimingAge : evt.ageReceived)))));
  
  if (evt.type === 'retire') {
    return inputs.lifeEvents?.find(e => e.type === 'retire');
  }

  return inputs.lifeEvents?.find(e => e.type === evt.type && (
    Number(e.age) === ageVal || 
    Number(e.purchaseAge) === ageVal || 
    Number(e.birthAge) === ageVal || 
    Number(e.startAge) === ageVal || 
    Number(e.claimingAge) === ageVal || 
    Number(e.ageReceived) === ageVal
  ));
}

export function upsertLifeEvent(inputs, event) {
  const newInputs = cloneInputs(inputs);
  if (!newInputs.lifeEvents) {
    newInputs.lifeEvents = [];
  }
  newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== event.id);
  newInputs.lifeEvents.push(event);
  return newInputs;
}

export function removeLifeEvent(inputs, id) {
  const newInputs = cloneInputs(inputs);
  if (newInputs.lifeEvents) {
    newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== id);
  }
  return newInputs;
}

export function normalizeEventAge(age, fallback = 30) {
  const parsed = Number(age);
  return isNaN(parsed) ? fallback : parsed;
}

export function normalizeCurrency(val, fallback = 0) {
  const parsed = Number(val);
  return isNaN(parsed) ? fallback : parsed;
}

export function normalizePercent(val, fallback = 0) {
  const parsed = Number(val);
  return isNaN(parsed) ? fallback : parsed;
}

export function createStableEventId(type) {
  return `${type}-${Date.now()}`;
}

export function stripTransientRecommendationMetadata(event) {
  if (!event) return null;
  const copy = { ...event };
  delete copy.recommendationApplied;
  delete copy.appliedRecommendationType;
  delete copy.appliedRecommendationAt;
  delete copy.retirementTimingChanged;
  return copy;
}

export function createStandardResult(updatedInputs, savedEvent = null) {
  return {
    updatedInputs,
    savedEvent,
    deletedEvents: [],
    linkedEventsCreated: [],
    linkedEventsDeleted: [],
    sideEffects: {
      impactSummary: null,
      rebalanceStrategies: [],
      retirementDelayDiff: null,
      cashShortfall: null,
      mortgagePayment: null
    },
    warnings: [],
    uiRequests: []
  };
}
