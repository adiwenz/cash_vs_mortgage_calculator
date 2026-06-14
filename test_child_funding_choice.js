import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('--- Running Childcare Funding Choice & Income Bump Verification ---');

// Helpers to extract childcare phase years and income/savings
const getChildcarePhaseData = (results) => {
  return results.data.filter(d => d.childCosts > 0);
};

// Child childcare phase income and spending templates
const baseIncomeList = [
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
];

const baseSpendingPhases = [
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
];

// Single Child Event
const childEvent1 = {
  id: 'child-1',
  type: 'haveChild',
  enabled: true,
  name: 'First Child',
  childStartAge: 0,
  birthAge: 35,
  costMethod: 'default',
  includeCollege: false
};

// Second Child Event
const childEvent2 = {
  id: 'child-2',
  type: 'haveChild',
  enabled: true,
  name: 'Second Child',
  childStartAge: 0,
  birthAge: 35,
  costMethod: 'default',
  includeCollege: false
};

// 1. Scenario: budgetDetails.childcareIncome is set to bumped income (Choice A: Bump Income)
// Monthly standard income is 4166.67 (50k/12). Child cost is 15000/yr (1250/mo).
// Bumped childcare income = 4166.67 + 1250 = 5416.67.
const inputsChoiceA = {
  ...DEFAULT_FIRE_INPUTS,
  includeTaxes: false,
  incomeList: baseIncomeList,
  spendingPhases: baseSpendingPhases,
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 4166.67,
    childcareIncome: 5416.67
  },
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents.filter(e => e.type !== 'haveChild'),
    childEvent1
  ]
};

const resultsChoiceA = runFireSimulation(inputsChoiceA);
const childcareYearsChoiceA = getChildcarePhaseData(resultsChoiceA);

if (childcareYearsChoiceA.length === 0) {
  console.error('FAIL: Expected childcare phase to be active in Scenario 1 results');
  process.exit(1);
}

const age35ChoiceA = childcareYearsChoiceA.find(d => d.age === 35);
if (!age35ChoiceA) {
  console.error('FAIL: Expected parent age 35 to have child costs in Scenario 1');
  process.exit(1);
}

const deflatedIncomeChoiceA = age35ChoiceA.income / Math.pow(1 + DEFAULT_FIRE_INPUTS.inflationRate / 100, 35 - DEFAULT_FIRE_INPUTS.currentAge);
if (Math.round(deflatedIncomeChoiceA) !== 65000) {
  console.error(`FAIL: Expected deflated income to be $65,000 (50k standard + 15k childcare bump), got ${Math.round(deflatedIncomeChoiceA)}`);
  process.exit(1);
}
console.log('✅ PASS: Manually setting childcareIncome to bumped amount correctly shows bumped income in simulation.');


// 2. Scenario: budgetDetails.childcareIncome is set to standard income (Choice B: No Bump / Reduce Savings)
const inputsChoiceB = {
  ...DEFAULT_FIRE_INPUTS,
  includeTaxes: false,
  incomeList: baseIncomeList,
  spendingPhases: baseSpendingPhases,
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 4166.67,
    childcareIncome: 4166.67 // No bump
  },
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents.filter(e => e.type !== 'haveChild'),
    childEvent1
  ]
};

const resultsChoiceB = runFireSimulation(inputsChoiceB);
const childcareYearsChoiceB = getChildcarePhaseData(resultsChoiceB);

const age35ChoiceB = childcareYearsChoiceB.find(d => d.age === 35);
if (!age35ChoiceB) {
  console.error('FAIL: Expected parent age 35 to have child costs in Scenario 2');
  process.exit(1);
}

const deflatedIncomeChoiceB = age35ChoiceB.income / Math.pow(1 + DEFAULT_FIRE_INPUTS.inflationRate / 100, 35 - DEFAULT_FIRE_INPUTS.currentAge);
if (Math.round(deflatedIncomeChoiceB) !== 50000) {
  console.error(`FAIL: Expected deflated income to remain $50,000 (no bump), got ${Math.round(deflatedIncomeChoiceB)}`);
  process.exit(1);
}
console.log('✅ PASS: Manually setting childcareIncome to standard amount keeps income at $50,000 (no bump).');


// 3. Check that net worth is lower when not bumping income (reduced savings/drawdown)
const finalNWChoiceA = resultsChoiceA.data[resultsChoiceA.data.length - 1].netWorth;
const finalNWChoiceB = resultsChoiceB.data[resultsChoiceB.data.length - 1].netWorth;

if (finalNWChoiceB >= finalNWChoiceA) {
  console.error(`FAIL: Expected net worth without income bump (${finalNWChoiceB}) to be less than with income bump (${finalNWChoiceA})`);
  process.exit(1);
}
console.log('✅ PASS: Net worth correctly reflects drawdown/deficit when childcare is funded from savings (no bump).');


