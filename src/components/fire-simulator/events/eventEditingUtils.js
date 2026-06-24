/**
 * Pure utility functions for event editing and timeline dragging.
 * No React imports or side effects.
 */

/**
 * Clamps the drag age of an event based on its type and related events.
 * @param {number} newAge 
 * @param {string} type 
 * @param {string|number|null} houseId 
 * @param {object} options 
 * @returns {number}
 */
export function clampDragAge(newAge, type, houseId, { minAge, maxAge, childEndOffset, lifeEvents = [] }) {
  if (type === 'socialSecurity') {
    return Math.max(62, Math.min(70, newAge));
  }
  
  if (type === 'buyHouse' && houseId) {
    const sellEv = lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === houseId);
    const maxLimit = sellEv ? Number(sellEv.age) - 1 : maxAge;
    return Math.max(minAge, Math.min(maxLimit, newAge));
  }
  
  if (type === 'sellHouse' && houseId) {
    const buyEv = lifeEvents.find(e => e.type === 'buyHouse' && e.houseId === houseId);
    const minLimit = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : buyEv.age) + 1 : minAge;
    return Math.max(minLimit, Math.min(maxAge, newAge));
  }
  
  if (type === 'haveChild') {
    const offset = childEndOffset || 18;
    return Math.max(minAge, Math.min(maxAge - offset, newAge));
  }
  
  return Math.max(minAge, Math.min(maxAge, newAge));
}

/**
 * Resolves the target event to save or delete from arguments or active editing state.
 * Handles React synthetic event arguments safely.
 * @param {object} passedEvent 
 * @param {object} editingEvent 
 * @returns {object|null}
 */
export function resolveEditingEvent(passedEvent, editingEvent) {
  const isSyntheticEvent = passedEvent && (passedEvent.nativeEvent || passedEvent.preventDefault);
  return (passedEvent && !isSyntheticEvent) ? passedEvent : editingEvent;
}

/**
 * Extracts a numeric age from an event object using all known legacy and standard fields.
 * @param {object} event 
 * @returns {number|null}
 */
export function getEventAge(event) {
  if (!event) return null;
  const val = event.age !== undefined ? event.age :
              event.startAge !== undefined ? event.startAge :
              event.purchaseAge !== undefined ? event.purchaseAge :
              event.birthAge !== undefined ? event.birthAge :
              event.claimingAge !== undefined ? event.claimingAge :
              event.ageReceived !== undefined ? event.ageReceived :
              event.moveAge !== undefined ? event.moveAge :
              null;
  return val !== null ? Number(val) : null;
}

/**
 * Extracts the ID from an event object, checking both standard id and legacy originalId.
 * @param {object} event 
 * @returns {string|number|null}
 */
export function getEventId(event) {
  if (!event) return null;
  return event.id !== undefined ? event.id : (event.originalId !== undefined ? event.originalId : null);
}
