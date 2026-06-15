import { getChildCostOffsetRecommendations } from './src/recommendations.js';
import { runFireSimulation } from './src/fireCalculations.js';
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

  console.log('--- ALL test_child_recommendations PASSED ---');
  process.exit(0);
} catch (err) {
  console.error('❌ test_child_recommendations failed with error:', err);
  process.exit(1);
}
