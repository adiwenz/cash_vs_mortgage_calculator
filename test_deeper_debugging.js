import { describe, test, expect } from 'vitest';
import { runFireSimulation, getProfileFromInputs, getEventsFromInputs, buildSimulationDebugSnapshot } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Deeper Debugging and Brokerage Audit', () => {
  test('Acceptance Check Scenario: brokerage savings = 0, starting brokerage = 5000', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7, // 7% returns
      postRetirementReturn: 5,
      inflationRate: 0, // 0% inflation to simplify return tracing
      includeTaxes: false, // disable taxes for simplicity
      assets: {
        cash: 1000,
        emergencyFund: 1000,
        brokerage: 5000,
        trad401k: 1000,
        tradIra: 0,
        rothIra: 1000,
        hsa: 500,
        other: 0
      },
      budgetDetails: {
        hsaCoverage: 'single',
        defaultTemplate: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
        income: 5000, // $5,000/mo income = $60,000/yr
        expenses: { housing: 2000 },
        savings: {
          brokerage: 0,
          checking: 100,
          hysa: 100,
          emergency: 75,
          trad401k: 200,
          rothIra: 100,
          hsa: 50,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {},
        phases: [
          {
            id: 'work-1',
            type: 'workSave',
            name: 'Working Phase',
            startAge: 35,
            endAge: 65,
            income: 5000,
            savingsAllocMode: 'fixed',
            budgetScalingMode: 'lifestyle',
            incomeAtCreation: 60000,
            originalIncome: 5000,
            originalExpenses: { housing: 2000 },
            originalSavings: {
              brokerage: 0,
              checking: 100,
              hysa: 100,
              emergency: 75,
              trad401k: 200,
              rothIra: 100,
              hsa: 50
            },
            originalPartnerSavings: {},
            expenseRatio: 0.4,
            savingsRatio: 0.125,
            categoryRatios: {
              housing: 0.4,
              savings_checking: 0.02,
              savings_hysa: 0.02,
              savings_emergency: 0.015,
              savings_trad401k: 0.04,
              savings_rothIra: 0.02,
              savings_hsa: 0.01
            },
            expenses: { housing: 2000 },
            savings: {
              brokerage: 0,
              checking: 100,
              hysa: 100,
              emergency: 75,
              trad401k: 200,
              rothIra: 100,
              hsa: 50
            },
            partnerSavings: {}
          }
        ]
      },
      lifeEvents: [
        {
          id: 'retire-1',
          type: 'retire',
          name: 'Retirement',
          enabled: true,
          age: 65,
          spendingPercent: 70
        }
      ],
      allocationRules: [] // no allocation rules to avoid surplus fallback redirection
    };

    const norm = getProfileFromInputs(inputs);
    const evs = getEventsFromInputs(inputs);
    const res = runFireSimulation(inputs);
    const yearlyTimeline = res.nominalData;

    const snapshot = buildSimulationDebugSnapshot(inputs, norm, evs, res, yearlyTimeline);

    // Assert that we have the new debug fields in computedTimeline for every year
    snapshot.yearlyTimeline.forEach(row => {
      expect(row.contributionRoutingSource).toBeDefined();
      expect(row.ignoredAllocationRules).toBeDefined();
      expect(row.annualContributionsByAccount).toBeDefined();
      expect(row.growthByAccount).toBeDefined();
      expect(row.startBalanceByAccount).toBeDefined();
      expect(row.endBalanceByAccount).toBeDefined();
      expect(row.brokerageAudit).toBeDefined();
      expect(row.budgetScaling).toBeDefined();

      // For every year before retirement (working phase)
      if (row.age < 65) {
        const audit = row.brokerageAudit;
        expect(audit.explicitContribution).toBe(0);
        expect(audit.allocationRuleContribution).toBe(0);
        expect(audit.surplusFallbackContribution).toBe(0);
        expect(audit.transferContribution).toBe(0);

        // Expected Ending Balance = startingBalance + growth (where growth = startingBalance * returnRate in year > 0)
        const returnRate = row.year === 0 ? 0.00 : 0.07;
        const expectedEnd = audit.startingBalance * (1 + returnRate);
        expect(Math.abs(audit.endingBalance - expectedEnd)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(audit.discrepancy)).toBeLessThanOrEqual(0.01);
      }
    });
  });

  test('Routing Conflict Warning when both phase savings and allocationRules exist', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      allocationRules: [
        {
          id: 'alloc-surplus',
          destination: 'brokerage',
          type: 'percentSurplus',
          value: 100,
          frequency: 'yearly',
          priority: 1
        }
      ],
      budgetDetails: {
        phases: [
          {
            id: 'work-1',
            type: 'workSave',
            name: 'Working Phase',
            startAge: 35,
            endAge: 65,
            income: 5000,
            savingsAllocMode: 'fixed',
            budgetScalingMode: 'lifestyle',
            incomeAtCreation: 60000,
            expenses: {},
            savings: { checking: 100 }, // explicit savings
            partnerSavings: {}
          }
        ]
      }
    };

    const norm = getProfileFromInputs(inputs);
    const evs = getEventsFromInputs(inputs);
    const res = runFireSimulation(inputs);
    const yearlyTimeline = res.nominalData;

    const snapshot = buildSimulationDebugSnapshot(inputs, norm, evs, res, yearlyTimeline);

    // Verify warnings
    const workYear = snapshot.yearlyTimeline.find(row => row.age === 35);
    expect(workYear.routingWarning).toBe("Phase savings are active; allocationRules ignored this year.");
    expect(workYear.ignoredAllocationRules).toContain("alloc-surplus");
  });
});
