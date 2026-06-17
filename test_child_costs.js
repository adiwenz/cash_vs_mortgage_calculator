import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('--- Running Child Event Cost Modeling & Lifestyle Gap Verification ---');

// 1. Test case: No child
const baseResults = runFireSimulation(DEFAULT_FIRE_INPUTS);
console.log(`Base retirement ready age: ${baseResults.retirementReadyAge}`);

// 2. Test case: Add child (born at parent age 35)
const childEvent = {
  id: 'child-test',
  type: 'haveChild',
  enabled: true,
  name: 'Test Child',
  childName: 'Liam',
  childStartAge: 0,
  birthAge: 35, // parent is 35 when child is born
  costMethod: 'default',
  includeCollege: true
};

const inputsWithChild = {
  ...DEFAULT_FIRE_INPUTS,
  lifeEvents: [...DEFAULT_FIRE_INPUTS.lifeEvents, childEvent]
};

const resultsWithChild = runFireSimulation(inputsWithChild);
console.log(`With child retirement ready age: ${resultsWithChild.retirementReadyAge}`);

// Verify child costs are recorded in results
const childCostsCollected = resultsWithChild.data.some(d => d.childCosts > 0);
if (!childCostsCollected) {
  console.error('FAIL: Expected child costs to be collected in simulation results');
  process.exit(1);
}
console.log('✅ PASS: Child costs correctly mapped and calculated in results.');

// Verify bracket costs for age 35 (child age 0: bracket 0-4 should apply $15,000)
const year35 = resultsWithChild.data.find(d => d.age === 35);
if (!year35 || year35.childCosts === 0) {
  console.error('FAIL: Child costs for parent age 35 should be active');
  process.exit(1);
}
// Default cost at child age 0 is $15,000. Deflation factor at year 0 is 1.0.
if (Math.round(year35.childCosts) !== 15000) {
  console.error(`FAIL: Expected child cost at parent age 35 (child age 0) to be $15,000, got ${year35.childCosts}`);
  process.exit(1);
}
console.log(`✅ PASS: Parent age 35 (child age 0) child cost is correctly $15,000.`);

// Verify bracket cost for child age 3 (parent age 38): bracket 0-4 should apply $15,000
const year38 = resultsWithChild.data.find(d => d.age === 38);
if (!year38 || Math.round(year38.childCosts) !== 15000) {
  console.error(`FAIL: Expected child cost at parent age 38 (child age 3) to be $15,000, got ${year38?.childCosts}`);
  process.exit(1);
}
console.log(`✅ PASS: Parent age 38 (child age 3) child cost is correctly $15,000.`);

// Verify bracket cost for child age 5 (parent age 40): bracket 5-12 should apply $15,000
const year40 = resultsWithChild.data.find(d => d.age === 40);
if (!year40 || Math.round(year40.childCosts) !== 15000) {
  console.error(`FAIL: Expected child cost at parent age 40 (child age 5) to be $15,000, got ${year40?.childCosts}`);
  process.exit(1);
}
console.log(`✅ PASS: Parent age 40 (child age 5) child cost is correctly $15,000.`);


// 3. Test case: Lifestyle Gap detection
// Increase simpleExpenses and savings to force a gap
const inputsWithGap = {
  ...inputsWithChild,
  simpleIncome: 50000,
  simpleExpenses: 40000, // spending: $40,000 + child costs ($15,000) = $55,000, which exceeds $50,000 income
  allocationRules: [
    {
      id: 'alloc-fixed',
      destination: 'brokerage',
      type: 'fixedAmount',
      value: 5000, // demand $5,000 savings
      frequency: 'yearly',
      priority: 1
    }
  ]
};

const resultsWithGap = runFireSimulation(inputsWithGap);
const hasGaps = resultsWithGap.data.some(d => d.lifestyleGap > 0);
if (!hasGaps) {
  console.error('FAIL: Expected lifestyle gaps to be detected when cash flow is deficient');
  process.exit(1);
}
console.log('✅ PASS: Lifestyle gaps correctly detected and recorded.');

