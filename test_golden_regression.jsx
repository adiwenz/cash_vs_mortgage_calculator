// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import React from 'react';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getMappedDefaultInputs, buildYearlyResults, calculatePeakNetWorth } from './test_helper.js';
import {
  calculateTotalCashRequired,
  calculateLiquidAssetsAtPurchaseAge,
  calculateCashShortfall,
  isCashAffordable
} from './src/components/fire-simulator/houseAffordabilityUtils.js';
import { getRebalanceStrategies } from './src/calculators/fire/rebalance.js';
import { getChildCostOffsetRecommendations } from './src/recommendations.js';
import { useRecommendations } from './src/hooks/useRecommendations.js';

describe('Simulator Golden Regression Suite', () => {
  // Helper to set up scenario matching the cash constraint test cases
  const setupHouseTestScenario = ({ income, wants, savings, rent, homePrice, downPayment, liquidAssets, purchaseAge = 36 }) => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.expectedReturn = 7.0;
    inputs.inflationRate = 3.0;
    inputs.includeTaxes = false;
    inputs.isAdvancedMode = true;
    inputs.hasCustomizedSavingsAllocation = true;
    inputs.assets = {
      cash: liquidAssets / 2,
      brokerage: liquidAssets / 2
    };
    inputs.budgetDetails = {
      phases: [
        {
          id: 'phase1',
          type: 'workSave',
          startAge: 35,
          endAge: purchaseAge,
          income: income,
          savingsAllocMode: 'fixed',
          savings: { brokerage: savings },
          expenses: {
            housing: rent,
            leisure: wants / 3,
            diningOut: wants / 3,
            misc: wants / 3
          }
        },
        {
          id: 'phase2',
          type: 'workSave',
          startAge: purchaseAge,
          endAge: 85,
          income: income,
          savingsAllocMode: 'fixed',
          savings: { brokerage: savings },
          expenses: {
            housing: 0,
            leisure: wants / 3,
            diningOut: wants / 3,
            misc: wants / 3
          }
        }
      ]
    };

    const event = {
      id: 'buyHouse1',
      type: 'buyHouse',
      purchaseAge: purchaseAge,
      homePrice: homePrice,
      downPayment: downPayment,
      mortgageRate: 6.5,
      loanTerm: 30,
      closingCosts: 3,
      points: 0,
      renovationCost: 5000,
      movingCost: 3000,
      hoa: 0,
      utilitiesIncrease: 0,
      propertyTax: 1.1,
      insurance: 0.35,
      maintenance: 1.0,
      enabled: true
    };

    inputs.lifeEvents = [event];
    return { inputs, event };
  };

  // 1. Default baseline user produces a stable retirement/work-optional result
  test('1. Default baseline user produces a stable retirement/work-optional result', () => {
    const inputs = getMappedDefaultInputs();
    const results = runFireSimulation(inputs);
    const yearlyResults = buildYearlyResults(results, inputs);
    const peakNW = calculatePeakNetWorth(yearlyResults);

    const age65 = yearlyResults.find(d => d.age === 65);
    const age85 = yearlyResults.find(d => d.age === 85);

    expect(age65).toBeDefined();
    expect(age85).toBeDefined();

    // Age 65 nominal net worth is between $700k and $800k
    expect(age65.netWorth).toBeGreaterThanOrEqual(700000);
    expect(age65.netWorth).toBeLessThanOrEqual(800000);

    // Age 85 net worth is positive
    expect(age85.netWorth).toBeGreaterThan(0);

    // Peak net worth occurs at or after age 64
    expect(peakNW.age).toBeGreaterThanOrEqual(64);
  });

  // 2. Savings allocation defaults route savings to brokerage unless customized
  test('2. Savings allocation defaults route savings to brokerage unless customized', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.hasCustomizedSavingsAllocation = false; // default behavior

    const results = runFireSimulation(inputs);
    const firstYearLog = results.nominalData[0];
    const actual = firstYearLog.actualContributions;

    // Default savings should be routed to brokerage
    expect(actual.brokerage).toBeGreaterThan(0);
    expect(actual.checking).toBe(0);
    expect(actual.hysa).toBe(0);
    expect(actual.emergency).toBe(0);
    expect(actual.trad401k).toBe(0);
    expect(actual.rothIra).toBe(0);
    expect(actual.hsa).toBe(0);
  });

  // 3. Buy-house event detects upfront cash shortfall
  test('3. Buy-house event detects upfront cash shortfall', () => {
    const { inputs, event } = setupHouseTestScenario({
      income: 5000,
      wants: 2000,
      savings: 1000,
      rent: 1000,
      homePrice: 400000,
      downPayment: 80000,
      liquidAssets: 10000,
      purchaseAge: 36
    });

    const simulationResults = runFireSimulation(inputs);
    const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, 36, simulationResults);
    const totalCashRequired = calculateTotalCashRequired(event);

    // Cash required: 80000 (down payment) + 12000 (closing costs) + 5000 (renovation) + 3000 (moving) = 100000.
    // Liquid assets at purchase age is far below 100000 (starts at 10000, plus one year savings).
    expect(totalCashRequired).toBe(100000);
    expect(isCashAffordable(event, liquidAssets)).toBe(false);
    expect(calculateCashShortfall(totalCashRequired, liquidAssets)).toBeGreaterThan(0);
  });

  // 4. Affordable house recommendation respects down payment + closing cost cash constraints
  test('4. Affordable house recommendation respects down payment + closing cost cash constraints', () => {
    const { inputs, event } = setupHouseTestScenario({
      income: 5000,
      wants: 2000,
      savings: 1000,
      rent: 1000,
      homePrice: 400000,
      downPayment: 80000,
      liquidAssets: 10000,
      purchaseAge: 36
    });

    const strategies = getRebalanceStrategies(inputs, event, 65);
    expect(strategies).not.toBeNull();
    expect(strategies.constraint).toBe('cash');

    // Total cash required for recommended purchase must be <= available liquid assets
    const recommendedEvent = {
      ...event,
      homePrice: strategies.affordablePriceBalanced,
      downPayment: strategies.downPaymentBalanced
    };
    const cashNeeded = calculateTotalCashRequired(recommendedEvent);
    expect(cashNeeded).toBeLessThanOrEqual(strategies.liquidFundsAvailable);
  });

  // 5. Child event can produce clickable recommendations
  test('5. Child event can produce clickable recommendations', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.simpleIncome = 100000;
    inputs.simpleExpenses = 60000;

    const childEvent = {
      id: 'child-1',
      type: 'haveChild',
      enabled: true,
      name: 'Have a Child',
      childName: 'Emma',
      birthAge: 35,
      childStartAge: 0,
      costMethod: 'custom',
      customAges0to4: 15000,
      customAges5to12: 15000,
      customAges13to18: 15000,
      customAges19to22: 15000,
      includeCollege: false
    };
    inputs.lifeEvents = [childEvent];

    const recs = getChildCostOffsetRecommendations(inputs);
    expect(recs.length).toBeGreaterThanOrEqual(1);

    const rec = recs[0];
    expect(rec.childEventId).toBe('child-1');
    expect(rec.childName).toBe('Emma');
    expect(rec.peakCost).toBe(15000);
    expect(rec.parentStartAge).toBe(35);
  });

  // 6. Marriage event with default identical partner does not break readiness
  test('6. Marriage event with default identical partner does not break readiness', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.simpleIncome = 80000;
    inputs.simpleExpenses = 40000;
    inputs.assets = {
      cash: 50000,
      brokerage: 50000
    };

    const beforeResults = runFireSimulation(inputs);

    const marriageEvent = {
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      name: 'Get Married',
      age: 40,
      spouseIncome: 80000,
      incomeGrowthRate: 0.03,
      cash: 50000,
      investments: 50000,
      retirement: 0,
      debtStudent: 0,
      debtCredit: 0,
      debtOther: 0,
      savingsRate: 15,
      housingOption: 'savings',
      housingSavings: 0,
      housingCost: 0,
      lifestyleAdjustment: 0,
      includeWeddingCost: false,
      filingStatus: 'jointly'
    };
    inputs.lifeEvents = [marriageEvent];

    inputs.householdMembers = [{
      id: 'spouse',
      name: 'Spouse',
      activeFromDate: 40,
      activeUntilDate: null,
      income: 80000,
      incomeGrowthRate: 0.03,
      assets: {
        cash: 50000,
        investments: 50000,
        retirement: 0
      },
      debts: {
        student: 0,
        credit: 0,
        other: 0
      },
      savingsRate: 15
    }];

    const afterResults = runFireSimulation(inputs);

    // Both scenarios should have a stable retirement outcome
    expect(beforeResults.retirementReadyAge).toBeGreaterThanOrEqual(35);
    expect(beforeResults.retirementReadyAge).toBeLessThanOrEqual(85);
    expect(afterResults.retirementReadyAge).toBeGreaterThanOrEqual(35);
    expect(afterResults.retirementReadyAge).toBeLessThanOrEqual(85);
  });

  // 7. All-cash savings allocation does not accidentally create brokerage growth/contributions
  test('7. All-cash savings allocation does not accidentally create brokerage growth/contributions', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.expectedReturn = 7;
    inputs.inflationRate = 0;
    inputs.hasCustomizedSavingsAllocation = true;
    inputs.assets = {
      checking: 10000,
      brokerage: 10000
    };
    inputs.budgetDetails = {
      savings: {
        checking: 1000,
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
        housing: 2000
      }
    };

    const results = runFireSimulation(inputs);
    const timeline = results.nominalData;

    timeline.forEach(log => {
      if (log.age < 65) {
        // brokerage contributions must be 0
        expect(log.annualContributionsByAccount.brokerage).toBe(0);
      }
    });

    const logAt35 = timeline.find(l => l.age === 35);
    expect(logAt35.brokerageBalance).toBe(10000);

    const logAt36 = timeline.find(l => l.age === 36);
    expect(logAt36.brokerageBalance).toBeCloseTo(10700, -1);
  });

  // 8. Mobile and desktop recommendation paths use the same underlying recommendation logic
  test('8. Mobile and desktop recommendation paths use the same underlying recommendation logic', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.simpleIncome = 100000;
    inputs.simpleExpenses = 60000;

    const buyHouseEvent = {
      id: 'buyHouse1',
      type: 'buyHouse',
      purchaseAge: 36,
      homePrice: 400000,
      downPayment: 80000,
      enabled: true
    };
    inputs.lifeEvents = [buyHouseEvent];

    const simulationResults = runFireSimulation(inputs);

    // Call the hook that both mobile and desktop layouts rely on
    const { result } = renderHook(() => useRecommendations(inputs, simulationResults));

    expect(result.current.improvementPlan).toBeDefined();
    expect(result.current.improvementPlan.rankedPlan).toBeDefined();
    expect(result.current.improvementPlan.retirementReadyAge).toBeDefined();
  });
});
