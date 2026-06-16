import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_account_growth_rates ---');

// Helper to configure a clean simulation for growth rate testing
function createCleanGrowthInputs() {
  const inputs = getMappedDefaultInputs();
  inputs.simpleIncome = 0;
  inputs.simpleExpenses = 0;
  inputs.incomeList = [];
  // Set spending phase to zero to prevent fallback to default expenses of 42500
  inputs.spendingPhases = [
    {
      id: 'spend-1',
      name: 'Zero Spending',
      startAge: 35,
      endAge: 85,
      amount: 0,
      frequency: 'yearly'
    }
  ];
  inputs.allocationRules = [];
  inputs.lifeEvents = [
    { id: 'retire-1', type: 'retire', enabled: true, age: 45, spendingPercent: 0 }
  ];
  inputs.targetRetirementAge = 45;
  inputs.enableHealthcareModel = false;
  
  // Reset starting assets
  inputs.simpleInvestments = 0;
  inputs.assets = {
    cash: 0,
    emergencyFund: 0,
    brokerage: 0,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    realEstate: 0,
    other: 0,
    debts: 0
  };

  inputs.budgetDetails = {
    expenses: {},
    savings: {},
    partnerSavings: {},
    phases: [],
    defaultTemplate: { needsPct: 0, wantsPct: 0, savingsPct: 0 }
  };

  return inputs;
}

try {
  // 1. Verify Brokerage Growth (expectedReturn=7%, postRetirementReturn=5%)
  const inputsBrokerage = createCleanGrowthInputs();
  inputsBrokerage.assets.brokerage = 10000;
  inputsBrokerage.simpleInvestments = 10000;
  
  const resultsBrokerage = runFireSimulation(inputsBrokerage);
  const dataBrokerage = resultsBrokerage.nominalData;

  const bYear0 = dataBrokerage.find(d => d.age === 35).portfolio;
  const bYear1 = dataBrokerage.find(d => d.age === 36).portfolio;
  const bYear10 = dataBrokerage.find(d => d.age === 45).portfolio;
  const bYear11 = dataBrokerage.find(d => d.age === 46).portfolio;

  expect(bYear0).toBe(10000);
  expect(bYear1).toBeCloseTo(10700, 0);
  console.log(`✅ Brokerage grows at 7% pre-retirement: Year 0 = $${bYear0} -> Year 1 = $${bYear1} (Expected $10,700).`);

  const expectedBYear11 = bYear10 * 1.05;
  expect(bYear11).toBeCloseTo(expectedBYear11, 0);
  console.log(`✅ Brokerage grows at 5% post-retirement: Year 10 (Age 45) = $${Math.round(bYear10)} -> Year 11 (Age 46) = $${Math.round(bYear11)} (Expected $${Math.round(expectedBYear11)}).`);

  // 2. Verify Cash Growth (currently grows at market rate in the simulator)
  const inputsCash = createCleanGrowthInputs();
  inputsCash.assets.cash = 10000;
  
  const resultsCash = runFireSimulation(inputsCash);
  const dataCash = resultsCash.nominalData;

  const cYear0 = dataCash.find(d => d.age === 35).portfolio;
  const cYear1 = dataCash.find(d => d.age === 36).portfolio;
  
  expect(cYear0).toBe(10000);
  expect(cYear1).toBeCloseTo(10700, 0);
  console.log(`✅ Cash grows at the simulator's active return rate ($${cYear1}).`);

  // 3. Verify Emergency Fund Growth (currently grows at market rate in the simulator)
  const inputsEF = createCleanGrowthInputs();
  inputsEF.assets.emergencyFund = 10000;
  
  const resultsEF = runFireSimulation(inputsEF);
  const dataEF = resultsEF.nominalData;

  const efYear0 = dataEF.find(d => d.age === 35).portfolio;
  const efYear1 = dataEF.find(d => d.age === 36).portfolio;
  
  expect(efYear0).toBe(10000);
  expect(efYear1).toBeCloseTo(10700, 0);
  console.log(`✅ Emergency fund grows at the simulator's active return rate ($${efYear1}).`);

  console.log('✅ test_account_growth_rates passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_account_growth_rates failed:', error.message);
  process.exit(1);
}
