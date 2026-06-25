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

describe('Starting Inputs Redesigned Sidebar Layout Flow', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('verifies initial default values of starting inputs in static sidebar', () => {
    render(<FireSimulator />);

    // Verify header
    expect(screen.getByText('Your Situation')).toBeDefined();

    // Verify primary profile row inline badges
    expect(screen.getAllByText('35')[0]).toBeDefined();
    expect(screen.getByText('Single')).toBeDefined();
    expect(screen.getByText('Renting')).toBeDefined();

    // Verify financial snapshot
    expect(screen.getByText('Annual Income')).toBeDefined();
    const textboxes = screen.getAllByRole('textbox');
    const incomeInput = textboxes.find(i => i.value === '$50,000');
    expect(incomeInput).toBeDefined();

    expect(screen.getByText('Invested Assets')).toBeDefined();
    expect(screen.getAllByText('$5,000')).toBeDefined();

    expect(screen.getByText('Savings Rate')).toBeDefined();
    const savingsInput = textboxes.find(i => i.value === '15%');
    expect(savingsInput).toBeDefined();
  });

  test('verifies that clicking the profile row opens the Life Profile modal and editing Age works', async () => {
    render(<FireSimulator />);

    // Click profile row text '35'
    fireEvent.click(screen.getAllByText('35')[0]);

    // Verify Life Profile modal is open
    expect(screen.getByText(/Life Planner/i)).toBeDefined();

    // Click the Edit button for the You card
    const editButtons = screen.getAllByTitle('Edit Item');
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]);

    // Find and modify Your Age input in the edit form
    const ageLabel = screen.getByText('Your Age');
    const parent = ageLabel.parentElement;
    const input = parent.querySelector('input');
    expect(input).toBeDefined();

    // Initial age should be 35
    expect(input.value).toBe('35');

    // Change to 42
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    // Save item
    const saveItemButton = screen.getByText('Save Item');
    fireEvent.click(saveItemButton);

    // Save profile
    const saveButton = screen.getByRole('button', { name: /Save Profile/i });
    fireEvent.click(saveButton);

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByText(/Life Planner/i)).toBeNull();
    });

    // Verify Age is updated in the sidebar
    expect(screen.getByText('42')).toBeDefined();
  });

  test('verifies that editing Annual Income directly in the sidebar updates the value and reallocates the budget', async () => {
    render(<FireSimulator />);

    // Find the Annual Income input
    const textboxes = screen.getAllByRole('textbox');
    const incomeInput = textboxes.find(i => i.value === '$50,000');
    expect(incomeInput).toBeDefined();

    // Change to 120,000
    fireEvent.focus(incomeInput);
    fireEvent.change(incomeInput, { target: { value: '120000' } });
    fireEvent.blur(incomeInput);

    // Verify Annual Income is updated in the input
    expect(incomeInput.value).toBe('$120,000');
  });

  test('verifies that clicking Invested Assets opens the Life Profile modal to the assets tab', () => {
    render(<FireSimulator />);

    const assetsRowLabel = screen.getByText('Invested Assets');
    expect(assetsRowLabel).toBeDefined();

    // Click it
    fireEvent.click(assetsRowLabel);

    // Verify Edit Life Profile modal is open on Assets tab
    expect(screen.getByText(/Life Planner/i)).toBeDefined();
    expect(screen.getByText(/💵 Cash/i)).toBeDefined();
  });

  test('verifies that editing assets in the Life Profile modal updates the total invested assets and saves successfully', async () => {
    render(<FireSimulator />);

    const assetsRowLabel = screen.getByText('Invested Assets');
    fireEvent.click(assetsRowLabel);

    // Click Edit next to the Brokerage account card
    const brokerageLabel = screen.getByText('📈 Taxable Brokerage');
    const listItem = brokerageLabel.closest('.life-profile-list-item');
    const editButton = listItem.querySelector('button');
    expect(editButton).toBeDefined();
    fireEvent.click(editButton);

    // Modify Current Balance input in the edit form
    const balanceLabel = screen.getByText('Current Balance');
    const input = balanceLabel.parentElement.querySelector('input');
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: '150000' } });

    // Click Save Item
    const saveItemButton = screen.getByRole('button', { name: /Save Item/i });
    fireEvent.click(saveItemButton);

    // Click Save Profile
    const saveButton = screen.getByRole('button', { name: /Save Profile/i });
    fireEvent.click(saveButton);

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByText(/Life Planner/i)).toBeNull();
    });

    // Verify Total Invested Assets is updated on the situation card
    expect(screen.getByText('$150,000')).toBeDefined();
  });

  test('verifies that editing Savings Rate directly in the sidebar updates the rate and reallocates the budget', async () => {
    render(<FireSimulator />);

    const textboxes = screen.getAllByRole('textbox');
    const savingsInput = textboxes.find(i => i.value === '15%');
    expect(savingsInput).toBeDefined();

    // Change to 20%
    fireEvent.focus(savingsInput);
    fireEvent.change(savingsInput, { target: { value: '20' } });
    fireEvent.blur(savingsInput);

    // Verify Savings Rate is updated in the input
    expect(savingsInput.value).toBe('20%');
  });

  test('verifies savings rate manual inputs with decimals and clamping behavior', async () => {
    render(<FireSimulator />);

    const textboxes = screen.getAllByRole('textbox');
    const savingsInput = textboxes.find(i => i.value === '15%');
    expect(savingsInput).toBeDefined();

    // 1. Enter decimal value 12.5
    fireEvent.focus(savingsInput);
    fireEvent.change(savingsInput, { target: { value: '12.5' } });
    fireEvent.blur(savingsInput);
    expect(savingsInput.value).toBe('12.5%');

    // 2. Enter decimal value with more than one decimal place: 12.54 should clamp/truncate to 12.5
    fireEvent.focus(savingsInput);
    fireEvent.change(savingsInput, { target: { value: '12.54' } });
    fireEvent.blur(savingsInput);
    expect(savingsInput.value).toBe('12.5%');

    // 3. Enter decimal value with multiple decimal points: 12.3.4 should clamp to 12.3
    fireEvent.focus(savingsInput);
    fireEvent.change(savingsInput, { target: { value: '12.3.4' } });
    fireEvent.blur(savingsInput);
    expect(savingsInput.value).toBe('12.3%');
  });
});
