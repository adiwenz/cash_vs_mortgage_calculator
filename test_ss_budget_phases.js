import { getNormalizedPhases } from './src/fireCalculations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('========================================================================');
console.log('Running test: Social Security budget phases and boundaries');
console.log('========================================================================');

try {
  // Test 1: No Social Security Event Enabled
  console.log('Testing Scenario 1: Social Security Disabled...');
  const inputs1 = getMappedDefaultInputs();
  // Disable social security
  const ssEv1 = inputs1.lifeEvents.find(e => e.type === 'socialSecurity');
  if (ssEv1) {
    ssEv1.enabled = false;
  }
  
  const phases1 = getNormalizedPhases(inputs1);
  // Default retirement age is 65, life expectancy is 85.
  // There should be a boundary at 65, but NOT at 67.
  const has67Boundary1 = phases1.some(p => p.startAge === 67 || p.endAge === 67);
  expect(has67Boundary1).toBe(false);
  
  // Verify retirement phase is standard
  const retirementPhase1 = phases1.find(p => p.startAge >= 65);
  expect(retirementPhase1.name).toBe('Retirement');
  expect(retirementPhase1.icon).toBe('🏖️');
  console.log('✅ Scenario 1 Passed.');

  // Test 2: Social Security Enabled at claim age 67
  console.log('Testing Scenario 2: Social Security Enabled at Claiming Age 67...');
  const inputs2 = getMappedDefaultInputs();
  const ssEv2 = inputs2.lifeEvents.find(e => e.type === 'socialSecurity');
  expect(!!ssEv2).toBe(true);
  ssEv2.enabled = true;
  ssEv2.claimingAge = 67;
  inputs2.targetRetirementAge = 65;
  
  const phases2 = getNormalizedPhases(inputs2);
  // Boundaries should include 67 (split 65 to 85 into [65, 67] and [67, 85])
  const retirementPreSS = phases2.find(p => p.startAge === 65);
  expect(retirementPreSS.endAge).toBe(67);
  expect(retirementPreSS.name).toBe('Retirement');
  expect(retirementPreSS.icon).toBe('🏖️');

  const retirementPostSS = phases2.find(p => p.startAge === 67);
  expect(retirementPostSS.endAge).toBe(85);
  expect(retirementPostSS.name).toBe('Receiving SS');
  expect(retirementPostSS.icon).toBe('💰');
  console.log('✅ Scenario 2 Passed.');

  // Test 3: Early Claiming SS (e.g. claim at 62, retire at 65)
  console.log('Testing Scenario 3: Working while receiving SS (Claim at 62, Retire at 65)...');
  const inputs3 = getMappedDefaultInputs();
  const ssEv3 = inputs3.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEv3.enabled = true;
  ssEv3.claimingAge = 62;
  // Make sure retirement age is 65
  const retireEv3 = inputs3.lifeEvents.find(e => e.type === 'retire');
  if (retireEv3) {
    retireEv3.age = 65;
  }
  inputs3.targetRetirementAge = 65;

  const phases3 = getNormalizedPhases(inputs3);
  // We expect a boundary at 62.
  // Phase [62, 65] should be working but receiving SS.
  const workSSPhase = phases3.find(p => p.startAge === 62);
  expect(workSSPhase.endAge).toBe(65);
  expect(workSSPhase.name).toBe('Working (Receiving SS)');
  expect(workSSPhase.icon).toBe('💰');

  // Phase [65, 85] should be retirement receiving SS.
  const retireSSPhase = phases3.find(p => p.startAge === 65);
  expect(retireSSPhase.name).toBe('Receiving SS');
  expect(retireSSPhase.icon).toBe('💰');
  console.log('✅ Scenario 3 Passed.');

  // Test 4: Marriage Phase receiving SS
  console.log('Testing Scenario 4: Marriage receiving SS (Marriage at 66, Claim at 62, Retire at 70)...');
  const inputs4 = getMappedDefaultInputs();
  const ssEv4 = inputs4.lifeEvents.find(e => e.type === 'socialSecurity');
  ssEv4.enabled = true;
  ssEv4.claimingAge = 62;
  const retireEv4 = inputs4.lifeEvents.find(e => e.type === 'retire');
  if (retireEv4) {
    retireEv4.age = 70;
  }
  // Add marriage event at 66
  inputs4.lifeEvents.push({
    id: 'marriage-event',
    type: 'marriage',
    enabled: true,
    age: 66
  });

  const phases4 = getNormalizedPhases(inputs4);
  // Phase starting at 66 should be marriage phase under SS
  const marriageSSPhase = phases4.find(p => p.startAge === 66);
  expect(marriageSSPhase.name).toBe('Marriage Phase (Receiving SS)');
  expect(marriageSSPhase.icon).toBe('💰');
  console.log('✅ Scenario 4 Passed.');

  console.log('🎉 ALL SOCIAL SECURITY BUDGET PHASES TESTS PASSED SUCCESSFULLY.');
  process.exit(0);
} catch (err) {
  console.error('❌ Social Security budget phases tests failed:', err.stack);
  process.exit(1);
}