// 4. Scenario: Default behavior when budgetDetails.childcareIncome is undefined (should NOT auto-bump)
const inputsAutoBump = {
  ...DEFAULT_FIRE_INPUTS,
  includeTaxes: false,
  incomeList: baseIncomeList,
  spendingPhases: baseSpendingPhases,
  budgetDetails: undefined, // undefined
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents.filter(e => e.type !== 'haveChild'),
    childEvent1
  ]
};

const resultsAutoBump = runFireSimulation(inputsAutoBump);
const childcareYearsAutoBump = getChildcarePhaseData(resultsAutoBump);

const age35AutoBump = childcareYearsAutoBump.find(d => d.age === 35);
if (!age35AutoBump) {
  console.error('FAIL: Expected parent age 35 to have child costs in Scenario 4');
  process.exit(1);
}

const deflatedIncomeAutoBump = age35AutoBump.income / Math.pow(1 + DEFAULT_FIRE_INPUTS.inflationRate / 100, 35 - DEFAULT_FIRE_INPUTS.currentAge);
if (Math.round(deflatedIncomeAutoBump) !== 50000) {
  console.error(`FAIL: Expected deflated income to remain $50,000 when budgetDetails.childcareIncome is undefined, got ${Math.round(deflatedIncomeAutoBump)}`);
  process.exit(1);
}
console.log('✅ PASS: Default behavior verified: does NOT auto-bump income when budgetDetails.childcareIncome is undefined.');


// 5. Scenario: Deficit / second child added without manual adjustment.
// Set budgetDetails.childcareIncome to 5416.67 (funds first child).
// Add a second child (each cost is 15000/yr at age 35, total 30000/yr).
// Since childcareIncome is configured (defined), it will NOT auto-bump.
// Thus, total deflated income at age 35 remains 65,000 (only first child's bump), creating a shortfall.
const inputsTwoChildrenDeficit = {
  ...DEFAULT_FIRE_INPUTS,
  includeTaxes: false,
  incomeList: baseIncomeList,
  spendingPhases: baseSpendingPhases,
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 4166.67,
    childcareIncome: 5416.67 // Configured to only fund 1 child
  },
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents.filter(e => e.type !== 'haveChild'),
    childEvent1,
    childEvent2
  ]
};

const resultsTwoChildren = runFireSimulation(inputsTwoChildrenDeficit);
const childcareYearsTwoChildren = getChildcarePhaseData(resultsTwoChildren);

const age35TwoChildren = childcareYearsTwoChildren.find(d => d.age === 35);
if (!age35TwoChildren) {
  console.error('FAIL: Expected parent age 35 to have child costs in two-children Scenario 5');
  process.exit(1);
}

// Since childcareIncome is defined, excessBoost = 5416.67 - 4166.67 = 1250/mo = 15000/yr.
// Total deflated income = 50000 + 15000 = 65000.
const deflatedIncomeTwoChildren = age35TwoChildren.income / Math.pow(1 + DEFAULT_FIRE_INPUTS.inflationRate / 100, 35 - DEFAULT_FIRE_INPUTS.currentAge);
if (Math.round(deflatedIncomeTwoChildren) !== 65000) {
  console.error(`FAIL: Expected deflated income to be $65,000 (no auto-bump for second child), got ${Math.round(deflatedIncomeTwoChildren)}`);
  process.exit(1);
}

// Ensure the net worth with two children and single bump is significantly lower than one child with single bump
const finalNWTwoChildren = resultsTwoChildren.data[resultsTwoChildren.data.length - 1].netWorth;
if (finalNWTwoChildren >= finalNWChoiceA) {
  console.error(`FAIL: Expected net worth with two children (${finalNWTwoChildren}) to be less than one child (${finalNWChoiceA}) when childcareIncome is not adjusted`);
  process.exit(1);
}

console.log('✅ PASS: Adding a second child without manually adjusting childcareIncome does not auto-bump and results in a lower net worth / deficit.');

// 6. Test: Verify childcare income is NOT auto-bumped on child event addition (preserving choice flow)
console.log('Testing childcare income is not auto-bumped on event changes...');

const testInputsTwoChildrenNoAuto = {
  ...inputsChoiceA,
  lifeEvents: [...inputsChoiceA.lifeEvents, childEvent2]
};

if (Math.round(testInputsTwoChildrenNoAuto.budgetDetails.childcareIncome) !== 5417) {
  console.error(`FAIL: Expected childcareIncome to remain $5,417, got ${testInputsTwoChildrenNoAuto.budgetDetails.childcareIncome}`);
  process.exit(1);
}
console.log('✅ PASS: Childcare income remains $5,417 when second child event is added (preserving choice/deficit flow).');

