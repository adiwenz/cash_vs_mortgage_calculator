import { 
  createMarriageEventObject, 
  createSpouseRecord 
} from '../../../../domain/events/marriage/marriageEventFactory.js';
import { 
  cloneInputs, 
  createStandardResult 
} from './eventHandlerUtils.js';

export const marriageEventHandler = {
  edit(baseEvent, inputs) {
    if (!baseEvent) return null;
    return {
      ...baseEvent,
      age: Number(baseEvent.age),
      spouseIncome: Number(baseEvent.spouseIncome || 0),
      incomeGrowthRate: Number(baseEvent.incomeGrowthRate || 3),
      cash: Number(baseEvent.cash || 0),
      investments: Number(baseEvent.investments || 0),
      retirement: Number(baseEvent.retirement || 0),
      debtStudent: Number(baseEvent.debtStudent || 0),
      debtCredit: Number(baseEvent.debtCredit || 0),
      debtOther: Number(baseEvent.debtOther || 0),
      savingsRate: Number(baseEvent.savingsRate || 0),
      housingOption: baseEvent.housingOption || 'move',
      housingSavings: Number(baseEvent.housingSavings || 0),
      housingCost: Number(baseEvent.housingCost || 0),
      lifestyleOption: baseEvent.lifestyleOption || 'same',
      lifestyleAdjustment: Number(baseEvent.lifestyleAdjustment || 0),
      includeWeddingCost: !!baseEvent.includeWeddingCost,
      weddingCost: Number(baseEvent.weddingCost || 0),
      weddingFundingMethod: baseEvent.weddingFundingMethod || 'savings',
      weddingAge: Number(baseEvent.weddingAge || baseEvent.age),
      filingStatus: baseEvent.filingStatus || 'jointly',
      spouseCurrentAge: baseEvent.spouseCurrentAge !== undefined ? Number(baseEvent.spouseCurrentAge) : Number(baseEvent.age),
      spouseLifeExpectancy: baseEvent.spouseLifeExpectancy !== undefined ? Number(baseEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
      spouseSocialSecurityAge: baseEvent.spouseSocialSecurityAge !== undefined ? Number(baseEvent.spouseSocialSecurityAge) : 67,
      spouseEstimatedSocialSecurityBenefit: baseEvent.spouseEstimatedSocialSecurityBenefit !== undefined ? Number(baseEvent.spouseEstimatedSocialSecurityBenefit) : 0,
      spouseDesiredRetirementAge: baseEvent.spouseDesiredRetirementAge !== undefined ? Number(baseEvent.spouseDesiredRetirementAge) : null,
      desiredRetirementAge: baseEvent.spouseDesiredRetirementAge !== undefined ? Number(baseEvent.spouseDesiredRetirementAge) : null,
      partnerRetiresWithUser: baseEvent.partnerRetiresWithUser !== false,
      retirementSpendingNeed: baseEvent.retirementSpendingNeed !== undefined ? Number(baseEvent.retirementSpendingNeed) : null,
      combinedSpendingAfterMarriage: baseEvent.combinedSpendingAfterMarriage !== undefined ? Number(baseEvent.combinedSpendingAfterMarriage) : null,
      type: 'marriage'
    };
  },

  save(editingEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    
    const marriageEventObj = createMarriageEventObject(editingEvent, newInputs);
    const spouseRecord = createSpouseRecord(editingEvent, newInputs);

    let nextHouseholdMembers = [...(newInputs.householdMembers || [])];
    const spouseIdx = nextHouseholdMembers.findIndex(m => m.id === 'spouse');
    if (spouseIdx !== -1) {
      nextHouseholdMembers[spouseIdx] = spouseRecord;
    } else {
      nextHouseholdMembers.push(spouseRecord);
    }
    newInputs.householdMembers = nextHouseholdMembers;

    if (!newInputs.lifeEvents) {
      newInputs.lifeEvents = [];
    }
    newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== marriageEventObj.id && e.id !== editingEvent.id);
    newInputs.lifeEvents.push(marriageEventObj);

    const result = createStandardResult(newInputs, marriageEventObj);
    return result;
  },

  delete(matchEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const deletedEvents = [];

    if (newInputs.lifeEvents) {
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => {
        if (e.id === matchEvent.id || e.id === matchEvent.originalId) {
          deletedEvents.push(e);
          return false;
        }
        return true;
      });
    }

    newInputs.householdMembers = (newInputs.householdMembers || []).filter(m => m.id !== 'spouse');

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
