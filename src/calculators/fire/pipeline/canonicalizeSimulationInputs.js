export function isGeneratedMainIncome(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('child-income-boost') ||
         id.startsWith('simple-inc-prechild') ||
         id.startsWith('simple-inc-worksave') ||
         id.startsWith('simple-inc-childcare') ||
         id.startsWith('simple-inc') ||
         id.startsWith('inc-1') ||
         id.startsWith('job-1');
}

export function isMainIncome(inc) {
  const name = inc.name || '';
  const id = inc.id || '';
  return isGeneratedMainIncome(id) ||
         id.startsWith('job-1') ||
         name === 'Salary / Main Income' ||
         name === 'Main Salary' ||
         name.startsWith('Salary / Main Income (');
}

export function isMainSpending(p) {
  const name = p.name || '';
  const id = p.id || '';
  return id === 'spend-1' ||
         id === 'simple-spend' ||
         id.startsWith('simple-spend-prechild') ||
         id.startsWith('simple-spend-worksave') ||
         id.startsWith('simple-spend-childcare') ||
         name === 'Base Lifestyle Spending' ||
         name.startsWith('Lifestyle Spending (');
}

function getSimulationKey(inc) {
  if (isMainIncome(inc)) {
    return 'inc-1';
  }
  const id = inc.id || '';
  const name = inc.name || '';
  
  let baseId = id;
  if (id.includes('-segment-')) {
    baseId = id.split('-segment-')[0];
  }
  
  return inc.sourceObjectId || inc.originalId || baseId || name;
}

function reconcileExpensesMap(expenses, targetAnnual) {
  if (!expenses) return expenses;
  const targetMonthly = Number(targetAnnual) / 12;
  const keys = Object.keys(expenses).filter(k => !k.startsWith('debt_') && k !== '🏠 Mortgage' && k !== 'mortgage');
  const sumOther = keys.filter(k => k !== 'misc').reduce((sum, k) => sum + (Number(expenses[k]) || 0), 0);
  const adjustedMisc = targetMonthly - sumOther;
  return {
    ...expenses,
    misc: adjustedMisc
  };
}

