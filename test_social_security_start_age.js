import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs, buildYearlyResults } from './test_helper.js';

console.log('--- Running test_social_security_start_age ---');

const inputs = getMappedDefaultInputs();

try {
  const results = runFireSimulation(inputs);
  const yearlyResults = buildYearlyResults(results, inputs);

  const age65 = yearlyResults.find(d => d.age === 65);
  const age66 = yearlyResults.find(d => d.age === 66);
  const age67 = yearlyResults.find(d => d.age === 67);
  const age68 = yearlyResults.find(d => d.age === 68);

  if (!age65 || !age66 || !age67 || !age68) {
    throw new Error('Could not locate required ages in simulation results.');
  }

  // 1. Assert SS income is $0 before 67
  expect(age65.socialSecurityIncome).toBe(0);
  expect(age66.socialSecurityIncome).toBe(0);
  console.log('✅ Social Security income is $0 before age 67.');

  // 2. Assert SS income is positive after 67
  expect(age67.socialSecurityIncome).toBeGreaterThan(0);
  expect(age68.socialSecurityIncome).toBeGreaterThan(0);
  console.log(`✅ Social Security income is positive at age 67 ($${Math.round(age67.socialSecurityIncome).toLocaleString()}) and age 68 ($${Math.round(age68.socialSecurityIncome).toLocaleString()}).`);

  // 3. Verify the annual starting benefit in today's dollars (deflated) is $24,000
  // Inflation factor at age 67 is (1 + 0.03)^(67 - 35) = 1.03^32
  const inflationFactor67 = Math.pow(1.03, 67 - 35);
  const startingBenefitTodayDollars = age67.socialSecurityIncome / inflationFactor67;
  console.log(`- SS starting benefit in today's dollars: $${Math.round(startingBenefitTodayDollars).toLocaleString()}`);
  expect(startingBenefitTodayDollars).toBeCloseTo(24000, 0);

  // 4. Verify deflated total income in simulation data at age 67 is $24,000 (since salary is 0)
  const age67Deflated = results.deflatedData.find(d => d.age === 67);
  console.log(`- Deflated total income at age 67 from simulation: $${Math.round(age67Deflated.income).toLocaleString()}`);
  expect(age67Deflated.income).toBeCloseTo(24000, 0);

  // 5. Verify that setting ageStartedWorking prepends past income correctly and updates benefits
  const inputsAge = getMappedDefaultInputs();
  let ssEv = inputsAge.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEv.enabled = true;
  ssEv.useEarnings = true;
  ssEv.ageStartedWorking = 22; // 13 working years before age 35

  const resultsAge = runFireSimulation(inputsAge);
  expect(resultsAge.socialSecurityDetails.workingYears).toBe(43); // 13 pre + 30 post
  expect(resultsAge.socialSecurityDetails.annualBenefit).toBeCloseTo(24950.56, 0);
  console.log('✅ ageStartedWorking prepends past income correctly and updates benefits.');

  console.log('✅ test_social_security_start_age passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_social_security_start_age failed:', error.message);
  process.exit(1);
}
