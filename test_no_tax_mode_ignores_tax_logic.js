import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_no_tax_mode_ignores_tax_logic ---');

const inputs = getMappedDefaultInputs();
inputs.includeTaxes = false; // ensure tax-unaware mode is active
inputs.budgetDetails = undefined;

try {
  const results = runFireSimulation(inputs);
  const dataNominal = results.nominalData;
  const dataDeflated = results.deflatedData;

  // 1. Verify tax fields are 0 for all years of the simulation (both nominal and deflated)
  dataNominal.forEach(row => {
    expect(row.taxes).toBe(0);
  });
  dataDeflated.forEach(row => {
    expect(row.taxes).toBe(0);
  });
  console.log('✅ Tax fields are indeed 0 for all years of the simulation.');

  // 2. Verify savings scales with income (balanced budget scaling), meaning deflated savings remains constant and nominal grows
  // Pre-retirement (ages 35 to 64)
  for (let age = 35; age < 65; age++) {
    const rowNominal = dataNominal.find(d => d.age === age);
    expect(rowNominal.savings).toBeCloseTo(7500 * Math.pow(1.03, age - 35), 0);

    const row = dataDeflated.find(d => d.age === age);
    expect(row.savings).toBeCloseTo(7500, 0);
  }
  console.log('✅ Savings scales with inflation in nominal terms, remaining constant in deflated terms during working years.');

  // 3. Verify lifestyle spending remains $42,500/year pre-retirement in today's dollars (deflated)
  // Pre-retirement (ages 35 to 64)
  for (let age = 35; age < 65; age++) {
    const row = dataDeflated.find(d => d.age === age);
    expect(row.expenses).toBeCloseTo(42500, -1);
  }
  console.log('✅ Deflated pre-retirement lifestyle spending remains exactly $42,500/year.');

  // 4. Compare with includeTaxes: true to show that tax-unaware is unaffected by tax-aware branches
  const inputsTaxAware = getMappedDefaultInputs();
  inputsTaxAware.includeTaxes = true;
  inputsTaxAware.budgetDetails = undefined;
  const resultsTaxAware = runFireSimulation(inputsTaxAware);
  
  // Tax aware simulation should have positive taxes in working years
  const age35TaxAware = resultsTaxAware.nominalData.find(d => d.age === 35);
  expect(age35TaxAware.taxes).toBeGreaterThan(0);
  console.log(`- Tax-aware scenario has positive taxes: Year 0 taxes = $${Math.round(age35TaxAware.taxes).toLocaleString()}`);
  
  // Tax-aware net worth at age 65 should be lower because of taxes paid
  const age65TaxUnaware = results.nominalData.find(d => d.age === 65).netWorth;
  const age65TaxAware = resultsTaxAware.nominalData.find(d => d.age === 65).netWorth;
  console.log(`- Net worth at 65: Tax-unaware = $${Math.round(age65TaxUnaware).toLocaleString()} vs Tax-aware = $${Math.round(age65TaxAware).toLocaleString()}`);
  expect(age65TaxUnaware).toBeGreaterThan(age65TaxAware);
  console.log('✅ Retirement output is correctly differentiated between tax-unaware and tax-aware modes.');

  console.log('✅ test_no_tax_mode_ignores_tax_logic passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_no_tax_mode_ignores_tax_logic failed:', error.message);
  process.exit(1);
}
