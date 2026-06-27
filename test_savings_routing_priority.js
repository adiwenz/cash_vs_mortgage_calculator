import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS as ORIGINAL_DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
const DEFAULT_FIRE_INPUTS = {
  ...ORIGINAL_DEFAULT_FIRE_INPUTS,
  inflationRate: 0,
  incomeList: ORIGINAL_DEFAULT_FIRE_INPUTS.incomeList.map(inc => ({ ...inc, growthRate: 0 }))
};

describe('Savings Allocation Routing Priority Regression Tests', () => {
  test('1. 100% checking does not contribute to brokerage', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      hasCustomizedSavingsAllocation: true,
      currentAge: 35,
      simpleIncome: 56004,
      simpleExpenses: 48504,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7,
      postRetirementReturn: 5,
      inflationRate: 0,
      assets: {
        ...DEFAULT_FIRE_INPUTS.assets,
        brokerage: 5000,
        cash: 0,
        emergencyFund: 0
      },
      budgetDetails: {
        savings: {
          checking: 625, // $7,500/yr to Checking
          brokerage: 0,
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {
          checking: 0,
          brokerage: 0,
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 2000,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        }
      }
    };

    const results = runFireSimulation(inputs);
    const timeline = results.nominalData;

    // Verify each year prior to retirement age (35 to 64)
    timeline.forEach(log => {
      if (log.age < 65) {
        expect(log.contributionRoutingSource).toBe('phase_fixed_savings');
        expect(log.ignoredAllocationRules).toContain('alloc-surplus');
        expect(log.brokerageContribution).toBe(0);
        expect(log.annualContributionsByAccount.brokerage).toBe(0);
        expect(log.annualContributionsByAccount.checking).toBe(7500);
      }
    });

    // Verify brokerage balance at age 65 grows only from starting balance and investment returns
    const logAt65 = timeline.find(l => l.age === 65);
    expect(logAt65).toBeDefined();
    // 5000 * Math.pow(1.07, 30) should be around 38061
    expect(logAt65.brokerageBalance).toBeCloseTo(38061.27, -2);
  });

  test('2. 100% brokerage receives contributions', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      hasCustomizedSavingsAllocation: true,
      currentAge: 35,
      simpleIncome: 56004,
      simpleExpenses: 48504,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7,
      postRetirementReturn: 5,
      inflationRate: 0,
      assets: {
        ...DEFAULT_FIRE_INPUTS.assets,
        brokerage: 0,
        cash: 0,
        emergencyFund: 0
      },
      budgetDetails: {
        savings: {
          checking: 0,
          brokerage: 625, // $7,500/yr to Brokerage
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {
          checking: 0,
          brokerage: 0,
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 2000,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        }
      }
    };

    const results = runFireSimulation(inputs);
    const timeline = results.nominalData;

    timeline.forEach(log => {
      if (log.age < 65) {
        expect(log.contributionRoutingSource).toBe('phase_fixed_savings');
        expect(log.ignoredAllocationRules).toContain('alloc-surplus');
        expect(log.brokerageContribution).toBe(7500);
        expect(log.annualContributionsByAccount.brokerage).toBe(7500);
        expect(log.annualContributionsByAccount.checking).toBe(0);
      }
    });
  });

  test('3. No double counting', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      hasCustomizedSavingsAllocation: true,
      currentAge: 35,
      simpleIncome: 56004,
      simpleExpenses: 48504,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7,
      postRetirementReturn: 5,
      inflationRate: 0,
      assets: {
        ...DEFAULT_FIRE_INPUTS.assets,
        brokerage: 5000,
        cash: 0,
        emergencyFund: 0
      },
      budgetDetails: {
        savings: {
          checking: 625,
          brokerage: 0,
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {
          checking: 0,
          brokerage: 0,
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 2000,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        }
      }
    };

    const results = runFireSimulation(inputs);
    const timeline = results.nominalData;

    timeline.forEach(log => {
      if (log.age < 65) {
        const totalContributions = Object.values(log.annualContributionsByAccount).reduce((sum, val) => sum + val, 0);
        // Total contributions should equal checking (7500) and not check + surplus (double-routing)
        expect(totalContributions).toBe(7500);
      }
    });
  });

  test('4. Allocation rules are fallback only', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      hasCustomizedSavingsAllocation: true,
      currentAge: 35,
      simpleIncome: 56004,
      simpleExpenses: 48504,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7,
      postRetirementReturn: 5,
      inflationRate: 0,
      assets: {
        ...DEFAULT_FIRE_INPUTS.assets,
        brokerage: 5000,
        cash: 0,
        emergencyFund: 0
      },
      // Delete budgetDetails.savings or set it to all 0s so there is no phase savings
      budgetDetails: {
        savings: {
          checking: 0,
          brokerage: 0,
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {
          checking: 0,
          brokerage: 0,
          hysa: 0,
          emergency: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 2000,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        }
      },
      // Enable allocation rules surplus to route to brokerage
      allocationRules: [
        {
          id: 'alloc-surplus',
          destination: 'brokerage',
          type: 'percentSurplus',
          value: 100,
          frequency: 'yearly',
          priority: 1
        }
      ]
    };

    const results = runFireSimulation(inputs);
    const timeline = results.nominalData;

    timeline.forEach(log => {
      if (log.age < 65) {
        expect(log.contributionRoutingSource).toBe('allocation_rules');
        expect(log.ignoredAllocationRules).toEqual([]);
        // Since savings are 0, surplus (income - expenses - taxes) is routed to brokerage
        expect(log.brokerageContribution).toBeGreaterThan(0);
      }
    });
  });
});
