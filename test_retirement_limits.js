import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS as ORIGINAL_DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
const DEFAULT_FIRE_INPUTS = {
  ...ORIGINAL_DEFAULT_FIRE_INPUTS,
  inflationRate: 0,
  incomeList: ORIGINAL_DEFAULT_FIRE_INPUTS.incomeList.map(inc => ({ ...inc, growthRate: 0 }))
};

describe('IRS Retirement Contribution Limits', () => {

  test('Case 1: Contributions exactly at limit', () => {
    // 401k user limit at age 35 is 23500/yr. Monthly = 23500 / 12 = 1958.33.
    // Let's set 401k contribution exactly to 23500/yr (approx $1958.33/mo)
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 150000,
      simpleExpenses: 50000,
      includeTaxes: false,
      assets: {
        cash: 10000,
        emergencyFund: 5000,
        brokerage: 10000,
        trad401k: 0
      },
      budgetDetails: {
        savings: {
          trad401k: 1958.33, // exactly 23500/year (1958.33 * 12 = 23499.96)
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        expenses: { housing: 1000 }
      }
    };

    const results = runFireSimulation(inputs);
    // Should have 0 years with limits reached and 0 totalRedirectedSavings
    expect(results.yearsWithLimitsReached).toBe(0);
    expect(results.totalRedirectedSavings).toBe(0);
  });

  test('Case 2 & 5: Contributions exceeding limit and excess redirected to brokerage (default)', () => {
    // Let's contribute $3000/mo ($36000/yr) to trad401k. Limit is 23500. Excess = 12500/yr.
    // Since brokerage is present in assets (or default), excess should redirect to brokerage.
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 150000,
      simpleExpenses: 50000,
      includeTaxes: false,
      assets: {
        cash: 10000,
        emergencyFund: 5000,
        brokerage: 10000,
        trad401k: 0
      },
      budgetDetails: {
        savings: {
          trad401k: 3000, // $36000/yr
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        expenses: { housing: 1000 }
      }
    };

    const results = runFireSimulation(inputs);
    expect(results.yearsWithLimitsReached).toBeGreaterThan(0);
    expect(results.totalRedirectedSavings).toBeGreaterThan(0);
    expect(results.redirectedToCash).toBe(false);

    // Verify debug logs are populated correctly
    expect(results.contributionLimitLogs.length).toBeGreaterThan(0);
    const log = results.contributionLimitLogs[0];
    expect(log.year).toBeDefined();
    expect(log.account).toBe('401k');
    expect(log.excessRedirected).toBeGreaterThan(0);
    expect(log.redirectedTo).toBe('brokerage');
  });

  test('Case 3: Multiple accounts each with separate limits', () => {
    // 401k = $3000/mo ($36000/yr, limit 23500)
    // tradIra = $1000/mo ($12000/yr, limit 7000)
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 45, // run for 10 working years
      lifeExpectancy: 85,
      simpleIncome: 200000,
      simpleExpenses: 50000,
      includeTaxes: false,
      assets: {
        cash: 10000,
        emergencyFund: 5000,
        brokerage: 10000
      },
      budgetDetails: {
        savings: {
          trad401k: 3000,
          tradIra: 1000,
          rothIra: 0,
          hsa: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        expenses: { housing: 1000 }
      }
    };

    const results = runFireSimulation(inputs);
    expect(results.yearsWithLimitsReached).toBeGreaterThan(0);
    
    // Check that both 401k and tradIra limits are logged in debug logs
    const accountsLogged = results.contributionLimitLogs.map(l => l.account);
    expect(accountsLogged).toContain('401k');
    expect(accountsLogged).toContain('traditionalIRA');
  });

  test('Case 4: Catch-up contributions after age 50 (and HSA age 55)', () => {
    // Let's set age to 56. Limit for 401k should be 23500 + 7500 = 31000.
    // If user contributes $2500/mo ($30000/yr), they are under 31000, so NO redirection should happen for 401k.
    // For HSA family: limit is 8550. If age >= 55, catch-up is 1000, limit = 9550.
    // If age is 56 and HSA coverage is family, and they contribute $9000/yr ($750/mo), they are under 9550, so no redirection.
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 56, // age 56
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 150000,
      simpleExpenses: 50000,
      includeTaxes: false,
      filingStatus: 'married',
      budgetFilingStatus: 'married',
      hsaCoverage: 'family',
      budgetHsaCoverage: 'family',
      assets: {
        cash: 10000,
        emergencyFund: 5000,
        brokerage: 10000
      },
      budgetDetails: {
        savings: {
          trad401k: 2500, // $30000/yr (below catchup limit of 31000)
          hsa: 750, // $9000/yr (below family catchup limit of 9550)
          rothIra: 0,
          tradIra: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        expenses: { housing: 1000 }
      }
    };

    const results = runFireSimulation(inputs);
    // There should be no redirection at age 56 for these amounts because of catch-up limits!
    expect(results.yearsWithLimitsReached).toBe(0);
    expect(results.totalRedirectedSavings).toBe(0);
  });

  test('Case 6: Excess redirected to cash when brokerage absent', () => {
    // If assets.brokerage is undefined, excess should redirect to cash/checking.
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 40,
      lifeExpectancy: 85,
      simpleIncome: 150000,
      simpleExpenses: 50000,
      includeTaxes: false,
      assets: {
        cash: 10000,
        emergencyFund: 5000
      },
      budgetDetails: {
        savings: {
          trad401k: 3000, // $36000/yr
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        expenses: { housing: 1000 }
      }
    };

    // Make sure brokerage is deleted/absent in assets
    delete inputs.assets.brokerage;

    const results = runFireSimulation(inputs);
    expect(results.yearsWithLimitsReached).toBeGreaterThan(0);
    expect(results.totalRedirectedSavings).toBeGreaterThan(0);
    expect(results.redirectedToCash).toBe(true);

    const log = results.contributionLimitLogs[0];
    expect(log.redirectedTo).toBe('cash');
  });

  test('Case 7: Contributions reset correctly on January 1', () => {
    // Let's check that inside the monthly simulation loop, contributions do not leak across years.
    // For a user contributing exactly the limit of $23500 to 401k each year:
    // If it resets on January 1, the total contribution in year 1 is exactly 23500 and year 2 is exactly 23500, with 0 redirection.
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 37, // 2 working years
      lifeExpectancy: 85,
      simpleIncome: 150000,
      simpleExpenses: 50000,
      includeTaxes: false,
      assets: {
        cash: 10000,
        emergencyFund: 5000,
        brokerage: 10000
      },
      budgetDetails: {
        savings: {
          trad401k: 1958.33, // exactly 23500/year
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        expenses: { housing: 1000 }
      }
    };

    const results = runFireSimulation(inputs);
    // Reset should be correct, so no limits should be reached across multiple years.
    expect(results.yearsWithLimitsReached).toBe(0);
  });

  test('Case 8: Retirement projections remain stable when limits are enforced', () => {
    // Projections should run to completion and not error or crash.
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 200000,
      simpleExpenses: 50000,
      includeTaxes: true,
      assets: {
        cash: 10000,
        emergencyFund: 5000,
        brokerage: 10000,
        trad401k: 50000,
        rothIra: 20000
      },
      budgetDetails: {
        savings: {
          trad401k: 4000, // over limit
          rothIra: 1500, // over limit
          tradIra: 0,
          hsa: 1000, // over limit
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        expenses: { housing: 1000 }
      }
    };

    const results = runFireSimulation(inputs);
    expect(results.nominalData.length).toBeGreaterThanOrEqual(50); // 85 - 35 = 50 years
    expect(results.retirementReadyAge).toBeDefined();
    const finalYear = results.nominalData[results.nominalData.length - 1];
    expect(finalYear.netWorth).toBeGreaterThan(0);
  });

});
