import { runFireSimulation, getNormalizedPhases } from '../../fireCalculations';
import { getActiveDebtsForAge } from './debts';
import { calculateUSTaxForModal } from '../../simulatorMathUtils';

export function getHousingCostForPrice(price, buyHouseEv) {
  const p = price;
  const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
  
  let dp = buyHouseEv.downPayment || 0;
  if (originalPrice > 0 && buyHouseEv.purchaseType !== 'cash') {
    const ratio = (buyHouseEv.downPayment || 0) / originalPrice;
    dp = p * ratio;
  }
  dp = Math.min(dp, p);
  
  const isCash = dp >= p || buyHouseEv.purchaseType === 'cash';
  
  let monthlyPI = 0;
  let loanAmount = 0;
  if (!isCash) {
    const rate = (buyHouseEv.mortgageRate !== undefined ? Number(buyHouseEv.mortgageRate) : 6.5) / 100;
    const mortgageTerm = buyHouseEv.loanTerm !== undefined ? Number(buyHouseEv.loanTerm) : 30;
    loanAmount = Math.max(0, p - dp);
    if (loanAmount > 0 && mortgageTerm > 0) {
      const r = rate / 12;
      const n = mortgageTerm * 12;
      monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
  }

  const propTaxRate = (buyHouseEv.propertyTax !== undefined ? Number(buyHouseEv.propertyTax) : 1.1) / 100;
  const insRate = (buyHouseEv.insurance !== undefined ? Number(buyHouseEv.insurance) : 0.35) / 100;
  const maintRate = (buyHouseEv.maintenance !== undefined ? Number(buyHouseEv.maintenance) : 1.0) / 100;
  
  const monthlyPropTax = (p * propTaxRate) / 12;
  const monthlyIns = (p * insRate) / 12;
  const monthlyMaint = (p * maintRate) / 12;
  const monthlyHoa = Number(buyHouseEv.hoa) || 0;
  const monthlyUtil = Number(buyHouseEv.utilitiesIncrease) || 0;
  
  let monthlyPmi = 0;
  if (!isCash && dp < p * 0.2) {
    const pmiRate = buyHouseEv.pmi !== undefined ? Number(buyHouseEv.pmi) : 0.5;
    monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
  }
  
  return Math.round(monthlyPI + monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi);
}

function getPhaseSurplus(phase, inputsObj) {
  const debts = getActiveDebtsForAge(inputsObj, phase.startAge);
  const filteredDebts = debts.filter(d => d.id !== 'mortgage' && d.id !== '🏠 Mortgage' && d.type !== 'mortgage');
  const debtsTotal = filteredDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const baseExpenses = Object.keys(phase.expenses || {}).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (phase.expenses[v] || 0), 0);
  const savings = phase.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const taxes = inputsObj.includeTaxes ? Math.round(calculateUSTaxForModal(phase.income * 12 || 0, 0, inputsObj.filingStatus || 'single') / 12) : 0;
  const totalAllocated = baseExpenses + debtsTotal + savings + taxes;
  return phase.income - totalAllocated;
}

export function splitPhasesAtAge(phases, splitAge) {
  const newPhases = [];
  for (const phase of phases) {
    if (phase.startAge < splitAge && phase.endAge > splitAge) {
      const p1 = JSON.parse(JSON.stringify(phase));
      p1.endAge = splitAge;
      p1.id = phase.id + '-pre-split';
      
      const p2 = JSON.parse(JSON.stringify(phase));
      p2.startAge = splitAge;
      p2.id = phase.id + '-post-split';
      
      newPhases.push(p1, p2);
    } else {
      newPhases.push(JSON.parse(JSON.stringify(phase)));
    }
  }
  return newPhases;
}

export function getOldRentBeforePurchase(originalInputs, purchaseAge) {
  const phases = getNormalizedPhases(originalInputs);
  if (phases && phases.length > 0) {
    const sortedPhases = [...phases]
      .filter(p => p.startAge < purchaseAge)
      .sort((a, b) => b.startAge - a.startAge);
    for (const phase of sortedPhases) {
      const rent = phase.expenses && (phase.expenses.housing || phase.expenses.rent || 0);
      if (rent > 0) return Number(rent) || 0;
    }
  }
  if (originalInputs.budgetDetails?.expenses) {
    const rent = originalInputs.budgetDetails.expenses.housing || originalInputs.budgetDetails.expenses.rent || 0;
    if (rent > 0) return Number(rent) || 0;
  }
  return 0;
}

