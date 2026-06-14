import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('--- Running Budget Scaling Unit Tests ---');

// Helper to copy object
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// The exact scaling helper from FireSimulator.jsx
const scaleBudgetMap = (map, scale, targetTotal, defaultKeyForSurplus = 'brokerage') => {
  if (!map || Object.keys(map).length === 0) return {};
  const newMap = {};
  Object.keys(map).forEach(key => {
    newMap[key] = Math.round((map[key] || 0) * scale);
  });
  const sum = Object.values(newMap).reduce((acc, v) => acc + v, 0);
  const diff = targetTotal - sum;
  if (diff !== 0) {
    let maxKey = defaultKeyForSurplus;
    if (newMap[maxKey] === undefined) {
      maxKey = Object.keys(newMap)[0];
    }
    Object.keys(newMap).forEach(key => {
      if ((newMap[key] || 0) > (newMap[maxKey] || 0)) {
        maxKey = key;
      }
    });
    newMap[maxKey] = Math.max(0, (newMap[maxKey] || 0) + diff);
  }
  return newMap;
};

// Mock function representing handleStep1Change behavior for simpleIncome
function handleStep1ChangeIncome(inputs, val, lastNonZeroSavingsRate = 15) {
  const scen = { id: 'baseline', inputs: clone(inputs) };
  
  const updatedIncomeList = scen.inputs.incomeList.map(inc => {
    if (inc.id === 'simple-inc' || inc.name === 'Salary / Main Income') {
      return { ...inc, amount: val };
    }
    return inc;
  });

  const rate = lastNonZeroSavingsRate / 100;
  const newExpenses = Math.round(val * (1 - rate));

  const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
    if (phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
      return { ...phase, amount: newExpenses, annualSpending: newExpenses };
    }
    return phase;
  });

  let updatedBudgetDetails = scen.inputs.budgetDetails ? { ...scen.inputs.budgetDetails } : null;
  let updatedRules = scen.inputs.allocationRules ? [...scen.inputs.allocationRules] : [];

  if (updatedBudgetDetails) {
    const oldIncome = Number(scen.inputs.simpleIncome) || 50000;
    const incomeScale = oldIncome > 0 ? (val / oldIncome) : 1;

    if (incomeScale > 0 && isFinite(incomeScale)) {
      const newMonthlyExpenses = newExpenses / 12;
      updatedBudgetDetails.expenses = scaleBudgetMap(
        scen.inputs.budgetDetails.expenses,
        incomeScale,
        Math.round(newMonthlyExpenses),
        'housing'
      );

      const newMonthlySavings = (val - newExpenses) / 12;
      updatedBudgetDetails.savings = scaleBudgetMap(
        scen.inputs.budgetDetails.savings,
        incomeScale,
        Math.round(newMonthlySavings),
        'brokerage'
      );

      if (scen.inputs.budgetDetails.childcareExpenses) {
        const oldCCExpensesTotal = Object.values(scen.inputs.budgetDetails.childcareExpenses).reduce((sum, v) => sum + v, 0);
        const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * incomeScale);
        updatedBudgetDetails.childcareExpenses = scaleBudgetMap(
          scen.inputs.budgetDetails.childcareExpenses,
          incomeScale,
          targetCCExpensesTotal,
          'housing'
        );
      }

      if (scen.inputs.budgetDetails.childcareSavings) {
        const oldCCSavingsTotal = Object.values(scen.inputs.budgetDetails.childcareSavings).reduce((sum, v) => sum + v, 0);
        const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * incomeScale);
        updatedBudgetDetails.childcareSavings = scaleBudgetMap(
          scen.inputs.budgetDetails.childcareSavings,
          incomeScale,
          targetCCSavingsTotal,
          'brokerage'
        );
      }

      updatedBudgetDetails.income = Math.round(val / 12);
      if (updatedBudgetDetails.childcareIncome !== undefined) {
        updatedBudgetDetails.childcareIncome = Math.round(updatedBudgetDetails.childcareIncome * incomeScale);
      }
    }
  }

  if (updatedBudgetDetails && updatedRules.length > 0) {
    const childEvents = (scen.inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
    let maxChildParentAge = -Infinity;
    childEvents.forEach(ev => {
      const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
      const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
      const maxAge = includeCollege ? 22 : 18;
      if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
    });
    const childEndAge = Math.min(scen.inputs.lifeExpectancy || 85, Math.max(scen.inputs.currentAge, maxChildParentAge));

    updatedRules = updatedRules.map(rule => {
      if (rule.type === 'fixed') {
        const isChildcareRule = rule.id.includes('-cc-') || (rule.endAge && rule.endAge === childEndAge);
        const savingsMap = isChildcareRule ? updatedBudgetDetails.childcareSavings : updatedBudgetDetails.savings;

        const key = rule.destination === 'cash' ? 'checking' :
                    rule.destination === 'other' ? 'hysa' :
                    rule.destination === 'emergencyFund' ? 'emergency' :
                    rule.destination === 'debtPaydown' ? 'debt' : rule.destination;

        if (savingsMap && savingsMap[key] !== undefined) {
          return { ...rule, value: savingsMap[key] };
        }
      }
      return rule;
    });
  }

  return {
    ...scen.inputs,
    incomeList: updatedIncomeList,
    spendingPhases: updatedSpendingPhases,
    simpleIncome: val,
    simpleExpenses: newExpenses,
    budgetDetails: updatedBudgetDetails,
    allocationRules: updatedRules
  };
}

