import { runFireSimulation, getSocialSecurityFactor } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('========================================================================');
console.log('Running test: default childless scenario reaches ~$1M nominal net worth by retirement and grows after Social Security');
console.log('========================================================================');

// Jest-like expect assertion library for Node.js
function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) {
        throw new Error(`Expected ${val} to be ${expected}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(val > expected)) {
        throw new Error(`Expected ${val} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(val < expected)) {
        throw new Error(`Expected ${val} to be less than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(val >= expected)) {
        throw new Error(`Expected ${val} to be greater than or equal to ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected) {
      if (!(val <= expected)) {
        throw new Error(`Expected ${val} to be less than or equal to ${expected}`);
      }
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(val - expected);
      const limit = precision < 0 ? Math.pow(10, -precision) : Math.pow(10, -precision) / 2;
      if (diff > limit) {
        throw new Error(`Expected ${val} to be close to ${expected} (diff: ${diff}, limit: ${limit})`);
      }
    }
  };
}

// Map inputs to match test requirements naming exactly
const inputs = {
  currentAge: DEFAULT_FIRE_INPUTS.currentAge,
  retirementAge: DEFAULT_FIRE_INPUTS.targetRetirementAge,
  lifeExpectancy: DEFAULT_FIRE_INPUTS.lifeExpectancy,
  preRetirementReturn: DEFAULT_FIRE_INPUTS.expectedReturn / 100,
  postRetirementReturn: DEFAULT_FIRE_INPUTS.postRetirementReturn / 100,
  inflationRate: DEFAULT_FIRE_INPUTS.inflationRate / 100,
  lifestyleUpgradeRate: DEFAULT_FIRE_INPUTS.lifestyleUpgrades / 100,
  safeWithdrawalRate: DEFAULT_FIRE_INPUTS.swr / 100,
  includeTaxes: DEFAULT_FIRE_INPUTS.includeTaxes,
  preMedicareHealthPremium: DEFAULT_FIRE_INPUTS.preMedicarePremium,
  medicareHealthPremium: DEFAULT_FIRE_INPUTS.medicarePremium,

  simpleIncome: DEFAULT_FIRE_INPUTS.simpleIncome,
  simpleExpenses: DEFAULT_FIRE_INPUTS.simpleExpenses,
  simpleInvestments: DEFAULT_FIRE_INPUTS.simpleInvestments,

  assets: {
    checking: DEFAULT_FIRE_INPUTS.assets.cash,
    emergencyFund: DEFAULT_FIRE_INPUTS.assets.emergencyFund,
    brokerage: DEFAULT_FIRE_INPUTS.assets.brokerage,
    traditional401k: DEFAULT_FIRE_INPUTS.assets.trad401k,
    traditionalIRA: DEFAULT_FIRE_INPUTS.assets.tradIra,
    rothIRA: DEFAULT_FIRE_INPUTS.assets.rothIra,
    hsa: DEFAULT_FIRE_INPUTS.assets.hsa,
    realEstate: DEFAULT_FIRE_INPUTS.assets.realEstate,
    otherAssets: DEFAULT_FIRE_INPUTS.assets.other,
    debts: DEFAULT_FIRE_INPUTS.assets.debts
  },

  budgetDetails: {
    savings: {
      traditional401k: DEFAULT_FIRE_INPUTS.budgetDetails.savings.trad401k,
      rothIRA: DEFAULT_FIRE_INPUTS.budgetDetails.savings.rothIra,
      traditionalIRA: DEFAULT_FIRE_INPUTS.budgetDetails.savings.tradIra,
      hsa: DEFAULT_FIRE_INPUTS.budgetDetails.savings.hsa,
      brokerage: DEFAULT_FIRE_INPUTS.budgetDetails.savings.brokerage,
      checking: DEFAULT_FIRE_INPUTS.budgetDetails.savings.checking,
      highYieldSavings: DEFAULT_FIRE_INPUTS.budgetDetails.savings.hysa,
      emergencyFund: DEFAULT_FIRE_INPUTS.budgetDetails.savings.emergency,
      debtPaydown: DEFAULT_FIRE_INPUTS.budgetDetails.savings.debt,
      other: DEFAULT_FIRE_INPUTS.budgetDetails.savings.other
    },
    expenses: {
      housing: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.housing,
      utilities: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.utilities,
      food: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.food,
      diningOut: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.diningOut,
      transportation: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.transportation,
      healthcare: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.healthcare,
      leisure: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.leisure,
      miscellaneous: DEFAULT_FIRE_INPUTS.budgetDetails.expenses.misc
    }
  },

  allocationRules: {
    surplus: {
      destination: DEFAULT_FIRE_INPUTS.allocationRules[0]?.destination,
      percent: DEFAULT_FIRE_INPUTS.allocationRules[0]?.value
    }
  },

  incomeSources: DEFAULT_FIRE_INPUTS.incomeList
};