export function applyBudgetAdjustmentsForLevel(level, inputs, buyHouseEv, price, originalInputs) {
  const purchaseAge = Number(buyHouseEv.purchaseAge || buyHouseEv.age || 40);
  
  if (level === 'conservative') {
    if (inputs.budgetDetails && inputs.budgetDetails.phases) {
      inputs.budgetDetails.phases = splitPhasesAtAge(inputs.budgetDetails.phases, purchaseAge);
    }
    return;
  }
  
  const baselineInputs = JSON.parse(JSON.stringify(originalInputs || inputs));
  baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'buyHouse') {
      return { ...ev, enabled: false };
    }
    return ev;
  });
  const baselinePhases = getNormalizedPhases(baselineInputs);

  if (inputs.budgetDetails && inputs.budgetDetails.phases) {
    inputs.budgetDetails.phases = splitPhasesAtAge(inputs.budgetDetails.phases, purchaseAge);
    for (const phase of inputs.budgetDetails.phases) {
      if (phase.startAge >= purchaseAge && phase.type === 'workSave') {
        const baseP = baselinePhases.find(p => phase.startAge >= p.startAge && phase.startAge < p.endAge);
        const phaseIncome = baseP ? baseP.income : 0;
        
        const taxes = (originalInputs || inputs).includeTaxes 
          ? Math.round(calculateUSTaxForModal(phaseIncome * 12 || 0, 0, (originalInputs || inputs).filingStatus || 'single') / 12) 
          : 0;
        const netMonthlyIncome = phaseIncome - taxes;

        const newHousingCost = getHousingCostForPrice(price, buyHouseEv);
        
        const currentWants = (Number(phase.expenses.leisure) || 0) + (Number(phase.expenses.diningOut) || 0) + (Number(phase.expenses.misc) || 0);
        const otherBaseExpenses = Object.keys(phase.expenses)
          .filter(k => k !== 'housing' && k !== 'rent' && k !== 'leisure' && k !== 'diningOut' && k !== 'misc')
          .reduce((sum, k) => sum + (Number(phase.expenses[k]) || 0), 0);
        const totalSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
        
        const totalAllocated = newHousingCost + currentWants + totalSavings + otherBaseExpenses;
        const surplus = phaseIncome - totalAllocated;
        
        let amountToCover = Math.max(0, -surplus);
        if (amountToCover > 0) {
          // 1. Reduce Wants down to Wants Floor
          const wantsFloor = Math.max(250, 0.10 * netMonthlyIncome);
          const reducibleWants = Math.max(0, currentWants - wantsFloor);
          const wantsReduction = Math.min(amountToCover, reducibleWants);
          
          if (wantsReduction > 0) {
            const ratio = currentWants > 0 ? (currentWants - wantsReduction) / currentWants : 0;
            if (phase.expenses.leisure !== undefined) phase.expenses.leisure = Math.round(phase.expenses.leisure * ratio);
            if (phase.expenses.diningOut !== undefined) phase.expenses.diningOut = Math.round(phase.expenses.diningOut * ratio);
            if (phase.expenses.misc !== undefined) phase.expenses.misc = Math.round(phase.expenses.misc * ratio);
            amountToCover -= wantsReduction;
          }
          
          // 2. Reduce Savings down to Savings Floor
          if (amountToCover > 0) {
            const currentSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
            const savingsFloor = level === 'balanced' ? 0.10 * netMonthlyIncome : 0;
            const reducibleSavings = Math.max(0, currentSavings - savingsFloor);
            const savingsReduction = Math.min(amountToCover, reducibleSavings);
            
            if (savingsReduction > 0) {
              const ratio = currentSavings > 0 ? (currentSavings - savingsReduction) / currentSavings : 0;
              Object.keys(phase.savings || {}).forEach(k => {
                phase.savings[k] = Math.round(phase.savings[k] * ratio);
              });
            }
          }
        }
      }
    }
  }
}

export function applyBalancedBudgetAdjustments(inputs, buyHouseEv, price, originalInputs) {
  applyBudgetAdjustmentsForLevel('balanced', inputs, buyHouseEv, price, originalInputs);
}

