import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_retirement_spending_formula ---');

try {
  // Case 1: Run with default inputs (which has healthcare model enabled)
  // Deflated retirement spending at 65 should include base spending ($29,750) + Medicare premium ($4,000)
  const inputsDefault = getMappedDefaultInputs();
  const resultsDefault = runFireSimulation(inputsDefault);

  // deflatedAnnualRetirementSpending is the deflated total expenses at retirement age 65
  const totalRetirementSpendingDeflated = resultsDefault.deflatedAnnualRetirementSpending;
  console.log(`- Deflated total retirement spending at 65 (with healthcare): $${Math.round(totalRetirementSpendingDeflated).toLocaleString()}`);
  
  // Subtracting the Medicare premium ($4,000 in today's dollars) to get base lifestyle spending
  const baseSpendingDeflated = totalRetirementSpendingDeflated - 4000;
  console.log(`- Calculated base retirement spending (excluding healthcare): $${Math.round(baseSpendingDeflated).toLocaleString()}`);
  expect(baseSpendingDeflated).toBeCloseTo(29748, 0);

  // Case 2: Run with healthcare model disabled
  // Deflated retirement spending at 65 should be exactly $29,748
  const inputsNoHC = getMappedDefaultInputs();
  inputsNoHC.enableHealthcareModel = false;
  
  const resultsNoHC = runFireSimulation(inputsNoHC);
  const totalRetirementSpendingNoHC = resultsNoHC.deflatedAnnualRetirementSpending;
  console.log(`- Deflated total retirement spending at 65 (without healthcare): $${Math.round(totalRetirementSpendingNoHC).toLocaleString()}`);
  expect(totalRetirementSpendingNoHC).toBeCloseTo(29748, 0);

  console.log('✅ test_retirement_spending_formula passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_retirement_spending_formula failed:', error.message);
  process.exit(1);
}
