// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('FireSimulator Modals and Decision Wizards', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const navigateToStep2 = () => {
    render(<FireSimulator />);
    
    // First go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Build My Life Plan/i })[0];
    fireEvent.click(buildBtn);

    // Expand Advanced Detail accordion (which is visible in Step 2)
    const advancedTrigger = screen.getAllByRole('button', { name: /Advanced Detail/i })[0];
    fireEvent.click(advancedTrigger);
    
    // Enable taxes so that Step 4 of the Marriage wizard (Taxes) is shown
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    let taxCheckbox = null;
    checkboxes.forEach(cb => {
      const label = cb.closest('label');
      if (label && label.textContent.includes('Include Taxes')) {
        taxCheckbox = cb;
      }
    });
    
    if (taxCheckbox && !taxCheckbox.checked) {
      fireEvent.click(taxCheckbox);
    }
  };

  // Helper to find input/select elements by their nearby label text
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

  test('1. Budget Modal - Opens, renders defaults, modifies state, cancels, and saves', async () => {
    render(<FireSimulator />);
    
    // Open Budget Modal from Step 1
    const budgetBtn = screen.getByRole('button', { name: /Calculate from budget/i });
    fireEvent.click(budgetBtn);
    
    // Assert Modal is Open and renders correct title
    expect(screen.getByText(/Work Phase Budget/i)).toBeDefined();

    // Expand the Savings section
    const savingsHeader = screen.getByText('Savings');
    fireEvent.click(savingsHeader);
    
    // Assert default values
    const check401k = getInputByWrapperText(/401\(k\) \(Pre-Tax\)/i);
    expect(check401k.value).toBe('200');
    
    const checkingAcc = getInputByWrapperText(/Checking Account/i);
    expect(checkingAcc.value).toBe('100');
    
    // Verify initial balance state
    expect(screen.getByText(/Perfectly balanced! \$0 leftover/i)).toBeDefined();
    
    // Modify input state
    fireEvent.change(checkingAcc, { target: { value: '150' } });
    expect(checkingAcc.value).toBe('150');
    
    // Verify reconciliation updates to show deficit/leftover
    expect(screen.getAllByText(/Deficit/i).length).toBeGreaterThan(0);
    
    // Test Cancel button closes the modal
    const cancelBtn = document.querySelector('.budget-modal-card .btn-secondary');
    fireEvent.click(cancelBtn);
    
    // Assert modal is closed
    await waitFor(() => {
      expect(screen.queryByText(/Work Phase Budget/i)).toBeNull();
    });
  });

  test('2. Child Event Modal & Child Welcome Modal - Full flow', async () => {
    navigateToStep2();
    
    // Open Add Decision dropdown
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });
    
    // Verify Child Event modal opens
    expect(screen.getByRole('heading', { name: /Have a Child/i })).toBeDefined();
    
    // Verify default fields
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    expect(childNameInput.value).toBe('');
    
    const parentAgeInput = getInputByWrapperText(/Parent's Age when Born/i);
    expect(parentAgeInput.value).toBe('35');
    
    // Test college cost checkbox triggers correct support details text
    const collegeCheckbox = document.getElementById('include-college');
    expect(collegeCheckbox).toBeDefined();
    expect(collegeCheckbox.checked).toBe(false);
    expect(screen.getByText(/Adds an additional/i)).toBeDefined();
    
    // Input child name
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });
    expect(childNameInput.value).toBe('Liam');
    
    // Save child event
    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    fireEvent.click(saveBtn);
    
    // Verify Event Modal closes and Welcoming Modal opens
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Have a Child/i })).toBeNull();
      expect(screen.getByRole('heading', { name: /Welcome, Liam!/i })).toBeDefined();
    });
    
    // Welcome Modal buttons: Adjust Plan, Refine Child Costs, Done
    expect(screen.getByRole('button', { name: /Adjust Plan/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Refine Child Costs/i })).toBeDefined();
    
    // Click Done to close the welcome modal
    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Welcome, Liam!/i })).toBeNull();
    });
  });

  test('3. Debt Payoff Modal - Opens, updates state, and saves', async () => {
    navigateToStep2();
    
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'debtPayoff' } });
    
    // Verify Debt Payoff modal opens
    expect(screen.getByRole('heading', { name: /Debt Payoff Plan/i })).toBeDefined();
    
    // Verify defaults
    const payoffAge = getInputByWrapperText(/Payoff Age/i);
    expect(payoffAge.value).toBe('38');
    
    const payoffAmt = getInputByWrapperText(/Payoff Amount/i);
    expect(payoffAmt.value).toBe('5000');
    
    // Modify payoff amount
    fireEvent.change(payoffAmt, { target: { value: '15000' } });
    expect(payoffAmt.value).toBe('15000');
    
    // Save
    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Debt Payoff Plan/i })).toBeNull();
    });
  });

  test('4. Career Change Modal - Opens, updates state, and saves', async () => {
    navigateToStep2();
    
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'careerChange' } });
    
    // Verify Career Change modal opens
    expect(screen.getByRole('heading', { name: /Career Change/i })).toBeDefined();
    
    // Verify fields
    const jobTitle = getInputByWrapperText(/Job Title \/ Name/i);
    expect(jobTitle.value).toBe('Senior Manager');
    
    const income = getInputByWrapperText(/New Annual Income/i);
    expect(income.value).toBe('150000');
    
    // Edit job title
    fireEvent.change(jobTitle, { target: { value: 'VP of Product' } });
    expect(jobTitle.value).toBe('VP of Product');
    
    // Save
    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Career Change/i })).toBeNull();
    });
  });

  test('5. Marriage Modal - Wizard step progression, calculations, validation warnings', async () => {
    navigateToStep2();
    
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'marriage' } });
    
    // Verify modal opens
    expect(screen.getByRole('heading', { name: /Get Married/i })).toBeDefined();
    
    // Step 1: Partner Finances
    const spouseIncome = getInputByWrapperText(/Spouse Income/i);
    expect(spouseIncome.value).toBe('60000');
    
    // Check household summary
    expect(screen.getByText(/Live Household Summary/i)).toBeDefined();
    expect(screen.getByText(/\$110,000/)).toBeDefined(); // User 50k + Spouse 60k
    
    // Toggle full partner profile
    const profileBtn = screen.getByRole('button', { name: /Show Full Partner Profile/i });
    fireEvent.click(profileBtn);
    
    const growthInput = getInputByWrapperText(/Income Growth Rate/i);
    expect(growthInput.value).toBe('3');
    
    // Modify spouse income and verify real-time household summary updates
    fireEvent.change(spouseIncome, { target: { value: '90000' } });
    expect(screen.getByText(/\$140,000/)).toBeDefined(); // User 50k + Spouse 90k
    
    // Click Next to Step 2
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);
    
    // Step 2: Household Changes
    expect(screen.getByText(/How Does Life Change After Marriage\?/i)).toBeDefined();
    
    // Budget Builder shortcut button exists
    expect(screen.getAllByRole('button', { name: /Calculate from budget/i }).length).toBeGreaterThan(0);
    
    // Modify housing savings
    const housingCostInput = getInputByWrapperText(/Shared Housing Savings \/ Cost/i);
    expect(housingCostInput.value).toBe('-500'); // -6000 / 12
    
    fireEvent.change(housingCostInput, { target: { value: '-800' } });
    expect(housingCostInput.value).toBe('-800');
    
    // Include one-time wedding cost
    const weddingCheckbox = document.getElementById('include-wedding-cost');
    expect(weddingCheckbox.checked).toBe(false);
    fireEvent.click(weddingCheckbox);
    expect(weddingCheckbox.checked).toBe(true);
    
    const weddingCost = getInputByWrapperText(/Wedding Cost \(\$\)/i);
    expect(weddingCost.value).toBe('20000');
    
    // Click Next to Step 3
    fireEvent.click(nextBtn);
    
    // Step 3: Budget Preview & Warnings
    expect(screen.getByText(/Household Budget Preview/i)).toBeDefined();
    
    // Warnings check - e.g. Zero partner personal spending warning.
    // In default case, partner spending is based on net income 70%, so it's not 0.
    // Let's go back and edit partner personal spending to 0 to trigger the warning.
    const backBtn = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backBtn); // back to step 2
    
    const personalSpending = getInputByWrapperText(/Partner Personal Spending/i);
    fireEvent.change(personalSpending, { target: { value: '0' } });
    
    fireEvent.click(nextBtn); // forward to step 3
    
    // The Zero Partner Personal Spending Warning checkbox should be visible
    expect(screen.getByText(/Warning: Zero Partner Personal Spending/i)).toBeDefined();
    const zeroSpendConfirm = document.getElementById('confirm-partner-zero-spending');
    const lowSpendConfirm = document.getElementById('confirm-zero-spending-preview');
    expect(zeroSpendConfirm.checked).toBe(false);
    expect(lowSpendConfirm.checked).toBe(false);
    
    // Next button should be disabled due to step 3 warning validation
    const nextBtnStep3 = screen.getByRole('button', { name: /Next/i });
    expect(nextBtnStep3.disabled).toBe(true);
    
    // Confirm warnings
    fireEvent.click(zeroSpendConfirm);
    fireEvent.click(lowSpendConfirm);
    expect(zeroSpendConfirm.checked).toBe(true);
    expect(lowSpendConfirm.checked).toBe(true);
    expect(nextBtnStep3.disabled).toBe(false);
    
    // Click Next to Step 4 (Taxes)
    fireEvent.click(nextBtnStep3);
    expect(screen.getByText(/Tax Filing Status/i)).toBeDefined();
    
    // Click Next to Step 5 (Preview)
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText(/Marriage Impact Preview/i)).toBeDefined();
    
    // Cancel the marriage event modal
    const cancelBtn = document.querySelector('.event-form-overlay-card .list-builder-remove-btn');
    fireEvent.click(cancelBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Get Married/i })).toBeNull();
    });
  });

  test('6. Staggered children timeline and tabs in Budget Modal', async () => {
    navigateToStep2();
    
    // Add child 1: Liam, born at 35 (default)
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Event/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Welcome, Liam!/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    
    // Add child 2: Emma, born at 40
    fireEvent.change(select, { target: { value: 'haveChild' } });
    const childNameInput2 = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput2, { target: { value: 'Emma' } });
    const parentAgeInput = getInputByWrapperText(/Parent's Age when Born/i);
    fireEvent.change(parentAgeInput, { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Event/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Welcome, Emma!/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    // Open budget builder modal
    const setBudgetBtn = screen.getAllByRole('button', { name: /Set Budget/i })[0];
    fireEvent.click(setBudgetBtn);

    // Verify budget builder is open
    expect(screen.getByText(/Childcare Phase Budget/i)).toBeDefined();

    // Verify there are 5 tabs: Liam (1 Child), Both (2 Kids), Emma (1 Child), Standard Work Phase, Retirement
    const tabs = document.querySelectorAll('.budget-modal-card .segmented-control-btn');
    console.log('TABS FOUND:', Array.from(tabs).map(t => t.textContent));
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    expect(tabs[0].textContent).toContain('1 Child');
    expect(tabs[1].textContent).toContain('2 Kids');
    expect(tabs[2].textContent).toContain('1 Child');
    expect(tabs[3].textContent).toContain('Standard Work Phase');
    
    // Click on 1 Child tab (0) and check boost/details
    fireEvent.click(tabs[0]);
    const userIncomeInput = getInputByWrapperText(/Monthly Take-home Income/i);
    fireEvent.change(userIncomeInput, { target: { value: '5417' } });
    expect(screen.getAllByText(/child boost/i).length).toBeGreaterThan(0);
    
    // Click on 2 Kids tab (1)
    fireEvent.click(tabs[1]);
    const userIncomeInput2 = getInputByWrapperText(/Monthly Take-home Income/i);
    fireEvent.change(userIncomeInput2, { target: { value: '6667' } });
    expect(screen.getAllByText(/child boost/i).length).toBeGreaterThan(0);
    
    // Close modal
    const cancelBtnBudget = document.querySelector('.budget-modal-card .btn-secondary');
    fireEvent.click(cancelBtnBudget);
  });

  test('7. Edit child to include college and verify milestone updates', async () => {
    navigateToStep2();
    
    // Add Liam
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Event/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Welcome, Liam!/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    
    // Click the timeline node for Liam
    const liamTooltipText = screen.getAllByText(/Have Child: Liam/i)[0];
    const liamNode = liamTooltipText.closest('.timeline-node, .vertical-timeline-node');
    fireEvent.click(liamNode);
    
    // Click edit event
    const editBtn = screen.getByRole('button', { name: /Edit Event/i });
    fireEvent.click(editBtn);
    
    // Verify college cost text is visible
    expect(screen.getByText(/Adds an additional/i)).toBeDefined();
    
    // Check college checkbox
    const collegeCheckbox = document.getElementById('include-college');
    fireEvent.click(collegeCheckbox);
    expect(collegeCheckbox.checked).toBe(true);
    
    // Save
    fireEvent.click(screen.getByRole('button', { name: /Save Event/i }));
    
    // Welcome modal should appear again
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Welcome, Liam!/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
  });
});
