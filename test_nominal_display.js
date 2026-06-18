import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('--- Running Nominal vs Deflated Projections Verification ---');

// Run the simulation with default inputs
const results = runFireSimulation(DEFAULT_FIRE_INPUTS);

// Assert structures are returned correctly
if (!results.nominalData || !results.deflatedData) {
  console.error('FAIL: Simulation results must include both nominalData and deflatedData arrays.');
  process.exit(1);
}

if (results.nominalData.length !== results.deflatedData.length) {
  console.error('FAIL: Nominal data and deflated data must have the exact same number of entries.');
  process.exit(1);
}

console.log('✅ PASS: Nominal and deflated data arrays are present and matching in length.');

// Fetch values at Age 65 (planned retirement age, 30 years elapsed from age 35)
const age65Nominal = results.nominalData.find(d => d.age === 65);
const age65Deflated = results.deflatedData.find(d => d.age === 65);

if (!age65Nominal || !age65Deflated) {
  console.error('FAIL: Could not locate projection entries for Age 65.');
  process.exit(1);
}

console.log(`Age 65 Nominal Net Worth: $${Math.round(age65Nominal.netWorth).toLocaleString()}`);
console.log(`Age 65 Deflated Net Worth: $${Math.round(age65Deflated.netWorth).toLocaleString()}`);

// Nominal Peak Net Worth / Net Worth at retirement age 65 should be around $746k
if (age65Nominal.netWorth < 700000 || age65Nominal.netWorth > 800000) {
  console.error(`FAIL: Expected Age 65 Nominal Net Worth to be ~$750,000, got $${Math.round(age65Nominal.netWorth)}`);
  process.exit(1);
}
console.log('✅ PASS: Age 65 Nominal Net Worth is in the expected ~$700k-$800k range.');

// Deflated Net Worth at retirement age 65 should be around $307k
if (age65Deflated.netWorth < 280000 || age65Deflated.netWorth > 330000) {
  console.error(`FAIL: Expected Age 65 Deflated Net Worth to be ~$300,000, got $${Math.round(age65Deflated.netWorth)}`);
  process.exit(1);
}
console.log('✅ PASS: Age 65 Deflated Net Worth is in the expected ~$280k-$330k range.');

// Verify adjustment factor: Nominal / Deflated should match (1 + inflation)^30
const actualRatio = age65Nominal.netWorth / age65Deflated.netWorth;
const expectedRatio = Math.pow(1 + (DEFAULT_FIRE_INPUTS.inflationRate / 100), 65 - DEFAULT_FIRE_INPUTS.currentAge);

console.log(`Adjustment ratio: ${actualRatio.toFixed(3)} (expected ${expectedRatio.toFixed(3)})`);
if (Math.abs(actualRatio - expectedRatio) > 0.05) {
  console.error('FAIL: The inflation adjustment ratio between nominal and deflated net worth is incorrect.');
  process.exit(1);
}
console.log('✅ PASS: Inflation adjustment ratio is correct.');

// Verify Summary Statistics
console.log('Verifying summary metrics consistency...');

console.log(`- Nominal Target at Ready Age: $${Math.round(results.nominalRetirementReadyTarget).toLocaleString()}`);
console.log(`- Deflated Target at Ready Age: $${Math.round(results.deflatedRetirementReadyTarget).toLocaleString()}`);
if (results.nominalRetirementReadyTarget <= results.deflatedRetirementReadyTarget) {
  console.error('FAIL: Nominal retirement ready target should be larger than deflated target.');
  process.exit(1);
}

console.log(`- Nominal Portfolio at Retirement: $${Math.round(results.nominalPortfolioAtRetirement).toLocaleString()}`);
console.log(`- Deflated Portfolio at Retirement: $${Math.round(results.deflatedPortfolioAtRetirement).toLocaleString()}`);
if (results.nominalPortfolioAtRetirement <= results.deflatedPortfolioAtRetirement) {
  console.error('FAIL: Nominal portfolio at retirement should be larger than deflated portfolio.');
  process.exit(1);
}

console.log(`- Nominal Retirement Income: $${Math.round(results.nominalRetirementIncomeSources).toLocaleString()} / yr`);
console.log(`- Deflated Retirement Income: $${Math.round(results.deflatedRetirementIncomeSources).toLocaleString()} / yr`);
if (results.nominalRetirementIncomeSources <= results.deflatedRetirementIncomeSources) {
  console.error('FAIL: Nominal retirement income sources should be larger than deflated sources.');
  process.exit(1);
}

console.log('✅ PASS: All summary metrics correctly compute and return nominal and deflated versions.');
console.log('--- ALL NOMINAL VS DEFLATED VERIFICATION TESTS PASSED ---');
process.exit(0);
