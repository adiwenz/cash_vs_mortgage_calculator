import { calculateMarriageEstimates, calculatePartnerRetirementAge } from './marriageImpact.js';

export function createSpouseRecord(editingEvent, inputs) {
  const estimates = calculateMarriageEstimates(editingEvent, inputs);
  const combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
  const spouseRetSpendingVal = estimates ? estimates.spouseRetSpendingVal : 0;
  const housingCostAmount = estimates ? estimates.housingCostAmount : 0;
  const lifestyleAdjustmentAmount = estimates ? estimates.lifestyleAdjustmentAmount : 0;

  const spouseCurrentAge = editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' 
    ? Number(editingEvent.spouseCurrentAge) 
    : Number(inputs.currentAge || 35);
  
  const userCurrentAge = Number(inputs.currentAge || 35);
  const targetRetirementAge = Number(inputs.targetRetirementAge || 65);
  
  const partnerRetirementAge = calculatePartnerRetirementAge(
    editingEvent.spouseDesiredRetirementAge,
    targetRetirementAge,
    spouseCurrentAge,
    userCurrentAge
  );

  const spouseDesiredRetirementAge = editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null 
    ? Number(editingEvent.spouseDesiredRetirementAge) 
    : null;

  const resolvedRelType = editingEvent.relationshipType || (editingEvent.type === 'marriage' ? 'married' : (editingEvent.type === 'domesticPartnership' ? 'domestic_partnership' : (editingEvent.type === 'relationshipBegins' ? 'partner' : 'married')));
  const defaultName = resolvedRelType === 'married' ? 'Spouse' : 'Partner';

  return {
    id: 'spouse',
    name: editingEvent.spouseName || defaultName,
    activeFromDate: Number(editingEvent.age),
    activeUntilDate: null,
    income: Number(editingEvent.spouseIncome || 0),
    incomeGrowthRate: Number(editingEvent.incomeGrowthRate || 3) / 100,
    assets: {
      cash: Number(editingEvent.cash || 0),
      investments: Number(editingEvent.investments || 0),
      retirement: Number(editingEvent.retirement || 0)
    },
    debts: {
      student: Number(editingEvent.debtStudent || 0),
      credit: Number(editingEvent.debtCredit || 0),
      other: Number(editingEvent.debtOther || 0)
    },
    savingsRate: Number(editingEvent.savingsRate || 0),
    currentAge: spouseCurrentAge,
    lifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' 
      ? Number(editingEvent.spouseLifeExpectancy) 
      : (inputs.lifeExpectancy || 85),
    spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' 
      ? Number(editingEvent.spouseSocialSecurityAge) 
      : 67,
    spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' 
      ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) 
      : 0,
    spouseDesiredRetirementAge,
    desiredRetirementAge: spouseDesiredRetirementAge, // Match existing simulation behavior (null/specified value)
    partnerRetiresWithUser: true,
    retirementSpendingNeed: spouseRetSpendingVal,
    growthRate: Number(editingEvent.incomeGrowthRate || 3),
    combinedSpendingAfterMarriage: combinedSpendingVal,
    housingCost: housingCostAmount,
    lifestyleAdjustment: lifestyleAdjustmentAmount,
    relationshipType: resolvedRelType,
    livingTogether: editingEvent.livingTogether !== false,
    combineFinances: editingEvent.combineFinances !== false
  };
}

export function createMarriageEventObject(editingEvent, inputs) {
  const estimates = calculateMarriageEstimates(editingEvent, inputs);
  const combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
  const spouseRetSpendingVal = estimates ? estimates.spouseRetSpendingVal : 0;
  const housingCostAmount = estimates ? estimates.housingCostAmount : 0;
  const lifestyleAdjustmentAmount = estimates ? estimates.lifestyleAdjustmentAmount : 0;

  const spouseCurrentAge = editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' 
    ? Number(editingEvent.spouseCurrentAge) 
    : Number(inputs.currentAge || 35);

  const spouseDesiredRetirementAge = editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null 
    ? Number(editingEvent.spouseDesiredRetirementAge) 
    : null;

  const resolvedRelType = editingEvent.relationshipType || (editingEvent.type === 'marriage' ? 'married' : (editingEvent.type === 'domesticPartnership' ? 'domestic_partnership' : (editingEvent.type === 'relationshipBegins' ? 'partner' : 'married')));
  const defaultType = resolvedRelType === 'married' ? 'marriage' : (resolvedRelType === 'domestic_partnership' ? 'domesticPartnership' : 'relationshipBegins');
  const eventType = editingEvent.type || defaultType || 'marriage';
  
  const defaultEventName = eventType === 'marriage' ? 'Marriage' : (eventType === 'domesticPartnership' ? 'Domestic Partnership' : 'Relationship Begins');
  const defaultSpouseName = eventType === 'marriage' ? 'Spouse' : 'Partner';

  const isGenericPlaceholder = ['marriage', 'domesticPartnership', 'relationshipBegins'].includes(editingEvent.id);
  const eventId = editingEvent.id && !isGenericPlaceholder ? editingEvent.id : `${eventType}-${Date.now()}`;

  return {
    id: eventId,
    type: eventType,
    enabled: true,
    name: editingEvent.name || defaultEventName,
    age: Number(editingEvent.age),
    spouseName: editingEvent.spouseName || defaultSpouseName,
    spouseIncome: Number(editingEvent.spouseIncome || 0),
    incomeGrowthRate: Number(editingEvent.incomeGrowthRate || 3),
    cash: Number(editingEvent.cash || 0),
    investments: Number(editingEvent.investments || 0),
    retirement: Number(editingEvent.retirement || 0),
    debtStudent: Number(editingEvent.debtStudent || 0),
    debtCredit: Number(editingEvent.debtCredit || 0),
    debtOther: Number(editingEvent.debtOther || 0),
    savingsRate: Number(editingEvent.savingsRate || 0),
    housingOption: editingEvent.housingOption || 'move',
    housingSavings: Number(editingEvent.housingSavings || 0),
    housingCost: housingCostAmount,
    lifestyleOption: editingEvent.lifestyleOption || 'same',
    lifestyleAdjustment: lifestyleAdjustmentAmount,
    includeWeddingCost: !!editingEvent.includeWeddingCost,
    weddingCost: Number(editingEvent.weddingCost || 0),
    weddingFundingMethod: editingEvent.weddingFundingMethod || 'savings',
    weddingAge: Number(editingEvent.weddingAge || editingEvent.age),
    filingStatus: editingEvent.filingStatus || 'jointly',
    spouseCurrentAge,
    spouseLifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' 
      ? Number(editingEvent.spouseLifeExpectancy) 
      : (inputs.lifeExpectancy || 85),
    spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' 
      ? Number(editingEvent.spouseSocialSecurityAge) 
      : 67,
    spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' 
      ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) 
      : 0,
    spouseDesiredRetirementAge,
    desiredRetirementAge: spouseDesiredRetirementAge,
    partnerRetiresWithUser: true,
    retirementSpendingNeed: spouseRetSpendingVal,
    combinedSpendingAfterMarriage: combinedSpendingVal,
    relationshipType: resolvedRelType,
    livingTogether: editingEvent.livingTogether !== false,
    combineFinances: editingEvent.combineFinances !== false
  };
}
