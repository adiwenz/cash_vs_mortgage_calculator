/* global process */
import { simulateDebt } from './src/debtSimulationEngine.js';

console.log('========================================================================');
console.log('Running test: Credit Card Behavior Simulation Engine Verification');
console.log('========================================================================');

// Simple assertion helper
function expect(val) {
  return {
    toBe(expected, msg = '') {
      if (val !== expected) {
        throw new Error(`${msg ? msg + ' ' : ''}Expected ${val} to be ${expected}`);
      }
    },
    toBeGreaterThan(expected, msg = '') {
      if (!(val > expected)) {
        throw new Error(`${msg ? msg + ' ' : ''}Expected ${val} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected, msg = '') {
      if (!(val < expected)) {
        throw new Error(`${msg ? msg + ' ' : ''}Expected ${val} to be less than ${expected}`);
      }
    },
    toBeCloseTo(expected, tolerance = 0.01, msg = '') {
      const diff = Math.abs(val - expected);
      if (diff > tolerance) {
        throw new Error(`${msg ? msg + ' ' : ''}Expected ${val} to be close to ${expected} (diff: ${diff}, tolerance: ${tolerance})`);
      }
    },
    toBeNull(msg = '') {
      if (val !== null) {
        throw new Error(`${msg ? msg + ' ' : ''}Expected ${val} to be null`);
      }
    },
    toBeTrue(msg = '') {
      if (val !== true) {
        throw new Error(`${msg ? msg + ' ' : ''}Expected ${val} to be true`);
      }
    },
    toBeFalse(msg = '') {
      if (val !== false) {
        throw new Error(`${msg ? msg + ' ' : ''}Expected ${val} to be false`);
      }
    }
  };
}

try {
  // Let's define the base inputs
  const balance = 10000;
  const apr = 0.24; // 24%

  // 1. Scenario 1: Aggressive Paydown ($500 payment, no extra)
  console.log('Testing Scenario 1: Aggressive Paydown...');
  const aggressive = simulateDebt({
    startingBalance: balance,
    apr,
    monthlyPayment: 500,
    monthlyNewDebt: 0,
    extraPayment: 0,
    simulationYears: 30
  });
  expect(aggressive.isPaidOff).toBeTrue('Aggressive should pay off');
  expect(aggressive.monthsToPayoff).toBe(26, 'Aggressive should pay off in 26 months');
  // Monthly calculations:
  // Month 1: starting 10000, interest 200, payment 500 => ending 9700.
  // Month 2: starting 9700, interest 194, payment 500 => ending 9394.
  // ... month 25 pays off.
  expect(aggressive.totalInterestPaid).toBeCloseTo(2898.73, 1.0, 'Aggressive total interest check');
  expect(aggressive.totalPayments).toBeCloseTo(12898.73, 1.0, 'Aggressive total payments check');
  console.log('✅ Scenario 1 Passed.');

  // 2. Scenario 2: Slow Paydown ($250 payment, no extra)
  console.log('Testing Scenario 2: Slow Paydown...');
  const slow = simulateDebt({
    startingBalance: balance,
    apr,
    monthlyPayment: 250,
    monthlyNewDebt: 0,
    extraPayment: 0,
    simulationYears: 30
  });
  expect(slow.isPaidOff).toBeTrue('Slow should pay off');
  expect(slow.monthsToPayoff).toBe(82, 'Slow should pay off in 82 months');
  expect(slow.totalInterestPaid).toBeCloseTo(10318.98, 1.0, 'Slow total interest check');
  console.log('✅ Scenario 2 Passed.');

  // 3. Scenario 3: Interest Neutral ($200 payment, no extra)
  console.log('Testing Scenario 3: Interest Neutral...');
  const neutral = simulateDebt({
    startingBalance: balance,
    apr,
    monthlyPayment: 200,
    monthlyNewDebt: 0,
    extraPayment: 0,
    simulationYears: 30
  });
  expect(neutral.isPaidOff).toBeFalse('Neutral should not pay off');
  expect(neutral.monthsToPayoff).toBeNull('Neutral payoff month should be null');
  expect(neutral.yearlyData[30].balance).toBeCloseTo(10000, 0.01, 'Neutral balance should remain $10,000');
  expect(neutral.annualInterestYear1).toBe(2400, 'Neutral annual interest year 1 check');
  // Interest paid over 30 years (360 months) = 360 * $200 = $72,000
  expect(neutral.totalInterestPaid).toBe(72000, 'Neutral total interest check');
  console.log('✅ Scenario 3 Passed.');

  // 4. Scenario 4: Interest Trap ($150 payment, no extra)
  console.log('Testing Scenario 4: Interest Trap...');
  const trap = simulateDebt({
    startingBalance: balance,
    apr,
    monthlyPayment: 150,
    monthlyNewDebt: 0,
    extraPayment: 0,
    simulationYears: 30
  });
  expect(trap.isPaidOff).toBeFalse('Trap should not pay off');
  expect(trap.debtAfter1Year).toBeGreaterThan(balance, 'Trap balance should grow after 1 year');
  expect(trap.debtAfter5Years).toBeGreaterThan(trap.debtAfter1Year, 'Trap balance should continue growing');
  // Month 1: 10000 + 200 - 150 = 10050. Month 2: 10050 + 201 - 150 = 10101.
  expect(trap.debtAfter1Year).toBeCloseTo(10670.6, 1.0, 'Trap 1 year balance check');
  expect(trap.yearlyData[1].netWorth).toBeCloseTo(trap.yearlyData[1].cash - trap.yearlyData[1].balance, 1.0, 'Trap Year 1 Net Worth check');
  console.log('✅ Scenario 4 Passed.');

  // 5. Scenario 5: Budget Gap ($200 payment, $300 new debt, no extra)
  console.log('Testing Scenario 5: Budget Gap...');
  const gap = simulateDebt({
    startingBalance: balance,
    apr,
    monthlyPayment: 200,
    monthlyNewDebt: 300,
    extraPayment: 0,
    simulationYears: 30
  });
  expect(gap.isPaidOff).toBeFalse('Budget Gap should not pay off');
  expect(gap.debtAfter1Year).toBeCloseTo(14023.63, 1.0, 'Budget Gap 1 year balance check');
  expect(gap.debtAfter5Years).toBeCloseTo(44215.46, 1.0, 'Budget Gap 5 years balance check');
  expect(gap.yearlyData[5].netWorth).toBeCloseTo(gap.yearlyData[5].cash - gap.yearlyData[5].balance, 1.0, 'Budget Gap Year 5 Net Worth check');
  console.log('✅ Scenario 5 Passed.');

  // 6. Test Impact of Extra Payments ($100/mo extra)
  console.log('Testing Extra Payments impact on Interest Neutral...');
  const optimizedNeutral = simulateDebt({
    startingBalance: balance,
    apr,
    monthlyPayment: 200,
    monthlyNewDebt: 0,
    extraPayment: 100, // breaks the neutral cycle
    simulationYears: 30
  });
  expect(optimizedNeutral.isPaidOff).toBeTrue('Optimized neutral should now pay off');
  expect(optimizedNeutral.monthsToPayoff).toBe(56, 'Should pay off in 56 months');
  expect(optimizedNeutral.totalInterestPaid).toBeLessThan(10000, 'Interest paid should be way less than 72k');
  expect(optimizedNeutral.totalInterestPaid).toBeCloseTo(6644.17, 1.0, 'Optimized neutral interest check');
  console.log('✅ Extra Payments impact Passed.');

  console.log('\n🎉 ALL CREDIT CARD BEHAVIOR SIMULATOR TESTS PASSED SUCCESSFULLY.');
  process.exit(0);

} catch (error) {
  console.error('\n❌ TEST SUITE FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
}
