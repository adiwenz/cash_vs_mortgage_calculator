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

describe('FireSimulator Modals and Decision Wizards', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const navigateToStep2 = () => {
    render(<FireSimulator />);
    
    // First go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
    fireEvent.click(buildBtn);

    // Open Advanced Settings modal from Current Situation card
    const showDetailsBtn = screen.getAllByRole('button', { name: /Show Details/i })[0];
    fireEvent.click(showDetailsBtn);
    
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

    // Save changes to close the modal
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
  };

  const navigateToStep2WithTimeline = () => {
    navigateToStep2();
    // Select Career Change from the dropdown to add an event and force the timeline to render
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'careerChange' } });
    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    fireEvent.click(saveBtn);
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
    const budgetBtn = screen.getByRole('button', { name: /Set Budget|Calculate from budget/i });
    fireEvent.click(budgetBtn);
    
    // Assert Modal is Open and renders correct title
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();

    // Select the Savings & Investing category ring
    const savingsRing = screen.getAllByText(/Savings & Investing/i)[0].closest('.budget-card');
    fireEvent.click(savingsRing);
    
    // Assert default values
    const check401k = getInputByWrapperText(/401\(k\) \(Pre-Tax\)/i);
    expect(check401k.value).toBe('0');
    
    const checkingAcc = getInputByWrapperText(/Checking Account/i);
    expect(checkingAcc.value).toBe('0');
    
    // Verify initial balance state
    expect(screen.getByText(/You’re on track/i)).toBeDefined();
    
    // Modify input state
    fireEvent.change(checkingAcc, { target: { value: '150' } });
    expect(checkingAcc.value).toBe('150');
    
    // Verify reconciliation updates to show deficit/leftover
    expect(screen.getAllByText(/Over budget by/i).length).toBeGreaterThan(0);
    
    // Test Cancel button closes the modal
    const cancelBtn = document.querySelector('.budget-modal-card .btn-secondary');
    fireEvent.click(cancelBtn);
    
    // Assert modal is closed
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Budget/i, level: 3 })).toBeNull();
    });
  });

  test('2. Child Event Modal - Full flow', async () => {
    navigateToStep2();
    
    // Open Add Decision dropdown
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });
    
    // Verify Child Event modal opens
    expect(screen.getByRole('heading', { name: /Add Child/i })).toBeDefined();
    
    // Verify default fields
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    expect(childNameInput.value).toBe('');
    
    const parentAgeInput = getInputByWrapperText(/Age Child Arrives/i);
    expect(parentAgeInput.value).toBe('35');
    
    // Input child name
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });
    expect(childNameInput.value).toBe('Liam');
    
    // Set annual childcare cost to 0
    const costInput = getInputByWrapperText(/Annual Childcare Cost/i);
    fireEvent.change(costInput, { target: { value: '0' } });
    
    // Continue to step 2
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn);
    
    // Confirm child event rebalance/promotion selection
    const rebalanceOption = screen.getByText('Rebalance Budget');
    fireEvent.click(rebalanceOption);
    const confirmBtn = screen.getByRole('button', { name: /Confirm/i });
    fireEvent.click(confirmBtn);
    
    // Verify Modal closes
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });
    
    // Verify child event is saved to the timeline
    expect(screen.getAllByText('👶 Have Child: Liam')[0]).toBeDefined();
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
    expect(payoffAmt.value).toBe('$5,000');
    
    // Modify payoff amount
    fireEvent.change(payoffAmt, { target: { value: '15000' } });
    expect(payoffAmt.value).toBe('$15,000');
    
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
    expect(screen.getByRole('heading', { name: /Income Change/i })).toBeDefined();
    
    // Verify fields
    const jobTitle = getInputByWrapperText(/Job Title \/ Name/i);
    expect(jobTitle.value).toBe('Senior Manager');
    
    const income = getInputByWrapperText(/New Annual Income/i);
    expect(income.value).toBe('$150,000');
    
    // Edit job title
    fireEvent.change(jobTitle, { target: { value: 'VP of Product' } });
    expect(jobTitle.value).toBe('VP of Product');
    
    // Save
    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Income Change/i })).toBeNull();
    });
  });

  test('5. Marriage Modal - Wizard step progression, calculations, validation warnings', async () => {
    navigateToStep2();
    
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'marriage' } });
    
    // Verify modal opens
    expect(screen.getByRole('heading', { name: /Get Married/i })).toBeDefined();

    // Click "Edit Partner Profile" to expose Step 1 inputs
    const editProfileBtn = screen.getByRole('button', { name: /Edit Partner Profile/i });
    fireEvent.click(editProfileBtn);
    
    // Step 1: Partner Finances
    const spouseIncome = getInputByWrapperText(/Spouse Income/i);
    expect(spouseIncome.value).toBe('$50,000'); // Defaults to User Income
    
    // Modify spouse income
    fireEvent.change(spouseIncome, { target: { value: '90000' } });
    
    // Modify Savings Rate to 100% to test Zero Partner Personal Spending warning
    const savingsRate = getInputByWrapperText(/Savings Rate/i);
    expect(savingsRate.value).toBe('15%'); // Defaults to User Savings Rate
    fireEvent.change(savingsRate, { target: { value: '100' } });
    expect(savingsRate.value).toBe('100%');
    
    // Click Next to Step 2 (Wedding)
    const nextBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(nextBtn);

    // Step 2: Wedding
    expect(screen.getAllByText(/Plan Your Wedding/i).length).toBeGreaterThan(0);
    const weddingCheckbox = document.getElementById('include-wedding-cost');
    // It defaults to checked in the congratulations/new wizard flow
    expect(weddingCheckbox.checked).toBe(true);
    
    const weddingCost = getInputByWrapperText(/Wedding Cost \(\$\)/i);
    expect(weddingCost.value).toBe('$20,000');
    
    // Click Next to Step 3 (Life Together)
    fireEvent.click(nextBtn);
    
    // Step 3: Life Together
    expect(screen.getAllByText(/Life Together/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Shared Household Benefits/i)).toBeDefined();
    
    // Update Household Budget CTA exists
    expect(screen.getAllByRole('button', { name: /Adjust Budget Details/i }).length).toBeGreaterThan(0);
    
    // Click Update Household Budget
    const updateBudgetBtn = screen.getAllByRole('button', { name: /Adjust Budget Details/i })[0];
    fireEvent.click(updateBudgetBtn);
    
    // Verify Budget modal opens in married mode
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();
    expect(
      screen.queryAllByText(/\$11,667/).length > 0 ||
      screen.queryAllByText(/\$11,666\.67/).length > 0 ||
      screen.queryAllByText(/\$10,937/).length > 0 ||
      screen.queryAllByText(/\$10,895/).length > 0 ||
      screen.queryAllByText(/\$10,322/).length > 0 ||
      screen.queryAllByText(/\$10,398/).length > 0 ||
      screen.queryAllByText(/\$10,571\.67/).length > 0
    ).toBe(true); // Combined take-home income
    
    // Select the Needs category ring
    const needsRing = screen.getAllByText(/Needs/i)[0].closest('.budget-card');
    fireEvent.click(needsRing);
    
    // Verify Housing stays the same price ($1,500)
    const housingInput = getInputByWrapperText(/Housing \(Rent\/Mortgage\)/i);
    expect(housingInput.value).toBe('1,500');
    
    // Click Save Budget
    const saveBudgetBtn = screen.getByRole('button', { name: /Save Budget/i });
    fireEvent.click(saveBudgetBtn);
    
    // Click Next to Step 4 (Marriage Impact)
    fireEvent.click(nextBtn);
    
    // Step 4: Marriage Impact
    expect(screen.getAllByText(/Marriage Impact/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Before Marriage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/After Marriage/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Tax Filing Status/i)).toBeDefined();
    
    // The Zero Partner Personal Spending Warning checkbox should be visible
    expect(screen.getByText(/Warning: Zero Partner Personal Spending/i)).toBeDefined();
    const zeroSpendConfirm = document.getElementById('confirm-partner-zero-spending');
    const lowSpendConfirm = document.getElementById('confirm-zero-spending-preview');
    expect(zeroSpendConfirm.checked).toBe(false);
    expect(lowSpendConfirm.checked).toBe(false);
    
    // Save button should be disabled due to step 4 warning validation
    const saveBtn = screen.getByRole('button', { name: /Save Marriage Event/i });
    expect(saveBtn.disabled).toBe(true);
    
    // Confirm warnings
    fireEvent.click(zeroSpendConfirm);
    fireEvent.click(lowSpendConfirm);
    expect(zeroSpendConfirm.checked).toBe(true);
    expect(lowSpendConfirm.checked).toBe(true);
    expect(saveBtn.disabled).toBe(false);
    
    // Click Save Marriage Event
    fireEvent.click(saveBtn);
    
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
    
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });
    
    // Add child 2: Emma, born at 40
    fireEvent.change(select, { target: { value: 'haveChild' } });
    const childNameInput2 = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput2, { target: { value: 'Emma' } });
    const parentAgeInput = getInputByWrapperText(/Age Child Arrives/i);
    fireEvent.change(parentAgeInput, { target: { value: '40' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });

    // Open Budget Modal via Set Budget button
    const setBudgetBtn = screen.getByRole('button', { name: /Set Budget/i });
    fireEvent.click(setBudgetBtn);
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();

    // Verify there are 4 ages as tabs inside the Budget Modal
    const tabs = document.querySelectorAll('.budget-sidebar-tab, .budget-modal-tab');
    expect(tabs.length).toBe(4);
    expect(tabs[0].textContent).toContain('Age 35');
    expect(tabs[1].textContent).toContain('Age 40');
 
    // Click on the first tab
    fireEvent.click(tabs[0]);
    expect(tabs[0].className).toContain('active');
 
    // Click on the second tab
    fireEvent.click(tabs[1]);
    expect(tabs[1].className).toContain('active');
 
    // Close modal
    const cancelBtnBudget = document.querySelector('.budget-modal-card .btn-secondary');
    fireEvent.click(cancelBtnBudget);
  });

  test('7. Edit child details and verify updates', async () => {
    navigateToStep2();
    
    // Add Liam
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });
    
    // Set annual childcare cost to 0
    const costInput = getInputByWrapperText(/Annual Childcare Cost/i);
    fireEvent.change(costInput, { target: { value: '0' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDefined();
    });
    // Select Rebalance Budget so we don't get a career/promotion event at age 35
    const rebalanceOption = screen.getByText('Rebalance Budget');
    fireEvent.click(rebalanceOption);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });

    // Click the timeline node for Liam
    const liamTooltipText = screen.getAllByText(/Have Child: Liam/i)[0];
    const liamNode = liamTooltipText.closest('.financial-milestone-wrapper, .milestone-circle-wrapper, .timeline-node, .vertical-timeline-node');
    fireEvent.click(liamNode);

    // Click the Edit Decision button in the detail card to open the modal
    const editBtn = screen.getByRole('button', { name: /Edit Decision/i });
    fireEvent.click(editBtn);
    
    // Verify Edit Child Details modal opens
    expect(screen.getByRole('heading', { name: /Edit Child Details/i })).toBeDefined();
    
    // Edit fields
    const childNameInputEdit = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInputEdit, { target: { value: 'Liam Edited' } });
    const parentAgeInput = getInputByWrapperText(/Age Child Arrives/i);
    fireEvent.change(parentAgeInput, { target: { value: '36' } });
    
    // Save directly (no Continue step for editing)
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Edit Child Details/i })).toBeNull();
    });
    
    // Verify edited info is saved on the timeline
    expect(screen.getAllByText('👶 Have Child: Liam Edited')[0]).toBeDefined();
  });

  test('8. Marriage Flow - Budget Modal Savings Fields are present and editable', async () => {
    navigateToStep2();
    
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'marriage' } });
    
    // Verify marriage modal opens
    expect(screen.getByRole('heading', { name: /Get Married/i })).toBeDefined();

    // Click "Edit Partner Profile" to expose inputs
    const editProfileBtn = screen.getByRole('button', { name: /Edit Partner Profile/i });
    fireEvent.click(editProfileBtn);

    // Verify Spouse Retirement Age input is present in Step 1
    const spouseRetAgeInput = getInputByWrapperText(/Spouse Work Optional Age/i);
    expect(spouseRetAgeInput).toBeDefined();
    expect(spouseRetAgeInput.placeholder).toContain('65 (optional)');
    
    // Click Next through step 1 (Congratulations) -> Step 2 (Wedding)
    const nextBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(nextBtn);
    
    // Click Next through step 2 (Wedding) -> Step 3 (Life Together)
    fireEvent.click(nextBtn);
    
    // Click Next through step 3 (Life Together) -> Step 4 (Marriage Impact)
    fireEvent.click(nextBtn);
    
    // Step 4: Save the Event
    const saveBtn = screen.getByRole('button', { name: /Save Marriage Event/i });
    fireEvent.click(saveBtn);
    
    // Verify Marriage Modal is closed
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Get Married/i })).toBeNull();
    });

    // Open budget builder modal
    const setBudgetBtn = screen.getAllByRole('button', { name: /Set Budget/i })[0];
    fireEvent.click(setBudgetBtn);

    // Verify budget builder is open
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();

    // Select the Savings & Investing category ring
    const savingsRing = screen.getAllByText(/Savings & Investing/i)[0].closest('.budget-card');
    fireEvent.click(savingsRing);

    // Verify checking, hysa, emergency are present for user
    const checkingAcc = getInputByWrapperText(/Checking Account/i);
    const hysa = getInputByWrapperText(/High-Yield Savings/i);
    const emergency = getInputByWrapperText(/Emergency Fund/i);
    
    expect(checkingAcc).toBeDefined();
    expect(hysa).toBeDefined();
    expect(emergency).toBeDefined();

    // Verify they are editable
    fireEvent.change(checkingAcc, { target: { value: '250' } });
    expect(checkingAcc.value).toBe('250');

    // Verify checking, hysa, emergency are present for partner
    const partnerChecking = getInputByWrapperText(/Partner Checking Account/i);
    const partnerHysa = getInputByWrapperText(/Partner High-Yield Savings/i);
    const partnerEmergency = getInputByWrapperText(/Partner Emergency Fund/i);
    
    expect(partnerChecking).toBeDefined();
    expect(partnerHysa).toBeDefined();
    expect(partnerEmergency).toBeDefined();

    // Verify partner fields are editable
    fireEvent.change(partnerChecking, { target: { value: '180' } });
    expect(partnerChecking.value).toBe('180');

    // Cancel / Close modal
    const cancelBtn = document.querySelector('.budget-modal-card .btn-secondary');
    fireEvent.click(cancelBtn);
  });

  test('9. Delete Event buttons - Allows deleting events from the timeline dialog boxes', async () => {
    navigateToStep2();

    // 1. Create a child event
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });

    // Assert haveChild modal opens
    expect(screen.getByRole('heading', { name: /Add Child/i })).toBeDefined();

    // Enter child name
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });

    // Set annual childcare cost to 0
    const costInput = getInputByWrapperText(/Annual Childcare Cost/i);
    fireEvent.change(costInput, { target: { value: '0' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDefined();
    });
    // Select Rebalance Budget so we don't get a career/promotion event at age 35
    const rebalanceOption = screen.getByText('Rebalance Budget');
    fireEvent.click(rebalanceOption);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });

    // Find the child start element
    const birthTextNode = screen.getAllByText('👶 Have Child: Liam')[0];
    const birthNode = birthTextNode.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');
    expect(birthNode).not.toBeNull();

    // Click to select
    fireEvent.click(birthNode);
    // Click Edit Decision to open the edit modal
    const editBtn = screen.getByRole('button', { name: /Edit Decision/i });
    fireEvent.click(editBtn);

    // Verify Delete Child button is present in the dialog
    let deleteBtn = screen.getByRole('button', { name: /Delete Child/i });
    expect(deleteBtn).toBeDefined();

    // Click Delete Child
    fireEvent.click(deleteBtn);

    // Verify modal is closed and child event is deleted from timeline
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Edit Child Details/i })).toBeNull();
      expect(screen.queryByText('👶 Have Child: Liam')).toBeNull();
    });

    // 2. Create a marriage event
    fireEvent.change(select, { target: { value: 'marriage' } });

    // Verify Marriage modal opens
    expect(screen.getByRole('heading', { name: /Get Married/i })).toBeDefined();

    // Click "Edit Partner Profile" to expose Step 1 inputs
    const editProfileBtn = screen.getByRole('button', { name: /Edit Partner Profile/i });
    fireEvent.click(editProfileBtn);

    // Modify spouse income or just go next
    const nextBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(nextBtn); // Step 2 (Wedding planner)

    // Set wedding age to 36 so they don't group at age 35
    const weddingAgeInput = getInputByWrapperText(/Wedding Age/i);
    fireEvent.change(weddingAgeInput, { target: { value: '36' } });

    fireEvent.click(nextBtn); // Step 2 -> 3

    fireEvent.click(nextBtn); // Step 3 -> 4

    // Confirm warnings if present
    const zeroSpendConfirm = document.getElementById('confirm-partner-zero-spending');
    const lowSpendConfirm = document.getElementById('confirm-zero-spending-preview');
    if (zeroSpendConfirm) fireEvent.click(zeroSpendConfirm);
    if (lowSpendConfirm) fireEvent.click(lowSpendConfirm);

    // Click Save Marriage Event
    const saveMarriageBtn = screen.getByRole('button', { name: /Save Marriage Event/i });
    fireEvent.click(saveMarriageBtn);

    // Verify Marriage modal is closed
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Get Married/i })).toBeNull();
    });

    // Find the marriage event on the timeline
    const marriageTextNode = screen.getAllByText('💍 💍 Get Married')[0];
    const marriageNode = marriageTextNode.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');
    expect(marriageNode).not.toBeNull();

    // Click to select the marriage event
    fireEvent.click(marriageNode);
    // Click Edit Decision to open the edit modal
    const editBtnMarriage = screen.getByRole('button', { name: /Edit Decision/i });
    fireEvent.click(editBtnMarriage);

    // Verify Marriage modal is open
    expect(screen.getByRole('heading', { name: /Get Married/i })).toBeDefined();

    // Verify Delete Event button is present in Step 1
    deleteBtn = screen.getByRole('button', { name: /Delete Event/i });
    expect(deleteBtn).toBeDefined();

    // Click Delete Event
    fireEvent.click(deleteBtn);

    // Verify modal is closed and marriage event is deleted from timeline
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Get Married/i })).toBeNull();
      expect(screen.queryByText('💍 💍 Get Married')).toBeNull();
    });
  });

  test('9. Budget Phases UI Refinement - Segmented Timeline and Modal Interaction', async () => {
    navigateToStep2WithTimeline();

    // 1. Budget Phases row should not be rendered inside the roadmap grid
    const budgetRow = document.querySelector('.budget-phases-timeline-row');
    expect(budgetRow).toBeNull();

    // 2. Life Phases row should not be rendered
    expect(screen.queryByText('Life Phases')).toBeNull();

    // 3. Open Budget Modal via Set Budget button
    const setBudgetBtn = screen.getByRole('button', { name: /Set Budget/i });
    fireEvent.click(setBudgetBtn);
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();

    // 4. Modal switches active phase budgets when clicking tabs
    const modalTabs = document.querySelectorAll('.budget-sidebar-tab, .budget-modal-tab');
    expect(modalTabs.length).toBeGreaterThan(0);
 
    // Click the last tab in the modal
    const lastTab = modalTabs[modalTabs.length - 1];
    fireEvent.click(lastTab);
    expect(lastTab.classList.contains('active')).toBe(true);

    // Close the modal
    const cancelBtn = document.querySelector('.budget-modal-card .btn-secondary');
    if (cancelBtn) fireEvent.click(cancelBtn);

    // 5. Event node clicks open event editors, not the budget modal
    const milestone = document.querySelector('.milestone-circle-wrapper');
    if (milestone) {
      fireEvent.click(milestone);
      // It should open an event editor modal or not open the budget modal
      expect(screen.queryByRole('heading', { name: /Budget/i, level: 3 })).toBeNull();
    }
  });

  test('10. Budget Phases Responsive Rendering and Tooltips', () => {
    navigateToStep2WithTimeline();

    // Verify roadmap does not render phase rows
    expect(screen.queryByText('Life Phases')).toBeNull();
    expect(screen.queryByText('📊 Budget Phases')).toBeNull();
    expect(document.querySelector('.budget-phases-timeline-row')).toBeNull();

    // Open Budget Modal via Set Budget button
    const setBudgetBtn = screen.getByRole('button', { name: /Set Budget/i });
    fireEvent.click(setBudgetBtn);
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();

    // Verify Budget Phases heading with correct class is rendered in the modal
    const phasesHeading = document.querySelector('.budget-phases-heading');
    expect(phasesHeading).not.toBeNull();
    expect(phasesHeading.textContent).toBe('Life Events Timeline');

    // Close modal
    const cancelBtn = document.querySelector('.budget-modal-card .btn-secondary');
    if (cancelBtn) fireEvent.click(cancelBtn);
  });

  test.skip('11. Budget Modal - Compact Info Interaction & Popover', async () => {
    navigateToStep2WithTimeline();

    // Open the Budget Modal by clicking Set Budget button
    const setBudgetBtn = screen.getByRole('button', { name: /Set Budget/i });
    fireEvent.click(setBudgetBtn);

    // Verify modal is open
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();

    // Verify the old large explanation box and active event chips are NOT rendered in the main column
    expect(document.querySelector('.phase-explanation-box')).toBeNull();
    expect(document.querySelector('.active-events-container')).toBeNull();

    // Find the compact info icon button next to the budget phase title
    const infoBtn = document.querySelector('.phase-info-icon-btn');
    expect(infoBtn).not.toBeNull();

    // Popover should not be visible initially
    expect(document.querySelector('.phase-info-popover')).toBeNull();

    // Click the info button to toggle popover
    fireEvent.click(infoBtn);
    
    // Popover should now be visible
    const popover = document.querySelector('.phase-info-popover');
    expect(popover).not.toBeNull();
    expect(popover.textContent).toContain('Why this phase exists');
    expect(popover.textContent).toContain('Active Events:');
    expect(popover.textContent).toContain('Salary / Main Income');

    // Click document body to verify it closes
    fireEvent.click(document.body);
    expect(document.querySelector('.phase-info-popover')).toBeNull();
  });

  test('12. Budget Modal - Childcare locked & orange glow', async () => {
    navigateToStep2();
    
    // Add child Liam, born at 35 (default)
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });

    // Open Budget Modal via Set Budget button
    const setBudgetBtn = screen.getByRole('button', { name: /Set Budget/i });
    fireEvent.click(setBudgetBtn);
 
    // Verify modal is open
    expect(screen.getByRole('heading', { name: /Budget/i, level: 3 })).toBeDefined();
 
    // Verify the "Childcare Adjustment" box is NOT rendered in the modal
    expect(document.querySelector('.childcare-adjustment-card')).toBeNull();
 
    // Select Needs category ring to show the Needs breakdown
    const needsRing = screen.getAllByText(/Needs/i)[0].closest('.budget-card');
    fireEvent.click(needsRing);
 
    // Find Childcare row in Needs breakdown
    const childcareRow = document.querySelector('.childcare-locked-glow');
    expect(childcareRow).not.toBeNull();
    expect(childcareRow.textContent).toContain('Childcare');
    expect(childcareRow.textContent).toContain('🔒');
    expect(childcareRow.textContent).toContain('$1,250');
 
    // Verify input fields are shown for other needs like Housing, but Childcare does not have an input
    const housingRow = Array.from(document.querySelectorAll('.budget-input-row')).find(r => r.textContent.includes('Housing'));
    expect(housingRow.querySelector('input')).not.toBeNull();
 
    expect(childcareRow.querySelector('input')).toBeNull();
  });

  test('13. Deleting a child event clears selected detail card', async () => {
    navigateToStep2();

    // Create a child event
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });

    // Assert haveChild modal opens
    expect(screen.getByRole('heading', { name: /Add Child/i })).toBeDefined();

    // Enter child name
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });

    // Set annual childcare cost to 0
    const costInput = getInputByWrapperText(/Annual Childcare Cost/i);
    fireEvent.change(costInput, { target: { value: '0' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDefined();
    });
    // Select Rebalance Budget so we don't get a career/promotion event at age 35
    const rebalanceOption = screen.getByText('Rebalance Budget');
    fireEvent.click(rebalanceOption);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });

    // Find the child start element on the timeline/chart
    const birthTextNode = screen.getAllByText('👶 Have Child: Liam')[0];
    const birthNode = birthTextNode.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');
    expect(birthNode).not.toBeNull();

    // Click to select
    fireEvent.click(birthNode);

    // Confirm “Have Child” detail card appears (which contains the edit button)
    const detailCard = document.querySelector('.selected-event-details-card');
    expect(detailCard).not.toBeNull();
    expect(detailCard.textContent).toContain('Have Child: Liam');

    // Click Edit Decision to open the edit modal
    const editBtn = screen.getByRole('button', { name: /Edit Decision/i });
    fireEvent.click(editBtn);

    // Verify Delete Child button is present in the dialog
    const deleteBtn = screen.getByRole('button', { name: /Delete Child/i });
    expect(deleteBtn).toBeDefined();

    // Click Delete Child
    fireEvent.click(deleteBtn);

    // Verify modal is closed, child event is deleted from timeline, and the detail card disappears
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Edit Child Details/i })).toBeNull();
      expect(screen.queryByText('👶 Have Child: Liam')).toBeNull();
      expect(document.querySelector('.selected-event-details-card')).toBeNull();
    });
  });

  test('14. Clicking on the work/promotion event allows editing/deleting it', async () => {
    navigateToStep2();

    // Create a child event with default (promotion) strategy
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Child/i })).toBeNull();
    });

    // Find the career/promotion milestone icon
    const promoTextNode = screen.getAllByText('📈 Career Phase: Promotion (Liam)')[0];
    const promoNode = promoTextNode.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');
    expect(promoNode).not.toBeNull();

    // Click to select
    fireEvent.click(promoNode);

    // Confirm detail card appears
    const detailCard = document.querySelector('.selected-event-details-card');
    expect(detailCard).not.toBeNull();
    expect(detailCard.textContent).toContain('Career Phase: Promotion (Liam)');

    // Click Edit Decision to open the edit modal
    const editBtn = screen.getByRole('button', { name: /Edit Decision/i });
    fireEvent.click(editBtn);

    // Verify Career Change modal opens
    expect(screen.getByRole('heading', { name: /Income Change/i })).toBeDefined();
  });

});
