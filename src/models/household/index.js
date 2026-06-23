import {
  createSelfPersonFromLegacyInputs,
  createHouseholdFromLegacyInputs
} from './factories.js';
import {
  buildLegacyOwnershipMap
} from './ownership.js';

export function normalizeHouseholdModel(inputs) {
  if (inputs?.householdModel?.schemaVersion === 1) {
    return inputs.householdModel;
  }

  return {
    schemaVersion: 1,
    people: {
      self: createSelfPersonFromLegacyInputs(inputs)
    },
    household: createHouseholdFromLegacyInputs(inputs),
    ownership: buildLegacyOwnershipMap(inputs),
    migration: {
      createdFromLegacy: true,
      createdAt: new Date().toISOString(),
      schemaVersion: 1
    }
  };
}

export * from './constants.js';
export * from './factories.js';
export * from './ownership.js';

