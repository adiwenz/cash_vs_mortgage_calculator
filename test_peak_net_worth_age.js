import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs, buildYearlyResults, calculatePeakNetWorth } from './test_helper.js';

console.log('--- Running test_peak_net_worth_age ---');

const inputs = getMappedDefaultInputs();

try {
  const results = runFireSimulation(inputs);
  const yearlyResults = buildYearlyResults(results, inputs);
  const peakNW = calculatePeakNetWorth(yearlyResults);

  // Attach properties to match expected API in the test requirements
  results.peakNetWorth = peakNW;
  results.yearlyResults = yearlyResults;

  // 1. expect(results.peakNetWorth.age).toBeGreaterThanOrEqual(65);
  expect(results.peakNetWorth.age).toBeGreaterThanOrEqual(65);
  console.log(`✅ Peak Net Worth Age (${results.peakNetWorth.age}) is greater than or equal to 65.`);

  // 2. expect(results.peakNetWorth.value).toBeGreaterThan(results.yearlyResults.find(r => r.age === 65).netWorth);
  const nwAt65 = results.yearlyResults.find(r => r.age === 65).netWorth;
  expect(results.peakNetWorth.value).toBeGreaterThan(nwAt65);
  console.log(`✅ Peak Net Worth Value ($${Math.round(results.peakNetWorth.value).toLocaleString()}) is greater than net worth at age 65 ($${Math.round(nwAt65).toLocaleString()}).`);

  console.log('✅ test_peak_net_worth_age passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_peak_net_worth_age failed:', error.message);
  process.exit(1);
}
