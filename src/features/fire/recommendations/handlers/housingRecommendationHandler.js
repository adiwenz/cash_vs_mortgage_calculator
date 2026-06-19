import { 
  applyBalancedBudgetAdjustments, 
  applyBudgetAdjustmentsForLevel, 
  splitPhasesAtAge, 
  resolveBuyHouseEvent 
} from '../../../../calculators/fire/rebalance.js';

/**
 * Pure handler for housing-related recommendations and rebalance strategies.
 * 
 * @param {Object} inputs Original inputs
 * @param {Object} scenario Selected recommendation scenario
 * @param {Object} editingEvent Current editingEvent
 * @param {Object} options Additional parameters like houseRebalanceSummary
 * @returns {Object} Standardized recommendation output
 */
export function handleHousingRecommendation(inputs, scenario, editingEvent, options = {}) {
  const newInputs = JSON.parse(JSON.stringify(inputs));
  const houseRebalanceSummary = options.houseRebalanceSummary;

  let updatedEditingEvent = editingEvent ? { ...editingEvent } : null;
  let notificationMsg = null;
  let showBudgetModal = false;
  let linkedEventsCreated = [];
  let retirementTimingChanged = false;

  const purchaseAge = houseRebalanceSummary ? houseRebalanceSummary.purchaseAge : (editingEvent?.purchaseAge || 40);

  // 1. handle StrategyId updatePrice / reduceHomePrice
  if (scenario.type === 'reduceHomePrice' || scenario.type === 'updatePrice') {
    const affordablePrice = houseRebalanceSummary ? houseRebalanceSummary.selectedAffordablePrice : (scenario.value || 300000);
    
    // Resolve the buyHouse event from inputs
    const buyHouseEventIndex = (newInputs.lifeEvents || []).findIndex(e => e.type === 'buyHouse' && e.enabled);
    if (buyHouseEventIndex !== -1) {
      const buyHouseEv = newInputs.lifeEvents[buyHouseEventIndex];
      const resolvedBuyHouseEv = resolveBuyHouseEvent(buyHouseEv, newInputs);
      
      const originalPrice = Number(resolvedBuyHouseEv.homePrice !== undefined ? resolvedBuyHouseEv.homePrice : (resolvedBuyHouseEv.purchasePrice !== undefined ? resolvedBuyHouseEv.purchasePrice : 0)) || 0;
      let newDownPayment = resolvedBuyHouseEv.downPayment || 0;
      if (originalPrice > 0 && resolvedBuyHouseEv.purchaseType !== 'cash') {
        const ratio = (resolvedBuyHouseEv.downPayment || 0) / originalPrice;
        newDownPayment = Math.round(affordablePrice * ratio);
      }
      const finalDownPayment = Math.min(newDownPayment, affordablePrice);

      const updatedBuyHouseEv = {
        ...resolvedBuyHouseEv,
        homePrice: affordablePrice,
        purchasePrice: affordablePrice,
        downPayment: finalDownPayment,
        recommendationApplied: true,
        appliedRecommendationType: scenario.type,
        appliedRecommendationAt: Date.now()
      };

      newInputs.lifeEvents[buyHouseEventIndex] = updatedBuyHouseEv;

      if (updatedEditingEvent && updatedEditingEvent.type === 'buyHouse') {
        updatedEditingEvent = {
          ...updatedEditingEvent,
          homePrice: affordablePrice,
          downPayment: finalDownPayment,
          recommendationApplied: true,
          appliedRecommendationType: scenario.type,
          appliedRecommendationAt: Date.now()
        };
      }

      if (resolvedBuyHouseEv.houseId && newInputs.houseAssets) {
        newInputs.houseAssets = newInputs.houseAssets.map(h => {
          if (h.id === resolvedBuyHouseEv.houseId) {
            return {
              ...h,
              homePrice: affordablePrice,
              purchasePrice: affordablePrice,
              downPayment: finalDownPayment
            };
          }
          return h;
        });
      }

      if (newInputs.debtList) {
        newInputs.debtList = newInputs.debtList.map(d => {
          if (d.houseId === resolvedBuyHouseEv.houseId || d.id === `mortgage-${resolvedBuyHouseEv.houseId}`) {
            const principal = Math.max(0, affordablePrice - finalDownPayment);
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

      // Budget adjustments
      const chosenOption = houseRebalanceSummary?.selectedOption || 'balanced';
      if (chosenOption === 'balanced') {
        applyBalancedBudgetAdjustments(newInputs, updatedBuyHouseEv, affordablePrice, inputs);
      } else if (chosenOption === 'aggressive' || chosenOption === 'stretch') {
        applyBudgetAdjustmentsForLevel('stretch', newInputs, updatedBuyHouseEv, affordablePrice, inputs);
      } else {
        // Conservative
        const purchaseAgeVal = Number(updatedBuyHouseEv.purchaseAge || updatedBuyHouseEv.age || 40);
        if (newInputs.budgetDetails && newInputs.budgetDetails.phases) {
          newInputs.budgetDetails.phases = splitPhasesAtAge(newInputs.budgetDetails.phases, purchaseAgeVal);
        }
      }

      // Retirement age update
      const baselineAge = houseRebalanceSummary?.baselineRetirementAge;
      const newAge = chosenOption === 'conservative'
        ? houseRebalanceSummary?.conservativeRetirementAge
        : chosenOption === 'aggressive'
        ? houseRebalanceSummary?.aggressiveRetirementAge
        : houseRebalanceSummary?.balancedRetirementAge;

      if (newAge !== undefined && newAge !== null) {
        const oldRetAge = newInputs.targetRetirementAge;
        newInputs.targetRetirementAge = newAge;
        newInputs.lifeEvents = (newInputs.lifeEvents || []).map(e => {
          if (e.type === 'retire') {
            return { ...e, age: newAge };
          }
          return e;
        });
        newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
          if (inc.endAge === oldRetAge) {
            return { ...inc, endAge: newAge };
          }
          return inc;
        });
        retirementTimingChanged = newAge !== baselineAge;
      }

      notificationMsg = `✓ House price adjusted to ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(affordablePrice)}.`;
      if (baselineAge !== undefined && newAge !== undefined && newAge !== null && newAge !== baselineAge) {
        notificationMsg += ` Retirement age may change from ${baselineAge} to ${newAge}.`;
      }
    }
  }

  // 2. handle StrategyId increaseDownPayment
  else if (scenario.type === 'increaseDownPayment') {
    const totalCashNeededBalanced = houseRebalanceSummary ? houseRebalanceSummary.totalCashNeededBalanced : (scenario.value || 50000);
    const buyHouseEventIndex = (newInputs.lifeEvents || []).findIndex(e => e.type === 'buyHouse' && e.enabled);
    if (buyHouseEventIndex !== -1) {
      newInputs.lifeEvents[buyHouseEventIndex] = {
        ...newInputs.lifeEvents[buyHouseEventIndex],
        downPayment: totalCashNeededBalanced,
        recommendationApplied: true,
        appliedRecommendationType: scenario.type,
        appliedRecommendationAt: Date.now()
      };
      if (updatedEditingEvent && updatedEditingEvent.type === 'buyHouse') {
        updatedEditingEvent = {
          ...updatedEditingEvent,
          downPayment: totalCashNeededBalanced,
          recommendationApplied: true,
          appliedRecommendationType: scenario.type,
          appliedRecommendationAt: Date.now()
        };
      }
    }
    notificationMsg = `✓ Down payment increased to cover shortfall.`;
  }

  // 3. handle StrategyId delayHomePurchase / delayHomePurchaseDownPayment
  else if (scenario.type === 'delayHomePurchase' || scenario.type === 'delayHomePurchaseDownPayment') {
    const delayYears = Math.max(1, Math.ceil(scenario.value || 1));
    const buyHouseEventIndex = (newInputs.lifeEvents || []).findIndex(e => e.type === 'buyHouse' && e.enabled);
    if (buyHouseEventIndex !== -1) {
      const oldAge = newInputs.lifeEvents[buyHouseEventIndex].purchaseAge || 35;
      const newPurchaseAge = oldAge + delayYears;
      newInputs.lifeEvents[buyHouseEventIndex] = {
        ...newInputs.lifeEvents[buyHouseEventIndex],
        purchaseAge: newPurchaseAge,
        age: newPurchaseAge,
        recommendationApplied: true,
        appliedRecommendationType: scenario.type,
        appliedRecommendationAt: Date.now()
      };
      if (updatedEditingEvent && updatedEditingEvent.type === 'buyHouse') {
        updatedEditingEvent = {
          ...updatedEditingEvent,
          purchaseAge: newPurchaseAge,
          age: newPurchaseAge,
          recommendationApplied: true,
          appliedRecommendationType: scenario.type,
          appliedRecommendationAt: Date.now()
        };
      }
    }
    notificationMsg = `✓ House purchase delayed by ${delayYears} years.`;
  }

  // 4. handle StrategyId incomeBoost
  else if (scenario.type === 'incomeBoost' || scenario.type === 'increaseHomeIncome') {
    const buyHouseEventIndex = (newInputs.lifeEvents || []).findIndex(e => e.type === 'buyHouse' && e.enabled);
    if (buyHouseEventIndex !== -1) {
      const buyHouseEv = newInputs.lifeEvents[buyHouseEventIndex];
      const remainingDeficit = houseRebalanceSummary ? (houseRebalanceSummary.remainingBalancedDeficit !== undefined ? houseRebalanceSummary.remainingBalancedDeficit : houseRebalanceSummary.deficit) : (scenario.value || 1000);
      const yearlyIncomeBoost = remainingDeficit * 12;
      const incomeBoostEvent = {
        id: `careerChange-${Date.now()}`,
        type: 'careerChange',
        name: 'Income Increase (Homeownership)',
        startAge: purchaseAge,
        endAge: newInputs.targetRetirementAge || 65,
        growthRate: 0.03,
        isTaxable: true,
        amount: yearlyIncomeBoost,
        salaryIncrease: yearlyIncomeBoost,
        incomeChangeType: 'increaseByAmount',
        permanent: true,
        enabled: true
      };
      newInputs.incomeList = [...(newInputs.incomeList || []), incomeBoostEvent];
      linkedEventsCreated.push(incomeBoostEvent);

      applyBalancedBudgetAdjustments(newInputs, buyHouseEv, buyHouseEv.homePrice, inputs);

      newInputs.lifeEvents[buyHouseEventIndex] = {
        ...buyHouseEv,
        recommendationApplied: true,
        appliedRecommendationType: scenario.type,
        appliedRecommendationAt: Date.now()
      };

      if (updatedEditingEvent && updatedEditingEvent.type === 'buyHouse') {
        updatedEditingEvent = {
          ...updatedEditingEvent,
          recommendationApplied: true,
          appliedRecommendationType: scenario.type,
          appliedRecommendationAt: Date.now()
        };
      }
    }
    notificationMsg = `✓ Income boost added to plan.`;
  }

  // 5. handle StrategyId saveForDownPayment
  else if (scenario.type === 'saveForDownPayment') {
    const totalCashNeeded = houseRebalanceSummary ? houseRebalanceSummary.totalCashNeeded : 100000;
    const liquidFundsAvailable = houseRebalanceSummary ? houseRebalanceSummary.liquidFundsAvailable : 50000;
    const additionalNeeded = Math.max(0, totalCashNeeded - liquidFundsAvailable);
    
    const simpleIncome = Number(newInputs.simpleIncome) || 50000;
    const simpleExpenses = Number(newInputs.simpleExpenses) || 42500;
    const standardMonthlySavings = Math.round(Math.max(0, simpleIncome - simpleExpenses) / 12);
    
    // Get active phase total savings
    let activePhaseSavingsTotal = 0;
    if (newInputs.budgetDetails && newInputs.budgetDetails.phases) {
      const activePhase = newInputs.budgetDetails.phases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge) || newInputs.budgetDetails.phases[0];
      if (activePhase && activePhase.savings) {
        activePhaseSavingsTotal = Object.values(activePhase.savings).reduce((sum, v) => sum + (Number(v) || 0), 0);
      }
    }
    const monthlySavingsVal = activePhaseSavingsTotal > 0 ? activePhaseSavingsTotal : (standardMonthlySavings > 0 ? standardMonthlySavings : 500);
    const timelineYears = (additionalNeeded / (monthlySavingsVal * 12)).toFixed(1);

    const saveEvent = {
      id: `saveForDP-${Date.now()}`,
      type: 'custom',
      name: `Save for Down Payment (Target: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(additionalNeeded)})`,
      age: purchaseAge,
      enabled: true,
      notes: `Save an additional ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(additionalNeeded)} for down payment gap. Estimated timeline: ${timelineYears} years at current savings rate of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(monthlySavingsVal)}/mo.`
    };
    
    newInputs.lifeEvents = [...(newInputs.lifeEvents || []), saveEvent];
    linkedEventsCreated.push(saveEvent);

    const buyHouseEventIndex = (newInputs.lifeEvents || []).findIndex(e => e.type === 'buyHouse' && e.enabled);
    if (buyHouseEventIndex !== -1) {
      newInputs.lifeEvents[buyHouseEventIndex] = {
        ...newInputs.lifeEvents[buyHouseEventIndex],
        recommendationApplied: true,
        appliedRecommendationType: scenario.type,
        appliedRecommendationAt: Date.now()
      };
      if (updatedEditingEvent && updatedEditingEvent.type === 'buyHouse') {
        updatedEditingEvent = {
          ...updatedEditingEvent,
          recommendationApplied: true,
          appliedRecommendationType: scenario.type,
          appliedRecommendationAt: Date.now()
        };
      }
    }

    notificationMsg = `✓ Savings strategy added to plan: Save for Down Payment (Target: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(additionalNeeded)}, approx ${timelineYears} years).`;
  }

  // 6. other house strategies that just set metadata to resolve tradeoffs
  else {
    const buyHouseEventIndex = (newInputs.lifeEvents || []).findIndex(e => e.type === 'buyHouse' && e.enabled);
    if (buyHouseEventIndex !== -1) {
      newInputs.lifeEvents[buyHouseEventIndex] = {
        ...newInputs.lifeEvents[buyHouseEventIndex],
        recommendationApplied: true,
        appliedRecommendationType: scenario.type,
        appliedRecommendationAt: Date.now()
      };
    }
    if (updatedEditingEvent) {
      updatedEditingEvent = {
        ...updatedEditingEvent,
        recommendationApplied: true,
        appliedRecommendationType: scenario.type,
        appliedRecommendationAt: Date.now()
      };
    }
    notificationMsg = `✓ Applied housing adjustment strategy: ${scenario.title || scenario.type}.`;
  }

  return {
    updatedInputs: newInputs,
    updatedEditingEvent,
    linkedEventsCreated,
    linkedEventsUpdated: [],
    linkedEventsDeleted: [],
    sideEffects: {
      notificationMsg,
      showBudgetModal,
      pulsePhaseId: null,
      impactSummary: null,
      rebalanceStrategies: [],
      retirementTimingChanged
    },
    warnings: []
  };
}
