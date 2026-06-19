import { runFireSimulation } from '../../../../fireCalculations.js';
import { derivePhasesFromEvents } from '../../../../calculators/fire/phases.js';
import { getRebalanceStrategies } from '../../../../calculators/fire/rebalance.js';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall 
} from '../../../../components/fire-simulator/houseAffordabilityUtils.js';
import { 
  cloneInputs, 
  createStandardResult, 
  normalizeEventAge, 
  normalizeCurrency, 
  normalizePercent 
} from './eventHandlerUtils.js';

export const houseEventHandler = {
  edit(baseEvent, inputs) {
    if (!baseEvent) return null;
    
    if (baseEvent.type === 'buyHouse') {
      const asset = inputs.houseAssets?.find(h => h.id === baseEvent.houseId);
      return {
        ...baseEvent,
        ...asset,
        homePrice: asset ? asset.purchasePrice : 500000,
        downPayment: asset ? asset.downPayment : 100000,
        mortgageRate: asset ? asset.mortgageRate : 6.5,
        loanTerm: asset ? asset.loanTermYears : 30,
        appreciationRate: asset ? asset.appreciationRate : 3.0,
        sellingCost: asset ? asset.sellingCostRate : 6,
        purchaseAge: baseEvent.purchaseAge || baseEvent.age,
        type: 'buyHouse'
      };
    }
    
    return { ...baseEvent };
  },

  save(editingEvent, inputs, scenarios, currentScenarioId, options = {}) {
    const newInputs = cloneInputs(inputs);
    const type = editingEvent.type;
    const isRecommendationApplied = options.isRecommendationApplied === true;

    let savedEvent = null;
    const result = createStandardResult(newInputs);

    if (type === 'buyHouse') {
      const houseId = editingEvent.houseId || `house-${Date.now()}`;
      
      const homePrice = normalizeCurrency(editingEvent.homePrice, 500000);
      const downPayment = normalizeCurrency(editingEvent.downPayment, 100000);
      const mortgageRate = normalizePercent(editingEvent.mortgageRate, 6.5);
      const loanTerm = normalizeEventAge(editingEvent.loanTerm, 30);
      const appreciationRate = normalizePercent(editingEvent.appreciationRate, 3.0);
      const sellingCost = normalizePercent(editingEvent.sellingCost, 6.0);
      const purchaseAge = normalizeEventAge(editingEvent.purchaseAge || editingEvent.age, 35);
      
      const houseAssetObj = {
        id: houseId,
        name: editingEvent.name || 'Primary Home',
        purchasePrice: homePrice,
        downPayment: downPayment,
        purchaseType: editingEvent.purchaseType || 'mortgage',
        mortgageRate: mortgageRate,
        loanTermYears: loanTerm,
        points: normalizePercent(editingEvent.points, 0),
        pmi: normalizePercent(editingEvent.pmi, 0.5),
        closingCosts: normalizePercent(editingEvent.closingCosts, 3),
        propertyTaxRate: normalizePercent(editingEvent.propertyTax, 1.1),
        insuranceCost: normalizePercent(editingEvent.insurance, 0.35),
        hoaCost: normalizeCurrency(editingEvent.hoa, 0),
        utilitiesIncrease: normalizeCurrency(editingEvent.utilitiesIncrease, 0),
        appreciationRate: appreciationRate,
        sellingCostRate: sellingCost,
        maintenanceRate: normalizePercent(editingEvent.maintenance, 1.0),
        renovationCost: normalizeCurrency(editingEvent.renovationCost, 0),
        investmentReturn: normalizePercent(editingEvent.investmentReturn, 7),
        inflation: normalizePercent(editingEvent.inflation, 3),
        currentRent: normalizeCurrency(editingEvent.currentRent, 0),
        rentGrowth: normalizePercent(editingEvent.rentGrowth, 3),
        renterInsurance: normalizeCurrency(editingEvent.renterInsurance, 0),
        keepRent: editingEvent.keepRent === true
      };

      if (!newInputs.houseAssets) {
        newInputs.houseAssets = [];
      }
      newInputs.houseAssets = newInputs.houseAssets.filter(h => h.id !== houseId);
      newInputs.houseAssets.push(houseAssetObj);

      const buyEvId = editingEvent.id && editingEvent.id.startsWith('buy-') ? editingEvent.id : `buy-${Date.now()}`;
      const buyEvObj = {
        id: buyEvId,
        type: 'buyHouse',
        enabled: true,
        name: 'Buy House',
        purchaseAge: purchaseAge,
        age: purchaseAge,
        houseId: houseId,
        keepRent: editingEvent.keepRent === true
      };

      const existingSell = newInputs.lifeEvents?.find(e => e.type === 'sellHouse' && e.houseId === houseId);
      let defaultSellAge = normalizeEventAge(newInputs.lifeExpectancy, 85);
      if (defaultSellAge <= purchaseAge) {
        defaultSellAge = purchaseAge + 10;
      }

      const sellEvObj = existingSell ? {
        ...existingSell,
        age: Number(existingSell.age) <= purchaseAge ? purchaseAge + 10 : Number(existingSell.age),
        sellingCost: sellingCost
      } : {
        id: `sell-${Date.now()}`,
        type: 'sellHouse',
        enabled: true,
        name: 'Sell House',
        age: defaultSellAge,
        houseId: houseId,
        sellingCost: sellingCost,
        proceedsDestination: 'investments'
      };

      if (!newInputs.lifeEvents) {
        newInputs.lifeEvents = [];
      }
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== buyEvId && e.id !== sellEvObj.id && e.id !== editingEvent.id);
      newInputs.lifeEvents.push(buyEvObj, sellEvObj);
      
      savedEvent = buyEvObj;

      // Simulation side effects and rebalancing
      const currentScenObj = scenarios?.find(s => s.id === currentScenarioId) || scenarios?.[0];
      const beforeRes = currentScenObj ? runFireSimulation(currentScenObj.inputs) : runFireSimulation(inputs);
      const beforeReadyAge = beforeRes.retirementReadyAge;

      const phases = derivePhasesFromEvents(newInputs, newInputs.lifeEvents, newInputs.budgetDetails?.phases || []);
      const activePhase = phases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
      let localHouseDeficit = 0;
      if (activePhase) {
        const totalExpenses = Object.values(activePhase.expenses || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const totalIncome = Number(activePhase.income) || 0;
        if (totalIncome - totalExpenses < 0) {
          localHouseDeficit = Math.abs(totalIncome - totalExpenses);
        }
      }

      // Calculate old housing cost
      const baselineInputs = cloneInputs(newInputs);
      baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
        if (ev.type === 'buyHouse') {
          return { ...ev, enabled: false };
        }
        return ev;
      });
      const phasesWithoutHouse = derivePhasesFromEvents(baselineInputs, baselineInputs.lifeEvents, baselineInputs.budgetDetails?.phases || []);
      const prePhase = phasesWithoutHouse.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
      
      let oldHousingCost = 0;
      if (prePhase) {
        oldHousingCost = prePhase.expenses['housing'] || prePhase.expenses['rent'] || 0;
      }

      // Calculate new housing cost
      const isCash = downPayment >= homePrice || editingEvent.purchaseType === 'cash';
      let monthlyPI = 0;
      let loanAmount = 0;
      if (!isCash) {
        const rate = mortgageRate / 100;
        loanAmount = Math.max(0, homePrice - downPayment);
        if (loanAmount > 0 && loanTerm > 0) {
          const r = rate / 12;
          const n = loanTerm * 12;
          monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        }
      }

      const propTaxRate = (editingEvent.propertyTax !== undefined ? Number(editingEvent.propertyTax) : 1.1) / 100;
      const insRate = (editingEvent.insurance !== undefined ? Number(editingEvent.insurance) : 0.35) / 100;
      const maintRate = (editingEvent.maintenance !== undefined ? Number(editingEvent.maintenance) : 1.0) / 100;
      
      const monthlyPropTax = (homePrice * propTaxRate) / 12;
      const monthlyIns = (homePrice * insRate) / 12;
      const monthlyMaint = (homePrice * maintRate) / 12;
      const monthlyHoa = Number(editingEvent.hoa) || 0;
      const monthlyUtil = Number(editingEvent.utilitiesIncrease) || 0;
      
      let monthlyPmi = 0;
      if (!isCash && downPayment < homePrice * 0.2) {
        const pmiRate = editingEvent.pmi !== undefined ? Number(editingEvent.pmi) : 0.5;
        monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
      }
      
      const newHousingCost = Math.round(monthlyPI + monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi);

      const liquidAssets = calculateLiquidAssetsAtPurchaseAge(newInputs, purchaseAge, beforeRes);
      const totalCashRequired = calculateTotalCashRequired(editingEvent);
      const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
      const hasCashShortfall = cashShortfall > 0;
      const bypassIntercept = isRecommendationApplied && !hasCashShortfall;

      const targetRetAge = Number(newInputs.targetRetirementAge) || 65;
      const afterRes = runFireSimulation(newInputs);
      const afterReadyAge = afterRes.retirementReadyAge;
      
      const retirementFailed = (afterReadyAge && afterReadyAge > targetRetAge) || !afterRes.moneyLasts;
      const readyAgeDelayed = afterReadyAge !== null && beforeReadyAge !== null && afterReadyAge > beforeReadyAge;
      const hasRetirementImpact = retirementFailed || readyAgeDelayed;
      const isMortgageCostIncreasedAndDeficit = (newHousingCost > oldHousingCost && localHouseDeficit > 0);
      const needsRebalanceOrImprovement = isMortgageCostIncreasedAndDeficit || hasRetirementImpact;

      result.sideEffects.cashShortfall = cashShortfall;
      result.sideEffects.mortgagePayment = newHousingCost;

      if (bypassIntercept || !needsRebalanceOrImprovement) {
        const keepRent = !!editingEvent.keepRent;
        const getPhaseWants = (phase) => (Number(phase.expenses?.leisure) || 0) + (Number(phase.expenses?.diningOut) || 0) + (Number(phase.expenses?.misc) || 0);
        const getPhaseSavings = (phase) => phase.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

        const wantsReduction = prePhase && activePhase ? Math.max(0, getPhaseWants(prePhase) - getPhaseWants(activePhase)) : 0;
        const savingsReduction = prePhase && activePhase ? Math.max(0, getPhaseSavings(prePhase) - getPhaseSavings(activePhase)) : 0;
        const housingCostChange = Math.round(newHousingCost - (keepRent ? 0 : oldHousingCost));
        const totalCashFlowImprovement = -housingCostChange + wantsReduction + savingsReduction;
        
        result.sideEffects.impactSummary = {
          housingCostChange,
          wantsReduction,
          savingsReduction,
          totalCashFlowImprovement,
          baselineRetirementAge: beforeReadyAge,
          newRetirementAge: afterReadyAge || targetRetAge,
          retirementReadyAge: afterReadyAge || targetRetAge,
          isAffordable: true
        };
      } else {
        if (isMortgageCostIncreasedAndDeficit) {
          const rebalanceData = getRebalanceStrategies(newInputs, editingEvent, beforeReadyAge);
          if (rebalanceData) {
            result.sideEffects.rebalanceStrategies = rebalanceData;
          } else {
            result.uiRequests.push({ type: 'showImprovementModal', value: true });
          }
        } else {
          result.uiRequests.push({ type: 'showImprovementModal', value: true });
        }
      }
    } else if (type === 'sellHouse') {
      const sellEvId = editingEvent.id && editingEvent.id.startsWith('sell-') ? editingEvent.id : `sell-${Date.now()}`;
      const sellCost = normalizePercent(editingEvent.sellingCost, 6.0);
      const sellEvObj = {
        id: sellEvId,
        type: 'sellHouse',
        enabled: true,
        name: 'Sell House',
        age: normalizeEventAge(editingEvent.age, 85),
        houseId: editingEvent.houseId,
        sellingCost: sellCost,
        proceedsDestination: editingEvent.proceedsDestination || 'investments'
      };

      if (!newInputs.lifeEvents) {
        newInputs.lifeEvents = [];
      }
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== sellEvId && e.id !== editingEvent.id);
      newInputs.lifeEvents.push(sellEvObj);

      if (newInputs.houseAssets) {
        newInputs.houseAssets = newInputs.houseAssets.map(h => {
          if (h.id === editingEvent.houseId) {
            return { ...h, sellingCostRate: sellCost };
          }
          return h;
        });
      }

      savedEvent = sellEvObj;
    }

    result.updatedInputs = newInputs;
    result.savedEvent = savedEvent;
    return result;
  },

  delete(matchEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const houseId = matchEvent.houseId;
    const deletedEvents = [];

    if (newInputs.lifeEvents) {
      const remainingEvents = newInputs.lifeEvents.filter(e => {
        if (e.id === matchEvent.id || e.id === matchEvent.originalId) {
          deletedEvents.push(e);
          return false;
        }
        if (houseId && e.houseId === houseId) {
          deletedEvents.push(e);
          return false;
        }
        return true;
      });
      newInputs.lifeEvents = remainingEvents;
    }

    if (houseId && newInputs.houseAssets) {
      newInputs.houseAssets = newInputs.houseAssets.filter(h => h.id !== houseId);
    }

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
