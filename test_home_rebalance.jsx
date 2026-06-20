// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runFireSimulation, getNormalizedPhases } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getRebalanceStrategies, applyBalancedBudgetAdjustments, isHouseAffordableBalanced, getSimulationValidationForPrice, resolveBuyHouseEvent } from './src/calculators/fire/rebalance.js';
import HouseRebalanceModal from './src/components/fire-simulator/HouseRebalanceModal.jsx';
import HouseImpactModal from './src/components/fire-simulator/HouseImpactModal.jsx';
import { useRecommendations } from './src/hooks/useRecommendations.js';
import { useTimelineEvents } from './src/hooks/useTimelineEvents.js';
import DesktopResults from './src/components/fire-simulator/DesktopResults.jsx';
import LifePlanScreen from './src/components/fire-simulator/LifePlanScreen.jsx';

describe('Home Purchase Rebalance calculations & strategies tests', () => {
  beforeEach(() => {
    cleanup();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  const setupBaseInputs = () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.hasCustomizedSavingsAllocation = true;
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

    // Cozy/Comfortable price is solved via sweep simulation
    expect(rebalanceData.affordablePaymentConservative).toBeCloseTo(899, -1);
    expect(rebalanceData.affordablePriceConservative).toBeCloseTo(150000, -3);

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

    // Verify Title and primary recommendation
    expect(screen.getByRole('heading', { name: /Home Purchase Recommendation/i })).toBeDefined();

    // Verify primary fields
    expect(screen.getByText(/Current Home:/i)).toBeDefined();
    expect(screen.getByText(/\$500,000/i)).toBeDefined();
    expect(screen.getByText(/Recommended:/i)).toBeDefined();
    expect(screen.getAllByText(/\$400,000/i).length).toBeGreaterThanOrEqual(1);

    // Expand option comparisons to check comfortable/stretch details
    const toggleBtn = screen.getByRole('button', { name: /Show Option Comparisons/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Comfortable:/i)).toBeDefined();
    expect(screen.getByText(/\$200,000/i)).toBeDefined();
    expect(screen.getByText(/Balanced \(Default\):/i)).toBeDefined();
    expect(screen.getByText(/Stretch:/i)).toBeDefined();
    expect(screen.getByText(/\$480,000/i)).toBeDefined();

    // Verify three action buttons
    const boostBtn = screen.getByRole('button', { name: /Create Income Boost/i });
    const priceBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    const saveBtn = screen.getByRole('button', { name: /Save for Down Payment/i });

    expect(boostBtn).toBeDefined();
    expect(priceBtn).toBeDefined();
    expect(saveBtn).toBeDefined();

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
    
    try {
      const beforeResults = fireCalculationsModule.runFireSimulation(inputs);
      spy.mockClear();

      const rebalanceData = getRebalanceStrategies(inputs, buyHouseEvent, beforeResults.retirementReadyAge);

      expect(rebalanceData.affordablePaymentBalanced).toBeCloseTo(1900, -1);
      expect(rebalanceData.affordablePaymentAggressive).toBeCloseTo(3400, -1);
      expect(rebalanceData.affordablePaymentAggressive).toBeGreaterThanOrEqual(rebalanceData.affordablePaymentBalanced);

      // With coarse-to-fine sweep, we evaluate ~15 coarse prices + ~10 fine prices per strategy level.
      // Maximum calls expected is around 60 to 70 across conservative, balanced, and aggressive.
      expect(spy.mock.calls.length).toBeLessThanOrEqual(80);
    } finally {
      spy.mockRestore();
    }
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
    expect(logAt40.mortgageBalance).toBeLessThan(400000);
    expect(logAt40.mortgageBalance).toBeGreaterThan(390000);

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

    try {
      // Case A: 26 years retirement delay / unsustainable in retirement
      // Under new rules, it is still marked valid because monthly cash flow is valid and down payment can be made!
      spy.mockImplementation((tempInputs) => {
        return { retirementReadyAge: 86, moneyLasts: false, endingSurplusShortfall: 0 };
      });

      const baselineReadyAge = 60;
      const rebalanceA = getRebalanceStrategies(inputs, buyHouseEvent, baselineReadyAge);

      expect(rebalanceA.isConservativeValid).toBe(false);
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
      const affordabilityResult = isHouseAffordableBalanced(inputs, expensiveHouse, baselineReadyAge);
      expect(affordabilityResult.monthlyAffordable && affordabilityResult.retirementValid).toBe(false);
    } finally {
      spy.mockRestore();
    }
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

    // Expand comparisons
    const toggleBtn = screen.getByRole('button', { name: /Show Option Comparisons/i });
    fireEvent.click(toggleBtn);

    // Check that retirement age transitions are displayed
    expect(screen.getAllByText(/60 → 65/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/60 → 61/i)).toBeDefined();
    expect(screen.getByText(/60 → 68/i)).toBeDefined();

    // Case 2: Cash flow test fails (selectedAffordablePrice = null)
    const summaryInvalidCashFlow = {
      ...summaryWithDelay,
      affordablePriceConservative: 0,
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
      homePrice: 400000,
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

  test('Home Purchase Recommendation Engine new philosophy and rules validation', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);
    inputs.assets = {
      cash: 5000,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 200000
    };

    // A house event that is affordable monthly (350k) but has a huge down payment gap (150k down payment vs 5k assets)
    const buyHouseEv = {
      id: 'house-val-new-rules',
      type: 'buyHouse',
      enabled: true,
      purchaseAge: 40,
      homePrice: 350000,
      downPayment: 150000,
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

    inputs.lifeEvents = [buyHouseEv];
    runFireSimulation(inputs);

    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEv, 60);

    // 1. Recommended price is capped by cash affordability constraint
    expect(rebalanceData.affordablePriceBalanced).toBeLessThan(350000);
    expect(rebalanceData.affordablePriceConservative).toBeLessThanOrEqual(260000);
    expect(rebalanceData.affordablePriceAggressive).toBeGreaterThanOrEqual(rebalanceData.affordablePriceBalanced);
    expect(rebalanceData.constraint).toBe('cash');

    // 2. Down payment gap makes Balanced recommendation monthlyAffordable false for original price
    const affordabilityResult = isHouseAffordableBalanced(inputs, buyHouseEv, 60);
    expect(affordabilityResult.monthlyAffordable).toBe(false);
    expect(affordabilityResult.retirementValid).toBe(true);
    expect(affordabilityResult.downPaymentGap).toBeGreaterThan(40000);

    // 3. Update House Purchase button should be enabled in HouseRebalanceModal when price is > 0
    const handleApplyRebalanceStrategy = vi.fn();
    const { rerender } = render(
      <HouseRebalanceModal
        houseRebalanceSummary={{
          ...rebalanceData,
          selectedAffordablePrice: 400000,
          selectedOption: 'balanced'
        }}
        setHouseRebalanceSummary={vi.fn()}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );
    const updateBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    expect(updateBtn.disabled).toBe(false);

    // 4. Retirement ready age shows as transition or "Not achievable" (never N/A) in comparisons
    const toggleBtn = screen.getByRole('button', { name: /Show Option Comparisons/i });
    fireEvent.click(toggleBtn);
    
    cleanup();
    
    render(
      <HouseRebalanceModal
        houseRebalanceSummary={{
          ...rebalanceData,
          baselineRetirementAge: 60,
          balancedRetirementAge: null, // Should show as "Not achievable"
          conservativeRetirementAge: 61, // Should show as "60 → 61"
          aggressiveRetirementAge: 68, // Should show as "60 → 68"
          selectedAffordablePrice: 400000,
          selectedOption: 'balanced'
        }}
        setHouseRebalanceSummary={vi.fn()}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    const toggleBtn2 = screen.getByRole('button', { name: /Show Option Comparisons/i });
    fireEvent.click(toggleBtn2);

    expect(screen.getAllByText(/Not achievable/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/60 → 61/i)).toBeDefined();
    expect(screen.getByText(/60 → 68/i)).toBeDefined();
  });

  test('Update House Purchase click transitions to detailed outcome screen', () => {
    const handleApplyRebalanceStrategy = vi.fn();
    const mockSummary = {
      purchaseAge: 40,
      currentHomePrice: 500000,
      selectedAffordablePrice: 293002,
      selectedOption: 'balanced',
      affordablePriceConservative: 200000,
      affordablePriceBalanced: 293002,
      affordablePriceAggressive: 350000,
      affordablePaymentBalanced: 1818,
      totalCashNeededBalanced: 108790,
      liquidFundsAvailable: 28015,
      baselineRetirementAge: 60,
      balancedRetirementAge: null, // "Not achievable"
      originalWants: 1500,
      originalSavings: 1500,
      wantsReductionBalanced: 300,
      savingsReductionBalanced: 200,
      newWantsBalanced: 1200,
      newSavingsBalanced: 1300,
      piBalanced: 1108
    };

    render(
      <HouseRebalanceModal
        houseRebalanceSummary={mockSummary}
        setHouseRebalanceSummary={vi.fn()}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    // Click Update House Purchase
    const updateBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    fireEvent.click(updateBtn);

    // Verify it called handleApplyRebalanceStrategy
    expect(handleApplyRebalanceStrategy).toHaveBeenCalledWith('updatePrice');

    // Verify outcome screen details are shown
    expect(screen.getByText(/🎉 House Purchase Updated/i)).toBeDefined();
    expect(screen.getByText(/Full Mortgage Price:/i)).toBeDefined();
    expect(screen.getAllByText(/\$293,002/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Down Payment:/i)).toBeDefined();
    expect(screen.getAllByText(/\$108,790/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Mortgage P&I:/i)).toBeDefined();
    expect(screen.getByText(/\$1,108\/mo/i)).toBeDefined();
    expect(screen.getByText(/Total Housing Cost:/i)).toBeDefined();
    expect(screen.getAllByText(/\$1,818\/mo/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/New Work Optional Age:/i)).toBeDefined();
    expect(screen.getAllByText(/Not achievable/i).length).toBeGreaterThanOrEqual(1);

    // Verify budget adjustments are shown
    expect(screen.getByText(/📈 Budget Adjustments/i)).toBeDefined();
    
    const wantsDiv = screen.getByText(/Decrease Wants:/i).closest('div');
    expect(wantsDiv.textContent).toContain('reduced by $300/mo');
    expect(wantsDiv.textContent).toContain('from $1,500 to $1,200/mo');

    const savingsDiv = screen.getByText(/Decrease Savings:/i).closest('div');
    expect(savingsDiv.textContent).toContain('reduced by $200/mo');
    expect(savingsDiv.textContent).toContain('from $1,500 to $1,300/mo');
  });

  test('proportional down payment scaling in getRebalanceStrategies and outcome screen', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5000, 1500, 1500, 1000);
    inputs.assets = {
      cash: 30000,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 200000
    };

    // Original home price = 500,000, down payment = 100,000 (20%)
    const buyHouseEv = {
      id: 'house-proportional-dp',
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

    inputs.lifeEvents = [buyHouseEv];
    runFireSimulation(inputs);

    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEv, 60);

    // Verify proportional down payment is calculated:
    // balanced price = priceBalanced, downPaymentBalanced = priceBalanced * 0.20
    const expectedBalancedDownPayment = Math.round(rebalanceData.affordablePriceBalanced * 0.20);
    expect(rebalanceData.downPaymentBalanced).toBe(expectedBalancedDownPayment);

    // Verify outcome screen displays this proportional down payment
    const handleApplyRebalanceStrategy = vi.fn();
    render(
      <HouseRebalanceModal
        houseRebalanceSummary={{
          ...rebalanceData,
          selectedAffordablePrice: rebalanceData.affordablePriceBalanced,
          selectedOption: 'balanced'
        }}
        setHouseRebalanceSummary={vi.fn()}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    // Click Update House Purchase to see outcome screen
    const updateBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    fireEvent.click(updateBtn);

    // Expect to see the proportional down payment on the outcome screen
    const formattedExpectedDp = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(expectedBalancedDownPayment);
    const escapedDp = formattedExpectedDp.replace(/\$/g, '\\$');
    expect(screen.getAllByText(new RegExp(escapedDp, 'i')).length).toBeGreaterThanOrEqual(1);
  });

  test('Home Purchase Accounting: down payment, principal amortization, expenses, and retirement ready delays', async () => {
    const inputs = setupBaseInputs();
    inputs.assets.brokerage = 200000;
    inputs.assets.cash = 100000;

    const buyHouseEvent = {
      id: 'house-event-accounting',
      type: 'buyHouse',
      enabled: true,
      name: 'Moderate Home Purchase',
      purchaseAge: 40,
      homePrice: 269493,
      downPayment: 53899,
      purchaseType: 'mortgage',
      mortgageRate: 6.5,
      loanTerm: 30,
      propertyTax: 1.1,
      insurance: 0.35,
      maintenance: 1.0,
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEvent];
    const results = runFireSimulation(inputs);

    const logBefore = results.nominalData.find(l => l.age === 39);
    const logPurchase = results.nominalData.find(l => l.age === 40);
    const logAfter = results.nominalData.find(l => l.age === 41);

    expect(logBefore).toBeDefined();
    expect(logPurchase).toBeDefined();
    expect(logAfter).toBeDefined();

    // 1. Down payment reduces liquid assets but increases home equity.
    const liquidBefore = logBefore.portfolio + logBefore.cashBalance;
    const liquidPurchase = logPurchase.portfolio + logPurchase.cashBalance;
    const expectedDownPayment = 53899;
    expect(liquidPurchase).toBeLessThan(liquidBefore - expectedDownPayment);
    expect(logPurchase.homeEquity).toBeGreaterThanOrEqual(expectedDownPayment);

    // 2. Net worth does not drop by the full down payment.
    const netWorthDrop = logBefore.netWorth - logPurchase.netWorth;
    expect(netWorthDrop).toBeLessThan(expectedDownPayment);

    // 3. Mortgage principal payments increase equity and decrease mortgage balance
    const mortgageBalPurchase = logPurchase.mortgageBalance;
    const mortgageBalAfter = logAfter.mortgageBalance;
    expect(mortgageBalAfter).toBeLessThan(mortgageBalPurchase);

    const equityPurchase = logPurchase.homeEquity;
    const equityAfter = logAfter.homeEquity;
    expect(equityAfter).toBeGreaterThan(equityPurchase);

    // 4. A moderate home purchase delays retirement rather than automatically making retirement impossible.
    expect(results.retirementReadyAge).not.toBeNull();
    expect(results.retirementReadyAge).toBeLessThan(85);
  });

  test('getOldRentBeforePurchase fallback resolves correctly and shows correct increase in UI warning', () => {
    const handleApplyRebalanceStrategy = vi.fn();
    
    // Simulate simple inputs without budgetDetails.phases
    const mockSummary = {
      purchaseAge: 40,
      currentHomePrice: 500000,
      selectedAffordablePrice: 269493,
      selectedOption: 'balanced',
      affordablePriceConservative: 200000,
      affordablePriceBalanced: 269493,
      affordablePriceAggressive: 350000,
      affordablePaymentBalanced: 1913,
      totalCashNeededBalanced: 53899,
      liquidFundsAvailable: 30000,
      baselineRetirementAge: 60,
      balancedRetirementAge: null, // "Not achievable"
      originalWants: 642,
      originalSavings: 625,
      wantsReductionBalanced: 225,
      savingsReductionBalanced: 188,
      newWantsBalanced: 417,
      newSavingsBalanced: 437,
      piBalanced: 1363,
      oldHousingCost: 1500, // resolved from fallback
      deficit: 1028
    };

    render(
      <HouseRebalanceModal
        houseRebalanceSummary={mockSummary}
        setHouseRebalanceSummary={vi.fn()}
        handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
      />
    );

    // Click Update House Purchase to transition to the outcome screen
    const updateBtn = screen.getByRole('button', { name: /Update House Purchase/i });
    fireEvent.click(updateBtn);

    // Verify outcome details
    expect(screen.getByText(/Total Housing Cost:/i)).toBeDefined();
    expect(screen.getByText(/\$1,913\/mo/i)).toBeDefined();

    // Verify the warning box displays correct increase: 1913 - 1500 = 413/mo (not 3549/mo or 1913/mo)
    const warningText = screen.getByText(/Housing cost increased by/i);
    expect(warningText.textContent).toContain('Housing cost increased by $413/mo');
    expect(warningText.textContent).toContain('savings dropped by $188/mo');
  });

  test('HouseImpactModal renders correctly with no budget adjustments', () => {
    const mockImpact = {
      housingCostChange: -80,
      wantsReduction: 0,
      savingsReduction: 0,
      totalCashFlowImprovement: 80,
      baselineRetirementAge: 60,
      newRetirementAge: 60,
      retirementReadyAge: 60,
      isAffordable: true
    };

    render(
      <HouseImpactModal
        houseImpactSummary={mockImpact}
        setHouseImpactSummary={vi.fn()}
      />
    );

    // Verify Title
    expect(screen.getByText(/🏠 Home Purchase Added!/i)).toBeDefined();

    // Verify Housing Cost Change
    const hcRow = screen.getByText(/Housing Cost Change:/i).closest('div');
    expect(hcRow.textContent).toContain('-$80/mo');

    // Verify Budget Adjustments is +$0/mo
    const baRow = screen.getByText(/Budget Adjustments:/i).closest('div');
    expect(baRow.textContent).toContain('+$0/mo');

    // Verify Total Cash Flow Improvement
    const cfRow = screen.getByText(/Total Cash Flow Improvement:/i).closest('div');
    expect(cfRow.textContent).toContain('+$80/mo');

    // Verify Retirement Impact
    const riRow = screen.getByText(/Retirement Impact:/i).closest('div');
    expect(riRow.textContent).toContain('Unchanged (Age 60)');
  });

  test('HouseImpactModal renders correctly with Wants and Savings adjustments', () => {
    const mockImpact = {
      housingCostChange: -80,
      wantsReduction: 225,
      savingsReduction: 188,
      totalCashFlowImprovement: 493,
      baselineRetirementAge: 60,
      newRetirementAge: 62,
      retirementReadyAge: 62,
      isAffordable: true
    };

    render(
      <HouseImpactModal
        houseImpactSummary={mockImpact}
        setHouseImpactSummary={vi.fn()}
      />
    );

    // Verify Housing Cost Change
    const hcRow = screen.getByText(/Housing Cost Change:/i).closest('div');
    expect(hcRow.textContent).toContain('-$80/mo');

    // Verify Wants and Savings Reductions are displayed separately
    const wantsRow = screen.getByText(/• Wants Reduction:/i).closest('div');
    expect(wantsRow.textContent).toContain('+$225/mo');

    const savingsRow = screen.getByText(/• Savings Reduction:/i).closest('div');
    expect(savingsRow.textContent).toContain('+$188/mo');

    // Verify Budget Adjustments list heading/placeholder is NOT displayed
    expect(screen.queryByText(/^Budget Adjustments:$/i)).toBeNull();

    // Verify Total Cash Flow Improvement
    const cfRow = screen.getByText(/Total Cash Flow Improvement:/i).closest('div');
    expect(cfRow.textContent).toContain('+$493/mo');

    // Verify Retirement Impact shows transition
    const riRow = screen.getByText(/Retirement Impact:/i).closest('div');
    expect(riRow.textContent).toContain('60 → 62');
  });

  test('Affordable home purchase does not trigger automatic wants/savings adjustments', () => {
    const inputs = setupBaseInputs();
    setupCustomPhase(inputs, 5500, 1500, 1500, 1500); // income 5.5k, wants 1.5k, savings 1.5k, rent 1.5k
    inputs.assets = { cash: 60000, emergencyFund: 0, brokerage: 0 };

    const buyHouseEv = {
      id: 'affordable-house',
      type: 'buyHouse',
      enabled: true,
      purchaseAge: 40,
      homePrice: 200000,
      downPayment: 40000,
      purchaseType: 'mortgage',
      mortgageRate: 6.5,
      loanTerm: 30,
      propertyTax: 1.1,
      insurance: 0.35,
      maintenance: 1.0,
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEv];

    // Compute rebalance strategies - it should not trigger wants/savings reductions
    const results = runFireSimulation(inputs);
    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEv, results.retirementReadyAge);

    // Since the house is affordable, rebalanceData should be null (meaning no deficit/rebalancing needed)
    expect(rebalanceData).toBeNull();
  });

  test('Home Purchase Accounting Verification Scenario: $200k, $40k down, $6k closing costs, $160k mortgage', () => {
    const inputs = setupBaseInputs();
    inputs.assets.brokerage = 100000;
    inputs.assets.cash = 50000;
    inputs.assets.realEstate = 0;
    inputs.assets.debts = 0;

    const buyHouseEvent = {
      id: 'house-event-200k',
      type: 'buyHouse',
      enabled: true,
      name: 'Moderate Home Purchase',
      purchaseAge: 40,
      homePrice: 200000,
      downPayment: 40000,
      purchaseType: 'mortgage',
      mortgageRate: 6.5,
      loanTerm: 30,
      propertyTax: 0,
      insurance: 0,
      maintenance: 0,
      closingCosts: 3, // 3% of 200k = 6k
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEvent];
    inputs.houseAssets = [
      {
        id: 'house-event-200k',
        homePrice: 200000,
        downPayment: 40000,
        purchaseType: 'mortgage',
        closingCosts: 3,
        mortgageRate: 6.5,
        loanTerm: 30,
        propertyTax: 0,
        insurance: 0,
        maintenance: 0,
        hoa: 0,
        pmi: 0
      }
    ];

    const results = runFireSimulation(inputs);

    const logBefore = results.nominalData.find(l => l.age === 39);
    const logPurchase = results.nominalData.find(l => l.age === 40);

    expect(logBefore).toBeDefined();
    expect(logPurchase).toBeDefined();

    // 1. Home purchase accounting verification
    expect(logPurchase.homeValue).toBe(206000); // appreciated from 200k during the year
    expect(logPurchase.mortgageBalance).toBeLessThan(160000);
    expect(logPurchase.homeEquity).toBeGreaterThan(45000);

    const liquidBefore = logBefore.portfolio + logBefore.cashBalance;
    const liquidPurchase = logPurchase.portfolio + logPurchase.cashBalance;
    expect(liquidBefore - liquidPurchase).toBeGreaterThanOrEqual(40000); // down payment + closing costs offset by year's growth/savings

    const debugInfo = logPurchase.homeAccountingDebug;
    expect(debugInfo).toBeDefined();
    expect(debugInfo.purchasePrice).toBe(200000);
    expect(debugInfo.downPaymentUsed).toBe(40000);
    expect(debugInfo.closingCostsPaid).toBe(6000);
    expect(debugInfo.mortgageOriginalBalance).toBe(160000);
    expect(debugInfo.netWorthImpactFromPurchase).toBe(-6000);

    // 2. Ledger entries matching the required sections
    const ledgerRows = logPurchase.netWorthLedger.rows;
    const homeActivityRows = ledgerRows.filter(r => r.section === 'homeActivity');

    const homeAssetAdded = homeActivityRows.find(r => r.label === 'Home Value');
    expect(homeAssetAdded).toBeDefined();
    expect(homeAssetAdded.value).toBe(200000);
    expect(homeAssetAdded.type).toBe('neutral');
    expect(homeAssetAdded.subgroup).toBe('homePurchased');

    const mortgageAdded = homeActivityRows.find(r => r.label === 'Mortgage');
    expect(mortgageAdded).toBeDefined();
    expect(mortgageAdded.value).toBe(-160000);
    expect(mortgageAdded.type).toBe('negative');
    expect(mortgageAdded.subgroup).toBe('homePurchased');

    const homeEquityCreated = homeActivityRows.find(r => r.label === 'Initial Equity');
    expect(homeEquityCreated).toBeDefined();
    expect(homeEquityCreated.value).toBe(40000);
    expect(homeEquityCreated.isSummary).toBe(true);
    expect(homeEquityCreated.type).toBe('neutral');
    expect(homeEquityCreated.subgroup).toBe('homePurchased');

    const cashToEquity = homeActivityRows.find(r => r.label === 'Cash → Home Equity');
    expect(cashToEquity).toBeDefined();
    expect(cashToEquity.value).toBe(40000);
    expect(cashToEquity.type).toBe('neutral');
    expect(cashToEquity.isTransfer).toBe(true);
    expect(cashToEquity.helperText).toContain('transferred from cash into home equity');
    expect(cashToEquity.subgroup).toBe('equityTransfer');

    const closingCostsPaid = homeActivityRows.find(r => r.label === 'Closing Costs Paid');
    expect(closingCostsPaid).toBeDefined();
    expect(closingCostsPaid.value).toBe(-6000);
    expect(closingCostsPaid.subgroup).toBe('purchaseCosts');

    const principalPaid = homeActivityRows.find(r => r.label === 'Principal Paid');
    expect(principalPaid).toBeDefined();
    expect(principalPaid.value).toBeGreaterThan(0);
    expect(principalPaid.subgroup).toBe('homeOwnership');

    const interestPaidRow = homeActivityRows.find(r => r.label === 'Interest Paid');
    expect(interestPaidRow).toBeDefined();
    expect(interestPaidRow.value).toBeLessThan(0);
    expect(interestPaidRow.subgroup).toBe('homeOwnership');

    // 4 & 5. Assets / Debt details
    expect(logPurchase.assets).toBeCloseTo(logPurchase.portfolio + logPurchase.homeValue, 0);
    expect(logPurchase.debt).toBeCloseTo(logPurchase.mortgageBalance, 0);

    // 6. Net worth formula verification
    expect(logPurchase.netWorth).toBeCloseTo(logPurchase.assets - logPurchase.debt, 0);
  });



  test('Targeted Net Worth Reconciliation Audit for Age 40 purchase', () => {
    // Exact scenario setup
    const inputs = setupBaseInputs();
    inputs.simpleIncome = 50000;
    inputs.simpleInvestments = 7500; // 15% savings rate
    inputs.assets.brokerage = 5000;
    inputs.assets.cash = 0;
    inputs.assets.realEstate = 0;
    inputs.assets.debts = 0;
    inputs.inflationRate = 3.0;
    inputs.expectedReturn = 7.0;

    const buyHouseEvent = {
      id: 'house-event-200k',
      type: 'buyHouse',
      enabled: true,
      name: 'Moderate Home Purchase',
      purchaseAge: 40,
      homePrice: 200000,
      downPayment: 40000,
      purchaseType: 'mortgage',
      mortgageRate: 6.5,
      loanTerm: 30,
      propertyTax: 0,
      insurance: 0,
      maintenance: 0,
      closingCosts: 3, // 3% of 200k = 6k
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEvent];
    inputs.houseAssets = [
      {
        id: 'house-event-200k',
        homePrice: 200000,
        downPayment: 40000,
        purchaseType: 'mortgage',
        closingCosts: 3,
        mortgageRate: 6.5,
        loanTerm: 30,
        propertyTax: 0,
        insurance: 0,
        maintenance: 0,
        hoa: 0,
        pmi: 0
      }
    ];

    const results = runFireSimulation(inputs);

    const logBefore = results.nominalData.find(l => l.age === 39);
    const logPurchase = results.nominalData.find(l => l.age === 40);

    const startingNetWorth = logBefore.netWorth;
    const displayedEndingNetWorth = logPurchase.netWorth;
    const ledgerRows = logPurchase.netWorthLedger.rows;

    const savingsContribution = ledgerRows.find(r => r.label === 'Savings')?.value || 0;
    const investmentGrowthContribution = ledgerRows.find(r => r.label === 'Investment Growth' || r.label === 'Investment Loss')?.value || 0;
    const homeAssetAdded = ledgerRows.find(r => r.label === 'Home Value')?.value || 0;
    const mortgageAdded = ledgerRows.find(r => r.label === 'Mortgage')?.value || 0;
    const downPaymentTransfer = ledgerRows.find(r => r.label === 'Cash → Home Equity')?.value || 0;

    const closingCostsImpact = ledgerRows.find(r => r.label === 'Closing Costs Paid')?.value || 0;
    const principalPaidImpact = ledgerRows.find(r => r.label === 'Principal Paid')?.value || 0;
    const homeAppreciationImpact = ledgerRows.find(r => r.label === 'Home Appreciation')?.value || 0;
    const interestPaidImpact = ledgerRows.find(r => r.label === 'Interest Paid')?.value || 0;

    const anyOtherNetWorthChanges = 0; // No other net worth changes in this scenario

    const reconciledNetWorth =
      startingNetWorth +
      savingsContribution +
      investmentGrowthContribution +
      closingCostsImpact +
      principalPaidImpact +
      homeAppreciationImpact +
      interestPaidImpact +
      anyOtherNetWorthChanges;

    const difference = displayedEndingNetWorth - reconciledNetWorth;

    console.log("=== TARGETED RECONCILIATION AUDIT (AGE 40) ===");
    console.log(JSON.stringify({
      startingNetWorth,
      savingsContribution,
      investmentGrowthContribution,
      homeAssetAdded,
      mortgageAdded,
      downPaymentTransfer,
      closingCostsImpact,
      principalPaidImpact,
      homeAppreciationImpact,
      interestPaidImpact,
      anyOtherNetWorthChanges,
      calculatedEndingNetWorth: reconciledNetWorth,
      displayedEndingNetWorth,
      difference
    }, null, 2));

    const isReconciled = Math.abs(reconciledNetWorth - displayedEndingNetWorth) < 0.01;
    if (!isReconciled) {
      throw new Error(
        `NET WORTH RECONCILIATION FAILED:
         Expected ${displayedEndingNetWorth}
         Calculated ${reconciledNetWorth}
         Difference ${difference}`
      );
    }

    expect(isReconciled).toBe(true);
  });

  test('resolveBuyHouseEvent and getSimulationValidationForPrice resolve and apply correct down payment and update debtList', async () => {
    const baseInputs = setupBaseInputs();
    baseInputs.lifeEvents = [
      {
        id: 'house-event-1',
        type: 'buyHouse',
        enabled: true,
        purchaseAge: 40,
        houseId: 'house-asset-1'
      }
    ];
    baseInputs.houseAssets = [
      {
        id: 'house-asset-1',
        homePrice: 500000,
        purchasePrice: 500000,
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 6.0,
        loanTerm: 30,
        propertyTaxRate: 1.1,
        insuranceCost: 1500,
        hoaCost: 0,
        utilitiesIncrease: 0,
        maintenanceRate: 1.0
      }
    ];
    baseInputs.debtList = [
      {
        id: 'mortgage-house-asset-1',
        name: '🏠 Mortgage',
        houseId: 'house-asset-1',
        balance: 400000,
        interestRate: 6.0,
        monthlyPayment: 2398
      }
    ];

    // 1. Verify resolveBuyHouseEvent merges asset properties
    const buyHouseEv = baseInputs.lifeEvents[0];
    const resolved = resolveBuyHouseEvent(buyHouseEv, baseInputs);
    expect(resolved.homePrice).toBe(500000);
    expect(resolved.downPayment).toBe(100000);
    expect(resolved.mortgageRate).toBe(6.0);
    expect(resolved.loanTerm).toBe(30);

    // 2. Verify getSimulationValidationForPrice updates debtList and houseAssets correctly
    const baselinePhases = getNormalizedPhases(baseInputs);
    const baselineResults = runFireSimulation(baseInputs);

    // Call getSimulationValidationForPrice for a new affordable price of 300,000
    // With down payment ratio of 20% (100k / 500k = 0.2), new down payment = 60,000
    // New mortgage principal = 240,000
    const level = 'balanced';
    const newPrice = 300000;

    const fireCalculations = await import('./src/fireCalculations.js');
    let capturedInputs = null;
    const originalRunSimulation = fireCalculations.runFireSimulation;

    const spy = vi.spyOn(fireCalculations, 'runFireSimulation').mockImplementation((tmpInputs) => {
      capturedInputs = tmpInputs;
      return originalRunSimulation(tmpInputs);
    });

    try {
      getSimulationValidationForPrice(
        newPrice,
        level,
        baseInputs,
        buyHouseEv,
        65,
        baseInputs,
        baselinePhases,
        baselineResults
      );

      expect(capturedInputs).not.toBeNull();

      // Verify updated house event
      const updatedEv = capturedInputs.lifeEvents.find(e => e.id === 'house-event-1');
      expect(updatedEv.homePrice).toBe(newPrice);
      expect(updatedEv.downPayment).toBe(60000);

      // Verify updated house asset
      const updatedAsset = capturedInputs.houseAssets.find(h => h.id === 'house-asset-1');
      expect(updatedAsset.homePrice).toBe(newPrice);
      expect(updatedAsset.downPayment).toBe(60000);

      // Verify updated mortgage in debtList
      const updatedDebt = capturedInputs.debtList.find(d => d.houseId === 'house-asset-1');
      expect(updatedDebt.balance).toBe(240000);
      expect(updatedDebt.payment).toBe(1439);
    } finally {
      spy.mockRestore();
    }
  });
});


