import { getNormalizedPhases } from './phases.js';
import { calculateUSTaxForModal } from '../../simulatorMathUtils.js';

import { normalizeInputsStage } from './pipeline/normalizeInputs.js';
import { deriveTimelineStage } from './pipeline/deriveTimeline.js';
import { applyEventsStage } from './pipeline/applyEvents.js';
import { deriveBudgetPhasesStage } from './pipeline/deriveBudgetPhases.js';
import { projectYearlyBalancesStage } from './pipeline/projectYearlyBalances.js';
import { computeReadinessStage } from './pipeline/computeReadiness.js';
import { formatSimulationResultStage } from './pipeline/formatSimulationResult.js';

function runSimulation(inputs) {
  const normalizedInputs = normalizeInputsStage(inputs);
  const timelineDetails = deriveTimelineStage(normalizedInputs);
  const { profile, events } = applyEventsStage(normalizedInputs, timelineDetails);
  const phases = deriveBudgetPhasesStage(profile, events, normalizedInputs.budgetDetails?.phases);
  const plannedProjection = projectYearlyBalancesStage(profile, phases, events, normalizedInputs.targetRetirementAge);
  const readinessResult = computeReadinessStage(profile, phases, events, plannedProjection);
  return formatSimulationResultStage(readinessResult, profile, phases, plannedProjection, normalizedInputs);
}

// Helper to apply Balanced adjustment (Save More, Earn More, and Balanced are all wrappers/cases of this)
export function applyBalancedAdjustment(inputs, S_wants_monthly, I_annual, targetRetirementAge) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  if (targetRetirementAge !== undefined && targetRetirementAge !== null) {
    newInputs.targetRetirementAge = targetRetirementAge;
    if (newInputs.lifeEvents) {
      const retireEv = newInputs.lifeEvents.find(e => e.type === 'retire');
      if (retireEv) {
        retireEv.age = targetRetirementAge;
      }
    }
  }

  const currentAgeVal = Number(newInputs.currentAge) || 35;
  const normPhases = getNormalizedPhases(newInputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

  if (currentPhase) {
    if (S_wants_monthly > 0) {
      const expenses = currentPhase.expenses || {};
      const wantsKeys = ['diningOut', 'leisure', 'misc'];
      const needsKeys = ['food', 'transportation', 'utilities'];
      
      const reductions = {};
      let totalMaxRed = 0;
      
      wantsKeys.forEach(k => {
        const val = Number(expenses[k]) || 0;
        reductions[k] = { val, maxRed: val };
        totalMaxRed += val;
      });
      
      needsKeys.forEach(k => {
        const val = Number(expenses[k]) || 0;
        const floor = Math.round(val * 0.5);
        reductions[k] = { val, maxRed: Math.max(0, val - floor) };
        totalMaxRed += Math.max(0, val - floor);
      });

      if (totalMaxRed > 0) {
        const scale = Math.min(1, S_wants_monthly / totalMaxRed);
        Object.keys(reductions).forEach(k => {
          const redAmount = Math.round(reductions[k].maxRed * scale);
          currentPhase.expenses[k] = Math.max(0, reductions[k].val - redAmount);
        });
      }

      if (!currentPhase.savings) currentPhase.savings = {};
      currentPhase.savings.brokerage = (currentPhase.savings.brokerage || 0) + Math.round(S_wants_monthly);
    }

    if (I_annual > 0) {
      const oldIncome = currentPhase.income * 12;
      const newIncome = oldIncome + I_annual;
      
      let oldTaxes = 0;
      let newTaxes = 0;
      if (newInputs.includeTaxes) {
        oldTaxes = calculateUSTaxForModal(oldIncome, 0, newInputs.filingStatus || 'single');
        newTaxes = calculateUSTaxForModal(newIncome, 0, newInputs.filingStatus || 'single');
      }
      const netIncrease = I_annual - (newTaxes - oldTaxes);
      const monthlyNetSavings = Math.round(netIncrease / 12);
      
      currentPhase.income = Math.round(newIncome / 12);
      if (!currentPhase.savings) currentPhase.savings = {};
      currentPhase.savings.brokerage = (currentPhase.savings.brokerage || 0) + monthlyNetSavings;
    }
  }

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
    newInputs.simpleIncome = standardIncomeMonthly * 12;
    newInputs.simpleExpenses = Object.keys(currentPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (currentPhase.expenses[v] || 0), 0) * 12;
  }

  newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
    if (inc.id === 'simple-inc' || inc.id === 'inc-1' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
      inc.amount = newInputs.simpleIncome;
    }
    return inc;
  });

  return newInputs;
}

