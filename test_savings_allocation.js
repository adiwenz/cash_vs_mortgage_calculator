import { describe, test, expect } from 'vitest';
import { runFireSimulation, getProfileFromInputs, getEventsFromInputs, buildSimulationDebugSnapshot } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Savings Allocation Engine', () => {
  test('allocations are correctly routed to respective accounts', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 50000,
      includeTaxes: false,
      hasCustomizedSavingsAllocation: true,
      assets: {
        cash: 10000,
        emergencyFund: 5000,
        brokerage: 10000,
        trad401k: 0,
        tradIra: 0,
        rothIra: 0,
        hsa: 0,
        other: 0
      },
      budgetDetails: {
        savings: {
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
        },
        partnerSavings: {
          trad401k: 0,
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
        expenses: {
          housing: 1500,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 766.666666666667 // Total expenses = 4166.67/mo (50000/yr)
        }
      }
    };

    const results = runFireSimulation(inputs);
    const firstYearLog = results.nominalData[0];
    const actual = firstYearLog.actualContributions;

    expect(actual).toBeDefined();
    expect(actual.trad401k).toBe(200 * 12);
    expect(actual.rothIra).toBe(100 * 12);
    expect(actual.hsa).toBe(50 * 12);
    expect(actual.checking).toBe(100 * 12);
    expect(actual.hysa).toBe(100 * 12);
    expect(actual.emergency).toBe(75 * 12);

    // Verify balances grew correctly after contributions
    const snapshot = buildSimulationDebugSnapshot(inputs, getProfileFromInputs(inputs), getEventsFromInputs(inputs), results, results.nominalData);
    const y0Balances = snapshot.accountBalances.yearlyBalances[0];

    // Starting cash was 10000. Checking contribution was 1200. HYSA contribution was 1200. TotalCash = 10000 + 2400 = 12400.
    // Plus interest growth (approx 7% pre-retirement rate).
    // Let's check that the balances are greater than starting balances by at least the contributions.
    expect(y0Balances.trad401k).toBeGreaterThanOrEqual(2400);
    expect(y0Balances.rothIra).toBeGreaterThanOrEqual(1200);
    expect(y0Balances.hsa).toBeGreaterThanOrEqual(600);
    expect(y0Balances.cash).toBeGreaterThanOrEqual(12400);
    expect(y0Balances.emergencyFund).toBeGreaterThanOrEqual(5900);
  });

  test('allocations scale down proportionally under constraint', () => {
    // Expected monthly savings = $2000/mo ($24000/yr)
    // But income is $60000 and expenses are $50000, so gross surplus is $10000/yr.
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 60000,
      simpleExpenses: 50000,
      includeTaxes: false,
      hasCustomizedSavingsAllocation: true,
      budgetDetails: {
        savings: {
          trad401k: 1000,
          rothIra: 1000,
          tradIra: 0,
          hsa: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 4166.666666666667,
          utilities: 0,
          food: 0,
          diningOut: 0,
          transportation: 0,
          healthcare: 0,
          leisure: 0,
          misc: 0
        }
      }
    };

    const results = runFireSimulation(inputs);
    const firstYearLog = results.nominalData[0];
    const actual = firstYearLog.actualContributions;

    // Gross surplus is 10000. Expected pre-tax is 12000.
    // Pre-tax is scaled down to 10000, leaving netSurplus = 0.
    // Roth IRA (post-tax) should be 0.
    expect(actual.trad401k).toBe(10000);
    expect(actual.rothIra).toBe(0);
  });

  test('debt paydown spillover goes to brokerage', () => {
    // Starting debt is 1000. Allocation is 200/mo (2400/yr) to debt paydown.
    // Actual debt payment should be capped at 1000, and remaining 1400 should go to brokerage.
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 50000,
      includeTaxes: false,
      hasCustomizedSavingsAllocation: true,
      debtList: [
        {
          id: 'loan-1',
          name: 'Small Loan',
          balance: 1000,
          interestRate: 0,
          payment: 0,
          frequency: 'monthly'
        }
      ],
      budgetDetails: {
        savings: {
          trad401k: 0,
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          brokerage: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 200, // $2400/yr target
          other: 0
        },
        expenses: {
          housing: 4166.666666666667
        }
      }
    };

    const results = runFireSimulation(inputs);
    const firstYearLog = results.nominalData[0];
    const actual = firstYearLog.actualContributions;

    expect(actual.debt).toBe(1000);
    expect(actual.brokerage).toBeCloseTo(1400, -1); // 1400 spillover, leftover surplus goes to cash under priority routing
  });

  test('mismatch warnings are correctly compiled', () => {
    // Set up a scenario where actual savings is constrained (deficit spending)
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 40000,
      simpleExpenses: 50000,
      includeTaxes: false,
      hasCustomizedSavingsAllocation: true,
      budgetDetails: {
        savings: {
          trad401k: 200,
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
        expenses: {
          housing: 4166
        }
      }
    };

    const results = runFireSimulation(inputs);
    const snapshot = buildSimulationDebugSnapshot(inputs, getProfileFromInputs(inputs), getEventsFromInputs(inputs), results, results.nominalData);
    
    expect(snapshot.savingsAllocations.warnings.length).toBeGreaterThan(0);
    const hasTotalWarning = snapshot.savingsAllocations.warnings.some(w => w.includes('Total monthly savings mismatch'));
    const hasAccountWarning = snapshot.savingsAllocations.warnings.some(w => w.includes('Traditional 401(k) mismatch'));
    expect(hasTotalWarning).toBe(true);
    expect(hasAccountWarning).toBe(true);
  });
});