function reconcileSavingsMap(savings, targetAnnual) {
  if (!savings) return savings;
  const targetMonthly = Number(targetAnnual) / 12;
  const keys = Object.keys(savings);
  const sumOther = keys.filter(k => k !== 'brokerage').reduce((sum, k) => sum + (Number(savings[k]) || 0), 0);
  const adjustedBrokerage = targetMonthly - sumOther;
  return {
    ...savings,
    brokerage: adjustedBrokerage
  };
}
function reconcileBudgetDetails(inputs) {
  let hasAnyPhaseSavings = false;
  if (Array.isArray(inputs.budgetDetails?.phases)) {
    hasAnyPhaseSavings = inputs.budgetDetails.phases.some(phase => 
      phase.savings && Object.values(phase.savings).some(v => Number(v) > 0)
    );
  }
  if (hasAnyPhaseSavings) {
    inputs.hasCustomizedSavingsAllocation = true;
  }

  const hasCustomSavings = !!inputs.hasCustomizedSavingsAllocation || !!inputs.useLifeProfile;
  const hasCustomBudget = !!inputs.hasCustomizedBudget || !!inputs.hasCustomizedExpenses || !!inputs.hasCustomizedSavingsAllocation || !!inputs.useLifeProfile;

  let annualIncome = Number(inputs.simpleIncome || (inputs.budgetDetails?.income ? inputs.budgetDetails.income * 12 : 0)) || 0;
  if (annualIncome === 0 && Array.isArray(inputs.incomeList)) {
    const mainInc = inputs.incomeList.find(isMainIncome);
    if (mainInc) {
      annualIncome = Number(mainInc.amount) || 0;
    }
  }
  
  let annualSpending = Number(inputs.spendingPhases?.[0]?.annualSpending ?? inputs.simpleExpenses) || 0;
  if (annualSpending === 0 && Array.isArray(inputs.spendingPhases)) {
    const mainSpend = inputs.spendingPhases.find(isMainSpending);
    if (mainSpend) {
      annualSpending = Number(mainSpend.annualSpending ?? mainSpend.amount) || 0;
    }
  }
  if (hasCustomBudget && inputs.budgetDetails?.expenses) {
    const totalExpenses = Object.values(inputs.budgetDetails.expenses).reduce((sum, v) => sum + (Number(v) || 0), 0) * 12;
    if (totalExpenses > 0) {
      annualSpending = totalExpenses;
    }
  }

  inputs.simpleIncome = annualIncome;
  inputs.simpleExpenses = annualSpending;

  let annualSavings = 0;
  if (hasCustomSavings) {
    if (inputs.budgetDetails?.savings) {
      annualSavings = Object.values(inputs.budgetDetails.savings).reduce((sum, v) => sum + (Number(v) || 0), 0) * 12;
    }
  } else {
    annualSavings = Math.max(0, annualIncome - annualSpending);
  }
  
  if (inputs.budgetDetails) {
    if (inputs.budgetDetails.expenses) {
      inputs.budgetDetails.expenses = reconcileExpensesMap(inputs.budgetDetails.expenses, annualSpending);
    }
    if (inputs.budgetDetails.savings) {
      inputs.budgetDetails.savings = reconcileSavingsMap(inputs.budgetDetails.savings, annualSavings);
    }
    
    if (Array.isArray(inputs.budgetDetails.phases)) {
      const targetRet = Number(inputs.targetRetirementAge) || 65;
      inputs.budgetDetails.phases = inputs.budgetDetails.phases.filter(phase => {
        const startAge = Number(phase.startAge);
        if (startAge >= targetRet) {
          const phaseExpensesSum = Object.values(phase.expenses || {}).reduce((s, v) => s + (Number(v) || 0), 0) * 12;
          const defaultExpenses = Number(inputs.simpleExpenses) || 0;
          if (Math.abs(phaseExpensesSum - defaultExpenses) < 1.0) {
            return false;
          }
        }
        return true;
      });

      inputs.budgetDetails.phases = inputs.budgetDetails.phases.map(phase => {
        let resolvedPhase = { ...phase };
        const phaseHasCustomBudget = !!resolvedPhase.hasCustomizedBudget || !!resolvedPhase.hasCustomizedExpenses || !!inputs.hasCustomizedBudget || !!inputs.hasCustomizedExpenses || !!inputs.useLifeProfile;
        const phaseHasCustomSavings = !!resolvedPhase.hasCustomizedSavingsAllocation || !!inputs.hasCustomizedSavingsAllocation || !!inputs.useLifeProfile;
        
        let monthlyIncome = Number(resolvedPhase.income || (resolvedPhase.incomeAtCreation ? resolvedPhase.incomeAtCreation / 12 : 0)) || 0;
        if (monthlyIncome === 0) {
          monthlyIncome = Number(inputs.simpleIncome) / 12 || 0;
        }

        let monthlyExpenses = Number(resolvedPhase.expensesAnnual ?? resolvedPhase.annualSpending ?? resolvedPhase.amount ?? 0) / 12;
        if (resolvedPhase.expenses) {
          const sumExpenses = Object.values(resolvedPhase.expenses).reduce((sum, v) => sum + (Number(v) || 0), 0);
          if (sumExpenses > 0) {
            monthlyExpenses = sumExpenses;
          }
        }
        if (monthlyExpenses === 0) {
          monthlyExpenses = Number(inputs.simpleExpenses) / 12 || 0;
        }

        let monthlySavings = 0;
        if (phaseHasCustomSavings && resolvedPhase.savings) {
          const sumSavings = Object.values(resolvedPhase.savings).reduce((sum, v) => sum + (Number(v) || 0), 0);
          if (sumSavings > 0) {
            monthlySavings = sumSavings;
          }
        } else {
          monthlySavings = Math.max(0, monthlyIncome - monthlyExpenses);
        }

        if (resolvedPhase.expenses) {
          resolvedPhase.expenses = reconcileExpensesMap(resolvedPhase.expenses, monthlyExpenses * 12);
        }
        if (resolvedPhase.savings) {
          resolvedPhase.savings = reconcileSavingsMap(resolvedPhase.savings, monthlySavings * 12);
        }

        const startAge = Number(resolvedPhase.startAge);
        const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
        if (startAge >= targetRetirementAge) {
          if (resolvedPhase.savings) {
            Object.keys(resolvedPhase.savings).forEach(k => {
              resolvedPhase.savings[k] = 0;
            });
          }
          if (resolvedPhase.partnerSavings) {
            Object.keys(resolvedPhase.partnerSavings).forEach(k => {
              resolvedPhase.partnerSavings[k] = 0;
            });
          }
        }
        return resolvedPhase;
      });
    }
  }

  inputs.hasCustomizedBudget = true;
}

