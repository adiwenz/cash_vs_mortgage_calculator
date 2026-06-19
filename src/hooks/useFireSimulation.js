import { useState, useEffect } from 'react';
import { useScenarioState } from '../features/fire/state/useScenarioState.js';
import { useSelectedScenario } from '../features/fire/state/useSelectedScenario.js';
import { useSimulationResults } from '../features/fire/state/useSimulationResults.js';

export function useFireSimulation() {
  const [editingEvent, setEditingEvent] = useState(null);
  const scenarioState = useScenarioState();
  
  const selectedScenario = useSelectedScenario(scenarioState.scenarios);
  
  const simulationResults = useSimulationResults(
    selectedScenario.inputs, 
    scenarioState.scenarios,
    editingEvent
  );

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    isMobile,
    baselineResults: simulationResults.baselineResults,
    activeResults: simulationResults.activeResults,
    displayedResults: simulationResults.displayedResults,
    displayedBaselineResults: simulationResults.displayedBaselineResults,
    chartData: simulationResults.chartData,
    baselineChartData: simulationResults.baselineChartData,
    validation: simulationResults.validation,
    tempSocialSecurityDetails: simulationResults.tempSocialSecurityDetails,
    editingEvent,
    setEditingEvent,
    handleDuplicateScenario: handleDuplicateScenarioWrapper,
    handleDeleteScenario: handleDeleteScenarioWrapper,
    commitEventAgeChange: commitEventAgeChangeWrapper
  };
}

export default useFireSimulation;
