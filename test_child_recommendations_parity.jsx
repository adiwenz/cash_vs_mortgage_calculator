import { describe, test, expect } from 'vitest';
import { generateChildRecommendations } from './src/domain/events/child/childRecommendations.js';
import { useRecommendations } from './src/hooks/useRecommendations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { runFireSimulation } from './src/fireCalculations.js';

describe('Child Event Recommendations - Mobile and Desktop Parity', () => {
  test('verify that generateChildRecommendations output is identical for both contexts', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.simpleIncome = 100000;
    inputs.simpleExpenses = 60000;

    const childEvent = {
      id: 'child-emma',
      type: 'haveChild',
      enabled: true,
      name: 'Have Emma',
      childName: 'Emma',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 15000,
      customAges5to12: 15000,
      customAges13to18: 15000,
      customAges19to22: 15000,
      includeCollege: false
    };
    inputs.lifeEvents = [childEvent];

    const currentReadyAge = 75;

    // 1. Generate directly from the domain function (which both desktop useRecommendations and mobile EventWizard call)
    const recs = generateChildRecommendations(inputs, currentReadyAge);

    // Verify we have all 3 types of recommendations: promotion/income increase, budget rebalance, save more
    expect(recs).toHaveLength(3);

    const promotionRec = recs.find(r => r.type.startsWith('childPromotion'));
    const budgetRec = recs.find(r => r.type.startsWith('childBudgetRebalance'));
    const saveMoreRec = recs.find(r => r.type.startsWith('childSaveMore'));

    expect(promotionRec).toBeDefined();
    expect(promotionRec.title).toBe('Get a Promotion');
    expect(promotionRec.savingsFocus).toBe('Earn More');
    expect(promotionRec.value).toBe(15000);

    expect(budgetRec).toBeDefined();
    expect(budgetRec.title).toBe('Reallocate Budget');
    expect(budgetRec.savingsFocus).toBe('Save More');

    expect(saveMoreRec).toBeDefined();
    expect(saveMoreRec.title).toBe('Save More / Spend Less');
    expect(saveMoreRec.savingsFocus).toBe('Save More');
  });
});
