import { 
  cloneInputs, 
  createStandardResult, 
  normalizeEventAge, 
  normalizeCurrency, 
  normalizePercent, 
  stripTransientRecommendationMetadata
} from './eventHandlerUtils.js';

export const genericEventHandler = {
  edit(baseEvent, inputs) {
    if (!baseEvent) return null;
    
    // Check if it's a move/spending phase
    const isFromSpendingPhases = inputs.spendingPhases?.some(p => p.id === baseEvent.id);
    if (isFromSpendingPhases || baseEvent.type === 'move') {
      let location = baseEvent.location;
      if (!location && baseEvent.name && baseEvent.name.startsWith("Moved to ")) {
        location = baseEvent.name.substring("Moved to ".length);
      }
      return {
        ...baseEvent,
        location: location || 'New City',
        moveAge: baseEvent.moveAge !== undefined ? baseEvent.moveAge : baseEvent.startAge,
        newSpending: baseEvent.newSpending !== undefined ? baseEvent.newSpending : baseEvent.annualSpending,
        movingCost: baseEvent.movingCost !== undefined ? baseEvent.movingCost : 0,
        type: 'move'
      };
    }

    return { ...baseEvent };
  },

  save(editingEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const type = editingEvent.type;
    const cleanEvent = stripTransientRecommendationMetadata(editingEvent);
    
    let savedEvent;

    if (type === 'move') {
      const moveAge = normalizeEventAge(cleanEvent.moveAge, 35);
      const newSpending = normalizeCurrency(cleanEvent.newSpending, 40000);
      const movingCost = normalizeCurrency(cleanEvent.movingCost, 0);
      const location = cleanEvent.location || 'New City';

      const newPhase = {
        id: cleanEvent.id && cleanEvent.id !== 'move' ? cleanEvent.id : `spend-${Date.now()}`,
        name: `Moved to ${location}`,
        startAge: moveAge,
        endAge: newInputs.lifeExpectancy || 85,
        amount: newSpending,
        frequency: 'yearly',
        annualSpending: newSpending,
        inflationOverride: null,
        notes: `Lifestyle after moving to ${location}`,
        location,
        moveAge,
        newSpending,
        movingCost
      };

      // Adjust prior overlapping phase end age
      const updatedPhases = (newInputs.spendingPhases || []).map(p => {
        if (p.startAge < moveAge && p.endAge > moveAge) {
          return { ...p, endAge: moveAge };
        }
        return p;
      });

      // Filter out this move ID if it already exists
      const remainingPhases = updatedPhases.filter(p => p.id !== newPhase.id);
      newInputs.spendingPhases = [...remainingPhases, newPhase];
      savedEvent = newPhase;
    } else {
      // Fallback simple lifeEvent
      let newEventObj = {
        id: cleanEvent.id && !['haveChild', 'college', 'windfall', 'debtPayoff', 'custom'].includes(cleanEvent.id)
          ? cleanEvent.id
          : `${type}-${Date.now()}`,
        type,
        enabled: true,
        name: cleanEvent.name || type.charAt(0).toUpperCase() + type.slice(1)
      };

      if (type === 'college') {
        newEventObj = {
          ...newEventObj,
          startAge: normalizeEventAge(cleanEvent.startAge, 18),
          tuitionCost: normalizeCurrency(cleanEvent.tuitionCost, 25000),
          duration: normalizeEventAge(cleanEvent.duration, 4)
        };
      } else if (type === 'windfall') {
        newEventObj = {
          ...newEventObj,
          ageReceived: normalizeEventAge(cleanEvent.ageReceived, 50),
          amount: normalizeCurrency(cleanEvent.amount, 50000),
          taxRate: normalizePercent(cleanEvent.taxRate, 0)
        };
      } else if (type === 'debtPayoff') {
        newEventObj = {
          ...newEventObj,
          payoffAge: normalizeEventAge(cleanEvent.payoffAge, 45),
          amount: normalizeCurrency(cleanEvent.amount, 10000)
        };
      } else if (type === 'custom') {
        newEventObj = {
          ...newEventObj,
          age: normalizeEventAge(cleanEvent.age, 40),
          amount: normalizeCurrency(cleanEvent.amount, 5000)
        };
      } else {
        // Fallback for completely unknown properties
        newEventObj = {
          ...newEventObj,
          ...cleanEvent,
          age: normalizeEventAge(cleanEvent.age || cleanEvent.startAge, 40)
        };
      }

      if (newInputs.lifeEvents) {
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== newEventObj.id);
      } else {
        newInputs.lifeEvents = [];
      }
      newInputs.lifeEvents.push(newEventObj);
      savedEvent = newEventObj;
    }

    const result = createStandardResult(newInputs, savedEvent);
    return result;
  },

  delete(matchEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const deletedEvents = [matchEvent];

    const isFromSpendingPhases = newInputs.spendingPhases?.some(p => p.id === matchEvent.originalId || p.id === matchEvent.id);
    
    if (isFromSpendingPhases || matchEvent.type === 'move') {
      const phaseId = matchEvent.originalId || matchEvent.id;
      const matchSpend = newInputs.spendingPhases.find(p => p.id === phaseId || p.startAge === matchEvent.age);
      
      if (matchSpend && newInputs.spendingPhases.length > 1) {
        const remaining = newInputs.spendingPhases.filter(p => p.id !== matchSpend.id);
        const updated = remaining.map(p => {
          if (p.endAge === matchSpend.startAge) {
            return { ...p, endAge: matchSpend.endAge };
          }
          return p;
        });
        newInputs.spendingPhases = updated;
      }
    } else {
      if (newInputs.lifeEvents) {
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== matchEvent.id && e.id !== matchEvent.originalId);
      }
    }

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
