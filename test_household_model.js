import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import {
  normalizeHouseholdModel,
  createEmptyOwnershipMap,
  createSelfPersonFromLegacyInputs,
  createHouseholdFromLegacyInputs
} from './src/models/household/index.js';

describe('Household Data Model Foundation Tests', () => {
  describe('createEmptyOwnershipMap', () => {
    test('returns correct structure', () => {
      const map = createEmptyOwnershipMap();
      expect(map).toEqual({
        version: 1,
        objects: {}
      });
    });
  });

  describe('normalizeHouseholdModel', () => {
    test('Default Scenario creates people.self and maps default inputs', () => {
      const result = normalizeHouseholdModel(DEFAULT_FIRE_INPUTS);

      expect(result.schemaVersion).toBe(1);
      expect(result.people.self).toBeDefined();
      expect(result.people.self.id).toBe('self');
      expect(result.people.self.role).toBe('self');
      expect(result.people.self.displayName).toBe('You');
      expect(result.people.self.demographics.currentAge).toBe(35);
      expect(result.people.self.demographics.lifeExpectancy).toBe(85);
      expect(result.people.self.work.desiredStopWorkingAge).toBe(65);

      // Social Security check from DEFAULT_FIRE_INPUTS
      expect(result.people.self.benefits.socialSecurity.enabled).toBe(true);
      expect(result.people.self.benefits.socialSecurity.claimAge).toBe(67);
      expect(result.people.self.benefits.socialSecurity.ageStartedWorking).toBe(22);

      expect(result.people.self.income.incomeIds).toEqual([]);
      expect(result.people.self.assets.assetIds).toEqual([]);
      expect(result.people.self.debts.debtIds).toEqual([]);

      // Household structure
      expect(result.household.id).toBe('household');
      expect(result.household.relationship.status).toBe('single');
      expect(result.household.tax.filingStatus).toBe('single');

      // Migration metadata
      expect(result.migration.createdFromLegacy).toBe(true);
      expect(result.migration.schemaVersion).toBe(1);
      expect(result.migration.createdAt).toBeDefined();
      expect(new Date(result.migration.createdAt).getTime()).not.toBeNaN();
    });

    test('Married Mapping maps maritalStatus and filingStatus', () => {
      const inputs = {
        ...DEFAULT_FIRE_INPUTS,
        maritalStatus: 'married',
        filingStatus: 'married_filing_jointly'
      };

      const result = normalizeHouseholdModel(inputs);
      expect(result.household.relationship.status).toBe('married');
      expect(result.household.tax.filingStatus).toBe('married_filing_jointly');
    });

    test('Default Mapping maps missing marital status to single', () => {
      const inputs = {
        currentAge: 40,
        lifeExpectancy: 90
      };

      const result = normalizeHouseholdModel(inputs);
      expect(result.household.relationship.status).toBe('single');
      expect(result.household.tax.filingStatus).toBe('single');
    });

    test('Existing Model Preservation returns the exact same model if schemaVersion is 1', () => {
      const existingModel = {
        schemaVersion: 1,
        people: {
          self: { id: 'self', role: 'self', displayName: 'Modified Name' }
        },
        household: { id: 'household', relationship: { status: 'married' } },
        ownership: { version: 1, objects: { 'asset-1': 'joint' } },
        migration: { createdFromLegacy: false }
      };

      const inputs = {
        householdModel: existingModel
      };

      const result = normalizeHouseholdModel(inputs);
      expect(result).toBe(existingModel);
    });

    test('No Mutation ensures input object is not mutated', () => {
      const inputs = {
        currentAge: 35,
        lifeExpectancy: 85,
        targetRetirementAge: 65,
        socialSecurity: { enabled: true, claimAge: 67 }
      };

      const originalJson = JSON.stringify(inputs);

      normalizeHouseholdModel(inputs);

      expect(JSON.stringify(inputs)).toBe(originalJson);
    });
  });
});
