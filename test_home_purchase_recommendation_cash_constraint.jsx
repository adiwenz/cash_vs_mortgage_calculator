// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { getRebalanceStrategies } from './src/calculators/fire/rebalance.js';
import { calculateTotalCashRequired, isCashAffordable } from './src/components/fire-simulator/houseAffordabilityUtils.js';
import HouseRebalanceModal from './src/components/fire-simulator/HouseRebalanceModal.jsx';
import EventModalForm from './src/components/fire-simulator/EventModalForm/EventModalForm.jsx';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Home Purchase Recommendation Cash Constraint Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const setupTestScenario = ({ income, wants, savings, rent, homePrice, downPayment, liquidAssets, purchaseAge = 36 }) => {
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

  test('Test 1: Retirement sustainable price exceeds cash affordable price -> recommended price is capped at cash-affordable price', () => {
    const { inputs, event } = setupTestScenario({
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
    
    // Balanced recommendation should be capped by cash affordability (approx $60,869)
    expect(strategies.affordablePriceBalanced).toBeLessThan(100000);
    expect(strategies.constraint).toBe('cash');
  });

  test('Test 2: Cash affordable price exceeds retirement sustainable price -> recommended price is capped at retirement-sustainable price', () => {
    const { inputs, event } = setupTestScenario({
      income: 4500,
      wants: 1000,
      savings: 500,
      rent: 1000,
      homePrice: 500000,
      downPayment: 100000,
      liquidAssets: 1000000,
      purchaseAge: 36
    });

    const strategies = getRebalanceStrategies(inputs, event, 65);
    expect(strategies).not.toBeNull();
    
    // Balanced price should be limited by monthly retirement sustainability
    expect(strategies.affordablePriceBalanced).toBeLessThan(350000);
    expect(strategies.constraint).toBe('monthly');
  });

  test('Test 3: Recommended purchase satisfies totalCashRequired <= liquidAssets', () => {
    const { inputs, event } = setupTestScenario({
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

    const recommendedPrice = strategies.affordablePriceBalanced;
    const recommendedEvent = {
      ...event,
      homePrice: recommendedPrice,
      downPayment: strategies.downPaymentBalanced
    };

    const liquidAssets = strategies.liquidFundsAvailable;
    const totalCashRequired = calculateTotalCashRequired(recommendedEvent);
    expect(totalCashRequired).toBeLessThanOrEqual(liquidAssets);
  });

  test('Test 4: Recommended purchase satisfies additionalNeeded === 0 in UI', () => {
    const mockSummary = {
      deficit: 500,
      currentHomePrice: 500000,
      selectedOption: 'balanced',
      selectedAffordablePrice: 182600,
      affordablePriceBalanced: 182600,
      totalCashNeededBalanced: 49998,
      downPaymentBalanced: 36520,
      liquidFundsAvailable: 50000,
      totalCashNeeded: 123000,
      constraint: 'cash'
    };

    render(
      <HouseRebalanceModal
        houseRebalanceSummary={mockSummary}
        setHouseRebalanceSummary={vi.fn()}
        handleApplyRebalanceStrategy={vi.fn()}
      />
    );

    // Verify Constraint row displays 'Upfront Cash'
    expect(screen.getByText(/Constraint:/i)).toBeDefined();
    expect(screen.getByText(/Upfront Cash/i)).toBeDefined();

    // Verify explanation paragraph
    expect(screen.getByText(/available liquid assets at the purchase age are the limiting factor/i)).toBeDefined();

    // Verify Additional Needed is $0
    expect(screen.getByText(/Additional Needed:/i)).toBeDefined();
    const zeroElements = screen.getAllByText(/\$0/);
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
  });

  test('Test 5: Applying the recommendation updates the event so that isCashAffordable(...) === true', () => {
    const { inputs, event } = setupTestScenario({
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
    
    // Original event was NOT affordable
    const liquidAssets = strategies.liquidFundsAvailable;
    expect(isCashAffordable(event, liquidAssets)).toBe(false);

    // Create the updated event using the recommended Balanced values
    const recommendedEvent = {
      ...event,
      homePrice: strategies.affordablePriceBalanced,
      downPayment: strategies.downPaymentBalanced
    };

    // Recommended event MUST be affordable
    expect(isCashAffordable(recommendedEvent, liquidAssets)).toBe(true);
  });

  test('Test 6: Event editor warning disappears immediately after recommendation is applied', () => {
    const { inputs, event } = setupTestScenario({
      income: 5000,
      wants: 2000,
      savings: 1000,
      rent: 1000,
      homePrice: 400000,
      downPayment: 80000,
      liquidAssets: 10000,
      purchaseAge: 36
    });

    const setEditingEventMock = vi.fn();
    
    // Use real baseline results for activeResults
    const baselineInputs = JSON.parse(JSON.stringify(inputs));
    baselineInputs.lifeEvents = baselineInputs.lifeEvents.map(ev => ({ ...ev, enabled: false }));
    const mockSimulationResults = runFireSimulation(baselineInputs);

    const { rerender } = render(
      <EventModalForm
        inputs={inputs}
        editingEvent={event}
        setEditingEvent={setEditingEventMock}
        activeResults={mockSimulationResults}
        setShowImprovementModal={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Original event should show warning
    expect(screen.getByText(/Not Enough Liquid Assets/i)).toBeDefined();

    // Now update event to recommended price (which is cash affordable)
    const recommendedEvent = {
      ...event,
      homePrice: 50000,
      downPayment: 10000
    };

    rerender(
      <EventModalForm
        inputs={inputs}
        editingEvent={recommendedEvent}
        setEditingEvent={setEditingEventMock}
        activeResults={mockSimulationResults}
        setShowImprovementModal={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Warning should disappear
    expect(screen.queryByText(/Not Enough Liquid Assets/i)).toBeNull();
  });
});
