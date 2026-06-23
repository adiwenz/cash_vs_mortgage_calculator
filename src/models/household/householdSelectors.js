export function getHouseholdModel(inputs) {
  return inputs?.householdModel || null;
}

export function hasHouseholdModel(inputs) {
  return !!inputs?.householdModel;
}

export function getPrimaryPerson(inputs) {
  return inputs?.householdModel?.people?.self || null;
}

export function getPartnerPerson(inputs) {
  return inputs?.householdModel?.people?.partner || null;
}

export function hasPartner(inputs) {
  if (inputs?.householdModel) {
    return !!inputs.householdModel.people?.partner;
  }
  const status = inputs?.maritalStatus || inputs?.lifeProfile?.household?.status || "single";
  return status === "married" || status === "partnered";
}

export function getPrimaryPersonAge(inputs) {
  if (inputs?.householdModel?.people?.self?.demographics?.currentAge !== undefined && inputs.householdModel.people.self.demographics.currentAge !== null) {
    return inputs.householdModel.people.self.demographics.currentAge;
  }
  return inputs?.currentAge ?? null;
}

export function getPrimaryPersonLifeExpectancy(inputs) {
  if (inputs?.householdModel?.people?.self?.demographics?.lifeExpectancy !== undefined && inputs.householdModel.people.self.demographics.lifeExpectancy !== null) {
    return inputs.householdModel.people.self.demographics.lifeExpectancy;
  }
  return inputs?.lifeExpectancy ?? null;
}

export function getPrimaryPersonRetirementGoalAge(inputs) {
  if (inputs?.householdModel?.people?.self?.work?.desiredStopWorkingAge !== undefined && inputs.householdModel.people.self.work.desiredStopWorkingAge !== null) {
    return inputs.householdModel.people.self.work.desiredStopWorkingAge;
  }
  return inputs?.desiredRetirementAge ?? inputs?.retirementAge ?? inputs?.targetRetirementAge ?? null;
}

export function getHousehold(inputs) {
  return inputs?.householdModel?.household || null;
}

export function getHouseholdRelationshipStatus(inputs) {
  if (inputs?.householdModel?.household?.relationship?.status !== undefined && inputs.householdModel.household.relationship.status !== null) {
    return inputs.householdModel.household.relationship.status;
  }
  return inputs?.maritalStatus ?? inputs?.lifeProfile?.household?.status ?? "single";
}

export function getHouseholdFilingStatus(inputs) {
  if (inputs?.householdModel?.household?.tax?.filingStatus !== undefined && inputs.householdModel.household.tax.filingStatus !== null) {
    return inputs.householdModel.household.tax.filingStatus;
  }
  return inputs?.filingStatus ?? "single";
}

export function getOwnershipMap(inputs) {
  return inputs?.householdModel?.ownership ?? { version: 1, objects: {} };
}

export function getOwnershipForObject(inputs, objectId) {
  const map = getOwnershipMap(inputs);
  return map?.objects?.[objectId] ?? null;
}
