// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { runFireSimulation, getNormalizedPhases } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { renderHook } from '@testing-library/react';
import { useRecommendations } from './src/hooks/useRecommendations.js';

describe('Buy House Event Regression Tests', () => {
  test('Rent is zeroed out by default after home purchase', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.isAdvancedMode = true; // Use detailed budget

    inputs.lifeEvents = [
      {
        id: 'house-event-1',
        type: 'buyHouse',
        enabled: true,
        name: 'Buy a House',
        purchaseAge: 40,
        homePrice: 300000,
        downPayment: 60000,
        purchaseType: 'mortgage',
        mortgageRate: 6.0,
        loanTerm: 30,
        propertyTax: 1.0,
        insurance: 0.5,
        keepRent: false // Rent should be zeroed
      }
    ];

    const phases = getNormalizedPhases(inputs);
    
    const preHousePhase = phases.find(p => p.startAge === 35);
    const postHousePhase = phases.find(p => p.startAge === 40);

    expect(preHousePhase).toBeDefined();
    expect(postHousePhase).toBeDefined();

    // In preHousePhase, rent (housing) should be positive (default is 1500)
    expect(preHousePhase.expenses['housing']).toBe(1500);

    // In postHousePhase, rent itself is zeroed but replaced by non-mortgage housing expenses (tax: 250, ins: 125, maint: 250 = 625)
    const postRent = postHousePhase.expenses['housing'];
    expect(postRent).toBe(625);
  });

  test('Mortgage is added under 🏠 Mortgage once', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.isAdvancedMode = true;

    inputs.lifeEvents = [
      {
        id: 'house-event-1',
        type: 'buyHouse',
        enabled: true,
        name: 'Buy a House',
        purchaseAge: 40,
        homePrice: 300000,
        downPayment: 60000,
        purchaseType: 'mortgage',
        mortgageRate: 6.0,
        loanTerm: 30,
        propertyTax: 0,
        insurance: 0,
        keepRent: false
      }
    ];

    const phases = getNormalizedPhases(inputs);
    const postHousePhase = phases.find(p => p.startAge === 40);

    // Expected P&I payment: Principal = 240,000, monthly rate = 0.06 / 12 = 0.005, payments = 360
    // P&I = 240000 * 0.005 * (1.005)^360 / ((1.005)^360 - 1) = 1438.92 (~1439)
    expect(postHousePhase.expenses['🏠 Mortgage']).toBeCloseTo(1439, -1);
  });

  test('keepRent: true preserves both rent and mortgage', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.isAdvancedMode = true;

    inputs.lifeEvents = [
      {
        id: 'house-event-1',
        type: 'buyHouse',
        enabled: true,
        name: 'Buy a House',
        purchaseAge: 40,
        homePrice: 300000,
        downPayment: 60000,
        purchaseType: 'mortgage',
        mortgageRate: 6.0,
        loanTerm: 30,
        propertyTax: 0,
        insurance: 0,
        keepRent: true // Rent should be kept!
      }
    ];

    const phases = getNormalizedPhases(inputs);
    const postHousePhase = phases.find(p => p.startAge === 40);

    // Rent is kept (1500) and non-mortgage costs (maintenance: 250) are added (1500 + 250 = 1750)
    expect(postHousePhase.expenses['housing']).toBe(1750);
    expect(postHousePhase.expenses['🏠 Mortgage']).toBeCloseTo(1439, -1);
  });

  test('Recommendations trigger when surplus is negative', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.isAdvancedMode = true;

    // Make the home purchase extremely expensive to cause a deficit (negative surplus)
    inputs.lifeEvents = [
      {
        id: 'house-event-1',
        type: 'buyHouse',
        enabled: true,
        name: 'Buy a House',
        purchaseAge: 40,
        homePrice: 1000000, // Very expensive!
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 8.0,
        loanTerm: 30,
        propertyTax: 2.0,
        insurance: 1.0,
        keepRent: false
      }
    ];

    const activeResults = runFireSimulation(inputs);

    const { result } = renderHook(() => useRecommendations(inputs, activeResults));
    const improvementPlan = result.current.improvementPlan;

    expect(improvementPlan).not.toBeNull();
    
    // Check for buyHouse specific recommendation types
    const types = improvementPlan.rankedPlan.map(rec => rec.type);
    expect(types).toContain('reduceHomePrice');
    expect(types).toContain('increaseHomeIncome');
    expect(types).toContain('reduceWantsNeeds');
    expect(types).toContain('delayHomePurchase');
    expect(types).toContain('extendRetirementAge');
  });

  test('Recommendations do not trigger when budget is affordable', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.isAdvancedMode = true;
    inputs.simpleIncome = 240000; // Align standardIncome with incomeList salary for baseline phase calculations

    // Increase income so that the budget is perfectly affordable
    inputs.budgetDetails.income = 20000; // $20k/month income
    inputs.budgetDetails.savings = {
      checking: 0,
      hysa: 0,
      emergency: 0,
      brokerage: 10000,
      trad401k: 0,
      rothIra: 0,
      hsa: 0,
      tradIra: 0,
      debt: 0,
      other: 0
    };
    inputs.incomeList = [
      {
        id: 'inc-1',
        name: 'Salary / Main Income',
        amount: 240000,
        frequency: 'yearly',
        startAge: 35,
        endAge: 65,
        growthRate: 0.03,
        isTaxable: true
      }
    ];

    // Add a cheap house purchase
    inputs.lifeEvents = [
      {
        id: 'house-event-1',
        type: 'buyHouse',
        enabled: true,
        name: 'Buy a House',
        purchaseAge: 40,
        homePrice: 100000,
        downPayment: 50000,
        purchaseType: 'mortgage',
        mortgageRate: 4.0,
        loanTerm: 15,
        propertyTax: 0,
        insurance: 0,
        keepRent: false
      }
    ];

    const activeResults = runFireSimulation(inputs);
    const { result } = renderHook(() => useRecommendations(inputs, activeResults));
    const improvementPlan = result.current.improvementPlan;
    if (improvementPlan) {
      const types = improvementPlan.rankedPlan.map(rec => rec.type);
      expect(types).not.toContain('reduceHomePrice');
      expect(types).not.toContain('increaseHomeIncome');
      expect(types).not.toContain('reduceWantsNeeds');
      expect(types).not.toContain('delayHomePurchase');
      expect(types).not.toContain('extendRetirementAge');
    }
  });
});