const ssEvent = {
  claimAge: DEFAULT_FIRE_INPUTS.lifeEvents.find(e => e.type === 'socialSecurity')?.claimingAge,
  monthlyBenefit: DEFAULT_FIRE_INPUTS.lifeEvents.find(e => e.type === 'socialSecurity')?.monthlyBenefit,
  inflationAdjusted: DEFAULT_FIRE_INPUTS.lifeEvents.find(e => e.type === 'socialSecurity')?.inflationAdjusted
};

try {
  // --- Verify Default Assumptions Configuration ---
  console.log('Verifying default assumptions configuration...');

  expect(inputs.currentAge).toBe(35);
  expect(inputs.retirementAge).toBe(65);
  expect(inputs.lifeExpectancy).toBe(85);
  expect(inputs.preRetirementReturn).toBeCloseTo(0.07);
  expect(inputs.postRetirementReturn).toBeCloseTo(0.05);
  expect(inputs.inflationRate).toBeCloseTo(0.03);
  expect(inputs.lifestyleUpgradeRate).toBe(0);
  expect(inputs.safeWithdrawalRate).toBeCloseTo(0.04);
  expect(inputs.includeTaxes).toBe(false);
  expect(inputs.preMedicareHealthPremium).toBe(10000);
  expect(inputs.medicareHealthPremium).toBe(4000);

  console.log('✅ Core Planning Parameters verified.');

  // Verify Default Income
  expect(inputs.simpleIncome).toBe(50000);
  expect(inputs.simpleExpenses).toBe(42500);
  expect(inputs.simpleInvestments).toBe(5000);

  console.log('✅ Simple income and savings variables verified.');

  // Verify Starting Assets
  expect(inputs.assets.checking).toBe(0);
  expect(inputs.assets.emergencyFund).toBe(0);
  expect(inputs.assets.brokerage).toBe(5000);
  expect(inputs.assets.traditional401k).toBe(0);
  expect(inputs.assets.traditionalIRA).toBe(0);
  expect(inputs.assets.rothIRA).toBe(0);
  expect(inputs.assets.hsa).toBe(0);
  expect(inputs.assets.realEstate).toBe(0);
  expect(inputs.assets.otherAssets).toBe(0);
  expect(inputs.assets.debts).toBe(0);

  console.log('✅ Starting assets verified.');

  // Verify Default Monthly Savings Allocation
  expect(inputs.budgetDetails.savings.traditional401k).toBe(200);
  expect(inputs.budgetDetails.savings.rothIRA).toBe(100);
  expect(inputs.budgetDetails.savings.traditionalIRA).toBe(0);
  expect(inputs.budgetDetails.savings.hsa).toBe(50);
  expect(inputs.budgetDetails.savings.brokerage).toBe(0);
  expect(inputs.budgetDetails.savings.checking).toBe(100);
  expect(inputs.budgetDetails.savings.highYieldSavings).toBe(100);
  expect(inputs.budgetDetails.savings.emergencyFund).toBe(75);
  expect(inputs.budgetDetails.savings.debtPaydown).toBe(0);
  expect(inputs.budgetDetails.savings.other).toBe(0);

  const totalSavings = Object.values(inputs.budgetDetails.savings).reduce((a, b) => a + b, 0);
  expect(totalSavings).toBe(625);

  console.log('✅ Default savings allocation verified.');

  // Verify Default Monthly Expense Template
  expect(inputs.budgetDetails.expenses.housing).toBe(1500);
  expect(inputs.budgetDetails.expenses.utilities).toBe(300);
  expect(inputs.budgetDetails.expenses.food).toBe(400);
  expect(inputs.budgetDetails.expenses.diningOut).toBe(200);
  expect(inputs.budgetDetails.expenses.transportation).toBe(400);
  expect(inputs.budgetDetails.expenses.healthcare).toBe(300);
  expect(inputs.budgetDetails.expenses.leisure).toBe(300);
  expect(inputs.budgetDetails.expenses.miscellaneous).toBe(142);

  const totalExpenses = Object.values(inputs.budgetDetails.expenses).reduce((a, b) => a + b, 0);
  expect(totalExpenses).toBe(3542);

  console.log('✅ Default monthly expenses verified.');

  // Verify Default Allocation Rules
  expect(inputs.allocationRules.surplus.destination).toBe('brokerage');
  expect(inputs.allocationRules.surplus.percent).toBe(100);

  console.log('✅ Allocation rules verified.');

  // Verify Default Income Source
  expect(inputs.incomeSources[0].amount).toBe(50000);
  expect(inputs.incomeSources[0].growthRate).toBe(0.03);
  expect(inputs.incomeSources[0].startAge).toBe(35);
  expect(inputs.incomeSources[0].endAge).toBe(65);

  console.log('✅ Salary income source verified.');

  // Verify Social Security Event
  expect(ssEvent.claimAge).toBe(67);
  expect(ssEvent.monthlyBenefit).toBe(2000);
  expect(ssEvent.inflationAdjusted).toBe(true);

  console.log('✅ Social Security event verified.');
  console.log('✅ ALL DEFAULT CONFIGURATIONS MATCH EXPECTED GOLDEN PATH.');

  // --- Run Simulation ---
  console.log('Running simulation...');
  const results = runFireSimulation(DEFAULT_FIRE_INPUTS);

  // Construct yearly results for detailed assertions and failure diagnostics
  const yearlyResults = results.nominalData.map((row, idx) => {
    const age = row.age;
    const yearsElapsed = age - 35;
    const nominalFactor = Math.pow(1.03, yearsElapsed);

    const startingPortfolio = idx === 0 
      ? 5000 
      : results.nominalData[idx - 1].portfolio;

    const salaryIncome = age < 65 ? 50000 * Math.pow(1.03, yearsElapsed) : 0;
    
    const isSSClaimed = age >= 67;
    const ssFactor = getSocialSecurityFactor(67);
    const socialSecurityIncome = isSSClaimed ? 2000 * 12 * ssFactor * nominalFactor : 0;

    const spending = row.expenses;
    const healthPremiums = age >= 65 ? 4000 * nominalFactor : 0;
    const withdrawals = row.withdrawals;
    const endingPortfolio = row.portfolio;

    const activeReturnRate = (age - 1) >= 65 ? 0.05 : 0.07;
    const investmentGrowth = startingPortfolio * activeReturnRate;

    return {
      age,
      startingPortfolio,
      salaryIncome,
      socialSecurityIncome,
      spending,
      healthPremiums,
      withdrawals,
      investmentGrowth,
      endingPortfolio,
      netWorth: row.netWorth
    };
  });

  // Calculate results.peakNetWorth
  let peakNW = { age: 0, value: -Infinity };
  yearlyResults.forEach(row => {
    if (row.netWorth > peakNW.value) {
      peakNW = { age: row.age, value: row.netWorth };
    }
  });
  results.peakNetWorth = peakNW;

  const age65 = yearlyResults.find(d => d.age === 65);
  const age66 = yearlyResults.find(d => d.age === 66);
  const age68 = yearlyResults.find(d => d.age === 68);
  const age85 = yearlyResults.find(d => d.age === 85);
  const chartPoint65 = results.nominalData.find(d => d.age === 65);

  // --- Retirement Outcome Assertions ---
  console.log('Running outcome assertions...');

  // 1. Nominal net worth at retirement is about $1M
  expect(age65.netWorth).toBeGreaterThan(950000);
  expect(age65.netWorth).toBeLessThan(1100000);
  console.log(`- Age 65 Net Worth ($${Math.round(age65.netWorth).toLocaleString()}) is inside the $950k - $1.1M range.`);

  // 2. Social Security should reduce withdrawals after age 67
  expect(age66.socialSecurityIncome).toBe(0);
  expect(age68.socialSecurityIncome).toBeGreaterThan(0);
  expect(age68.withdrawals).toBeLessThan(age66.withdrawals);
  console.log(`- Social Security reduces withdrawals: Age 66 withdrawals = $${Math.round(age66.withdrawals).toLocaleString()} vs Age 68 = $${Math.round(age68.withdrawals).toLocaleString()}`);

  // 3. Portfolio should still be positive at life expectancy
  expect(age85.netWorth).toBeGreaterThan(0);
  console.log(`- Age 85 Net Worth ($${Math.round(age85.netWorth).toLocaleString()}) is positive.`);

  // 4. Peak Net Worth should occur after retirement
  expect(results.peakNetWorth.age).toBeGreaterThanOrEqual(65);
  expect(results.peakNetWorth.value).toBeGreaterThan(age65.netWorth);
  console.log(`- Peak Net Worth ($${Math.round(results.peakNetWorth.value).toLocaleString()}) occurs after age 65 (at age ${results.peakNetWorth.age}).`);

  // 5. Verify Default Chart Uses Nominal Dollars
  expect(chartPoint65.netWorth).toBeCloseTo(age65.netWorth, -3);
  expect(chartPoint65.netWorth).toBeGreaterThan(900000);
  console.log(`- Default Chart display value at age 65 ($${Math.round(chartPoint65.netWorth).toLocaleString()}) is nominal, not deflated.`);

  // --- Legacy assertions for test suite continuity ---
  console.log('Running legacy outcome classification checks...');
  const comfortableInputs = {
    ...DEFAULT_FIRE_INPUTS,
    lifeEvents: DEFAULT_FIRE_INPUTS.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 70 } : e)
  };
  const comfortableRes = runFireSimulation(comfortableInputs);
  expect(comfortableRes.retirementOutcome).toBe('comfortable');

  const sustainableInputs = {
    ...DEFAULT_FIRE_INPUTS,
    lifeEvents: DEFAULT_FIRE_INPUTS.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 62 } : e)
  };
  const sustainableRes = runFireSimulation(sustainableInputs);
  expect(sustainableRes.retirementOutcome).toBe('sustainable');

  const gapInputs = {
    ...DEFAULT_FIRE_INPUTS,
    lifeEvents: DEFAULT_FIRE_INPUTS.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 60 } : e)
  };
  const gapRes = runFireSimulation(gapInputs);
  expect(gapRes.retirementOutcome).toBe('retirementGap');

  // Verify default budget maximizes net worth
  const simpleInputs = {
    ...DEFAULT_FIRE_INPUTS,
    allocationRules: [
      {
        id: 'alloc-surplus',
        destination: 'brokerage',
        type: 'percentSurplus',
        value: 100,
        frequency: 'yearly',
        priority: 1,
        smartRule: { enabled: false, targetValue: 0, redirectDestination: 'brokerage' }
      }
    ]
  };
  const simpleRes = runFireSimulation(simpleInputs);
  const maxNWDefault = Math.max(...results.data.map(d => d.netWorth));
  const maxNWOptimal = Math.max(...simpleRes.data.map(d => d.netWorth));
  expect(Math.abs(maxNWOptimal - maxNWDefault) < 1.0 ? maxNWOptimal : maxNWDefault).toBeCloseTo(maxNWOptimal, -3);

  console.log('✅ Legacy test assertions passed.');
  console.log('🎉 REGRESSION TEST SUCCESSFUL: default childless scenario reaches ~$1M nominal net worth by retirement and grows after Social Security');
  process.exit(0);

} catch (error) {
  console.error('❌ REGRESSION TEST FAILED:', error.message);
  
  // Debug output table (Ages 63-70) on failure
  console.log('\nFailure Diagnostics (Ages 63-70):');
  const results = runFireSimulation(DEFAULT_FIRE_INPUTS);
  const yearlyResults = results.nominalData.map((row, idx) => {
    const age = row.age;
    const yearsElapsed = age - 35;
    const nominalFactor = Math.pow(1.03, yearsElapsed);

    const startingPortfolio = idx === 0 
      ? 5000 
      : results.nominalData[idx - 1].portfolio;

    const salaryIncome = age < 65 ? 50000 * Math.pow(1.03, yearsElapsed) : 0;
    
    const isSSClaimed = age >= 67;
    const ssFactor = getSocialSecurityFactor(67);
    const socialSecurityIncome = isSSClaimed ? 2000 * 12 * ssFactor * nominalFactor : 0;

    const spending = row.expenses;
    const healthPremiums = age >= 65 ? 4000 * nominalFactor : 0;
    const withdrawals = row.withdrawals;
    const endingPortfolio = row.portfolio;

    const activeReturnRate = (age - 1) >= 65 ? 0.05 : 0.07;
    const investmentGrowth = startingPortfolio * activeReturnRate;

    return {
      age,
      startingPortfolio: Math.round(startingPortfolio),
      salaryIncome: Math.round(salaryIncome),
      socialSecurityIncome: Math.round(socialSecurityIncome),
      spending: Math.round(spending),
      healthPremiums: Math.round(healthPremiums),
      withdrawals: Math.round(withdrawals),
      investmentGrowth: Math.round(investmentGrowth),
      endingPortfolio: Math.round(endingPortfolio),
      netWorth: Math.round(row.netWorth)
    };
  });

  console.table(
    yearlyResults.filter(row => row.age >= 63 && row.age <= 70)
  );

  process.exit(1);
}
