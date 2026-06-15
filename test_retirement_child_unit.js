import { runFireSimulation, getNormalizedPhases } from './src/fireCalculations.js';
import { getChildCostOffsetRecommendations } from './src/recommendations.js';
import { expect, getMappedDefaultInputs } from './test_helper.js';

console.log('--- Running test_retirement_child_unit ---');

// Helper assert function
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

try {
  // ----------------------------------------------------
  // Test 1: CHILD during retirement - Add child, NW graph is same
  // ----------------------------------------------------
  console.log('\nRunning Test 1: Add child with offset boost, NW graph is same as baseline...');
  
  const baselineInputs = getMappedDefaultInputs();
  baselineInputs.currentAge = 35;
  baselineInputs.targetRetirementAge = 60;
  baselineInputs.lifeExpectancy = 85;
  baselineInputs.simpleIncome = 60000;
  baselineInputs.simpleExpenses = 36000;
  baselineInputs.simpleInvestments = 100000;
  baselineInputs.inflationRate = 3.0;     // 3% inflation
  baselineInputs.expectedReturn = 0.0;    // 0% returns
  baselineInputs.postRetirementReturn = 0.0;
  baselineInputs.includeTaxes = false;    // No taxes
  baselineInputs.enableHealthcareModel = false; // No healthcare bridge premiums

  baselineInputs.incomeList = [
    {
      id: 'inc-1',
      name: 'Salary / Main Income',
      amount: 60000,
      frequency: 'yearly',
      startAge: 35,
      endAge: 60,
      growthRate: 0.03,
      isTaxable: true
    }
  ];

  baselineInputs.spendingPhases = [
    {
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: 35,
      endAge: 85,
      amount: 36000,
      frequency: 'yearly',
      annualSpending: 36000,
      notes: 'Initial standard living expenses'
    }
  ];

  baselineInputs.budgetDetails = {
    income: 5000,
    expenses: {
      housing: 1200,
      utilities: 300,
      food: 600,
      transportation: 300,
      healthcare: 200,
      leisure: 200,
      misc: 200
    },
    savings: {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 2000, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
    }
  };

  baselineInputs.allocationRules = [];
  
  baselineInputs.lifeEvents = [
    {
      id: 'retire-event',
      type: 'retire',
      enabled: true,
      age: 60,
      spendingPercent: 80
    }
  ];

  // Baseline results (no child)
  const baselineResults = runFireSimulation(baselineInputs);

  // Scenario with child born at 50, active 50 to 68 (extends into retirement at 60)
  const childInputs = JSON.parse(JSON.stringify(baselineInputs));
  childInputs.lifeEvents.push({
    id: 'child-event',
    type: 'haveChild',
    enabled: true,
    name: 'Late Child',
    birthAge: 50,
    childStartAge: 0,
    costMethod: 'custom',
    customAges0to4: 15000,
    customAges5to12: 15000,
    customAges13to18: 15000,
    customAges19to22: 15000,
    includeCollege: false
  });

  // Get recommendations and inject the matching child income boosts
  const recs = getChildCostOffsetRecommendations(childInputs);
  assert(recs.length === 1, 'Should have exactly 1 child recommendation');
  console.log('DIAGNOSTIC - incomeBoosts:', recs[0].incomeBoosts);
  childInputs.incomeList = [...(childInputs.incomeList || []), ...recs[0].incomeBoosts];

  // Run simulation with child costs + matching income boosts
  const offsetResults = runFireSimulation(childInputs);

  // Assert that net worth is exactly the same as baseline (within rounding error of 1.0)
  // in all years, including retirement years 60 to 68 where child costs and boost are active.
  for (let age = 35; age <= 85; age++) {
    const baseRow = baselineResults.nominalData.find(d => d.age === age);
    const offsetRow = offsetResults.nominalData.find(d => d.age === age);
    assert(baseRow !== undefined, `Baseline data missing at age ${age}`);
    assert(offsetRow !== undefined, `Offset data missing at age ${age}`);
    
    if (age === 35 || age === 36) {
      console.log(`DIAGNOSTIC - Age ${age}:`);
      console.log('  BaseRow:', { income: baseRow.income, expenses: baseRow.expenses, netWorth: baseRow.netWorth, portfolio: baseRow.portfolio });
      console.log('  OffsetRow:', { income: offsetRow.income, expenses: offsetRow.expenses, netWorth: offsetRow.netWorth, portfolio: offsetRow.portfolio });
    }

    const diff = Math.abs(offsetRow.netWorth - baseRow.netWorth);
    assert(diff < 1.0, `Expected net worth difference at age ${age} to be < 1.0, got ${diff} (Base: ${baseRow.netWorth}, Offset: ${offsetRow.netWorth})`);
  }
  console.log('✅ Test 1 Passed: Net worth trajectory matches baseline perfectly.');

  // ----------------------------------------------------
  // Test 2: Move child between work and retirement -> 4 budget tabs
  // ----------------------------------------------------
  console.log('\nRunning Test 2: Move child between work and retirement, verify 4 tabs and childcare boost...');
  
  const phases = getNormalizedPhases(childInputs);
  assert(phases.length === 4, `Expected 4 budget phases, got ${phases.length}`);
  
  // Tab 1: Work (35-50)
  assert(phases[0].id === 'workSave_35_50', `Expected phase 0 to be workSave_35_50, got ${phases[0].id}`);
  assert(phases[0].type === 'workSave', 'Expected phase 0 to be workSave type');
  
  // Tab 2: Child (50-60)
  assert(phases[1].id === 'childcare_50_60', `Expected phase 1 to be childcare_50_60, got ${phases[1].id}`);
  assert(phases[1].type === 'childcare', 'Expected phase 1 to be childcare type');
  
  // Tab 3: Child + Retire (60-68)
  assert(phases[2].id === 'retire_60_68', `Expected phase 2 to be retire_60_68, got ${phases[2].id}`);
  assert(phases[2].type === 'retire', 'Expected phase 2 to be retire type');
  assert(phases[2].name === '1 Child (Retired)', `Expected phase 2 name to be "1 Child (Retired)", got "${phases[2].name}"`);
  assert(phases[2].childCount === 1, 'Expected child count to be 1');
  
  // Tab 4: Retire (68-85)
  assert(phases[3].id === 'retire_68_85', `Expected phase 3 to be retire_68_85, got ${phases[3].id}`);
  assert(phases[3].type === 'retire', 'Expected phase 3 to be retire type');
  assert(phases[3].name === 'Retirement', `Expected phase 3 name to be "Retirement", got "${phases[3].name}"`);
  assert(phases[3].childCount === 0, 'Expected child count to be 0');

  // Verify that the child income boost is active during retirement in the simulation (ages 60 to 68)
  for (let age = 60; age < 68; age++) {
    const row = offsetResults.nominalData.find(d => d.age === age);
    // Salary is 0 (retired), but income should equal the childCosts boost
    const expectedIncome = row.childCosts;
    assert(expectedIncome > 0, `Expected child costs at age ${age} to be > 0`);
    const diff = Math.abs(row.income - expectedIncome);
    assert(diff < 1.0, `Expected income at age ${age} to be ${expectedIncome}, got ${row.income}`);
  }
  console.log('✅ Test 2 Passed: 4 tabs generated correctly and child income boost continues in retirement.');

  // ----------------------------------------------------
  // Test 3: Retirement budget scaling (80%) and balance check
  // ----------------------------------------------------
  console.log('\nRunning Test 3: Verify retirement budget automatically reduced to 80% and is not balanced...');

  const workExpensesSum = Object.values(phases[0].expenses).reduce((a, b) => a + b, 0);
  const retireExpensesSum = Object.values(phases[3].expenses).reduce((a, b) => a + b, 0);

  // Verify it is not all 0s
  assert(retireExpensesSum > 0, `Expected retirement expenses to be > 0, got ${retireExpensesSum}`);
  Object.keys(phases[3].expenses).forEach(key => {
    assert(phases[3].expenses[key] > 0, `Expected expense category ${key} to be > 0, got ${phases[3].expenses[key]}`);
  });

  // Verify it is automatically scaled to 80% of work expenses (allowing for rounding difference of up to 5)
  const expectedScaledExpenses = Math.round(workExpensesSum * 0.80);
  const scaleDiff = Math.abs(retireExpensesSum - expectedScaledExpenses);
  assert(scaleDiff <= 5, `Expected retirement expenses to be close to ${expectedScaledExpenses}, got ${retireExpensesSum}`);

  // Verify the budget is not balanced:
  // Income in retirement is 0, Savings are 0, Expenses are > 0.
  // Net cash flow = Income - Savings - Expenses = -Expenses !== 0 (Deficit).
  const retireIncome = phases[3].income;
  const retireSavingsSum = Object.values(phases[3].savings).reduce((a, b) => a + b, 0);
  const netCashFlow = retireIncome - retireSavingsSum - retireExpensesSum;

  assert(retireIncome === 0, `Expected retirement income to be 0, got ${retireIncome}`);
  assert(retireSavingsSum === 0, `Expected retirement savings to be 0, got ${retireSavingsSum}`);
  assert(netCashFlow !== 0, `Expected net cash flow to not be balanced (0), got ${netCashFlow}`);
  assert(netCashFlow < 0, `Expected net cash flow to be negative (deficit), got ${netCashFlow}`);

  console.log('✅ Test 3 Passed: Retirement budget scaled to 80%, not all 0s, and is not balanced.');

  // ----------------------------------------------------
  // Test 4: Base Salary & Active Child Boost calculation in Retirement Childcare Phase
  // ----------------------------------------------------
  console.log('\nRunning Test 4: Verify baseSalaryMonthly is 0 and child boost is shown in retired childcare phase...');

  const retiredChildPhase = phases[2]; // retire_60_68
  assert(retiredChildPhase.type === 'retire', 'Expected type of retirement childcare phase to be retire');
  assert(retiredChildPhase.childCount > 0, 'Expected childCount to be > 0');

  // Simulate FireSimulator.jsx baseSalaryMonthly and activeChildBoost logic:
  const isRetirementPhase = retiredChildPhase.type === 'retire';
  
  const rawIncomeItem = (childInputs.incomeList || []).find(inc => 
    retiredChildPhase.startAge >= inc.startAge && 
    retiredChildPhase.startAge < inc.endAge && 
    inc.id !== 'simple-inc-childcare' && 
    !inc.id.startsWith('simple-inc-childcare-') && 
    inc.id !== 'simple-inc-worksave' && 
    !inc.id.startsWith('simple-inc-worksave-') &&
    inc.id !== 'simple-inc-prechild' &&
    !inc.id.startsWith('simple-inc-prechild-') &&
    !inc.id.startsWith('child-income-boost')
  );

  let baseSalaryMonthly = 0;
  if (isRetirementPhase) {
    baseSalaryMonthly = retiredChildPhase.ssMonthlyIncome || 0;
  } else if (rawIncomeItem) {
    baseSalaryMonthly = Math.round(rawIncomeItem.frequency === 'monthly' ? Number(rawIncomeItem.amount) : Number(rawIncomeItem.amount) / 12);
  } else {
    baseSalaryMonthly = Math.round((Number(childInputs.simpleIncome) || 50000) / 12);
  }

  // Expect baseSalaryMonthly to be 0 since it is a retirement phase
  assert(baseSalaryMonthly === 0, `Expected baseSalaryMonthly to be 0 for retired phase, got ${baseSalaryMonthly}`);

  const budgetMonthlyIncome = retiredChildPhase.income; // 1250
  const activeChildBoost = Math.max(0, budgetMonthlyIncome - baseSalaryMonthly);

  // Expect activeChildBoost to be 1250 (i.e. the full child boost is visible)
  assert(activeChildBoost === 1250, `Expected activeChildBoost to be 1250, got ${activeChildBoost}`);

  console.log('✅ Test 4 Passed: baseSalaryMonthly is 0 and activeChildBoost is 1250 (fully visible).');

  // ----------------------------------------------------
  // Test 5: Retired, has child, receiving Social Security
  // ----------------------------------------------------
  console.log('\nRunning Test 5: Verify total income shows SS + 1250 boost, but activeChildBoost shows only +1250...');

  const ssChildInputs = JSON.parse(JSON.stringify(baselineInputs));
  
  // Enable Social Security
  const ssEv = ssChildInputs.lifeEvents.find(e => e.type === 'socialSecurity');
  if (ssEv) {
    ssEv.enabled = true;
    ssEv.claimingAge = 62;
    ssEv.useEarnings = false;
    ssEv.monthlyBenefit = 2000;
  } else {
    ssChildInputs.lifeEvents.push({
      id: 'ss-event',
      type: 'socialSecurity',
      enabled: true,
      claimingAge: 62,
      useEarnings: false,
      monthlyBenefit: 2000
    });
  }

  // Add child event
  ssChildInputs.lifeEvents.push({
    id: 'child-event-5',
    type: 'haveChild',
    enabled: true,
    name: 'Late Child 5',
    birthAge: 50,
    childStartAge: 0,
    costMethod: 'custom',
    customAges0to4: 15000,
    customAges5to12: 15000,
    customAges13to18: 15000,
    customAges19to22: 15000,
    includeCollege: false
  });

  // Get recommendations and inject matching child income boosts (1250/mo)
  const ssChildRecs = getChildCostOffsetRecommendations(ssChildInputs);
  ssChildInputs.incomeList = [...(ssChildInputs.incomeList || []), ...ssChildRecs[0].incomeBoosts];

  const ssChildPhases = getNormalizedPhases(ssChildInputs);
  
  // Phase 2 should be retire_60_68 (retired with child, age 60 to 68)
  // Social Security claims at 62, which creates a boundary!
  // So we will have a phase starting at 62: retire_62_68 (retired, receiving SS, has child)
  const ssChildPhase = ssChildPhases.find(p => p.startAge === 62 && p.type === 'retire');
  assert(ssChildPhase !== undefined, 'Should have a retirement phase starting at 62 when receiving SS and child is active');
  assert(ssChildPhase.childCount > 0, 'Expected child count to be > 0 in this phase');
  assert(ssChildPhase.ssMonthlyIncome > 0, `Expected ssMonthlyIncome to be > 0, got ${ssChildPhase.ssMonthlyIncome}`);

  // Social Security benefit at claim age 62 is 2000 * factor
  // factor for 62 is 0.70 (since full retirement age is 67, 5 years early is 30% reduction, so 70% of 2000 = 1400)
  // Let's verify what ssMonthlyIncome is computed as:
  const expectedSSMonthly = ssChildPhase.ssMonthlyIncome;
  console.log(`  SS monthly benefit calculated: ${expectedSSMonthly}`);

  // Total income should be SS monthly + 1250 child boost
  const expectedTotalIncome = expectedSSMonthly + 1250;
  assert(ssChildPhase.income === expectedTotalIncome, `Expected total phase income to be ${expectedTotalIncome}, got ${ssChildPhase.income}`);

  // Simulate FireSimulator.jsx activeChildBoost logic
  const simIsRetirement = ssChildPhase.type === 'retire';
  let simBaseSalary = 0;
  if (simIsRetirement) {
    simBaseSalary = ssChildPhase.ssMonthlyIncome || 0;
  }
  
  const simActiveChildBoost = Math.max(0, ssChildPhase.income - simBaseSalary);
  assert(simActiveChildBoost === 1250, `Expected active child boost badge to show 1250, got ${simActiveChildBoost}`);

  console.log('✅ Test 5 Passed: total income is SS + 1250, child boost badge correctly shows only +1250.');

  console.log('\n🎉 ALL test_retirement_child_unit PASSED SUCCESSFULLY!');
  process.exit(0);
} catch (error) {
  console.error('❌ test_retirement_child_unit failed:', error);
  process.exit(1);
}
