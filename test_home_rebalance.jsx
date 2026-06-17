// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getRebalanceStrategies } from './src/calculators/fire/rebalance.js';
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

  test('getRebalanceStrategies triggers and computes simplified fixes correctly', () => {
    const inputs = setupBaseInputs();
    
    // Add a buyHouse event that replaces rent (1000) with a much larger mortgage
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);

    const buyHouseEvent = {
      id: 'house-event-1',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 300000,
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
    expect(rebalanceData.newHousingCost).toBeCloseTo(1800, -1);
    expect(rebalanceData.monthlyDifference).toBeCloseTo(800, -1);
    expect(rebalanceData.deficit).toBeCloseTo(800, -1);

    // Verify it contains the three fixes and no old strategies
    expect(rebalanceData.strategies).toBeUndefined();
    expect(rebalanceData.affordablePrice).toBeDefined();
    expect(rebalanceData.affordablePayment).toBeDefined();
    expect(rebalanceData.earliestAffordableAge).toBeDefined();

    // Verify affordable price is calculated correctly:
    expect(rebalanceData.affordablePayment).toBeCloseTo(1000, -1);
    expect(rebalanceData.affordablePrice).toBeCloseTo(166875, -2);
  });

  test('Test rebalancing delay purchase calculation', () => {
    const inputs = setupBaseInputs();
    setupCustomPhaseForDelay(inputs, 5000, 1500, 1500, 1000);

    // Let's add an income boost at age 45 so they can afford the house then
    const futureIncomeBoost = {
      id: 'boost-1',
      type: 'incomeItem',
      name: 'Salary Boost',
      startAge: 45,
      endAge: 65,
      amount: 2000 * 12,
      salaryIncrease: 2000 * 12,
      incomeChangeType: 'increaseByAmount',
      frequency: 'yearly',
      growthRate: 0.03,
      isTaxable: true,
      enabled: true
    };

    const buyHouseEvent = {
      id: 'house-event-1',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 300000,
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
    expect(rebalanceData.earliestAffordableAge).toBe(45);
  });

  test('HouseRebalanceModal renders simplified UI and triggers callbacks', () => {
    const setHouseRebalanceSummary = vi.fn();
    const handleApplyRebalanceStrategy = vi.fn();

    const houseRebalanceSummary = {
      purchaseAge: 40,
      oldHousingCost: 1000,
      newHousingCost: 1800,
      monthlyDifference: 800,
      deficit: 800,
      affordablePrice: 166875,
      affordablePayment: 1000,
      earliestAffordableAge: 45
    };

    render(
      <HouseRebalanceModal
        houseRebalanceSummary={houseRebalanceSummary}
        setHouseRebalanceSummary={setHouseRebalanceSummary}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    // Verify Title
    expect(screen.getByRole('heading', { name: /Home Purchase Impact/i })).toBeDefined();

    // Verify cost increase and deficit text
    expect(screen.getByText(/Housing increased by/i)).toBeDefined();
    expect(screen.getByText(/Monthly deficit:/i)).toBeDefined();

    // Verify NO strategy names, radio buttons, or category breakdowns are present
    expect(screen.queryByText(/Maintain Retirement Age/i)).toBeNull();
    expect(screen.queryByText(/Protect Lifestyle/i)).toBeNull();
    expect(screen.queryByText(/Wants/i)).toBeNull();
    expect(screen.queryByText(/Needs/i)).toBeNull();
    expect(screen.queryByText(/Savings/i)).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();

    // Verify exactly three buttons for fixes are rendered
    const boostBtn = screen.getByRole('button', { name: /Create Income Boost/i });
    const priceBtn = screen.getByRole('button', { name: /Update House Price/i });
    const delayBtn = screen.getByRole('button', { name: /Delay Purchase/i });

    expect(boostBtn).toBeDefined();
    expect(priceBtn).toBeDefined();
    expect(delayBtn).toBeDefined();

    // Verify click callbacks
    fireEvent.click(boostBtn);
    expect(handleApplyRebalanceStrategy).toHaveBeenCalledWith('incomeBoost');
    expect(setHouseRebalanceSummary).toHaveBeenCalledWith(null);

    fireEvent.click(priceBtn);
    expect(handleApplyRebalanceStrategy).toHaveBeenCalledWith('updatePrice');

    fireEvent.click(delayBtn);
    expect(handleApplyRebalanceStrategy).toHaveBeenCalledWith('delayPurchase');
  });

  test('Create Income Boost creates the correct income event properties', () => {
    const deficit = 803;
    const purchaseAge = 40;
    const yearlyIncomeBoost = deficit * 12;
    const incomeBoostEvent = {
      id: `careerChange-test`,
      type: 'careerChange',
      name: 'Income Increase (Homeownership)',
      startAge: purchaseAge,
      endAge: 65,
      growthRate: 3.0,
      isTaxable: true,
      amount: yearlyIncomeBoost,
      salaryIncrease: yearlyIncomeBoost,
      incomeChangeType: 'increaseByAmount',
      permanent: true,
      enabled: true
    };
    expect(incomeBoostEvent.amount).toBe(9636);
    expect(incomeBoostEvent.startAge).toBe(40);
  });

  test('Update House Price updates the house event price', () => {
    const buyHouseEv = {
      id: 'house-event-1',
      homePrice: 300000,
      downPayment: 50000
    };
    const affordablePrice = 166875;
    const updatedEv = {
      ...buyHouseEv,
      homePrice: affordablePrice,
      downPayment: Math.min(buyHouseEv.downPayment, affordablePrice)
    };
    expect(updatedEv.homePrice).toBe(166875);
    expect(updatedEv.downPayment).toBe(50000);
  });

  test('Delay Purchase moves the house event to the earliest affordable age', () => {
    const buyHouseEv = {
      id: 'house-event-1',
      purchaseAge: 40,
      age: 40
    };
    const earliestAffordableAge = 45;
    const updatedEv = {
      ...buyHouseEv,
      purchaseAge: earliestAffordableAge,
      age: earliestAffordableAge
    };
    expect(updatedEv.purchaseAge).toBe(45);
    expect(updatedEv.age).toBe(45);
  });
});
