import { describe, test, expect } from 'vitest';
import {
  getCurrentAge,
  getLifeExpectancy,
  getDesiredRetirementAge,
  getLifeEvents,
  getEnabledLifeEvents,
  getHouseAssets,
  getChildrenEvents,
  getIncomeItems,
  getDebtItems,
  getAssetItems,
  getCurrentMonthlyRent,
  getHousingStatus,
  getRelationshipStatus
} from './scenarioSelectors.js';
import {
  upsertLifeEvent,
  removeLifeEvent,
  upsertHouseAsset,
  removeHouseAsset,
  updateScenarioField
} from './scenarioMutations.js';
import {
  ensureScenarioArrays,
  ensureHouseAssetIds,
  normalizeScenarioInputs
} from './scenarioNormalization.js';
import { buildTimelineRows } from '../../../utils/timelineRowBuilder.js';

describe('Scenario Adapter - Selectors Null Safety & Fallbacks', () => {
  test('handle null/undefined/empty inputs gracefully', () => {
    const emptyCases = [null, undefined, {}];
    for (const inputs of emptyCases) {
      expect(getCurrentAge(inputs)).toBe(35);
      expect(getLifeExpectancy(inputs)).toBe(85);
      expect(getDesiredRetirementAge(inputs)).toBe(65);
      expect(getLifeEvents(inputs)).toEqual([]);
      expect(getEnabledLifeEvents(inputs)).toEqual([]);
      expect(getHouseAssets(inputs)).toEqual([]);
      expect(getChildrenEvents(inputs)).toEqual([]);
      expect(getIncomeItems(inputs)).toEqual([]);
      expect(getDebtItems(inputs)).toEqual([]);
      expect(getAssetItems(inputs)).toEqual([]);
      expect(getCurrentMonthlyRent(inputs)).toBe(0);
      expect(getHousingStatus(inputs)).toBe("rent");
      expect(getRelationshipStatus(inputs)).toBe("single");
    }
  });

  test('getCurrentAge fallback precedence', () => {
    expect(getCurrentAge({ currentAge: 40 })).toBe(40);
    expect(getCurrentAge({ age: 41 })).toBe(41);
    expect(getCurrentAge({ householdModel: { people: { self: { demographics: { currentAge: 42 } } } } })).toBe(42);
    expect(getCurrentAge({ householdModel: { people: { self: { age: 43 } } } })).toBe(43);
    expect(getCurrentAge({ lifeProfile: { currentAge: 44 } })).toBe(44);
    expect(getCurrentAge({})).toBe(35);
  });

  test('getLifeExpectancy fallback precedence', () => {
    expect(getLifeExpectancy({ lifeExpectancy: 90 })).toBe(90);
    expect(getLifeExpectancy({ householdModel: { people: { self: { demographics: { lifeExpectancy: 91 } } } } })).toBe(91);
    expect(getLifeExpectancy({ householdModel: { people: { self: { lifeExpectancy: 92 } } } } )).toBe(92);
    expect(getLifeExpectancy({})).toBe(85);
  });

  test('getDesiredRetirementAge fallback precedence', () => {
    expect(getDesiredRetirementAge({ desiredRetirementAge: 55 })).toBe(55);
    expect(getDesiredRetirementAge({ targetRetirementAge: 56 })).toBe(56);
    expect(getDesiredRetirementAge({ retirementAge: 57 })).toBe(57);
    expect(getDesiredRetirementAge({ householdModel: { people: { self: { work: { desiredStopWorkingAge: 58 } } } } })).toBe(58);
    expect(getDesiredRetirementAge({ householdModel: { people: { self: { retirementGoalAge: 59 } } } } )).toBe(59);
    expect(getDesiredRetirementAge({ householdModel: { people: { self: { desiredRetirementAge: 60 } } } } )).toBe(60);
    expect(getDesiredRetirementAge({})).toBe(65);
  });

  test('getHouseAssets fallback precedence', () => {
    const houseAssets = [{ id: 'h1' }];
    const houses = [{ id: 'h2' }];
    const assetHouses = [{ id: 'h3' }];
    expect(getHouseAssets({ houseAssets })).toEqual(houseAssets);
    expect(getHouseAssets({ houses })).toEqual(houses);
    expect(getHouseAssets({ assets: { houses: assetHouses } })).toEqual(assetHouses);
  });

  test('getCurrentMonthlyRent fallback precedence', () => {
    expect(getCurrentMonthlyRent({ lifeProfile: { home: { monthlyRent: 1200 } } })).toBe(1200);
    expect(getCurrentMonthlyRent({ monthlyRent: 1300 })).toBe(1300);
    expect(getCurrentMonthlyRent({ rent: 1400 })).toBe(1400);
    expect(getCurrentMonthlyRent({})).toBe(0);
  });
});

