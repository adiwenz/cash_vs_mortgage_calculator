// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';

// Mock Recharts to avoid layout/sizable errors in jsdom
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => <div data-testid="Line" />,
    XAxis: () => <div data-testid="XAxis" />,
    YAxis: () => <div data-testid="YAxis" />,
    CartesianGrid: () => <div data-testid="CartesianGrid" />,
    Tooltip: () => <div data-testid="Tooltip" />,
    Legend: () => <div data-testid="Legend" />,
    ReferenceLine: () => <div data-testid="ReferenceLine" />,
    AreaChart: ({ children }) => <div data-testid="AreaChart">{children}</div>,
    Area: () => <div data-testid="Area" />,
  };
});

// Mock ResizeObserver
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

    const currentAgeInput = screen.getByPlaceholderText('e.g. 35');
    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');
    const currentSavingsInput = screen.getByPlaceholderText('e.g. 250000');

    expect(currentAgeInput.value).toBe('35');
    expect(annualIncomeInput.value).toBe('50000');
    expect(preTaxSavingsRateInput.value).toBe('15'); // (50000 - 42500) / 50000 = 15%
    expect(currentSavingsInput.value).toBe('5000');
  });

  test('clicking starting inputs resets their value to null (renders as empty)', () => {
    render(<FireSimulator />);

    const currentAgeInput = screen.getByPlaceholderText('e.g. 35');
    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');
    const currentSavingsInput = screen.getByPlaceholderText('e.g. 250000');

    // Reset Current Age
    fireEvent.click(currentAgeInput);
    expect(currentAgeInput.value).toBe('');

    // Reset Annual Income
    fireEvent.click(annualIncomeInput);
    expect(annualIncomeInput.value).toBe('');

    // Reset Pre-Tax Savings Rate
    fireEvent.click(preTaxSavingsRateInput);
    expect(preTaxSavingsRateInput.value).toBe('');

    // Reset Current Savings
    fireEvent.click(currentSavingsInput);
    expect(currentSavingsInput.value).toBe('');
  });

  test('typing custom values in starting inputs works correctly', () => {
    render(<FireSimulator />);

    const currentAgeInput = screen.getByPlaceholderText('e.g. 35');
    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');
    const currentSavingsInput = screen.getByPlaceholderText('e.g. 250000');

    // Age
    fireEvent.click(currentAgeInput);
    fireEvent.change(currentAgeInput, { target: { value: '42' } });
    expect(currentAgeInput.value).toBe('42');

    // Income
    fireEvent.click(annualIncomeInput);
    fireEvent.change(annualIncomeInput, { target: { value: '100000' } });
    expect(annualIncomeInput.value).toBe('100000');

    // Savings Rate
    fireEvent.click(preTaxSavingsRateInput);
    fireEvent.change(preTaxSavingsRateInput, { target: { value: '30' } });
    expect(preTaxSavingsRateInput.value).toBe('30');

    // Savings Value
    fireEvent.click(currentSavingsInput);
    fireEvent.change(currentSavingsInput, { target: { value: '150000' } });
    expect(currentSavingsInput.value).toBe('150000');
  });

  test('blurring the savings rate field without typing restores the calculated rate', () => {
    render(<FireSimulator />);

    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    expect(preTaxSavingsRateInput.value).toBe('15');

    // Focus/Click to reset
    fireEvent.click(preTaxSavingsRateInput);
    expect(preTaxSavingsRateInput.value).toBe('');

    // Blur without typing
    fireEvent.blur(preTaxSavingsRateInput);
    expect(preTaxSavingsRateInput.value).toBe('15');
  });

  test('typing in savings rate and blurring preserves the new calculated rate', () => {
    render(<FireSimulator />);

    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    // Click and type 30
    fireEvent.click(preTaxSavingsRateInput);
    fireEvent.change(preTaxSavingsRateInput, { target: { value: '30' } });
    expect(preTaxSavingsRateInput.value).toBe('30');

    // Blur
    fireEvent.blur(preTaxSavingsRateInput);
    expect(preTaxSavingsRateInput.value).toBe('30');
  });

  test('changing the income field preserves the savings rate and scales expenses', () => {
    render(<FireSimulator />);

    const annualIncomeInput = screen.getByPlaceholderText('e.g. 120000');
    const preTaxSavingsRateInput = screen.getByPlaceholderText('e.g. 20');

    // Default rate is 15% (derived from 50k income, 42.5k expenses)
    expect(preTaxSavingsRateInput.value).toBe('15');

    // Click income field (resets to empty)
    fireEvent.click(annualIncomeInput);
    expect(annualIncomeInput.value).toBe('');

    // Type new income 100000
    fireEvent.change(annualIncomeInput, { target: { value: '100000' } });
    expect(annualIncomeInput.value).toBe('100000');

    // Blur income field
    fireEvent.blur(annualIncomeInput);

    // Savings rate should still be 15%
    expect(preTaxSavingsRateInput.value).toBe('15');
  });
});
