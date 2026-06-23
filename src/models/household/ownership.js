import { OWNER_TYPES } from './constants.js';

export function createPersonOwnership(personId) {
  return {
    ownerType: OWNER_TYPES.PERSON || "person",
    ownerIds: [personId],
    shares: {
      [personId]: 1
    }
  };
}

export function createHouseholdOwnership() {
  return {
    ownerType: OWNER_TYPES.HOUSEHOLD || "household",
    ownerIds: ["household"],
    shares: {}
  };
}

export function createJointOwnership(ownerIds, shares = {}) {
  return {
    ownerType: OWNER_TYPES.JOINT || "joint",
    ownerIds: Array.isArray(ownerIds) ? ownerIds : [],
    shares: shares || {}
  };
}

export function buildLegacyOwnershipMap(inputs) {
  const objects = {};

  if (!inputs) {
    return {
      version: 1,
      objects
    };
  }

  // 1. Income List
  const incomes = inputs.incomeList || inputs.incomeSources || [];
  if (Array.isArray(incomes)) {
    incomes.forEach((inc, index) => {
      const key = inc.id || `income:${index}`;
      objects[key] = createPersonOwnership("self");
    });
  }

  // 2. Assets (flat assets keys and list houseAssets/assetList)
  if (Array.isArray(inputs.assets)) {
    inputs.assets.forEach((asset, index) => {
      const key = asset.id || `asset:${index}`;
      objects[key] = createPersonOwnership("self");
    });
  } else if (inputs.assets && typeof inputs.assets === 'object') {
    Object.keys(inputs.assets).forEach(key => {
      if (key !== 'debts') {
        objects[key] = createPersonOwnership("self");
      }
    });
  }

  const houseAssets = inputs.houseAssets || [];
  if (Array.isArray(houseAssets)) {
    houseAssets.forEach((asset, index) => {
      const key = asset.id || `asset:${index}`;
      objects[key] = createPersonOwnership("self");
    });
  }

  const customAssets = inputs.assetList || [];
  if (Array.isArray(customAssets)) {
    customAssets.forEach((asset, index) => {
      const key = asset.id || `customAsset:${index}`;
      objects[key] = createPersonOwnership("self");
    });
  }

  // 3. Debts
  const debts = inputs.debtList || [];
  if (Array.isArray(debts)) {
    debts.forEach((debt, index) => {
      const key = debt.id || `debt:${index}`;
      objects[key] = createPersonOwnership("self");
    });
  }

  // 4. Social Security (flat field)
  if (inputs.socialSecurity) {
    objects["socialSecurity"] = createPersonOwnership("self");
  }

  // 5. Events
  const lifeEvents = inputs.lifeEvents || [];
  if (Array.isArray(lifeEvents)) {
    lifeEvents.forEach((evt, index) => {
      const key = evt.id || `event:${index}`;
      const type = evt.type || "";
      const lowerType = type.toLowerCase();

      // Conservative event type mapping:
      // - child / createChild / childcare -> household
      // - house / housePurchase / buyHome / housing / mortgage -> household
      // - marriage / divorce / wedding -> household
      // - move / relocate -> household
      if (
        lowerType.includes('child') ||
        lowerType.includes('house') ||
        lowerType.includes('home') ||
        lowerType.includes('housing') ||
        lowerType.includes('mortgage') ||
        lowerType.includes('marriage') ||
        lowerType.includes('divorce') ||
        lowerType.includes('wedding') ||
        lowerType.includes('move') ||
        lowerType.includes('relocate')
      ) {
        objects[key] = createHouseholdOwnership();
      } else {
        // careerChange / incomeChange / promotion / socialSecurity / retirementGoal -> self
        // unknown -> self
        objects[key] = createPersonOwnership("self");
      }
    });
  }

  return {
    version: 1,
    objects
  };
}
