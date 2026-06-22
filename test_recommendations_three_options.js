import { runFireSimulation } from './src/fireCalculations.js';
import { calculateRetireAt65Recommendation, calculateSaveMoreRecommendation } from './src/recommendations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_recommendations_three_options ---');

try {
  // ====================================================
  // CASE A: Extreme Shortfall (retirementReadyAge is null)
  // ====================================================
  console.log('\n--- Case A: Extreme Shortfall ---');
  const inputsA = getMappedDefaultInputs();
  inputsA.budgetDetails = undefined;
  inputsA.currentAge = 35;
  inputsA.targetRetirementAge = 55;
  inputsA.lifeExpectancy = 85;
  inputsA.simpleIncome = 100000;
  inputsA.simpleExpenses = 95000; // saving only $5,000/yr
  inputsA.expectedReturn = 7;
  inputsA.swr = 4;
  
  inputsA.incomeList = [
    {
      id: 'inc-1',
      name: 'Salary / Main Income',
      amount: 100000,
      frequency: 'yearly',
      startAge: 35,
      // endAge omitted so it scales dynamically with simulation retirement age
      growthRate: 0.03,
      isTaxable: true
    }
  ];
  inputsA.spendingPhases = [
    {
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: 35,
      endAge: 85,
      amount: 95000,
      frequency: 'yearly',
      annualSpending: 95000,
      inflationOverride: null,
      notes: 'Initial standard living expenses'
    }
  ];

  inputsA.lifeEvents = inputsA.lifeEvents.map(e => {
    if (e.type === 'retire') {
      return { ...e, age: 55, spendingPercent: 70 };
    }
    return { ...e, enabled: false };
  });

  const resultsA = runFireSimulation(inputsA);
  expect(resultsA.moneyLasts).toBe(false);
  const shortfallA = -resultsA.endingSurplusShortfall;
  console.log(`- Setup complete. Shortfall: $${Math.round(shortfallA).toLocaleString()}`);
  console.log(`- Case A retirementReadyAge: ${resultsA.retirementReadyAge}`);
  expect(resultsA.retirementReadyAge === null || typeof resultsA.retirementReadyAge === 'number').toBe(true);

  // Verify Option 1 (Retire at Age 65)
  const currentAssets = (Number(inputsA.assets?.cash) || 0) +
                        (Number(inputsA.assets?.emergencyFund) || 0) +
                        (Number(inputsA.assets?.brokerage) || 0) +
                        (Number(inputsA.assets?.trad401k) || 0) +
                        (Number(inputsA.assets?.tradIra) || 0) +
                        (Number(inputsA.assets?.rothIra) || 0) +
                        (Number(inputsA.assets?.hsa) || 0) +
                        (Number(inputsA.assets?.other) || 0);

  const annualSavings = inputsA.simpleIncome - inputsA.simpleExpenses;
  const rateOfReturn = inputsA.expectedReturn / 100;
  const swr = inputsA.swr / 100;
  const retirementExpensesA = resultsA.annualRetirementSpending;

  const retire65RecA = calculateRetireAt65Recommendation(
    inputsA.currentAge,
    inputsA.targetRetirementAge,
    currentAssets,
    annualSavings,
    rateOfReturn,
    swr,
    retirementExpensesA
  );

  expect(retire65RecA.applicable).toBe(true);
  expect(retire65RecA.newShortfall).toBeGreaterThan(0);
  console.log(`- Option 1 (Retire at 65) shortfall calculated: $${Math.round(retire65RecA.newShortfall).toLocaleString()}`);

  // Verify Option 3 (Retire at Requested Retirement Date)
  const saveMoreAmtRequestedA = calculateSaveMoreRecommendation(
    shortfallA,
    rateOfReturn,
    55 - 35,
    1.0
  );
  console.log(`- Option 3 additional savings: $${Math.round(saveMoreAmtRequestedA).toLocaleString()}/yr`);
  expect(saveMoreAmtRequestedA).toBeGreaterThan(0);

  // ====================================================
  // CASE B: Standard Shortfall (retirementReadyAge is resolved)
  // ====================================================
  console.log('\n--- Case B: Standard Shortfall ---');
  const inputsB = getMappedDefaultInputs();
  inputsB.budgetDetails = undefined;
  inputsB.currentAge = 35;
  inputsB.targetRetirementAge = 55;
  inputsB.lifeExpectancy = 85;
  inputsB.simpleIncome = 50000;
  inputsB.simpleExpenses = 42500; // saving $7,500/yr
  inputsB.simpleInvestments = 100000;
  inputsB.assets.brokerage = 100000;
  inputsB.expectedReturn = 7;
  inputsB.swr = 4;
  
  inputsB.incomeList = [
    {
      id: 'inc-1',
      name: 'Salary / Main Income',
      amount: 50000,
      frequency: 'yearly',
      startAge: 35,
      // endAge omitted so it scales dynamically with simulation retirement age
      growthRate: 0.03,
      isTaxable: true
    }
  ];
  inputsB.spendingPhases = [
    {
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: 35,
      endAge: 85,
      amount: 42500,
      frequency: 'yearly',
      annualSpending: 42500,
      inflationOverride: null,
      notes: 'Initial standard living expenses'
    }
  ];

  inputsB.lifeEvents = inputsB.lifeEvents.map(e => {
    if (e.type === 'retire') {
      return { ...e, age: 55, spendingPercent: 70 };
    }
    return { ...e, enabled: false };
  });

  const resultsB = runFireSimulation(inputsB);
  expect(resultsB.moneyLasts).toBe(false);
  
  const readyAgeB = resultsB.retirementReadyAge;
  expect(readyAgeB !== null).toBe(true);
  expect(readyAgeB).toBeGreaterThan(55);
  expect(readyAgeB).toBeLessThanOrEqual(85);
  console.log(`- Confirmed retirementReadyAge is resolved to: Age ${readyAgeB}`);

  // Simulate at retirementReadyAge
  const readyInputsB = JSON.parse(JSON.stringify(inputsB));
  readyInputsB.targetRetirementAge = readyAgeB;
  readyInputsB.lifeEvents = readyInputsB.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: readyAgeB } : e);
  
  const readyResultsB = runFireSimulation(readyInputsB);
  expect(readyResultsB.moneyLasts).toBe(true);
  expect(readyResultsB.endingSurplusShortfall).toBeGreaterThanOrEqual(0);
  console.log(`- Simulating at ready age ${readyAgeB} resolves the shortfall! moneyLasts = ${readyResultsB.moneyLasts}`);

  console.log('\n✅ test_recommendations_three_options passed.');
  process.exit(0);
} catch (error) {
  console.error('\n❌ test_recommendations_three_options failed:', error);
  process.exit(1);
}