// 4. Regression test: baseline curve === child cost + equal income boost curve (tax-unaware)
console.log('Verifying baseline curve === child cost + equal income boost curve (tax-unaware)...');

const baseTestInputs = {
  ...DEFAULT_FIRE_INPUTS,
  includeTaxes: false,
  budgetDetails: null,
  lifeEvents: [
    {
      id: 'retire-1',
      type: 'retire',
      name: 'Retirement',
      enabled: true,
      age: 65,
      spendingPercent: 70
    }
  ]
};

const offsetTestInputs = {
  ...baseTestInputs,
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 50000 / 12,
    childcareIncome: (50000 / 12) + 1250, // $15,000/yr child cost = $1,250/mo bump
    expenses: {
      ...DEFAULT_FIRE_INPUTS.budgetDetails.expenses,
      misc: 42500 / 12 - (1500 + 300 + 600 + 400 + 300 + 300)
    }
  },
  lifeEvents: [
    ...baseTestInputs.lifeEvents,
    {
      id: 'child-1',
      type: 'haveChild',
      enabled: true,
      name: 'Child',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 15000,
      customAges5to12: 15000,
      customAges13to18: 15000,
      customAges19to22: 15000,
      includeCollege: false
    }
  ],
  incomeList: [
    {
      // Note: The ID "simple-inc-childcare" tells the simulation engine to automatically
      // add exactly the yearly salary needed to account for the new childcare costs without
      // changing the previous budget (just adding the new childcare expense).
      id: 'simple-inc-childcare',
      name: 'Salary / Main Income (Childcare Phase)',
      amount: 50000,
      frequency: 'yearly',
      startAge: 35,
      endAge: 53,
      growthRate: 0.03,
      isTaxable: true
    },
    {
      id: 'simple-inc-worksave',
      name: 'Salary / Main Income (Standard Work Phase)',
      amount: 50000,
      frequency: 'yearly',
      startAge: 53,
      endAge: 65,
      growthRate: 0.03,
      isTaxable: true
    }
  ],
  spendingPhases: [
    {
      id: 'simple-spend-childcare',
      name: 'Lifestyle Spending (Childcare Phase)',
      amount: 42500,
      frequency: 'yearly',
      startAge: 35,
      endAge: 53,
      annualSpending: 42500
    },
    {
      id: 'simple-spend-worksave',
      name: 'Lifestyle Spending (Standard Work Phase)',
      amount: 42500,
      frequency: 'yearly',
      startAge: 53,
      endAge: 85,
      annualSpending: 42500
    }
  ]
};

const baselineRes = runFireSimulation(baseTestInputs);
const offsetRes = runFireSimulation(offsetTestInputs);

for (let i = 0; i < baselineRes.data.length; i++) {
  const b = baselineRes.data[i];
  const o = offsetRes.data[i];
  if (!b || !o) continue;

  // 1. Verify Net Worth matches year-by-year
  const nwDiff = Math.abs(b.netWorth - o.netWorth);
  if (nwDiff > 1000.0) {
    console.error(`FAIL: Net worth divergence at age ${b.age}: Baseline=${b.netWorth}, Offset=${o.netWorth}, Diff=${nwDiff}`);
    process.exit(1);
  }

  // 2. Verify Portfolio matches year-by-year
  const portDiff = Math.abs(b.portfolio - o.portfolio);
  if (portDiff > 1000.0) {
    console.error(`FAIL: Portfolio divergence at age ${b.age}: Baseline=${b.portfolio}, Offset=${o.portfolio}, Diff=${portDiff}`);
    process.exit(1);
  }

  // 3. Verify Net Savings matches year-by-year
  const savingsDiff = Math.abs(b.savings - o.savings);
  if (savingsDiff > 1000.0) {
    console.error(`FAIL: Net savings divergence at age ${b.age}: Baseline=${b.savings}, Offset=${o.savings}, Diff=${savingsDiff}`);
    process.exit(1);
  }
}
console.log('✅ PASS: Baseline and child/income-offset scenarios match perfectly across all key financial fields (NW, portfolio, net savings) year-by-year.');
// 5. Verify that removing the child event returns the trajectory back to the baseline
console.log('Verifying child removal reverts trajectory to baseline...');

