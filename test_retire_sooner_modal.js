/* eslint-disable no-undef */
import { calculateRetireSoonerOptions } from './src/calculators/fire/retireSooner.js';
import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_retire_sooner_modal ---');

try {
  const inputs = getMappedDefaultInputs();
  inputs.currentAge = 35;
  inputs.targetRetirementAge = 65;
  inputs.lifeExpectancy = 85;
  inputs.simpleIncome = 120000; // $10,000/mo gross
  inputs.simpleExpenses = 84000; // $7,000/mo expenses: Needs, Wants, etc.
  
  // Set up standard budget phases
  inputs.budgetDetails = {
    phases: [
      {
        id: 'phase-1',
        type: 'workSave',
        name: 'Working & Saving',
        startAge: 35,
        endAge: 65,
        income: 10000,
        expenses: {
          housing: 3000,
          utilities: 500,
          groceries: 800,
          insurance: 400,
          leisure: 1000,
          diningOut: 500,
          misc: 500,
        },
        savings: {
          brokerage: 1000
        }
      }
    ]
  };

  inputs.incomeList = [
    {
      id: 'simple-inc',
      name: 'Job Income',
      amount: 120000,
      frequency: 'yearly',
      startAge: 35,
      growthRate: 0,
      isTaxable: true
    }
  ];

  // Run baseline simulation
  const baselineResults = runFireSimulation(inputs);
  const baselineReadyAge = baselineResults.retirementReadyAge;
  console.log(`Baseline Retirement Ready Age: Age ${baselineReadyAge}`);

  // Test 1: Wants floor correctness
  // netMonthlyIncome: income (10,000) - taxes.
  // If inputs.includeTaxes is false, taxes = 0, netMonthlyIncome = 10,000.
  // wantsFloor = max(250, 10% of netMonthlyIncome) = max(250, 1000) = 1000.
  // currentMonthlyWants = leisure (1000) + diningOut (500) + misc (500) = 2000.
  // maxAvailableSavingsIncrease = max(0, 2000 - 1000) = 1000.
  const optionsAge55 = calculateRetireSoonerOptions(inputs, 55);
  expect(optionsAge55.maxAvailableSavingsIncrease).toBe(1000);
  console.log('✅ Test 1: Wants floor and maxAvailableSavingsIncrease calculation verified.');

  // Test 2: Target Age 63 (Save More achievable)
  // Let's set a target retirement age of 63 (only 2 years sooner)
  const targetAge63 = 63;
  console.log(`\n--- Case 1: Target Age ${targetAge63} (Save More achievable) ---`);
  const options63 = calculateRetireSoonerOptions(inputs, targetAge63);
  console.log(`- Save More Required: $${options63.requiredSaveMoreMonthly}/mo`);
  console.log(`- maxAvailableSavingsIncrease: $${options63.maxAvailableSavingsIncrease}/mo`);
  console.log(`- Balanced Wants Reduction: $${options63.wantsReductionBalanced}/mo`);
  console.log(`- Balanced Income Increase: $${options63.requiredBalancedIncomeAnnual}/yr`);

  expect(options63.requiredSaveMoreMonthly !== null).toBe(true);
  expect(options63.requiredSaveMoreMonthly <= options63.maxAvailableSavingsIncrease).toBe(true);

  // Approximately 50% of the Save More required monthly amount:
  const expectedWantsReduction63 = Math.round((options63.requiredSaveMoreMonthly / 2) / 25) * 25;
  expect(options63.wantsReductionBalanced).toBe(expectedWantsReduction63);
  console.log(`✅ Test 2: Balanced Wants Reduction is exactly 50% of Save More: $${options63.wantsReductionBalanced}`);

  // Test 3: Target Age 50 (Save More NOT achievable)
  const targetAge50 = 50;
  console.log(`\n--- Case 2: Target Age ${targetAge50} (Save More NOT achievable) ---`);
  const options50 = calculateRetireSoonerOptions(inputs, targetAge50);
  console.log(`- Save More Required: ${options50.requiredSaveMoreMonthly !== null ? '$' + options50.requiredSaveMoreMonthly + '/mo' : 'null'}`);
  console.log(`- maxAvailableSavingsIncrease: $${options50.maxAvailableSavingsIncrease}/mo`);
  console.log(`- Balanced Wants Reduction: $${options50.wantsReductionBalanced}/mo`);
  console.log(`- Balanced Income Increase: $${options50.requiredBalancedIncomeAnnual}/yr`);

  expect(options50.requiredSaveMoreMonthly === null || options50.requiredSaveMoreMonthly > options50.maxAvailableSavingsIncrease).toBe(true);

  // When Save More is not achievable (requiredSaveMoreMonthly is null), Balanced Wants Reduction starts at approximately 50% of maxAvailableSavingsIncrease.
  const expectedWantsReduction50 = options50.requiredSaveMoreMonthly !== null
    ? Math.min(
        Math.round((options50.requiredSaveMoreMonthly / 2) / 25) * 25,
        options50.maxAvailableSavingsIncrease
      )
    : Math.round((options50.maxAvailableSavingsIncrease / 2) / 25) * 25;
  expect(options50.wantsReductionBalanced).toBe(expectedWantsReduction50);
  console.log(`✅ Test 3: Balanced Wants Reduction is correct: $${options50.wantsReductionBalanced}`);

  console.log('\n✅ test_retire_sooner_modal passed.');
  process.exit(0);
} catch (error) {
  console.error('\n❌ test_retire_sooner_modal failed:', error);
  process.exit(1);
}
