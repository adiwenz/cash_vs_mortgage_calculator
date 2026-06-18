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

describe('Down Payment Affordability Warning & Solver - Desktop and Mobile UI tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
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
      { age: 40, cashBalance: 30000, brokerageBalance: 40000 }
    ]
  };

  test('Desktop Modal: Warning appears when down payment exceeds liquid assets, updates on click', () => {
    const setEditingEventMock = vi.fn();
    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000, // exceeds age 39 liquid assets (50k)
      mortgageRate: 6.5,
      loanTerm: 30,
      closingCosts: 3,
      propertyTax: 1.1,
      insurance: 0.35,
      hoa: 0,
      maintenance: 1.0,
      renovationCost: 0,
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
      />
    );

    // Verify warning is displayed
    expect(screen.getByText(/Down Payment Exceeds Available Liquid Assets/i)).toBeDefined();
    
    // Use text matching function to check warning content containing strong tags
    expect(screen.getByText((content, element) => {
      const hasText = (node) => node.textContent.includes('Your down payment of $100,000 exceeds your projected liquid assets at age 40 of $50,000');
      const nodeHasText = hasText(element);
      const childrenDontHaveText = Array.from(element.children).every(child => !hasText(child));
      return nodeHasText && childrenDontHaveText;
    })).toBeDefined();

    // Verify solver button is displayed
    const solverBtn = screen.getByRole('button', { name: /Update House Price to \$250,000/i });
    expect(solverBtn).toBeDefined();

    // Click solver button
    fireEvent.click(solverBtn);

    // Verify setEditingEventMock was called with the solved home price and down payment equal to liquid assets
    expect(setEditingEventMock).toHaveBeenCalledWith(expect.objectContaining({
      homePrice: 250000,
      downPayment: 50000
    }));
  });

  test('Desktop Modal: Displays "Using current liquid assets" when projections are unavailable', () => {
    const setEditingEventMock = vi.fn();
    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000, // exceeds current liquid assets (40k)
      mortgageRate: 6.5,
      loanTerm: 30
    };

    render(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEventMock}
        activeResults={null}
      />
    );

    // Verify fallback message is displayed
    expect(screen.getByText(/Using current liquid assets/i)).toBeDefined();
    expect(screen.getByText((content, element) => {
      const hasText = (node) => node.textContent.includes('Your down payment of $100,000 exceeds your projected liquid assets at age 40 of $40,000');
      const nodeHasText = hasText(element);
      const childrenDontHaveText = Array.from(element.children).every(child => !hasText(child));
      return nodeHasText && childrenDontHaveText;
    })).toBeDefined();

    // Verify solver button resolves based on fallback assets (40k)
    const solverBtn = screen.getByRole('button', { name: /Update House Price to \$200,000/i });
    expect(solverBtn).toBeDefined();
  });

  test('Desktop Modal: Solver button is hidden when downPaymentPercent <= 0 or liquidAssets <= 0', () => {
    const setEditingEventMock = vi.fn();
    
    // Scenario 1: Down payment percent is 0
    const editingEventZeroPct = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 0,
      mortgageRate: 6.5,
      loanTerm: 30
    };

    const { rerender } = render(
      <EventModalForm
        inputs={mockInputs}
        editingEvent={editingEventZeroPct}
        setEditingEvent={setEditingEventMock}
        activeResults={mockSimulationResults}
      />
    );

    // Down payment is 0, so it does not exceed liquid assets (50k). Warning shouldn't be shown.
    expect(screen.queryByText(/Down Payment Exceeds Available Liquid Assets/i)).toBeNull();

    // Scenario 2: Zero liquid assets
    const inputsZeroAssets = {
      currentAge: 35,
      assets: { cash: 0, brokerage: 0 }
    };
    const editingEventExceeding = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 10000, // exceeds 0 assets
      mortgageRate: 6.5,
      loanTerm: 30
    };

    rerender(
      <EventModalForm
        inputs={inputsZeroAssets}
        editingEvent={editingEventExceeding}
        setEditingEvent={setEditingEventMock}
        activeResults={null}
      />
    );

    // Warning should be displayed
    expect(screen.getByText(/Down Payment Exceeds Available Liquid Assets/i)).toBeDefined();
    // Solver button should be hidden (liquidAssets <= 0)
    expect(screen.queryByRole('button', { name: /Update House Price/i })).toBeNull();
  });

  test('Mobile Wizard: Warning appears and updates draft state on mobile views', () => {
    const editingEvent = {
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000,
      mortgageRate: 6.5,
      loanTerm: 30,
      isNew: false
    };

    render(
      <MobileEventWizard
        inputs={mockInputs}
        editingEvent={editingEvent}
        setEditingEvent={vi.fn()}
        baselineResults={mockSimulationResults}
      />
    );

    // Render starting at manage screen (step 8)
    expect(screen.getByText('Event Details')).toBeDefined();

    // Click "Edit Event Details" to go to step 3
    const editBtn = screen.getByText('Edit Event Details');
    fireEvent.click(editBtn);

    // Timing step
    expect(screen.getByText('When does this happen?')).toBeDefined();

    // Click Next to go to step 4
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn);

    // Now we are on step 4 details screen
    expect(screen.getByText('Configure details')).toBeDefined();

    // Verify mobile warning card appears
    expect(screen.getByText(/Down Payment Exceeds Available Liquid Assets/i)).toBeDefined();
    expect(screen.getByText((content, element) => {
      const hasText = (node) => node.textContent.includes('Your down payment of $100,000 exceeds your projected liquid assets at age 40 of $50,000');
      const nodeHasText = hasText(element);
      const childrenDontHaveText = Array.from(element.children).every(child => !hasText(child));
      return nodeHasText && childrenDontHaveText;
    })).toBeDefined();

    // Solver button click
    const solverBtn = screen.getByRole('button', { name: /Update House Price to \$250,000/i });
    expect(solverBtn).toBeDefined();

    fireEvent.click(solverBtn);

    // After click, home price updates to 250k, down payment to 50k, warning should disappear!
    expect(screen.queryByText(/Down Payment Exceeds Available Liquid Assets/i)).toBeNull();
  });
});
