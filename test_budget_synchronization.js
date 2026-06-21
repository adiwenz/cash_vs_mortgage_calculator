import { expect } from './test_helper.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { syncBudgetDetails } from './src/calculators/fire/index.js';
import { derivePhasesFromEvents } from './src/calculators/fire/phases.js';

console.log('--- Running test_budget_synchronization ---');

try {
  // Test Case 1: Raising savings rate reduces Wants first.
  // Default base budget: Needs = 2900, Wants = 642. Total spending = 3542.
  // Income = 50,000/yr ($4167/mo).
  // Default savings is 15% ($625/mo).
  // If we raise savings rate to 20% ($833/mo):
  // Target spending = 4167 - 833 = 3334.
  // Since 3334 > 2900 (Needs), Wants should be reduced to 3334 - 2900 = 434.
  // Needs should remain 2900.
  const sync1 = syncBudgetDetails(50000, 50000 * 0.80, DEFAULT_FIRE_INPUTS.budgetDetails);
  const exp1 = sync1.budgetDetails.expenses;
  const wantsSum1 = (exp1.diningOut || 0) + (exp1.leisure || 0) + (exp1.misc || 0);
  const needsSum1 = (exp1.housing || 0) + (exp1.utilities || 0) + (exp1.food || 0) + (exp1.transportation || 0) + (exp1.healthcare || 0);

  expect(needsSum1).toBe(2900);
  expect(Math.round(wantsSum1 * 100) / 100).toBe(433.34);
  expect(sync1.autoReducedBudget).toBe(true);
  expect(sync1.reducedWants).toBe(true);
  expect(sync1.reducedNeeds).toBe(false);
  expect(sync1.isFullSavingsRate).toBe(false);
  console.log('✅ Test Case 1 passed: Raising savings rate reduces Wants first.');

  // Test Case 2: Raising savings rate beyond Wants reduces Needs.
  // If we raise savings rate to 50% ($2084/mo):
  // Target spending = 4167 - 2084 = 2083.
  // Since 2083 < 2900 (Needs), Wants should be 0.
  // Needs should be reduced to 2083.
  const sync2 = syncBudgetDetails(50000, 50000 * 0.50, DEFAULT_FIRE_INPUTS.budgetDetails);
  const exp2 = sync2.budgetDetails.expenses;
  const wantsSum2 = (exp2.diningOut || 0) + (exp2.leisure || 0) + (exp2.misc || 0);
  const needsSum2 = (exp2.housing || 0) + (exp2.utilities || 0) + (exp2.food || 0) + (exp2.transportation || 0) + (exp2.healthcare || 0);

  expect(wantsSum2).toBe(0);
  expect(Math.round(needsSum2 * 100) / 100).toBe(2083.33);
  expect(sync2.autoReducedBudget).toBe(true);
  expect(sync2.reducedWants).toBe(true);
  expect(sync2.reducedNeeds).toBe(true);
  expect(sync2.isFullSavingsRate).toBe(false);
  console.log('✅ Test Case 2 passed: Raising savings rate beyond Wants reduces Needs.');

  // Test Case 3: 100% savings sets Wants/Flexible Needs to $0, keeps Fixed/Required needs.
  // If savingsRate is 100%:
  // Wants should be 0.
  // Needs should remain at fixed required obligations sum ($1500 housing + $300 healthcare = 1800).
  // Savings should be 4166.67 - 1800 = 2366.67.
  const sync3 = syncBudgetDetails(50000, 0, DEFAULT_FIRE_INPUTS.budgetDetails);
  const exp3 = sync3.budgetDetails.expenses;
  const wantsSum3 = (exp3.diningOut || 0) + (exp3.leisure || 0) + (exp3.misc || 0);
  const needsSum3 = (exp3.housing || 0) + (exp3.utilities || 0) + (exp3.food || 0) + (exp3.transportation || 0) + (exp3.healthcare || 0);
  const savingsSum3 = Object.values(sync3.budgetDetails.savings).reduce((a, b) => a + b, 0);

  expect(wantsSum3).toBe(0);
  expect(needsSum3).toBe(1800);
  expect(Math.round(savingsSum3 * 100) / 100).toBe(2366.67);
  expect(sync3.autoReducedBudget).toBe(true);
  expect(sync3.isFullSavingsRate).toBe(true);
  console.log('✅ Test Case 3 passed: 100% savings sets Needs/Wants to $0.');

  // Test Case 4: Manual budget edits prevent future savings-rate changes from overwriting the budget.
  // We simulate inputs with hasCustomizedBudget: true.
  // When we run derivePhasesFromEvents, the budget details should NOT be overwritten by the savings rate.
  const customInputs = {
    ...DEFAULT_FIRE_INPUTS,
    hasCustomizedBudget: true,
    simpleIncome: 50000,
    simpleExpenses: 42500, // Derived from 15% savings rate
    budgetDetails: {
      expenses: {
        housing: 2000, // Custom housing
        utilities: 300,
        food: 400,
        diningOut: 200,
        transportation: 400,
        healthcare: 300,
        leisure: 300,
        misc: 142
      },
      savings: {
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 625, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      }
    }
  };

  // Run derivePhasesFromEvents with the custom inputs
  const phases = derivePhasesFromEvents(customInputs, customInputs.lifeEvents || []);
  const workPhase = phases.find(p => p.type === 'workSave');
  
  // Verify that the custom housing expense (2000) is preserved
  expect(workPhase.expenses.housing).toBe(2000);
  console.log('✅ Test Case 4 passed: Manual budget edits prevent overwriting.');

  // Test Case 5: With no fixed obligations, changing income preserves the savings rate.
  const emptyBudgetDetails = {
    expenses: { housing: 0, healthcare: 0, food: 400, transportation: 400, utilities: 300, diningOut: 200, leisure: 300, misc: 142 },
    savings: { brokerage: 625 }
  };
  const sync5 = syncBudgetDetails(10000, 10000 * 0.85, emptyBudgetDetails);
  expect(sync5.displayedSavingsRate).toBe(15);
  expect(sync5.budgetShortfall).toBe(0);
  console.log('✅ Test Case 5 passed: Changing income preserves displayed savings rate if possible.');

  // Test Case 6: With fixed obligations exceeding income, displayed savings rate clamps to 0% and shortfall appears.
  // Rent/housing is $1500/mo. Other expenses are flexible or wants.
  // Income changes from $50,000 to $100/yr ($8.33/mo).
  const fixedBudgetDetails = {
    expenses: { housing: 1500, healthcare: 0, food: 400, transportation: 400, utilities: 300, diningOut: 200, leisure: 300, misc: 142 },
    savings: { brokerage: 625 }
  };
  const sync6 = syncBudgetDetails(100, 100 * 0.85, fixedBudgetDetails);
  expect(sync6.displayedSavingsRate).toBe(0);
  expect(Math.round(sync6.budgetShortfall * 100) / 100).toBe(1491.67); // 1500 - 8.33 = 1491.67
  console.log('✅ Test Case 6 passed: Fixed obligations exceeding income clamps savings rate to 0% and shows shortfall.');

  // Test Case 7: Direct budget edit with spending > income shows shortfall instead of negative savings rate.
  // Income is $50,000/yr ($4166.67/mo). Spending is set to $60,000/yr ($5000/mo).
  const sync7 = syncBudgetDetails(50000, 60000, DEFAULT_FIRE_INPUTS.budgetDetails);
  expect(sync7.displayedSavingsRate).toBe(0);
  expect(sync7.budgetShortfall).toBe(833.33);
  console.log('✅ Test Case 7 passed: Direct budget edit with spending > income shows shortfall instead of negative savings rate.');

  // Test Case 8: Changing savings rate to 15% updates budget without causing negative spending.
  const sync8 = syncBudgetDetails(50000, 50000 * 0.85, DEFAULT_FIRE_INPUTS.budgetDetails);
  expect(sync8.displayedSavingsRate).toBe(15);
  expect(sync8.budgetShortfall).toBe(0);
  Object.values(sync8.budgetDetails.expenses).forEach(val => {
    expect(val).toBeGreaterThanOrEqual(0);
  });
  console.log('✅ Test Case 8 passed: Changing savings rate to 15% updates budget without causing negative spending.');

  // Test Case 9: Opening budget without editing does not change displayed manual savings rate.
  const originalDetails = DEFAULT_FIRE_INPUTS.budgetDetails;
  const sync9 = syncBudgetDetails(50000, 42500, originalDetails);
  expect(sync9.displayedSavingsRate).toBe(15);
  expect(sync9.budgetDetails.expenses.housing).toBe(originalDetails.expenses.housing);
  console.log('✅ Test Case 9 passed: Opening budget without editing preserves manual savings rate.');

  console.log('✅ test_budget_synchronization passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_budget_synchronization failed:', error.message);
  process.exit(1);
}
