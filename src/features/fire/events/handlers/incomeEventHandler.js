import { 
  cloneInputs, 
  createStandardResult, 
  normalizeEventAge, 
  normalizeCurrency 
} from './eventHandlerUtils.js';

export const incomeEventHandler = {
  edit(baseEvent, inputs) {
    if (!baseEvent) return null;

    const isFromIncomeList = inputs.incomeList?.some(i => i.id === baseEvent.id);
    if (isFromIncomeList || baseEvent.type === 'careerChange') {
      return {
        ...baseEvent,
        type: 'careerChange',
        growthRate: baseEvent.growthRate !== undefined ? Number(baseEvent.growthRate) * 100 : 3.0
      };
    }

    return { ...baseEvent };
  },

  save(editingEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const type = editingEvent.type;
    
    let savedEvent = null;
    const result = createStandardResult(newInputs);

    if (type === 'careerChange') {
      const startAge = normalizeEventAge(editingEvent.startAge, newInputs.currentAge);
      const amount = normalizeCurrency(editingEvent.amount, 50000);
      const growthRateVal = (editingEvent.growthRate !== undefined ? Number(editingEvent.growthRate) : 3.0) / 100;

      const newInc = {
        id: editingEvent.id && editingEvent.id !== 'careerChange' ? editingEvent.id : `inc-${Date.now()}`,
        name: editingEvent.name || 'New Career / Job',
        amount,
        frequency: 'yearly',
        startAge,
        endAge: normalizeEventAge(editingEvent.endAge || newInputs.targetRetirementAge, 65),
        growthRate: growthRateVal,
        isTaxable: true,
        incomeChangeType: editingEvent.incomeChangeType || 'newIncomeLevel',
        salaryIncrease: editingEvent.incomeChangeType === 'increaseByAmount' 
          ? (editingEvent.salaryIncrease !== undefined ? Number(editingEvent.salaryIncrease) : amount)
          : undefined,
        permanent: editingEvent.permanent === true,
        parentEventId: editingEvent.parentEventId || null
      };

      if (!newInputs.incomeList) {
        newInputs.incomeList = [];
      }
      
      const updatedIncome = newInputs.incomeList.map(inc => {
        if (inc.startAge < startAge && inc.endAge > startAge) {
          return { ...inc, endAge: startAge };
        }
        return inc;
      });

      // Filter out duplicate ID if it exists
      const remainingIncome = updatedIncome.filter(i => i.id !== newInc.id);
      newInputs.incomeList = [...remainingIncome, newInc];
      savedEvent = { ...newInc, type: 'careerChange' };
    } else {
      const isRetIncomeType = ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type);
      if (isRetIncomeType) {
        let defaultName = 'Other Income';
        if (type === 'socialSecurity') defaultName = 'Social Security';
        else if (type === 'pension') defaultName = 'Pension';
        else if (type === 'rentalIncome') defaultName = 'Rental Income';
        else if (type === 'annuity') defaultName = 'Annuity';

        let claimingAge = editingEvent.claimingAge !== undefined ? Number(editingEvent.claimingAge) : (editingEvent.startAge !== undefined ? Number(editingEvent.startAge) : 65);
        if (type === 'socialSecurity') {
          claimingAge = Math.max(62, Math.min(70, claimingAge));
        }

        const newEventObj = {
          id: editingEvent.id && !['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(editingEvent.id)
            ? editingEvent.id
            : `${type}-${Date.now()}`,
          type,
          enabled: true,
          name: editingEvent.name || defaultName,
          claimingAge,
          startAge: claimingAge,
          age: claimingAge,
          monthlyBenefit: normalizeCurrency(editingEvent.monthlyBenefit, 1000),
          inflationAdjusted: editingEvent.inflationAdjusted !== false,
          useEarnings: editingEvent.useEarnings === true,
          ageStartedWorking: editingEvent.ageStartedWorking !== undefined ? Number(editingEvent.ageStartedWorking) : 22
        };

        if (!newInputs.lifeEvents) {
          newInputs.lifeEvents = [];
        }
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== newEventObj.id && e.id !== editingEvent.id);
        newInputs.lifeEvents.push(newEventObj);
        savedEvent = newEventObj;
      }
    }

    result.updatedInputs = newInputs;
    result.savedEvent = savedEvent;
    return result;
  },

  delete(matchEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const deletedEvents = [];

    const isFromIncomeList = newInputs.incomeList?.some(i => i.id === matchEvent.originalId || i.id === matchEvent.id);
    if (isFromIncomeList || matchEvent.type === 'careerChange') {
      const matchInc = newInputs.incomeList.find(i => i.id === matchEvent.originalId || i.id === matchEvent.id || i.startAge === matchEvent.age);
      if (matchInc) {
        deletedEvents.push(matchInc);
        const remaining = newInputs.incomeList.filter(i => i.id !== matchInc.id);
        const updated = remaining.map(i => {
          if (i.endAge === matchInc.startAge) {
            return { ...i, endAge: matchInc.endAge };
          }
          return i;
        });
        newInputs.incomeList = updated;
      }
    } else {
      if (newInputs.lifeEvents) {
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => {
          if (e.id === matchEvent.id || e.id === matchEvent.originalId) {
            deletedEvents.push(e);
            return false;
          }
          return true;
        });
      }
    }

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
