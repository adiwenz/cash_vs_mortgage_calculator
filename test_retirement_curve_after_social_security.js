import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs, buildYearlyResults } from './test_helper.js';

console.log('--- Running test_retirement_curve_after_social_security ---');

const inputs = getMappedDefaultInputs();

try {
  const results = runFireSimulation(inputs);
  const yearlyResults = buildYearlyResults(results, inputs);

  const age66 = yearlyResults.find(d => d.age === 66);
  const age68 = yearlyResults.find(d => d.age === 68);
  const age85 = yearlyResults.find(d => d.age === 85);

  if (!age66 || !age68 || !age85) {
    throw new Error('Could not locate required ages in simulation results.');
  }

  // 1. Assert age 68 withdrawals are less than age 66 withdrawals
  expect(age68.withdrawals).toBeLessThan(age66.withdrawals);
  console.log(`✅ Age 68 withdrawals ($${Math.round(age68.withdrawals).toLocaleString()}) are less than age 66 withdrawals ($${Math.round(age66.withdrawals).toLocaleString()}).`);

  // 2. Assert age 68 net worth is not dramatically lower than age 66 net worth (should be higher or at least 95% of it)
  expect(age68.netWorth).toBeGreaterThan(age66.netWorth * 0.95);
  console.log(`✅ Age 68 net worth ($${Math.round(age68.netWorth).toLocaleString()}) is stable/growing compared to age 66 net worth ($${Math.round(age66.netWorth).toLocaleString()}).`);

  // 3. Assert age 85 net worth remains positive
  expect(age85.netWorth).toBeGreaterThan(0);
  console.log(`✅ Age 85 net worth ($${Math.round(age85.netWorth).toLocaleString()}) remains positive.`);

  console.log('✅ test_retirement_curve_after_social_security passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_retirement_curve_after_social_security failed:', error.message);
  process.exit(1);
}
