// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getRebalanceStrategies, applyBalancedBudgetAdjustments } from './src/calculators/fire/rebalance.js';
import HouseRebalanceModal from './src/components/fire-simulator/HouseRebalanceModal.jsx';

describe('Home Purchase Rebalance calculations & strategies tests', () => {
  beforeEach(() => {
    cleanup();
  });

  const setupBaseInputs = () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.isAdvancedMode = true; // Use detailed budget
    inputs.includeTaxes = false; // Simple tax mode for clean math
    return inputs;
  };

  const setupCustomPhase = (inputs, income, wants, savings, rent) => {
    inputs.simpleIncome = income * 12;
    inputs.simpleExpenses = 0;
    inputs.spendingPhases = [];
    inputs.incomeList = [];
    inputs.budgetDetails = {
      phases: [
        {
          id: 'ws-phase-1',
          type: 'workSave',
          name: 'Career & Savings 1',
          startAge: 35,
          endAge: 40,
          savingsAllocMode: 'fixed',
          savings: {
            brokerage: savings
          },
          expenses: {
            housing: rent,
            leisure: wants / 3,
            diningOut: wants / 3,
            misc: wants / 3,
            food: 1000
          }
        },
        {
          id: 'ws-phase-2',
          type: 'workSave',
          name: 'Career & Savings 2',
          startAge: 40,
          endAge: 65,
          savingsAllocMode: 'fixed',
          savings: {
            brokerage: savings
          },
          expenses: {
            housing: 0, // Rent is replaced by mortgage
            leisure: wants / 3,
            diningOut: wants / 3,
            misc: wants / 3,
            food: 1000
          }
        }
      ]
    };
  };

  const setupCustomPhaseForDelay = (inputs, income, wants, savings, rent) => {
    inputs.simpleIncome = income * 12;
    inputs.simpleExpenses = 0;
    inputs.spendingPhases = [];
    inputs.incomeList = [];
    inputs.budgetDetails = {
      phases: [
        {
          id: 'ws-phase-1',
          type: 'workSave',
          name: 'Career & Savings 1',
          startAge: 35,
          endAge: 40,
          savingsAllocMode: 'fixed',
          savings: {
            brokerage: savings
          },
          expenses: {
            housing: rent,
            leisure: wants / 3,
            diningOut: wants / 3,
            misc: wants / 3,
            food: 1000
          }
        },
        {
          id: 'ws-phase-2',
          type: 'workSave',
          name: 'Career & Savings 2',
          startAge: 40,
          endAge: 45,
          savingsAllocMode: 'fixed',
          savings: {
            brokerage: savings
          },
          expenses: {
            housing: 0,
            leisure: wants / 3,
            diningOut: wants / 3,
            misc: wants / 3,
            food: 1000
          }
        },
        {
          id: 'ws-phase-3',
          type: 'workSave',
          name: 'Career & Savings 3',
          startAge: 45,
          endAge: 65,
          savingsAllocMode: 'fixed',
          savings: {
            brokerage: savings
          },
          expenses: {
            housing: 0,
            leisure: wants / 3,
            diningOut: wants / 3,
            misc: wants / 3,
            food: 1000
          }
        }
      ]
    };
  };

  test('getRebalanceStrategies triggers and computes Conservative, Balanced, and Aggressive price levels', () => {
    const inputs = setupBaseInputs();
    
    // Rent: 1000, Wants: 1500, Savings: 1500. Income: 5000.
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);

    const buyHouseEvent = {
      id: 'house-event-1',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 1000000, // Large price so it is not fully affordable at high limit
      downPayment: 0,
      purchaseType: 'mortgage',
      mortgageRate: 6.0,
      loanTerm: 30,
      propertyTax: 0,
      insurance: 0,
      maintenance: 0,
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEvent];
    const beforeResults = runFireSimulation(inputs);

    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEvent, beforeResults.retirementReadyAge);

    expect(rebalanceData).not.toBeNull();
    expect(rebalanceData.purchaseAge).toBe(40);
    expect(rebalanceData.oldHousingCost).toBe(1000);
    expect(rebalanceData.deficit).toBeGreaterThan(0);

    // Conservative target is exactly oldHousingCost (1000)
    expect(rebalanceData.affordablePaymentConservative).toBeCloseTo(1000, -1);
    expect(rebalanceData.affordablePriceConservative).toBeCloseTo(166875, -3);

    // Balanced can reduce Wants and Savings, so price is higher than Conservative
    expect(rebalanceData.affordablePriceBalanced).toBeGreaterThan(rebalanceData.affordablePriceConservative);

    // Aggressive can reduce Savings even further to 0, so price is higher than Balanced
    expect(rebalanceData.affordablePriceAggressive).toBeGreaterThan(rebalanceData.affordablePriceBalanced);
  });

  test('Test rebalancing delay purchase search <= 5 years', () => {
    const inputs = setupBaseInputs();
    setupCustomPhaseForDelay(inputs, 5000, 1500, 1500, 1000);

    // Add future salary increase at age 43 to make the house affordable then
    const futureIncomeBoost = {
      id: 'boost-1',
      type: 'incomeItem',
      name: 'Salary Boost',
      startAge: 43,
      endAge: 65,
      amount: 2500 * 12,
      salaryIncrease: 2500 * 12,
      incomeChangeType: 'increaseByAmount',
      frequency: 'yearly',
      growthRate: 0.0,
      isTaxable: false,
      enabled: true
    };

    const buyHouseEvent = {
      id: 'house-event-1',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 600000, // High price to be unaffordable at 40, 41, 42
      downPayment: 0,
      purchaseType: 'mortgage',
      mortgageRate: 6.0,
      loanTerm: 30,
      propertyTax: 0,
      insurance: 0,
      maintenance: 0,
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEvent, futureIncomeBoost];
    const beforeResults = runFireSimulation(inputs);

    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEvent, beforeResults.retirementReadyAge);
    
    expect(rebalanceData).not.toBeNull();
    // Delay purchase should find age 43
    expect(rebalanceData.earliestAffordableAge).toBe(43);
  });

  test('Test rebalancing delay purchase doesn\'t recommend > 5 years', () => {
    const inputs = setupBaseInputs();
    setupCustomPhaseForDelay(inputs, 5000, 1500, 1500, 1000);

    // Add a salary boost at age 47 (which is +7 years from 40)
    const futureIncomeBoost = {
      id: 'boost-1',
      type: 'incomeItem',
      name: 'Salary Boost',
      startAge: 47,
      endAge: 65,
      amount: 5000 * 12,
      salaryIncrease: 5000 * 12,
      incomeChangeType: 'increaseByAmount',
      frequency: 'yearly',
      growthRate: 0.0,
      isTaxable: false,
      enabled: true
    };

    const buyHouseEvent = {
      id: 'house-event-1',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 600000,
      downPayment: 0,
      purchaseType: 'mortgage',
      mortgageRate: 6.0,
      loanTerm: 30,
      propertyTax: 0,
      insurance: 0,
      maintenance: 0,
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEvent, futureIncomeBoost];
    const beforeResults = runFireSimulation(inputs);

    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEvent, beforeResults.retirementReadyAge);
    
    expect(rebalanceData).not.toBeNull();
    // Earliest affordable age should be null because it exceeds +5 years (40 + 5 = 45)
    expect(rebalanceData.earliestAffordableAge).toBeNull();
  });

  test('HouseRebalanceModal renders three-level comparisons and handles buttons', () => {
    const setHouseRebalanceSummary = vi.fn();
    const handleApplyRebalanceStrategy = vi.fn();

    const houseRebalanceSummary = {
      purchaseAge: 40,
      oldHousingCost: 1000,
      newHousingCost: 2000,
      monthlyDifference: 1000,
      deficit: 600,
      currentHomePrice: 500000,
      affordablePriceConservative: 200000,
      affordablePriceBalanced: 400000,
      affordablePriceAggressive: 480000,
      affordablePaymentBalanced: 1500,
      earliestAffordableAge: 43
    };

    render(
      <HouseRebalanceModal
        houseRebalanceSummary={houseRebalanceSummary}
        setHouseRebalanceSummary={setHouseRebalanceSummary}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    // Verify Title and deficit display
    expect(screen.getByRole('heading', { name: /Home Purchase Impact/i })).toBeDefined();
    expect(screen.getByText(/Monthly deficit: \$600\/mo/i)).toBeDefined();

    // Verify comparisons
    expect(screen.getByText(/Current Home:/i)).toBeDefined();
    expect(screen.getByText(/\$500,000/i)).toBeDefined();
    expect(screen.getByText(/Affordable Conservatively:/i)).toBeDefined();
    expect(screen.getByText(/\$200,000/i)).toBeDefined();
    expect(screen.getByText(/Affordable with Budget Adjustments:/i)).toBeDefined();
    expect(screen.getAllByText(/\$400,000/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Affordable Aggressively:/i)).toBeDefined();
    expect(screen.getByText(/\$480,000/i)).toBeDefined();

    // Verify exactly three action buttons
    const boostBtn = screen.getByRole('button', { name: /Create Income Boost/i });
    const priceBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    const delayBtn = screen.getByRole('button', { name: /Delay Purchase/i });

    expect(boostBtn).toBeDefined();
    expect(priceBtn).toBeDefined();
    expect(delayBtn).toBeDefined();

    // Verify subtext and callbacks
    expect(screen.getByText(/Set price to Balanced option: \$400,000/i)).toBeDefined();
    fireEvent.click(priceBtn);
    expect(handleApplyRebalanceStrategy).toHaveBeenCalledWith('updatePrice');

    expect(screen.getByText(/Move purchase to age 43/i)).toBeDefined();
    fireEvent.click(delayBtn);
    expect(handleApplyRebalanceStrategy).toHaveBeenCalledWith('delayPurchase');
  });

  test('HouseRebalanceModal handles disabled delay purchase and displays message', () => {
    const setHouseRebalanceSummary = vi.fn();
    const handleApplyRebalanceStrategy = vi.fn();

    const houseRebalanceSummary = {
      purchaseAge: 40,
      oldHousingCost: 1000,
      newHousingCost: 2000,
      monthlyDifference: 1000,
      deficit: 600,
      currentHomePrice: 500000,
      affordablePriceConservative: 200000,
      affordablePriceBalanced: 400000,
      affordablePriceAggressive: 480000,
      affordablePaymentBalanced: 1500,
      earliestAffordableAge: null // No affordable age <= 5 years
    };

    render(
      <HouseRebalanceModal
        houseRebalanceSummary={houseRebalanceSummary}
        setHouseRebalanceSummary={setHouseRebalanceSummary}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    const delayBtn = screen.getByRole('button', { name: /Delay Purchase/i });
    expect(delayBtn.disabled).toBe(true);
    expect(screen.getByText(/No near-term delay fixes this/i)).toBeDefined();
  });

  test('applyBalancedBudgetAdjustments reduces Wants before Savings', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);

    const buyHouseEvent = {
      id: 'house-event-1',
      purchaseAge: 40,
      downPayment: 0,
      purchaseType: 'mortgage',
      mortgageRate: 6.0,
      loanTerm: 30,
      propertyTax: 0,
      insurance: 0,
      maintenance: 0,
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    // Calculate a price that increases monthly cost by 600
    // Rent is 1000, so new payment is 1600.
    const price = 267000; 

    // Clone inputs to apply changes
    const adjustedInputs = JSON.parse(JSON.stringify(inputs));
    applyBalancedBudgetAdjustments(adjustedInputs, buyHouseEvent, price, inputs);

    const originalPhase = inputs.budgetDetails.phases[1];
    const adjustedPhase = adjustedInputs.budgetDetails.phases.find(p => p.startAge === 40);

    expect(adjustedPhase).toBeDefined();

    // Wants (leisure, diningOut, misc) original total: 1500. Wants floor is max(250, 10% of 5000 net income) = 500.
    // Reducible wants: 1500 - 500 = 1000.
    // Net housing cost increase is 600 (1600 payment - 1000 rent).
    // Wants reduction needed: 600.
    // Adjusted Wants should be 1500 - 600 = 900.
    const originalWants = originalPhase.expenses.leisure + originalPhase.expenses.diningOut + originalPhase.expenses.misc;
    const adjustedWants = adjustedPhase.expenses.leisure + adjustedPhase.expenses.diningOut + adjustedPhase.expenses.misc;

    expect(adjustedWants).toBe(900);

    // Savings original: 1500. Since wants covered the entire 600, savings should remain unchanged.
    const originalSavings = Object.values(originalPhase.savings).reduce((a, b) => a + b, 0);
    const adjustedSavings = Object.values(adjustedPhase.savings).reduce((a, b) => a + b, 0);

    expect(adjustedSavings).toBe(originalSavings);
  });
});