function getPriceForHousingCost(targetPayment, buyHouseEv) {
  if (targetPayment <= 0) return 0;
  let low = 0;
  let high = Math.max(100000, targetPayment * 12 * 100);
  let bestPrice = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cost = getHousingCostForPrice(mid, buyHouseEv);
    if (cost <= targetPayment) {
      bestPrice = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return bestPrice;
}

export function getMonthlyPIForPrice(price, buyHouseEv) {
  const p = price;
  const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
  let dp = buyHouseEv.downPayment || 0;
  if (originalPrice > 0 && buyHouseEv.purchaseType !== 'cash') {
    const ratio = (buyHouseEv.downPayment || 0) / originalPrice;
    dp = p * ratio;
  }
  dp = Math.min(dp, p);
  
  const isCash = dp >= p || buyHouseEv.purchaseType === 'cash';
  if (isCash) return 0;
  
  const rate = (buyHouseEv.mortgageRate !== undefined ? Number(buyHouseEv.mortgageRate) : 6.5) / 100;
  const mortgageTerm = buyHouseEv.loanTerm !== undefined ? Number(buyHouseEv.loanTerm) : 30;
  const loanAmount = Math.max(0, p - dp);
  if (loanAmount > 0 && mortgageTerm > 0) {
    const r = rate / 12;
    const n = mortgageTerm * 12;
    return r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }
  return 0;
}

function getBudgetAdjustmentsForPrice(price, level, buyHouseEv, basePhase, netMonthlyIncome, currentSurplus) {
  const newHousingCost = getHousingCostForPrice(price, buyHouseEv);
  const currentWants = (Number(basePhase.expenses.leisure) || 0) + (Number(basePhase.expenses.diningOut) || 0) + (Number(basePhase.expenses.misc) || 0);
  const currentSavings = basePhase.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(basePhase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  
  const otherBaseExpenses = Object.keys(basePhase.expenses || {})
    .filter(k => k !== 'housing' && k !== 'rent' && k !== 'leisure' && k !== 'diningOut' && k !== 'misc')
    .reduce((sum, k) => sum + (Number(basePhase.expenses[k]) || 0), 0);
  
  const totalAllocated = newHousingCost + currentWants + currentSavings + otherBaseExpenses;
  const surplus = basePhase.income - totalAllocated;
  
  let amountToCover = Math.max(0, -surplus);
  let wantsReduction = 0;
  let savingsReduction = 0;

  if (level !== 'conservative' && amountToCover > 0) {
    // 1. Reduce Wants down to Wants Floor
    const wantsFloor = Math.max(250, 0.10 * netMonthlyIncome);
    const reducibleWants = Math.max(0, currentWants - wantsFloor);
    wantsReduction = Math.min(amountToCover, reducibleWants);
    amountToCover -= wantsReduction;

    // 2. Reduce Savings down to Savings Floor
    if (amountToCover > 0) {
      const savingsFloor = level === 'balanced' ? 0.10 * netMonthlyIncome : 0;
      const reducibleSavings = Math.max(0, currentSavings - savingsFloor);
      savingsReduction = Math.min(amountToCover, reducibleSavings);
    }
  }

  return {
    wantsReduction: Math.round(wantsReduction),
    savingsReduction: Math.round(savingsReduction),
    newWants: Math.round(currentWants - wantsReduction),
    newSavings: Math.round(currentSavings - savingsReduction)
  };
}

function getRequiredDownPaymentAndCosts(price, buyHouseEv) {
  const p = price;
  const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
  
  let dp = buyHouseEv.downPayment || 0;
  if (originalPrice > 0 && buyHouseEv.purchaseType !== 'cash') {
    const ratio = (buyHouseEv.downPayment || 0) / originalPrice;
    dp = p * ratio;
  }
  dp = Math.min(dp, p);
  
  const isCash = dp >= p || buyHouseEv.purchaseType === 'cash';
  const closingCostsRate = buyHouseEv.closingCosts !== undefined ? Number(buyHouseEv.closingCosts) : 3;
  const closingCosts = p * (closingCostsRate / 100);
  const points = buyHouseEv.points !== undefined ? Number(buyHouseEv.points) : 0;
  const renovationCost = buyHouseEv.renovationCost !== undefined ? Number(buyHouseEv.renovationCost) : 0;
  let totalCashNeeded = closingCosts + points + renovationCost;
  if (isCash) {
    totalCashNeeded += p;
  } else {
    totalCashNeeded += dp;
  }
  return totalCashNeeded;
}

function getAvailableLiquidAssetsBeforePurchase(baselineResults, purchaseAge, inputs) {
  const logBefore = baselineResults && baselineResults.nominalData ? baselineResults.nominalData.find(l => l.age === purchaseAge - 1) : null;
  if (logBefore) {
    const cash = Number(logBefore.cashBalance) || 0;
    const brokerage = Number(logBefore.brokerageBalance) || 0;
    const emergencyFund = Number(logBefore.emergencyFundBalance) || 0;
    return cash + brokerage + emergencyFund;
  }
  const assets = inputs.assets || {};
  const conditionItems = (inputs.lifeEvents || []).filter(e => e.type === 'conditionItem');
  
  const customCheckingSavings = conditionItems
    .filter(c => c.type === 'checkingSavings')
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    
  const customBrokerage = conditionItems
    .filter(c => c.type === 'brokerage')
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  
  return (Number(assets.cash) || 0) +
         (Number(assets.emergencyFund) || 0) +
         (Number(assets.brokerage) || 0) +
         customCheckingSavings +
         customBrokerage;
}

function getSimulationValidationForPrice(price, level, inputs, buyHouseEv, baselineReadyAge, originalInputs, baselinePhases, baselineResults) {
  if (price <= 0) {
    return {
      isValid: false,
      monthlySurplus: 0,
      savingsRate: 0,
      retirementAgeImpact: 0,
      sustainable: false
    };
  }

  const purchaseAge = Number(buyHouseEv.purchaseAge || buyHouseEv.age || 40);
  const normPhases = getNormalizedPhases(originalInputs);
  const basePhase = baselinePhases.find(ph => purchaseAge >= ph.startAge && purchaseAge < ph.endAge);
  if (!basePhase) {
    return {
      isValid: false,
      monthlySurplus: 0,
      savingsRate: 0,
      retirementAgeImpact: 0,
      sustainable: false
    };
  }

  const phaseIncome = basePhase.income;
  const baseExpensesExcludingWantsAndHousing = Object.keys(basePhase.expenses || {})
    .filter(k => !k.startsWith('debt_') && k !== 'housing' && k !== 'rent' && k !== 'leisure' && k !== 'diningOut' && k !== 'misc')
    .reduce((sum, v) => sum + (basePhase.expenses[v] || 0), 0);
    
  const debts = getActiveDebtsForAge(originalInputs, basePhase.startAge);
  const filteredDebts = debts.filter(d => d.id !== 'mortgage' && d.id !== '🏠 Mortgage' && d.type !== 'mortgage');
  const debtsTotal = filteredDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  
  const taxes = originalInputs.includeTaxes ? Math.round(calculateUSTaxForModal(phaseIncome * 12 || 0, 0, originalInputs.filingStatus || 'single') / 12) : 0;
  
  const oldHousingCost = getOldRentBeforePurchase(originalInputs, purchaseAge);
  const existingNonHousingNeeds = baseExpensesExcludingWantsAndHousing + debtsTotal;
  const currentNeeds = existingNonHousingNeeds + oldHousingCost;

  const netMonthlyIncome = phaseIncome - taxes;
  const currentWants = (Number(basePhase.expenses.leisure) || 0) + (Number(basePhase.expenses.diningOut) || 0) + (Number(basePhase.expenses.misc) || 0);
  const currentSavings = basePhase.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(basePhase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  
  const currentRent = oldHousingCost;
  const currentSurplus = netMonthlyIncome - currentNeeds - currentWants - currentSavings;

  const wantsFloor = Math.max(250, 0.10 * netMonthlyIncome);
  const savingsFloor = 0.10 * netMonthlyIncome;
  const emergencySurplusFloor = 100;

  const conservativeAdjustmentCapacity = 0;
  const balancedAdjustmentCapacity = Math.max(0, currentWants - wantsFloor) + Math.max(0, currentSavings - savingsFloor);
  const aggressiveAdjustmentCapacity = Math.max(0, currentWants - wantsFloor) + currentSavings;

  const conservativeMaxPayment = Math.max(0, currentRent + currentSurplus + conservativeAdjustmentCapacity - emergencySurplusFloor);
  const balancedMaxPayment = Math.max(0, currentRent + currentSurplus + balancedAdjustmentCapacity - emergencySurplusFloor);
  const aggressiveMaxPayment = Math.max(0, currentRent + currentSurplus + aggressiveAdjustmentCapacity - emergencySurplusFloor);

  const monthlyHousing = getHousingCostForPrice(price, buyHouseEv);
  const totalCashNeeded = getRequiredDownPaymentAndCosts(price, buyHouseEv);
  const liquidNWBefore = getAvailableLiquidAssetsBeforePurchase(baselineResults, purchaseAge, originalInputs);

  const emergencyFundBefore = baselineResults && baselineResults.nominalData 
    ? (baselineResults.nominalData.find(l => l.age === purchaseAge - 1)?.emergencyFundBalance || 0)
    : (Number(originalInputs.assets?.emergencyFund) || 0);

  const emergencyFundMinimumComfortable = emergencyFundBefore;
  const emergencyFundMinimumBalanced = Math.min(5000, emergencyFundBefore);

  const currentAgeVal = Math.max(0, Number(originalInputs.currentAge) || 30);
  const yearsDiff = Math.max(0, purchaseAge - currentAgeVal);

  const brokerageSavings = Number(basePhase.savings?.brokerage) || 0;
  const checkingSavings = Number(basePhase.savings?.checking) || 0;
  const hysaSavings = Number(basePhase.savings?.hysa) || 0;
  const emergencySavings = Number(basePhase.savings?.emergency) || 0;
  const otherSavings = Number(basePhase.savings?.other) || 0;
  const monthlyNonRetirementSavings = brokerageSavings + checkingSavings + hysaSavings + emergencySavings + otherSavings;

  const trad401kSavings = Number(basePhase.savings?.trad401k) || 0;
  const tradIraSavings = Number(basePhase.savings?.tradIra) || 0;
  const rothIraSavings = Number(basePhase.savings?.rothIra) || 0;
  const hsaSavings = Number(basePhase.savings?.hsa) || 0;
  const monthlyRetirementSavings = trad401kSavings + tradIraSavings + rothIraSavings + hsaSavings;

  const redirectedSavingsBalanced = yearsDiff * 12 * monthlyNonRetirementSavings;
  const redirectedSavingsStretch = yearsDiff * 12 * (monthlyNonRetirementSavings + 0.5 * monthlyRetirementSavings);

  const availableHomeFundsComfortable = liquidNWBefore - emergencyFundMinimumComfortable;
  const availableHomeFundsBalanced = liquidNWBefore - emergencyFundMinimumBalanced + redirectedSavingsBalanced;
  const availableHomeFundsStretch = liquidNWBefore + redirectedSavingsStretch;

  let isValid = false;
  if (level === 'conservative') {
    isValid = price > 0 && monthlyHousing <= conservativeMaxPayment;
  } else if (level === 'balanced') {
    isValid = price > 0 && monthlyHousing <= balancedMaxPayment;
  } else if (level === 'stretch' || level === 'aggressive') {
    isValid = price > 0 && monthlyHousing <= aggressiveMaxPayment;
  }

  // Run simulation to get outcomes
  const tempInputs = JSON.parse(JSON.stringify(inputs));
  const buyHouseEventIndex = (tempInputs.lifeEvents || []).findIndex(e => e.id === buyHouseEv.id);
  if (buyHouseEventIndex !== -1) {
    const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
    let dp = buyHouseEv.downPayment || 0;
    if (originalPrice > 0 && buyHouseEv.purchaseType !== 'cash') {
      const ratio = (buyHouseEv.downPayment || 0) / originalPrice;
      dp = price * ratio;
    }
    dp = Math.min(dp, price);

    tempInputs.lifeEvents[buyHouseEventIndex] = {
      ...buyHouseEv,
      homePrice: price,
      downPayment: dp
    };
    applyBudgetAdjustmentsForLevel(level, tempInputs, tempInputs.lifeEvents[buyHouseEventIndex], price, originalInputs);
  }

  const res = runFireSimulation(tempInputs);

  let monthlySurplus = 0;
  let savingsRate = 0;

  if (tempInputs.budgetDetails && tempInputs.budgetDetails.phases) {
    for (const phase of tempInputs.budgetDetails.phases) {
      if (phase.startAge >= purchaseAge && phase.type === 'workSave') {
        const baseP = baselinePhases.find(p => phase.startAge >= p.startAge && phase.startAge < p.endAge);
        const phaseIncome = baseP ? baseP.income : 0;

        const monthlyHousingCost = getHousingCostForPrice(price, tempInputs.lifeEvents[buyHouseEventIndex]);
        const currentWants = (Number(phase.expenses.leisure) || 0) + (Number(phase.expenses.diningOut) || 0) + (Number(phase.expenses.misc) || 0);
        const otherBaseExpenses = Object.keys(phase.expenses)
          .filter(k => k !== 'housing' && k !== 'rent' && k !== 'leisure' && k !== 'diningOut' && k !== 'misc')
          .reduce((sum, k) => sum + (Number(phase.expenses[k]) || 0), 0);
        const totalSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

        const totalAllocated = monthlyHousingCost + currentWants + totalSavings + otherBaseExpenses;
        const surplus = phaseIncome - totalAllocated;
        monthlySurplus = surplus;
        savingsRate = phaseIncome > 0 ? (totalSavings / phaseIncome) : 0;
      }
    }
  }

  const targetBaselineAge = baselineReadyAge !== null && baselineReadyAge !== undefined ? baselineReadyAge : (inputs.targetRetirementAge || 65);
  const retirementReadyAge = res.retirementReadyAge;
  const retirementAgeImpact = retirementReadyAge !== null ? (retirementReadyAge - targetBaselineAge) : 0;
  const sustainable = retirementReadyAge !== null && retirementReadyAge <= (inputs.lifeExpectancy || 85) && res.moneyLasts;

  return {
    isValid,
    monthlySurplus,
    savingsRate,
    retirementAgeImpact,
    sustainable,
    retirementReadyAge,
    baselineReadyAge: targetBaselineAge
  };
}

export function getRebalanceStrategies(inputs, activeBuyHouseEv, baselineReadyAge) {
  if (!activeBuyHouseEv) return null;

  const purchaseAge = Number(activeBuyHouseEv.purchaseAge || activeBuyHouseEv.age || 40);
  const recInputs = JSON.parse(JSON.stringify(inputs));
  
  const normPhases = getNormalizedPhases(recInputs);
  const activePhase = normPhases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
  if (!activePhase) return null;

  const oldHousingCost = getOldRentBeforePurchase(recInputs, purchaseAge);

  const p = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  const newHousingCost = getHousingCostForPrice(p, activeBuyHouseEv);
  const monthlyDifference = Math.max(0, newHousingCost - oldHousingCost);

  const currentSurplusRaw = getPhaseSurplus(activePhase, recInputs);
  const houseDeficit = Math.max(0, -currentSurplusRaw);
  if (houseDeficit <= 0) return null;

  const resolvedBaselineAge = baselineReadyAge !== undefined ? baselineReadyAge : null;

  const baselineInputs = JSON.parse(JSON.stringify(recInputs));
  baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'buyHouse') {
      return { ...ev, enabled: false };
    }
    return ev;
  });
  const baselinePhases = getNormalizedPhases(baselineInputs);
  const baselineResults = runFireSimulation(baselineInputs);
  const basePhase = baselinePhases.find(ph => purchaseAge >= ph.startAge && purchaseAge < ph.endAge);
  if (!basePhase) return null;

  const phaseIncome = basePhase.income;
  
  const baseExpensesExcludingWantsAndHousing = Object.keys(basePhase.expenses || {})
    .filter(k => !k.startsWith('debt_') && k !== 'housing' && k !== 'rent' && k !== 'leisure' && k !== 'diningOut' && k !== 'misc')
    .reduce((sum, v) => sum + (basePhase.expenses[v] || 0), 0);
    
  const debts = getActiveDebtsForAge(baselineInputs, basePhase.startAge);
  const filteredDebts = debts.filter(d => d.id !== 'mortgage' && d.id !== '🏠 Mortgage' && d.type !== 'mortgage');
  const debtsTotal = filteredDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  
  const taxes = recInputs.includeTaxes ? Math.round(calculateUSTaxForModal(phaseIncome * 12 || 0, 0, recInputs.filingStatus || 'single') / 12) : 0;
  
  const existingNonHousingNeeds = baseExpensesExcludingWantsAndHousing + debtsTotal;
  const currentNeeds = existingNonHousingNeeds + oldHousingCost;

  const netMonthlyIncome = phaseIncome - taxes;
  const currentWants = (Number(basePhase.expenses.leisure) || 0) + (Number(basePhase.expenses.diningOut) || 0) + (Number(basePhase.expenses.misc) || 0);
  const currentSavings = basePhase.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(basePhase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  
  const currentRent = oldHousingCost;
  const currentSurplus = netMonthlyIncome - currentNeeds - currentWants - currentSavings;

  const wantsFloor = Math.max(250, 0.10 * netMonthlyIncome);
  const savingsFloor = 0.10 * netMonthlyIncome;
  const emergencySurplusFloor = 100;

  const conservativeAdjustmentCapacity = 0;
  const balancedAdjustmentCapacity = Math.max(0, currentWants - wantsFloor) + Math.max(0, currentSavings - savingsFloor);
  const aggressiveAdjustmentCapacity = Math.max(0, currentWants - wantsFloor) + currentSavings;

  const conservativeMaxPayment = Math.max(0, currentRent + currentSurplus + conservativeAdjustmentCapacity - emergencySurplusFloor);
  const balancedMaxPayment = Math.max(0, currentRent + currentSurplus + balancedAdjustmentCapacity - emergencySurplusFloor);
  const aggressiveMaxPayment = Math.max(0, currentRent + currentSurplus + aggressiveAdjustmentCapacity - emergencySurplusFloor);

  const liquidNWBefore = getAvailableLiquidAssetsBeforePurchase(baselineResults, purchaseAge, recInputs);

  const emergencyFundBefore = baselineResults && baselineResults.nominalData 
    ? (baselineResults.nominalData.find(l => l.age === purchaseAge - 1)?.emergencyFundBalance || 0)
    : (Number(recInputs.assets?.emergencyFund) || 0);

  const emergencyFundMinimumComfortable = emergencyFundBefore;
  const emergencyFundMinimumBalanced = Math.min(5000, emergencyFundBefore);

  const currentAgeVal = Math.max(0, Number(recInputs.currentAge) || 30);
  const yearsDiff = Math.max(0, purchaseAge - currentAgeVal);

  const brokerageSavings = Number(basePhase.savings?.brokerage) || 0;
  const checkingSavings = Number(basePhase.savings?.checking) || 0;
  const hysaSavings = Number(basePhase.savings?.hysa) || 0;
  const emergencySavings = Number(basePhase.savings?.emergency) || 0;
  const otherSavings = Number(basePhase.savings?.other) || 0;
  const monthlyNonRetirementSavings = brokerageSavings + checkingSavings + hysaSavings + emergencySavings + otherSavings;

  const trad401kSavings = Number(basePhase.savings?.trad401k) || 0;
  const tradIraSavings = Number(basePhase.savings?.tradIra) || 0;
  const rothIraSavings = Number(basePhase.savings?.rothIra) || 0;
  const hsaSavings = Number(basePhase.savings?.hsa) || 0;
  const monthlyRetirementSavings = trad401kSavings + tradIraSavings + rothIraSavings + hsaSavings;

  const redirectedSavingsBalanced = yearsDiff * 12 * monthlyNonRetirementSavings;
  const redirectedSavingsStretch = yearsDiff * 12 * (monthlyNonRetirementSavings + 0.5 * monthlyRetirementSavings);

  const availableHomeFundsComfortable = liquidNWBefore - emergencyFundMinimumComfortable;
  const availableHomeFundsBalanced = liquidNWBefore - emergencyFundMinimumBalanced + redirectedSavingsBalanced;
  const availableHomeFundsStretch = liquidNWBefore + redirectedSavingsStretch;

  const closingCostsRate = activeBuyHouseEv.closingCosts !== undefined ? Number(activeBuyHouseEv.closingCosts) : 3;
  const movingCosts = activeBuyHouseEv.movingCosts !== undefined ? Number(activeBuyHouseEv.movingCosts) : 3000;
  
  const isCashPurchase = activeBuyHouseEv.purchaseType === 'cash' || (activeBuyHouseEv.downPayment || 0) >= p;
  const targetDownPaymentPercent = isCashPurchase ? 1.0 : (p > 0 ? Math.max(0.01, (activeBuyHouseEv.downPayment || 0) / p) : 0.20);

  // Back-solve prices without simulation, using monthly affordability only
  const priceStretch = Math.round(Math.max(0, getPriceForHousingCost(aggressiveMaxPayment, activeBuyHouseEv)));
  const priceBalanced = Math.round(priceStretch * 0.85);
  const priceConservative = Math.round(priceStretch * 0.70);

  // Run simulation exactly once for each band price to validate
  const valConservative = getSimulationValidationForPrice(priceConservative, 'conservative', recInputs, activeBuyHouseEv, resolvedBaselineAge, recInputs, baselinePhases, baselineResults);
  const valBalanced = getSimulationValidationForPrice(priceBalanced, 'balanced', recInputs, activeBuyHouseEv, resolvedBaselineAge, recInputs, baselinePhases, baselineResults);
  const valStretch = getSimulationValidationForPrice(priceStretch, 'stretch', recInputs, activeBuyHouseEv, resolvedBaselineAge, recInputs, baselinePhases, baselineResults);

  const adjConservative = getBudgetAdjustmentsForPrice(priceConservative, 'conservative', activeBuyHouseEv, basePhase, netMonthlyIncome, currentSurplus);
  const adjBalanced = getBudgetAdjustmentsForPrice(priceBalanced, 'balanced', activeBuyHouseEv, basePhase, netMonthlyIncome, currentSurplus);
  const adjStretch = getBudgetAdjustmentsForPrice(priceStretch, 'stretch', activeBuyHouseEv, basePhase, netMonthlyIncome, currentSurplus);

  const piConservative = Math.round(getMonthlyPIForPrice(priceConservative, activeBuyHouseEv));
  const piBalanced = Math.round(getMonthlyPIForPrice(priceBalanced, activeBuyHouseEv));
  const piAggressive = Math.round(getMonthlyPIForPrice(priceStretch, activeBuyHouseEv));

  // Selected option logic:
  let selectedAffordablePrice = null;
  let selectedOption = 'balanced';
  let selectedRetirementDelay = 0;

  if (priceBalanced > 0) {
    selectedAffordablePrice = priceBalanced;
    selectedOption = 'balanced';
    selectedRetirementDelay = valBalanced.retirementAgeImpact;
  } else if (priceConservative > 0) {
    selectedAffordablePrice = priceConservative;
    selectedOption = 'conservative';
    selectedRetirementDelay = valConservative.retirementAgeImpact;
  } else if (priceStretch > 0) {
    selectedAffordablePrice = priceStretch;
    selectedOption = 'aggressive';
    selectedRetirementDelay = valStretch.retirementAgeImpact;
  } else {
    // If all are invalid
    selectedAffordablePrice = null;
    selectedOption = 'none';
    selectedRetirementDelay = 0;
  }

  // Calculate remaining Balanced deficit
  const remainingBalancedDeficit = Math.max(0, newHousingCost - balancedMaxPayment);

  const earliestAffordableAge = null;

  const baselineRetirementAge = resolvedBaselineAge !== null && resolvedBaselineAge !== undefined
    ? resolvedBaselineAge
    : (valBalanced.baselineReadyAge !== undefined ? valBalanced.baselineReadyAge : (inputs.targetRetirementAge || 65));

  const maxHomePriceBalanced = Math.max(0, availableHomeFundsBalanced - movingCosts) / (targetDownPaymentPercent + closingCostsRate / 100);

  const totalCashNeeded = getRequiredDownPaymentAndCosts(p, activeBuyHouseEv);

  const getDownPaymentForPrice = (pr) => {
    const originalPrice = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
    let dp = activeBuyHouseEv.downPayment || 0;
    if (originalPrice > 0 && activeBuyHouseEv.purchaseType !== 'cash') {
      const ratio = (activeBuyHouseEv.downPayment || 0) / originalPrice;
      dp = pr * ratio;
    }
    return Math.min(dp, pr);
  };

  const dpConservative = Math.round(getDownPaymentForPrice(priceConservative));
  const dpBalanced = Math.round(getDownPaymentForPrice(priceBalanced));
  const dpStretch = Math.round(getDownPaymentForPrice(priceStretch));

  return {
    purchaseAge,
    oldHousingCost,
    newHousingCost,
    monthlyDifference,
    deficit: houseDeficit,
    remainingBalancedDeficit,
    currentHomePrice: p,
    
    affordablePriceConservative: priceConservative,
    affordablePriceBalanced: priceBalanced,
    affordablePriceAggressive: priceStretch,
    
    isConservativeValid: valConservative.isValid,
    isBalancedValid: valBalanced.isValid,
    isAggressiveValid: valStretch.isValid,

    isConservativeMonthlyValid: priceConservative !== null && priceConservative > 0,
    isBalancedMonthlyValid: priceBalanced !== null && priceBalanced > 0,
    isAggressiveMonthlyValid: priceStretch !== null && priceStretch > 0,

    isConservativeSustainable: valConservative.sustainable,
    isBalancedSustainable: valBalanced.sustainable,
    isAggressiveSustainable: valStretch.sustainable,

    conservativeRetirementAge: valConservative.retirementReadyAge,
    balancedRetirementAge: valBalanced.retirementReadyAge,
    aggressiveRetirementAge: valStretch.retirementReadyAge,
    baselineRetirementAge,
    
    selectedAffordablePrice,
    selectedOption,
    selectedRetirementDelay,
    
    affordablePaymentConservative: getHousingCostForPrice(priceConservative, activeBuyHouseEv),
    affordablePaymentBalanced: getHousingCostForPrice(priceBalanced, activeBuyHouseEv),
    affordablePaymentAggressive: getHousingCostForPrice(priceStretch, activeBuyHouseEv),
    totalCashNeededConservative: getRequiredDownPaymentAndCosts(priceConservative, activeBuyHouseEv),
    totalCashNeededBalanced: getRequiredDownPaymentAndCosts(priceBalanced, activeBuyHouseEv),
    totalCashNeededAggressive: getRequiredDownPaymentAndCosts(priceStretch, activeBuyHouseEv),
    downPaymentConservative: dpConservative,
    downPaymentBalanced: dpBalanced,
    downPaymentAggressive: dpStretch,
    earliestAffordableAge,
    liquidFundsAvailable: liquidNWBefore,
    estimatedDownPaymentCapacity: Math.round(maxHomePriceBalanced * targetDownPaymentPercent),
    totalCashNeeded: totalCashNeeded,
    
    originalWants: Math.round(currentWants),
    originalSavings: Math.round(currentSavings),
    wantsReductionConservative: adjConservative.wantsReduction,
    wantsReductionBalanced: adjBalanced.wantsReduction,
    wantsReductionAggressive: adjStretch.wantsReduction,
    savingsReductionConservative: adjConservative.savingsReduction,
    savingsReductionBalanced: adjBalanced.savingsReduction,
    savingsReductionAggressive: adjStretch.savingsReduction,
    newWantsConservative: adjConservative.newWants,
    newWantsBalanced: adjBalanced.newWants,
    newWantsAggressive: adjStretch.newWants,
    newSavingsConservative: adjConservative.newSavings,
    newSavingsBalanced: adjBalanced.newSavings,
    newSavingsAggressive: adjStretch.newSavings,
    piConservative,
    piBalanced,
    piAggressive
  };
}

export function isHouseAffordableBalanced(inputs, activeBuyHouseEv, baselineReadyAge) {
  const recInputs = JSON.parse(JSON.stringify(inputs));
  const baselineInputs = JSON.parse(JSON.stringify(recInputs));
  baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'buyHouse') {
      return { ...ev, enabled: false };
    }
    return ev;
  });
  const baselinePhases = getNormalizedPhases(baselineInputs);
  const baselineResults = runFireSimulation(baselineInputs);
  const price = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;

  const rebalanceData = getRebalanceStrategies(inputs, activeBuyHouseEv, baselineReadyAge);
  if (!rebalanceData) {
    return {
      monthlyAffordable: false,
      retirementValid: false,
      downPaymentGap: 0
    };
  }

  const val = getSimulationValidationForPrice(price, 'balanced', recInputs, activeBuyHouseEv, baselineReadyAge, inputs, baselinePhases, baselineResults);

  const monthlyAffordable = price <= rebalanceData.affordablePriceBalanced;
  const retirementValid = val.retirementReadyAge !== null && val.retirementAgeImpact <= 3 && val.sustainable;
  const requiredDownPayment = getRequiredDownPaymentAndCosts(price, activeBuyHouseEv);
  const downPaymentGap = Math.max(0, requiredDownPayment - rebalanceData.liquidFundsAvailable);

  return {
    monthlyAffordable,
    retirementValid,
    downPaymentGap
  };
}
