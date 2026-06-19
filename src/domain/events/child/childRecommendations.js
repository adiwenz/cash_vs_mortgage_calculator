import { runFireSimulation } from '../../../fireCalculations.js';
import { splitPhasesAtAge } from '../../housing/houseRecommendationSolver.js';
import { calculateChildcareCostPhaseImpact } from './childEventImpact.js';

const formatCurrency = (val) => {
  if (val === null || val === undefined) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export function createIncomeIncreaseRecommendation(rec, currentAge, targetRetirementAge, currentReadyAge, inputs) {
  const promoEvent = {
    id: `promo-${rec.childEventId}`,
    type: 'careerChange',
    name: rec.childName ? `Promotion (${rec.childName})` : 'Get a Promotion',
    startAge: rec.parentStartAge,
    endAge: targetRetirementAge,
    growthRate: 0.03, // Saved as decimal for simulation (displayed as 3.0% in edit form)
    isTaxable: true,
    amount: rec.peakCost,
    salaryIncrease: rec.peakCost,
    incomeChangeType: 'increaseByAmount',
    permanent: true,
    parentEventId: rec.childEventId
  };

  const clonedInputs = JSON.parse(JSON.stringify(inputs));
  clonedInputs.incomeList = [...(clonedInputs.incomeList || []), promoEvent];
  const boostResults = runFireSimulation(clonedInputs);
  const readyAge = boostResults.retirementReadyAge;
  const yearsImprovement = currentReadyAge ? Math.max(0, currentReadyAge - (readyAge || currentReadyAge)) : null;

  return {
    type: `childPromotion-${rec.childEventId}`,
    icon: '🟦',
    title: 'Get a Promotion',
    details: `Increase your income by ${formatCurrency(rec.peakCost)}/year permanently.`,
    bulletPoints: [
      `This offsets childcare costs today and helps you build additional savings after childcare expenses end.`,
      `A promotion or career advancement that offsets childcare costs and keeps your retirement plan on track. After childcare ends, the additional income becomes available for savings.`
    ],
    readyAge: readyAge || targetRetirementAge,
    yearsImprovement: yearsImprovement,
    value: rec.peakCost,
    promoEvent: promoEvent,
    savingsFocus: 'Earn More',
    savingsEffortScore: 2
  };
}

export function createBudgetRebalanceRecommendation(rec, currentAge, targetRetirementAge, currentReadyAge, inputs) {
  const clonedInputs = JSON.parse(JSON.stringify(inputs));
  const amountToReduceMonthly = Math.round(rec.peakCost / 12);
  const parentStartAge = rec.parentStartAge;
  const parentEndAge = rec.parentEndAge;

  if (clonedInputs.budgetDetails && clonedInputs.budgetDetails.phases) {
    clonedInputs.budgetDetails.phases = splitPhasesAtAge(clonedInputs.budgetDetails.phases, parentStartAge);
    clonedInputs.budgetDetails.phases = splitPhasesAtAge(clonedInputs.budgetDetails.phases, parentEndAge);
    
    for (const phase of clonedInputs.budgetDetails.phases) {
      if (phase.startAge >= parentStartAge && phase.startAge < parentEndAge) {
        let remaining = amountToReduceMonthly;
        const keysToReduce = ['leisure', 'diningOut', 'misc'];
        for (const key of keysToReduce) {
          if (phase.expenses && phase.expenses[key] !== undefined && phase.expenses[key] > 0) {
            const reduceAmt = Math.min(phase.expenses[key], remaining);
            phase.expenses[key] -= reduceAmt;
            remaining -= reduceAmt;
            if (remaining <= 0) break;
          }
        }
      }
    }
  }

  const boostResults = runFireSimulation(clonedInputs);
  const readyAge = boostResults.retirementReadyAge;
  const yearsImprovement = currentReadyAge ? Math.max(0, currentReadyAge - (readyAge || currentReadyAge)) : null;

  return {
    type: `childBudgetRebalance-${rec.childEventId}`,
    icon: '⚖️',
    title: 'Reallocate Budget',
    details: `Reduce discretionary expenses by ${formatCurrency(rec.peakCost)}/year during childcare years.`,
    bulletPoints: [
      `Offsets childcare costs by cutting back on leisure, dining out, and miscellaneous expenses.`,
      `Helps keep your plan on track without requiring career changes or working longer.`
    ],
    readyAge: readyAge || targetRetirementAge,
    yearsImprovement: yearsImprovement,
    value: rec.peakCost,
    savingsFocus: 'Save More',
    savingsEffortScore: 1
  };
}

export function createSaveMoreSpendLessRecommendation(rec, currentAge, targetRetirementAge, currentReadyAge, inputs) {
  const clonedInputs = JSON.parse(JSON.stringify(inputs));
  const additionalSavingsMonthly = Math.round(rec.peakCost / 12);

  if (clonedInputs.budgetDetails && clonedInputs.budgetDetails.phases) {
    for (const phase of clonedInputs.budgetDetails.phases) {
      if (phase.startAge >= currentAge && phase.startAge < targetRetirementAge) {
        if (!phase.savings) phase.savings = { brokerage: 0 };
        phase.savings.brokerage = (phase.savings.brokerage || 0) + additionalSavingsMonthly;
        
        let remaining = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (phase.expenses && phase.expenses[key] !== undefined && phase.expenses[key] > 0) {
            const reduceAmt = Math.min(phase.expenses[key], remaining);
            phase.expenses[key] -= reduceAmt;
            remaining -= reduceAmt;
            if (remaining <= 0) break;
          }
        }
      }
    }
  }

  const boostResults = runFireSimulation(clonedInputs);
  const readyAge = boostResults.retirementReadyAge;
  const yearsImprovement = currentReadyAge ? Math.max(0, currentReadyAge - (readyAge || currentReadyAge)) : null;

  return {
    type: `childSaveMore-${rec.childEventId}`,
    icon: '🐷',
    title: 'Save More / Spend Less',
    details: `Save and invest an additional ${formatCurrency(rec.peakCost)}/year starting now.`,
    bulletPoints: [
      `Increases savings target to build a larger buffer prior to and during childcare.`,
      `Keeps your stop working age goals aligned with the original target.`
    ],
    readyAge: readyAge || targetRetirementAge,
    yearsImprovement: yearsImprovement,
    value: rec.peakCost,
    savingsFocus: 'Save More',
    savingsEffortScore: 2
  };
}

