// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import FireSimulator from './src/components/FireSimulator';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { initializeActiveLoans } from './src/calculators/fire/debts.js';

// Mock Recharts to avoid layout/sizable errors in jsdom
// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Borrowing Events & Payoff Plans Calculations', () => {
  let baseInputs;

  beforeEach(() => {
    // Reset inputs
    baseInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    baseInputs.lifeEvents = baseInputs.lifeEvents || [];
  });

  test('initializeActiveLoans handles borrowing defaults correctly', () => {
    const profile = {
      lifeEvents: [
        {
          id: 'borrow-student',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'My Student Loan',
          balance: 30000,
          interestRate: 5.0,
          minPayment: 318.20,
          startAge: 35,
          isExisting: true,
          enabled: true
        }
      ]
    };

    const activeLoans = initializeActiveLoans(profile, [], 35);
    expect(activeLoans.length).toBe(1);
    expect(activeLoans[0].name).toBe('My Student Loan');
    expect(activeLoans[0].balance).toBe(30000);
    expect(activeLoans[0].interestRate).toBe(0.05);
    expect(activeLoans[0].payment).toBe(318.20 * 12);
    expect(activeLoans[0].isExisting).toBe(true);
    expect(activeLoans[0].isFutureBorrowing).toBe(false);
  });

  test('future borrowing event starts with 0 balance and activates at start age', () => {
    const inputs = {
      ...baseInputs,
      currentAge: 35,
      lifeExpectancy: 45,
      lifeEvents: [
        {
          id: 'borrow-car',
          type: 'borrowing',
          borrowingType: 'carLoan',
          name: 'Future Car Loan',
          balance: 20000,
          interestRate: 6.0,
          minPayment: 386.66,
          startAge: 38,
          isExisting: false,
          enabled: true
        }
      ]
    };

    const result = runFireSimulation(inputs);
    const logs = result.nominalData;
    // Before age 38, the loan is not active, so there should be no minimum debt payment logged
    const logsBefore = logs.filter(log => log.age < 38);
    logsBefore.forEach(log => {
      expect(log.minDebtPayment || 0).toBe(0);
    });

    // At and after age 38, minimum payment should be active
    const logAt38 = logs.find(log => log.age === 38);
    expect(logAt38.minDebtPayment).toBeGreaterThan(0);
  });

  test('budget separates min payment (expenses) and extra payment (post-tax deduction)', () => {
    const inputs = {
      ...baseInputs,
      currentAge: 35,
      lifeExpectancy: 45,
      lifeEvents: [
        {
          id: 'borrow-personal',
          type: 'borrowing',
          borrowingType: 'personalLoan',
          name: 'Personal Loan',
          balance: 10000,
          interestRate: 8.0,
          minPayment: 313.36,
          startAge: 35,
          isExisting: true,
          enabled: true
        },
        {
          id: 'payoff-personal',
          type: 'payoffPlan',
          borrowingId: 'borrow-personal',
          extraPayment: 200,
          startAge: 35,
          payoffAge: 38,
          linked: true,
          enabled: true
        }
      ]
    };

    const result = runFireSimulation(inputs);
    const logs = result.nominalData;
    
    // Check year 35 logs
    const log35 = logs.find(log => log.age === 35);
    // Min payment should be part of minDebtPayment
    expect(log35.minDebtPayment).toBeCloseTo(313.36 * 12, 0);
    // Extra payment should be part of debtPayoffAllocation
    expect(log35.debtPayoffAllocation).toBeCloseTo(200 * 12, 0);
  });
});

