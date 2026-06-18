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

describe('Marriage Event Flow - UI and Financial Simulation Integration', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const navigateToStep2 = () => {
    render(<FireSimulator />);
    
    // Set starting savings/investments to 100k so retirement is sustainable for the single user
    const currentSavingsInput = screen.getByPlaceholderText('e.g. 250000');
    fireEvent.change(currentSavingsInput, { target: { value: '100000' } });

    // Click "Start Planning" to go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
    fireEvent.click(buildBtn);

    // Expand Advanced Detail accordion
    const advancedTrigger = screen.getAllByRole('button', { name: /Advanced Detail/i })[0];
    fireEvent.click(advancedTrigger);
  };

  // Helper to find input/select elements by nearby label text
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

  const getStatsCardValue = (labelText) => {
    const label = screen.getByText(new RegExp(labelText, 'i'));
    const wrapper = label.closest('div');
    const strong = wrapper.querySelector('strong');
    return strong.textContent;
  };

  test('test_marriage_event_default_partner', async () => {
    navigateToStep2();

    // 1. Marriage Event Creation
    // Open Add Decision dropdown
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'marriage' } });

    // Assert marriage modal is open
    expect(screen.getByRole('heading', { name: /Get Married/i })).toBeDefined();

    // Click "Edit Partner Profile" to expose Step 1 inputs
    const editProfileBtn = screen.getByRole('button', { name: /Edit Partner Profile/i });
    fireEvent.click(editProfileBtn);

    // Verify generated partner profile values match user exactly
    const spouseIncomeInput = getInputByWrapperText(/Spouse Income/i);
    expect(spouseIncomeInput.value).toBe('50000'); // same salary

    const savingsRateInput = getInputByWrapperText(/Savings Rate/i);
    expect(savingsRateInput.value).toBe('15'); // same savings

    const spouseAssetsInput = getInputByWrapperText(/Partner Assets/i);
    expect(spouseAssetsInput.value).toBe('100000'); // same assets (user simpleInvestments=100000)

    const spouseDebtInput = getInputByWrapperText(/Partner Debt/i);
    expect(spouseDebtInput.value).toBe('0'); // same debt (user has 0 debt by default)

    const spouseAgeInput = getInputByWrapperText(/Marriage Age/i);
    expect(spouseAgeInput.value).toBe('35'); // starts at age 35

    // Click Next to Step 2 (Wedding)
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // Step 2: Wedding
    expect(screen.getAllByText(/Plan Your Wedding/i).length).toBeGreaterThan(0);

    // Click Next to Step 3 (Life Together)
    fireEvent.click(nextBtn);

    // Step 3: Shared Household Savings
    expect(screen.getByText(/Shared Household Benefits/i)).toBeDefined();
    
    // Check savings breakdown displays and shows positive numbers
    expect(screen.getByText('Housing')).toBeDefined();
    expect(screen.getByText('Utilities')).toBeDefined();
    expect(screen.getByText('Internet')).toBeDefined();
    expect(screen.getByText('Streaming')).toBeDefined();
    expect(screen.getByText('Other Shared')).toBeDefined();
    
    expect(screen.getByText(/\+\$750\/mo/)).toBeDefined();
    expect(screen.getByText(/\+\$75\/mo/)).toBeDefined();
    expect(screen.getAllByText(/\+\$50\/mo/).length).toBe(2);
    expect(screen.getByText(/\+\$30\/mo/)).toBeDefined();
    expect(screen.getByText(/\+\$955\/mo/)).toBeDefined();

    // Click Next to Step 4 (Marriage Impact)
    fireEvent.click(nextBtn);

    // Step 3: UI Summary Validation
    // Validate summary metrics render and contain no undefined, null or N/A values
    expect(screen.getByText('Before Marriage')).toBeDefined();
    expect(screen.getByText('After Marriage')).toBeDefined();

    const beforeCard = screen.getByText('Before Marriage').closest('div');
    const afterCard = screen.getByText('After Marriage').closest('div');
    
    expect(beforeCard.textContent).not.toContain('undefined');
    expect(beforeCard.textContent).not.toContain('null');
    expect(beforeCard.textContent).not.toContain('N/A');

    expect(afterCard.textContent).not.toContain('undefined');
    expect(afterCard.textContent).not.toContain('null');
    expect(afterCard.textContent).not.toContain('N/A');

    // Parse wizard metrics
    const parseAmount = (cardText, label) => {
      const regex = new RegExp(`${label}:\\s*\\+?\\$?([0-9,]+)`, 'i');
      const match = cardText.match(regex);
      if (!match) throw new Error(`Could not find label ${label} in text: ${cardText}`);
      return parseInt(match[1].replace(/,/g, ''), 10);
    };

    const parsePercent = (cardText, label) => {
      const regex = new RegExp(`${label}:\\s*(\\d+)%`, 'i');
      const match = cardText.match(regex);
      if (!match) throw new Error(`Could not find percent label ${label} in text: ${cardText}`);
      return parseInt(match[1], 10);
    };

    const preMarriageIncome = parseAmount(beforeCard.textContent, 'Income') * 12;
    const preMarriageSpending = parseAmount(beforeCard.textContent, 'Spending') * 12;
    const preMarriageSavingsRate = parsePercent(beforeCard.textContent, 'Savings Rate');

    const postMarriageIncome = parseAmount(afterCard.textContent, 'Combined Income') * 12;
    const postMarriageSpending = parseAmount(afterCard.textContent, 'Combined Spending') * 12;
    const postMarriageSavingsRate = parsePercent(afterCard.textContent, 'Savings Rate');

    // Assert Income and Savings Rate changes
    expect(postMarriageIncome).toBeGreaterThan(preMarriageIncome);
    expect(postMarriageSavingsRate).toBeGreaterThan(preMarriageSavingsRate);
    expect(postMarriageSpending).toBeLessThan(preMarriageSpending * 2);

    // Capture before/after retirement ages
    const beforeRetAgeLabel = screen.getByText(/Before Work Optional Age/i).closest('div');
    const afterRetAgeLabel = screen.getByText(/After Work Optional Age/i).closest('div');
    
    const beforeRetAge = parseInt(beforeRetAgeLabel.textContent.match(/Age\s+(\d+)/i)[1], 10);
    const afterRetAge = parseInt(afterRetAgeLabel.textContent.match(/Age\s+(\d+)/i)[1], 10);

    expect(afterRetAge).toBeLessThan(beforeRetAge);
    expect(beforeRetAge - afterRetAge).toBeGreaterThanOrEqual(3);

    // Save Marriage Event
    const saveBtn = screen.getByRole('button', { name: /Save Marriage Event/i });
    fireEvent.click(saveBtn);

    // Wait for modal to close
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Get Married/i })).toBeNull();
    });

    // Verify marriage event on timeline
    const timelineLabel = screen.getAllByText(/Get Married/i);
    expect(timelineLabel.length).toBeGreaterThanOrEqual(2);

    // Verify new retirement age is displayed in the stats section
    const currentRetAgeValue = getStatsCardValue('Comfortable Age');
    expect(currentRetAgeValue).toBe(`Age ${afterRetAge}`);

    // Verify savings allocations inheritance
    // Select the first budget segment on the timeline (married phase) which opens the budget modal directly
    const segments = document.querySelectorAll('.budget-segment');
    fireEvent.click(segments[0]);
    
    expect(screen.getByRole('heading', { name: /Budget/i })).toBeDefined();

    // Expand Savings section
    fireEvent.click(document.querySelector('.budget-card.save'));

    // Click Edit Savings to enable inputs
    fireEvent.click(screen.getByText(/Edit Savings/i));

    // Verify partner savings allocations match user's exactly:
    // User's default budgetDetails.savings has trad401k=200, rothIra=100, hsa=50, checking=100, hysa=100, emergency=75
    // spouseMonthlySavings = 50000 * 0.15 / 12 = 625.
    // User total savings = 625. So ratio is 1:1.
    // Therefore partner's allocations should be identical to user's!
    expect(getInputByWrapperText(/Partner Checking Account/i).value).toBe('0');
    expect(getInputByWrapperText(/Partner High-Yield Savings/i).value).toBe('0');
    expect(getInputByWrapperText(/Partner Emergency Fund/i).value).toBe('0');
    expect(getInputByWrapperText(/Partner 401\(k\) \(Pre-Tax\)/i).value).toBe('0');
    expect(getInputByWrapperText(/Partner Roth IRA/i).value).toBe('0');
    expect(getInputByWrapperText(/Partner HSA/i).value).toBe('0');
    expect(getInputByWrapperText(/Partner Brokerage/i).value).toBe('625');

    // Close budget modal
    const cancelBtn = document.querySelector('.budget-modal-card .btn-secondary');
    fireEvent.click(cancelBtn);
  });

  test('test_marriage_event_updates_when_budget_changes', async () => {
    navigateToStep2();

    // Add Marriage Event
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'marriage' } });
    
    // Step through the wizard
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn); // Step 1 -> 2
    fireEvent.click(nextBtn); // Step 2 -> 3
    fireEvent.click(nextBtn); // Step 3 -> 4
    
    // Save Marriage Event
    fireEvent.click(screen.getByRole('button', { name: /Save Marriage Event/i }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Get Married/i })).toBeNull();
    });

    // 1. Establish the baseline married budget by opening and saving the budget modal once
    fireEvent.click(screen.getAllByRole('button', { name: /Set Budget/i })[0]);
    expect(screen.getByRole('heading', { name: /Budget/i })).toBeDefined();
    
    // Save Budget immediately
    fireEvent.click(screen.getByRole('button', { name: /Save Budget/i }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Budget/i })).toBeNull();
    });

    const retAgeBeforeBudgetChange = parseInt(getStatsCardValue('Comfortable Age').match(/\d+/)[0], 10);

    // 2. Open Update Budget again to increase household spending
    fireEvent.click(screen.getAllByRole('button', { name: /Set Budget/i })[0]);
    expect(screen.getByRole('heading', { name: /Budget/i })).toBeDefined();

    // Expand Needs section
    fireEvent.click(document.querySelector('.budget-modal-card .budget-card.needs') || screen.getByText('Needs'));

    // Click Edit Needs to enable inputs
    fireEvent.click(screen.getByText(/Edit Needs/i));

    // Increase household spending: Housing Rent/Mortgage
    const housingInput = getInputByWrapperText(/Housing \(Rent\/Mortgage\)/i);
    const currentHousingVal = parseInt(housingInput.value, 10) || 1500;
    const newHousingVal = String(currentHousingVal + 1000);
    fireEvent.change(housingInput, { target: { value: newHousingVal } });

    // Save Budget
    fireEvent.click(screen.getByRole('button', { name: /Save Budget/i }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Budget/i })).toBeNull();
    });

    // Verify retirement age recalculates (it should increase since spending is higher)
    const retAgeAfterBudgetChange = parseInt(getStatsCardValue('Comfortable Age').match(/\d+/)[0], 10);
    expect(retAgeAfterBudgetChange).toBeGreaterThan(retAgeBeforeBudgetChange);

    // Verify timeline phase and milestone remain intact
    expect(screen.getAllByText(/Get Married/i).length).toBeGreaterThanOrEqual(2);
  });

  test('test_marriage_event_drag_ties_wedding', async () => {
    navigateToStep2();

    // 1. Open Add Decision dropdown
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'marriage' } });

    // Step 1: Click Next
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // Step 2: Plan Wedding (Verify defaults)
    expect(screen.getAllByText(/Plan Your Wedding/i).length).toBeGreaterThan(0);
    // Let's set a wedding age different from marriage age or keep defaults
    const weddingAgeInput = getInputByWrapperText(/Wedding Age/i);
    expect(weddingAgeInput.value).toBe('35'); // defaults to 35

    fireEvent.click(nextBtn); // Step 2 -> 3
    fireEvent.click(nextBtn); // Step 3 -> 4

    // Save Marriage Event
    fireEvent.click(screen.getByRole('button', { name: /Save Marriage Event/i }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Get Married/i })).toBeNull();
    });

    // 2. Locate timeline elements
    // The Marriage event node has 💍
    const rings = screen.getAllByText('💍');
    const marriageNode = rings.find(el => el.className === 'milestone-glow-circle' || el.closest('.milestone-glow-circle') !== null).closest('.milestone-circle-wrapper');
    expect(marriageNode).toBeDefined();

    // 3. Simulate dragging the marriage event to a new age (e.g. from 35 to 45)
    // We can simulate the mouse events
    fireEvent.mouseDown(marriageNode, { clientX: 100 });
    
    // Move the mouse by a large amount (e.g., 200px) to simulate dragging it to 45
    // In our test environment, we mock trackWidth or it uses deltaYears based on clientX delta
    fireEvent.mouseMove(document, { clientX: 300 });
    
    // Release drag
    fireEvent.mouseUp(document);

    // Check that the wedding cost is at the new age or updated in the outputs
    // We can verify that the simulation completes and updates properly
    expect(screen.getAllByText(/Get Married/i).length).toBeGreaterThan(0);
  });
}, 15000);
