import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('========================================================================');
console.log('Running test: One-time Moving Cost in Move Event simulation');
console.log('========================================================================');

function expect(val) {
  return {
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(val - expected);
      const tolerance = Math.pow(10, -precision);
      if (diff > tolerance * 10) { // Allow slight rounding tolerance
        throw new Error(`Expected ${val} to be close to ${expected} within tolerance ${tolerance}`);
      }
    },
    toBe(expected) {
      if (val !== expected) {
        throw new Error(`Expected ${val} to be ${expected}`);
      }
    }
  };
}

try {
  const currentAge = 35;
  const moveAge = 55;
  const newSpending = 40000;
  const movingCost = 10000;

  const updatedPhases = DEFAULT_FIRE_INPUTS.spendingPhases.map(p => {
    if (p.startAge < moveAge && p.endAge > moveAge) {
      return { ...p, endAge: moveAge };
    }
    return p;
  });

  const testInputs = {
    ...DEFAULT_FIRE_INPUTS,
    isAdvancedMode: true,
    spendingPhases: [
      ...updatedPhases,
      {
        id: 'move-test-phase',
        name: 'Moved to Dominican Republic',
        startAge: moveAge,
        endAge: DEFAULT_FIRE_INPUTS.lifeExpectancy,
        amount: newSpending,
        frequency: 'yearly',
        annualSpending: newSpending,
        inflationOverride: null,
        notes: 'Lifestyle after moving to Dominican Republic',
        movingCost: movingCost
      }
    ]
  };

  const result = runFireSimulation(testInputs);
  const nominalData = result.nominalData;

  const logBeforeMove = nominalData.find(d => d.age === moveAge - 1); // 54
  const logAtMove = nominalData.find(d => d.age === moveAge); // 55
  const logAfterMove = nominalData.find(d => d.age === moveAge + 1); // 56

  console.log(`Age 54 (Before Move) Nominal Expenses: ${logBeforeMove.expenses}`);
  console.log(`Age 55 (At Move) Nominal Expenses: ${logAtMove.expenses}`);
  console.log(`Age 56 (After Move) Nominal Expenses: ${logAfterMove.expenses}`);

  // Base spending at moveAge (55) in nominal dollars is exactly $40,000/yr.
  const expectedBaseNominal = 40000;

  // One-time moving cost at moveAge (55) in nominal dollars is exactly $10,000.
  const expectedMovingCostNominal = 10000;

  // Total nominal expenses at age 55 should be base nominal + moving cost nominal
  const expectedTotalNominalAtMove = expectedBaseNominal + expectedMovingCostNominal;

  // Age 56 nominal expenses should be base nominal inflated by 1 year of inflation:
  // 40000 * 1.03 = 41200
  const expectedTotalNominalAfterMove = 40000 * Math.pow(1.03, 1);

  console.log(`Expected Age 55 Total Nominal Expenses: ${expectedTotalNominalAtMove}`);
  console.log(`Expected Age 56 Total Nominal Expenses: ${expectedTotalNominalAfterMove}`);

  expect(logAtMove.expenses).toBeCloseTo(expectedTotalNominalAtMove, 0);
  expect(logAfterMove.expenses).toBeCloseTo(expectedTotalNominalAfterMove, 0);

  console.log('✅ Moving cost tests passed.');
  console.log('========================================================================');
  process.exit(0);
} catch (error) {
  console.error('❌ MOVING COST TEST FAILED:', error.message, error.stack);
  process.exit(1);
}
