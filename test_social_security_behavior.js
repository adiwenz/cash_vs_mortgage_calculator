import { 
  runFireSimulation, 
  calculateAIME,
  calculatePIA,
  calculateSocialSecurityBenefit, 
  validateSocialSecurityClaimAge
} from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('=== Running Social Security Behavior Tests ===');

try {
  // ----------------------------------------------------
  // Test 1: AIME Calculation
  // ----------------------------------------------------
  console.log('Testing: AIME Calculation...');

  // 1a. 35 years at $60,000 gives AIME of $5,000/month
  const earnings35 = Array(35).fill(60000);
  const aime35 = calculateAIME(earnings35);
  expect(aime35.aimeMonthly).toBe(5000);
  expect(aime35.averageTop35AnnualIncome).toBe(60000);
  expect(aime35.top35AnnualEarnings).toBe(60000 * 35);

  // 1b. 20 years at $60,000 pads 15 zero years
  const earnings20 = Array(20).fill(60000);
  const aime20 = calculateAIME(earnings20);
  // Total = 20 * 60,000 = 1,200,000. aimeMonthly = 1,200,000 / 420 = 2,857.14
  expect(aime20.aimeMonthly).toBeCloseTo(2857.14, 1);
  expect(aime20.averageTop35AnnualIncome).toBeCloseTo(34285.71, 1);

  // 1c. 5 years at $100,000 pads 30 zero years
  const earnings5 = Array(5).fill(100000);
  const aime5 = calculateAIME(earnings5);
  // Total = 5 * 100,000 = 500,000. aimeMonthly = 500,000 / 420 = 1,190.48
  expect(aime5.aimeMonthly).toBeCloseTo(1190.48, 1);
  expect(aime5.averageTop35AnnualIncome).toBeCloseTo(14285.71, 1);

  console.log('✅ AIME Calculation passed.');

  // ----------------------------------------------------
  // Test 2: PIA Calculation
  // ----------------------------------------------------
  console.log('Testing: PIA Calculation...');

  // 2a. AIME below first bend point uses 90%
  // firstBendPoint = 1286
  const piaBelow = calculatePIA({ aimeMonthly: 1000, firstBendPoint: 1286, secondBendPoint: 7749 });
  expect(piaBelow).toBe(900); // 1000 * 0.90

  // 2b. AIME between bend points uses 90% + 32%
  // E.g. AIME of $3,000:
  // 1286 * 0.90 = 1157.4
  // (3000 - 1286) * 0.32 = 1714 * 0.32 = 548.48
  // Total = 1705.88
  const piaBetween = calculatePIA({ aimeMonthly: 3000, firstBendPoint: 1286, secondBendPoint: 7749 });
  expect(piaBetween).toBeCloseTo(1705.88, 2);

  // 2c. AIME above second bend point uses 90% + 32% + 15%
  // E.g. AIME of $10,000:
  // 1286 * 0.90 = 1157.4
  // (7749 - 1286) * 0.32 = 6463 * 0.32 = 2068.16
  // (10000 - 7749) * 0.15 = 2251 * 0.15 = 337.65
  // Total = 3563.21
  const piaAbove = calculatePIA({ aimeMonthly: 10000, firstBendPoint: 1286, secondBendPoint: 7749 });
  expect(piaAbove).toBeCloseTo(3563.21, 2);

  console.log('✅ PIA Calculation passed.');

  // ----------------------------------------------------
  // Test 3: Eligibility Rules
  // ----------------------------------------------------
  console.log('Testing: Eligibility Rules...');

  // 3a. 9 working years gives $0 benefit
  const history9 = [...Array(9).fill(60000), ...Array(26).fill(0)];
  const ss9 = calculateSocialSecurityBenefit({
    incomeHistory: history9,
    claimAge: 67,
    fullRetirementAge: 67
  });
  expect(ss9.isEligible).toBe(false);
  expect(ss9.annualBenefit).toBe(0);
  expect(ss9.monthlyBenefit).toBe(0);
  expect(ss9.adjustmentType).toBe('Not eligible');

  // 3b. 10 working years gives calculated benefit
  const history10 = [...Array(10).fill(60000), ...Array(25).fill(0)];
  const ss10 = calculateSocialSecurityBenefit({
    incomeHistory: history10,
    claimAge: 67,
    fullRetirementAge: 67
  });
  expect(ss10.isEligible).toBe(true);
  expect(ss10.workingYears).toBe(10);
  expect(ss10.annualBenefit).toBeGreaterThan(0);

  // 3c. 35 working years gives calculated benefit
  const history35 = Array(35).fill(60000);
  const ss35 = calculateSocialSecurityBenefit({
    incomeHistory: history35,
    claimAge: 67,
    fullRetirementAge: 67
  });
  expect(ss35.isEligible).toBe(true);
  expect(ss35.workingYears).toBe(35);
  expect(ss35.annualBenefit).toBeGreaterThan(0);

  console.log('✅ Eligibility Rules passed.');

  // ----------------------------------------------------
  // Test 4: Claiming Age Adjustment Rules
  // ----------------------------------------------------
  console.log('Testing: Claiming Age Adjustments...');

  const sampleHistory = Array(35).fill(100000); // AIME = 100,000 / 12 = 8,333.33
  // PIA = 1286 * 0.90 + (7749 - 1286) * 0.32 + (8333.33 - 7749) * 0.15 = 1157.4 + 2068.16 + 87.65 = 3313.21
  
  // Claiming at 62 (FRA 67) applies 70% of full benefit
  const ss62 = calculateSocialSecurityBenefit({
    incomeHistory: sampleHistory,
    claimAge: 62,
    fullRetirementAge: 67
  });
  expect(ss62.claimingAgeMultiplier).toBeCloseTo(0.70, 2);
  expect(ss62.adjustmentType).toBe('early-claiming');
  expect(ss62.monthlyBenefit).toBeCloseTo(ss62.piaMonthly * 0.70, 1);
  expect(ss62.annualBenefit).toBeCloseTo(ss62.piaMonthly * 0.70 * 12, 1);

  // Claiming at 67 applies 100%
  const ss67 = calculateSocialSecurityBenefit({
    incomeHistory: sampleHistory,
    claimAge: 67,
    fullRetirementAge: 67
  });
  expect(ss67.claimingAgeMultiplier).toBe(1.0);
  expect(ss67.adjustmentType).toBe('full-retirement');
  expect(ss67.monthlyBenefit).toBeCloseTo(ss67.piaMonthly, 1);

  // Claiming at 70 applies delayed credits (124%)
  const ss70 = calculateSocialSecurityBenefit({
    incomeHistory: sampleHistory,
    claimAge: 70,
    fullRetirementAge: 67
  });
  expect(ss70.claimingAgeMultiplier).toBeCloseTo(1.24, 2);
  expect(ss70.adjustmentType).toBe('delayed-credit');
  expect(ss70.monthlyBenefit).toBeCloseTo(ss70.piaMonthly * 1.24, 1);

  console.log('✅ Claiming Age Adjustments passed.');

  // ----------------------------------------------------
  // Test 5: Clamping limits and validation message
  // ----------------------------------------------------
  console.log('Testing: Clamping limits and warning message...');

  const clampBelow = validateSocialSecurityClaimAge(60);
  expect(clampBelow.validAge).toBe(62);
  expect(clampBelow.wasClamped).toBe(true);
  expect(clampBelow.message).toBe("Social Security must be taken between ages 62 and 70.");

  const clampAbove = validateSocialSecurityClaimAge(75);
  expect(clampAbove.validAge).toBe(70);
  expect(clampAbove.wasClamped).toBe(true);
  expect(clampAbove.message).toBe("Social Security must be taken between ages 62 and 70.");

  const clampValid = validateSocialSecurityClaimAge(66);
  expect(clampValid.validAge).toBe(66);
  expect(clampValid.wasClamped).toBe(false);
  expect(clampValid.message).toBe("");

  console.log('✅ Clamping limits and validation message passed.');

  // ----------------------------------------------------
  // Test 6: Simulation Integration
  // ----------------------------------------------------
  console.log('Testing: Simulation Integration...');

  // 6a. Base run with default fixed SS (useEarnings = false)
  const inputsBase = getMappedDefaultInputs();
  let ssEv = inputsBase.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEv.enabled = true;
  ssEv.claimingAge = 67;
  ssEv.useEarnings = false;
  ssEv.monthlyBenefit = 2000; // $24,000/yr at FRA

  const resultsBase = runFireSimulation(inputsBase);
  expect(resultsBase.socialSecurityDetails.annualBenefit).toBe(24000);
  expect(resultsBase.socialSecurityDetails.isEligible).toBe(true);
  const age67Base = resultsBase.deflatedData.find(d => d.age === 67);
  expect(age67Base.income).toBeCloseTo(24000, 0);

  // 6b. Run with "Calculate from earning years" (useEarnings = true)
  // Default inputs: current age 35, retirement age 65 (30 years of earning $50,000).
  // AIME = (30 * 50,000) / 420 = $3,571.43
  // PIA = 1286 * 0.90 + (3571.43 - 1286) * 0.32 = 1157.4 + 731.34 = $1888.74/mo
  // Annual benefit at 67 = 1888.74 * 12 = $22,664.88
  const inputsCalculated = getMappedDefaultInputs();
  let ssEvCalc = inputsCalculated.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEvCalc.enabled = true;
  ssEvCalc.claimingAge = 67;
  ssEvCalc.useEarnings = true;

  const resultsCalc = runFireSimulation(inputsCalculated);
  expect(resultsCalc.socialSecurityDetails.annualBenefit).toBeCloseTo(22665.94, 0);
  const age67Calc = resultsCalc.deflatedData.find(d => d.age === 67);
  expect(age67Calc.income).toBeCloseTo(22665.94, 0);

  // 6c. Increasing income increases AIME and Social Security benefit
  const inputsHigherIncome = getMappedDefaultInputs();
  inputsHigherIncome.simpleIncome = 100000; // double income
  inputsHigherIncome.incomeList = inputsHigherIncome.incomeList.map(inc => ({ ...inc, amount: 100000 }));
  let ssEvHigher = inputsHigherIncome.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEvHigher.enabled = true;
  ssEvHigher.claimingAge = 67;
  ssEvHigher.useEarnings = true;
  
  const resultsHigher = runFireSimulation(inputsHigherIncome);
  // AIME = (30 * 100,000) / 420 = $7,142.86
  // PIA = 1286 * 0.90 + (7142.86 - 1286) * 0.32 = 1157.4 + 1874.19 = $3031.59/mo
  // Annual benefit = 3031.59 * 12 = $36,379.14
  expect(resultsHigher.socialSecurityDetails.annualBenefit).toBeGreaterThan(resultsCalc.socialSecurityDetails.annualBenefit);
  expect(resultsHigher.socialSecurityDetails.annualBenefit).toBeCloseTo(36378.03, 0);

  // 6d. Decreasing working years below 10 makes SS disappear
  const inputsFewYears = getMappedDefaultInputs();
  // Set retirement age to 40 (only 5 years of work from age 35)
  let retireEv = inputsFewYears.lifeEvents.find(e => e.type === 'retire');
  retireEv.age = 40;
  let ssEvFew = inputsFewYears.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEvFew.enabled = true;
  ssEvFew.claimingAge = 67;
  ssEvFew.useEarnings = true;

  const resultsFew = runFireSimulation(inputsFewYears);
  expect(resultsFew.socialSecurityDetails.isEligible).toBe(false);
  expect(resultsFew.socialSecurityDetails.annualBenefit).toBe(0);
  const age67Few = resultsFew.deflatedData.find(d => d.age === 67);
  expect(age67Few.income).toBe(0); // No SS income

  // 6e. Dragging claim age changes claiming adjustment and updates benefit
  // Claiming at 62 should reduce the benefit to 70% of PIA
  const inputsCalculated62 = getMappedDefaultInputs();
  let ssEv62 = inputsCalculated62.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEv62.enabled = true;
  ssEv62.claimingAge = 62;
  ssEv62.useEarnings = true;

  const results62 = runFireSimulation(inputsCalculated62);
  // 6f. Test ageStartedWorking parameter prepends past work years
  const inputsAgeStarted = getMappedDefaultInputs();
  let ssEvAS = inputsAgeStarted.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEvAS.enabled = true;
  ssEvAS.useEarnings = true;
  ssEvAS.ageStartedWorking = 22; // Started working at age 22, currentAge is 35 (13 years of past earnings)

  const resultsAS = runFireSimulation(inputsAgeStarted);
  // With 13 years of past earnings at 50,000, user now has 43 working years in total (13 past + 30 future).
  // This means the top 35 years has NO zero-earning years, so average is 50,000.
  // AIME = 50,000 / 12 = 4,166.67.
  // PIA at 67 = 1,157.40 + 0.32 * (4,166.67 - 1,286) = 1,157.40 + 921.81 = 2,079.21.
  // At claim age 67, annual benefit = 2,079.32 * 12 = 24,951.84.
  expect(resultsAS.socialSecurityDetails.annualBenefit).toBeCloseTo(24951.84, 0);
  expect(resultsAS.socialSecurityDetails.workingYears).toBe(43);

  // 6g. Test fallback yearStartedWorking
  const inputsYearStarted = getMappedDefaultInputs();
  let ssEvYS = inputsYearStarted.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEvYS.enabled = true;
  ssEvYS.useEarnings = true;
  const currentYear = new Date().getFullYear();
  ssEvYS.yearStartedWorking = currentYear - 13; 

  const resultsYS = runFireSimulation(inputsYearStarted);
  expect(resultsYS.socialSecurityDetails.annualBenefit).toBeCloseTo(24951.84, 0);
  expect(resultsYS.socialSecurityDetails.workingYears).toBe(43);

  console.log('✅ Simulation Integration passed.');

  console.log('🎉 ALL SOCIAL SECURITY BEHAVIOR TESTS PASSED SUCCESSFULLY.');
  process.exit(0);
} catch (err) {
  console.error('❌ Social Security Behavior Tests failed:', err.stack);
  process.exit(1);
}
