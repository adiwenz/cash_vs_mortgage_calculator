// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';

// Mock Recharts to avoid layout/sizable errors in jsdom
// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Clear Budget Allocations Feature', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Helper to find input elements by their nearby label text
  const getInputByWrapperText = (textRegex) => {
    const elements = screen.getAllByText(textRegex);
    for (const el of elements) {
      const wrapper = el.closest('.budget-input-row, .input-wrapper, .budget-input-row-container');
      if (wrapper) {
        const input = wrapper.querySelector('input, select');
        if (input && !input.readOnly) return input;
      }
    }
    throw new Error(`Could not find input associated with text matching: ${textRegex}`);
  };

  test('Should clear Needs, Wants, and Savings allocations to $0 individually', async () => {
    render(<FireSimulator />);

    // 1. Open Budget Modal
    const budgetBtn = screen.getByRole('button', { name: /Set Budget|Calculate from budget/i });
    fireEvent.click(budgetBtn);
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();

    // 2. Clear Needs section
    const needsCard = screen.getAllByText(/Needs/i)[0];
    fireEvent.click(needsCard);

    // Turn on editing for Needs
    const editNeedsBtn = screen.getByRole('button', { name: /Edit Needs →/i });
    fireEvent.click(editNeedsBtn);

    // Housing starts at 1500
    const housingInput = getInputByWrapperText(/Housing \(Rent\/Mortgage\)/i);
    expect(housingInput.value).toBe('1500');

    // Click "Clear"
    const clearNeedsBtn = screen.getByRole('button', { name: /^Clear$/i });
    fireEvent.click(clearNeedsBtn);

    // Verify Housing is now 0
    expect(housingInput.value).toBe('0');

    // 3. Clear Wants section
    const wantsCard = document.querySelector('.budget-modal-card .budget-card.wants') || screen.getAllByText(/Wants/i)[0];
    fireEvent.click(wantsCard);

    // Turn on editing for Wants
    const editWantsBtn = screen.getByRole('button', { name: /Edit Wants →/i });
    fireEvent.click(editWantsBtn);

    // Dining Out starts at 200
    const diningOutInput = getInputByWrapperText(/Dining Out/i);
    expect(diningOutInput.value).toBe('200');

    // Click "Clear"
    const clearWantsBtn = screen.getByRole('button', { name: /^Clear$/i });
    fireEvent.click(clearWantsBtn);

    // Verify Dining Out is now 0
    expect(diningOutInput.value).toBe('0');

    // 4. Clear Savings section
    const savingsCard = document.querySelector('.budget-modal-card .budget-card.save') || screen.getAllByText(/Save & Invest/i)[0];
    fireEvent.click(savingsCard);

    // Turn on editing for Savings
    const editSavingsBtn = screen.getByRole('button', { name: /Edit Savings →/i });
    fireEvent.click(editSavingsBtn);

    // Brokerage starts at 625
    const brokerageInput = getInputByWrapperText(/Taxable Brokerage/i);
    expect(brokerageInput.value).toBe('625');

    // Click "Clear"
    const clearSavingsBtn = screen.getByRole('button', { name: /^Clear$/i });
    fireEvent.click(clearSavingsBtn);

    // Verify Brokerage is now 0
    expect(brokerageInput.value).toBe('0');
  });
});
