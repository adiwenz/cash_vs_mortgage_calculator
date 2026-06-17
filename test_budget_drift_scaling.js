import { describe, test, expect, beforeEach } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Budget Drift and Scaling Modes', () => {
  let baseInputs;

  beforeEach(() => {
    baseInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    baseInputs.lifeEvents = [
      {
        id: 'retire-1',
        type: 'retire',
        name: 'Retirement',
        enabled: true,
        age: 65,
        spendingPercent: 70
      }
    ];
    baseInputs.householdMembers = [];
    baseInputs.spendingPhases = [];
    baseInputs.debtList = [];
    baseInputs.currentConditions = [];
    baseInputs.currentAge = 35;
    baseInputs.targetRetirementAge = 65;
    baseInputs.lifeExpectancy = 85;
    baseInputs.includeTaxes = false; // Disable taxes for isolated testing of scaling logic
    baseInputs.inflationRate = 0.0; // Disable inflation to isolate scaling logic
    baseInputs.expectedReturn = 0.07; // Constant return rate
    baseInputs.postRetirementReturn = 0.05;

    // Define main income with 0% growth to keep tests simple and predictable
    baseInputs.incomeList = [
      {
        id: 'simple-inc',
        name: 'Salary / Main Income',
        amount: 50004,
        growthRate: 0.0,
        startAge: 35,
        endAge: 65,
        enabled: true
      }
    ];

    // Zero out starting balances to easily trace cash accumulation
    baseInputs.assets = {
      cash: 0,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      other: 0
    };
  });

  test('Test 1: Lifestyle-Based Phase Ratios (50k -> 100k)', () => {
    baseInputs.simpleIncome = 50004;
    baseInputs.simpleExpenses = 40008;
    baseInputs.budgetDetails = {
      hsaCoverage: 'single',
      defaultTemplate: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
      income: 4167,
      expenses: { housing: 3334 },
      savings: { brokerage: 833 },
      partnerSavings: {},
      phases: [
        {
          id: 'workSave_35_45',
          type: 'workSave',
          name: 'Current Life',
          startAge: 35,
          endAge: 45,
          income: 4167,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'lifestyle',
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        },
        {
          id: 'careerChange_45_65',
          type: 'careerChange',
          name: 'Higher Income Years',
          startAge: 45,
          endAge: 65,
          income: 8334,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'lifestyle',
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        }
      ]
    };

    // Add career change event at age 45 where income becomes 100008
    baseInputs.lifeEvents.push({
      id: 'career-change-1',
      type: 'incomeItem',
      name: 'Salary Bump',
      amount: 100008,
      frequency: 'yearly',
      startAge: 45,
      endAge: 65,
      growthRate: 0.0,
      enabled: true
    });

    const results = runFireSimulation(baseInputs);
    const timeline = results.nominalData;

    // Ages 35-44: Income is 50004, Expenses are 40008, Savings are 9996, multiplier is 1.0, drift is 0
    for (let age = 35; age < 45; age++) {
      const row = timeline.find(r => r.age === age);
      expect(row).toBeDefined();
      expect(row.currentIncome).toBe(50004);
      expect(row.expenses).toBe(40008);
      expect(row.savings).toBe(9996);
      expect(row.scalingMultiplier).toBe(1.0);
      expect(row.budgetDrift).toBe(0);
    }

    // Ages 45-64: Income is 100008, Expenses are 80016 (scaled 2x), Savings are 19992 (scaled 2x), multiplier is 2.0, drift is 0
    for (let age = 45; age < 65; age++) {
      const row = timeline.find(r => r.age === age);
      expect(row).toBeDefined();
      expect(row.currentIncome).toBe(100008);
      expect(row.expenses).toBe(80016);
      expect(row.savings).toBe(19992);
      expect(row.scalingMultiplier).toBe(2.0);
      expect(row.budgetDrift).toBe(0);
    }
  });

  test('Test 2: Balanced budget on income changes (50k -> 150k)', () => {
    baseInputs.simpleIncome = 50004;
    baseInputs.simpleExpenses = 40008;
    baseInputs.budgetDetails = {
      hsaCoverage: 'single',
      defaultTemplate: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
      income: 4167,
      expenses: { housing: 3334 },
      savings: { brokerage: 833 },
      partnerSavings: {},
      phases: [
        {
          id: 'workSave_35_45',
          type: 'workSave',
          name: 'Current Life',
          startAge: 35,
          endAge: 45,
          income: 4167,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'lifestyle',
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        },
        {
          id: 'careerChange_45_65',
          type: 'careerChange',
          name: 'Higher Income Years',
          startAge: 45,
          endAge: 65,
          income: 12501,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'lifestyle',
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        }
      ]
    };

    // Add career change event at age 45 where income becomes 150012
    baseInputs.lifeEvents.push({
      id: 'career-change-1',
      type: 'incomeItem',
      name: 'Big Promotion',
      amount: 150012,
      frequency: 'yearly',
      startAge: 45,
      endAge: 65,
      growthRate: 0.0,
      enabled: true
    });

    const results = runFireSimulation(baseInputs);
    const timeline = results.nominalData;

    // Ages 45-64: Income is 150012, Expenses are 120024 (scaled 3x), Savings are 29988 (scaled 3x), multiplier is 3.0, drift is 0
    for (let age = 45; age < 65; age++) {
      const row = timeline.find(r => r.age === age);
      expect(row).toBeDefined();
      expect(row.currentIncome).toBe(150012);
      expect(row.expenses).toBe(120024);
      expect(row.savings).toBe(29988);
      expect(row.scalingMultiplier).toBe(3.0);
      expect(row.budgetDrift).toBe(0);
    }
  });

  test('Test 3: Fixed-Dollar Budget Mode (50k -> 100k)', () => {
    baseInputs.simpleIncome = 50004;
    baseInputs.simpleExpenses = 40008;
    baseInputs.budgetDetails = {
      hsaCoverage: 'single',
      defaultTemplate: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
      income: 4167,
      expenses: { housing: 3334 },
      savings: { brokerage: 833 },
      partnerSavings: {},
      phases: [
        {
          id: 'workSave_35_45',
          type: 'workSave',
          name: 'Current Life',
          startAge: 35,
          endAge: 45,
          income: 4167,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'fixed', // Fixed scaling mode
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        },
        {
          id: 'careerChange_45_65',
          type: 'careerChange',
          name: 'Higher Income Years',
          startAge: 45,
          endAge: 65,
          income: 8334,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'fixed', // Fixed scaling mode
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        }
      ]
    };

    baseInputs.lifeEvents.push({
      id: 'career-change-1',
      type: 'incomeItem',
      name: 'Salary Bump',
      amount: 100008,
      frequency: 'yearly',
      startAge: 45,
      endAge: 65,
      growthRate: 0.0,
      enabled: true
    });

    const results = runFireSimulation(baseInputs);
    const timeline = results.nominalData;

    // Ages 45-64: Income is 100008.
    // Under fixed mode with 0% inflation:
    // Expenses remain fixed at 40008.
    // Savings remain fixed at 9996.
    // Drift is 100008 - (40008 + 9996) = 50004.
    // Multiplier is 1.0.
    for (let age = 45; age < 65; age++) {
      const row = timeline.find(r => r.age === age);
      expect(row).toBeDefined();
      expect(row.currentIncome).toBe(100008);
      expect(row.expenses).toBe(40008);
      expect(row.savings).toBe(9996);
      expect(row.scalingMultiplier).toBe(1.0);
      expect(row.budgetDrift).toBe(50004);
    }
  });

  test('Test 4: No hidden cash accumulation in lifestyle mode', () => {
    baseInputs.simpleIncome = 50004;
    baseInputs.simpleExpenses = 40008;
    baseInputs.budgetDetails = {
      hsaCoverage: 'single',
      defaultTemplate: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
      income: 4167,
      expenses: { housing: 3334 },
      savings: { brokerage: 833 },
      partnerSavings: {},
      phases: [
        {
          id: 'workSave_35_45',
          type: 'workSave',
          name: 'Current Life',
          startAge: 35,
          endAge: 45,
          income: 4167,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'lifestyle',
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        },
        {
          id: 'careerChange_45_65',
          type: 'careerChange',
          name: 'Higher Income Years',
          startAge: 45,
          endAge: 65,
          income: 8334,
          savingsAllocMode: 'fixed',
          budgetScalingMode: 'lifestyle',
          incomeAtCreation: 50004,
          originalIncome: 4167,
          originalExpenses: { housing: 3334 },
          originalSavings: { brokerage: 833 },
          originalPartnerSavings: {},
          expenseRatio: 0.8,
          savingsRatio: 0.2,
          categoryRatios: { housing: 0.8, savings_brokerage: 0.2 },
          expenses: { housing: 3334 },
          savings: { brokerage: 833 },
          partnerSavings: {}
        }
      ]
    };

    baseInputs.lifeEvents.push({
      id: 'career-change-1',
      type: 'incomeItem',
      name: 'Salary Bump',
      amount: 100008,
      frequency: 'yearly',
      startAge: 45,
      endAge: 65,
      growthRate: 0.0,
      enabled: true
    });

    const results = runFireSimulation(baseInputs);
    const timeline = results.nominalData;

    // Check cashBalance in ages 35-64. It should be close to 0 because 100% of savings goes to brokerage.
    for (let age = 35; age < 65; age++) {
      const row = timeline.find(r => r.age === age);
      expect(row).toBeDefined();
      expect(row.cashBalance).toBeCloseTo(0, 5);
    }
  });
});
