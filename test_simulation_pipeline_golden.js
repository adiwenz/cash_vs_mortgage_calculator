import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { getMappedDefaultInputs } from './test_helper.js';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  Object.keys(obj).forEach(key => {
    deepFreeze(obj[key]);
  });
  return obj;
}

describe('Simulation Pipeline Golden Tests', () => {
  test('1. Default baseline output shape & key values', () => {
    const inputs = getMappedDefaultInputs();
    
    // Freeze inputs to verify mutation safety
    deepFreeze(inputs);

    const results = runFireSimulation(inputs);

    // Assert top-level output shape
    expect(results).toHaveProperty('retirementReadyAge');
    expect(results).toHaveProperty('fiNumber');
    expect(results).toHaveProperty('retirementOutcome');
    expect(results).toHaveProperty('data');
    expect(results).toHaveProperty('nominalData');
    expect(results).toHaveProperty('incomeList');
    expect(results).toHaveProperty('spendingPhases');
    expect(results).toHaveProperty('contributionLimitLogs');
    expect(results).toHaveProperty('yearsWithLimitsReached');
    expect(results).toHaveProperty('totalRedirectedSavings');
    expect(results).toHaveProperty('redirectedToCash');

    // Assert key values
    expect(typeof results.retirementReadyAge).toBe('number');
    expect(results.retirementReadyAge).toBeGreaterThanOrEqual(30);
    expect(results.retirementReadyAge).toBeLessThanOrEqual(85);
  });

  test('2. Social Security fields still present', () => {
    const inputs = getMappedDefaultInputs();
    inputs.lifeEvents = [
      ...(inputs.lifeEvents || []),
      {
        id: 'ss-evt',
        type: 'socialSecurity',
        enabled: true,
        age: 67,
        monthlyBenefit: 2000,
        useEarnings: false
      }
    ];

    deepFreeze(inputs);

    const results = runFireSimulation(inputs);
    expect(results).toBeDefined();
    expect(results.incomeList).toBeDefined();
  });

  test('3. Childcare phase regeneration still works', () => {
    const inputs = getMappedDefaultInputs();
    inputs.lifeEvents = [
      ...(inputs.lifeEvents || []),
      {
        id: 'child-evt',
        type: 'haveChild',
        enabled: true,
        age: 38,
        birthAge: 38,
        childName: 'Emma',
        includeCollege: false
      }
    ];
    inputs.budgetDetails = {
      ...inputs.budgetDetails,
      income: 5000,
      expenses: { housing: 1500, lifestyle: 1000 },
      childcareBudgets: {
        1: {
          income: 5500,
          expenses: { housing: 1500, lifestyle: 1000, childcare: 800 }
        }
      }
    };

    deepFreeze(inputs);

    const results = runFireSimulation(inputs);
    
    // Check that regenerated incomeList has childcare phase income
    const hasChildcareIncome = results.incomeList.some(inc => inc.id.includes('childcare'));
    const hasChildcareSpend = results.spendingPhases.some(p => p.id.includes('childcare'));
    
    expect(hasChildcareIncome).toBe(true);
    expect(hasChildcareSpend).toBe(true);
  });

  test('4. Inputs are not mutated', () => {
    const inputs = getMappedDefaultInputs();
    const originalInputsStr = JSON.stringify(inputs);

    runFireSimulation(inputs);

    expect(JSON.stringify(inputs)).toBe(originalInputsStr);
  });

  test('5. Regression: Scenario A (Default) matches golden snapshot', () => {
    const inputs = getMappedDefaultInputs();
    const results = runFireSimulation(inputs);
    expect(results.retirementReadyAge).toBe(63);
    expect(results.fiNumber).toBeCloseTo(274479.33, 1);
    expect(results.retirementOutcome).toBe('comfortable');
    const age65Nw = results.data.find(d => d.age === 65)?.netWorth;
    expect(age65Nw).toBeCloseTo(307198.60, 1);
  });

  test('6. Regression: Scenario B (Home Purchase) matches golden snapshot', () => {
    const inputs = getMappedDefaultInputs();
    inputs.lifeEvents = [
      ...(inputs.lifeEvents || []),
      {
        id: 'house-evt',
        type: 'buyHouse',
        enabled: true,
        age: 40,
        purchaseAge: 40,
        homePrice: 400000,
        downPaymentPercent: 20,
        interestRate: 6.5,
        mortgageTerm: 30,
        propertyTaxRate: 1.2,
        insuranceRate: 0.5,
        maintenanceRate: 1.0,
        rebalanceStrategy: 'balanced'
      }
    ];
    const results = runFireSimulation(inputs);
    expect(results.retirementReadyAge).toBe(77);
    expect(results.retirementOutcome).toBe('retirementGap');
    const age65Nw = results.data.find(d => d.age === 65)?.netWorth;
    expect(age65Nw).toBeCloseTo(69959.96, 1);
  });

  test('7. Regression: Scenario C (Marriage) matches golden snapshot', () => {
    const inputs = getMappedDefaultInputs();
    inputs.lifeEvents = [
      ...(inputs.lifeEvents || []),
      {
        id: 'marriage-evt',
        type: 'marriage',
        enabled: true,
        age: 35,
        spouseCurrentAge: 35,
        spouseIncome: 45000,
        spouseEstimatedSocialSecurityBenefit: 1500,
        spouseLifeExpectancy: 85
      }
    ];
    const results = runFireSimulation(inputs);
    expect(results.retirementReadyAge).toBe(73);
    expect(results.retirementOutcome).toBe('retirementGap');
    const age65Nw = results.data.find(d => d.age === 65)?.netWorth;
    expect(age65Nw).toBeCloseTo(231070.32, 1);
  });

  test('8. Regression: Scenario D (Debt) matches golden snapshot', () => {
    const inputs = getMappedDefaultInputs();
    inputs.debtList = [
      {
        id: 'debt-1',
        name: 'Credit Card',
        type: 'creditCard',
        balance: 5000,
        rate: 18,
        minimumPaymentPercent: 3,
        startAge: 30,
        enabled: true
      }
    ];
    const results = runFireSimulation(inputs);
    expect(results.retirementReadyAge).toBe(63);
    expect(results.retirementOutcome).toBe('comfortable');
    const age65Nw = results.data.find(d => d.age === 65)?.netWorth;
    expect(age65Nw).toBeCloseTo(305138.66, 1);
  });
});
