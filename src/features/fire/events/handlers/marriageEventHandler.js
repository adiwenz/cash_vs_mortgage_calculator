import { 
  createMarriageEventObject, 
  createSpouseRecord 
} from '../../../../domain/events/marriage/marriageEventFactory.js';
import { 
  cloneInputs, 
  createStandardResult 
} from './eventHandlerUtils.js';
import { syncBudgetDetails } from '../../../../calculators/fire/phases.js';
import { restoreSinglePersonBudgetAfterPartnerRemoval } from '../../../../models/lifePlan/restoreSinglePersonBudget.js';

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
      type: baseEvent.type || 'marriage',
      relationshipType: baseEvent.relationshipType || (baseEvent.type === 'marriage' ? 'married' : (baseEvent.type === 'domesticPartnership' ? 'domestic_partnership' : 'partner')),
      livingTogether: baseEvent.livingTogether !== false,
      combineFinances: baseEvent.combineFinances !== false
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

  delete(matchEvent, inputs, protectedPreDeleteSavingsRate = null) {
    const rateToUse = protectedPreDeleteSavingsRate !== undefined && protectedPreDeleteSavingsRate !== null
      ? protectedPreDeleteSavingsRate
      : (inputs.displayedSavingsRate && inputs.displayedSavingsRate > 0
        ? inputs.displayedSavingsRate
        : inputs.savingsRate && inputs.savingsRate > 0
          ? inputs.savingsRate
          : inputs.derivedSavingsRate && inputs.derivedSavingsRate > 0
            ? inputs.derivedSavingsRate
            : null);

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

    if (newInputs.lifePlan) {
      const sourceEventId = matchEvent.id;
      const isGeneratedByEvent = (obj) => {
        const evId = obj.metadata?.createdFromEventId || obj.properties?.metadata?.createdFromEventId;
        return evId === sourceEventId;
      };

      const deletedPartner = (newInputs.lifePlan.objects || []).find(o => (isGeneratedByEvent(o) || o.id === 'spouse-partner') && o.type === 'person' && (o.role === 'partner' || o.properties?.role === 'partner'));
      const deletedPartnerId = deletedPartner?.id;

      const deletedRelationship = (newInputs.lifePlan.objects || []).find(o => (isGeneratedByEvent(o) || o.id === `relationship_self-person_${deletedPartnerId || 'spouse-partner'}`) && o.type === 'relationship');
      const deletedRelationshipId = deletedRelationship?.id;

      // Filter out partner, relationship, and any generated objects
      let cleanObjects = (newInputs.lifePlan.objects || []).filter(o => o.id !== deletedPartnerId && o.id !== deletedRelationshipId && !isGeneratedByEvent(o));
      
      const clearRefs = (item) => {
        if (item.personId === deletedPartnerId) item.personId = null;
        if (item.partnerPersonId === deletedPartnerId) item.partnerPersonId = null;
        if (item.relationshipId === deletedRelationshipId) item.relationshipId = null;
        if (item.properties) {
          if (item.properties.personId === deletedPartnerId) item.properties.personId = null;
          if (item.properties.partnerPersonId === deletedPartnerId) item.properties.partnerPersonId = null;
          if (item.properties.relationshipId === deletedRelationshipId) item.properties.relationshipId = null;
        }
      };

      cleanObjects.forEach(clearRefs);

      const cleanEvents = (newInputs.lifePlan.events || []).filter(e => {
        const obj = (newInputs.lifePlan.objects || []).find(o => o.id === e.objectId);
        if (obj && isGeneratedByEvent(obj)) return false;
        return true;
      });
      cleanEvents.forEach(clearRefs);

      newInputs.lifePlan = {
        ...newInputs.lifePlan,
        objects: cleanObjects,
        events: cleanEvents
      };
    }

    const hasPartnerLeft = (newInputs.lifePlan?.objects || []).some(o => 
      o.type === 'person' && (o.id === 'spouse-partner' || o.role === 'partner' || o.properties?.role === 'partner')
    ) || (newInputs.householdMembers || []).some(m => m.id === 'spouse');

    if (!hasPartnerLeft) {
      const restoredFields = restoreSinglePersonBudgetAfterPartnerRemoval(newInputs, {
        protectedPreDeleteSavingsRate: rateToUse
      });
      Object.assign(newInputs, restoredFields);
    }

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