function mergeContiguousIncomeList(incomeList, inputs) {
  if (!incomeList) return [];
  
  const itemsWithKey = incomeList.map(inc => ({
    ...inc,
    simulationKey: getSimulationKey(inc)
  }));

  const groups = {};
  itemsWithKey.forEach(item => {
    const key = item.simulationKey;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const mergedList = [];

  Object.keys(groups).forEach(key => {
    const groupItems = groups[key];
    const sorted = [...groupItems].sort((a, b) => (Number(a.startAge) || 0) - (Number(b.startAge) || 0));
    const mergedGroup = [];
    
    for (const item of sorted) {
      const start = Number(item.startAge) || 0;
      const end = Number(item.endAge) || 0;
      const amt = Number(item.amount) || 0;
      const growth = Number(item.growthRate) || 0;
      const taxable = item.isTaxable !== false;
      
      const matchIndex = mergedGroup.findIndex(existing => 
        Math.abs(Number(existing.amount) - amt) < 0.01 &&
        Math.abs(Number(existing.growthRate) - growth) < 0.00001 &&
        existing.isTaxable === taxable &&
        (Number(existing.endAge) === start || Number(existing.startAge) === end)
      );
      
      if (matchIndex !== -1) {
        const match = mergedGroup[matchIndex];
        match.startAge = Math.min(Number(match.startAge), start);
        match.endAge = Math.max(Number(match.endAge), end);
      } else {
        mergedGroup.push({
          ...item,
          startAge: start,
          endAge: end,
          amount: amt,
          growthRate: growth,
          isTaxable: taxable
        });
      }
    }
    
    mergedGroup.forEach(item => {
      if (item.id && item.id.includes('-segment-')) {
        item.id = item.id.split('-segment-')[0];
      }
      mergedList.push(item);
    });
  });

  return mergedList;
}

function mergeContiguousSpendingPhases(spendingPhases, inputs) {
  if (!spendingPhases) return [];

  const itemsWithKey = spendingPhases.map(p => {
    let key = p.id || '';
    if (isMainSpending(p)) {
      key = 'spend-1';
    } else if (key.includes('-segment-')) {
      key = key.split('-segment-')[0];
    }
    return { ...p, simulationKey: key };
  });

  const groups = {};
  itemsWithKey.forEach(item => {
    const key = item.simulationKey;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const mergedList = [];
  Object.keys(groups).forEach(key => {
    const sorted = [...groups[key]].sort((a, b) => (Number(a.startAge) || 0) - (Number(b.startAge) || 0));
    const mergedGroup = [];

    for (const item of sorted) {
      const start = Number(item.startAge) || 0;
      const end = Number(item.endAge) || 0;
      const amt = Number(item.annualSpending ?? item.amount ?? 0);

      const matchIndex = mergedGroup.findIndex(existing => 
        Math.abs(Number(existing.annualSpending ?? existing.amount ?? 0) - amt) < 0.01 &&
        (Number(existing.endAge) === start || Number(existing.startAge) === end)
      );

      if (matchIndex !== -1) {
        const match = mergedGroup[matchIndex];
        match.startAge = Math.min(Number(match.startAge), start);
        match.endAge = Math.max(Number(match.endAge), end);
      } else {
        mergedGroup.push({
          ...item,
          startAge: start,
          endAge: end,
          annualSpending: amt,
          amount: amt
        });
      }
    }

    mergedGroup.forEach(item => {
      if (item.id && item.id.includes('-segment-')) {
        item.id = item.id.split('-segment-')[0];
      }
      mergedList.push(item);
    });
  });

  return mergedList;
}

function buildCanonicalIncomeList(inputs) {
  const currentAge = Number(inputs.currentAge) || 35;
  const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;

  const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled !== false);
  const careerChanges = enabledEvents.filter(e => e.type === 'incomeItem' && !isGeneratedMainIncome(e.id));

  if (careerChanges.length === 0) {
    return;
  }

  const boundaries = new Set();
  boundaries.add(currentAge);
  boundaries.add(targetRetirementAge);
  careerChanges.forEach(cc => {
    const start = Number(cc.startAge);
    const end = Number(cc.endAge);
    if (start >= currentAge && start < targetRetirementAge) boundaries.add(start);
    if (end >= currentAge && end < targetRetirementAge) boundaries.add(end);
  });

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];

    const activeCCs = careerChanges.filter(cc => start >= Number(cc.startAge) && start < Number(cc.endAge));
    const latestReset = [...activeCCs].reverse().find(cc => cc.incomeChangeType !== 'increaseByAmount');

    const mainInc = inputs.incomeList?.find(isMainIncome);
    const defaultGrowthRate = mainInc && mainInc.growthRate !== undefined
      ? Number(mainInc.growthRate)
      : (inputs.salaryGrowthRate !== undefined ? Number(inputs.salaryGrowthRate) / 100 : 0.03);

    let amount = 0;
    let growthRate = defaultGrowthRate;
    let isTaxable = true;

    if (latestReset) {
      amount = Number(latestReset.amount) || 0;
      growthRate = latestReset.growthRate !== undefined ? Number(latestReset.growthRate) : defaultGrowthRate;
      isTaxable = latestReset.isTaxable !== false;

      activeCCs.forEach(cc => {
        if (cc.incomeChangeType === 'increaseByAmount' && Number(cc.startAge) > Number(latestReset.startAge)) {
          amount += Number(cc.salaryIncrease !== undefined ? cc.salaryIncrease : cc.amount) || 0;
        }
      });
    } else {
      amount = Number(inputs.simpleIncome) || 0;
      activeCCs.forEach(cc => {
        if (cc.incomeChangeType === 'increaseByAmount') {
          amount += Number(cc.salaryIncrease !== undefined ? cc.salaryIncrease : cc.amount) || 0;
        }
        growthRate = cc.growthRate !== undefined ? Number(cc.growthRate) : defaultGrowthRate;
        isTaxable = cc.isTaxable !== false;
      });
    }

    segments.push({
      id: `inc-segment-${start}-${end}`,
      name: 'Salary / Main Income',
      amount,
      frequency: 'yearly',
      startAge: start,
      endAge: end,
      growthRate,
      isTaxable
    });
  }

  inputs.incomeList = segments;
  inputs.lifeEvents = inputs.lifeEvents.filter(e => !(e.type === 'incomeItem' && !isGeneratedMainIncome(e.id)));
}

export function canonicalizeSimulationInputs(inputs) {
  if (!inputs) return inputs;
  const canonical = JSON.parse(JSON.stringify(inputs));
  
  if (!canonical.useLifeProfile) {
    buildCanonicalIncomeList(canonical);
  }

  // Reconcile budget details first to establish canonical simpleIncome/simpleExpenses
  reconcileBudgetDetails(canonical);

  if (!canonical.useLifeProfile) {
    // Update main incomes in place
    let hasMainInc = false;
    if (canonical.incomeList) {
      canonical.incomeList.forEach(inc => {
        if (isMainIncome(inc) || (inc.id && inc.id.startsWith('inc-segment-'))) {
          hasMainInc = true;
        }
        if (isMainIncome(inc) && !inc.id.startsWith('simple-inc-prechild') && !inc.id.startsWith('simple-inc-childcare') && !inc.id.startsWith('simple-inc-worksave') && !inc.id.startsWith('inc-segment-')) {
          inc.amount = Number(canonical.simpleIncome);
        }
      });
    }
    if (!hasMainInc) {
      canonical.incomeList = canonical.incomeList || [];
      canonical.incomeList.push({
        id: 'inc-1',
        name: 'Salary / Main Income',
        amount: Number(canonical.simpleIncome),
        frequency: 'yearly',
        startAge: Number(canonical.currentAge) || 35,
        endAge: Number(canonical.targetRetirementAge) || 65,
        growthRate: 0.03,
        isTaxable: true
      });
    }
  } else {
    // Seed incomeList if empty
    let list = canonical.incomeList || [];
    if (list.length === 0 && Number(canonical.simpleIncome) > 0) {
      list.push({
        id: 'inc-1',
        name: 'Salary / Main Income',
        amount: Number(canonical.simpleIncome),
        frequency: 'yearly',
        startAge: Number(canonical.currentAge) || 35,
        endAge: Number(canonical.targetRetirementAge) || 65,
        growthRate: 0.03,
        isTaxable: true
      });
      canonical.incomeList = list;
    }
  }

  // Unconditionally update main spending in place to keep it in sync with reconciled simpleExpenses
  let hasMainSpend = false;
  if (canonical.spendingPhases) {
    canonical.spendingPhases.forEach(p => {
      if (isMainSpending(p)) {
        hasMainSpend = true;
      }
      if (isMainSpending(p) && !p.id.startsWith('simple-spend-prechild') && !p.id.startsWith('simple-spend-childcare') && !p.id.startsWith('simple-spend-worksave')) {
        p.amount = Number(canonical.simpleExpenses);
        p.annualSpending = Number(canonical.simpleExpenses);
      }
    });
  }
  if (!hasMainSpend) {
    canonical.spendingPhases = canonical.spendingPhases || [];
    canonical.spendingPhases.push({
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: Number(canonical.currentAge) || 35,
      endAge: Number(canonical.lifeExpectancy) || 85,
      amount: Number(canonical.simpleExpenses),
      frequency: 'yearly',
      annualSpending: Number(canonical.simpleExpenses)
    });
  }
  
  canonical.incomeList = mergeContiguousIncomeList(canonical.incomeList, canonical);
  canonical.spendingPhases = mergeContiguousSpendingPhases(canonical.spendingPhases, canonical);
  
  return canonical;
}
