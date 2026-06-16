// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { runFireSimulation, getNormalizedPhases } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Budget Phases Financial States', () => {
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
    baseInputs.incomeList = [];
    baseInputs.spendingPhases = [];
    baseInputs.debtList = [];
    baseInputs.currentConditions = [];
    baseInputs.currentAge = 35;
    baseInputs.targetRetirementAge = 65;
    baseInputs.lifeExpectancy = 85;
  });

  test('boundaries are generated correctly from overlapping events and intervals are generated between adjacent boundaries', () => {
    // Add marriage at 40
    baseInputs.lifeEvents.push({
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      age: 40,
      spouseIncome: 50000,
      savingsRate: 10
    });

    // Add child at 42 (childcare 42 to 42+18=60)
    baseInputs.lifeEvents.push({
      id: 'child-1',
      type: 'haveChild',
      enabled: true,
      age: 42,
      birthAge: 42
    });

    // Add debt from 35 paying off at 45
    baseInputs.lifeEvents.push({
      id: 'loan-1',
      type: 'borrowing',
      borrowingType: 'studentLoan',
      name: 'Student Loan',
      balance: 12000,
      interestRate: 0,
      minPayment: 100,
      startAge: 35,
      isExisting: true,
      enabled: true
    });

    const phases = getNormalizedPhases(baseInputs);
    
    // Boundaries expected: 35 (current), 40 (marriage), 42 (child), 45 (debt payoff), 60 (childcare end), 65 (retirement), 85 (life expectancy)
    // Ticks/intervals between them: 35-40, 40-42, 42-45, 45-60, 60-65, 65-85
    const startAges = phases.map(p => p.startAge);
    expect(startAges).toEqual([35, 40, 42, 45, 60, 65]);
    
    const endAges = phases.map(p => p.endAge);
    expect(endAges).toEqual([40, 42, 45, 60, 65, 85]);
  });

  test('active events are resolved correctly and overlapping childcare + debt creates one combined budget interval', () => {
    // Child starts at 40 (ends at 58)
    baseInputs.lifeEvents.push({
      id: 'child-1',
      type: 'haveChild',
      enabled: true,
      age: 40,
      birthAge: 40
    });

    // Debt starts at 45 (ends at 50)
    baseInputs.lifeEvents.push({
      id: 'debt-1',
      type: 'borrowing',
      borrowingType: 'studentLoan',
      name: 'Student Loan',
      balance: 6000,
      interestRate: 0,
      minPayment: 100,
      startAge: 45,
      payoffAge: 50,
      isExisting: false,
      enabled: true
    });

    const phases = getNormalizedPhases(baseInputs);

    // Expect intervals:
    // 35-40: Working (no child, no debt)
    // 40-45: Working + Childcare (child active)
    // 45-50: Working + Childcare + Student Loan (child and debt active)
    // 50-58: Working + Childcare (child active, debt ended)
    // 58-65: Working (child ended, debt ended)
    // 65-85: Retired (retirement active)
    
    const phase45_50 = phases.find(p => p.startAge === 45);
    expect(phase45_50).toBeDefined();
    expect(phase45_50.activeEvents).toContain('child-1');
    expect(phase45_50.activeEvents).toContain('debt-1');
    expect(phase45_50.label).toContain('Childcare');
    expect(phase45_50.label).toContain('Student Loan');

    // Debt payoff creates a new interval without the debt payment
    const phase50_58 = phases.find(p => p.startAge === 50);
    expect(phase50_58).toBeDefined();
    expect(phase50_58.activeEvents).toContain('child-1');
    expect(phase50_58.activeEvents).not.toContain('debt-1');
    expect(phase50_58.expenses.debt_debt_1).toBeUndefined();
  });

  test('retirement and Social Security create new intervals', () => {
    baseInputs.lifeEvents.push({
      id: 'ss-1',
      type: 'socialSecurity',
      name: 'Social Security',
      enabled: true,
      claimingAge: 70,
      monthlyBenefit: 2000,
      inflationAdjusted: true
    });

    const phases = getNormalizedPhases(baseInputs);

    // Intervals expected around retirement:
    // 35-65: Working
    // 65-70: Retired
    // 70-85: Retired + Social Security
    
    const phase65_70 = phases.find(p => p.startAge === 65);
    expect(phase65_70).toBeDefined();
    expect(phase65_70.label).toBe('Retired');
    expect(phase65_70.activeEvents).toContain('retire-1');
    expect(phase65_70.activeEvents).not.toContain('ss-1');

    const phase70_85 = phases.find(p => p.startAge === 70);
    expect(phase70_85).toBeDefined();
    expect(phase70_85.label).toBe('Retired + Social Security');
    expect(phase70_85.activeEvents).toContain('retire-1');
    expect(phase70_85.activeEvents).toContain('ss-1');
  });

  test('user overrides survive regeneration when possible (matching equivalent active event combinations)', () => {
    baseInputs.lifeEvents.push({
      id: 'child-1',
      type: 'haveChild',
      enabled: true,
      age: 40,
      birthAge: 40
    });

    // Save override for child interval
    baseInputs.budgetDetails = {
      phases: [
        {
          id: 'childcare_40_58',
          type: 'childcare',
          startAge: 40,
          endAge: 58,
          activeEventsKey: 'child-1', // key representing the active event combo
          expenses: {
            housing: 2000,
            leisure: 999
          },
          savings: {}
        }
      ]
    };

    let phases = getNormalizedPhases(baseInputs);
    let childPhase = phases.find(p => p.startAge === 40);
    expect(childPhase.expenses.leisure).toBe(999);

    // Drag the child birthAge to 42. Intervals should regenerate.
    // Child interval shifts to 42-60.
    const childEvent = baseInputs.lifeEvents.find(e => e.id === 'child-1');
    childEvent.age = 42;
    childEvent.birthAge = 42;

    phases = getNormalizedPhases(baseInputs);
    childPhase = phases.find(p => p.startAge === 42);
    
    // Override should survive because the active events key ('child-1') matches
    expect(childPhase).toBeDefined();
    expect(childPhase.expenses.leisure).toBe(999);
  });

  test('simulation uses interval budgets', () => {
    baseInputs.simpleIncome = 100000;
    baseInputs.simpleExpenses = 50000;
    baseInputs.includeTaxes = false;

    // Set custom override in Working phase (35-65)
    baseInputs.budgetDetails = {
      phases: [
        {
          id: 'workSave_35_65',
          type: 'workSave',
          startAge: 35,
          endAge: 65,
          expenses: {
            housing: 1000,
            utilities: 200,
            food: 300,
            transportation: 200,
            healthcare: 100,
            leisure: 100,
            diningOut: 100,
            misc: 100
          },
          savings: {
            brokerage: 4000
          }
        }
      ]
    };

    const results = runFireSimulation(baseInputs);
    const nominalAt40 = results.nominalData.find(d => d.age === 40);
    
    // Expenses at 40 should be non-debt expenses from phase + tax/min debt.
    // Base monthly non-debt = 2100. Annual = 25200.
    // With inflation 3% grown for 5 years: 25200 * 1.03^5 = 29213.
    expect(nominalAt40.expenses).toBeCloseTo(29213, -2);
  });
});
