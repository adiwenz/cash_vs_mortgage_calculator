import { calculateUSTaxForModal } from '../../../simulatorMathUtils.js';

export function calculateCombinedIncome(userIncome, spouseIncome) {
  return Number(userIncome || 0) + Number(spouseIncome || 0);
}

export function getSavingsBreakdown(editingEvent, inputs) {
  const curHousing = inputs.budgetDetails?.expenses?.housing !== undefined ? Number(inputs.budgetDetails.expenses.housing) : 1500;
  const curUtilities = inputs.budgetDetails?.expenses?.utilities !== undefined ? Number(inputs.budgetDetails.expenses.utilities) : 400;
  const curInternet = inputs.budgetDetails?.expenses?.internet !== undefined ? Number(inputs.budgetDetails.expenses.internet) : 100;
  const curStreaming = inputs.budgetDetails?.expenses?.streaming !== undefined ? Number(inputs.budgetDetails.expenses.streaming) : 60;
  const curHouseholdGoods = inputs.budgetDetails?.expenses?.householdGoods !== undefined ? Number(inputs.budgetDetails.expenses.householdGoods) : 500;

  const housing = curHousing > 0 ? Math.round(curHousing * 0.5) : 750;
  const utilities = curUtilities > 0 ? Math.round(curUtilities * 0.25) : 100;
  const internet = curInternet > 0 ? Math.round(curInternet * 0.5) : 50;
  const streaming = curStreaming > 0 ? Math.round(curStreaming * 0.5) : 30;
  const otherShared = curHouseholdGoods > 0 ? Math.round(curHouseholdGoods * 0.1) : 50;
  
  const total = housing + utilities + internet + streaming + otherShared;
  
  return {
    housing,
    utilities,
    internet,
    streaming,
    otherShared,
    total
  };
}

export function calculateMarriageEstimates(editingEvent, inputs) {
  if (!editingEvent) return null;

  const spouseIncome = Number(editingEvent.spouseIncome) || 0;
  const savingsRate = Number(editingEvent.savingsRate) || 0;
  const partnerSavings = spouseIncome * (savingsRate / 100);
  const partnerTax = inputs?.includeTaxes ? calculateUSTaxForModal(spouseIncome, partnerSavings, 'single') : 0;
  const partnerTakeHome = spouseIncome - partnerTax;
  const partnerTakeHomeRemaining = Math.max(0, partnerTakeHome - partnerSavings);

  // Calculate user spending baseline pre-retirement
  let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
  const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
  if (initialPhase) {
    if (initialPhase.frequency === 'monthly') {
      userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
    } else if (initialPhase.frequency === 'yearly') {
      userSpendingPreRetirement = Number(initialPhase.amount) || 0;
    } else {
      userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
    }
  }

  const curSavings = getSavingsBreakdown(editingEvent, inputs);
  const totalSavingsAmount = curSavings.total * 12;

  const combinedSpendingVal = Math.round(
    Math.max(0, userSpendingPreRetirement + 
    partnerTakeHomeRemaining - 
    totalSavingsAmount)
  );

  const spousePreRetirementSpending = Math.max(0, combinedSpendingVal - userSpendingPreRetirement);
  const userRetirePercent = Number((inputs?.lifeEvents || []).find(e => e.type === 'retire')?.spendingPercent || 70) / 100;
  const spouseRetSpendingVal = editingEvent.retirementSpendingNeed !== undefined && editingEvent.retirementSpendingNeed !== '' && editingEvent.retirementSpendingNeed !== null 
    ? Number(editingEvent.retirementSpendingNeed) 
    : Math.round(spousePreRetirementSpending * userRetirePercent);

  return {
    userSpendingPreRetirement,
    partnerTakeHomeRemaining,
    currentHousingCost: inputs.budgetDetails?.expenses?.housing !== undefined ? Number(inputs.budgetDetails.expenses.housing) : 1500,
    housingOption: 'move',
    housingCostAmount: - curSavings.housing * 12,
    sharedCostSavingsAmount: - (curSavings.utilities + curSavings.internet + curSavings.streaming + curSavings.otherShared) * 12,
    lifestyleOption: 'same',
    lifestyleAdjustmentAmount: 0,
    combinedSpendingVal,
    spousePreRetirementSpending,
    spouseRetSpendingVal,
    partnerSavings,
    partnerTax,
    savingsBreakdown: curSavings
  };
}

export function calculatePartnerRetirementAge(
  spouseDesiredRetirementAge,
  targetRetirementAge,
  spouseCurrentAge,
  userCurrentAge
) {
  if (spouseDesiredRetirementAge !== undefined && spouseDesiredRetirementAge !== null && spouseDesiredRetirementAge !== '') {
    return Number(spouseDesiredRetirementAge);
  }
  return Number(targetRetirementAge) + (Number(spouseCurrentAge) - Number(userCurrentAge));
}