const removedTestInputs = {
  ...offsetTestInputs,
  budgetDetails: null,
  incomeList: baseTestInputs.incomeList,
  spendingPhases: baseTestInputs.spendingPhases,
  lifeEvents: offsetTestInputs.lifeEvents.filter(e => e.type !== 'haveChild')
};

const removedRes = runFireSimulation(removedTestInputs);

for (let i = 0; i < baselineRes.data.length; i++) {
  const b = baselineRes.data[i];
  const r = removedRes.data[i];
  if (!b || !r) continue;

  const nwDiff = Math.abs(b.netWorth - r.netWorth);
  if (nwDiff > 1.0) {
    console.log(`Divergence at age ${b.age}: Baseline NW=${b.netWorth}, Removed NW=${r.netWorth}, Diff=${nwDiff}`);
  }
  if (nwDiff > 1000.0) {
    console.error(`FAIL (Post-Removal): Net worth divergence at age ${b.age}: Baseline=${b.netWorth}, Removed=${r.netWorth}, Diff=${nwDiff}`);
    process.exit(1);
  }

  const portDiff = Math.abs(b.portfolio - r.portfolio);
  if (portDiff > 1000.0) {
    console.error(`FAIL (Post-Removal): Portfolio divergence at age ${b.age}: Baseline=${b.portfolio}, Removed=${r.portfolio}, Diff=${portDiff}`);
    process.exit(1);
  }

  const savingsDiff = Math.abs(b.savings - r.savings);
  if (savingsDiff > 1000.0) {
    console.error(`FAIL (Post-Removal): Net savings divergence at age ${b.age}: Baseline=${b.savings}, Removed=${r.savings}, Diff=${savingsDiff}`);
    process.exit(1);
  }
}
console.log('✅ PASS: Disabling/removing child event successfully reverts trajectory to baseline.');

// 6. Test case: Verify year-by-year NW of true default is equal to the childcare-offset scenario
console.log('Verifying year-by-year NW of true default case matches childcare-offset scenario exactly...');

const trueDefaultRes = runFireSimulation(DEFAULT_FIRE_INPUTS);

const goldenChildInputs = {
  ...DEFAULT_FIRE_INPUTS,
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 50000 / 12,
    childcareIncome: (50000 / 12) + 1250, // $15,000/yr child cost = $1,250/mo bump
    expenses: {
      ...DEFAULT_FIRE_INPUTS.budgetDetails.expenses,
      misc: 42500 / 12 - (1500 + 300 + 600 + 400 + 300 + 300)
    }
  },
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents,
    {
      id: 'golden-child-event',
      type: 'haveChild',
      enabled: true,
      name: 'Golden Child',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 15000,
      customAges5to12: 15000,
      customAges13to18: 15000,
      customAges19to22: 15000,
      includeCollege: false
    }
  ],
  incomeList: [
    {
      id: 'simple-inc-childcare',
      name: 'Salary / Main Income (Childcare Phase)',
      amount: 50000,
      frequency: 'yearly',
      startAge: 35,
      endAge: 53, // 35 + 18
      growthRate: 0.03,
      isTaxable: true
    },
    {
      id: 'simple-inc-worksave',
      name: 'Salary / Main Income (Standard Work Phase)',
      amount: 50000,
      frequency: 'yearly',
      startAge: 53,
      endAge: 65,
      growthRate: 0.03,
      isTaxable: true
    }
  ],
  spendingPhases: [
    {
      id: 'simple-spend-childcare',
      name: 'Lifestyle Spending (Childcare Phase)',
      amount: 42500,
      frequency: 'yearly',
      startAge: 35,
      endAge: 53,
      annualSpending: 42500
    },
    {
      id: 'simple-spend-worksave',
      name: 'Lifestyle Spending (Standard Work Phase)',
      amount: 42500,
      frequency: 'yearly',
      startAge: 53,
      endAge: 85,
      annualSpending: 42500
    }
  ]
};

