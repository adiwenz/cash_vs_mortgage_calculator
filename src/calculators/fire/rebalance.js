import { runFireSimulation, getNormalizedPhases } from '../../fireCalculations';
import { getActiveDebtsForAge } from './debts';
import { calculateUSTaxForModal } from '../../simulatorMathUtils';

export function getHousingCostForPrice(price, buyHouseEv) {
  const p = price;
  const dp = Math.min(buyHouseEv.downPayment || 0, p);
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
  if (originalInputs.budgetDetails && originalInputs.budgetDetails.phases) {
    const sortedPhases = [...originalInputs.budgetDetails.phases]
      .filter(p => p.startAge < purchaseAge)
      .sort((a, b) => b.startAge - a.startAge);
    for (const phase of sortedPhases) {
      const rent = phase.expenses && (phase.expenses.housing || phase.expenses.rent || 0);
      if (rent > 0) return Number(rent) || 0;
    }
  }
  return 0;
}

export function applyBalancedBudgetAdjustments(inputs, buyHouseEv, price, originalInputs) {
  const purchaseAge = Number(buyHouseEv.purchaseAge || buyHouseEv.age || 40);
  
  const baselineInputs = JSON.parse(JSON.stringify(originalInputs));
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
          const wantsFloor = Math.max(250, 0.10 * phaseIncome);
          const reducibleWants = Math.max(0, currentWants - wantsFloor);
          const wantsReduction = Math.min(amountToCover, reducibleWants);
          
          if (wantsReduction > 0) {
            const ratio = currentWants > 0 ? (currentWants - wantsReduction) / currentWants : 0;
            if (phase.expenses.leisure !== undefined) phase.expenses.leisure = Math.round(phase.expenses.leisure * ratio);
            if (phase.expenses.diningOut !== undefined) phase.expenses.diningOut = Math.round(phase.expenses.diningOut * ratio);
            if (phase.expenses.misc !== undefined) phase.expenses.misc = Math.round(phase.expenses.misc * ratio);
            amountToCover -= wantsReduction;
          }
          
          // 2. Reduce Savings down to Savings Floor (10% of net income)
          if (amountToCover > 0) {
            const currentSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
            const savingsFloor = 0.10 * phaseIncome;
            const reducibleSavings = Math.max(0, currentSavings - savingsFloor);
            const savingsReduction = Math.min(amountToCover, reducibleSavings);
            
            if (savingsReduction > 0) {
              const ratio = currentSavings > 0 ? (currentSavings - savingsReduction) / currentSavings : 0;
              Object.keys(phase.savings || {}).forEach(k => {
                phase.savings[k] = Math.round(phase.savings[k] * ratio);
              });
              amountToCover -= savingsReduction;
            }
          }
        }
      }
    }
  }
}

function isAffordableAtPrice(price, level, inputs, activeBuyHouseEv, baselineReadyAge, baselinePhases) {
  const purchaseAge = Number(activeBuyHouseEv.purchaseAge || activeBuyHouseEv.age || 40);

  // Clone inputs
  const tempInputs = JSON.parse(JSON.stringify(inputs));
  
  // Update event price and down payment
  const buyHouseEventIndex = (tempInputs.lifeEvents || []).findIndex(e => e.id === activeBuyHouseEv.id);
  if (buyHouseEventIndex === -1) return false;
  tempInputs.lifeEvents[buyHouseEventIndex] = {
    ...activeBuyHouseEv,
    homePrice: price,
    downPayment: Math.min(activeBuyHouseEv.downPayment || 0, price)
  };
  
  // Apply budget modifications
  if (tempInputs.budgetDetails && tempInputs.budgetDetails.phases) {
    tempInputs.budgetDetails.phases = splitPhasesAtAge(tempInputs.budgetDetails.phases, purchaseAge);
    
    for (const phase of tempInputs.budgetDetails.phases) {
      if (phase.startAge >= purchaseAge && phase.type === 'workSave') {
        const baseP = baselinePhases.find(p => phase.startAge >= p.startAge && phase.startAge < p.endAge);
        const phaseIncome = baseP ? baseP.income : 0;

        const newHousingCost = getHousingCostForPrice(price, tempInputs.lifeEvents[buyHouseEventIndex]);
        
        const currentWants = (Number(phase.expenses.leisure) || 0) + (Number(phase.expenses.diningOut) || 0) + (Number(phase.expenses.misc) || 0);
        const otherBaseExpenses = Object.keys(phase.expenses)
          .filter(k => k !== 'housing' && k !== 'rent' && k !== 'leisure' && k !== 'diningOut' && k !== 'misc')
          .reduce((sum, k) => sum + (Number(phase.expenses[k]) || 0), 0);
        const totalSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
        
        const totalAllocated = newHousingCost + currentWants + totalSavings + otherBaseExpenses;
        const surplus = phaseIncome - totalAllocated;
        
        let amountToCover = Math.max(0, -surplus);
        if (amountToCover > 0) {
          if (level === 'conservative') {
            return false; // No budget changes allowed for Conservative
          }
          
          // 1. Reduce Wants down to Wants Floor
          const wantsFloor = Math.max(250, 0.10 * phaseIncome);
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
            const savingsFloor = level === 'balanced' ? 0.10 * phaseIncome : 0;
            const reducibleSavings = Math.max(0, currentSavings - savingsFloor);
            const savingsReduction = Math.min(amountToCover, reducibleSavings);
            
            if (savingsReduction > 0) {
              const ratio = currentSavings > 0 ? (currentSavings - savingsReduction) / currentSavings : 0;
              Object.keys(phase.savings || {}).forEach(k => {
                phase.savings[k] = Math.round(phase.savings[k] * ratio);
              });
              amountToCover -= savingsReduction;
            }
          }
          
          if (amountToCover > 0) {
            return false; // Deficit not fully covered
          }
        }
      }
    }
  }
  
  // Evaluate simulation results
  const res = runFireSimulation(tempInputs);
  const targetBaselineAge = baselineReadyAge !== null ? baselineReadyAge : (inputs.targetRetirementAge || 65);
  
  if (level === 'balanced') {
    if (res.retirementReadyAge === null) return false;
    if (res.retirementReadyAge > targetBaselineAge + 1) return false;
  } else if (level === 'aggressive') {
    if (res.retirementReadyAge === null || res.retirementReadyAge > (inputs.lifeExpectancy || 85) || !res.moneyLasts) return false;
  }
  
  return true;
}

