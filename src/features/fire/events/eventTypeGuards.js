import { getCanonicalEventType, getEventDefinition } from './eventRegistry';

/**
 * Checks if the event is a retirement event.
 * @param {object} event 
 * @returns {boolean}
 */
export function isRetirementEvent(event) {
  if (!event) return false;
  const canonical = getCanonicalEventType(event.type);
  return canonical === 'retire' || canonical === 'retirement';
}

/**
 * Checks if the event is a social security claiming event.
 * @param {object} event 
 * @returns {boolean}
 */
export function isSocialSecurityEvent(event) {
  if (!event) return false;
  return getCanonicalEventType(event.type) === 'socialSecurity';
}

/**
 * Checks if the event is a marriage event.
 * @param {object} event 
 * @returns {boolean}
 */
export function isMarriageEvent(event) {
  if (!event) return false;
  return getCanonicalEventType(event.type) === 'marriage';
}

/**
 * Checks if the event is a relationship start event.
 * @param {object} event 
 * @returns {boolean}
 */
export function isRelationshipStartEvent(event) {
  if (!event) return false;
  const canonical = getCanonicalEventType(event.type);
  return ['marriage', 'domesticPartnership', 'relationshipBegins'].includes(canonical);
}

/**
 * Checks if the event is a legal marriage event.
 * @param {object} event 
 * @returns {boolean}
 */
export function isLegalMarriageEvent(event) {
  if (!event) return false;
  return getCanonicalEventType(event.type) === 'marriage';
}

/**
 * Checks if the event is a divorce event.
 * @param {object} event 
 * @returns {boolean}
 */
export function isDivorceEvent(event) {
  if (!event) return false;
  return getCanonicalEventType(event.type) === 'divorce';
}

/**
 * Checks if the event is a child event.
 * @param {object} event 
 * @returns {boolean}
 */
export function isChildEvent(event) {
  if (!event) return false;
  return getCanonicalEventType(event.type) === 'haveChild';
}

/**
 * Checks if the event is a housing event (buy, sell, move, mortgage payoff).
 * @param {object} event 
 * @returns {boolean}
 */
export function isHousingEvent(event) {
  if (!event) return false;
  const canonical = getCanonicalEventType(event.type);
  if (canonical === 'buyHouse') return true;

  const def = getEventDefinition(canonical);
  return (
    def.category === 'housing' ||
    def.timelineCategory === 'housing' ||
    canonical === 'sellHouse' ||
    canonical === 'mortgageOff'
  );
}
