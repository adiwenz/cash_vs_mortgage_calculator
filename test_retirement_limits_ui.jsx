// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getAnnualContributionLimit, getMonthlyContributionLimit, capMonthlyContribution } from './src/simulatorMathUtils';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';
import BudgetModal from './src/components/fire-simulator/BudgetModal';

// Mock Recharts to avoid layout/sizable errors in jsdom
// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('IRS Retirement Limits Helpers and UI Capping', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Helper unit tests
  test('Helper: getAnnualContributionLimit and getMonthlyContributionLimit', () => {
    // 401(k)
    expect(getAnnualContributionLimit('401k', 35)).toBe(23500);
    expect(getMonthlyContributionLimit('401k', 35)).toBeCloseTo(1958.33);

    expect(getAnnualContributionLimit('trad401k', 52)).toBe(31000); // 23500 + 7500 catchup
    expect(getMonthlyContributionLimit('trad401k', 52)).toBeCloseTo(2583.33);

    // Roth IRA
    expect(getAnnualContributionLimit('rothIRA', 30)).toBe(7000);
    expect(getMonthlyContributionLimit('rothIra', 30)).toBeCloseTo(583.33);

    expect(getAnnualContributionLimit('rothIra', 50)).toBe(8000); // 7000 + 1000 catchup
    expect(getMonthlyContributionLimit('rothIra', 50)).toBeCloseTo(666.67);

    // Traditional IRA
    expect(getAnnualContributionLimit('traditionalIRA', 40)).toBe(7000);
    expect(getMonthlyContributionLimit('tradIra', 40)).toBeCloseTo(583.33);

    expect(getAnnualContributionLimit('tradIra', 55)).toBe(8000); // 7000 + 1000 catchup
    expect(getMonthlyContributionLimit('tradIra', 55)).toBeCloseTo(666.67);

    // HSA (Filing status / coverage based)
    expect(getAnnualContributionLimit('hsa', 30, 'single')).toBe(4300);
    expect(getMonthlyContributionLimit('hsa', 30, 'single')).toBeCloseTo(358.33);

    expect(getAnnualContributionLimit('hsa', 30, 'married')).toBe(8550);
    expect(getMonthlyContributionLimit('hsa', 30, 'married')).toBeCloseTo(712.50);

    // HSA family coverage type overrides status
    expect(getAnnualContributionLimit('hsa', 30, 'single', 'family')).toBe(8550);
    expect(getMonthlyContributionLimit('hsa', 30, 'single', 'family')).toBeCloseTo(712.50);

    // HSA catch-up at age 55+
    expect(getAnnualContributionLimit('hsa', 55, 'single')).toBe(5300); // 4300 + 1000
    expect(getMonthlyContributionLimit('hsa', 55, 'single')).toBeCloseTo(441.67);

    // Brokerage has no limit
    expect(getAnnualContributionLimit('brokerage', 35)).toBe(Infinity);
    expect(getMonthlyContributionLimit('brokerage', 35)).toBe(Infinity);
  });

  test('Helper: capMonthlyContribution returns expected metadata', () => {
    // Under limit
    const resUnder = capMonthlyContribution('trad401k', 1000, { age: 35 });
    expect(resUnder.cappedAmount).toBe(1000);
    expect(resUnder.wasCapped).toBe(false);
    expect(resUnder.message).toBe('');

    // Over limit
    const resOver = capMonthlyContribution('trad401k', 3000, { age: 35 });
    expect(resOver.cappedAmount).toBeCloseTo(1958.33);
    expect(resOver.wasCapped).toBe(true);
    expect(resOver.message).toBe("Can't contribute more than the IRS limit of $23,500/yr for this account.");

    // Age 50+ catchup
    const resOverCatchup = capMonthlyContribution('trad401k', 3000, { age: 52 });
    expect(resOverCatchup.cappedAmount).toBe(2583.33); // (23500 + 7500) / 12
    expect(resOverCatchup.wasCapped).toBe(true);

    // Brokerage
    const resBrokerage = capMonthlyContribution('brokerage', 5000, { age: 35 });
    expect(resBrokerage.cappedAmount).toBe(5000);
    expect(resBrokerage.wasCapped).toBe(false);
  });

  // Helper to find input elements by their nearby label text (layout agnostic)
  const getInputByWrapperText = (textRegex) => {
    const elements = screen.getAllByText(textRegex);
    for (const el of elements) {
      let parent = el.parentElement;
      while (parent) {
        const input = parent.querySelector('input');
        if (input && !input.readOnly) {
          return input;
        }
        parent = parent.parentElement;
      }
    }
    throw new Error(`Could not find input associated with text matching: ${textRegex}`);
  };

  test('UI Capping and Toast Behavior in Desktop Budget Modal', async () => {
    const mockSetBudgetSavings = vi.fn();
    const mockSetBudgetPartnerSavings = vi.fn();
    
    const budgetSavings = {
      trad401k: 1000, rothIra: 50, tradIra: 0, hsa: 50, brokerage: 0,
      checking: 50, hysa: 50, emergency: 26, debt: 0, other: 0
    };
    const budgetPartnerSavings = {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, cash: 0, debt: 0
    };
    
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 60,
      simpleIncome: 120000,
      filingStatus: 'single',
      lifeEvents: [],
      budgetDetails: {
        hsaCoverage: 'single',
        savings: budgetSavings
      }
    };
    
    render(
      <BudgetModal
        inputs={inputs}
        isBudgetOpenFromMarriageWizard={false}
        editingEvent={null}
        budgetMonthlyIncome={10000}
        setBudgetMonthlyIncome={vi.fn()}
        budgetExpenses={{ housing: 1500 }}
        setBudgetExpenses={vi.fn()}
        budgetSavings={budgetSavings}
        setBudgetSavings={mockSetBudgetSavings}
        budgetPartnerSavings={budgetPartnerSavings}
        setBudgetPartnerSavings={mockSetBudgetPartnerSavings}
        activeBudgetPhase="workSave"
        handleSwitchBudgetPhase={vi.fn()}
        savingsAllocMode="fixed"
        handleToggleSavingsAllocMode={vi.fn()}
        budgetHsaCoverage="single"
        setBudgetHsaCoverage={vi.fn()}
        budgetFilingStatus="single"
        setBudgetFilingStatus={vi.fn()}
        budgetMonthlySpending={1500}
        setBudgetMonthlySpending={vi.fn()}
        setBudgetMonthlySavings={vi.fn()}
        pendingImprovement={null}
        handleCloseBudgetModal={vi.fn()}
        handleSaveBudget={vi.fn()}
        isMobile={false}
      />
    );

    // Open Save & Invest tab
    const savingsCard = screen.getByText(/Save & Invest/i).closest('.budget-card');
    fireEvent.click(savingsCard);

    // Click "Edit Savings →"
    const editSavingsBtn = screen.getByRole('button', { name: /Edit Savings →/i });
    fireEvent.click(editSavingsBtn);

    // Find the 401(k) input
    const input401k = getInputByWrapperText(/401\(k\) \(Pre-Tax\)/i);
    
    // Type 3000, should trigger mockSetBudgetSavings with capped value 1958.33
    fireEvent.change(input401k, { target: { value: '3000' } });
    
    expect(mockSetBudgetSavings).toHaveBeenCalled();
    const updater = mockSetBudgetSavings.mock.calls[0][0];
    const nextState = updater(budgetSavings);
    expect(nextState.trad401k).toBeCloseTo(1958.33);

    // Verify Toast is rendered
    const toastMsg = await screen.findByText(/Can't contribute more than the IRS limit of \$23,500\/yr/i);
    expect(toastMsg).toBeDefined();

    // Reset mock
    mockSetBudgetSavings.mockClear();

    // Type 1500 (within limit) - should trigger mockSetBudgetSavings with 1500
    fireEvent.change(input401k, { target: { value: '1500' } });
    expect(mockSetBudgetSavings).toHaveBeenCalled();
    const updater2 = mockSetBudgetSavings.mock.calls[0][0];
    const nextState2 = updater2(budgetSavings);
    expect(nextState2.trad401k).toBe(1500);

    // Find Brokerage input
    const inputBrokerage = getInputByWrapperText(/Taxable Brokerage/i);
    fireEvent.change(inputBrokerage, { target: { value: '5000' } });
    expect(mockSetBudgetSavings).toHaveBeenCalled();
    const updaterB = mockSetBudgetSavings.mock.calls[mockSetBudgetSavings.mock.calls.length - 1][0];
    const nextStateB = updaterB(budgetSavings);
    expect(nextStateB.brokerage).toBe(5000); // Brokerage not capped
  });

  test('UI Capping for Partner Savings in Married Mode', async () => {
    const mockSetBudgetSavings = vi.fn();
    const mockSetBudgetPartnerSavings = vi.fn();
    
    const budgetSavings = {
      trad401k: 1000, rothIra: 50, tradIra: 0, hsa: 50, brokerage: 0,
      checking: 50, hysa: 50, emergency: 26, debt: 0, other: 0
    };
    const budgetPartnerSavings = {
      trad401k: 1000, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, cash: 0, debt: 0
    };
    
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 60,
      simpleIncome: 120000,
      filingStatus: 'married',
      lifeEvents: [{ type: 'spouseMember', currentAge: 38 }],
      budgetDetails: {
        hsaCoverage: 'family',
        savings: budgetSavings,
        partnerSavings: budgetPartnerSavings
      }
    };
    
    render(
      <BudgetModal
        inputs={inputs}
        isBudgetOpenFromMarriageWizard={true}
        editingEvent={{ spouseIncome: 60000 }}
        budgetMonthlyIncome={10000}
        setBudgetMonthlyIncome={vi.fn()}
        budgetExpenses={{ housing: 1500 }}
        setBudgetExpenses={vi.fn()}
        budgetSavings={budgetSavings}
        setBudgetSavings={mockSetBudgetSavings}
        budgetPartnerSavings={budgetPartnerSavings}
        setBudgetPartnerSavings={mockSetBudgetPartnerSavings}
        activeBudgetPhase="workSave"
        handleSwitchBudgetPhase={vi.fn()}
        savingsAllocMode="fixed"
        handleToggleSavingsAllocMode={vi.fn()}
        budgetHsaCoverage="family"
        setBudgetHsaCoverage={vi.fn()}
        budgetFilingStatus="married"
        setBudgetFilingStatus={vi.fn()}
        budgetMonthlySpending={1500}
        setBudgetMonthlySpending={vi.fn()}
        setBudgetMonthlySavings={vi.fn()}
        pendingImprovement={null}
        handleCloseBudgetModal={vi.fn()}
        handleSaveBudget={vi.fn()}
        isMobile={false}
      />
    );

    // Open Save & Invest tab
    const savingsCard = screen.getByText(/Save & Invest/i).closest('.budget-card');
    fireEvent.click(savingsCard);

    const editSavingsBtn = screen.getByRole('button', { name: /Edit Savings →/i });
    fireEvent.click(editSavingsBtn);

    const partner401kInput = getInputByWrapperText(/Partner 401\(k\)/i);
    
    // Type 3000, should trigger mockSetBudgetPartnerSavings with capped value 1958.33
    fireEvent.change(partner401kInput, { target: { value: '3000' } });
    
    expect(mockSetBudgetPartnerSavings).toHaveBeenCalled();
    const updater = mockSetBudgetPartnerSavings.mock.calls[0][0];
    const nextState = updater(budgetPartnerSavings);
    expect(nextState.trad401k).toBeCloseTo(1958.33);

    const toastMsg = await screen.findByText(/Can't contribute more than the IRS limit of \$23,500\/yr/i);
    expect(toastMsg).toBeDefined();
  });

  test('UI Capping in Mobile Budget Editor', async () => {
    const mockSetBudgetSavings = vi.fn();
    
    const budgetSavings = {
      trad401k: 1000, rothIra: 50, tradIra: 0, hsa: 50, brokerage: 0,
      checking: 50, hysa: 50, emergency: 26, debt: 0, other: 0
    };
    
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 60,
      simpleIncome: 120000,
      filingStatus: 'single',
      lifeEvents: [],
      budgetDetails: {
        hsaCoverage: 'single',
        savings: budgetSavings
      }
    };
    
    render(
      <BudgetModal
        inputs={inputs}
        isBudgetOpenFromMarriageWizard={false}
        editingEvent={null}
        budgetMonthlyIncome={10000}
        setBudgetMonthlyIncome={vi.fn()}
        budgetExpenses={{ housing: 1500 }}
        setBudgetExpenses={vi.fn()}
        budgetSavings={budgetSavings}
        setBudgetSavings={mockSetBudgetSavings}
        budgetPartnerSavings={{}}
        setBudgetPartnerSavings={vi.fn()}
        activeBudgetPhase="workSave"
        handleSwitchBudgetPhase={vi.fn()}
        savingsAllocMode="fixed"
        handleToggleSavingsAllocMode={vi.fn()}
        budgetHsaCoverage="single"
        setBudgetHsaCoverage={vi.fn()}
        budgetFilingStatus="single"
        setBudgetFilingStatus={vi.fn()}
        budgetMonthlySpending={1500}
        setBudgetMonthlySpending={vi.fn()}
        setBudgetMonthlySavings={vi.fn()}
        pendingImprovement={null}
        handleCloseBudgetModal={vi.fn()}
        handleSaveBudget={vi.fn()}
        isMobile={true}
      />
    );

    // Expand "Save & Invest" section in Mobile view
    const savingsHeader = screen.getByText(/Save & Invest/i);
    fireEvent.click(savingsHeader);

    // Find the "Edit Section" button inside it
    const editBtns = screen.getAllByRole('button', { name: /Edit Section/i });
    const editSavingsBtn = editBtns[editBtns.length - 1]; // Savings is the last section
    fireEvent.click(editSavingsBtn);

    const input401k = getInputByWrapperText(/401\(k\)/i);
    
    fireEvent.change(input401k, { target: { value: '3000' } });
    
    expect(mockSetBudgetSavings).toHaveBeenCalled();
    const updater = mockSetBudgetSavings.mock.calls[0][0];
    const nextState = updater(budgetSavings);
    expect(nextState.trad401k).toBeCloseTo(1958.33);

    const toastMsg = await screen.findByText(/Can't contribute more than the IRS limit of \$23,500\/yr/i);
    expect(toastMsg).toBeDefined();
  });
});