export function generateChildRecommendations(inputs, currentReadyAge) {
  const childEvents = (inputs.lifeEvents || []).filter(
    e => e.type === 'haveChild' && e.enabled
  );
  if (childEvents.length === 0) {
    return [];
  }

  const list = [];
  childEvents.forEach(ev => {
    // Avoid duplicate promotion creation
    const hasPromo = (inputs.incomeList || []).some(
      inc => inc.id === ev.linkedEventId || inc.parentEventId === ev.id
    );
    if (hasPromo) {
      return;
    }

    const rec = calculateChildcareCostPhaseImpact(ev, inputs);
    const detailRec = {
      childEventId: ev.id,
      childName: ev.childName || '',
      ...rec
    };

    const currentAge = Number(inputs.currentAge) || 30;
    const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;

    // Generate recommendations
    const incomeRec = createIncomeIncreaseRecommendation(detailRec, currentAge, targetRetirementAge, currentReadyAge, inputs);
    if (incomeRec) list.push(incomeRec);

    const budgetRec = createBudgetRebalanceRecommendation(detailRec, currentAge, targetRetirementAge, currentReadyAge, inputs);
    if (budgetRec) list.push(budgetRec);

    const saveRec = createSaveMoreSpendLessRecommendation(detailRec, currentAge, targetRetirementAge, currentReadyAge, inputs);
    if (saveRec) list.push(saveRec);
  });

  return list;
}

export function applyChildRecommendation(inputs, scenario) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  
  if ((scenario.type.startsWith('childPromotion') || scenario.type.startsWith('childOffset')) && scenario.promoEvent) {
    const remainingIncomes = (newInputs.incomeList || []).filter(i => i.id !== scenario.promoEvent.id);
    newInputs.incomeList = [...remainingIncomes, scenario.promoEvent];
    
    newInputs.lifeEvents = (newInputs.lifeEvents || []).map(ev => {
      if (ev.id === scenario.promoEvent.parentEventId) {
        return { ...ev, linkedEventId: scenario.promoEvent.id };
      }
      return ev;
    });
  } else if (scenario.type.startsWith('childBudgetRebalance')) {
    const recId = scenario.type.split('-')[1];
    const event = (newInputs.lifeEvents || []).find(e => e.id === recId);
    if (event) {
      const rec = calculateChildcareCostPhaseImpact(event, newInputs);
      const amountToReduceMonthly = Math.round(rec.peakCost / 12);
      
      newInputs.budgetDetails.phases = splitPhasesAtAge(newInputs.budgetDetails.phases, rec.parentStartAge);
      newInputs.budgetDetails.phases = splitPhasesAtAge(newInputs.budgetDetails.phases, rec.parentEndAge);
      
      for (const phase of newInputs.budgetDetails.phases) {
        if (phase.startAge >= rec.parentStartAge && phase.startAge < rec.parentEndAge) {
          let remaining = amountToReduceMonthly;
          const keysToReduce = ['leisure', 'diningOut', 'misc'];
          for (const key of keysToReduce) {
            if (phase.expenses && phase.expenses[key] !== undefined && phase.expenses[key] > 0) {
              const reduceAmt = Math.min(phase.expenses[key], remaining);
              phase.expenses[key] -= reduceAmt;
              remaining -= reduceAmt;
              if (remaining <= 0) break;
            }
          }
        }
      }
    }
  } else if (scenario.type.startsWith('childSaveMore')) {
    const recId = scenario.type.split('-')[1];
    const event = (newInputs.lifeEvents || []).find(e => e.id === recId);
    if (event) {
      const rec = calculateChildcareCostPhaseImpact(event, newInputs);
      const currentAgeVal = Number(newInputs.currentAge) || 30;
      const targetRetAgeVal = Number(newInputs.targetRetirementAge) || 65;
      const additionalSavingsMonthly = Math.round(rec.peakCost / 12);
      
      for (const phase of newInputs.budgetDetails.phases) {
        if (phase.startAge >= currentAgeVal && phase.startAge < targetRetAgeVal) {
          if (!phase.savings) phase.savings = { brokerage: 0 };
          phase.savings.brokerage = (phase.savings.brokerage || 0) + additionalSavingsMonthly;
          
          let remaining = additionalSavingsMonthly;
          const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
          for (const key of keysToReduce) {
            if (phase.expenses && phase.expenses[key] !== undefined && phase.expenses[key] > 0) {
              const reduceAmt = Math.min(phase.expenses[key], remaining);
              phase.expenses[key] -= reduceAmt;
              remaining -= reduceAmt;
              if (remaining <= 0) break;
            }
          }
        }
      }
    }
  }
  
  return newInputs;
}