describe('Borrowing Events & Payoff Plans UI', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("Plan Screen displays correct initial starting state", async () => {
    render(<FireSimulator />);
    
    // Check Current Situation card title
    expect(screen.getAllByText(/Situation/i)[0]).toBeDefined();
    
    // Check baseline events on the timeline
    expect(screen.getAllByText(/You're Set!/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Social Security/i).length).toBeGreaterThan(0);
  });

  const navigateToStep2 = () => {
    render(<FireSimulator />);
    // Click Start Planning button to go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
    fireEvent.click(buildBtn);
  };

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

  const parseVal = (input) => {
    if (!input || !input.value) return 0;
    return Number(input.value.replace(/[^\d.-]/g, ''));
  };

  test("Plan Screen displays correct initial starting state", async () => {
    render(<FireSimulator />);
    
    // Check Current Situation card title
    expect(screen.getAllByText(/Situation/i)[0]).toBeDefined();
    
    // Check baseline events on the timeline
    expect(screen.getAllByText(/You're Set!/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Social Security/i).length).toBeGreaterThan(0);
  });

  test('renders Borrowing dropdown and opens setup modal with correct defaults', async () => {
    navigateToStep2();

    const selects = screen.getAllByRole('combobox');
    const borrowingSelect = selects.find(sel => sel.innerHTML.includes('studentLoan'));
    expect(borrowingSelect).toBeDefined();

    // Select Student Loan option
    fireEvent.change(borrowingSelect, { target: { value: 'studentLoan' } });

    // Verify modal is open and has correct title
    expect(screen.getByText('🎓 Student Loan')).toBeDefined();

    // Verify core fields are populated with defaults
    expect(getInputByWrapperText(/Friendly Name/i).value).toBe('Student Loan');
    expect(parseVal(getInputByWrapperText(/Starting Balance \/ Amount/i))).toBe(30000);
    expect(parseVal(getInputByWrapperText(/Interest Rate/i))).toBe(5);
    expect(parseVal(getInputByWrapperText(/Minimum Monthly Payment/i))).toBe(318.2);

    // Verify compassionate copy is present
    expect(screen.getByText(/You're not stuck with this number/i)).toBeDefined();
    expect(screen.getByText(/typical student loans use a 10-year term/i)).toBeDefined();
    expect(screen.getByText(/Create a payoff plan too/i)).toBeDefined();
  });

  test('Car Loan modal has car price, down payment, and calculates loan amount', async () => {
    navigateToStep2();

    const selects = screen.getAllByRole('combobox');
    const borrowingSelect = selects.find(sel => sel.innerHTML.includes('carLoan'));
    fireEvent.change(borrowingSelect, { target: { value: 'carLoan' } });

    expect(screen.getByText('🚗 Car Loan')).toBeDefined();

    // Verify car-specific fields
    const carPriceInput = getInputByWrapperText(/Car Price/i);
    const downPaymentInput = getInputByWrapperText(/Down Payment/i);
    const loanAmountInput = getInputByWrapperText(/Loan Amount \/ Starting Balance/i);

    expect(parseVal(carPriceInput)).toBe(25000);
    expect(parseVal(downPaymentInput)).toBe(5000);
    expect(parseVal(loanAmountInput)).toBe(20000);

    // Change car price, loan amount should update automatically
    fireEvent.change(carPriceInput, { target: { value: '30000' } });
    expect(parseVal(loanAmountInput)).toBe(25000);

    // Change down payment, loan amount should update automatically
    fireEvent.change(downPaymentInput, { target: { value: '10000' } });
    expect(parseVal(loanAmountInput)).toBe(20000);

    // Verify compassionate copy
    expect(screen.getByText(/Fixed 5-year auto loan term/i)).toBeDefined();
  });

  test('Credit Card Balance modal alerts on interest trap when payment does not cover interest', async () => {
    navigateToStep2();

    const selects = screen.getAllByRole('combobox');
    const borrowingSelect = selects.find(sel => sel.innerHTML.includes('creditCard'));
    fireEvent.change(borrowingSelect, { target: { value: 'creditCard' } });

    expect(screen.getByText('💳 Credit Card Balance')).toBeDefined();

    const paymentInput = getInputByWrapperText(/Minimum Monthly Payment/i);

    // Default: Balance = 5000, APR = 22, MinPayment = 100
    // Monthly interest accrued = 5000 * 0.22 / 12 = 91.67
    // Since MinPayment (100) > 91.67, there should be no warning box initially
    expect(screen.queryByText(/Interest Trap Alert/i)).toBeNull();

    // Set payment to 80 (which is <= 91.67)
    fireEvent.change(paymentInput, { target: { value: '80' } });

    // Now the warning box should be visible
    expect(screen.getByText(/Interest Trap Alert/i)).toBeDefined();
    expect(screen.getByText(/Your minimum payment of \$80 is less than or equal to the monthly interest accrued/i)).toBeDefined();
  });

  test('Borrowing Timing selects Happening now and pins/disables Start Age', async () => {
    navigateToStep2();

    const selects = screen.getAllByRole('combobox');
    const borrowingSelect = selects.find(sel => sel.innerHTML.includes('studentLoan'));
    fireEvent.change(borrowingSelect, { target: { value: 'studentLoan' } });

    expect(screen.getByText('🎓 Student Loan')).toBeDefined();

    // Verify radio buttons
    const happeningNowRadio = screen.getByLabelText(/Happening now/i);
    const futureAgeRadio = screen.getByLabelText(/Future age/i);
    const startAgeInput = getInputByWrapperText(/Start Age/i);

    expect(happeningNowRadio.checked).toBe(true);
    expect(futureAgeRadio.checked).toBe(false);
    expect(startAgeInput.disabled).toBe(true);

    // Click Future age
    fireEvent.click(futureAgeRadio);
    expect(happeningNowRadio.checked).toBe(false);
    expect(futureAgeRadio.checked).toBe(true);
    expect(startAgeInput.disabled).toBe(false);

    // Set invalid future start age (same or less than current age, which defaults to 35 in inputs)
    fireEvent.change(startAgeInput, { target: { value: '35' } });
    expect(screen.getByText(/must be greater than your current age/i)).toBeDefined();

    // Verify Save Event button is disabled
    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    expect(saveBtn.disabled).toBe(true);
  });
});

describe('Unification & Start Timing (9 Required Test Cases)', () => {
  let baseInputs;

  beforeEach(() => {
    baseInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    baseInputs.lifeEvents = baseInputs.lifeEvents || [];
    baseInputs.currentAge = 35;
    baseInputs.lifeExpectancy = 85;
    // ensure no other assets/debts are present
    baseInputs.assets = {
      cash: 0,
      emergencyFund: 0,
      brokerage: 5000,
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      realEstate: 0,
      other: 0,
      debts: 0
    };
  });

  // Test Case 1: Current student loan reduces today's net worth.
  test('1. Current student loan reduces today\'s net worth', () => {
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'student-loan-current',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'Current Student Loan',
          balance: 30000,
          interestRate: 5.0,
          minPayment: 300,
          startAge: 35,
          timing: 'current',
          enabled: true
        }
      ]
    };
    const result = runFireSimulation(inputs);
    // Year 0 (age 35): brokerage = 5000, student loan debt = 30000.
    // End of year net worth is -19000
    expect(result.nominalData[0].netWorth).toBeCloseTo(-19000, 1);
    expect(result.nominalData[0].debtBalance).toBeCloseTo(27900, 0);
  });

  // Test Case 2: Future student loan does not reduce today's net worth.
  test('2. Future student loan does not reduce today\'s net worth', () => {
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'student-loan-future',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'Future Student Loan',
          balance: 30000,
          interestRate: 5.0,
          minPayment: 300,
          startAge: 40,
          timing: 'future',
          enabled: true
        }
      ]
    };
    const result = runFireSimulation(inputs);
    // Year 0 (age 35) net worth = 12500 (debt is not active yet)
    expect(result.nominalData[0].netWorth).toBeCloseTo(12500, 1);
    expect(result.nominalData[0].debtBalance).toBe(0);

    // Active at age 40
    const logAt40 = result.nominalData.find(log => log.age === 40);
    expect(logAt40.debtBalance).toBeGreaterThan(0);
  });

  // Test Case 3: Current credit card balance reduces today's net worth.
  test('3. Current credit card balance reduces today\'s net worth', () => {
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'credit-card-current',
          type: 'borrowing',
          borrowingType: 'creditCard',
          name: 'Current Credit Card',
          balance: 5000,
          interestRate: 20.0,
          minPayment: 150,
          startAge: 35,
          timing: 'current',
          enabled: true
        }
      ]
    };
    const result = runFireSimulation(inputs);
    // Net worth = 6500 (end of year 35)
    expect(result.nominalData[0].netWorth).toBeCloseTo(6500, 1);
    expect(result.nominalData[0].debtBalance).toBeCloseTo(4200, 0);
  });

  // Test Case 4: Current car loan reduces today's net worth.
  test('4. Current car loan reduces today\'s net worth', () => {
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'car-loan-current',
          type: 'borrowing',
          borrowingType: 'carLoan',
          name: 'Current Car Loan',
          balance: 20000,
          interestRate: 6.0,
          minPayment: 386.66,
          startAge: 35,
          timing: 'current',
          enabled: true
        }
      ]
    };
    const result = runFireSimulation(inputs);
    // Net worth = -8700 (end of year 35)
    expect(result.nominalData[0].netWorth).toBeCloseTo(-8700, 1);
    expect(result.nominalData[0].debtBalance).toBeCloseTo(16560, 0);
  });

  // Test Case 5: Today's Net Worth equals the first Wealth Journey chart point.
  test('5. Today\'s Net Worth equals the first Wealth Journey chart point', () => {
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'student-loan-current',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'Current Student Loan',
          balance: 30000,
          interestRate: 5.0,
          minPayment: 300,
          startAge: 35,
          timing: 'current',
          enabled: true
        }
      ]
    };
    const result = runFireSimulation(inputs);
    const todayLog = result.nominalData[0];
    const todayAssets = (todayLog.portfolio || 0) + (todayLog.homeValue || 0);
    const todayDebt = (todayLog.debtBalance || 0) + (todayLog.mortgageBalance || 0);
    const todayNetWorth = todayAssets - todayDebt;

    expect(todayNetWorth).toBe(todayLog.netWorth);
  });

  // Test Case 6: Budget includes payments for current borrowing events.
  test('6. Budget includes payments for current borrowing events', () => {
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'student-loan-current',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'Current Student Loan',
          balance: 30000,
          interestRate: 5.0,
          minPayment: 300,
          startAge: 35,
          timing: 'current',
          enabled: true
        }
      ]
    };
    const result = runFireSimulation(inputs);
    // Year 0 (age 35) minimum payment should be logged (300 * 12 = 3600)
    expect(result.nominalData[0].minDebtPayment).toBeCloseTo(3600, 0);
  });

  // Test Case 7: Budget does not include payments for future borrowing events until the event starts.
  test('7. Budget does not include payments for future borrowing events until the event starts', () => {
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'student-loan-future',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'Future Student Loan',
          balance: 30000,
          interestRate: 5.0,
          minPayment: 300,
          startAge: 40,
          timing: 'future',
          enabled: true
        }
      ]
    };
    const result = runFireSimulation(inputs);
    
    // Ages 35 to 39: minDebtPayment is 0
    for (let age = 35; age < 40; age++) {
      const log = result.nominalData.find(l => l.age === age);
      expect(log.minDebtPayment || 0).toBe(0);
    }

    // Age 40: minDebtPayment > 0
    const log40 = result.nominalData.find(l => l.age === 40);
    expect(log40.minDebtPayment).toBeGreaterThan(0);
  });

  // Test Case 8: Existing events at current age migrate to "Happening now".
  test('8. Existing events at current age migrate to "Happening now"', () => {
    // Legacy event: has startAge === currentAge, isExisting is not set or true, timing is undefined
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'legacy-loan',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'Legacy Loan',
          balance: 10000,
          interestRate: 5.0,
          minPayment: 100,
          startAge: 35,
          enabled: true
          // no timing field (legacy)
        }
      ]
    };
    const result = runFireSimulation(inputs);
    // Since startAge === currentAge (35), it should initialize as existing/current and reduce today's net worth
    expect(result.nominalData[0].netWorth).toBeCloseTo(2000, 1); // 11300 portfolio - 9300 debt
    expect(result.nominalData[0].debtBalance).toBeCloseTo(9300, 0);
  });

  // Test Case 9: Existing future events remain future events.
  test('9. Existing future events remain future events', () => {
    // Legacy event: has startAge > currentAge, isExisting is false, timing is undefined
    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'legacy-future-loan',
          type: 'borrowing',
          borrowingType: 'studentLoan',
          name: 'Legacy Future Loan',
          balance: 10000,
          interestRate: 5.0,
          minPayment: 100,
          startAge: 40,
          isExisting: false,
          enabled: true
          // no timing field (legacy)
        }
      ]
    };
    const result = runFireSimulation(inputs);
    // Today's net worth should not be affected
    expect(result.nominalData[0].netWorth).toBeCloseTo(12500, 1);
    expect(result.nominalData[0].debtBalance).toBe(0);

    // Active at age 40
    const log40 = result.nominalData.find(l => l.age === 40);
    expect(log40.debtBalance).toBeGreaterThan(0);
  });
});
