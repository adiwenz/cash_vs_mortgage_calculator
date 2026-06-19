import { 
  cloneInputs, 
  createStandardResult, 
  normalizeEventAge, 
  normalizePercent 
} from './eventHandlerUtils.js';

export const retirementEventHandler = {
  edit(baseEvent, inputs) {
    if (!baseEvent) return null;
    if (baseEvent.type === 'retire') {
      return {
        id: 'retire',
        type: 'retire',
        age: normalizeEventAge(baseEvent.age, inputs.targetRetirementAge || 65),
        spendingPercent: baseEvent.spendingPercent !== undefined ? Number(baseEvent.spendingPercent) : 70
      };
    }
    return { ...baseEvent };
  },

  save(editingEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const result = createStandardResult(newInputs);

    const retireAge = normalizeEventAge(editingEvent.age, newInputs.targetRetirementAge || 65);
    const spendingPercent = normalizePercent(editingEvent.spendingPercent, 70);

    newInputs.targetRetirementAge = retireAge;
    
    if (!newInputs.lifeEvents) {
      newInputs.lifeEvents = [];
    }
    newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.type !== 'retire' && e.id !== editingEvent.id);

    const retireEvObj = {
      id: editingEvent.id && editingEvent.id !== 'retire' ? editingEvent.id : `retire-${Date.now()}`,
      type: 'retire',
      enabled: true,
      name: 'Retirement',
      age: retireAge,
      spendingPercent: spendingPercent
    };
    
    newInputs.lifeEvents.push(retireEvObj);

    result.updatedInputs = newInputs;
    result.savedEvent = retireEvObj;
    return result;
  },

  delete(matchEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const deletedEvents = [];

    newInputs.targetRetirementAge = newInputs.lifeExpectancy || 85;

    if (newInputs.lifeEvents) {
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => {
        if (e.type === 'retire' || e.id === matchEvent.id || e.id === matchEvent.originalId) {
          deletedEvents.push(e);
          return false;
        }
        return true;
      });
    }

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
