import { useState, useCallback } from 'react';
import { applyRecommendation } from './applyRecommendation.js';

/**
 * Controller hook for recommendations. Owns recommendation state and orchestrates updates.
 * 
 * @returns {Object} recommendation state properties and actions
 */
export function useRecommendationController({
  setScenarios,
  currentScenarioId,
  inputs,
  editingEvent,
  setEditingEvent,
  houseRebalanceSummary,
  setNotification,
  setIsBudgetModalOpen,
  setShowImprovementModal,
  setBudgetDiffs,
  setBudgetGrossIncome,
  setBudgetFilingStatus,
  setBudgetHsaCoverage,
  setBudgetSavings,
  setBudgetPartnerSavings,
  setBudgetExpenses,
  setEditedPhases,
  setActiveBudgetPhase,
  setBudgetMonthlyIncome,
  setBudgetMonthlySpending,
  setBudgetMonthlySavings,
  setSavingsAllocMode,
  setPendingImprovement
}) {
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  const applyRecommendationAction = useCallback((scenario) => {
    setSelectedRecommendation(scenario);

    const options = {
      houseRebalanceSummary
    };

    const result = applyRecommendation(inputs, scenario, editingEvent, options);

    // 1. Update scenarios state
    if (setScenarios) {
      setScenarios(prev => prev.map(s => {
        if (s.id !== currentScenarioId) return s;
        return { ...s, inputs: result.updatedInputs };
      }));
    }

    // 2. Update editingEvent if applicable
    if (result.updatedEditingEvent && setEditingEvent) {
      setEditingEvent(result.updatedEditingEvent);
    }

    // 3. Process side effects
    const sideEffects = result.sideEffects;

    if (sideEffects.notificationMsg && setNotification) {
      setNotification(sideEffects.notificationMsg);
      setTimeout(() => setNotification(null), 4000);
    }

    if (sideEffects.showBudgetModal && setIsBudgetModalOpen) {
      const targetIncome = result.updatedInputs.simpleIncome;
      const targetFilingStatus = result.updatedInputs.filingStatus || 'single';
      const targetHsaCoverage = result.updatedInputs.budgetDetails?.hsaCoverage || 'single';

      const currentPhase = result.updatedInputs.budgetDetails?.phases?.find(
        p => Number(result.updatedInputs.currentAge) >= p.startAge && Number(result.updatedInputs.currentAge) < p.endAge
      ) || result.updatedInputs.budgetDetails?.phases?.[0];

      if (currentPhase) {
        if (setBudgetDiffs) setBudgetDiffs({ savings: {}, expenses: {} });
        if (setBudgetGrossIncome) setBudgetGrossIncome(targetIncome);
        if (setBudgetFilingStatus) setBudgetFilingStatus(targetFilingStatus);
        if (setBudgetHsaCoverage) setBudgetHsaCoverage(targetHsaCoverage);
        if (setBudgetSavings) setBudgetSavings(currentPhase.savings || {});
        if (setBudgetPartnerSavings) setBudgetPartnerSavings(currentPhase.partnerSavings || {});
        if (setBudgetExpenses) setBudgetExpenses(currentPhase.expenses || {});

        const normPhases = result.updatedInputs.budgetDetails.phases;
        const initialEdited = {};
        normPhases.forEach(p => {
          initialEdited[p.id] = { ...p };
        });
        if (setEditedPhases) setEditedPhases(initialEdited);
        if (setActiveBudgetPhase) setActiveBudgetPhase(currentPhase.id);
        if (setBudgetMonthlyIncome) setBudgetMonthlyIncome(currentPhase.income);
        if (setBudgetMonthlySpending) setBudgetMonthlySpending(Object.values(currentPhase.expenses || {}).reduce((sum, v) => sum + v, 0));
        
        const totalSavings = currentPhase.savingsAllocMode === 'percentSurplus'
          ? Math.round(Math.max(0, currentPhase.income - Object.values(currentPhase.expenses || {}).reduce((sum, v) => sum + v, 0)) * (Object.values(currentPhase.savings || {}).reduce((sum, v) => sum + v, 0) / 100))
          : Object.values(currentPhase.savings || {}).reduce((sum, v) => sum + v, 0);
        if (setBudgetMonthlySavings) setBudgetMonthlySavings(totalSavings);
        if (setSavingsAllocMode) setSavingsAllocMode(currentPhase.savingsAllocMode);
      }

      if (setPendingImprovement) {
        setPendingImprovement({
          scenario,
          originalInputs: inputs
        });
      }

      setIsBudgetModalOpen(true);
    }

    if (setShowImprovementModal) {
      setShowImprovementModal(false);
    }

    if (sideEffects.pulsePhaseId) {
      window.pulsePhaseId = sideEffects.pulsePhaseId;
    }

    return result;
  }, [
    inputs,
    editingEvent,
    houseRebalanceSummary,
    currentScenarioId,
    setScenarios,
    setEditingEvent,
    setNotification,
    setIsBudgetModalOpen,
    setShowImprovementModal,
    setBudgetDiffs,
    setBudgetGrossIncome,
    setBudgetFilingStatus,
    setBudgetHsaCoverage,
    setBudgetSavings,
    setBudgetPartnerSavings,
    setBudgetExpenses,
    setEditedPhases,
    setActiveBudgetPhase,
    setBudgetMonthlyIncome,
    setBudgetMonthlySpending,
    setBudgetMonthlySavings,
    setSavingsAllocMode,
    setPendingImprovement
  ]);

  return {
    selectedRecommendation,
    setSelectedRecommendation,
    applyRecommendationAction
  };
}
