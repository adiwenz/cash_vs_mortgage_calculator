import { describe, test, expect } from 'vitest';
import { getNormalizedPhases } from './src/fireCalculations.js';
import { childEventHandler } from './src/features/fire/events/handlers/childEventHandler.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

// Helper to calculate Wants budget
const getWantsBudget = (inputs) => {
  const normalizedPhases = getNormalizedPhases(inputs);
  const currentAgeVal = inputs.currentAge || 35;
  const matchPhase = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normalizedPhases[0];
  if (!matchPhase || !matchPhase.expenses) return 0;
  return (Number(matchPhase.expenses.leisure) || 0) +
         (Number(matchPhase.expenses.diningOut) || 0) +
         (Number(matchPhase.expenses.misc) || 0);
};

describe('Simplified Child Planning Flow', () => {
  test('1. wantsBudget calculation correctly aggregates Wants categories (leisure + diningOut + misc)', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // Ensure standard budget phase is present
    const normalized = getNormalizedPhases(inputs);
    const workPhase = normalized.find(p => p.type === 'workSave') || normalized[0];
    
    // Explicitly set Wants values in standard expenses
    workPhase.expenses.leisure = 300;
    workPhase.expenses.diningOut = 200;
    workPhase.expenses.misc = 100;
    
    // Setup budgetDetails.phases override
    inputs.budgetDetails = {
      ...inputs.budgetDetails,
      phases: normalized.map(p => p.id === workPhase.id ? workPhase : p)
    };

    const wants = getWantsBudget(inputs);
    expect(wants).toBe(600); // 300 + 200 + 100
  });

  test('2. Path A — proportional rebalancing of Wants categories', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const normalized = getNormalizedPhases(inputs);
    const workPhase = normalized.find(p => p.type === 'workSave') || normalized[0];
    
    workPhase.expenses = {
      ...workPhase.expenses,
      leisure: 300,
      diningOut: 200,
      misc: 100
    };
    
    inputs.budgetDetails = {
      ...inputs.budgetDetails,
      phases: normalized.map(p => p.id === workPhase.id ? workPhase : p)
    };

    const wants = getWantsBudget(inputs);
    expect(wants).toBe(600);

    // Rebalance childcare cost: $400/mo (less than Wants budget of $600)
    const childcareCostMonthly = 400;
    const factor = wants > 0 ? (wants - childcareCostMonthly) / wants : 0; // (600 - 400) / 600 = 1/3
    
    const rebalancedExpenses = {
      ...workPhase.expenses,
      leisure: Math.round(workPhase.expenses.leisure * factor), // 300 * 1/3 = 100
      diningOut: Math.round(workPhase.expenses.diningOut * factor), // 200 * 1/3 = 67
      misc: Math.round(workPhase.expenses.misc * factor) // 100 * 1/3 = 33
    };

    // Total of rebalanced wants is 100 + 67 + 33 = 200 (exact wantsBudget - childcareCostMonthly)
    expect(rebalancedExpenses.leisure + rebalancedExpenses.diningOut + rebalancedExpenses.misc).toBe(200);
  });

  test('3. childEventHandler saves child event with noPromo = true and removes linked promotion', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // Simulate saving a child with noPromo = true (Path A rebalance or Path B Save Anyway)
    const childEvent = {
      id: 'child-no-promo-test',
      type: 'haveChild',
      childName: 'Liam',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 18000,
      noPromo: true
    };

    const saveResult = childEventHandler.save(childEvent, inputs);
    const updatedInputs = saveResult.updatedInputs;
    
    // Verify child is saved
    const savedChild = updatedInputs.lifeEvents.find(e => e.id === 'child-no-promo-test');
    expect(savedChild).toBeDefined();
    
    // Verify NO promotion or Income Goal is in the income list
    const linkedPromoId = savedChild.linkedEventId;
    const hasPromo = updatedInputs.incomeList.some(inc => inc.id === linkedPromoId || inc.parentEventId === savedChild.id);
    expect(hasPromo).toBe(false);
  });

  test('4. Path B — childEventHandler creates linked Income Goal when noPromo is false/undefined', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // Simulate saving a child with noPromo = false and customPromoAmount = 600 * 12 = 7200 (Path B Add Income Goal)
    const childEvent = {
      id: 'child-income-goal-test',
      type: 'haveChild',
      childName: 'Emma',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 18000,
      noPromo: false,
      customPromoAmount: 7200,
      recommendationApplied: true
    };

    const saveResult = childEventHandler.save(childEvent, inputs);
    const updatedInputs = saveResult.updatedInputs;

    // Verify child is saved
    const savedChild = updatedInputs.lifeEvents.find(e => e.id === 'child-income-goal-test');
    expect(savedChild).toBeDefined();

    // Verify linked Income Goal is created in the income list
    const linkedPromoId = savedChild.linkedEventId;
    const incomeGoal = updatedInputs.incomeList.find(inc => inc.id === linkedPromoId || inc.parentEventId === savedChild.id);
    
    expect(incomeGoal).toBeDefined();
    expect(incomeGoal.name).toBe('Income Goal (Emma)');
    expect(incomeGoal.amount).toBe(7200);
    expect(incomeGoal.salaryIncrease).toBe(7200);
  });
});
