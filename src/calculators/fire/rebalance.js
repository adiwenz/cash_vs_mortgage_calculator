import { runFireSimulation, getNormalizedPhases } from '../../fireCalculations';
import { getActiveDebtsForAge } from './debts';
import { calculateUSTaxForModal } from '../../simulatorMathUtils';

export function getRebalanceStrategies(inputs, activeBuyHouseEv, baselineReadyAge) {
  if (!activeBuyHouseEv) return null;

  const purchaseAge = Number(activeBuyHouseEv.purchaseAge || activeBuyHouseEv.age || 40);
  
  // Clone inputs to run simulations
  const recInputs = JSON.parse(JSON.stringify(inputs));
  
  // Get active phase with house
  const normPhases = getNormalizedPhases(recInputs);
  const activePhase = normPhases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
  if (!activePhase) return null;

  // Calculate old housing cost and old surplus from baseline (without house)
  const baselineInputs = JSON.parse(JSON.stringify(recInputs));
  baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'buyHouse') {
      return { ...ev, enabled: false };
    }
    return ev;
  });
  const baselinePhases = getNormalizedPhases(baselineInputs);
  const prePhase = baselinePhases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
  
  let oldHousingCost = 0;
  if (prePhase) {
    oldHousingCost = prePhase.expenses['housing'] || prePhase.expenses['rent'] || 0;
  }

  // Calculate new housing cost
  const p = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  const dp = Number(activeBuyHouseEv.downPayment) || 0;
  const isCash = dp >= p || activeBuyHouseEv.purchaseType === 'cash';
  
  let monthlyPI = 0;
  let loanAmount = 0;
  if (!isCash) {
    const rate = (activeBuyHouseEv.mortgageRate !== undefined ? Number(activeBuyHouseEv.mortgageRate) : 6.5) / 100;
    const mortgageTerm = activeBuyHouseEv.loanTerm !== undefined ? Number(activeBuyHouseEv.loanTerm) : 30;
    loanAmount = Math.max(0, p - dp);
    if (loanAmount > 0 && mortgageTerm > 0) {
      const r = rate / 12;
      const n = mortgageTerm * 12;
      monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
  }

  const propTaxRate = (activeBuyHouseEv.propertyTax !== undefined ? Number(activeBuyHouseEv.propertyTax) : 1.1) / 100;
  const insRate = (activeBuyHouseEv.insurance !== undefined ? Number(activeBuyHouseEv.insurance) : 0.35) / 100;
  const maintRate = (activeBuyHouseEv.maintenance !== undefined ? Number(activeBuyHouseEv.maintenance) : 1.0) / 100;
  
  const monthlyPropTax = (p * propTaxRate) / 12;
  const monthlyIns = (p * insRate) / 12;
  const monthlyMaint = (p * maintRate) / 12;
  const monthlyHoa = Number(activeBuyHouseEv.hoa) || 0;
  const monthlyUtil = Number(activeBuyHouseEv.utilitiesIncrease) || 0;
  
  let monthlyPmi = 0;
  if (!isCash && dp < p * 0.2) {
    const pmiRate = activeBuyHouseEv.pmi !== undefined ? Number(activeBuyHouseEv.pmi) : 0.5;
    monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
  }
  
  const newHousingCost = Math.round(monthlyPI + monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi);
  const monthlyDifference = Math.max(0, newHousingCost - oldHousingCost);

  // Compute surplus before rebalance (with house, but original allocations)
  const currentSurplus = getPhaseSurplus(activePhase, recInputs);

  // If currentSurplus is positive or zero, no rebalance needed
  const houseDeficit = Math.max(0, -currentSurplus);
  if (houseDeficit <= 0) return null;

  // 1. Calculate maximum affordable home price (where deficit becomes 0)
  let low = 0;
  let high = p;
  let affordablePrice = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const def = getDeficitForPrice(mid, recInputs, activeBuyHouseEv, purchaseAge);
    if (def === 0) {
      affordablePrice = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // 2. Calculate earliest purchase age that removes deficit
  let earliestAffordableAge = null;
  const maxSearchAge = Math.min(inputs.lifeExpectancy || 85, 80);
  for (let age = purchaseAge + 1; age <= maxSearchAge; age++) {
    const def = getDeficitForAge(age, recInputs, activeBuyHouseEv);
    if (def === 0) {
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
    affordablePrice,
    affordablePayment: getHousingCostForPrice(affordablePrice, activeBuyHouseEv),
    earliestAffordableAge
  };
}

function getDeficitForPrice(price, inputs, buyHouseEv, purchaseAge) {
  const tempInputs = JSON.parse(JSON.stringify(inputs));
  tempInputs.lifeEvents = (tempInputs.lifeEvents || []).map(ev => {
    if (ev.id === buyHouseEv.id) {
      return {
        ...ev,
        homePrice: price,
        downPayment: Math.min(ev.downPayment || 0, price)
      };
    }
    return ev;
  });
  const normPhases = getNormalizedPhases(tempInputs);
  const activePhase = normPhases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
  if (!activePhase) return 0;
  const surplus = getPhaseSurplus(activePhase, tempInputs);
  return Math.max(0, -surplus);
}

function getDeficitForAge(age, inputs, buyHouseEv) {
  const tempInputs = JSON.parse(JSON.stringify(inputs));
  tempInputs.lifeEvents = (tempInputs.lifeEvents || []).map(ev => {
    if (ev.id === buyHouseEv.id) {
      return {
        ...ev,
        purchaseAge: age,
        age: age
      };
    }
    return ev;
  });
  const normPhases = getNormalizedPhases(tempInputs);
  const activePhase = normPhases.find(p => age >= p.startAge && age < p.endAge);
  if (!activePhase) return 0;
  const surplus = getPhaseSurplus(activePhase, tempInputs);
  return Math.max(0, -surplus);
}

function getHousingCostForPrice(price, buyHouseEv) {
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
