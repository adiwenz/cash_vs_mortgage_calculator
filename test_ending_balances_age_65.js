/* global process */
import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';


console.log('--- Running test_ending_balances_age_65 ---');

try {
  const inputs = getMappedDefaultInputs();
  const results = runFireSimulation(inputs);

  // Locate the simulation records for age 65
  const age65Nominal = results.nominalData.find(d => d.age === 65);
  const age65Deflated = results.deflatedData.find(d => d.age === 65);

  if (!age65Nominal || !age65Deflated) {
    throw new Error('Could not locate age 65 in simulation results.');
  }

  console.log('\n========================================================================');
  console.log('Ending Balances of All Accounts at Age 65 (Default Inputs Scenario)');
  console.log('========================================================================\n');

  console.log('Nominal Values (Future Dollars at Age 65):');
  console.table({
    'Cash': { Amount: `$${Math.round(age65Nominal.cashBalance).toLocaleString()}` },
    'Emergency Fund': { Amount: `$${Math.round(age65Nominal.emergencyFundBalance).toLocaleString()}` },
    'Taxable Brokerage': { Amount: `$${Math.round(age65Nominal.brokerageBalance).toLocaleString()}` },
    'Traditional 401(k)': { Amount: `$${Math.round(age65Nominal.trad401kBalance).toLocaleString()}` },
    'Traditional IRA': { Amount: `$${Math.round(age65Nominal.tradIraBalance).toLocaleString()}` },
    'Roth IRA': { Amount: `$${Math.round(age65Nominal.rothIraBalance).toLocaleString()}` },
    'HSA': { Amount: `$${Math.round(age65Nominal.hsaBalance).toLocaleString()}` },
    'Other Assets': { Amount: `$${Math.round(age65Nominal.otherBalance).toLocaleString()}` },
    'Debt Balance': { Amount: `$${Math.round(age65Nominal.debtBalance).toLocaleString()}` },
    'Total Portfolio': { Amount: `$${Math.round(age65Nominal.portfolio).toLocaleString()}` },
    'Net Worth': { Amount: `$${Math.round(age65Nominal.netWorth).toLocaleString()}` }
  });

  console.log('\nDeflated Values (Today\'s Dollars - Inflation Adjusted):');
  console.table({
    'Cash': { Amount: `$${Math.round(age65Deflated.cashBalance).toLocaleString()}` },
    'Emergency Fund': { Amount: `$${Math.round(age65Deflated.emergencyFundBalance).toLocaleString()}` },
    'Taxable Brokerage': { Amount: `$${Math.round(age65Deflated.brokerageBalance).toLocaleString()}` },
    'Traditional 401(k)': { Amount: `$${Math.round(age65Deflated.trad401kBalance).toLocaleString()}` },
    'Traditional IRA': { Amount: `$${Math.round(age65Deflated.tradIraBalance).toLocaleString()}` },
    'Roth IRA': { Amount: `$${Math.round(age65Deflated.rothIraBalance).toLocaleString()}` },
    'HSA': { Amount: `$${Math.round(age65Deflated.hsaBalance).toLocaleString()}` },
    'Other Assets': { Amount: `$${Math.round(age65Deflated.otherBalance).toLocaleString()}` },
    'Debt Balance': { Amount: `$${Math.round(age65Deflated.debtBalance).toLocaleString()}` },
    'Total Portfolio': { Amount: `$${Math.round(age65Deflated.portfolio).toLocaleString()}` },
    'Net Worth': { Amount: `$${Math.round(age65Deflated.netWorth).toLocaleString()}` }
  });

  // Verify that the balances are retrieved and make basic assertions
  expect(typeof age65Nominal.portfolio).toBe('number');
  expect(typeof age65Nominal.netWorth).toBe('number');

  // Verify portfolio exists and is a positive number
  expect(age65Nominal.portfolio > 0).toBe(true);
  expect(age65Nominal.netWorth > 0).toBe(true);

  console.log('✅ test_ending_balances_age_65 passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_ending_balances_age_65 failed:', error.stack);
  process.exit(1);
}
