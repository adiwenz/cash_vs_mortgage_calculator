import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('--- Running Default Parameters Simulation Verification ---');

const results = runFireSimulation(DEFAULT_FIRE_INPUTS);

console.log('Verifying default inputs...');
console.log('- Default Current Age:', DEFAULT_FIRE_INPUTS.currentAge);
console.log('- Main Income Start Age:', DEFAULT_FIRE_INPUTS.incomeList[0]?.startAge);
console.log('- Main Spending Start Age:', DEFAULT_FIRE_INPUTS.spendingPhases[0]?.startAge);

console.log('Verifying simulation results...');
console.log('- Computed Retirement Ready Age:', results.retirementReadyAge);
console.log('- Money Lasts through timeline:', results.moneyLasts);

// Assertions
if (DEFAULT_FIRE_INPUTS.currentAge !== 35) {
  console.error('FAIL: Default current age should be 35');
  process.exit(1);
}

if (DEFAULT_FIRE_INPUTS.incomeList[0]?.startAge !== 35) {
  console.error('FAIL: Main income start age must match current age (35) to prevent compounding growth discrepancy');
  process.exit(1);
}

if (DEFAULT_FIRE_INPUTS.spendingPhases[0]?.startAge !== 35) {
  console.error('FAIL: Main spending phase start age must match current age (35)');
  process.exit(1);
}

if (results.retirementReadyAge !== 63) {
  console.error(`FAIL: Expected default retirement ready age to be 63, got ${results.retirementReadyAge}`);
  process.exit(1);
}

const firstYearBreakdown = results.data[0];
if (!firstYearBreakdown) {
  console.error('FAIL: No yearly breakdown found in results.data');
  process.exit(1);
}

// In the simulation, income in the first year should be exactly $50,000 (simpleIncome)
if (firstYearBreakdown.income !== 50000) {
  console.error(`FAIL: Expected first year income to be exactly $50,000, got $${firstYearBreakdown.income}`);
  process.exit(1);
}

console.log('✅ ALL TESTS PASSED: Default inputs correctly yield a retirement ready age of 63 with no initial compound growth errors.');
process.exit(0);
