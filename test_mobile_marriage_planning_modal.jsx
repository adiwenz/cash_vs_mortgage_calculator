// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import MobileMarriagePlanningModal from './src/components/fire-simulator/MobileMarriagePlanningModal';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('MobileMarriagePlanningModal Component', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    scenario: {
      inputs: {
        ...DEFAULT_FIRE_INPUTS,
        currentAge: 30,
        lifeExpectancy: 85,
        simpleIncome: 60000,
        preTaxSavingsRate: 15,
        simpleExpenses: 40000
      }
    },
    eventController: {
      editingEvent: {
        type: 'marriage',
        isNew: true
      },
      handleSaveEvent: vi.fn(),
      handleDeleteEvent: vi.fn()
    },
    simulation: {
      baselineResults: {
        retirementReadyAge: 62
      }
    },
    uiState: {},
    onClose: vi.fn(),
    handleSetBudgetClick: vi.fn(),
    setIsBudgetOpenFromMarriageWizard: vi.fn()
  };

  test('renders Screen 1 (Congrats) by default and navigates to Screen 2', () => {
    render(<MobileMarriagePlanningModal {...defaultProps} />);
    
    // Check for congrats text
    expect(screen.getByText(/Congrats!/i)).toBeDefined();
    expect(screen.getByText(/You'll combine finances after marriage./i)).toBeDefined();
    expect(screen.getByText('More Income')).toBeDefined();

    // Click Continue to go to Screen 2 (Partner Profile)
    const continueBtn = screen.getByRole('button', { name: /Continue →/i });
    fireEvent.click(continueBtn);

    // Verify Screen 2 content
    expect(screen.getByText('Partner Profile')).toBeDefined();
    expect(screen.getByLabelText('Marriage Age')).toBeDefined();
  });

  test('validates partner profile input (Marriage Age >= currentAge)', () => {
    render(<MobileMarriagePlanningModal {...defaultProps} />);

    // Go to Screen 2
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    // Change Marriage Age to 25 (less than currentAge 30)
    const marriageAgeInput = screen.getByLabelText('Marriage Age');
    fireEvent.change(marriageAgeInput, { target: { value: '25' } });

    // Try to continue
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    // Expect validation warning card to appear
    expect(screen.getByText(/Marriage Age must be greater than or equal to/i)).toBeDefined();
  });

  test('navigates backwards using the back arrow button', () => {
    render(<MobileMarriagePlanningModal {...defaultProps} />);

    // Screen 1 -> Screen 2
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    expect(screen.queryByText(/Congrats!/i)).toBeNull();

    // Tap Back Arrow button
    const backBtn = screen.getByLabelText('Back');
    fireEvent.click(backBtn);

    // Should be back on Screen 1
    expect(screen.getByText(/Congrats!/i)).toBeDefined();
  });

  test('renders Screen 3 (Wedding Plan) details and funding gap warnings', () => {
    render(<MobileMarriagePlanningModal {...defaultProps} />);

    // Screen 1 -> Screen 2
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    // Screen 2 -> Screen 3
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    expect(screen.getByText('Plan Your Wedding')).toBeDefined();
    expect(screen.getByText('Available Savings Summary')).toBeDefined();

    // Since wedding cost is 20k by default and savings is 5k (from default event spouse cash=5000), gap warning should appear
    expect(screen.getByText(/Funding Gap Identified/i)).toBeDefined();
  });

  test('renders Screen 4 (Shared Savings) details', () => {
    render(<MobileMarriagePlanningModal {...defaultProps} />);

    // Congrats -> Profile -> Wedding -> Shared Savings
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    expect(screen.getByText('🏠 Shared Household Benefits')).toBeDefined();
    expect(screen.getByText('Housing Shared')).toBeDefined();
    expect(screen.getByText('Estimated Monthly Household Savings')).toBeDefined();

    // Adjust budget button is rendered
    expect(screen.getByText(/Adjust Budget Details/i)).toBeDefined();
  });

  test('renders Screen 5 (Impact Comparison) with passive warnings', () => {
    // Override props to force spending need warnings
    const props = {
      ...defaultProps,
      eventController: {
        ...defaultProps.eventController,
        editingEvent: {
          type: 'marriage',
          spouseIncome: 0, // Forces zero personal spending and low combined spending
          savingsRate: 0
        }
      }
    };
    render(<MobileMarriagePlanningModal {...props} />);

    // Nav to Step 5
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    expect(screen.getByText('Marriage Impact')).toBeDefined();
    expect(screen.getByText('Before Marriage')).toBeDefined();
    expect(screen.getByText('After Marriage')).toBeDefined();

    // Warnings should be rendered as passive cards (no interactive checkboxes)
    expect(screen.getByText(/Low Combined Spending/i)).toBeDefined();
    expect(screen.getByText(/Zero Partner Personal Spending/i)).toBeDefined();
  });

  test('saves the marriage event correctly on final summary screen', async () => {
    render(<MobileMarriagePlanningModal {...defaultProps} />);

    // Nav all the way to finalSummary (Screen 7)
    // 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    // 2 -> 3
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    // 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    // 4 -> 5
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    // 5 -> 6
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));
    // 6 -> 7
    fireEvent.click(screen.getByRole('button', { name: /Continue →/i }));

    expect(screen.getByText("You're All Set! 🎉")).toBeDefined();
    expect(screen.getByText('Partner profile completed')).toBeDefined();

    // Click Save & Continue
    const saveBtn = screen.getByRole('button', { name: /Save & Continue to Dashboard/i });
    fireEvent.click(saveBtn);

    // Verify handleSaveEvent callback was triggered
    expect(defaultProps.eventController.handleSaveEvent).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
