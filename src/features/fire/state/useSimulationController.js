import { useScenarioState } from './useScenarioState.js';
import { useSelectedScenario } from './useSelectedScenario.js';
import { useSimulationResults } from './useSimulationResults.js';

/**
 * Controller hook for fire simulation state and calculations.
 * Coordinates scenario CRUD, updates inputs, and retrieves simulation outputs.
 * 
 * @param {Object} [props] optional props
 * @param {Object} [props.editingEvent] the event currently being edited (for SS preview details)
 * @returns {Object} scenario/simulation state properties and action handlers
 */
export function useSimulationController({ editingEvent } = {}) {
  const scenarioState = useScenarioState();
  const selectedScenario = useSelectedScenario(scenarioState.scenarios);
  
  const simulationResults = useSimulationResults(
    selectedScenario.inputs, 
    scenarioState.scenarios,
    editingEvent
  );

  const handleDuplicateScenarioWrapper = () => {
    const newId = scenarioState.handleDuplicateScenario(selectedScenario.activeScenario);
    if (newId) {
      selectedScenario.setCurrentScenarioId(newId);
    }
  };

  const handleDeleteScenarioWrapper = (idToDelete) => {
    scenarioState.handleDeleteScenario(
      idToDelete,
      selectedScenario.currentScenarioId,
      selectedScenario.setCurrentScenarioId
    );
  };

  const updateInputWrapper = (key, value) => {
    scenarioState.updateInput(key, value, selectedScenario.currentScenarioId);
  };

  const updateAssetWrapper = (assetKey, value) => {
    scenarioState.updateAsset(assetKey, value, selectedScenario.currentScenarioId);
  };

  const commitEventAgeChangeWrapper = (evt, newAge) => {
    scenarioState.commitEventAgeChange(evt, newAge, selectedScenario.currentScenarioId);
  };

  return {
    scenarios: scenarioState.scenarios,
    setScenarios: scenarioState.setScenarios,
    currentScenarioId: selectedScenario.currentScenarioId,
    setCurrentScenarioId: selectedScenario.setCurrentScenarioId,
    activeScenario: selectedScenario.activeScenario,
    inputs: selectedScenario.inputs,
    updateInput: updateInputWrapper,
    updateAsset: updateAssetWrapper,
    displayMode: simulationResults.displayMode,
    setDisplayMode: simulationResults.setDisplayMode,
    selectedYear: simulationResults.selectedYear,
    setSelectedYear: simulationResults.setSelectedYear,
    baselineResults: simulationResults.baselineResults,
    activeResults: simulationResults.activeResults,
    displayedResults: simulationResults.displayedResults,
    displayedBaselineResults: simulationResults.displayedBaselineResults,
    chartData: simulationResults.chartData,
    baselineChartData: simulationResults.baselineChartData,
    validation: simulationResults.validation,
    tempSocialSecurityDetails: simulationResults.tempSocialSecurityDetails,
    handleDuplicateScenario: handleDuplicateScenarioWrapper,
    handleDeleteScenario: handleDeleteScenarioWrapper,
    commitEventAgeChange: commitEventAgeChangeWrapper
  };
}

export default useSimulationController;
