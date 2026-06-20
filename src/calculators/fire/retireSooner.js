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

// Helper to apply Save More adjustment
export function applySaveMoreAdjustment(inputs, S_monthly) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  const currentAgeVal = Number(newInputs.currentAge) || 35;
  const normPhases = getNormalizedPhases(newInputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

  if (currentPhase && S_monthly > 0) {
    const currentWants = (Number(currentPhase.expenses.leisure) || 0) + 
                         (Number(currentPhase.expenses.diningOut) || 0) + 
                         (Number(currentPhase.expenses.misc) || 0);
    const wantsReduction = S_monthly;
    const ratio = currentWants > 0 ? (currentWants - wantsReduction) / currentWants : 0;
    
    if (currentPhase.expenses.leisure !== undefined) currentPhase.expenses.leisure = Math.round(currentPhase.expenses.leisure * ratio);
    if (currentPhase.expenses.diningOut !== undefined) currentPhase.expenses.diningOut = Math.round(currentPhase.expenses.diningOut * ratio);
    if (currentPhase.expenses.misc !== undefined) currentPhase.expenses.misc = Math.round(currentPhase.expenses.misc * ratio);
    
    if (!currentPhase.savings) currentPhase.savings = {};
    currentPhase.savings.brokerage = (currentPhase.savings.brokerage || 0) + S_monthly;
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

// Helper to apply Earn More adjustment
export function applyEarnMoreAdjustment(inputs, I_annual) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  const currentAgeVal = Number(newInputs.currentAge) || 35;
  const normPhases = getNormalizedPhases(newInputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

  if (currentPhase && I_annual > 0) {
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
  }

  newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
    if (inc.id === 'simple-inc' || inc.id === 'inc-1' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
      inc.amount = newInputs.simpleIncome;
    }
    return inc;
  });

  return newInputs;
}

