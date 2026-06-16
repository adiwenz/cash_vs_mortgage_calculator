// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import TodayScreen from './src/components/fire-simulator/TodayScreen';

describe('TodayScreen - Redesigned Mountain Peak Concept', () => {
  beforeEach(() => {
    cleanup();
  });

  const baseProps = {
    inputs: {
      currentAge: 35,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 92500, // surplus = $7,500
      simpleInvestments: 5000,
      lifeEvents: []
    },
    handleStep1Change: vi.fn(),
    handleSetBudgetClick: vi.fn(),
    handleOpenSavingsDetails: vi.fn(),
    lastNonZeroSavingsRateRef: { current: 15 },
    setActiveStep: vi.fn()
  };

  test('Renders mountain peak panel when no events exist', () => {
    const { container } = render(<TodayScreen {...baseProps} />);

    // Header and Copy
    expect(screen.getByText("Imagine Your Future")).toBeDefined();

    // Check SVG structure presence
    const svgElement = container.querySelector('svg');
    expect(svgElement).not.toBeNull();

    // Check that categories from the previous step are removed
    expect(screen.queryByText("Marriage")).toBeNull();
    expect(screen.queryByText("Children")).toBeNull();
    expect(screen.queryByText("Home Ownership")).toBeNull();
    expect(screen.queryByText("Career Changes")).toBeNull();
    expect(screen.queryByText("Debt Payoff")).toBeNull();
    expect(screen.queryByText("Retirement")).toBeNull();

    // CTA Button - should be Start Planning
    expect(screen.getByText("Start Planning →")).toBeDefined();
    expect(screen.queryByText("Continue Planning →")).toBeNull();

    // Ensure financial dashboard metrics are completely removed
    expect(screen.queryByText("Current Projection")).toBeNull();
    expect(screen.queryByText("Retirement Ready")).toBeNull();
    expect(screen.queryByText("Net Worth Today")).toBeNull();
  });

  test('Renders mountain peak panel and shows Continue Planning button when user events exist', () => {
    const props = {
      ...baseProps,
      inputs: {
        ...baseProps.inputs,
        lifeEvents: [
          { id: 'loan-1', type: 'borrowing', borrowingType: 'studentLoan', name: 'Student Loan', enabled: true },
          { id: 'marriage-1', type: 'marriage', name: 'Marriage', enabled: true },
          { id: 'child-1', type: 'haveChild', name: 'Child', enabled: true },
          { id: 'retire-1', type: 'retire', name: 'Retirement', enabled: true } // Excluded system event
        ]
      }
    };

    render(<TodayScreen {...props} />);

    // Header and Copy
    expect(screen.getByText("Imagine Your Future")).toBeDefined();

    // CTA Button - should be Continue Planning since user events exist
    expect(screen.getByText("Continue Planning →")).toBeDefined();
    expect(screen.queryByText("Start Planning →")).toBeNull();

    // Ensure category chips and list-items are completely absent
    expect(screen.queryByText("Student Loan")).toBeNull();
  });
});
