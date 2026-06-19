import { runFireSimulation } from '../../../../fireCalculations.js';
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

    // Add remaining cost categories for peakCost calculation
    if (childStartAgeVal <= 4) costsVal.push(ages0to4Val);
    if (childStartAgeVal <= 12 && maxAgeVal >= 5) costsVal.push(ages5to12Val);
    if (childStartAgeVal <= 18 && maxAgeVal >= 13) costsVal.push(ages13to18Val);
    if (includeCollegeVal && childStartAgeVal <= 22 && maxAgeVal >= 19) costsVal.push(ages19to22Val);

    const avgAnnualChildCost = activeYears > 0 ? Math.round(totalCost / activeYears) : 0;
    const peakCostVal = Math.max(...costsVal, 0);
    const newPromoStartAgeVal = birthAgeVal + childStartAgeVal;

    const childEventId = editingEvent.id && editingEvent.id !== 'haveChild' ? editingEvent.id : `haveChild-${Date.now()}`;
    const linkedPromoId = editingEvent.linkedEventId || `inc-promo-${Date.now()}`;

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
      includeCollege: includeCollegeVal
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

    // Update, insert, or delete linked Income Goal in income list
    const hasPromo = newInputs.incomeList && newInputs.incomeList.some(inc => inc.id === linkedPromoId || inc.parentEventId === childEventId);
    
    if (editingEvent.noPromo) {
      if (newInputs.incomeList) {
        newInputs.incomeList = newInputs.incomeList.filter(inc => inc.id !== linkedPromoId && inc.parentEventId !== childEventId);
      }
    } else {
      if (!newInputs.incomeList) {
        newInputs.incomeList = [];
      }
      const promoAmount = editingEvent.customPromoAmount !== undefined ? editingEvent.customPromoAmount : peakCostVal;
      const promoName = editingEvent.childName ? `Income Goal (${editingEvent.childName})` : 'Income Goal';

      if (hasPromo) {
        newInputs.incomeList = newInputs.incomeList.map(inc => {
          if (inc.id === linkedPromoId || inc.parentEventId === childEventId) {
            return {
              ...inc,
              startAge: newPromoStartAgeVal,
              salaryIncrease: promoAmount,
              amount: promoAmount,
              name: promoName
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
          parentEventId: childEventId
        });
      }
    }

    newInputs.lifeEvents.push(savedEventObj);

    const afterRes = runFireSimulation(newInputs);
    const afterReadyAge = afterRes.retirementReadyAge;
    const diff = (afterReadyAge && beforeReadyAge) ? (afterReadyAge - beforeReadyAge) : 0;

    result.updatedInputs = newInputs;
    result.savedEvent = savedEventObj;
    result.sideEffects.retirementDelayDiff = diff;
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

    if (newInputs.incomeList) {
      newInputs.incomeList = newInputs.incomeList.filter(i => {
        if (i.id === matchEvent.linkedEventId || i.parentEventId === childId) {
          return false;
        }
        return true;
      });
    }

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