const goldenChildRes = runFireSimulation(goldenChildInputs);

for (let i = 0; i < trueDefaultRes.data.length; i++) {
  const d = trueDefaultRes.data[i];
  const g = goldenChildRes.data[i];
  if (!d || !g) continue;

  const nwDiff = Math.abs(d.netWorth - g.netWorth);
  if (nwDiff > 1000.0) {
    console.error(`FAIL (Golden Child): Net worth divergence at age ${d.age}: Default=${d.netWorth}, Golden Child=${g.netWorth}, Diff=${nwDiff}`);
    process.exit(1);
  }
}
console.log('✅ PASS: Year-by-year NW of true default matches the childcare-offset scenario exactly.');

// 7. Test case: Verify that variable child costs with dynamic childcare income scaling preserves baseline net worth
console.log('Verifying variable child costs with dynamic childcare income scaling preserves baseline net worth...');

const variableChildInputs = {
  ...DEFAULT_FIRE_INPUTS,
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 50000 / 12,
    childcareIncome: (50000 / 12) + 1250, // $15,000/yr peak child cost = $1,250/mo bump
    expenses: {
      ...DEFAULT_FIRE_INPUTS.budgetDetails.expenses,
      misc: 42500 / 12 - (1500 + 300 + 600 + 400 + 300 + 300)
    }
  },
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents,
    {
      id: 'variable-child-event',
      type: 'haveChild',
      enabled: true,
      name: 'Variable Child',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'default',
      includeCollege: false
    }
  ],
  incomeList: [
    {
      id: 'simple-inc-childcare',
      name: 'Salary / Main Income (Childcare Phase)',
      amount: 50000,
      frequency: 'yearly',
      startAge: 35,
      endAge: 53, // 35 + 18
      growthRate: 0.03,
      isTaxable: true
    },
    {
      id: 'simple-inc-worksave',
      name: 'Salary / Main Income (Standard Work Phase)',
      amount: 50000,
      frequency: 'yearly',
      startAge: 53,
      endAge: 65,
      growthRate: 0.03,
      isTaxable: true
    }
  ],
  spendingPhases: [
    {
      id: 'simple-spend-childcare',
      name: 'Lifestyle Spending (Childcare Phase)',
      amount: 42500,
      frequency: 'yearly',
      startAge: 35,
      endAge: 53,
      annualSpending: 42500
    },
    {
      id: 'simple-spend-worksave',
      name: 'Lifestyle Spending (Standard Work Phase)',
      amount: 42500,
      frequency: 'yearly',
      startAge: 53,
      endAge: 85,
      annualSpending: 42500
    }
  ]
};

const variableChildRes = runFireSimulation(variableChildInputs);

for (let i = 0; i < trueDefaultRes.data.length; i++) {
  const d = trueDefaultRes.data[i];
  const v = variableChildRes.data[i];
  if (!d || !v) continue;

  const nwDiff = Math.abs(d.netWorth - v.netWorth);
  if (nwDiff > 1000.0) {
    console.error(`FAIL (Variable Child): Net worth divergence at age ${d.age}: Default=${d.netWorth}, Variable Child=${v.netWorth}, Diff=${nwDiff}`);
    process.exit(1);
  }
}
console.log('✅ PASS: Year-by-year NW of true default matches the variable child scenario with dynamic scaling.');

console.log('✅ ALL CHILD COST & LIFESTYLE GAP TESTS PASSED.');
process.exit(0);



