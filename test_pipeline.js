import { 
  derivePhasesFromEvents, 
  projectYearlyBalances, 
  computeRetirementResult,
  getProfileFromInputs,
  getEventsFromInputs
} from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('========================================================================');
console.log('Running test: Pure Pipeline Unit Tests (test_pipeline.js)');
console.log('========================================================================');

// Jest-like expect assertion library for Node.js
function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) {
        throw new Error(`Expected ${val} to be ${expected}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(val > expected)) {
        throw new Error(`Expected ${val} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(val < expected)) {
        throw new Error(`Expected ${val} to be less than ${expected}`);
      }
    },
    toBeDefined() {
      if (val === undefined || val === null) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(val - expected);
      const limit = precision < 0 ? Math.pow(10, -precision) : Math.pow(10, -precision) / 2;
      if (diff > limit) {
        throw new Error(`Expected ${val} to be close to ${expected} (diff: ${diff}, limit: ${limit})`);
      }
    }
  };
}

try {
  // --- Setup inputs ---
  const incomeList = [
    {
      id: 'inc-1',
      name: 'Salary / Main Income',
      amount: 100000,
      frequency: 'yearly',
      startAge: 35,
      endAge: 65,
      growthRate: 0.03,
      isTaxable: true
    }
  ];
  const spendingPhases = [
    {
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: 35,
      endAge: 85,
      amount: 50000,
      frequency: 'yearly',
      annualSpending: 50000
    }
  ];
  const assets = {
    cash: 10000,
    emergencyFund: 0,
    brokerage: 50000,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    realEstate: 0,
    other: 0,
    debts: 0
  };

  const inputs = {
    ...DEFAULT_FIRE_INPUTS,
    currentAge: 35,
    lifeExpectancy: 85,
    targetRetirementAge: 65,
    simpleIncome: 100000,
    simpleExpenses: 50000,
    assets,
    incomeList,
    spendingPhases,
    lifeEvents: [
      { type: 'retire', age: 65, enabled: true },
      { type: 'socialSecurity', claimingAge: 67, monthlyBenefit: 2000, enabled: true }
    ]
  };

  // --- Test Case 1: derivePhasesFromEvents ---
  console.log('Test Case 1: Verifying derivePhasesFromEvents...');
  
  const profile = getProfileFromInputs(inputs);
  profile.incomeList = incomeList;
  profile.spendingPhases = spendingPhases;

  const events = getEventsFromInputs(inputs);

  const phases = derivePhasesFromEvents(profile, events, []);
  
  // Boundaries should be 35, 65, 67, 85
  // Which corresponds to phases:
  // Phase 1: 35 to 65 (workSave)
  // Phase 2: 65 to 67 (retire)
  // Phase 3: 67 to 85 (retire)
  expect(phases.length).toBe(3);
  
  expect(phases[0].startAge).toBe(35);
  expect(phases[0].endAge).toBe(65);
  expect(phases[0].type).toBe('workSave');

  expect(phases[1].startAge).toBe(65);
  expect(phases[1].endAge).toBe(67);
  expect(phases[1].type).toBe('retire');

  expect(phases[2].startAge).toBe(67);
  expect(phases[2].endAge).toBe(85);
  expect(phases[2].type).toBe('retire');
  
  console.log('✅ derivePhasesFromEvents verified successfully.');

  // --- Test Case 2: projectYearlyBalances ---
  console.log('Test Case 2: Verifying projectYearlyBalances...');

  const plannedProjection = projectYearlyBalances(profile, phases, events, 65);
  expect(plannedProjection).toBeDefined();
  expect(plannedProjection.logs).toBeDefined();
  expect(plannedProjection.logs.length).toBe(51); // 35 to 85 inclusive is 51 rows

  const firstYear = plannedProjection.logs[0];
  expect(firstYear.age).toBe(35);
  expect(firstYear.portfolio).toBeGreaterThan(0); // Should grow from starting assets
  
  const lastYear = plannedProjection.logs[50];
  expect(lastYear.age).toBe(85);
  
  console.log('✅ projectYearlyBalances verified successfully.');

  // --- Test Case 3: computeRetirementResult ---
  console.log('Test Case 3: Verifying computeRetirementResult...');

  const result = computeRetirementResult(profile, phases, events, plannedProjection);
  expect(result).toBeDefined();
  expect(result.retirementOutcome).toBeDefined();
  expect(result.deflatedData).toBeDefined();
  expect(result.dynamicMilestones).toBeDefined();
  expect(result.portfolioAtRetirement).toBeDefined();
  expect(result.portfolioAtRetirement).toBeGreaterThan(0);
  expect(result.moneyLasts).toBe(true);

  console.log('✅ computeRetirementResult verified successfully.');
  console.log('========================================================================');
  console.log('🎉 ALL PIPELINE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);

} catch (error) {
  console.error('❌ PIPELINE TEST FAILED:', error.message, error.stack);
  process.exit(1);
}
