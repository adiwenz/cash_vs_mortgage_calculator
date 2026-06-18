import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getSocialSecurityFactor } from './src/fireCalculations.js';

// Jest-like expect assertion library for Node.js
export function expect(val) {
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

// Returns a deep clone of the default inputs
export function getMappedDefaultInputs() {
  const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  inputs.hasCustomizedSavingsAllocation = true;
  inputs.budgetDetails.savings = {
    trad401k: 200,
    rothIra: 100,
    tradIra: 0,
    hsa: 50,
    brokerage: 0,
    checking: 100,
    hysa: 100,
    emergency: 75,
    debt: 0,
    other: 0
  };
  return inputs;
}

// Translates raw simulation results into a yearly results structure for assertions and diagnostics
export function buildYearlyResults(results, inputs) {
  const currentAge = Number(inputs.currentAge) || 35;
  const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
  const inflationRate = (Number(inputs.inflationRate) || 3) / 100;
  const preRetirementReturn = (Number(inputs.expectedReturn) || 7) / 100;
  const postRetirementReturn = (Number(inputs.postRetirementReturn) || 5) / 100;
  const preMedicarePremium = Number(inputs.preMedicarePremium) || 10000;
  const medicarePremium = Number(inputs.medicarePremium) || 4000;

  const ssEvent = inputs.lifeEvents?.find(e => e.type === 'socialSecurity' && e.enabled);
  const ssClaimAge = ssEvent ? (Number(ssEvent.claimingAge) || 67) : 67;
  const ssMonthly = ssEvent ? (Number(ssEvent.monthlyBenefit) || 2000) : 2000;
  const ssFactor = ssEvent ? getSocialSecurityFactor(ssClaimAge) : 1.0;

  const initialInvestments = Number(inputs.simpleInvestments) || 0;

  return results.nominalData.map((row, idx) => {
    const age = row.age;
    const yearsElapsed = age - currentAge;
    const nominalFactor = Math.pow(1 + inflationRate, yearsElapsed);

    const startingPortfolio = idx === 0 
      ? initialInvestments 
      : results.nominalData[idx - 1].portfolio;

    // Salary: stops at targetRetirementAge
    const salaryIncome = age < targetRetirementAge 
      ? (Number(inputs.simpleIncome) || 50000) * nominalFactor 
      : 0;
    
    // Social Security
    const socialSecurityIncome = (ssEvent && age >= ssClaimAge)
      ? ssMonthly * 12 * ssFactor * nominalFactor
      : 0;

    const spending = row.expenses;

    // Health premiums: pre-medicare between retirement and 65, medicare after 65
    let healthPremiums = 0;
    if (age >= targetRetirementAge && inputs.enableHealthcareModel !== false) {
      if (age < 65) {
        healthPremiums = preMedicarePremium * nominalFactor;
      } else {
        healthPremiums = medicarePremium * nominalFactor;
      }
    }

    const withdrawals = row.withdrawals;
    const endingPortfolio = row.portfolio;

    const activeReturnRate = (age - 1) >= targetRetirementAge ? postRetirementReturn : preRetirementReturn;
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
}

// Calculates peak net worth from yearly results
export function calculatePeakNetWorth(yearlyResults) {
  let peakNW = { age: 0, value: -Infinity };
  yearlyResults.forEach(row => {
    if (row.netWorth > peakNW.value) {
      peakNW = { age: row.age, value: row.netWorth };
    }
  });
  return peakNW;
}

// Prints the debug table on assertion failures
export function printDiagnosticsTable(yearlyResults) {
  console.log('\nFailure Diagnostics (Ages 63-70):');
  console.table(
    yearlyResults
      .filter(row => row.age >= 63 && row.age <= 70)
      .map(row => ({
        age: row.age,
        startingPortfolio: Math.round(row.startingPortfolio),
        salaryIncome: Math.round(row.salaryIncome),
        socialSecurityIncome: Math.round(row.socialSecurityIncome),
        spending: Math.round(row.spending),
        healthPremiums: Math.round(row.healthPremiums),
        withdrawals: Math.round(row.withdrawals),
        investmentGrowth: Math.round(row.investmentGrowth),
        endingPortfolio: Math.round(row.endingPortfolio),
        netWorth: Math.round(row.netWorth)
      }))
  );
}
