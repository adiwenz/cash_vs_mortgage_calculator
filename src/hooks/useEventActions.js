import { useEventController } from '../features/fire/events/useEventController.js';

export function useEventActions(
  scenarios,
  setScenarios,
  currentScenarioId,
  inputs,
  updateInput,
  handleSetBudgetClick,
  setIsBudgetOpenFromMarriageWizard,
  isMobile,
  setShowImprovementModal
) {
  return useEventController(
    scenarios,
    setScenarios,
    currentScenarioId,
    inputs,
    updateInput,
    handleSetBudgetClick,
    setIsBudgetOpenFromMarriageWizard,
    isMobile,
    setShowImprovementModal
  );
}

export default useEventActions;