function isAffordableAtAge(age, level, inputs, activeBuyHouseEv, baselineReadyAge, baselinePhases) {
  const tempInputs = JSON.parse(JSON.stringify(inputs));
  const buyHouseEventIndex = (tempInputs.lifeEvents || []).findIndex(e => e.id === activeBuyHouseEv.id);
  if (buyHouseEventIndex === -1) return false;
  
  tempInputs.lifeEvents[buyHouseEventIndex] = {
    ...activeBuyHouseEv,
    purchaseAge: age,
    age: age
  };
  
  const price = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  return isAffordableAtPrice(price, level, tempInputs, tempInputs.lifeEvents[buyHouseEventIndex], baselineReadyAge, baselinePhases);
}

export function getRebalanceStrategies(inputs, activeBuyHouseEv, baselineReadyAge) {
  if (!activeBuyHouseEv) return null;

  const purchaseAge = Number(activeBuyHouseEv.purchaseAge || activeBuyHouseEv.age || 40);
  const recInputs = JSON.parse(JSON.stringify(inputs));
  
  const normPhases = getNormalizedPhases(recInputs);
  const activePhase = normPhases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
  if (!activePhase) return null;

  // Calculate old housing cost using the getOldRentBeforePurchase helper
  const oldHousingCost = getOldRentBeforePurchase(recInputs, purchaseAge);

  // Calculate original new housing cost
  const p = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  const newHousingCost = getHousingCostForPrice(p, activeBuyHouseEv);
  const monthlyDifference = Math.max(0, newHousingCost - oldHousingCost);

  // Compute surplus in purchase phase to determine deficit
  const currentSurplus = getPhaseSurplus(activePhase, recInputs);
  const houseDeficit = Math.max(0, -currentSurplus);
  if (houseDeficit <= 0) return null;

  // Resolve target baseline ready age
  const resolvedBaselineAge = baselineReadyAge !== undefined ? baselineReadyAge : null;

  // Calculate baseline phases to look up baseline rents and incomes correctly
  const baselineInputs = JSON.parse(JSON.stringify(recInputs));
  baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'buyHouse') {
      return { ...ev, enabled: false };
    }
    return ev;
  });
  const baselinePhases = getNormalizedPhases(baselineInputs);

  // 1. Calculate affordable price for Conservative
  const affordablePriceConservative = getAffordablePriceForLevel('conservative', recInputs, activeBuyHouseEv, resolvedBaselineAge, baselinePhases);
  
  // 2. Calculate affordable price for Balanced
  const affordablePriceBalanced = getAffordablePriceForLevel('balanced', recInputs, activeBuyHouseEv, resolvedBaselineAge, baselinePhases);
  
  // 3. Calculate affordable price for Aggressive
  const affordablePriceAggressive = getAffordablePriceForLevel('aggressive', recInputs, activeBuyHouseEv, resolvedBaselineAge, baselinePhases);

  // 4. Calculate earliest purchase age (up to +5 years) under Balanced model
  let earliestAffordableAge = null;
  for (let age = purchaseAge + 1; age <= purchaseAge + 5; age++) {
    if (isAffordableAtAge(age, 'balanced', recInputs, activeBuyHouseEv, resolvedBaselineAge, baselinePhases)) {
      earliestAffordableAge = age;
      break;
    }
  }

  return {
    purchaseAge,
    oldHousingCost,
    newHousingCost,
    monthlyDifference,
    deficit: houseDeficit,
    currentHomePrice: p,
    affordablePriceConservative,
    affordablePriceBalanced,
    affordablePriceAggressive,
    affordablePaymentConservative: getHousingCostForPrice(affordablePriceConservative, activeBuyHouseEv),
    affordablePaymentBalanced: getHousingCostForPrice(affordablePriceBalanced, activeBuyHouseEv),
    affordablePaymentAggressive: getHousingCostForPrice(affordablePriceAggressive, activeBuyHouseEv),
    earliestAffordableAge
  };
}

function getAffordablePriceForLevel(level, inputs, activeBuyHouseEv, baselineReadyAge, baselinePhases) {
  const p = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  
  let low = 0;
  let high = p;
  let affordablePrice = null;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (isAffordableAtPrice(mid, level, inputs, activeBuyHouseEv, baselineReadyAge, baselinePhases)) {
      affordablePrice = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return affordablePrice;
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
  const price = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  return isAffordableAtPrice(price, 'balanced', recInputs, activeBuyHouseEv, baselineReadyAge, baselinePhases);
}
