/**
 * Pure selectors for retrieving scenarios and scenario inputs.
 * These do not depend on React and can be tested in isolation.
 */

/**
 * Finds a scenario by its unique ID.
 * @param {Array} scenarios 
 * @param {string} scenarioId 
 * @returns {Object|undefined}
 */
export function getScenarioById(scenarios, scenarioId) {
  if (!Array.isArray(scenarios)) return undefined;
  return scenarios.find(s => s.id === scenarioId);
}

/**
 * Finds the baseline scenario (typically id === 'baseline').
 * Falls back to the first scenario if baseline is not found.
 * @param {Array} scenarios 
 * @returns {Object|undefined}
 */
export function getBaselineScenario(scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) return undefined;
  return scenarios.find(s => s.id === 'baseline') || scenarios[0];
}

/**
 * Retrieves the active scenario, falling back to the baseline or first scenario.
 * @param {Array} scenarios 
 * @param {string} currentScenarioId 
 * @returns {Object}
 */
export function getActiveScenario(scenarios, currentScenarioId) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return { id: 'fallback', name: 'Fallback', inputs: {} };
  }
  return getScenarioById(scenarios, currentScenarioId) || getBaselineScenario(scenarios);
}

/**
 * Retrieves the inputs block for the active scenario.
 * @param {Array} scenarios 
 * @param {string} currentScenarioId 
 * @returns {Object}
 */
export function getInputsForScenario(scenarios, currentScenarioId) {
  const active = getActiveScenario(scenarios, currentScenarioId);
  return active ? active.inputs : {};
}
