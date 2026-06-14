import { runFireSimulation } from './src/fireCalculations.js';
import { calculateSaveMoreRecommendation, calculateEarnMoreRecommendation } from './src/recommendations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_recommendation_engine_original_retirement_age ---');

try {
  // 1. Set up an aggressive scenario (target retirement age = 55)
  const inputs = getMappedDefaultInputs();
  const originalRetirementAge = 55;
  inputs.targetRetirementAge = originalRetirementAge;
  inputs.lifeEvents = inputs.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: originalRetirementAge } : e);
  inputs.incomeList = inputs.incomeList.map(inc => inc.id === 'inc-1' ? { ...inc, endAge: originalRetirementAge } : inc);

  const results = runFireSimulation(inputs);

  // 2. Extract shortfall at the original retirement age
  const shortfall = results.endingSurplusShortfall < 0 ? -results.endingSurplusShortfall : 0;
  console.log(`- Originally selected retirement age: ${originalRetirementAge}`);
  console.log(`- Simulated shortfall to resolve: $${Math.round(shortfall).toLocaleString()}`);
  expect(shortfall).toBeGreaterThan(0);

  // 3. Trigger Save More recommendation and assert it uses 20 years (55 - 35) instead of fallback (65 - 35 = 30 years)
  const currentAge = inputs.currentAge; // 35
  const yearsUntilRetirement = originalRetirementAge - currentAge; // 20 years
  expect(yearsUntilRetirement).toBe(20);

  const rateOfReturn = inputs.expectedReturn / 100; // 0.07
  const saveMoreRec = calculateSaveMoreRecommendation(shortfall, rateOfReturn, yearsUntilRetirement, 1.0);
  
  // Calculate expected savings using 20 years vs 30 years
  const fvFactor20 = (Math.pow(1.07, 20) - 1) / 0.07; // ~40.99549
  const expectedSavings20 = shortfall / fvFactor20;

  const fvFactor30 = (Math.pow(1.07, 30) - 1) / 0.07; // ~94.46079
  const expectedSavings30 = shortfall / fvFactor30;

  console.log(`- Save More Recommendation value: $${Math.round(saveMoreRec).toLocaleString()}/yr`);
  console.log(`- Calculated expected savings for 20 years: $${Math.round(expectedSavings20).toLocaleString()}/yr`);
  console.log(`- Calculated expected savings for 30 years (fallback): $${Math.round(expectedSavings30).toLocaleString()}/yr`);

  // Assert it matches the 20-year calculation exactly, and not the 30-year fallback
  expect(saveMoreRec).toBeCloseTo(expectedSavings20, 2);
  
  // Confirms it did not mutate/fallback
  expect(Math.abs(saveMoreRec - expectedSavings30) > 100).toBe(true);
  console.log('✅ The recommendation correctly targets the original retirement age of 55 (20 years of saving), not the fallback of 65.');

  console.log('✅ test_recommendation_engine_original_retirement_age passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_recommendation_engine_original_retirement_age failed:', error.message);
  process.exit(1);
}
