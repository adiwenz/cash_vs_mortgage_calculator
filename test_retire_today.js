import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('========================================================================');
console.log('Running test: Retire Today target calculation and behavior');
console.log('========================================================================');

function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) {
        throw new Error(`Expected ${val} to be ${expected}`);
      }
    }
  };
}

try {
  // Test 1: Default user (Income $50,000, Savings 15%, Spending $42,500, SWR 4%)
  const inputs = {
    ...DEFAULT_FIRE_INPUTS,
    simpleIncome: 50000,
    simpleExpenses: 42500,
    swr: 4
  };

  let result = runFireSimulation(inputs);
  console.log('Test 1: Default user Retire Today target...');
  expect(result.retireTodayTarget).toBe(1062500);
  console.log('✅ Test 1 Passed.');

  // Test 2: Changing spending increases/decreases the target
  console.log('Test 2: Changing spending increases/decreases target...');
  const inputsMoreSpending = {
    ...inputs,
    simpleExpenses: 45000
  };
  result = runFireSimulation(inputsMoreSpending);
  expect(result.retireTodayTarget).toBe(1125000); // 45000 / 0.04 = 1125000

  const inputsLessSpending = {
    ...inputs,
    simpleExpenses: 40000
  };
  result = runFireSimulation(inputsLessSpending);
  expect(result.retireTodayTarget).toBe(1000000); // 40000 / 0.04 = 1000000
  console.log('✅ Test 2 Passed.');

  // Test 3: Changing SWR increases/decreases the target
  console.log('Test 3: Changing SWR increases/decreases target...');
  const inputsHigherSWR = {
    ...inputs,
    swr: 5
  };
  result = runFireSimulation(inputsHigherSWR);
  expect(result.retireTodayTarget).toBe(850000); // 42500 / 0.05 = 850000

  const inputsLowerSWR = {
    ...inputs,
    swr: 3
  };
  result = runFireSimulation(inputsLowerSWR);
  expect(result.retireTodayTarget).toBe(1416666.6666666667); // 42500 / 0.03
  console.log('✅ Test 3 Passed.');

  // Test 4: Changing retirement age does NOT change the Retire Today value
  console.log('Test 4: Changing retirement age does not affect Retire Today target...');
  const inputsDifferentRetirementAge = {
    ...inputs,
    targetRetirementAge: 70
  };
  result = runFireSimulation(inputsDifferentRetirementAge);
  expect(result.retireTodayTarget).toBe(1062500); // Should remain 1062500
  console.log('✅ Test 4 Passed.');

  console.log('========================================================================');
  console.log('🎉 ALL RETIRE TODAY TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
} catch (error) {
  console.error('❌ RETIRE TODAY TEST FAILED:', error.message, error.stack);
  process.exit(1);
}
