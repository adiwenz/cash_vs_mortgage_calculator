import { getChildCostOffsetRecommendations } from './src/recommendations.js';
import { runFireSimulation, getNormalizedPhases } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('--- Running test_child_recommendations ---');

// helper assertion function
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

try {
  // Test 1: If no child event exists, this recommendation does not appear.
  const noChildInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  noChildInputs.lifeEvents = noChildInputs.lifeEvents.filter(e => e.type !== 'haveChild');
  const noChildRecs = getChildCostOffsetRecommendations(noChildInputs);
  assert(noChildRecs.length === 0, 'Should not return child recommendations when no child event exists');
  console.log('✅ Test 1 Passed: No child event -> no recommendation.');

  // Test 2: Child cost $15,000/year for 18 years creates a $15,000/year temporary income recommendation for 18 years.
  const childInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  childInputs.currentAge = 35;
  childInputs.targetRetirementAge = 65;
  childInputs.lifeEvents = [
    {
      id: 'child-test',
      type: 'haveChild',
      enabled: true,
      name: 'Test Child',
      birthAge: 35, // parent is 35 when child is born
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 15000,
      customAges5to12: 15000,
      customAges13to18: 15000,
      customAges19to22: 15000, // this won't be used since includeCollege is false
      includeCollege: false
    }
  ];
  const recs = getChildCostOffsetRecommendations(childInputs);
  assert(recs.length === 1, 'Should return exactly 1 recommendation for the child event');
  
  const rec = recs[0];
  assert(rec.peakCost === 15000, `Expected peak cost to be 15000, got ${rec.peakCost}`);
  assert(rec.duration === 18, `Expected duration to be 18 years, got ${rec.duration}`);
  console.log('✅ Test 2 Passed: Correct amount and duration for child-specific recommendation.');

  // Test 3: Income boost starts and ends in the same years as child costs.
  // Child is born when parent is 35, support duration is 18 years (ages 0 to 17 inclusive).
  // Child cost years (in parent ages): starts at 35, ends at 53 (exclusive).
  // Boost starts at 35 and ends at 53 (exclusive).
  assert(rec.parentStartAge === 35, `Expected parent start age to be 35, got ${rec.parentStartAge}`);
  assert(rec.parentEndAge === 53, `Expected parent end age to be 53, got ${rec.parentEndAge}`);
  
  const boosts = rec.incomeBoosts;
  // Brackets:
  // Age 0-4 (5 years): starts 35, ends 40 (exclusive)
  // Age 5-12 (8 years): starts 40, ends 48 (exclusive)
  // Age 13-18 (5 years: 13, 14, 15, 16, 17): starts 48, ends 53 (exclusive)
  assert(boosts.length === 3, `Expected 3 active income boost brackets, got ${boosts.length}`);
  
  assert(boosts[0].startAge === 35 && boosts[0].endAge === 40 && boosts[0].amount === 15000, 'Bracket 0-4 boost incorrect');
  assert(boosts[1].startAge === 40 && boosts[1].endAge === 48 && boosts[1].amount === 15000, 'Bracket 5-12 boost incorrect');
  assert(boosts[2].startAge === 48 && boosts[2].endAge === 53 && boosts[2].amount === 15000, 'Bracket 13-18 boost incorrect');
  console.log('✅ Test 3 Passed: Income boost starts and ends in the same years as child costs.');

  // Test 4: Base salary is unchanged.
  // The recommendation engine generates the boosts in `incomeBoosts`, but the baseline inputs simpleIncome and existing main income is not mutated.
  assert(childInputs.simpleIncome === 50000, `Expected simpleIncome to remain 50000, got ${childInputs.simpleIncome}`);
  console.log('✅ Test 4 Passed: Base salary is unchanged.');

  // Test 5: Recommendation improves or preserves retirement readiness compared with child-cost-only scenario.
  // We'll set a standard scenario where the child-cost-only scenario has a shortfall (retirementReadyAge > targetRetirementAge or null).
  const baselineChildInputs = JSON.parse(JSON.stringify(childInputs));
  baselineChildInputs.simpleIncome = 60000;
  baselineChildInputs.simpleExpenses = 48000; // savings of 12,000/yr without child, but child adds 15,000/yr cost
  baselineChildInputs.expectedReturn = 7;
  baselineChildInputs.swr = 4;
  
  // Baseline with child costs only
  const resultsWithChildCostsOnly = runFireSimulation(baselineChildInputs);
  const readyAgeChildOnly = resultsWithChildCostsOnly.retirementReadyAge;
  console.log(`- Child-only retirement ready age: ${readyAgeChildOnly}`);
  
  // Recommended scenario: child costs + matching income boosts
  const recommendedInputs = JSON.parse(JSON.stringify(baselineChildInputs));
  recommendedInputs.incomeList = [...(recommendedInputs.incomeList || []), ...rec.incomeBoosts];
  
  const resultsWithOffset = runFireSimulation(recommendedInputs);
  const readyAgeOffset = resultsWithOffset.retirementReadyAge;
  console.log(`- Child + Offset boost retirement ready age: ${readyAgeOffset}`);
  
  // Ready age with offset should be <= ready age child only
  if (readyAgeChildOnly !== null) {
    assert(readyAgeOffset !== null, 'Offset scenario should have resolved or defined ready age');
    assert(readyAgeOffset <= readyAgeChildOnly, `Offset ready age (${readyAgeOffset}) should be sooner/equal to child-only ready age (${readyAgeChildOnly})`);
  } else {
    // If child-only is null (runs out of money and never recovers), offset should either be resolved or also null but have a better ending net worth
    if (readyAgeOffset !== null) {
      // Improved from null to a real age!
      assert(true);
    } else {
      assert(resultsWithOffset.endingSurplusShortfall >= resultsWithChildCostsOnly.endingSurplusShortfall, 'Offset scenario ending net worth should be better or equal');
    }
  }
  console.log('✅ Test 5 Passed: Recommendation improves/preserves retirement readiness.');

  // Test 6: Child event moved to future age (e.g. 39) with parent current age 35
  const moveChildInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  moveChildInputs.currentAge = 35;
  moveChildInputs.targetRetirementAge = 60;
  moveChildInputs.lifeEvents = [
    {
      id: 'child-move-test',
      type: 'haveChild',
      enabled: true,
      name: 'Test Child',
      birthAge: 35, // starts at 35
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 15000,
      customAges5to12: 15000,
      customAges13to18: 15000,
      customAges19to22: 15000,
      includeCollege: false
    }
  ];

  // 1. Run simulation once with child at 35 to initialize budget details / simple-inc-childcare
  let results1 = runFireSimulation(moveChildInputs);
  let phases1 = getNormalizedPhases(moveChildInputs);

  // 2. Now move child event to 39
  moveChildInputs.lifeEvents[0].birthAge = 39;
  let results2 = runFireSimulation(moveChildInputs);
  let phases2 = getNormalizedPhases(moveChildInputs);

  // Assertions:
  // Pre-child phase 35-39:
  const preChildPhase = phases2.find(p => p.startAge === 35 && p.endAge === 39);
  assert(preChildPhase !== undefined, 'Should have a pre-child phase from 35 to 39');
  assert(preChildPhase.type === 'workSave', 'Pre-child phase should be type workSave');
  // Check that pre-child phase does NOT get child childcare income boost
  const baseSalaryMonthly = Math.round((Number(moveChildInputs.simpleIncome) || 50000) / 12);
  assert(preChildPhase.income === baseSalaryMonthly, `Pre-child phase income should be base salary monthly ${baseSalaryMonthly}, got ${preChildPhase.income}`);

  // Childcare phase 39-57:
  const childcarePhase = phases2.find(p => p.startAge === 39 && p.endAge === 57);
  assert(childcarePhase !== undefined, 'Should have a childcare phase from 39 to 57');
  assert(childcarePhase.type === 'childcare', 'Childcare phase should be type childcare');
  assert(childcarePhase.income === baseSalaryMonthly + 1250, `Childcare phase income should have the child boost, expected ${baseSalaryMonthly + 1250}, got ${childcarePhase.income}`);

  // Verify there are no duplicate childcare tabs/phases (e.g. split at 53)
  const childcarePhases = phases2.filter(p => p.type === 'childcare');
  assert(childcarePhases.length === 1, `Should only have exactly 1 childcare phase tab, got ${childcarePhases.length}`);

  console.log('✅ Test 6 Passed: Moving child event from 35 to 39 regenerates phases and removes childcare boost/duplicate tabs correctly.');

  // Test 7: Exclude child-income-boost from phase boundaries and lookups
  const testInputs7 = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  testInputs7.currentAge = 35;
  testInputs7.targetRetirementAge = 60;
  testInputs7.lifeEvents = [
    {
      id: 'child-test-7',
      type: 'haveChild',
      enabled: true,
      name: 'Test Child',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 15000,
      customAges5to12: 15000,
      customAges13to18: 15000,
      customAges19to22: 15000,
      includeCollege: false
    }
  ];

  // Get recommendations and inject the incomeBoosts
  const recs7 = getChildCostOffsetRecommendations(testInputs7);
  assert(recs7.length === 1, 'Should have 1 recommendation');
  
  testInputs7.incomeList = [...(testInputs7.incomeList || []), ...recs7[0].incomeBoosts];
  
  // Now run getNormalizedPhases
  const phases7 = getNormalizedPhases(testInputs7);
  
  // Verify that there are only two phases: childcare_35_53 and workSave_53_60
  // No splits at 40 or 48!
  const childcarePhases7 = phases7.filter(p => p.type === 'childcare');
  assert(childcarePhases7.length === 1, `Should have exactly 1 childcare phase, got ${childcarePhases7.length}`);
  
  const childcarePhase7 = childcarePhases7[0];
  assert(childcarePhase7.startAge === 35 && childcarePhase7.endAge === 53, `Childcare phase should span 35 to 53, got ${childcarePhase7.startAge} to ${childcarePhase7.endAge}`);
  
  // Check that raw income lookup inside childcare phase ignores the child-income-boost item (which is 15000/yr) 
  // and correctly uses standard base career salary (4167)
  const baseSalary7 = Math.round((Number(testInputs7.simpleIncome) || 50000) / 12);
  assert(childcarePhase7.income === baseSalary7 + 1250, `Childcare phase income should be base salary monthly ${baseSalary7} + child boost 1250, got ${childcarePhase7.income}`);

  console.log('✅ Test 7 Passed: Child income boosts are successfully excluded from budget tab splits and base income lookups.');

  console.log('--- ALL test_child_recommendations PASSED ---');
  process.exit(0);
} catch (err) {
  console.error('❌ test_child_recommendations failed with error:', err);
  process.exit(1);
}
