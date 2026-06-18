// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import EventModalForm from './src/components/fire-simulator/EventModalForm';
import MobileEventWizard from './src/components/fire-simulator/MobileEventWizard';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('./src/components/fire-simulator/houseAffordabilityUtils', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    getSimulatedRetirementAge: (inputs, event) => {
      if (globalThis.__mockRetirementAge !== undefined) {
        return globalThis.__mockRetirementAge;
      }
      return original.getSimulatedRetirementAge(inputs, event);
    },
    calculateLiquidAssetsAtPurchaseAge: (inputs, age, results) => {
      if (globalThis.__mockLiquidAssets !== undefined) {
        return globalThis.__mockLiquidAssets;
      }
      return original.calculateLiquidAssetsAtPurchaseAge(inputs, age, results);
    },
    calculateTotalCashRequired: (event) => {
      if (globalThis.__mockTotalCashRequired !== undefined) {
        return globalThis.__mockTotalCashRequired;
      }
      return original.calculateTotalCashRequired(event);
    },
    calculateCashShortfall: (required, assets) => {
      if (globalThis.__mockCashShortfall !== undefined) {
        return globalThis.__mockCashShortfall;
      }
      return original.calculateCashShortfall(required, assets);
    }
  };
});


describe('House Cash Affordability Warning - Desktop and Mobile UI tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete globalThis.__mockRetirementAge;
    delete globalThis.__mockLiquidAssets;
    delete globalThis.__mockTotalCashRequired;
    delete globalThis.__mockCashShortfall;
  });

  const mockInputs = {
    currentAge: 35,
    assets: {
      cash: 10000,
      brokerage: 30000
    }
  };

  const mockSimulationResults = {
    nominalData: [
      { age: 39, cashBalance: 20000, brokerageBalance: 30000 }, // Total liquid at age 39 = 50k
      { age: 40, cashBalance: 30000, brokerageBalance: 40000 }  // Total liquid at age 40 = 70k
    ]
  };

  test('Desktop Modal: Warning appears when total cash required exceeds liquid assets, and click opens recommendations', () => {
    const setEditingEventMock = vi.fn();
    const setShowImprovementModalMock = vi.fn();
    
    // homePrice: 500000, downPayment: 100000, closingCosts: 3 (15000), renovationCost: 10000
    // Total cash required = 100000 + 15000 + 10000 = 125000
    // Projected liquid assets at age 40 = 70k. Shortfall = 55k
    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000,
      mortgageRate: 6.5,
      loanTerm: 30,
      closingCosts: 3,
      propertyTax: 1.1,
      insurance: 0.35,
      hoa: 0,
      maintenance: 1.0,
      renovationCost: 10000,
      utilitiesIncrease: 0,
      appreciationRate: 3.0,
      sellingCost: 6.0
    };

    render(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEventMock}
        activeResults={mockSimulationResults}
        setShowImprovementModal={setShowImprovementModalMock}
        onClose={vi.fn()}
      />
    );

    // Verify warning card header
    expect(screen.getByText(/Not Enough Liquid Assets/i)).toBeDefined();

    // Verify shortfall breakdown values are shown
    expect(screen.getAllByText(/\$125,000/).length).toBeGreaterThanOrEqual(1); // Total cash required
    expect(screen.getAllByText(/\$50,000/).length).toBeGreaterThanOrEqual(1);  // Projected liquid assets
    expect(screen.getAllByText(/\$75,000/).length).toBeGreaterThanOrEqual(1);  // Additional cash needed

    // Verify NO solver button exists (Update House Price)
    expect(screen.queryByRole('button', { name: /Update House Price/i })).toBeNull();
    expect(screen.queryByText(/Update House Price to/i)).toBeNull();

    // Verify recommendations action link is present
    const recLink = screen.getByRole('button', { name: /View Affordability Recommendations/i });
    expect(recLink).toBeDefined();

    // Click link and verify callback
    fireEvent.click(recLink);
    expect(setShowImprovementModalMock).toHaveBeenCalledWith(true);
  });

  test('Desktop Modal: Warning does not appear when total cash required is within liquid assets', () => {
    const setEditingEventMock = vi.fn();
    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 200000,
      downPayment: 40000, // closing costs = 6000. total required = 46000 <= 70000
      mortgageRate: 6.5,
      loanTerm: 30,
      closingCosts: 3
    };

    render(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEventMock}
        activeResults={mockSimulationResults}
      />
    );

    // Warning should be hidden
    expect(screen.queryByText(/Not Enough Liquid Assets/i)).toBeNull();
  });

  test('Desktop Modal: Displays "Using current liquid assets" when projections are unavailable', () => {
    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000, // closing costs = 15000. total required = 115k000 > current liquid assets (40k)
      mortgageRate: 6.5,
      loanTerm: 30,
      closingCosts: 3
    };

    render(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={vi.fn()}
        activeResults={null}
      />
    );

    // Verify fallback message is displayed
    expect(screen.getByText(/Using current liquid assets/i)).toBeDefined();
    expect(screen.getByText(/\$40,000/)).toBeDefined(); // Current cash 10k + brokerage 30k
  });

  test('Mobile Wizard: Warning appears and View Affordability Recommendations dismisses wizard and opens modal', () => {
    const setShowImprovementModalMock = vi.fn();
    const onCloseMock = vi.fn();

    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000, // total required = 115000 > 70000
      mortgageRate: 6.5,
      loanTerm: 30,
      closingCosts: 3,
      isNew: false
    };

    render(
      <MobileEventWizard
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={vi.fn()}
        baselineResults={mockSimulationResults}
        setShowImprovementModal={setShowImprovementModalMock}
        onClose={onCloseMock}
      />
    );

    // Click "Edit Event Details" to go to step 3 (Wizard starts on summary step 8 for existing event)
    const editBtn = screen.getByText('Edit Event Details');
    fireEvent.click(editBtn);

    // Click Next on Timing (step 3) to go to step 4
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn);

    // Verify mobile warning card appears
    expect(screen.getByText(/Not Enough Liquid Assets/i)).toBeDefined();
    expect(screen.getAllByText(/\$115,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\$50,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\$65,000/).length).toBeGreaterThanOrEqual(1);

    // Verify NO solver button exists
    expect(screen.queryByRole('button', { name: /Update House Price/i })).toBeNull();

    // Click View Affordability Recommendations
    const recLink = screen.getByRole('button', { name: /View Affordability Recommendations/i });
    expect(recLink).toBeDefined();

    fireEvent.click(recLink);

    // Verify wizard onClose is called to dismiss and showImprovementModal is triggered
    expect(onCloseMock).toHaveBeenCalled();
    expect(setShowImprovementModalMock).toHaveBeenCalledWith(true);
  });

  test('Desktop Modal: CTA button text changes based on shortfall/delay and recommendationApplied', () => {
    // 1. With cash shortfall -> Review Options
    globalThis.__mockLiquidAssets = 100000;
    globalThis.__mockTotalCashRequired = 150000; // shortfall = 50000
    globalThis.__mockCashShortfall = 50000;
    globalThis.__mockRetirementAge = 65;

    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000,
      recommendationApplied: false
    };

    const { rerender } = render(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={vi.fn()}
        activeResults={mockSimulationResults}
        baselineResults={{ retirementReadyAge: 65 }}
        setShowImprovementModal={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Review Options/i })).toBeDefined();

    // 2. No shortfall but has retirement delay, recommendation NOT applied -> Save & Adjust Retirement
    globalThis.__mockTotalCashRequired = 80000; // no shortfall
    globalThis.__mockCashShortfall = 0;
    globalThis.__mockRetirementAge = 70; // delayed (baseline = 65)

    const editingEvent2 = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 400000,
      downPayment: 80000,
      recommendationApplied: false
    };

    rerender(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent2}
        setEditingEvent={vi.fn()}
        activeResults={mockSimulationResults}
        baselineResults={{ retirementReadyAge: 65 }}
        setShowImprovementModal={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Save & Adjust Retirement/i })).toBeDefined();

    // 3. No shortfall, has retirement delay, recommendation applied -> Save & Adjust Retirement (but allows saving)
    const editingEvent3 = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 400000,
      downPayment: 80000,
      recommendationApplied: true
    };

    rerender(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent3}
        setEditingEvent={vi.fn()}
        activeResults={mockSimulationResults}
        baselineResults={{ retirementReadyAge: 65 }}
        setShowImprovementModal={vi.fn()}
      />
    );

    // Button should still say Save & Adjust Retirement
    expect(screen.getByRole('button', { name: /Save & Adjust Retirement/i })).toBeDefined();

    // 4. No shortfall, no retirement delay -> Save Home Purchase
    globalThis.__mockRetirementAge = 65; // not delayed

    const editingEvent4 = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 390000,
      downPayment: 80000,
      recommendationApplied: false
    };

    rerender(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent4}
        setEditingEvent={vi.fn()}
        activeResults={mockSimulationResults}
        baselineResults={{ retirementReadyAge: 65 }}
        setShowImprovementModal={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Save Home Purchase/i })).toBeDefined();
  });

  test('Desktop Modal: Modifying inputs to create a shortfall resets recommendationApplied', async () => {
    globalThis.__mockLiquidAssets = 100000;
    globalThis.__mockTotalCashRequired = 80000; // no shortfall initially
    globalThis.__mockCashShortfall = 0;
    globalThis.__mockRetirementAge = 65;

    const setEditingEventMock = vi.fn();

    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 400000,
      downPayment: 80000,
      recommendationApplied: true
    };

    const { rerender } = render(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEventMock}
        activeResults={mockSimulationResults}
        baselineResults={{ retirementReadyAge: 65 }}
        setShowImprovementModal={vi.fn()}
      />
    );

    // Initially recommendationApplied is true, no shortfall -> button is Save Home Purchase
    expect(screen.getByRole('button', { name: /Save Home Purchase/i })).toBeDefined();

    // Now simulate user changing input to create a shortfall (e.g. increase price)
    globalThis.__mockTotalCashRequired = 150000; // shortfall created
    globalThis.__mockCashShortfall = 50000;

    const editingEventModified = {
      ...editingEvent,
      homePrice: 600000, // increased price
    };

    rerender(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEventModified}
        setEditingEvent={setEditingEventMock}
        activeResults={mockSimulationResults}
        baselineResults={{ retirementReadyAge: 65 }}
        setShowImprovementModal={vi.fn()}
      />
    );

    // The useEffect should trigger setEditingEvent to set recommendationApplied to false
    expect(setEditingEventMock).toHaveBeenCalled();
    const updater = setEditingEventMock.mock.calls[0][0];
    const nextState = updater(editingEventModified);
    expect(nextState.recommendationApplied).toBe(false);
  });
});