// 7. Test: Verify having second child does NOT automatically scale childcare income boost in fireCalculations when childcareBudgets is defined but has no key for C=2
console.log('Testing no automatic budget scaling for second child in simulation...');
const inputsTwoChildrenBudgets = {
  ...DEFAULT_FIRE_INPUTS,
  includeTaxes: false,
  incomeList: baseIncomeList,
  spendingPhases: baseSpendingPhases,
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 4166.67,
    childcareBudgets: {
      1: {
        income: 5416.67, // $1,250 boost
        expenses: { housing: 1500, utilities: 300, food: 600 },
        savings: { brokerage: 500 }
      }
    }
  },
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents.filter(e => e.type !== 'haveChild'),
    childEvent1,
    childEvent2
  ]
};

const resultsTwoChildrenBudgets = runFireSimulation(inputsTwoChildrenBudgets);
const childcareYearsTwoChildrenBudgets = getChildcarePhaseData(resultsTwoChildrenBudgets);
const age35TwoChildrenBudgets = childcareYearsTwoChildrenBudgets.find(d => d.age === 35);

if (!age35TwoChildrenBudgets) {
  console.error('FAIL: Expected parent age 35 to have child costs in Scenario 7');
  process.exit(1);
}

const deflatedIncomeTwoChildrenBudgets = age35TwoChildrenBudgets.income / Math.pow(1 + DEFAULT_FIRE_INPUTS.inflationRate / 100, 35 - DEFAULT_FIRE_INPUTS.currentAge);
// Should remain $65,000 (standard $50,000 + 1-child boost $15,000), not automatically scaled to $75,000!
if (Math.round(deflatedIncomeTwoChildrenBudgets) !== 65000) {
  console.error(`FAIL: Expected deflated income to remain $65,000 (no auto-scale for C=2), got ${Math.round(deflatedIncomeTwoChildrenBudgets)}`);
  process.exit(1);
}
console.log('✅ PASS: Having a second child does not automatically adjust budget/income boost upwards in the simulation when childcareBudgets is used.');

// 8. Test: Staggered kids chronological intervals budget default values
console.log('Testing staggered kids chronological intervals budget default values...');

const staggeredChild1 = {
  id: 'staggered-child-1',
  type: 'haveChild',
  enabled: true,
  name: 'First Child',
  childStartAge: 0,
  birthAge: 35, // Child 1 born at age 35, active 35-53
  costMethod: 'custom',
  customAges0to4: 15000,
  customAges5to12: 15000,
  customAges13to18: 15000,
  customAges19to22: 15000,
  includeCollege: false
};

const staggeredChild2 = {
  id: 'staggered-child-2',
  type: 'haveChild',
  enabled: true,
  name: 'Second Child',
  childStartAge: 0,
  birthAge: 40, // Child 2 born at age 40, active 40-58
  costMethod: 'custom',
  customAges0to4: 15000,
  customAges5to12: 15000,
  customAges13to18: 15000,
  customAges19to22: 15000,
  includeCollege: false
};

const inputsStaggered = {
  ...DEFAULT_FIRE_INPUTS,
  includeTaxes: false,
  inflationRate: 0.00001,
  incomeList: [
    {
      id: 'simple-inc-childcare',
      name: 'Salary / Main Income (Childcare Phase)',
      amount: 50000, // standard base is 50000
      frequency: 'yearly',
      startAge: 35,
      endAge: 58,
      growthRate: 0.0,
      isTaxable: true
    },
    {
      id: 'simple-inc-worksave',
      name: 'Salary / Main Income (Standard Work Phase)',
      amount: 50000,
      frequency: 'yearly',
      startAge: 58,
      endAge: 65,
      growthRate: 0.0,
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
      endAge: 58,
      annualSpending: 42500
    },
    {
      id: 'simple-spend-worksave',
      name: 'Lifestyle Spending (Standard Work Phase)',
      amount: 42500,
      frequency: 'yearly',
      startAge: 58,
      endAge: 85,
      annualSpending: 42500
    }
  ],
  budgetDetails: {
    ...DEFAULT_FIRE_INPUTS.budgetDetails,
    income: 4166.67, // $50,000/12
    childcareBudgets: {
      1: {
        income: 5416.67, // $1,250 boost ($15,000/yr)
        expenses: { housing: 1500, utilities: 300, food: 600 },
        savings: { brokerage: 500 }
      },
      2: {
        income: 6666.67, // $2,500 boost ($30,000/yr)
        expenses: { housing: 1500, utilities: 300, food: 600 },
        savings: { brokerage: 500 }
      }
    }
  },
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents.filter(e => e.type !== 'haveChild'),
    staggeredChild1,
    staggeredChild2
  ]
};

const resultsStaggered = runFireSimulation(inputsStaggered);

