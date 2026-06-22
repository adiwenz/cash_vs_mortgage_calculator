// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import MobileHousePlanningModal from './src/components/fire-simulator/MobileHousePlanningModal.jsx';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Mobile Home Purchase Planning Wizard Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  test('1. Step 1 prefilled values and input editing', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 50000, brokerage: 0 }
      }
    };
    const eventController = {
      editingEvent: { id: 'buy-house-1', type: 'buyHouse', isNew: false, homePrice: 200000, purchaseAge: 40, downPayment: 40000 },
      handleSaveEvent: vi.fn(),
      handleDeleteEvent: vi.fn()
    };
    const simulation = {
      nominalData: [
        { age: 35, cashBalance: 50000, brokerageBalance: 0 },
        { age: 39, cashBalance: 50000, brokerageBalance: 0 }
      ]
    };

    render(
      <MobileHousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    // Assert congrats/header text
    expect(screen.getByText('Congrats! 🎉')).toBeDefined();
    expect(screen.getByText('You’re planning your new home.')).toBeDefined();

    // Verify prefilled values
    const priceInput = screen.getByLabelText('Home Price');
    expect(priceInput.value).toBe('200,000');

    const ageInput = screen.getByLabelText('Purchase Age');
    expect(ageInput.value).toBe('40');

    // Edit price and age
    fireEvent.change(priceInput, { target: { value: '250000' } });
    expect(priceInput.value).toBe('250,000');

    fireEvent.change(ageInput, { target: { value: '45' } });
    expect(ageInput.value).toBe('45');
  });

  test('2. Affordable price routes directly to Great News', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 1000000, brokerage: 0 } // huge cash, fully affordable
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, homePrice: 200000, purchaseAge: 40, downPayment: 40000 },
      handleSaveEvent: vi.fn(),
      handleDeleteEvent: vi.fn()
    };
    const simulation = {
      nominalData: [
        { age: 35, cashBalance: 1000000, brokerageBalance: 0 },
        { age: 39, cashBalance: 1000000, brokerageBalance: 0 }
      ]
    };

    render(
      <MobileHousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    // Click Continue
    const continueBtn = screen.getByRole('button', { name: /Continue →/i });
    fireEvent.click(continueBtn);

    // Verify it went straight to Great News confirmation screen
    expect(screen.getByText('Great News!')).toBeDefined();
    expect(screen.getByText('Your plan still works.')).toBeDefined();
    expect(screen.getByRole('button', { name: /Done/i })).toBeDefined();
  });

  test('3. Unaffordable price routes to Let’s make it fit your plan', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 5000, brokerage: 0 } // tiny cash, shortfall
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, homePrice: 500000, purchaseAge: 40, downPayment: 100000 },
      handleSaveEvent: vi.fn(),
      handleDeleteEvent: vi.fn()
    };
    const simulation = {
      nominalData: [
        { age: 35, cashBalance: 5000, brokerageBalance: 0 },
        { age: 39, cashBalance: 5000, brokerageBalance: 0 }
      ]
    };

    render(
      <MobileHousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    // Explicitly edit the Home Price to 500,000 to trigger unaffordable shortfall path
    const priceInput = screen.getByLabelText('Home Price');
    fireEvent.change(priceInput, { target: { value: '500000' } });

    // Click Continue
    const continueBtn = screen.getByRole('button', { name: /Continue →/i });
    fireEvent.click(continueBtn);

    // Verify it went to options screen
    expect(screen.getByText('Let’s make it fit your plan')).toBeDefined();
    expect(screen.getByText('You don’t currently have enough cash available for the down payment.')).toBeDefined();
  });

  test('4. Affordable option selection saves recommended price', async () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 5000, brokerage: 0 }
      }
    };
    const handleSaveEvent = vi.fn();
    const onClose = vi.fn();
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, homePrice: 500000, purchaseAge: 40, downPayment: 100000 },
      handleSaveEvent,
      handleDeleteEvent: vi.fn()
    };
    const simulation = {
      nominalData: [
        { age: 35, cashBalance: 5000, brokerageBalance: 0 },
        { age: 39, cashBalance: 5000, brokerageBalance: 0 }
      ]
    };

    render(
      <MobileHousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={onClose}
      />
    );

    // Manually edit the Home Price to 500,000 to trigger the options flow
    const priceInput = screen.getByLabelText('Home Price');
    fireEvent.change(priceInput, { target: { value: '500000' } });

    // Continue to options
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    // Option A (Affordable match) is selected by default. Let's click Continue
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    // We are on Great News summary. Click Done
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    // Verify save called with affordable price (which should be lower than original $500k)
    expect(handleSaveEvent).toHaveBeenCalled();
    const savedEvent = handleSaveEvent.mock.calls[0][0];
    expect(savedEvent.homePrice).toBeLessThan(500000);
    expect(savedEvent.optionBSelected).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  test('5. Keep-original option preserves original price and applies adjustments', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 5000, brokerage: 0 }
      }
    };
    const handleSaveEvent = vi.fn();
    const onClose = vi.fn();
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, homePrice: 500000, purchaseAge: 40, downPayment: 100000 },
      handleSaveEvent,
      handleDeleteEvent: vi.fn()
    };
    const simulation = {
      nominalData: [
        { age: 35, cashBalance: 5000, brokerageBalance: 0 },
        { age: 39, cashBalance: 5000, brokerageBalance: 0 }
      ]
    };

    render(
      <MobileHousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={onClose}
      />
    );

    // Manually edit the Home Price to 500,000 to trigger the options flow
    const priceInput = screen.getByLabelText('Home Price');
    fireEvent.change(priceInput, { target: { value: '500000' } });

    // Continue to options
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    // Select Option B (Keep original Home)
    const optionCards = screen.getAllByText(/Keep the/i);
    fireEvent.click(optionCards[0]); // Click option card

    // Click Continue
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    // Click Done
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    // Verify saved price is original $500k and Option B selected
    expect(handleSaveEvent).toHaveBeenCalled();
    const savedEvent = handleSaveEvent.mock.calls[0][0];
    expect(savedEvent.homePrice).toBe(500000);
    expect(savedEvent.optionBSelected).toBe(true);
    expect(savedEvent.shortfallAmount).toBeGreaterThan(0);
    expect(onClose).toHaveBeenCalled();
  });

  test('6. Cancel leaves no partial events', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 5000, brokerage: 0 }
      }
    };
    const handleSaveEvent = vi.fn();
    const onClose = vi.fn();
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, homePrice: 500000, purchaseAge: 40, downPayment: 100000 },
      handleSaveEvent,
      handleDeleteEvent: vi.fn()
    };
    const simulation = {
      nominalData: [
        { age: 35, cashBalance: 5000, brokerageBalance: 0 },
        { age: 39, cashBalance: 5000, brokerageBalance: 0 }
      ]
    };

    render(
      <MobileHousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={onClose}
      />
    );

    // Click Cancel on first screen
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(handleSaveEvent).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('7. Back preserves draft values', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 5000, brokerage: 0 }
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, homePrice: 200000, purchaseAge: 40, downPayment: 40000 },
      handleSaveEvent: vi.fn(),
      handleDeleteEvent: vi.fn()
    };
    const simulation = {
      nominalData: [
        { age: 35, cashBalance: 5000, brokerageBalance: 0 },
        { age: 39, cashBalance: 5000, brokerageBalance: 0 }
      ]
    };

    render(
      <MobileHousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    // Edit price and age
    const priceInput = screen.getByLabelText('Home Price');
    fireEvent.change(priceInput, { target: { value: '450000' } });

    const ageInput = screen.getByLabelText('Purchase Age');
    fireEvent.change(ageInput, { target: { value: '42' } });

    // Click Continue
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    // Click Back
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));

    // Verify values preserved
    expect(screen.getByLabelText('Home Price').value).toBe('450,000');
    expect(screen.getByLabelText('Purchase Age').value).toBe('42');
  });
});