// Helper to apply Save More adjustment
export function applySaveMoreAdjustment(inputs, S_monthly, targetRetirementAge) {
  return applyBalancedAdjustment(inputs, S_monthly, 0, targetRetirementAge);
}

// Helper to apply Earn More adjustment
export function applyEarnMoreAdjustment(inputs, I_annual, targetRetirementAge) {
  return applyBalancedAdjustment(inputs, 0, I_annual, targetRetirementAge);
}

export function calculateRetireSoonerOptions(inputs, targetAge) {
  const currentAgeVal = Number(inputs.currentAge) || 35;
  const lifeExpectancyVal = Number(inputs.lifeExpectancy) || 85;
  const normPhases = getNormalizedPhases(inputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

  let maxReducibleMonthlySpending = 0;
  if (currentPhase) {
    const expenses = currentPhase.expenses || {};
    const wantsKeys = ['diningOut', 'leisure', 'misc'];
    const needsKeys = ['food', 'transportation', 'utilities'];
    
    wantsKeys.forEach(k => {
      maxReducibleMonthlySpending += (Number(expenses[k]) || 0);
    });
    
    needsKeys.forEach(k => {
      const val = (Number(expenses[k]) || 0);
      maxReducibleMonthlySpending += (val - Math.round(val * 0.5));
    });
  }
  const maxReducibleAnnualSpending = maxReducibleMonthlySpending * 12;

  // Solvency check function based on net worth
  const checkSolvency = (testInputs) => {
    const res = runSimulation(testInputs);
    if (!res.moneyLasts) return false;
    const logs = res.data || [];
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.age >= targetAge && log.age <= lifeExpectancyVal) {
        if (log.netWorth < 0) {
          return false;
        }
      }
    }
    return true;
  };

  // 1. Calculate Save More option
  let requiredSaveMoreMonthly = null;
  if (maxReducibleAnnualSpending > 0) {
    const maxSaveMoreInputs = applySaveMoreAdjustment(inputs, maxReducibleMonthlySpending, targetAge);
    if (checkSolvency(maxSaveMoreInputs)) {
      let saveMoreLow = 0;
      let saveMoreHigh = Math.round(maxReducibleAnnualSpending);
      let requiredSaveMoreAnnual = null;
      
      while (saveMoreLow <= saveMoreHigh) {
        const mid = Math.floor((saveMoreLow + saveMoreHigh) / 2);
        const testInputs = applySaveMoreAdjustment(inputs, mid / 12, targetAge);
        if (checkSolvency(testInputs)) {
          requiredSaveMoreAnnual = mid;
          saveMoreHigh = mid - 1;
        } else {
          saveMoreLow = mid + 1;
        }
      }
      if (requiredSaveMoreAnnual !== null) {
        requiredSaveMoreMonthly = Math.round(requiredSaveMoreAnnual / 12);
      }
    }
  }

  // 2. Calculate Earn More option
  let requiredEarnMoreAnnual = null;
  let earnMoreHigh = Number(inputs.simpleIncome) || 50000;
  let successAtCap = false;
  const maxCap = 1000000;
  
  while (earnMoreHigh <= maxCap) {
    const testInputs = applyEarnMoreAdjustment(inputs, earnMoreHigh, targetAge);
    if (checkSolvency(testInputs)) {
      successAtCap = true;
      break;
    }
    if (earnMoreHigh === maxCap) break;
    earnMoreHigh = Math.min(maxCap, earnMoreHigh * 2);
  }
  
  if (successAtCap) {
    let earnMoreLow = 0;
    while (earnMoreLow <= earnMoreHigh) {
      const mid = Math.floor((earnMoreLow + earnMoreHigh) / 2);
      const testInputs = applyEarnMoreAdjustment(inputs, mid, targetAge);
      if (checkSolvency(testInputs)) {
        requiredEarnMoreAnnual = mid;
        earnMoreHigh = mid - 1;
      } else {
        earnMoreLow = mid + 1;
      }
    }
  }

  // 3. Calculate Balanced option
  let requiredBalancedX = null;
  let balancedHigh = Number(inputs.simpleIncome) || 50000;
  let successBalancedCap = false;
  
  while (balancedHigh <= maxCap) {
    const targetSpendingReduction = balancedHigh * 0.5;
    const spendingReduction = Math.min(targetSpendingReduction, maxReducibleAnnualSpending);
    const incomeIncrease = balancedHigh - spendingReduction;
    
    const testInputs = applyBalancedAdjustment(inputs, spendingReduction / 12, incomeIncrease, targetAge);
    if (checkSolvency(testInputs)) {
      successBalancedCap = true;
      break;
    }
    if (balancedHigh === maxCap) break;
    balancedHigh = Math.min(maxCap, balancedHigh * 2);
  }
  
  if (successBalancedCap) {
    let balancedLow = 0;
    while (balancedLow <= balancedHigh) {
      const mid = Math.floor((balancedLow + balancedHigh) / 2);
      const targetSpendingReduction = mid * 0.5;
      const spendingReduction = Math.min(targetSpendingReduction, maxReducibleAnnualSpending);
      const incomeIncrease = mid - spendingReduction;
      
      const testInputs = applyBalancedAdjustment(inputs, spendingReduction / 12, incomeIncrease, targetAge);
      if (checkSolvency(testInputs)) {
        requiredBalancedX = mid;
        balancedHigh = mid - 1;
      } else {
        balancedLow = mid + 1;
      }
    }
  }
  
  let wantsReductionBalanced = 0;
  let requiredBalancedIncomeAnnual = null;
  if (requiredBalancedX !== null) {
    const targetSpendingReduction = requiredBalancedX * 0.5;
    const spendingReduction = Math.min(targetSpendingReduction, maxReducibleAnnualSpending);
    wantsReductionBalanced = Math.round(spendingReduction / 12);
    requiredBalancedIncomeAnnual = requiredBalancedX - spendingReduction;
  }

  const targetInputs = applySaveMoreAdjustment(inputs, 0, targetAge);
  const targetSimRes = runSimulation(targetInputs);
  const targetRequiredAssets = targetSimRes.nominalRequiredAtDesired;
  const targetDeflatedRequiredAssets = targetSimRes.deflatedRequiredAtDesired;
  const targetShortfall = targetSimRes.nominalShortfallAtDesired;
  const targetDeflatedShortfall = targetSimRes.deflatedShortfallAtDesired;

  return {
    maxAvailableSavingsIncrease: maxReducibleMonthlySpending,
    maxReducibleAnnualSpending,
    requiredSaveMoreMonthly,
    requiredSaveMoreAnnual: requiredSaveMoreMonthly ? requiredSaveMoreMonthly * 12 : null,
    requiredEarnMoreAnnual,
    wantsReductionBalanced,
    wantsReductionBalancedAnnual: wantsReductionBalanced * 12,
    requiredBalancedIncomeAnnual,
    targetRequiredAssets,
    targetDeflatedRequiredAssets,
    targetShortfall,
    targetDeflatedShortfall
  };
}
