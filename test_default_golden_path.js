import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs, buildYearlyResults, calculatePeakNetWorth, printDiagnosticsTable } from './test_helper.js';

console.log('--- Running test_default_golden_path ---');

const inputs = getMappedDefaultInputs();

try {
  const results = runFireSimulation(inputs);
  const yearlyResults = buildYearlyResults(results, inputs);
  const peakNW = calculatePeakNetWorth(yearlyResults);

  const age65 = yearlyResults.find(d => d.age === 65);
  const age66 = yearlyResults.find(d => d.age === 66);
  const age67 = yearlyResults.find(d => d.age === 67);
  const age68 = yearlyResults.find(d => d.age === 68);
  const age85 = yearlyResults.find(d => d.age === 85);

  if (!age65 || !age66 || !age67 || !age68 || !age85) {
    throw new Error('Could not locate required ages in simulation results.');
  }

  // 1. Age 65 nominal net worth is between $950k and $1.1M
  expect(age65.netWorth).toBeGreaterThanOrEqual(950000);
  expect(age65.netWorth).toBeLessThanOrEqual(1100000);
  console.log(`✅ Age 65 Net Worth ($${Math.round(age65.netWorth).toLocaleString()}) is inside the $950k - $1.1M range.`);

  // 2. Age 85 net worth is positive
  expect(age85.netWorth).toBeGreaterThan(0);
  console.log(`✅ Age 85 Net Worth ($${Math.round(age85.netWorth).toLocaleString()}) is positive.`);

  // 3. Peak net worth occurs at or after age 65
  expect(peakNW.age).toBeGreaterThanOrEqual(65);
  console.log(`✅ Peak Net Worth occurs at or after 65 (Age: ${peakNW.age}).`);

  // 4. Social Security income is $0 before 67 and positive after 67
  expect(age66.socialSecurityIncome).toBe(0);
  expect(age67.socialSecurityIncome).toBeGreaterThan(0);
  expect(age68.socialSecurityIncome).toBeGreaterThan(0);
  console.log(`✅ SS is $0 before age 67 and positive at/after age 67 ($${Math.round(age67.socialSecurityIncome).toLocaleString()}).`);

  // 5. Withdrawals drop after Social Security begins
  expect(age68.withdrawals).toBeLessThan(age66.withdrawals);
  console.log(`✅ Withdrawals drop after Social Security starts: Age 66 withdrawals = $${Math.round(age66.withdrawals).toLocaleString()} vs Age 68 = $${Math.round(age68.withdrawals).toLocaleString()}`);

  console.log('✅ test_default_golden_path passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_default_golden_path failed:', error.message);
  try {
    const results = runFireSimulation(inputs);
    const yearlyResults = buildYearlyResults(results, inputs);
    printDiagnosticsTable(yearlyResults);
  } catch (diagError) {
    console.error('Failed to run diagnostics:', diagError.message);
  }
  process.exit(1);
}