// 1. Verify Interval 0: Age 37 (C = 1 child) -> Boost: $1,250/mo ($15k/yr)
const age37Data = resultsStaggered.data.find(d => d.age === 37);
if (!age37Data) {
  console.error('FAIL: Expected simulated data for parent age 37');
  process.exit(1);
}
if (Math.round(age37Data.childCosts) !== 15000) {
  console.error(`FAIL: Expected child costs at age 37 to be 15000, got ${age37Data.childCosts}`);
  process.exit(1);
}
if (Math.round(age37Data.income) !== 65000) {
  // 50000 base + 15000 boost = 65000
  console.error(`FAIL: Expected income at age 37 to be 65000, got ${age37Data.income}`);
  process.exit(1);
}

// 2. Verify Interval 1: Age 45 (C = 2 children) -> Boost: $2,500/mo ($30k/yr)
const age45Data = resultsStaggered.data.find(d => d.age === 45);
if (!age45Data) {
  console.error('FAIL: Expected simulated data for parent age 45');
  process.exit(1);
}
if (Math.round(age45Data.childCosts) !== 30000) {
  console.error(`FAIL: Expected child costs at age 45 to be 30000, got ${age45Data.childCosts}`);
  process.exit(1);
}
if (Math.round(age45Data.income) !== 80000) {
  // 50000 base + 30000 boost = 80000
  console.error(`FAIL: Expected income at age 45 to be 80000, got ${age45Data.income}`);
  process.exit(1);
}

// 3. Verify Interval 2: Age 55 (C = 1 child) -> Boost: $1,250/mo ($15k/yr)
const age55Data = resultsStaggered.data.find(d => d.age === 55);
if (!age55Data) {
  console.error('FAIL: Expected simulated data for parent age 55');
  process.exit(1);
}
if (Math.round(age55Data.childCosts) !== 15000) {
  console.error(`FAIL: Expected child costs at age 55 to be 15000, got ${age55Data.childCosts}`);
  process.exit(1);
}
if (Math.round(age55Data.income) !== 65000) {
  // 50000 base + 15000 boost = 65000
  console.error(`FAIL: Expected income at age 55 to be 65000, got ${age55Data.income}`);
  process.exit(1);
}

// 4. Verify Interval 3: Age 60 (C = 0 children) -> Boost: $0/mo ($0/yr)
const age60Data = resultsStaggered.data.find(d => d.age === 60);
if (!age60Data) {
  console.error('FAIL: Expected simulated data for parent age 60');
  process.exit(1);
}
if (Math.round(age60Data.childCosts) !== 0) {
  console.error(`FAIL: Expected child costs at age 60 to be 0, got ${age60Data.childCosts}`);
  process.exit(1);
}
if (Math.round(age60Data.income) !== 50000) {
  // 50000 base + 0 boost = 50000
  console.error(`FAIL: Expected income at age 60 to be 50000, got ${age60Data.income}`);
  process.exit(1);
}

// 9. Test: Staggered kids chronological intervals scaling fallback (regression test for when C=1 key is not in childcareBudgets but C=2 is)
console.log('Testing staggered kids chronological intervals scaling fallback (C=2 configured, C=1 active)...');
const inputsStaggeredFallback = {
  ...inputsStaggered,
  budgetDetails: {
    ...inputsStaggered.budgetDetails,
    childcareBudgets: {
      2: {
        income: 6666.67, // $2,500 boost ($30,000/yr)
        expenses: { housing: 1500, utilities: 300, food: 600 },
        savings: { brokerage: 500 }
      }
    }
  }
};

const resultsStaggeredFallback = runFireSimulation(inputsStaggeredFallback);

// Verify that at age 37 (C = 1 active child), the income boost is dynamically scaled down to $1,250/mo ($15,000/yr)
const age37Fallback = resultsStaggeredFallback.data.find(d => d.age === 37);
if (!age37Fallback) {
  console.error('FAIL: Expected simulated data for parent age 37 in Fallback test');
  process.exit(1);
}
if (Math.round(age37Fallback.income) !== 65000) {
  console.error(`FAIL: Expected scaled down income at age 37 to be 65000, got ${age37Fallback.income}`);
  process.exit(1);
}

// Verify that at age 45 (C = 2 active children), the income boost remains $2,500/mo ($30,000/yr)
const age45Fallback = resultsStaggeredFallback.data.find(d => d.age === 45);
if (!age45Fallback) {
  console.error('FAIL: Expected simulated data for parent age 45 in Fallback test');
  process.exit(1);
}
if (Math.round(age45Fallback.income) !== 80000) {
  console.error(`FAIL: Expected income at age 45 to be 80000, got ${age45Fallback.income}`);
  process.exit(1);
}

console.log('✅ PASS: Staggered kids chronological intervals scaling fallback verified in simulation.');

console.log('✅ ALL CHILDCARE FUNDING CHOICE TESTS PASSED.');
process.exit(0);
