import { runFireSimulation, normalizeSocialSecurityEvent } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('=== Running Social Security Initial Calculation Regression Tests ===');

try {
  // Test 1: Shared helper normalizeSocialSecurityEvent defaults and fallbacks
  console.log('Testing: normalizeSocialSecurityEvent normalization rules...');
  
  const mockInputs = { currentAge: 35 };

  // undefined/null/empty/NaN ageStartedWorking should normalize to 22
  const ev1 = { type: 'socialSecurity' };
  const norm1 = normalizeSocialSecurityEvent(ev1, mockInputs);
  expect(norm1.ageStartedWorking).toBe(22);

  const ev2 = { type: 'socialSecurity', ageStartedWorking: null };
  const norm2 = normalizeSocialSecurityEvent(ev2, mockInputs);
  expect(norm2.ageStartedWorking).toBe(22);

  const ev3 = { type: 'socialSecurity', ageStartedWorking: '' };
  const norm3 = normalizeSocialSecurityEvent(ev3, mockInputs);
  expect(norm3.ageStartedWorking).toBe(22);

  const ev4 = { type: 'socialSecurity', ageStartedWorking: NaN };
  const norm4 = normalizeSocialSecurityEvent(ev4, mockInputs);
  expect(norm4.ageStartedWorking).toBe(22);

  // Valid user-entered ages are preserved
  const ev5 = { type: 'socialSecurity', ageStartedWorking: 30 };
  const norm5 = normalizeSocialSecurityEvent(ev5, mockInputs);
  expect(norm5.ageStartedWorking).toBe(30);

  // yearStartedWorking fallback is supported
  const currentYear = new Date().getFullYear();
  const ev6 = { type: 'socialSecurity', yearStartedWorking: currentYear - 13 };
  const norm6 = normalizeSocialSecurityEvent(ev6, mockInputs);
  // currentAge is 35. 35 - 13 = 22.
  expect(norm6.ageStartedWorking).toBe(22);

  // claimingAge defaults to 67 when missing
  const ev7 = { type: 'socialSecurity' };
  const norm7 = normalizeSocialSecurityEvent(ev7, mockInputs);
  expect(norm7.claimingAge).toBe(67);

  // Manual benefit overrides and spouse settings are preserved
  const ev8 = { 
    type: 'socialSecurity', 
    useEarnings: false, 
    monthlyBenefit: 1500,
    spouseSocialSecurityAge: 62,
    spouseEstimatedSocialSecurityBenefit: 800
  };
  const norm8 = normalizeSocialSecurityEvent(ev8, mockInputs);
  expect(norm8.useEarnings).toBe(false);
  expect(norm8.monthlyBenefit).toBe(1500);
  expect(norm8.spouseSocialSecurityAge).toBe(62);
  expect(norm8.spouseEstimatedSocialSecurityBenefit).toBe(800);

  console.log('✅ normalizeSocialSecurityEvent normalization rules passed.');

  // Test 2: Initial simulation calculation matches recalculated calculation
  console.log('Testing: Initial benefit matches benefit after editing and changing back...');
  
  const setupTestInputs = (ageStartedWorking) => {
    const inputs = getMappedDefaultInputs();
    inputs.targetRetirementAge = 60;
    let retireEv = inputs.lifeEvents.find(e => e.type === 'retire');
    if (retireEv) retireEv.age = 60;
    if (inputs.incomeList && inputs.incomeList[0]) {
      inputs.incomeList[0].endAge = 60;
    }
    let ssEv = inputs.lifeEvents.find(e => e.type === 'socialSecurity');
    ssEv.enabled = true;
    ssEv.useEarnings = true;
    if (ageStartedWorking === undefined) {
      delete ssEv.ageStartedWorking;
    } else {
      ssEv.ageStartedWorking = ageStartedWorking;
    }
    return inputs;
  };

  const inputs1 = setupTestInputs(undefined); // undefined to test default fallback
  const results1 = runFireSimulation(inputs1);
  const initialBenefit = results1.socialSecurityDetails.annualBenefit;

  // Recalculate after setting to 30
  const inputs2 = setupTestInputs(30);
  const results2 = runFireSimulation(inputs2);
  const benefitAt30 = results2.socialSecurityDetails.annualBenefit;
  
  // With retirement at 60, future working years = 25.
  // Starting at 30 gives 5 past + 25 future = 30 working years (fewer than 35).
  // Starting at 22 gives 13 past + 25 future = 38 working years (at least 35).
  // Therefore, benefitAt30 should be strictly less than initialBenefit.
  expect(benefitAt30).toBeLessThan(initialBenefit);

  // Recalculate after setting to 22
  const inputs3 = setupTestInputs(22);
  const results3 = runFireSimulation(inputs3);
  const benefitAt22 = results3.socialSecurityDetails.annualBenefit;

  expect(initialBenefit).toBe(benefitAt22);
  console.log('✅ Initial benefit matches benefit after editing ageStartedWorking away and back to 22.');

  // Test 3: Manual Social Security mode is unaffected by normalization
  console.log('Testing: Manual mode is unaffected by normalization...');
  const inputsManual = getMappedDefaultInputs();
  let ssEvManual = inputsManual.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEvManual.enabled = true;
  ssEvManual.useEarnings = false;
  ssEvManual.monthlyBenefit = 2500;
  
  const resultsManual = runFireSimulation(inputsManual);
  expect(resultsManual.socialSecurityDetails.piaMonthly).toBe(2500);
  expect(resultsManual.socialSecurityDetails.monthlyBenefit).toBe(2500); // claiming age 67 multiplier = 1.0
  console.log('✅ Manual mode is unaffected.');

  console.log('🎉 ALL REGRESSION TESTS PASSED SUCCESSFULLY.');
  process.exit(0);
} catch (err) {
  console.error('❌ Regression Tests failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
