export function formatSimulationResultStage(result, profile, phases, plannedProjection, inputs) {
  const currentAgeVal = Math.max(0, Number(inputs.currentAge) || 30);
  const activePhase = phases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge);
  
  if (activePhase && activePhase.savings) {
    const firstYearLog = plannedProjection.logs[0] || {};
    const actualContribs = firstYearLog.actualContributions || {};
    const budgetAllocKeys = ['trad401k', 'tradIra', 'rothIra', 'hsa', 'brokerage', 'checking', 'hysa', 'emergency', 'other', 'debt'];
    
    const budgetMap = {};
    const simMap = {};
    
    budgetAllocKeys.forEach(k => {
      const bVal = ((Number(activePhase.savings[k]) || 0) + (Number(activePhase.partnerSavings?.[k]) || 0)) * 12;
      const sVal = Number(actualContribs[k]) || 0;
      budgetMap[k] = bVal;
      simMap[k] = sVal;
    });

    if (inputs.debugSimulation === true) {
      console.table({
        budget: budgetMap,
        simulation: simMap
      });
    }

    // Check for mismatch (allowing leftover surplus in brokerage and debt paydown caps)
    let mismatch = false;
    const activeDebtBalanceEnd = firstYearLog.debtBalance ?? 0;
    budgetAllocKeys.forEach(k => {
      const bVal = budgetMap[k];
      const sVal = simMap[k];
      if (k === 'brokerage') {
        if (sVal < bVal - 0.01) {
          mismatch = true;
        }
      } else if (k === 'debt') {
        if (Math.abs(bVal - sVal) > 0.01) {
          if (sVal > bVal + 0.01 || activeDebtBalanceEnd > 0) {
            mismatch = true;
          }
        }
      } else {
        if (Math.abs(bVal - sVal) > 0.01) {
          mismatch = true;
        }
      }
    });

    // Only warn if there was enough surplus (no constraints forced actual to be lower)
    const annualIncomeVal = firstYearLog.income || 0;
    const taxesVal = firstYearLog.taxes || 0;
    const expensesVal = firstYearLog.expenses || 0;
    const budgetTotalPreTax = ['trad401k', 'tradIra', 'hsa'].reduce((sum, k) => sum + ((Number(activePhase.savings[k]) || 0) + (Number(activePhase.partnerSavings?.[k]) || 0)) * 12, 0);
    const budgetTotalPostTax = ['rothIra', 'brokerage', 'checking', 'hysa', 'emergency', 'other', 'debt'].reduce((sum, k) => sum + ((Number(activePhase.savings[k]) || 0) + (Number(activePhase.partnerSavings?.[k]) || 0)) * 12, 0);
    const grossSurplusVal = annualIncomeVal - expensesVal;
    const netSurplusVal = grossSurplusVal - taxesVal - budgetTotalPreTax;

    if (mismatch && grossSurplusVal >= budgetTotalPreTax && netSurplusVal >= budgetTotalPostTax) {
      if (inputs.debugSimulation === true) {
        console.warn("Budget allocations do not match simulation allocations!");
      }
    }
  }

  return {
    ...result,
    incomeList: inputs.incomeList,
    spendingPhases: inputs.spendingPhases,
    yearsWithLimitsReached: plannedProjection.yearsWithLimitsReached,
    totalRedirectedSavings: plannedProjection.totalRedirectedSavings,
    contributionLimitLogs: plannedProjection.contributionLimitLogs,
    redirectedToCash: plannedProjection.redirectedToCash
  };
}