// Helper to apply Balanced adjustment
export function applyBalancedAdjustment(inputs, S_wants, I_annual) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  const currentAgeVal = Number(newInputs.currentAge) || 35;
  const normPhases = getNormalizedPhases(newInputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

  if (currentPhase) {
    if (S_wants > 0) {
      const currentWants = (Number(currentPhase.expenses.leisure) || 0) + 
                           (Number(currentPhase.expenses.diningOut) || 0) + 
                           (Number(currentPhase.expenses.misc) || 0);
      const ratio = currentWants > 0 ? (currentWants - S_wants) / currentWants : 0;
      if (currentPhase.expenses.leisure !== undefined) currentPhase.expenses.leisure = Math.round(currentPhase.expenses.leisure * ratio);
      if (currentPhase.expenses.diningOut !== undefined) currentPhase.expenses.diningOut = Math.round(currentPhase.expenses.diningOut * ratio);
      if (currentPhase.expenses.misc !== undefined) currentPhase.expenses.misc = Math.round(currentPhase.expenses.misc * ratio);
      
      if (!currentPhase.savings) currentPhase.savings = {};
      currentPhase.savings.brokerage = (currentPhase.savings.brokerage || 0) + S_wants;
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

export function calculateRetireSoonerOptions(inputs, targetAge) {
  const currentAgeVal = Number(inputs.currentAge) || 35;
  const normPhases = getNormalizedPhases(inputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

  const phaseIncome = currentPhase ? currentPhase.income : (Number(inputs.simpleIncome) / 12 || 4166.67);
  const taxes = inputs.includeTaxes 
    ? Math.round(calculateUSTaxForModal(phaseIncome * 12 || 0, 0, inputs.filingStatus || 'single') / 12)
    : 0;
  const netMonthlyIncome = phaseIncome - taxes;

  const wantsFloor = Math.max(250, 0.10 * netMonthlyIncome);
  const currentMonthlyWants = currentPhase
    ? (Number(currentPhase.expenses.leisure) || 0) + 
      (Number(currentPhase.expenses.diningOut) || 0) + 
      (Number(currentPhase.expenses.misc) || 0)
    : 0;

  const maxAvailableSavingsIncrease = Math.max(0, currentMonthlyWants - wantsFloor);

  // 1. Save More Fast Path & Binary Search
  let requiredSaveMoreMonthly = null;
  if (maxAvailableSavingsIncrease > 0) {
    const maxSaveMoreInputs = applySaveMoreAdjustment(inputs, maxAvailableSavingsIncrease);
    const maxSaveMoreRes = runSimulation(maxSaveMoreInputs);
    
    if (maxSaveMoreRes.retirementReadyAge !== null && maxSaveMoreRes.retirementReadyAge <= targetAge) {
      // Save More is possible! Binary search between 0 and maxAvailableSavingsIncrease
      let saveMoreLow = 0;
      let saveMoreHigh = Math.ceil(maxAvailableSavingsIncrease / 25);
      let saveMoreSteps = -1;

      while (saveMoreLow <= saveMoreHigh) {
        const mid = Math.floor((saveMoreLow + saveMoreHigh) / 2);
        const sAmt = mid * 25;
        const testInputs = applySaveMoreAdjustment(inputs, sAmt);
        const res = runSimulation(testInputs);
        
        if (res.retirementReadyAge !== null && res.retirementReadyAge <= targetAge) {
          saveMoreSteps = mid;
          saveMoreHigh = mid - 1;
        } else {
          saveMoreLow = mid + 1;
        }
      }
      requiredSaveMoreMonthly = saveMoreSteps !== -1 ? saveMoreSteps * 25 : null;
    }
  }

  // 2. Earn More Fast Path & Binary Search
  let requiredEarnMoreAnnual = null;
  const maxEarnMoreInputs = applyEarnMoreAdjustment(inputs, 1000000);
  const maxEarnMoreRes = runSimulation(maxEarnMoreInputs);

  if (maxEarnMoreRes.retirementReadyAge !== null && maxEarnMoreRes.retirementReadyAge <= targetAge) {
    // Earn More is possible! Binary search up to $1,000,000/yr (2000 steps of $500)
    let earnMoreLow = 0;
    let earnMoreHigh = 2000;
    let earnMoreSteps = -1;

    while (earnMoreLow <= earnMoreHigh) {
      const mid = Math.floor((earnMoreLow + earnMoreHigh) / 2);
      const incAmt = mid * 500;
      const testInputs = applyEarnMoreAdjustment(inputs, incAmt);
      const res = runSimulation(testInputs);
      
      if (res.retirementReadyAge !== null && res.retirementReadyAge <= targetAge) {
        earnMoreSteps = mid;
        earnMoreHigh = mid - 1;
      } else {
        earnMoreLow = mid + 1;
      }
    }
    requiredEarnMoreAnnual = earnMoreSteps !== -1 ? earnMoreSteps * 500 : null;
  }

  // 3. Balanced Option Fast Path & Binary Search
  const solveIncomeIncrease = (wantsReduction) => {
    // Fast path: if even $1,000,000/yr extra income doesn't work, skip search
    const maxBalancedInputs = applyBalancedAdjustment(inputs, wantsReduction, 1000000);
    const maxBalancedRes = runSimulation(maxBalancedInputs);
    if (maxBalancedRes.retirementReadyAge === null || maxBalancedRes.retirementReadyAge > targetAge) {
      return null;
    }

    let balancedLow = 0;
    let balancedHigh = 2000; // up to $1M/yr
    let balancedSteps = -1;

    while (balancedLow <= balancedHigh) {
      const mid = Math.floor((balancedLow + balancedHigh) / 2);
      const incAmt = mid * 500;
      const testInputs = applyBalancedAdjustment(inputs, wantsReduction, incAmt);
      const res = runSimulation(testInputs);
      
      if (res.retirementReadyAge !== null && res.retirementReadyAge <= targetAge) {
        balancedSteps = mid;
        balancedHigh = mid - 1;
      } else {
        balancedLow = mid + 1;
      }
    }
    return balancedSteps !== -1 ? balancedSteps * 500 : null;
  };

  let wantsReductionBalanced = requiredSaveMoreMonthly !== null 
    ? Math.round((requiredSaveMoreMonthly / 2) / 25) * 25 
    : Math.round((maxAvailableSavingsIncrease / 2) / 25) * 25;
  wantsReductionBalanced = Math.min(wantsReductionBalanced, maxAvailableSavingsIncrease);

  let requiredBalancedIncomeAnnual = solveIncomeIncrease(wantsReductionBalanced);
  
  if (requiredBalancedIncomeAnnual === null) {
    // If that does not work, increase savings portion up to maxAvailableSavingsIncrease, then solve income again
    wantsReductionBalanced = maxAvailableSavingsIncrease;
    requiredBalancedIncomeAnnual = solveIncomeIncrease(wantsReductionBalanced);
  }

  return {
    maxAvailableSavingsIncrease,
    requiredSaveMoreMonthly,
    requiredEarnMoreAnnual,
    wantsReductionBalanced,
    requiredBalancedIncomeAnnual
  };
}
