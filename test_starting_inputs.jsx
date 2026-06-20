// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';

// Mock Recharts to avoid layout/sizable errors in jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Starting Inputs Today Screen Reset/Type Flow', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('verifies initial default values of starting inputs', () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const currentAgeInput = screen.getByPlaceholderText('e.g. 35');
    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    expect(currentAgeInput.value).toBe('35');
    expect(annualIncomeInput.value).toBe('$50,000');
    expect(preTaxSavingsRateInput.value).toBe('15%');
    expect(screen.getByText('$5,000')).toBeDefined();
  });

  test('focusing starting inputs shows raw values and does not clear them', async () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const currentAgeInput = screen.getByPlaceholderText('e.g. 35');
    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    // Focus Current Age
    fireEvent.focus(currentAgeInput);
    await waitFor(() => expect(currentAgeInput.value).toBe('35'));

    // Focus Annual Income
    fireEvent.focus(annualIncomeInput);
    await waitFor(() => expect(annualIncomeInput.value).toBe('50000'));

    // Focus Pre-Tax Savings Rate
    fireEvent.focus(preTaxSavingsRateInput);
    await waitFor(() => expect(preTaxSavingsRateInput.value).toBe('15'));
  });

  test('typing custom values in starting inputs works correctly', async () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const currentAgeInput = screen.getByPlaceholderText('e.g. 35');
    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    // Age
    fireEvent.focus(currentAgeInput);
    fireEvent.change(currentAgeInput, { target: { value: '42' } });
    await waitFor(() => expect(currentAgeInput.value).toBe('42'));

    // Income
    fireEvent.focus(annualIncomeInput);
    fireEvent.change(annualIncomeInput, { target: { value: '100000' } });
    await waitFor(() => expect(annualIncomeInput.value).toBe('100000'));

    // Savings Rate
    fireEvent.focus(preTaxSavingsRateInput);
    fireEvent.change(preTaxSavingsRateInput, { target: { value: '30' } });
    await waitFor(() => expect(preTaxSavingsRateInput.value).toBe('30'));
  });

  test('focusing and blurring the savings rate field without typing keeps the calculated rate', async () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    expect(preTaxSavingsRateInput.value).toBe('15%');

    // Focus
    fireEvent.focus(preTaxSavingsRateInput);
    await waitFor(() => expect(preTaxSavingsRateInput.value).toBe('15'));

    // Blur without typing
    fireEvent.blur(preTaxSavingsRateInput);
    await waitFor(() => expect(preTaxSavingsRateInput.value).toBe('15%'));
  });

  test('typing in savings rate and blurring preserves the new calculated rate', async () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    // Focus and type 30
    fireEvent.focus(preTaxSavingsRateInput);
    fireEvent.change(preTaxSavingsRateInput, { target: { value: '30' } });
    await waitFor(() => expect(preTaxSavingsRateInput.value).toBe('30'));

    // Blur
    fireEvent.blur(preTaxSavingsRateInput);
    await waitFor(() => expect(preTaxSavingsRateInput.value).toBe('30%'));
  });

  test('changing the income field preserves the savings rate and scales expenses', async () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    // Default rate is 15% (derived from 50k income, 42.5k expenses)
    expect(preTaxSavingsRateInput.value).toBe('15%');

    // Focus income field
    fireEvent.focus(annualIncomeInput);
    await waitFor(() => expect(annualIncomeInput.value).toBe('50000'));

    // Type new income 100000
    fireEvent.change(annualIncomeInput, { target: { value: '100000' } });
    await waitFor(() => expect(annualIncomeInput.value).toBe('100000'));

    // Blur income field
    fireEvent.blur(annualIncomeInput);

    // Savings rate should still be 15%
    await waitFor(() => expect(preTaxSavingsRateInput.value).toBe('15%'));
  });

  test('verifies that clicking Total Invested Assets opens the Life Profile modal to the assets tab', () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const totalAssetsRow = screen.getByText('🏦 Total Invested Assets');
    expect(totalAssetsRow).toBeDefined();

    // Click it
    fireEvent.click(totalAssetsRow);

    // Verify Edit Life Profile modal is open on Assets tab
    expect(screen.getByText(/Edit Life Profile/i)).toBeDefined();
    expect(screen.getByText(/💵 Cash/i)).toBeDefined();
  });

  test('verifies that editing assets in the Life Profile modal updates the total invested assets and saves successfully', async () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const totalAssetsRow = screen.getByText('🏦 Total Invested Assets');
    fireEvent.click(totalAssetsRow);

    // Find and modify Taxable Brokerage input
    const brokerageLabel = screen.getByText('📈 Taxable Brokerage');
    const parent = brokerageLabel.parentElement;
    const input = parent.querySelector('input');
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: '150000' } });

    // Click Save Profile
    const saveButton = screen.getByRole('button', { name: /Save Profile/i });
    fireEvent.click(saveButton);

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByText(/Edit Life Profile/i)).toBeNull();
    });

    // Verify Total Invested Assets is updated on the situation card
    expect(screen.getByText('$150,000')).toBeDefined();
  });

  test('verifies that the Budget button next to Savings Rate opens the Budget modal', () => {
    render(<FireSimulator />);
    fireEvent.click(screen.getByText(/Current Situation/));

    const budgetButton = screen.getByRole('button', { name: /^Budget$/i });
    expect(budgetButton).toBeDefined();

    // Click budget button
    fireEvent.click(budgetButton);

    // Verify budget modal is open
    expect(screen.getByText(/Save Budget/i)).toBeDefined();
  });
});