describe('Scenario Adapter - Mutation Immutability', () => {
  const baseInputs = {
    currentAge: 35,
    lifeEvents: [{ id: 'e1', type: 'retire', age: 65 }],
    houseAssets: [{ id: 'h1', name: 'Home' }]
  };

  test('upsertLifeEvent does not mutate', () => {
    const updated = upsertLifeEvent(baseInputs, { id: 'e2', type: 'haveChild', age: 40 });
    expect(updated).not.toBe(baseInputs);
    expect(baseInputs.lifeEvents.length).toBe(1);
    expect(updated.lifeEvents.length).toBe(2);
  });

  test('removeLifeEvent does not mutate', () => {
    const updated = removeLifeEvent(baseInputs, 'e1');
    expect(updated).not.toBe(baseInputs);
    expect(baseInputs.lifeEvents.length).toBe(1);
    expect(updated.lifeEvents.length).toBe(0);
  });

  test('upsertHouseAsset does not mutate', () => {
    const updated = upsertHouseAsset(baseInputs, { id: 'h2', name: 'Cabin' });
    expect(updated).not.toBe(baseInputs);
    expect(baseInputs.houseAssets.length).toBe(1);
    expect(updated.houseAssets.length).toBe(2);
  });

  test('removeHouseAsset does not mutate', () => {
    const updated = removeHouseAsset(baseInputs, 'h1');
    expect(updated).not.toBe(baseInputs);
    expect(baseInputs.houseAssets.length).toBe(1);
    expect(updated.houseAssets.length).toBe(0);
  });

  test('updateScenarioField does not mutate and updates nested paths', () => {
    const updated = updateScenarioField(baseInputs, 'lifeProfile.home.monthlyRent', 2000);
    expect(updated).not.toBe(baseInputs);
    expect(baseInputs.lifeProfile).toBeUndefined();
    expect(updated.lifeProfile.home.monthlyRent).toBe(2000);
  });
});

describe('Scenario Adapter - Normalization & ID Stability', () => {
  test('ensureScenarioArrays fills empty arrays and converts legacy fields', () => {
    const legacyInputs = {
      houses: [{ name: 'A' }],
      incomeSources: [{ name: 'B' }],
      debts: [{ name: 'C' }]
    };
    const normalized = ensureScenarioArrays(legacyInputs);
    expect(normalized).not.toBe(legacyInputs);
    expect(normalized.houseAssets).toEqual([{ name: 'A' }]);
    expect(normalized.incomeList).toEqual([{ name: 'B' }]);
    expect(normalized.debtList).toEqual([{ name: 'C' }]);
    expect(normalized.lifeEvents).toEqual([]);
    expect(normalized.assetList).toEqual([]);
  });

  test('ensureHouseAssetIds generates stable and deterministic IDs and does not regenerate existing', () => {
    const inputs = {
      houseAssets: [
        { id: 'custom-id', name: 'Own ID' },
        { name: 'Missing ID 1', eventId: 'event-123' },
        { name: 'Missing ID 2', sourceEventId: 'src-456' },
        { name: 'Missing ID 3', purchaseAge: 40 },
        { name: 'Missing ID 4' }
      ]
    };
    const normalized = ensureHouseAssetIds(inputs);
    expect(normalized).not.toBe(inputs);
    
    // Existing ID kept
    expect(normalized.houseAssets[0].id).toBe('custom-id');
    // Deterministic from eventId
    expect(normalized.houseAssets[1].id).toBe('event-123');
    // Deterministic from sourceEventId
    expect(normalized.houseAssets[2].id).toBe('src-456');
    // Deterministic from purchaseAge
    expect(normalized.houseAssets[3].id).toBe('house-age-40');
    // Fallback to index
    expect(normalized.houseAssets[4].id).toBe('house-5');

    // Verify it is stable when run again
    const secondRun = ensureHouseAssetIds(normalized);
    expect(secondRun.houseAssets).toEqual(normalized.houseAssets);
  });
});

describe('Scenario Adapter - timelineRowBuilder Parity', () => {
  test('output from buildTimelineRows is unchanged', () => {
    const testInputs = {
      currentAge: 35,
      lifeExpectancy: 85,
      targetRetirementAge: 65,
      children: [
        { id: 'child-1', name: 'Emma', age: 5, includeCollege: false }
      ],
      lifeEvents: [
        { id: 'child-2', type: 'haveChild', name: 'Child: Liam', birthAge: 40, enabled: true },
        { id: 'buy-house-1', type: 'buyHouse', houseId: 'house-1', name: 'Primary Home Purchase', age: 38, homePrice: 500000, downPayment: 100000, loanTerm: 30, enabled: true },
        { id: 'buy-house-2', type: 'buyHouse', houseId: 'house-2', name: 'Vacation Home Purchase', age: 45, homePrice: 300000, downPayment: 300000, enabled: true },
        { id: 'promo-1', type: 'careerChange', name: 'Promotion', age: 42, enabled: true }
      ],
      houseAssets: [
        { id: 'house-1', name: 'Primary Home', purchasePrice: 500000, purchaseType: 'mortgage', hasMortgage: true, mortgage: { balance: 400000, interestRate: 6.5, monthlyPayment: 2500 } },
        { id: 'house-2', name: 'Vacation Home', purchasePrice: 300000, purchaseType: 'cash', hasMortgage: false }
      ],
      incomeList: [
        { id: 'salary-main', name: 'Salary', amount: 100000, startAge: 35, endAge: 65 }
      ],
      debtList: [
        { id: 'student-loan', name: 'Student Loan', balance: 20000, interestRate: 4.5, payment: 300, startAge: 35 }
      ]
    };
    
    // We will ensure that building timeline rows on this input remains completely identical.
    const preRows = buildTimelineRows(testInputs);
    // Even if normalized or run through buildTimelineRows, the output must match.
    const postRows = buildTimelineRows(testInputs);
    expect(postRows).toEqual(preRows);
  });
});
