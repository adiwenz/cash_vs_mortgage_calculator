import { runFireSimulation } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs, buildYearlyResults } from './test_helper.js';

console.log('--- Running test_post_retirement_health_premiums ---');

try {
  // Scenario A: Default retirement age = 65
  const inputsA = getMappedDefaultInputs();
  inputsA.targetRetirementAge = 65;
  
  // Set in lifeEvents as well (since simple mode syncs targetRetirementAge to lifeEvents in the app, 
  // but since we are calling runFireSimulation directly, we need to make sure the retire event is updated)
  inputsA.lifeEvents = inputsA.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 65 } : e);

  const resultsA = runFireSimulation(inputsA);
  const yearlyResultsA = buildYearlyResults(resultsA, inputsA);

  const age64A = yearlyResultsA.find(d => d.age === 64);
  const age65A = yearlyResultsA.find(d => d.age === 65);
  const age66A = yearlyResultsA.find(d => d.age === 66);

  // Assertions for Scenario A
  // Pre-retirement (age 64): health premium should be 0
  expect(age64A.healthPremiums).toBe(0);
  console.log('✅ Scenario A (Retirement 65): Health premium before retirement (Age 64) is 0.');

  // At retirement age 65 (which is also Medicare age): health premium should be medicare premium ($4,000 deflated)
  const premium65A_deflated = age65A.healthPremiums / Math.pow(1.03, 65 - 35);
  expect(premium65A_deflated).toBeCloseTo(4000, 0);
  console.log(`✅ Scenario A (Retirement 65): Health premium at age 65 is Medicare premium ($${Math.round(premium65A_deflated).toLocaleString()} in today's dollars).`);

  // This exposes that preMedicarePremium ($10,000) is irrelevant for retirement at 65:
  console.log('✅ Scenario A: Pre-Medicare premium ($10,000) is indeed irrelevant for retirement-at-65.');

  // Scenario B: Early retirement at age 60
  const inputsB = getMappedDefaultInputs();
  inputsB.targetRetirementAge = 60;
  inputsB.lifeEvents = inputsB.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 60 } : e);
  // Also need to adjust main income endAge so we don't have salary after retirement
  inputsB.incomeList = inputsB.incomeList.map(inc => inc.id === 'inc-1' ? { ...inc, endAge: 60 } : inc);

  const resultsB = runFireSimulation(inputsB);
  const yearlyResultsB = buildYearlyResults(resultsB, inputsB);

  const age59B = yearlyResultsB.find(d => d.age === 59);
  const age60B = yearlyResultsB.find(d => d.age === 60);
  const age64B = yearlyResultsB.find(d => d.age === 64);
  const age65B = yearlyResultsB.find(d => d.age === 65);
  const age66B = yearlyResultsB.find(d => d.age === 66);

  // Assertions for Scenario B
  // Before retirement (age 59): health premium should be 0
  expect(age59B.healthPremiums).toBe(0);
  console.log('✅ Scenario B (Retirement 60): Health premium before retirement (Age 59) is 0.');

  // Between retirement age 60 and Medicare age 65 (Age 60 & 64): health premium should be pre-Medicare premium ($10,000 deflated)
  const premium60B_deflated = age60B.healthPremiums / Math.pow(1.03, 60 - 35);
  const premium64B_deflated = age64B.healthPremiums / Math.pow(1.03, 64 - 35);
  expect(premium60B_deflated).toBeCloseTo(10000, 0);
  expect(premium64B_deflated).toBeCloseTo(10000, 0);
  console.log(`✅ Scenario B (Retirement 60): Health premium at age 60 is pre-Medicare ($${Math.round(premium60B_deflated).toLocaleString()}) and at age 64 is pre-Medicare ($${Math.round(premium64B_deflated).toLocaleString()}).`);

  // At Medicare age (65+) and after: health premium should be Medicare premium ($4,000 deflated)
  const premium65B_deflated = age65B.healthPremiums / Math.pow(1.03, 65 - 35);
  const premium66B_deflated = age66B.healthPremiums / Math.pow(1.03, 66 - 35);
  expect(premium65B_deflated).toBeCloseTo(4000, 0);
  expect(premium66B_deflated).toBeCloseTo(4000, 0);
  console.log(`✅ Scenario B (Retirement 60): Health premium at age 65 is Medicare ($${Math.round(premium65B_deflated).toLocaleString()}) and at age 66 is Medicare ($${Math.round(premium66B_deflated).toLocaleString()}).`);

  console.log('✅ test_post_retirement_health_premiums passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_post_retirement_health_premiums failed:', error.message);
  process.exit(1);
}
