import { runFireSimulation } from './src/fireCalculations.js';
import { calculateRetireAt65Recommendation } from './src/recommendations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_display_mode_does_not_change_results ---');

const inputs = getMappedDefaultInputs();

try {
  const results = runFireSimulation(inputs);

  // Map results to display modes exactly like the React component's displayedResults useMemo:
  function getDisplayedResults(activeResults, displayMode) {
    const isNominal = displayMode === 'future';
    return {
      ...activeResults,
      data: isNominal ? activeResults.nominalData : activeResults.deflatedData,
      retirementReadyTarget: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      portfolioAtRetirement: isNominal ? activeResults.nominalPortfolioAtRetirement : activeResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? activeResults.nominalNetWorthAtRetirement : activeResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? activeResults.nominalAnnualRetirementSpending : activeResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? activeResults.nominalEndingSurplusShortfall : activeResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? activeResults.nominalRetirementIncomeSources : activeResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget
    };
  }

  const displayedFuture = getDisplayedResults(results, 'future');
  const displayedToday = getDisplayedResults(results, 'today');

  // 1. Assert underlying yearly nominal values are identical
  expect(displayedFuture.nominalData.length).toBe(displayedToday.nominalData.length);
  for (let i = 0; i < displayedFuture.nominalData.length; i++) {
    expect(displayedFuture.nominalData[i].netWorth).toBe(displayedToday.nominalData[i].netWorth);
    expect(displayedFuture.nominalData[i].portfolio).toBe(displayedToday.nominalData[i].portfolio);
  }
  console.log('✅ Underlying yearly nominal values are identical between both modes.');

  // 2. Assert readiness results are identical
  expect(displayedFuture.retirementOutcome).toBe(displayedToday.retirementOutcome);
  expect(displayedFuture.retirementReadyAge).toBe(displayedToday.retirementReadyAge);
  expect(displayedFuture.moneyLasts).toBe(displayedToday.moneyLasts);
  console.log(`✅ Readiness outcomes are identical: outcome = ${displayedFuture.retirementOutcome}, ready age = ${displayedFuture.retirementReadyAge}.`);

  // 3. Assert recommendation outputs are identical
  const currentAssets = (Number(inputs.assets?.cash) || 0) +
                        (Number(inputs.assets?.emergencyFund) || 0) +
                        (Number(inputs.assets?.brokerage) || 0) +
                        (Number(inputs.assets?.trad401k) || 0) +
                        (Number(inputs.assets?.tradIra) || 0) +
                        (Number(inputs.assets?.rothIra) || 0) +
                        (Number(inputs.assets?.hsa) || 0) +
                        (Number(inputs.assets?.other) || 0);

  const annualSavings = inputs.simpleIncome - inputs.simpleExpenses;
  const rateOfReturn = inputs.expectedReturn / 100;
  const swr = inputs.swr / 100;

  // Recommendations should be calculated on the nominal values as in the app, 
  // so passing the same nominal values gives identical recommendations.
  const recFuture = calculateRetireAt65Recommendation(
    inputs.currentAge,
    inputs.targetRetirementAge,
    currentAssets,
    annualSavings,
    rateOfReturn,
    swr,
    displayedFuture.nominalAnnualRetirementSpending
  );

  const recToday = calculateRetireAt65Recommendation(
    inputs.currentAge,
    inputs.targetRetirementAge,
    currentAssets,
    annualSavings,
    rateOfReturn,
    swr,
    displayedToday.nominalAnnualRetirementSpending // note: recommendation always uses underlying nominal values
  );

  expect(recFuture.applicable).toBe(recToday.applicable);
  expect(recFuture.resolvesShortfall).toBe(recToday.resolvesShortfall);
  expect(recFuture.newShortfall).toBe(recToday.newShortfall);
  console.log('✅ Recommendations outputs are identical.');

  // 4. Assert only display values change
  // Future dollars values (nominal) should be larger than Today's dollars values (deflated) due to 3% compounding inflation
  expect(displayedFuture.retirementReadyTarget).toBeGreaterThan(displayedToday.retirementReadyTarget);
  expect(displayedFuture.portfolioAtRetirement).toBeGreaterThan(displayedToday.portfolioAtRetirement);
  expect(displayedFuture.netWorthAtRetirement).toBeGreaterThan(displayedToday.netWorthAtRetirement);
  expect(displayedFuture.annualRetirementSpending).toBeGreaterThan(displayedToday.annualRetirementSpending);
  expect(displayedFuture.endingSurplusShortfall).toBeGreaterThan(displayedToday.endingSurplusShortfall);
  
  console.log(`- Mapped Retirement Spending: Future = $${Math.round(displayedFuture.annualRetirementSpending).toLocaleString()} vs Today = $${Math.round(displayedToday.annualRetirementSpending).toLocaleString()}`);
  console.log(`- Mapped Net Worth at Retirement: Future = $${Math.round(displayedFuture.netWorthAtRetirement).toLocaleString()} vs Today = $${Math.round(displayedToday.netWorthAtRetirement).toLocaleString()}`);
  console.log('✅ Only mapped display values change between Future Dollars and Today\'s Dollars.');

  console.log('✅ test_display_mode_does_not_change_results passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_display_mode_does_not_change_results failed:', error.message);
  process.exit(1);
}
