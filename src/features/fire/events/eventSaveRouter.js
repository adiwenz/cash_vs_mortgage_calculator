import { houseEventHandler } from './handlers/houseEventHandler.js';
import { childEventHandler } from './handlers/childEventHandler.js';
import { marriageEventHandler } from './handlers/marriageEventHandler.js';
import { debtEventHandler } from './handlers/debtEventHandler.js';
import { incomeEventHandler } from './handlers/incomeEventHandler.js';
import { retirementEventHandler } from './handlers/retirementEventHandler.js';
import { genericEventHandler } from './handlers/genericEventHandler.js';

import { findMatchingEvent, stripTransientRecommendationMetadata } from './handlers/eventHandlerUtils.js';

function getHandlerForType(type, inputs, eventId) {
  if (['buyHouse', 'sellHouse'].includes(type)) {
    return houseEventHandler;
  }
  if (type === 'haveChild') {
    return childEventHandler;
  }
  if (type === 'marriage') {
    return marriageEventHandler;
  }
  if (['borrowing', 'payoffPlan'].includes(type)) {
    return debtEventHandler;
  }
  
  const isFromIncomeList = inputs?.incomeList?.some(i => i.id === eventId);
  if (type === 'careerChange' || isFromIncomeList || ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type)) {
    return incomeEventHandler;
  }
  if (type === 'retire') {
    return retirementEventHandler;
  }
  
  const isFromSpendingPhases = inputs?.spendingPhases?.some(p => p.id === eventId);
  if (type === 'move' || isFromSpendingPhases || ['college', 'windfall', 'debtPayoff', 'custom'].includes(type)) {
    return genericEventHandler;
  }
  
  return genericEventHandler;
}

export const eventSaveRouter = {
  routeEdit(baseEvent, inputs) {
    if (!baseEvent) return null;
    const resolvedEvent = findMatchingEvent(inputs, baseEvent) || baseEvent;
    const handler = getHandlerForType(resolvedEvent.type, inputs, resolvedEvent.id);
    return handler.edit(resolvedEvent, inputs);
  },

  routeSave(editingEvent, inputs, scenarios, currentScenarioId, options) {
    if (!editingEvent) return null;
    const cleanEvent = stripTransientRecommendationMetadata(editingEvent);
    const handler = getHandlerForType(cleanEvent.type, inputs, cleanEvent.id);
    return handler.save(cleanEvent, inputs, scenarios, currentScenarioId, options);
  },

  routeDelete(matchEvent, inputs) {
    if (!matchEvent) return null;
    const resolvedEvent = findMatchingEvent(inputs, matchEvent) || matchEvent;
    const handler = getHandlerForType(resolvedEvent.type, inputs, resolvedEvent.id);
    return handler.delete(resolvedEvent, inputs);
  }
};
