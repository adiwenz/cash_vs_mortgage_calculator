import { getNormalizedPhases } from '../../../../fireCalculations.js';

/**
 * Pure handler for budget-related recommendations.
 * 
 * @param {Object} inputs Original inputs
 * @param {Object} scenario Selected recommendation scenario
 * @param {Object} editingEvent Current editingEvent
 * @returns {Object} Standardized recommendation output
 */
export function handleBudgetRecommendation(inputs, scenario, editingEvent) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  const currentAgeVal = Number(newInputs.currentAge) || 30;
  const targetRetAgeVal = Number(newInputs.targetRetirementAge) || 65;

  let normPhases = getNormalizedPhases(newInputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

  if (currentPhase) {
    let targetSavingsMap = currentPhase.savings ? { ...currentPhase.savings } : { brokerage: 0 };
    let targetExpensesMap = currentPhase.expenses ? { ...currentPhase.expenses } : {};
    let targetIncome = currentPhase.income * 12;

    if (scenario.type === 'savings' || scenario.type === 'retireRequestedDate' || (scenario.type === 'retire65' && scenario.value > 0)) {
      const additionalSavingsAnnual = scenario.value;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      
      let remainingReduction = additionalSavingsMonthly;
      const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
      for (const key of keysToReduce) {
        if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
          const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
          targetExpensesMap[key] -= reduceAmt;
          remainingReduction -= reduceAmt;
          if (remainingReduction <= 0) break;
        }
      }
    } else if (scenario.type === 'income') {
      const grossIncreaseAnnual = scenario.value;
      const netSavingsAnnual = scenario.netSavingsValue || 0;
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    } else if (scenario.type === 'combined') {
      const additionalSavingsAnnual = scenario.value.savings || 0;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      
      let remainingReduction = additionalSavingsMonthly;
      const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
      for (const key of keysToReduce) {
        if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
          const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
          targetExpensesMap[key] -= reduceAmt;
          remainingReduction -= reduceAmt;
          if (remainingReduction <= 0) break;
        }
      }

      const grossIncreaseAnnual = scenario.value.income || 0;
      const netSavingsAnnual = scenario.value.netSavings || 0;
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    } else if (scenario.type === 'reduceDiscretionary') {
      let remainingReduction = scenario.value;
      const keysToReduce = ['leisure', 'diningOut', 'misc'];
      for (const key of keysToReduce) {
        if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
          const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
          targetExpensesMap[key] -= reduceAmt;
          remainingReduction -= reduceAmt;
          if (remainingReduction <= 0) break;
        }
      }
    } else if (scenario.type === 'increaseDebtIncome') {
      const extraIncomeItem = {
        id: `debt-income-boost-${Date.now()}`,
        name: `Extra Income (to cover debt)`,
        amount: scenario.value * 12,
        frequency: 'yearly',
        startAge: currentAgeVal,
        endAge: targetRetAgeVal,
        growthRate: 0.03,
        isTaxable: true
      };
      newInputs.incomeList = [...(newInputs.incomeList || []), extraIncomeItem];
    }

    currentPhase.income = Math.round(targetIncome / 12);
    currentPhase.savings = targetSavingsMap;
    currentPhase.expenses = targetExpensesMap;
  }

  if (!newInputs.budgetDetails) newInputs.budgetDetails = {};
  newInputs.budgetDetails.phases = normPhases.map(p => ({
    id: p.id,
    type: p.type,
    name: p.name,
    startAge: p.startAge,
    endAge: p.endAge,
    income: p.income,
    savingsAllocMode: p.savingsAllocMode || 'fixed',
    savings: p.savings,
    partnerSavings: p.partnerSavings || {},
    expenses: p.expenses
  }));

  if (currentPhase) {
    const wsPhase = normPhases.find(p => p.type === 'workSave');
    const standardIncomeMonthly = wsPhase ? wsPhase.income : currentPhase.income;
    const childBoost = Math.max(0, currentPhase.income - standardIncomeMonthly);
    newInputs.simpleIncome = (currentPhase.income - childBoost) * 12;
    newInputs.simpleExpenses = Object.keys(currentPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (currentPhase.expenses[v] || 0), 0) * 12;
  }

  newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
    if (inc.incomeChangeType === 'increaseByAmount') {
      return inc;
    }
    const matchingPhase = normPhases.find(p => p.startAge === inc.startAge && (p.type === 'careerChange' || p.type === 'current'));
    if (matchingPhase) {
      inc.amount = inc.frequency === 'monthly' ? matchingPhase.income : matchingPhase.income * 12;
    }
    return inc;
  });

  newInputs.spendingPhases = (newInputs.spendingPhases || []).map(sp => {
    const matchingPhase = normPhases.find(p => p.startAge === sp.startAge && p.type === 'move');
    if (matchingPhase) {
      const totalMonthlyExpenses = Object.keys(matchingPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (matchingPhase.expenses[v] || 0), 0);
      sp.amount = sp.frequency === 'monthly' ? totalMonthlyExpenses : totalMonthlyExpenses * 12;
      sp.annualSpending = totalMonthlyExpenses * 12;
    }
    return sp;
  });

  let updatedEditingEvent = editingEvent ? { ...editingEvent } : null;

  return {
    updatedInputs: newInputs,
    updatedEditingEvent,
    linkedEventsCreated: [],
    linkedEventsUpdated: [],
    linkedEventsDeleted: [],
    sideEffects: {
      notificationMsg: null,
      showBudgetModal: true, // budget adjustments trigger the budget phase editor
      pulsePhaseId: null,
      impactSummary: null,
      rebalanceStrategies: [],
      retirementTimingChanged: false
    },
    warnings: []
  };
}
