export function createSelfPersonFromLegacyInputs(inputs) {
  const currentAge = inputs?.currentAge !== undefined && inputs.currentAge !== null && !isNaN(Number(inputs.currentAge))
    ? Number(inputs.currentAge)
    : 35;

  const lifeExpectancy = inputs?.lifeExpectancy !== undefined && inputs.lifeExpectancy !== null && !isNaN(Number(inputs.lifeExpectancy))
    ? Number(inputs.lifeExpectancy)
    : 85;

  let desiredStopWorkingAge = 65;
  if (inputs?.desiredStopWorkingAge !== undefined && inputs.desiredStopWorkingAge !== null && !isNaN(Number(inputs.desiredStopWorkingAge))) {
    desiredStopWorkingAge = Number(inputs.desiredStopWorkingAge);
  } else if (inputs?.targetRetirementAge !== undefined && inputs.targetRetirementAge !== null && !isNaN(Number(inputs.targetRetirementAge))) {
    desiredStopWorkingAge = Number(inputs.targetRetirementAge);
  } else if (Array.isArray(inputs?.lifeEvents)) {
    const retireEvent = inputs.lifeEvents.find(e => e.type === 'retire' && e.enabled);
    if (retireEvent && retireEvent.age !== undefined && retireEvent.age !== null && !isNaN(Number(retireEvent.age))) {
      desiredStopWorkingAge = Number(retireEvent.age);
    }
  }

  let ssEnabled = false;
  let ssClaimAge = 67;
  let ssAgeStartedWorking = 22;

  if (inputs?.socialSecurity) {
    if (inputs.socialSecurity.enabled !== undefined) {
      ssEnabled = !!inputs.socialSecurity.enabled;
    }
    const legacyClaimAge = inputs.socialSecurity.claimAge ?? inputs.socialSecurity.claimingAge;
    if (legacyClaimAge !== undefined && legacyClaimAge !== null && !isNaN(Number(legacyClaimAge))) {
      ssClaimAge = Number(legacyClaimAge);
    }
    if (inputs.socialSecurity.ageStartedWorking !== undefined && inputs.socialSecurity.ageStartedWorking !== null && !isNaN(Number(inputs.socialSecurity.ageStartedWorking))) {
      ssAgeStartedWorking = Number(inputs.socialSecurity.ageStartedWorking);
    }
  }

  if (Array.isArray(inputs?.lifeEvents)) {
    const ssEvent = inputs.lifeEvents.find(e => e.type === 'socialSecurity');
    if (ssEvent) {
      if (ssEvent.enabled !== undefined) {
        ssEnabled = !!ssEvent.enabled;
      }
      const eventClaimAge = ssEvent.claimingAge ?? ssEvent.claimAge;
      if (eventClaimAge !== undefined && eventClaimAge !== null && !isNaN(Number(eventClaimAge))) {
        ssClaimAge = Number(eventClaimAge);
      }
      if (ssEvent.ageStartedWorking !== undefined && ssEvent.ageStartedWorking !== null && !isNaN(Number(ssEvent.ageStartedWorking))) {
        ssAgeStartedWorking = Number(ssEvent.ageStartedWorking);
      }
    }
  }

  return {
    id: "self",
    role: "self",
    displayName: "You",
    demographics: {
      currentAge,
      lifeExpectancy
    },
    work: {
      desiredStopWorkingAge
    },
    benefits: {
      socialSecurity: {
        enabled: ssEnabled,
        claimAge: ssClaimAge,
        ageStartedWorking: ssAgeStartedWorking
      }
    },
    income: {
      incomeIds: []
    },
    assets: {
      assetIds: []
    },
    debts: {
      debtIds: []
    }
  };
}

export function createHouseholdFromLegacyInputs(inputs) {
  let status = "single";
  if (inputs?.maritalStatus) {
    status = inputs.maritalStatus;
  } else if (inputs?.lifeProfile?.household?.status) {
    status = inputs.lifeProfile.household.status;
  }

  const legalStatus = inputs?.legalStatus ?? undefined;

  let filingStatus = "single";
  if (inputs?.filingStatus) {
    filingStatus = inputs.filingStatus;
  }

  return {
    id: "household",
    relationship: {
      status,
      legalStatus
    },
    tax: {
      filingStatus
    },
    budget: {},
    children: {},
    housing: {}
  };
}

export function createEmptyOwnershipMap() {
  return {
    version: 1,
    objects: {}
  };
}
