// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getRebalanceStrategies, applyBalancedBudgetAdjustments, isHouseAffordableBalanced } from './src/calculators/fire/rebalance.js';
import HouseRebalanceModal from './src/components/fire-simulator/HouseRebalanceModal.jsx';
import { useRecommendations } from './src/hooks/useRecommendations.js';
import { useTimelineEvents } from './src/hooks/useTimelineEvents.js';

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

    // Conservative target is currentRent + currentSurplus + conservativeAdjustmentCapacity - emergencySurplusFloor (1000 + 0 + 0 - 100 = 900)
    expect(rebalanceData.affordablePaymentConservative).toBeCloseTo(900, -1);
    expect(rebalanceData.affordablePriceConservative).toBeCloseTo(150112, -3);

    // Balanced can reduce Wants and Savings, so price is higher than Conservative
    expect(rebalanceData.affordablePriceBalanced).toBeGreaterThan(rebalanceData.affordablePriceConservative);

    // Aggressive can reduce Savings even further to 0, so price is higher than Balanced
    expect(rebalanceData.affordablePriceAggressive).toBeGreaterThan(rebalanceData.affordablePriceBalanced);
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
      selectedOption: 'balanced',
      selectedAffordablePrice: 400000
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
    expect(screen.getByText(/Comfortable:/i)).toBeDefined();
    expect(screen.getByText(/\$200,000/i)).toBeDefined();
    expect(screen.getByText(/Balanced \(Default\):/i)).toBeDefined();
    expect(screen.getAllByText(/\$400,000/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Stretch:/i)).toBeDefined();
    expect(screen.getByText(/\$480,000/i)).toBeDefined();

    // Verify exactly two action buttons
    const boostBtn = screen.getByRole('button', { name: /Create Income Boost/i });
    const priceBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    const delayBtn = screen.queryByRole('button', { name: /Delay Purchase/i });

    expect(boostBtn).toBeDefined();
    expect(priceBtn).toBeDefined();
    expect(delayBtn).toBeNull();

    // Verify subtext and callbacks
    expect(screen.getByText(/Set price to Balanced option: \$400,000/i)).toBeDefined();
    fireEvent.click(priceBtn);
    expect(handleApplyRebalanceStrategy).toHaveBeenCalledWith('updatePrice');
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

  test('getRebalanceStrategies generates remainingBalancedDeficit and fallbacks correctly', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);

    const buyHouseEvent = {
      id: 'house-event-1',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 1000000,
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

    expect(rebalanceData.remainingBalancedDeficit).toBeDefined();
    expect(rebalanceData.remainingBalancedDeficit).toBeGreaterThan(0);
    expect(rebalanceData.remainingBalancedDeficit).toBeLessThan(rebalanceData.deficit);
  });

  test('Two-step rebalance logic decoupled simulation calls and validates math formula', async () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);

    const buyHouseEvent = {
      id: 'house-event-1',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 1000000,
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
    
    const fireCalculationsModule = await import('./src/fireCalculations.js');
    const spy = vi.spyOn(fireCalculationsModule, 'runFireSimulation');
    
    const beforeResults = fireCalculationsModule.runFireSimulation(inputs);
    spy.mockClear();

    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEvent, beforeResults.retirementReadyAge);

    expect(rebalanceData.affordablePaymentBalanced).toBeCloseTo(2900, -1);
    expect(rebalanceData.affordablePaymentAggressive).toBeCloseTo(3400, -1);
    expect(rebalanceData.affordablePaymentAggressive).toBeGreaterThanOrEqual(rebalanceData.affordablePaymentBalanced);

    // 3 validation simulations + up to 5 delay purchase age simulations = 8 calls max
    expect(spy.mock.calls.length).toBeLessThanOrEqual(8);
    
    spy.mockRestore();
  });

  test('Down payment reduces liquid assets but increases home equity, home equity appears in net worth, and mortgage balance appears as debt', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);
    inputs.brokerage = 200000;

    const buyHouseEvent = {
      id: 'house-event-dp',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000,
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
    const results = runFireSimulation(inputs);

    const logAt40 = results.nominalData.find(l => l.age === 40);
    const logBefore40 = results.nominalData.find(l => l.age === 39);

    expect(logAt40).toBeDefined();
    expect(logBefore40).toBeDefined();

    // Verify homeValue is >= 500k at age 40 (appreciated)
    expect(logAt40.homeValue).toBeGreaterThanOrEqual(500000);
    // Mortgage balance is 400k (500k price - 100k down payment)
    expect(logAt40.mortgageBalance).toBeCloseTo(400000, -3);

    // Home equity = homeValue - mortgageBalance
    const expectedEquity = logAt40.homeValue - logAt40.mortgageBalance;
    expect(logAt40.homeEquity).toBeCloseTo(expectedEquity, -1);

    // Verify net worth includes home value and mortgage debt
    const calculatedNW = logAt40.assets - logAt40.debt;
    expect(logAt40.netWorth).toBeCloseTo(calculatedNW, -1);

    // Check that down payment shifted from liquid assets to home equity rather than disappearing
    const liquidNWBefore = logBefore40.portfolio + logBefore40.cashBalance;
    const liquidNWAt40 = logAt40.portfolio + logAt40.cashBalance;
    const netWorthChange = logAt40.netWorth - logBefore40.netWorth;

    // Transaction costs/expenses (property tax, insurance, maint, utilities, hoa) reduce NW,
    // but the down payment shift itself (100k) should only reduce liquid NW and increase home equity.
    expect(liquidNWAt40).toBeLessThan(liquidNWBefore - 80000);
    expect(logAt40.homeEquity).toBeGreaterThanOrEqual(100000);
  });

  test('Validation rules: Conservative/Balanced/Aggressive retirement delays and sustainability', async () => {
    const inputs = setupBaseInputs();
    inputs.assets.brokerage = 200000;
    inputs.lifeExpectancy = 85;
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);

    const buyHouseEvent = {
      id: 'house-event-val',
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

    const fireCalculationsModule = await import('./src/fireCalculations.js');
    const spy = vi.spyOn(fireCalculationsModule, 'runFireSimulation');

    // Case A: 26 years retirement delay / unsustainable in retirement
    // Under new rules, it is still marked valid because monthly cash flow is valid and down payment can be made!
    spy.mockImplementation((tempInputs) => {
      return { retirementReadyAge: 86, moneyLasts: false, endingSurplusShortfall: 0 };
    });

    const baselineReadyAge = 60;
    const rebalanceA = getRebalanceStrategies(inputs, buyHouseEvent, baselineReadyAge);

    expect(rebalanceA.isConservativeValid).toBe(true);
    expect(rebalanceA.isBalancedValid).toBe(true);
    expect(rebalanceA.isAggressiveValid).toBe(true);
    expect(rebalanceA.isConservativeMonthlyValid).toBe(true);
    expect(rebalanceA.isBalancedMonthlyValid).toBe(true);
    expect(rebalanceA.isAggressiveMonthlyValid).toBe(true);
    expect(rebalanceA.selectedOption).toBe('balanced');
    expect(rebalanceA.selectedAffordablePrice).not.toBeNull();

    // Case B: Monthly cash flow / down payment fails
    // Let's test isHouseAffordableBalanced with a very high home price that exceeds balanced capacity.
    const expensiveHouse = { ...buyHouseEvent, homePrice: 10000000 };
    const isAffordable = isHouseAffordableBalanced(inputs, expensiveHouse, baselineReadyAge);
    expect(isAffordable).toBe(false);

    spy.mockRestore();
  });

  test('HouseRebalanceModal regression tests: retirement age delay, (invalid) labels, and buttons', () => {
    const setHouseRebalanceSummary = vi.fn();
    const handleApplyRebalanceStrategy = vi.fn();

    // Case 1: Retirement delay, valid cash flow
    const summaryWithDelay = {
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
      selectedOption: 'balanced',
      selectedAffordablePrice: 400000,
      isConservativeValid: true,
      isBalancedValid: true,
      isAggressiveValid: true,
      isConservativeMonthlyValid: true,
      isBalancedMonthlyValid: true,
      isAggressiveMonthlyValid: true,
      baselineRetirementAge: 60,
      balancedRetirementAge: 65,
      conservativeRetirementAge: 61,
      aggressiveRetirementAge: 68
    };

    const { rerender } = render(
      <HouseRebalanceModal
        houseRebalanceSummary={summaryWithDelay}
        setHouseRebalanceSummary={setHouseRebalanceSummary}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    // Verify "Update House Purchase" button is enabled
    const updateBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    expect(updateBtn.disabled).toBe(false);
    expect(screen.queryByText(/Plan is unsustainable/i)).toBeNull();

    // Check that retirement age transitions are displayed
    expect(screen.getByText(/Retirement age: 60 → 65/i)).toBeDefined();
    expect(screen.getByText(/Retirement age: 60 → 61/i)).toBeDefined();
    expect(screen.getByText(/Retirement age: 60 → 68/i)).toBeDefined();

    // Check that "(invalid)" does NOT appear for valid cash flows
    expect(screen.queryByText(/\(invalid\)/i)).toBeNull();

    // Case 2: Cash flow test fails (isConservativeMonthlyValid = false)
    const summaryInvalidCashFlow = {
      ...summaryWithDelay,
      affordablePriceConservative: 0,
      isConservativeValid: false,
      isConservativeMonthlyValid: false,
      isBalancedValid: false,
      isBalancedMonthlyValid: false,
      isAggressiveValid: false,
      isAggressiveMonthlyValid: false,
      selectedAffordablePrice: null,
      selectedOption: 'none'
    };

    rerender(
      <HouseRebalanceModal
        houseRebalanceSummary={summaryInvalidCashFlow}
        setHouseRebalanceSummary={setHouseRebalanceSummary}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    // Verify "(invalid)" label appears
    expect(screen.getAllByText(/\(invalid\)/i).length).toBeGreaterThanOrEqual(1);

    // Verify disabled state shows "Plan is unsustainable"
    const disabledUpdateBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    expect(disabledUpdateBtn.disabled).toBe(true);
    expect(screen.getByText(/Plan is unsustainable/i)).toBeDefined();
  });

  test('Available home funds exclude retirement assets and prioritize liquid funds', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);
    
    // Add retirement assets and taxable/liquid assets
    inputs.assets = {
      cash: 10000,
      emergencyFund: 10000,
      brokerage: 30000,
      trad401k: 100000,
      tradIra: 50000,
      rothIra: 20000,
      hsa: 10000
    };

    const buyHouseEvent = {
      id: 'house-event-liquid',
      type: 'buyHouse',
      enabled: true,
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000,
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
    // Excluded: trad401k (100k), tradIra (50k), rothIra (20k), hsa (10k).
    // Included: cash (10k), emergencyFund (10k), brokerage (30k) = 50k total liquid funds before purchase.
    // The simulation runs until age 39. Liquid funds available will grow, but should be way lower than if we included retirement accounts!
    expect(rebalanceData.liquidFundsAvailable).toBeLessThan(200000);
    expect(rebalanceData.liquidFundsAvailable).toBeGreaterThan(160000);
    expect(rebalanceData.estimatedDownPaymentCapacity).toBeGreaterThan(0);
  });

  test('insufficient liquid assets generates down-payment-focused recommendations in useRecommendations', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);
    
    // Low liquid assets: 5000 cash, 0 brokerage.
    inputs.assets = {
      cash: 5000,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 200000 // high retirement asset to ensure they are retire-ready otherwise
    };

    // Buying house with 200k down payment needed (requires 200k down payment cash + closing/moving costs)
    const buyHouseEvent = {
      id: 'house-event-insufficient',
      type: 'buyHouse',
      enabled: true,
      purchaseAge: 40,
      homePrice: 600000,
      downPayment: 200000,
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

    const { result } = renderHook(() => useRecommendations(inputs, beforeResults));
    const { improvementPlan } = result.current;

    expect(improvementPlan).not.toBeNull();
    expect(improvementPlan.isAffordable).toBe(false);
    
    // Find redirect savings recommendation
    const redirectSavingsRec = improvementPlan.rankedPlan.find(r => r.type === 'redirectSavingsDownPayment');
    const pauseNonRetRec = improvementPlan.rankedPlan.find(r => r.type === 'pauseNonRetirementSavings');
    const redirectBrokerageRec = improvementPlan.rankedPlan.find(r => r.type === 'redirectBrokerageHouseFund');
    const partnerRec = improvementPlan.rankedPlan.find(r => r.type === 'purchaseWithPartner');
    const roommateRec = improvementPlan.rankedPlan.find(r => r.type === 'purchaseWithRoommate');

    expect(redirectSavingsRec).toBeDefined();
    expect(pauseNonRetRec).toBeDefined();
    expect(redirectBrokerageRec).toBeDefined();
    expect(partnerRec).toBeDefined();
    expect(roommateRec).toBeDefined();

    // The redirect savings recommendation should be prioritized with priorityGroup 1 and isPrimary true
    expect(redirectSavingsRec.priorityGroup).toBe(1);
    expect(redirectSavingsRec.isPrimary).toBe(true);

    // Verify effort scores are low/correct
    expect(redirectSavingsRec.savingsEffortScore).toBe(1);
    expect(partnerRec.savingsEffortScore).toBe(2);
  });

  test('Timeline events stacking slot regression - buyHouse event and career change event do not share stackIndex', () => {
    const inputs = setupBaseInputs();
    
    // Create a buyHouse event and a career change event at age 40
    const buyHouseEv = {
      id: 'house-event-1',
      houseId: 'my-house-id',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000,
      purchaseType: 'mortgage',
      loanTerm: 30
    };
    
    const careerEv = {
      id: 'career-change-1',
      type: 'careerChange',
      name: 'Promotion at 40',
      startAge: 40,
      endAge: 65,
      growthRate: 0.03,
      amount: 20000,
      salaryIncrease: 20000,
      incomeChangeType: 'increaseByAmount',
      enabled: true
    };
    
    inputs.lifeEvents = [buyHouseEv];
    inputs.incomeList = [careerEv];
    inputs.houseAssets = [{
      id: 'my-house-id',
      name: 'Primary Home',
      purchasePrice: 500000,
      downPayment: 100000,
      purchaseType: 'mortgage',
      loanTermYears: 30
    }];

    const results = runFireSimulation(inputs);

    const { result } = renderHook(() => useTimelineEvents(inputs, results));
    const timelineEvents = result.current;

    // Find the buyHouse and career events
    const houseTimelineEvent = timelineEvents.find(e => e.type === 'buyHouse');
    const careerTimelineEvent = timelineEvents.find(e => e.type === 'career');

    expect(houseTimelineEvent).toBeDefined();
    expect(careerTimelineEvent).toBeDefined();
    expect(houseTimelineEvent.age).toBe(40);
    expect(careerTimelineEvent.age).toBe(40);

    // They should not have the same stackIndex
    expect(houseTimelineEvent.stackIndex).not.toBe(careerTimelineEvent.stackIndex);
  });
});