// Mock function representing handleStep1Change behavior for simpleExpenses
function handleStep1ChangeExpenses(inputs, val) {
  const scen = { id: 'baseline', inputs: clone(inputs) };

  const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
    if (phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
      return { ...phase, amount: val, annualSpending: (phase.frequency === 'monthly' ? val * 12 : val) };
    }
    return phase;
  });

  let updatedBudgetDetails = scen.inputs.budgetDetails ? { ...scen.inputs.budgetDetails } : null;
  let updatedRules = scen.inputs.allocationRules ? [...scen.inputs.allocationRules] : [];

  if (updatedBudgetDetails) {
    const oldExpenses = Number(scen.inputs.simpleExpenses) || 42500;
    const currentIncome = Number(scen.inputs.simpleIncome) || 50000;
    const expenseScale = oldExpenses > 0 ? (val / oldExpenses) : 1;

    if (expenseScale > 0 && isFinite(expenseScale)) {
      const newMonthlyExpenses = val / 12;
      updatedBudgetDetails.expenses = scaleBudgetMap(
        scen.inputs.budgetDetails.expenses,
        expenseScale,
        Math.round(newMonthlyExpenses),
        'housing'
      );

      if (scen.inputs.budgetDetails.childcareExpenses) {
        const oldCCExpensesTotal = Object.values(scen.inputs.budgetDetails.childcareExpenses).reduce((sum, v) => sum + v, 0);
        const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * expenseScale);
        updatedBudgetDetails.childcareExpenses = scaleBudgetMap(
          scen.inputs.budgetDetails.childcareExpenses,
          expenseScale,
          targetCCExpensesTotal,
          'housing'
        );
      }
    }

    const oldSavings = Math.max(0, currentIncome - oldExpenses);
    const newSavings = Math.max(0, currentIncome - val);

    const oldMonthlySavings = oldSavings / 12;
    const newMonthlySavings = newSavings / 12;

    if (oldMonthlySavings <= 0 && newMonthlySavings > 0) {
      const defaultSavings = {
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
        checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      };
      defaultSavings.brokerage = Math.round(newMonthlySavings);
      updatedBudgetDetails.savings = defaultSavings;

      if (updatedBudgetDetails.childcareSavings) {
        const defaultCC = { ...defaultSavings };
        const ccIncome = updatedBudgetDetails.childcareIncome || Math.round(currentIncome / 12);
        const ccExpenses = Object.values(updatedBudgetDetails.childcareExpenses || {}).reduce((sum, v) => sum + v, 0);
        defaultCC.brokerage = Math.round(Math.max(0, ccIncome - ccExpenses));
        updatedBudgetDetails.childcareSavings = defaultCC;
      }
    } else if (newMonthlySavings <= 0) {
      const zeroSavings = {
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
        checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      };
      updatedBudgetDetails.savings = zeroSavings;
      if (updatedBudgetDetails.childcareSavings) {
        updatedBudgetDetails.childcareSavings = { ...zeroSavings };
      }
    } else {
      const savingsScale = newMonthlySavings / oldMonthlySavings;
      if (isFinite(savingsScale)) {
        updatedBudgetDetails.savings = scaleBudgetMap(
          scen.inputs.budgetDetails.savings,
          savingsScale,
          Math.round(newMonthlySavings),
          'brokerage'
        );

        if (updatedBudgetDetails.childcareSavings) {
          const oldCCSavingsTotal = Object.values(scen.inputs.childcareSavings).reduce((sum, v) => sum + v, 0);
          const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * savingsScale);
          updatedBudgetDetails.childcareSavings = scaleBudgetMap(
            scen.inputs.childcareSavings,
            savingsScale,
            targetCCSavingsTotal,
            'brokerage'
          );
        }
      }
    }
  }

  if (updatedBudgetDetails && updatedRules.length > 0) {
    const childEvents = (scen.inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
    let maxChildParentAge = -Infinity;
    childEvents.forEach(ev => {
      const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
      const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
      const maxAge = includeCollege ? 22 : 18;
      if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
    });
    const childEndAge = Math.min(scen.inputs.lifeExpectancy || 85, Math.max(scen.inputs.currentAge, maxChildParentAge));

    updatedRules = updatedRules.map(rule => {
      if (rule.type === 'fixed') {
        const isChildcareRule = rule.id.includes('-cc-') || (rule.endAge && rule.endAge === childEndAge);
        const savingsMap = isChildcareRule ? updatedBudgetDetails.childcareSavings : updatedBudgetDetails.savings;

        const key = rule.destination === 'cash' ? 'checking' :
                    rule.destination === 'other' ? 'hysa' :
                    rule.destination === 'emergencyFund' ? 'emergency' :
                    rule.destination === 'debtPaydown' ? 'debt' : rule.destination;

        if (savingsMap && savingsMap[key] !== undefined) {
          return { ...rule, value: savingsMap[key] };
        }
      }
      return rule;
    });
  }

  return {
    ...scen.inputs,
    spendingPhases: updatedSpendingPhases,
    budgetDetails: updatedBudgetDetails,
    allocationRules: updatedRules,
    simpleExpenses: val
  };
}

