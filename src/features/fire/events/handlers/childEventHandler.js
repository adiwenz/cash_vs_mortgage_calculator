import { runFireSimulation, getNormalizedPhases } from '../../../../fireCalculations.js';
import { 
  cloneInputs, 
  createStandardResult, 
  normalizeEventAge, 
  normalizeCurrency 
} from './eventHandlerUtils.js';

export const childEventHandler = {
  edit(baseEvent) {
    if (!baseEvent) return null;
    return { ...baseEvent };
  },

  save(editingEvent, inputs, scenarios, currentScenarioId) {
    const newInputs = cloneInputs(inputs);
    const result = createStandardResult(newInputs);

    const birthAgeVal = normalizeEventAge(editingEvent.birthAge !== undefined ? editingEvent.birthAge : editingEvent.parentAgeAtBirth, 30);
    const childStartAgeVal = normalizeEventAge(editingEvent.childStartAge, 0);
    const includeCollegeVal = !!editingEvent.includeCollege;
    const maxAgeVal = includeCollegeVal ? 22 : 18;
    const costMethod = editingEvent.costMethod || 'default';

    const childCostsInput = newInputs.childCosts || inputs.childCosts || {};
    const ages0to4Val = costMethod === 'custom' ? normalizeCurrency(editingEvent.customAges0to4, 15000) : normalizeCurrency(childCostsInput.ages0to4, 15000);
    const ages5to12Val = costMethod === 'custom' ? normalizeCurrency(editingEvent.customAges5to12, 15000) : normalizeCurrency(childCostsInput.ages5to12, 15000);
    const ages13to18Val = costMethod === 'custom' ? normalizeCurrency(editingEvent.customAges13to18, 15000) : normalizeCurrency(childCostsInput.ages13to18, 15000);
    const ages19to22Val = costMethod === 'custom' ? normalizeCurrency(editingEvent.customAges19to22, 15000) : normalizeCurrency(childCostsInput.ages19to22, 15000);

    let totalCost = 0;
    let activeYears = 0;
    const costsVal = [];

    for (let childAge = childStartAgeVal; childAge < maxAgeVal; childAge++) {
      if (childAge >= 0 && childAge <= 4) {
        totalCost += ages0to4Val;
        if (childAge === childStartAgeVal) costsVal.push(ages0to4Val);
      } else if (childAge >= 5 && childAge <= 12) {
        totalCost += ages5to12Val;
        if (childAge === childStartAgeVal) costsVal.push(ages5to12Val);
      } else if (childAge >= 13 && childAge <= 18) {
        totalCost += ages13to18Val;
        if (childAge === childStartAgeVal) costsVal.push(ages13to18Val);
      } else if (childAge >= 19 && childAge <= 22) {
        totalCost += ages19to22Val;
        if (childAge === childStartAgeVal) costsVal.push(ages19to22Val);
      }
      activeYears++;
    }

    if (childStartAgeVal <= 4) costsVal.push(ages0to4Val);
    if (childStartAgeVal <= 12 && maxAgeVal >= 5) costsVal.push(ages5to12Val);
    if (childStartAgeVal <= 18 && maxAgeVal >= 13) costsVal.push(ages13to18Val);
    if (includeCollegeVal && childStartAgeVal <= 22 && maxAgeVal >= 19) costsVal.push(ages19to22Val);

    const avgAnnualChildCost = activeYears > 0 ? Math.round(totalCost / activeYears) : 0;
    const peakCostVal = Math.max(...costsVal, 0);
    const newPromoStartAgeVal = birthAgeVal + childStartAgeVal;

    const isNewChildEvent = !editingEvent.id || editingEvent.id === 'haveChild' || !inputs.lifeEvents?.some(e => e.id === editingEvent.id);
    const childEventId = editingEvent.id && editingEvent.id !== 'haveChild' ? editingEvent.id : `haveChild-${Date.now()}`;
    const linkedPromoId = editingEvent.linkedEventId || `inc-promo-${Date.now()}`;
    const adjustmentStrategy = editingEvent.adjustmentStrategy || 'promotion';

    const savedEventObj = {
      id: childEventId,
      type: 'haveChild',
      enabled: true,
      name: 'Have a Child',
      childName: editingEvent.childName || '',
      linkedEventId: linkedPromoId,
      childStartAge: childStartAgeVal,
      birthAge: birthAgeVal,
      costMethod: costMethod,
      customAges0to4: ages0to4Val,
      customAges5to12: ages5to12Val,
      customAges13to18: ages13to18Val,
      customAges19to22: ages19to22Val,
      includeCollege: includeCollegeVal,
      adjustmentStrategy: adjustmentStrategy
    };

    // Calculate baseline/impact before saving
    const currentScenObj = scenarios?.find(s => s.id === currentScenarioId) || scenarios?.[0];
    const beforeRes = currentScenObj ? runFireSimulation(currentScenObj.inputs) : runFireSimulation(inputs);
    const beforeReadyAge = beforeRes.retirementReadyAge;

    // Remove old versions of this child event
    if (!newInputs.lifeEvents) {
      newInputs.lifeEvents = [];
    }
    newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== childEventId && e.id !== editingEvent.id);

    let notificationMsg = '';

    if (isNewChildEvent) {
      const childAnnualCost = ages0to4Val;
      const childcareCostMonthly = childAnnualCost / 12;

      // Get Wants budget from active pre-child budget phase
      const normalizedPhases = getNormalizedPhases(newInputs);
      const matchPhase = normalizedPhases.find(p => birthAgeVal >= p.startAge && birthAgeVal < p.endAge) || normalizedPhases[0];
      let availableWants = 0;
      if (matchPhase && matchPhase.expenses) {
        availableWants = (Number(matchPhase.expenses.leisure) || 0) +
                         (Number(matchPhase.expenses.diningOut) || 0) +
                         (Number(matchPhase.expenses.misc) || 0);
      }

      const noPromo = !!editingEvent.noPromo;

      if (adjustmentStrategy === 'rebalance') {
        const standardExpenses = matchPhase ? { ...matchPhase.expenses } : {};
        const X = Number(standardExpenses.leisure) || 0;
        const Y = Number(standardExpenses.diningOut) || 0;
        const Z = Number(standardExpenses.misc) || 0;
        let newExpenses;

        if (availableWants >= childcareCostMonthly) {
          const factor = availableWants > 0 ? (availableWants - childcareCostMonthly) / availableWants : 0;
          newExpenses = {
            ...standardExpenses,
            leisure: Math.max(0, Math.round(X * factor)),
            diningOut: Math.max(0, Math.round(Y * factor)),
            misc: Math.max(0, Math.round(Z * factor))
          };
          const diff = Math.round(availableWants - childcareCostMonthly) - (newExpenses.leisure + newExpenses.diningOut + newExpenses.misc);
          newExpenses.misc = Math.max(0, newExpenses.misc + diff);

          // Option 2 Case A: Wants covers entire cost, no promotion
          if (newInputs.incomeList) {
            newInputs.incomeList = newInputs.incomeList.filter(inc => inc.id !== linkedPromoId && inc.parentEventId !== childEventId);
          }
          notificationMsg = `✓ Child Added\n⚖️ Wants Reduced: $${Math.round(childcareCostMonthly).toLocaleString()}/mo`;
        } else {
          // Option 2 Case B/C: Wants partially/not covers cost. Clamp wants at 0.
          newExpenses = {
            ...standardExpenses,
            leisure: 0,
            diningOut: 0,
            misc: 0
          };

          const gap = childcareCostMonthly - availableWants;
          const promoAmount = Math.round(gap * 12);

          if (!noPromo) {
            if (!newInputs.incomeList) {
              newInputs.incomeList = [];
            }
            const promoName = editingEvent.childName ? `Promotion (${editingEvent.childName})` : 'Get a Promotion';
            const hasPromo = newInputs.incomeList.some(inc => inc.id === linkedPromoId || inc.parentEventId === childEventId);

            if (hasPromo) {
              newInputs.incomeList = newInputs.incomeList.map(inc => {
                if (inc.id === linkedPromoId || inc.parentEventId === childEventId) {
                  return {
                    ...inc,
                    startAge: newPromoStartAgeVal,
                    salaryIncrease: promoAmount,
                    amount: promoAmount,
                    name: promoName,
                    generatedBy: childEventId,
                    generatedReason: 'childcare_affordability'
                  };
                }
                return inc;
              });
            } else {
              newInputs.incomeList.push({
                id: linkedPromoId,
                name: promoName,
                amount: promoAmount,
                frequency: 'yearly',
                startAge: newPromoStartAgeVal,
                endAge: newInputs.targetRetirementAge || 65,
                growthRate: 0.03,
                isTaxable: true,
                incomeChangeType: 'increaseByAmount',
                salaryIncrease: promoAmount,
                permanent: true,
                parentEventId: childEventId,
                generatedBy: childEventId,
                generatedReason: 'childcare_affordability'
              });
            }

            if (availableWants === 0) {
              // Case C: Wants = $0
              notificationMsg = `✓ Child Added\n👶 Child Cost: $${childAnnualCost.toLocaleString()}/yr\n💼 Promotion: +$${promoAmount.toLocaleString()}/yr`;
            } else {
              // Case B: Wants partially covers
              notificationMsg = `✓ Child Added\n⚖️ Wants Reduced: $${Math.round(availableWants).toLocaleString()}/mo\n💼 Promotion: +$${promoAmount.toLocaleString()}/yr`;
            }
          } else {
            // noPromo = true
            if (newInputs.incomeList) {
              newInputs.incomeList = newInputs.incomeList.filter(inc => inc.id !== linkedPromoId && inc.parentEventId !== childEventId);
            }
            notificationMsg = `✓ Child Added\n⚖️ Wants Reduced: $${Math.round(availableWants).toLocaleString()}/mo`;
          }
        }

        const otherChildren = newInputs.lifeEvents.filter(e => e.type === 'haveChild');
        const activeChildCount = otherChildren.length + 1;
        const standardIncome = Number(matchPhase?.income) || (Number(newInputs.simpleIncome) / 12) || 4167;
        const newBudgets = { ...(newInputs.budgetDetails?.childcareBudgets || {}) };
        newBudgets[activeChildCount] = {
          income: standardIncome,
          expenses: newExpenses,
          savings: { ...(matchPhase?.savings || {}) },
          partnerSavings: { ...(matchPhase?.partnerSavings || {}) },
          savingsAllocMode: matchPhase?.savingsAllocMode || 'fixed'
        };

        newInputs.budgetDetails = {
          ...(newInputs.budgetDetails || {}),
          childcareIncome: standardIncome,
          childcareExpenses: newExpenses,
          childcareBudgets: newBudgets
        };

      } else {
        // Option 1 (promotion)
        if (!noPromo) {
          if (!newInputs.incomeList) {
            newInputs.incomeList = [];
          }
          const promoAmount = editingEvent.customPromoAmount !== undefined ? editingEvent.customPromoAmount : childcareCostMonthly * 12;
          const promoName = editingEvent.childName ? `Promotion (${editingEvent.childName})` : 'Get a Promotion';
          const hasPromo = newInputs.incomeList.some(inc => inc.id === linkedPromoId || inc.parentEventId === childEventId);

          if (hasPromo) {
            newInputs.incomeList = newInputs.incomeList.map(inc => {
              if (inc.id === linkedPromoId || inc.parentEventId === childEventId) {
                return {
                  ...inc,
                  startAge: newPromoStartAgeVal,
                  salaryIncrease: promoAmount,
                  amount: promoAmount,
                  name: promoName,
                  generatedBy: childEventId,
                  generatedReason: 'childcare_affordability'
                };
              }
              return inc;
            });
          } else {
            newInputs.incomeList.push({
              id: linkedPromoId,
              name: promoName,
              amount: promoAmount,
              frequency: 'yearly',
              startAge: newPromoStartAgeVal,
              endAge: newInputs.targetRetirementAge || 65,
              growthRate: 0.03,
              isTaxable: true,
              incomeChangeType: 'increaseByAmount',
              salaryIncrease: promoAmount,
              permanent: true,
              parentEventId: childEventId,
              generatedBy: childEventId,
              generatedReason: 'childcare_affordability'
            });
          }
          notificationMsg = `✓ Child Added\n👶 Child Cost: $${childAnnualCost.toLocaleString()}/yr\n💼 Promotion: +$${Math.round(promoAmount).toLocaleString()}/yr`;
        } else {
          // noPromo = true
          if (newInputs.incomeList) {
            newInputs.incomeList = newInputs.incomeList.filter(inc => inc.id !== linkedPromoId && inc.parentEventId !== childEventId);
          }
          notificationMsg = `✓ Child Added\n👶 Child Cost: $${childAnnualCost.toLocaleString()}/yr`;
        }
      }
    } else {
      // Editing existing child event - never mutate budget or generate promotions.
      notificationMsg = `✓ Child event updated`;
    }

    newInputs.lifeEvents.push(savedEventObj);

    const afterRes = runFireSimulation(newInputs);
    const afterReadyAge = afterRes.retirementReadyAge;
    const diff = (afterReadyAge && beforeReadyAge) ? (afterReadyAge - beforeReadyAge) : 0;

    result.updatedInputs = newInputs;
    result.savedEvent = savedEventObj;
    result.sideEffects.retirementDelayDiff = diff;
    result.sideEffects.notificationMsg = notificationMsg;
    result.sideEffects.impactSummary = {
      beforeAge: beforeReadyAge,
      afterAge: afterReadyAge,
      diffYears: diff,
      annualSpending: avgAnnualChildCost,
      event: savedEventObj
    };

    return result;
  },

  delete(matchEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const childId = matchEvent.originalId || matchEvent.id;
    const deletedEvents = [];

    if (newInputs.lifeEvents) {
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => {
        if (e.id === childId) {
          deletedEvents.push(e);
          return false;
        }
        return true;
      });
    }

    // Keep generated promotion events completely untouched when deleting the child event
    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
