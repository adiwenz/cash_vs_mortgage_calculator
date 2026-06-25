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

  return {
    id: 'spouse',
    name: 'Spouse',
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
    lifestyleAdjustment: lifestyleAdjustmentAmount
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

  return {
    id: editingEvent.id && editingEvent.id !== 'marriage' ? editingEvent.id : `marriage-${Date.now()}`,
    type: 'marriage',
    enabled: true,
    name: 'Marriage',
    age: Number(editingEvent.age),
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
    combinedSpendingAfterMarriage: combinedSpendingVal
  };
}
