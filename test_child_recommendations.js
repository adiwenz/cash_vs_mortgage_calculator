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

  // Test 8: Verify that when the recommendation is applied, the simulated income is not double-counted (remains $65,000/yr, not $80,000/yr)
  const testInputs8 = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  testInputs8.currentAge = 35;
  testInputs8.targetRetirementAge = 60;
  testInputs8.lifeEvents = [
    {
      id: 'child-test-8',
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

  // We save the budget phases in budgetDetails.phases as it happens in the UI.
  // getNormalizedPhases will return the childcare phase with boosted income (5417 = 4167 + 1250).
  const normPhases8 = getNormalizedPhases(testInputs8);
  testInputs8.budgetDetails = {
    income: 4167,
    phases: normPhases8.map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      startAge: p.startAge,
      endAge: p.endAge,
      income: p.income, // has the boost (5417)
      savings: p.savings,
      expenses: p.expenses
    }))
  };

  // Get recommendation & apply the boosts
  const recs8 = getChildCostOffsetRecommendations(testInputs8);
  testInputs8.incomeList = [...(testInputs8.incomeList || []), ...recs8[0].incomeBoosts];

  const results8 = runFireSimulation(testInputs8);
  // Find simulated income at age 40 (inside childcare phase)
  const age40Data8 = results8.data.find(d => d.age === 40);
  assert(age40Data8 !== undefined, 'Should have simulated data at age 40');
  
  // Deflated income at age 40 should be $65,000/yr (base $50,000 + $15,000 boost), NOT $80,000/yr!
  // Note: results8.data is already deflated to today's dollars
  const deflatedIncome8 = age40Data8.income;
  assert(Math.round(deflatedIncome8) === 65004, `Expected deflated simulated income to be $65,004, got ${Math.round(deflatedIncome8)} (double-counting check)`);
  console.log('✅ Test 8 Passed: Simulated income is not double-counted (remains $65,000/yr).');

  // Test 9: Verify child-income-boost continues past targetRetirementAge if childcare years extend into retirement
  const testInputs9 = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  testInputs9.currentAge = 55;
  testInputs9.targetRetirementAge = 60; // Retires at 60
  testInputs9.lifeEvents = [
    {
      id: 'retire-event',
      type: 'retire',
      enabled: true,
      age: 60, // Retires at 60
      spendingPercent: 70
    },
    {
      id: 'child-test-9',
      type: 'haveChild',
      enabled: true,
      name: 'Late Child',
      birthAge: 50, // Born when parent was 50, active 50-68
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
  const recs9 = getChildCostOffsetRecommendations(testInputs9);
  testInputs9.incomeList = [...(testInputs9.incomeList || []), ...recs9[0].incomeBoosts];

  const results9 = runFireSimulation(testInputs9);
  // Find simulated income at age 62 (retired but child is 12 years old)
  const age62Data9 = results9.data.find(d => d.age === 62);
  assert(age62Data9 !== undefined, 'Should have simulated data at age 62');
  
  // Deflated income at age 62 should be exactly $15,000/yr (since they are retired, base salary is 0)
  const deflatedIncome9 = age62Data9.income;
  assert(Math.round(deflatedIncome9) === 15000, `Expected deflated simulated income in retirement to be $15,000, got ${Math.round(deflatedIncome9)}`);
  console.log('✅ Test 9 Passed: Child income boost continues past targetRetirementAge during retirement.');
  // Test 10: Verify retirement childcare phase splits and proportional expense scaling
  const testInputs10 = {
    currentAge: 35,
    lifeExpectancy: 85,
    simpleIncome: 120000,
    simpleExpenses: 60000, // Monthly expenses = $5,000
    preTaxSavingsRate: 0,
    lifeEvents: [
      {
        id: 'retire-event-10',
        type: 'retire',
        enabled: true,
        age: 60,
        spendingPercent: 80 // Scale expenses to 80%
      },
      {
        id: 'child-test-10',
        type: 'haveChild',
        enabled: true,
        name: 'Late Child 10',
        birthAge: 50, // Born when parent was 50, active 50-68
        childStartAge: 0,
        costMethod: 'custom',
        customAges0to4: 15000,
        customAges5to12: 15000,
        customAges13to18: 15000,
        customAges19to22: 15000,
        includeCollege: false
      }
    ]
  };

  const phases10 = getNormalizedPhases(testInputs10);
  assert(phases10.length === 4, `Expected 4 phases, got ${phases10.length}`);
  
  // Phase 0: workSave (35-50)
  assert(phases10[0].id === 'workSave_35_50', `Expected phase 0 ID to be workSave_35_50, got ${phases10[0].id}`);
  assert(phases10[0].type === 'workSave', 'Expected phase 0 type to be workSave');
  
  // Phase 1: childcare (50-60)
  assert(phases10[1].id === 'childcare_50_60', `Expected phase 1 ID to be childcare_50_60, got ${phases10[1].id}`);
  assert(phases10[1].type === 'childcare', 'Expected phase 1 type to be childcare');
  
  // Phase 2: retire_60_68 (retired with child)
  assert(phases10[2].id === 'retire_60_68', `Expected phase 2 ID to be retire_60_68, got ${phases10[2].id}`);
  assert(phases10[2].type === 'retire', 'Expected phase 2 type to be retire');
  assert(phases10[2].name === '1 Child (Retired)', `Expected phase 2 name to be "1 Child (Retired)", got "${phases10[2].name}"`);
  assert(phases10[2].childCount === 1, 'Expected child count to be 1');
  
  // Phase 3: retire_68_85 (retired childless)
  assert(phases10[3].id === 'retire_68_85', `Expected phase 3 ID to be retire_68_85, got ${phases10[3].id}`);
  assert(phases10[3].type === 'retire', 'Expected phase 3 type to be retire');
  assert(phases10[3].name === 'Retirement', `Expected phase 3 name to be "Retirement", got "${phases10[3].name}"`);
  assert(phases10[3].childCount === 0, 'Expected child count to be 0');

  // Verify expense scaling (80%)
  const p0Expenses = phases10[0].expenses;
  const p1Expenses = phases10[1].expenses;
  const p2Expenses = phases10[2].expenses;
  const p3Expenses = phases10[3].expenses;

  // Each category in phase 2 should be exactly 80% of phase 1
  Object.keys(p1Expenses).forEach(key => {
    const expected = Math.round(p1Expenses[key] * 0.80);
    assert(p2Expenses[key] === expected, `Expected phase 2 expense for ${key} to be ${expected}, got ${p2Expenses[key]}`);
  });

  // Each category in phase 3 should be exactly 80% of phase 0
  Object.keys(p0Expenses).forEach(key => {
    const expected = Math.round(p0Expenses[key] * 0.80);
    assert(p3Expenses[key] === expected, `Expected phase 3 expense for ${key} to be ${expected}, got ${p3Expenses[key]}`);
  });

  console.log('✅ Test 10 Passed: Retirement childcare phase splits and expense scaling are completely correct.');

  console.log('--- ALL test_child_recommendations PASSED ---');
  process.exit(0);
} catch (err) {
  console.error('❌ test_child_recommendations failed with error:', err);
  process.exit(1);
}
