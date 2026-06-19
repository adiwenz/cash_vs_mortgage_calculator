import { runFireSimulation, getNormalizedPhases } from '../../fireCalculations.js';
import { getActiveDebtsForAge } from '../../calculators/fire/debts.js';
import { calculateUSTaxForModal } from '../../simulatorMathUtils.js';
import {
  calculateTotalCashRequired,
  calculateLiquidAssetsAtPurchaseAge,
  calculateCashShortfall,
  calculateCashAffordableHomePrice,
  isCashAffordable,
  getHousingCostForPrice,
  getMonthlyPIForPrice,
  getRequiredDownPaymentAndCosts
} from './houseAffordability.js';

export function getConstraintReasonLabel(constraint) {
  const c = String(constraint).toLowerCase();
  if (c === 'cash' || c === 'upfront cash') return 'Upfront cash';
  if (c === 'monthly' || c === 'monthly budget') return 'Monthly budget';
  if (c === 'retirement' || c === 'retirement impact') return 'Retirement impact';
  if (c === 'both') return 'Both';
  return 'Monthly budget';
}

export function resolveBuyHouseEvent(buyHouseEv, inputs) {
  if (!buyHouseEv) return null;
  const houseAssets = inputs?.houseAssets || [];
  const asset = buyHouseEv.houseId ? houseAssets.find(h => h.id === buyHouseEv.houseId) : null;
  if (asset) {
    return {
      ...buyHouseEv,
      homePrice: buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : asset.homePrice !== undefined ? asset.homePrice : asset.purchasePrice,
      downPayment: buyHouseEv.downPayment !== undefined ? buyHouseEv.downPayment : asset.downPayment,
      purchaseType: buyHouseEv.purchaseType !== undefined ? buyHouseEv.purchaseType : asset.purchaseType,
      mortgageRate: buyHouseEv.mortgageRate !== undefined ? buyHouseEv.mortgageRate : asset.mortgageRate,
      loanTerm: buyHouseEv.loanTerm !== undefined ? buyHouseEv.loanTerm : asset.loanTerm !== undefined ? asset.loanTerm : asset.loanTermYears,
      points: buyHouseEv.points !== undefined ? buyHouseEv.points : asset.points,
      pmi: buyHouseEv.pmi !== undefined ? buyHouseEv.pmi : asset.pmi,
      closingCosts: buyHouseEv.closingCosts !== undefined ? buyHouseEv.closingCosts : asset.closingCosts,
      propertyTax: buyHouseEv.propertyTax !== undefined ? buyHouseEv.propertyTax : asset.propertyTaxRate !== undefined ? asset.propertyTaxRate : asset.propertyTax,
      insurance: buyHouseEv.insurance !== undefined ? buyHouseEv.insurance : asset.insuranceCost !== undefined ? asset.insuranceCost : asset.insurance,
      hoa: buyHouseEv.hoa !== undefined ? buyHouseEv.hoa : asset.hoaCost !== undefined ? asset.hoaCost : asset.hoa,
      maintenance: buyHouseEv.maintenance !== undefined ? buyHouseEv.maintenance : asset.maintenanceRate !== undefined ? asset.maintenanceRate : asset.maintenance,
      renovationCost: buyHouseEv.renovationCost !== undefined ? buyHouseEv.renovationCost : asset.renovationCost,
      utilitiesIncrease: buyHouseEv.utilitiesIncrease !== undefined ? buyHouseEv.utilitiesIncrease : asset.utilitiesIncrease,
      appreciationRate: buyHouseEv.appreciationRate !== undefined ? buyHouseEv.appreciationRate : asset.appreciationRate,
      sellingCost: buyHouseEv.sellingCost !== undefined ? buyHouseEv.sellingCost : asset.sellingCostRate !== undefined ? asset.sellingCostRate : buyHouseEv.sellingCost,
      keepRent: buyHouseEv.keepRent !== undefined ? buyHouseEv.keepRent : asset.keepRent
    };
  }
  return buyHouseEv;
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

export function applyBudgetAdjustmentsForLevel(level, inputs, buyHouseEv, price, originalInputs) {
  const resolvedBuyHouseEv = resolveBuyHouseEvent(buyHouseEv, originalInputs || inputs);
  const purchaseAge = Number(resolvedBuyHouseEv.purchaseAge || resolvedBuyHouseEv.age || 40);
  
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

        const newHousingCost = getHousingCostForPrice(price, resolvedBuyHouseEv);
        
        const currentWants = (Number(phase.expenses.leisure) || 0) + (Number(phase.expenses.diningOut) || 0) + (Number(phase.expenses.misc) || 0);
        const otherBaseExpenses = Object.keys(phase.expenses)
          .filter(k => k !== 'housing' && k !== 'rent' && k !== 'leisure' && k !== 'diningOut' && k !== 'misc')
          .reduce((sum, k) => sum + (Number(phase.expenses[k]) || 0), 0);
        const totalSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
        
        const totalAllocated = newHousingCost + currentWants + totalSavings + otherBaseExpenses;
        const surplus = phaseIncome - totalAllocated;
        
        let amountToCover = Math.max(0, -surplus);
        if (amountToCover > 0) {
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
          
          if (amountToCover > 0) {
            const currentSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
            const savingsFloor = level === 'balanced' ? currentSavings : 0;
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
    const wantsFloor = Math.max(250, 0.10 * netMonthlyIncome);
    const reducibleWants = Math.max(0, currentWants - wantsFloor);
    wantsReduction = Math.min(amountToCover, reducibleWants);
    amountToCover -= wantsReduction;

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

function getAvailableTotalAssetsBeforePurchase(baselineResults, purchaseAge, inputs) {
  const logBefore = baselineResults && baselineResults.nominalData ? baselineResults.nominalData.find(l => l.age === purchaseAge - 1) : null;
  if (logBefore) {
    const cash = Number(logBefore.cashBalance) || 0;
    const brokerage = Number(logBefore.brokerageBalance) || 0;
    const emergencyFund = Number(logBefore.emergencyFundBalance) || 0;
    const trad401k = Number(logBefore.trad401kBalance) || 0;
    const tradIra = Number(logBefore.tradIraBalance) || 0;
    const rothIra = Number(logBefore.rothIraBalance) || 0;
    const hsa = Number(logBefore.hsaBalance) || 0;
    const other = Number(logBefore.otherBalance) || 0;
    return cash + brokerage + emergencyFund + trad401k + tradIra + rothIra + hsa + other;
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
         (Number(assets.trad401k) || 0) +
         (Number(assets.tradIra) || 0) +
         (Number(assets.rothIra) || 0) +
         (Number(assets.hsa) || 0) +
         (Number(assets.other) || 0) +
         customCheckingSavings +
         customBrokerage;
}

export function getSimulationValidationForPrice(price, level, inputs, buyHouseEv, baselineReadyAge, originalInputs, baselinePhases, baselineResults) {
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

  let isValid = false;
  if (level === 'conservative') {
    isValid = price > 0 && monthlyHousing <= conservativeMaxPayment;
  } else if (level === 'balanced') {
    isValid = price > 0 && monthlyHousing <= balancedMaxPayment;
  } else if (level === 'stretch' || level === 'aggressive') {
    isValid = price > 0 && monthlyHousing <= aggressiveMaxPayment;
  }

  const tempInputs = JSON.parse(JSON.stringify(inputs));
  const resolvedBuyHouseEv = resolveBuyHouseEvent(buyHouseEv, inputs);
  const buyHouseEventIndex = (tempInputs.lifeEvents || []).findIndex(e => e.id === resolvedBuyHouseEv.id);
  if (buyHouseEventIndex !== -1) {
    const originalPrice = Number(resolvedBuyHouseEv.homePrice !== undefined ? resolvedBuyHouseEv.homePrice : (resolvedBuyHouseEv.purchasePrice !== undefined ? resolvedBuyHouseEv.purchasePrice : 0)) || 0;
    let dp = resolvedBuyHouseEv.downPayment || 0;
    if (originalPrice > 0 && resolvedBuyHouseEv.purchaseType !== 'cash') {
      const ratio = (resolvedBuyHouseEv.downPayment || 0) / originalPrice;
      dp = price * ratio;
    }
    dp = Math.min(dp, price);

    tempInputs.lifeEvents[buyHouseEventIndex] = {
      ...resolvedBuyHouseEv,
      homePrice: price,
      purchasePrice: price,
      downPayment: dp
    };

    if (resolvedBuyHouseEv.houseId && tempInputs.houseAssets) {
      tempInputs.houseAssets = tempInputs.houseAssets.map(h => {
        if (h.id === resolvedBuyHouseEv.houseId) {
          return {
            ...h,
            homePrice: price,
            purchasePrice: price,
            downPayment: dp
          };
        }
        return h;
      });
    }

    if (tempInputs.debtList) {
      tempInputs.debtList = tempInputs.debtList.map(d => {
        if (d.houseId === resolvedBuyHouseEv.houseId || d.id === `mortgage-${resolvedBuyHouseEv.houseId}`) {
          const principal = Math.max(0, price - dp);
          
          let rateFraction = (Number(resolvedBuyHouseEv.mortgageRate) || 6.5) / 100 / 12;
          let totalMonths = (Number(resolvedBuyHouseEv.loanTerm) || Number(resolvedBuyHouseEv.loanTermYears) || 30) * 12;
          let monthlyPayment;
          if (rateFraction === 0) {
            monthlyPayment = principal / totalMonths;
          } else {
            monthlyPayment = principal * (rateFraction * Math.pow(1 + rateFraction, totalMonths)) / (Math.pow(1 + rateFraction, totalMonths) - 1);
          }
          
          return {
            ...d,
            balance: principal,
            payment: Math.round(monthlyPayment)
          };
        }
        return d;
      });
    }

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

export function solveBisectionHomeValue(level, inputs, buyHouseEv, baselineReadyAge, baselineResults) {
  const current_age = Number(inputs.currentAge || 35);
  const purchase_age = Number(buyHouseEv.purchaseAge || buyHouseEv.age || 40);
  const original_retirement_age = Number(baselineReadyAge !== null && baselineReadyAge !== undefined ? baselineReadyAge : (inputs.targetRetirementAge || 65));
  
  let target_retirement_age = original_retirement_age;
  if (level === 'balanced') {
    target_retirement_age = original_retirement_age + 3;
  } else if (level === 'stretch' || level === 'aggressive') {
    target_retirement_age = Number(inputs.lifeExpectancy || 85);
  }
  
  const years_to_retire = Math.max(0, target_retirement_age - purchase_age);
  
  const investment_growth_rate_annual = (inputs.expectedReturn !== undefined ? Number(inputs.expectedReturn) : 7.0) / 100;
  const r = investment_growth_rate_annual / 12;
  
  const inflation_rate_annual = (inputs.inflationRate !== undefined ? Number(inputs.inflationRate) : 3.0) / 100;
  
  const mortgage_interest_rate_annual = (buyHouseEv.mortgageRate !== undefined ? Number(buyHouseEv.mortgageRate) : 6.5) / 100;
  const i = mortgage_interest_rate_annual / 12;
  
  const mortgage_term_months = (buyHouseEv.loanTerm !== undefined ? Number(buyHouseEv.loanTerm) : 30) * 12;
  
  const originalPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
  let down_payment_percent = 0.10;
  if (buyHouseEv.purchaseType === 'cash') {
    down_payment_percent = 1.0;
  } else if (originalPrice > 0 && buyHouseEv.downPayment !== undefined) {
    down_payment_percent = buyHouseEv.downPayment / originalPrice;
  }
  
  const phases = getNormalizedPhases(inputs);
  const prePurchasePhase = phases.find(p => (purchase_age - 1) >= p.startAge && (purchase_age - 1) < p.endAge) || phases[0];
  
  const current_housing = getOldRentBeforePurchase(inputs, purchase_age);
  
  const current_savings = prePurchasePhase
    ? Object.values(prePurchasePhase.savings || {}).reduce((sum, val) => sum + (Number(val) || 0), 0)
    : Object.values(inputs.budgetDetails?.savings || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
  
  const allExpenses = prePurchasePhase
    ? Object.values(prePurchasePhase.expenses || {})
    : Object.values(inputs.budgetDetails?.expenses || {});
  const total_current_expenses = allExpenses.reduce((sum, val) => sum + (Number(val) || 0), 0);
  const core_living_expenses = total_current_expenses - current_housing;
  
  const leisure = prePurchasePhase
    ? Number(prePurchasePhase.expenses?.leisure || 0)
    : Number(inputs.budgetDetails?.expenses?.leisure || 0);
  const diningOut = prePurchasePhase
    ? Number(prePurchasePhase.expenses?.diningOut || 0)
    : Number(inputs.budgetDetails?.expenses?.diningOut || 0);
  const misc = prePurchasePhase
    ? Number(prePurchasePhase.expenses?.misc || 0)
    : Number(inputs.budgetDetails?.expenses?.misc || 0);
  const current_wants = leisure + diningOut + misc;
  
  const phaseIncome = prePurchasePhase ? prePurchasePhase.income : (Number(inputs.simpleIncome || 50000) / 12);
  
  const taxes = inputs.includeTaxes ? Math.round(calculateUSTaxForModal(phaseIncome * 12 || 0, 0, inputs.filingStatus || 'single') / 12) : 0;
  const net_monthly_income = phaseIncome - taxes;
  
  const wants_floor = Math.max(250, 0.10 * net_monthly_income);
  const savings_floor = 0.10 * net_monthly_income;
  
  const current_surplus = net_monthly_income - total_current_expenses - current_savings;
  
  const emergencySurplusFloor = 100;
  let total_housing_pool = current_housing;
  if (level === 'conservative') {
    total_housing_pool = Math.max(0, current_housing + Math.max(0, current_surplus) - emergencySurplusFloor);
  } else if (level === 'balanced') {
    const wants_capacity = Math.max(0, current_wants - wants_floor);
    total_housing_pool = Math.max(0, current_housing + Math.max(0, current_surplus) + wants_capacity - emergencySurplusFloor);
  } else if (level === 'stretch' || level === 'aggressive') {
    const wants_capacity = Math.max(0, current_wants - wants_floor);
    total_housing_pool = Math.max(0, current_housing + Math.max(0, current_surplus) + wants_capacity + current_savings - emergencySurplusFloor);
  }
  
  const initial_portfolio = getAvailableTotalAssetsBeforePurchase(baselineResults, purchase_age, inputs);
  
  let low_V = 0;
  let high_V = 10000000;
  const minHomePriceFloor = 50000;
  
  const N = years_to_retire * 12;
  const compounding_factor = Math.pow(1 + r, N);
  
  const years = target_retirement_age - purchase_age;
  const r_annual = investment_growth_rate_annual;
  const g_annual = inflation_rate_annual;
  let savings_compounding_annual = 0;
  if (Math.abs(r_annual - g_annual) < 0.0001) {
    savings_compounding_annual = years * Math.pow(1 + r_annual, years - 1);
  } else {
    savings_compounding_annual = (Math.pow(1 + r_annual, years) - Math.pow(1 + g_annual, years)) / (r_annual - g_annual);
  }
  
  const retireEv = (inputs.lifeEvents || []).find(e => e.type === 'retire' && e.enabled !== false);
  const retirementSpendingPercent = (retireEv?.spendingPercent !== undefined ? Number(retireEv.spendingPercent) : 70) / 100;
  
  const enableHealthcareModel = inputs.enableHealthcareModel !== false;
  const preMedicarePremium = inputs.preMedicarePremium !== undefined ? Number(inputs.preMedicarePremium) : 10000;
  const medicarePremium = inputs.medicarePremium !== undefined ? Number(inputs.medicarePremium) : 4000;
  const swr = (inputs.swr !== undefined ? Number(inputs.swr) : 4.0) / 100;
  
  let nominalActiveSS = 0;
  let ssBridgeCost = 0;
  
  const ss_details = baselineResults?.socialSecurityDetails || { monthlyBenefit: 0, claimAge: 67 };
  const ssClaimAge = ss_details.claimAge || 67;
  let ssAnnualAmt = (ss_details.monthlyBenefit || 0) * 12;
  ssAnnualAmt = ssAnnualAmt * Math.pow(1 + inflation_rate_annual, target_retirement_age - current_age);
  nominalActiveSS += ssAnnualAmt;
  if (target_retirement_age < ssClaimAge) {
    ssBridgeCost += ssAnnualAmt * (ssClaimAge - target_retirement_age);
  }
  
  (inputs.lifeEvents || []).forEach(ev => {
    if (ev.enabled !== false && ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
      if (ev.type !== 'socialSecurity') {
        const claimAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 67;
        let annualAmt = Number(ev.monthlyBenefit || ev.amount || 0) * 12;
        if (ev.inflationAdjusted) {
          annualAmt = annualAmt * Math.pow(1 + inflation_rate_annual, target_retirement_age - current_age);
        }
        nominalActiveSS += annualAmt;
        if (target_retirement_age < claimAge) {
          ssBridgeCost += annualAmt * (claimAge - target_retirement_age);
        }
      }
    }
  });
  
  const other_base_expenses = total_current_expenses - current_housing - current_wants;
  const retirement_core_monthly_zero = (other_base_expenses + current_wants) * retirementSpendingPercent;
  const healthcare_premium_monthly_zero = (target_retirement_age < 65 ? preMedicarePremium : medicarePremium) / 12;
  let retirement_monthly_zero = retirement_core_monthly_zero;
  if (enableHealthcareModel) {
    retirement_monthly_zero += healthcare_premium_monthly_zero;
  }
  const retirement_monthly_inflated_zero = retirement_monthly_zero * Math.pow(1 + inflation_rate_annual, target_retirement_age - current_age);
  const F_zero = Math.max(0, retirement_monthly_inflated_zero * 12 - nominalActiveSS) / swr + ssBridgeCost;
  const portfolio_at_target_zero = initial_portfolio * compounding_factor + (current_savings * 12) * savings_compounding_annual;
  
  if (portfolio_at_target_zero < F_zero) {
    return {
      bestPrice: minHomePriceFloor,
      bestVal: {
        isValid: false,
        monthlySurplus: 0,
        savingsRate: 0,
        retirementReadyAge: null,
        baselineReadyAge: original_retirement_age,
        sustainable: false
      },
      error: 'Portfolio compounding alone is insufficient to support inflated baseline expenses.'
    };
  }
  
  const propTaxRate = (buyHouseEv.propertyTax !== undefined ? Number(buyHouseEv.propertyTax) : 1.1) / 100;
  const insRate = (buyHouseEv.insurance !== undefined ? Number(buyHouseEv.insurance) : 0.35) / 100;
  const maintRate = (buyHouseEv.maintenance !== undefined ? Number(buyHouseEv.maintenance) : 1.0) / 100;
  const annual_overhead_rate = propTaxRate + insRate + maintRate;
  
  const hoa = Number(buyHouseEv.hoa) || 0;
  const utilitiesIncrease = Number(buyHouseEv.utilitiesIncrease) || 0;
  
  const mortgage_factor = i === 0 ? 1 / mortgage_term_months : (i * Math.pow(1 + i, mortgage_term_months)) / (Math.pow(1 + i, mortgage_term_months) - 1);
  
  for (let step_idx = 0; step_idx < 100; step_idx++) {
    const V = (low_V + high_V) / 2;
    
    const annual_maint_tax_ins = V * annual_overhead_rate;
    const monthly_overhead = annual_maint_tax_ins / 12 + hoa + utilitiesIncrease;
    
    const M = total_housing_pool - monthly_overhead;
    if (M <= 0) {
      high_V = V;
      continue;
    }
    
    const required_PI = V * (1 - down_payment_percent) * mortgage_factor;
    if (required_PI > M) {
      high_V = V;
      continue;
    }
    
    const new_housing_cost = required_PI + monthly_overhead;
    const total_allocated = new_housing_cost + current_savings + core_living_expenses;
    const surplus = phaseIncome - total_allocated;
    let amount_to_cover = Math.max(0, -surplus);
    
    let wants_reduction = 0;
    let savings_reduction = 0;
    
    if (level !== 'conservative' && amount_to_cover > 0) {
      const wants_capacity = Math.max(0, current_wants - wants_floor);
      wants_reduction = Math.min(amount_to_cover, wants_capacity);
      amount_to_cover -= wants_reduction;
      
      if (amount_to_cover > 0) {
        const savings_capacity = level === 'balanced'
          ? Math.max(0, current_savings - savings_floor)
          : current_savings;
        savings_reduction = Math.min(amount_to_cover, savings_capacity);
      }
    }
    
    const post_purchase_savings = Math.max(0, current_savings - savings_reduction);
    const new_wants = current_wants - wants_reduction;
    
    const portfolio_at_target = initial_portfolio * compounding_factor + (post_purchase_savings * 12) * savings_compounding_annual;
    
    const mortgage_in_retirement = (target_retirement_age < purchase_age + 30) ? required_PI * 12 : 0;
    const housing_in_retirement = annual_maint_tax_ins + mortgage_in_retirement;
    const retirement_core_monthly = (other_base_expenses + new_wants) * retirementSpendingPercent;
    const retirement_housing_monthly = (housing_in_retirement / 12) * retirementSpendingPercent;
    let retirement_monthly = retirement_core_monthly + retirement_housing_monthly;
    if (enableHealthcareModel) {
      retirement_monthly += (target_retirement_age < 65 ? preMedicarePremium : medicarePremium) / 12;
    }
    
    const retirement_monthly_inflated = retirement_monthly * Math.pow(1 + inflation_rate_annual, target_retirement_age - current_age);
    const F = Math.max(0, retirement_monthly_inflated * 12 - nominalActiveSS) / swr + ssBridgeCost;
    
    if (portfolio_at_target >= F) {
      low_V = V;
    } else {
      high_V = V;
    }
  }
  
  const retirementSustainablePrice = Math.max(minHomePriceFloor, low_V);
  
  const closingCostsRate = buyHouseEv.closingCosts !== undefined ? Number(buyHouseEv.closingCosts) : 3;
  const closingCostPercent = closingCostsRate / 100;
  const points = Number(buyHouseEv.points) || 0;
  const renovationCosts = Number(buyHouseEv.renovationCost) || Number(buyHouseEv.renovationCosts) || 0;
  const movingCosts = Number(buyHouseEv.movingCost) || Number(buyHouseEv.movingCosts) || 0;
  const fixedUpfrontCosts = points + renovationCosts + movingCosts;

  const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchase_age, baselineResults);

  const cashAffordablePrice = calculateCashAffordableHomePrice({
    liquidAssets,
    downPaymentPercent: down_payment_percent,
    closingCostPercent,
    fixedUpfrontCosts
  });

  let bestPrice = Math.max(0, Math.min(retirementSustainablePrice, cashAffordablePrice));

  const getDownPaymentForTempPrice = (pr) => {
    if (buyHouseEv.purchaseType === 'cash') {
      return pr;
    }
    const oPrice = Number(buyHouseEv.homePrice !== undefined ? buyHouseEv.homePrice : (buyHouseEv.purchasePrice !== undefined ? buyHouseEv.purchasePrice : 0)) || 0;
    let dp = buyHouseEv.downPayment || 0;
    if (oPrice > 0) {
      const ratio = (buyHouseEv.downPayment || 0) / oPrice;
      dp = pr * ratio;
    }
    return Math.min(dp, pr);
  };

  let validationPrice = bestPrice;
  let tempEvent = {
    ...buyHouseEv,
    homePrice: validationPrice,
    downPayment: getDownPaymentForTempPrice(validationPrice)
  };
  while (validationPrice > 0 && !isCashAffordable(tempEvent, liquidAssets)) {
    validationPrice -= 100;
    if (validationPrice < 0) validationPrice = 0;
    tempEvent = {
      ...buyHouseEv,
      homePrice: validationPrice,
      downPayment: getDownPaymentForTempPrice(validationPrice)
    };
  }
  bestPrice = validationPrice;

  const cashLimited = bestPrice >= cashAffordablePrice - 1;
  const monthlyLimited = bestPrice >= retirementSustainablePrice - 1;
  const limitingFactor = (cashLimited && monthlyLimited) ? 'both' : cashLimited ? 'cash' : 'monthly';

  const annual_maint_tax_ins = bestPrice * annual_overhead_rate;
  const monthly_overhead = annual_maint_tax_ins / 12 + hoa + utilitiesIncrease;
  const M = total_housing_pool - monthly_overhead;
  const required_PI = bestPrice * (1 - down_payment_percent) * mortgage_factor;
  
  const final_new_housing_cost = required_PI + monthly_overhead;
  const final_total_allocated = final_new_housing_cost + current_savings + core_living_expenses;
  const final_surplus = phaseIncome - final_total_allocated;
  let final_amount_to_cover = Math.max(0, -final_surplus);
  
  let final_wants_reduction = 0;
  let final_savings_reduction = 0;
  if (level !== 'conservative' && final_amount_to_cover > 0) {
    const wants_capacity = Math.max(0, current_wants - wants_floor);
    final_wants_reduction = Math.min(final_amount_to_cover, wants_capacity);
    final_amount_to_cover -= final_wants_reduction;
    
    if (final_amount_to_cover > 0) {
      const savings_capacity = level === 'balanced'
        ? Math.max(0, current_savings - savings_floor)
        : current_savings;
      final_savings_reduction = Math.min(final_amount_to_cover, savings_capacity);
    }
  }
  const final_post_purchase_savings = Math.max(0, current_savings - final_savings_reduction);

  return {
    bestPrice,
    limitingFactor,
    bestVal: {
      isValid: bestPrice > minHomePriceFloor,
      monthlySurplus: Math.max(0, Math.round(M - required_PI)),
      savingsRate: phaseIncome > 0 ? final_post_purchase_savings / phaseIncome : 0,
      retirementReadyAge: target_retirement_age,
      baselineReadyAge: original_retirement_age,
      sustainable: true
    }
  };
}

export function getRebalanceStrategies(inputs, activeBuyHouseEv, baselineReadyAge) {
  if (!activeBuyHouseEv) return null;

  const resolvedBuyHouseEv = resolveBuyHouseEvent(activeBuyHouseEv, inputs);
  const purchaseAge = Number(resolvedBuyHouseEv.purchaseAge || resolvedBuyHouseEv.age || 40);
  const recInputs = JSON.parse(JSON.stringify(inputs));
  
  const normPhases = getNormalizedPhases(recInputs);
  const activePhase = normPhases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
  if (!activePhase) return null;

  const oldHousingCost = getOldRentBeforePurchase(recInputs, purchaseAge);

  const p = Number(resolvedBuyHouseEv.homePrice !== undefined ? resolvedBuyHouseEv.homePrice : (resolvedBuyHouseEv.purchasePrice !== undefined ? resolvedBuyHouseEv.purchasePrice : 0)) || 0;
  const newHousingCost = getHousingCostForPrice(p, resolvedBuyHouseEv);
  const monthlyDifference = Math.max(0, newHousingCost - oldHousingCost);

  const currentSurplusRaw = getPhaseSurplus(activePhase, recInputs);
  const houseDeficit = Math.max(0, -currentSurplusRaw);
  if (houseDeficit <= 0) return null;

  const baselineInputs = JSON.parse(JSON.stringify(recInputs));
  baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'buyHouse') {
      return { ...ev, enabled: false };
    }
    return ev;
  });
  const baselinePhases = getNormalizedPhases(baselineInputs);
  const baselineResults = runFireSimulation(baselineInputs);

  const resolvedBaselineAge = (baselineReadyAge !== null && baselineReadyAge !== undefined)
    ? baselineReadyAge
    : (baselineResults.retirementReadyAge !== null && baselineResults.retirementReadyAge !== undefined
        ? baselineResults.retirementReadyAge
        : (inputs.targetRetirementAge || 65));

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

  const sweepCons = solveBisectionHomeValue('conservative', recInputs, activeBuyHouseEv, resolvedBaselineAge, baselineResults);
  const sweepBal = solveBisectionHomeValue('balanced', recInputs, activeBuyHouseEv, resolvedBaselineAge, baselineResults);
  const sweepStretch = solveBisectionHomeValue('stretch', recInputs, activeBuyHouseEv, resolvedBaselineAge, baselineResults);

  const priceConservative = sweepCons.bestPrice;
  const priceBalanced = sweepBal.bestPrice;
  const priceStretch = sweepStretch.bestPrice;

  const valConservative = sweepCons.bestVal;
  const valBalanced = sweepBal.bestVal;
  const valStretch = sweepStretch.bestVal;

  const adjConservative = getBudgetAdjustmentsForPrice(priceConservative, 'conservative', activeBuyHouseEv, basePhase, netMonthlyIncome, currentSurplus);
  const adjBalanced = getBudgetAdjustmentsForPrice(priceBalanced, 'balanced', activeBuyHouseEv, basePhase, netMonthlyIncome, currentSurplus);
  const adjStretch = getBudgetAdjustmentsForPrice(priceStretch, 'stretch', activeBuyHouseEv, basePhase, netMonthlyIncome, currentSurplus);

  const piConservative = Math.round(getMonthlyPIForPrice(priceConservative, activeBuyHouseEv));
  const piBalanced = Math.round(getMonthlyPIForPrice(priceBalanced, activeBuyHouseEv));
  const piAggressive = Math.round(getMonthlyPIForPrice(priceStretch, activeBuyHouseEv));

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
    selectedAffordablePrice = null;
    selectedOption = 'none';
    selectedRetirementDelay = 0;
  }

  let constraint = 'monthly';
  if (selectedOption === 'balanced') {
    constraint = sweepBal.limitingFactor || 'monthly';
  } else if (selectedOption === 'conservative') {
    constraint = sweepCons.limitingFactor || 'monthly';
  } else if (selectedOption === 'aggressive') {
    constraint = sweepStretch.limitingFactor || 'monthly';
  }

  const remainingBalancedDeficit = Math.max(0, newHousingCost - balancedMaxPayment);

  const earliestAffordableAge = null;

  const baselineRetirementAge = resolvedBaselineAge !== null && resolvedBaselineAge !== undefined
    ? resolvedBaselineAge
    : (valBalanced.baselineReadyAge !== undefined ? valBalanced.baselineReadyAge : (inputs.targetRetirementAge || 65));

  const maxHomePriceBalanced = Math.max(0, availableHomeFundsBalanced - movingCosts) / (targetDownPaymentPercent + closingCostsRate / 100);

  const totalCashNeeded = getRequiredDownPaymentAndCosts(p, resolvedBuyHouseEv);

  const getDownPaymentForPrice = (pr) => {
    const originalPrice = Number(resolvedBuyHouseEv.homePrice !== undefined ? resolvedBuyHouseEv.homePrice : (resolvedBuyHouseEv.purchasePrice !== undefined ? resolvedBuyHouseEv.purchasePrice : 0)) || 0;
    let dp = resolvedBuyHouseEv.downPayment || 0;
    if (originalPrice > 0 && resolvedBuyHouseEv.purchaseType !== 'cash') {
      const ratio = (resolvedBuyHouseEv.downPayment || 0) / originalPrice;
      dp = pr * ratio;
    }
    return Math.min(dp, pr);
  };

  const dpConservative = Math.round(getDownPaymentForPrice(priceConservative));
  const dpBalanced = Math.round(getDownPaymentForPrice(priceBalanced));
  const dpStretch = Math.round(getDownPaymentForPrice(priceStretch));

  const isConservativeValid = p > 0 && getHousingCostForPrice(p, resolvedBuyHouseEv) <= conservativeMaxPayment;
  const isBalancedValid = p > 0 && getHousingCostForPrice(p, resolvedBuyHouseEv) <= balancedMaxPayment;
  const isAggressiveValid = p > 0 && getHousingCostForPrice(p, resolvedBuyHouseEv) <= aggressiveMaxPayment;

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
    
    isConservativeValid,
    isBalancedValid,
    isAggressiveValid,

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
    
    affordablePaymentConservative: getHousingCostForPrice(priceConservative, resolvedBuyHouseEv),
    affordablePaymentBalanced: getHousingCostForPrice(priceBalanced, resolvedBuyHouseEv),
    affordablePaymentAggressive: getHousingCostForPrice(priceStretch, resolvedBuyHouseEv),
    totalCashNeededConservative: getRequiredDownPaymentAndCosts(priceConservative, resolvedBuyHouseEv),
    totalCashNeededBalanced: getRequiredDownPaymentAndCosts(priceBalanced, resolvedBuyHouseEv),
    totalCashNeededAggressive: getRequiredDownPaymentAndCosts(priceStretch, resolvedBuyHouseEv),
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
    piAggressive,
    constraint
  };
}

export function isHouseAffordableBalanced(inputs, activeBuyHouseEv, baselineReadyAge) {
  const recInputs = JSON.parse(JSON.stringify(inputs));
  const resolvedBuyHouseEv = resolveBuyHouseEvent(activeBuyHouseEv, inputs);
  
  const baselineInputs = JSON.parse(JSON.stringify(recInputs));
  baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
    if (ev.type === 'buyHouse') {
      return { ...ev, enabled: false };
    }
    return ev;
  });
  const baselinePhases = getNormalizedPhases(baselineInputs);
  const baselineResults = runFireSimulation(baselineInputs);
  const price = Number(resolvedBuyHouseEv.homePrice !== undefined ? resolvedBuyHouseEv.homePrice : (resolvedBuyHouseEv.purchasePrice !== undefined ? resolvedBuyHouseEv.purchasePrice : 0)) || 0;

  const rebalanceData = getRebalanceStrategies(inputs, resolvedBuyHouseEv, baselineReadyAge);
  if (!rebalanceData) {
    return {
      monthlyAffordable: false,
      retirementValid: false,
      downPaymentGap: 0
    };
  }

  const val = getSimulationValidationForPrice(price, 'balanced', recInputs, resolvedBuyHouseEv, baselineReadyAge, inputs, baselinePhases, baselineResults);

  const monthlyAffordable = price <= rebalanceData.affordablePriceBalanced;
  const retirementValid = val.retirementReadyAge !== null && val.retirementAgeImpact <= 3 && val.sustainable;
  const requiredDownPayment = getRequiredDownPaymentAndCosts(price, resolvedBuyHouseEv);
  const downPaymentGap = Math.max(0, requiredDownPayment - rebalanceData.liquidFundsAvailable);

  return {
    monthlyAffordable,
    retirementValid,
    downPaymentGap
  };
}
