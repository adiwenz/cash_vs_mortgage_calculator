export function getCurrentAge(inputs) {
  return inputs?.currentAge ?? 
         inputs?.age ?? 
         inputs?.householdModel?.people?.self?.demographics?.currentAge ?? 
         inputs?.householdModel?.people?.self?.age ?? 
         inputs?.lifeProfile?.currentAge ?? 
         35;
}

export function getLifeExpectancy(inputs) {
  return inputs?.lifeExpectancy ?? 
         inputs?.householdModel?.people?.self?.demographics?.lifeExpectancy ?? 
         inputs?.householdModel?.people?.self?.lifeExpectancy ?? 
         85;
}

export function getDesiredRetirementAge(inputs) {
  return inputs?.desiredRetirementAge ?? 
         inputs?.targetRetirementAge ?? 
         inputs?.retirementAge ?? 
         inputs?.householdModel?.people?.self?.work?.desiredStopWorkingAge ?? 
         inputs?.householdModel?.people?.self?.retirementGoalAge ?? 
         inputs?.householdModel?.people?.self?.desiredRetirementAge ?? 
         65;
}

export function getLifeEvents(inputs) {
  return inputs?.lifeEvents ?? [];
}

export function getEnabledLifeEvents(inputs) {
  return (inputs?.lifeEvents ?? []).filter(e => e && e.enabled !== false);
}

export function getHouseAssets(inputs) {
  if (!inputs) return [];
  if (Array.isArray(inputs.houseAssets)) return inputs.houseAssets;
  if (Array.isArray(inputs.houses)) return inputs.houses;
  if (Array.isArray(inputs.assets?.houses)) return inputs.assets.houses;
  return [];
}

export function getChildrenEvents(inputs) {
  return (inputs?.lifeEvents ?? []).filter(
    e => e && (e.type === 'haveChild' || e.type === 'child' || e.type === 'createChild')
  );
}

export function getIncomeItems(inputs) {
  return inputs?.incomeList ?? inputs?.incomeSources ?? [];
}

export function getDebtItems(inputs) {
  return inputs?.debtList ?? inputs?.debts ?? [];
}

export function getAssetItems(inputs) {
  return inputs?.assetList ?? [];
}

export function getCurrentMonthlyRent(inputs) {
  return inputs?.lifeProfile?.home?.monthlyRent ?? 
         inputs?.monthlyRent ?? 
         inputs?.rent ?? 
         0;
}

export function getHousingStatus(inputs) {
  return inputs?.lifeProfile?.home?.status ?? 
         inputs?.housingStatus ?? 
         "rent";
}

export function getRelationshipStatus(inputs) {
  return inputs?.maritalStatus ?? 
         inputs?.lifeProfile?.household?.status ?? 
         "single";
}
