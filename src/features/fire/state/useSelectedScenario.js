import { useState, useMemo } from 'react';
import { getActiveScenario, getInputsForScenario } from './scenarioSelectors.js';

export function useSelectedScenario(scenarios) {
  const [currentScenarioId, setCurrentScenarioId] = useState('baseline');

  const activeScenario = useMemo(() => {
    return getActiveScenario(scenarios, currentScenarioId);
  }, [scenarios, currentScenarioId]);

  const inputs = useMemo(() => {
    return getInputsForScenario(scenarios, currentScenarioId);
  }, [scenarios, currentScenarioId]);

  return {
    currentScenarioId,
    setCurrentScenarioId,
    activeScenario,
    inputs
  };
}
