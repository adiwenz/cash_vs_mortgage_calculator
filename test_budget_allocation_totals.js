import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_budget_allocation_totals ---');

const inputs = getMappedDefaultInputs();

try {
  // 1. Verify savings allocations
  const savings = inputs.budgetDetails.savings;
  expect(savings.trad401k).toBe(200);
  expect(savings.rothIra).toBe(100);
  expect(savings.tradIra).toBe(0);
  expect(savings.hsa).toBe(50);
  expect(savings.brokerage).toBe(0);
  expect(savings.checking).toBe(100);
  expect(savings.hysa).toBe(100);
  expect(savings.emergency).toBe(75);
  expect(savings.debt).toBe(0);
  expect(savings.other).toBe(0);
  
  const totalSavings = Object.values(savings).reduce((sum, val) => sum + val, 0);
  expect(totalSavings).toBe(625);
  console.log(`✅ Default savings allocations verify correctly. Total: $${totalSavings}/mo.`);

  // 2. Verify expense allocations
  const expenses = inputs.budgetDetails.expenses;
  expect(expenses.housing).toBe(1500);
  expect(expenses.utilities).toBe(300);
  expect(expenses.food).toBe(600);
  expect(expenses.transportation).toBe(400);
  expect(expenses.healthcare).toBe(300);
  expect(expenses.leisure).toBe(300);
  expect(expenses.misc).toBe(142);

  const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + val, 0);
  expect(totalExpenses).toBe(3542);
  console.log(`✅ Default expense allocations verify correctly. Total: $${totalExpenses}/mo.`);

  // 3. Verify monthly income is 50000 / 12 = 4166.67
  const monthlyIncome = inputs.simpleIncome / 12;
  expect(monthlyIncome).toBeCloseTo(4166.67, 2);
  console.log(`✅ Monthly income verified: $${monthlyIncome.toFixed(2)}.`);

  // 4. Verify monthlySavings + monthlyExpenses ≈ monthlyIncome (allow small rounding tolerance)
  const totalAllocated = totalSavings + totalExpenses;
  const difference = Math.abs(totalAllocated - monthlyIncome);
  expect(difference).toBeLessThan(1.0);
  console.log(`✅ Budget balances: Monthly Savings ($${totalSavings}) + Monthly Expenses ($${totalExpenses}) = $${totalAllocated} vs Monthly Income ($${monthlyIncome.toFixed(2)}) (Diff: $${difference.toFixed(2)}).`);

  console.log('✅ test_budget_allocation_totals passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_budget_allocation_totals failed:', error.message);
  process.exit(1);
}
