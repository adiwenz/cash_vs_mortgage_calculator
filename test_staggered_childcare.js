import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('=== Running Staggered Childcare Phases Verification ===');

// Child 1: born at parent age 35, active 35-53 (18 years)
const child1 = {
  id: 'staggered-child-1',
  type: 'haveChild',
  enabled: true,
  name: 'First Child',
  childStartAge: 0,
  birthAge: 35,
  costMethod: 'default',
  includeCollege: false
};

// Child 2: born at parent age 58, active 58-76 (18 years)
const child2 = {
  id: 'staggered-child-2',
  type: 'haveChild',
  enabled: true,
  name: 'Second Child',
  childStartAge: 0,
  birthAge: 58,
  costMethod: 'default',
  includeCollege: false
};

const inputs = {
  ...DEFAULT_FIRE_INPUTS,
  currentAge: 30,
  targetRetirementAge: 65,
  lifeExpectancy: 85,
  includeTaxes: false,
  lifeEvents: [
    ...DEFAULT_FIRE_INPUTS.lifeEvents.filter(e => e.type !== 'haveChild'),
    child1,
    child2
  ]
};

const results = runFireSimulation(inputs);

// 1. Verify childcare phases are generated separately
const childcareIncomeItems = results.incomeList.filter(inc => inc.id.startsWith('simple-inc-childcare'));
const prechildIncomeItems = results.incomeList.filter(inc => inc.id.startsWith('simple-inc-prechild'));
const worksaveIncomeItems = results.incomeList.filter(inc => inc.id.startsWith('simple-inc-worksave'));

console.log('Generated Income Phases:');
results.incomeList.forEach(inc => {
  if (inc.id.startsWith('simple-inc')) {
    console.log(`- ${inc.id}: ${inc.startAge} to ${inc.endAge}`);
  }
});

// We expect two childcare phases for income (since retire at 65, child 2 is active 58-76, but career income stops at 65):
// - childcare 1: 35 to 53
// - childcare 2: 58 to 65 (career end)
// And standard phases:
// - prechild: 30 to 35
// - worksave (gap): 53 to 58
if (childcareIncomeItems.length !== 2) {
  console.error(`FAIL: Expected 2 childcare income phases, got ${childcareIncomeItems.length}`);
  process.exit(1);
}

const cc1 = childcareIncomeItems.find(inc => inc.startAge === 35 && inc.endAge === 53);
const cc2 = childcareIncomeItems.find(inc => inc.startAge === 58 && inc.endAge === 65);

if (!cc1 || !cc2) {
  console.error('FAIL: Expected childcare income phases at [35, 53] and [58, 65] (retirement)');
  process.exit(1);
}

const gapIncome = worksaveIncomeItems.find(inc => inc.startAge === 53 && inc.endAge === 58);
if (!gapIncome) {
  console.error('FAIL: Expected a standard worksave gap income phase at [53, 58]');
  process.exit(1);
}

console.log('✅ PASS: Staggered childcare income phases and standard gap phase successfully verified.');

// 2. Verify childcare spending phases
const childcareSpendItems = results.spendingPhases.filter(p => p.id.startsWith('simple-spend-childcare'));
const prechildSpendItems = results.spendingPhases.filter(p => p.id.startsWith('simple-spend-prechild'));
const worksaveSpendItems = results.spendingPhases.filter(p => p.id.startsWith('simple-spend-worksave'));

console.log('\nGenerated Spending Phases:');
results.spendingPhases.forEach(p => {
  if (p.id.startsWith('simple-spend')) {
    console.log(`- ${p.id}: ${p.startAge} to ${p.endAge}`);
  }
});

// We expect two childcare spending phases:
// - childcare 1: 35 to 53
// - childcare 2: 58 to 76
// And standard phases:
// - prechild: 30 to 35
// - worksave (gap): 53 to 58
// - worksave (post-childcare): 76 to 85
if (childcareSpendItems.length !== 2) {
  console.error(`FAIL: Expected 2 childcare spending phases, got ${childcareSpendItems.length}`);
  process.exit(1);
}

const ccs1 = childcareSpendItems.find(p => p.startAge === 35 && p.endAge === 53);
const ccs2 = childcareSpendItems.find(p => p.startAge === 58 && p.endAge === 76);

if (!ccs1 || !ccs2) {
  console.error('FAIL: Expected childcare spending phases at [35, 53] and [58, 76]');
  process.exit(1);
}

const gapSpend = worksaveSpendItems.find(p => p.startAge === 53 && p.endAge === 58);
if (!gapSpend) {
  console.error('FAIL: Expected a standard worksave gap spending phase at [53, 58]');
  process.exit(1);
}

console.log('✅ PASS: Staggered childcare spending phases and standard gap phase successfully verified.');
console.log('=== ALL STAGGERED CHILDCARE VERIFICATIONS PASSED ===');
process.exit(0);