// ----------------------------------------------------
// TEST CASE 1: Proportional scaling when income doubles
// ----------------------------------------------------
console.log('\nTest 1: Proportional scaling on income double (50k -> 100k)...');
const doubleIncomeInputs = handleStep1ChangeIncome(DEFAULT_FIRE_INPUTS, 100000, 15);

// Check new simple income and expenses
if (doubleIncomeInputs.simpleIncome !== 100000) throw new Error('simpleIncome should be 100000');
if (doubleIncomeInputs.simpleExpenses !== 85000) throw new Error(`simpleExpenses should be 85000, got ${doubleIncomeInputs.simpleExpenses}`);

// Check that budget details sum to monthly equivalents
const sumExpenses1 = Object.values(doubleIncomeInputs.budgetDetails.expenses).reduce((sum, v) => sum + v, 0);
const targetMonthlyExpenses1 = Math.round(85000 / 12);
if (sumExpenses1 !== targetMonthlyExpenses1) {
  throw new Error(`Expenses sum ${sumExpenses1} does not match target ${targetMonthlyExpenses1}`);
}

const sumSavings1 = Object.values(doubleIncomeInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
const targetMonthlySavings1 = Math.round(15000 / 12);
if (sumSavings1 !== targetMonthlySavings1) {
  throw new Error(`Savings sum ${sumSavings1} does not match target ${targetMonthlySavings1}`);
}

// Check that rules match values exactly
doubleIncomeInputs.allocationRules.forEach(rule => {
  if (rule.type === 'fixed') {
    const key = rule.destination === 'cash' ? 'checking' :
                rule.destination === 'other' ? 'hysa' :
                rule.destination === 'emergencyFund' ? 'emergency' :
                rule.destination === 'debtPaydown' ? 'debt' : rule.destination;
    const valInMap = doubleIncomeInputs.budgetDetails.savings[key];
    if (rule.value !== valInMap) {
      throw new Error(`Rule value for ${rule.destination} is ${rule.value}, but map value is ${valInMap}`);
    }
  }
});
console.log('✅ PASS: Proportional scaling on income double works perfectly.');

// ----------------------------------------------------
// TEST CASE 2: Proportional scaling when savings rate increases
// ----------------------------------------------------
console.log('\nTest 2: Scaling when expenses decrease (more savings)...');
// Decrease expenses from 42,500 to 35,000 (meaning savings increases from 7,500 to 15,000)
const increasedSavingsInputs = handleStep1ChangeExpenses(DEFAULT_FIRE_INPUTS, 35000);

if (increasedSavingsInputs.simpleExpenses !== 35000) throw new Error('simpleExpenses should be 35000');

const sumExpenses2 = Object.values(increasedSavingsInputs.budgetDetails.expenses).reduce((sum, v) => sum + v, 0);
const targetExpenses2 = Math.round(35000 / 12);
if (sumExpenses2 !== targetExpenses2) {
  throw new Error(`Expenses sum ${sumExpenses2} does not match target ${targetExpenses2}`);
}

const sumSavings2 = Object.values(increasedSavingsInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
const targetSavings2 = Math.round(15000 / 12);
if (sumSavings2 !== targetSavings2) {
  throw new Error(`Savings sum ${sumSavings2} does not match target ${targetSavings2}`);
}

// Rules sync check
increasedSavingsInputs.allocationRules.forEach(rule => {
  if (rule.type === 'fixed') {
    const key = rule.destination === 'cash' ? 'checking' :
                rule.destination === 'other' ? 'hysa' :
                rule.destination === 'emergencyFund' ? 'emergency' :
                rule.destination === 'debtPaydown' ? 'debt' : rule.destination;
    const valInMap = increasedSavingsInputs.budgetDetails.savings[key];
    if (rule.value !== valInMap) {
      throw new Error(`Rule value for ${rule.destination} is ${rule.value}, but map value is ${valInMap}`);
    }
  }
});
console.log('✅ PASS: Scaling when expenses decrease works perfectly.');

// ----------------------------------------------------
// TEST CASE 3: Transitioning from zero savings to positive savings
// ----------------------------------------------------
console.log('\nTest 3: Zero-savings to positive savings transition...');
// 1. Create a zero-savings state first
const zeroSavingsInputs = handleStep1ChangeExpenses(DEFAULT_FIRE_INPUTS, 50000);
const sumSavingsZero = Object.values(zeroSavingsInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
if (sumSavingsZero !== 0) throw new Error(`Savings should be 0, got ${sumSavingsZero}`);

// 2. Increase savings (expenses back to 40,000, saving 10,000)
const positiveSavingsInputs = handleStep1ChangeExpenses(zeroSavingsInputs, 40000);
const sumSavingsPositive = Object.values(positiveSavingsInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
const targetSavingsPositive = Math.round(10000 / 12);
if (sumSavingsPositive !== targetSavingsPositive) {
  throw new Error(`Savings sum ${sumSavingsPositive} does not match target ${targetSavingsPositive}`);
}

// Verify it fell back to brokerage
if (positiveSavingsInputs.budgetDetails.savings.brokerage !== targetSavingsPositive) {
  throw new Error(`Expected all savings to go to brokerage (${targetSavingsPositive}), got ${positiveSavingsInputs.budgetDetails.savings.brokerage}`);
}
// Verify other categories are 0
Object.keys(positiveSavingsInputs.budgetDetails.savings).forEach(key => {
  if (key !== 'brokerage' && positiveSavingsInputs.budgetDetails.savings[key] !== 0) {
    throw new Error(`Expected category ${key} to be 0, got ${positiveSavingsInputs.budgetDetails.savings[key]}`);
  }
});
console.log('✅ PASS: Zero-savings to positive savings transition handles fallback correctly.');

// ----------------------------------------------------
// TEST CASE 4: Verify savings rate is preserved across multiple income levels
// ----------------------------------------------------
console.log('\nTest 4: Verify savings rate is preserved across multiple income changes...');
const testIncomes = [40000, 60000, 75000, 120000, 150000];
const originalSavingsRate = 0.15; // 15%

testIncomes.forEach(incomeVal => {
  const scaledInputs = handleStep1ChangeIncome(DEFAULT_FIRE_INPUTS, incomeVal, 15);
  
  // Total monthly gross income
  const monthlyGross = incomeVal / 12;
  
  // Sum the scaled savings and expenses in budget details
  const totalSavings = Object.values(scaledInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
  const totalExpenses = Object.values(scaledInputs.budgetDetails.expenses).reduce((sum, v) => sum + v, 0);
  
  // Target monthly savings and expenses
  const targetSavings = (incomeVal * originalSavingsRate) / 12;
  const targetExpenses = (incomeVal * (1 - originalSavingsRate)) / 12;
  
  // Verify exact matches of totals (since rounding correction ensures sum equals target total)
  if (Math.abs(totalSavings - targetSavings) > 1) {
    throw new Error(`Income ${incomeVal}: Savings sum ${totalSavings} does not match target ${targetSavings}`);
  }
  if (Math.abs(totalExpenses - targetExpenses) > 1) {
    throw new Error(`Income ${incomeVal}: Expenses sum ${totalExpenses} does not match target ${targetExpenses}`);
  }
  
  // Verify savings rate calculation
  const calculatedSavingsRate = totalSavings / monthlyGross;
  const diff = Math.abs(calculatedSavingsRate - originalSavingsRate);
  if (diff > 0.01) { // tolerance of 1%
    throw new Error(`Income ${incomeVal}: Savings rate drifted. Expected ${originalSavingsRate}, got ${calculatedSavingsRate}`);
  }
  console.log(`- Income: $${incomeVal} -> Savings: $${totalSavings}/mo, Expenses: $${totalExpenses}/mo (Savings Rate: ${(calculatedSavingsRate * 100).toFixed(2)}%)`);
});
console.log('✅ PASS: Savings rate is consistently preserved across different income levels.');

console.log('\n✅ ALL BUDGET SCALING TESTS PASSED!');
process.exit(0);
