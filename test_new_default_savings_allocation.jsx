// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import FireSimulator from './src/components/FireSimulator.jsx';

describe('New Default Savings Allocation', () => {
  beforeEach(() => {
    cleanup();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  // Helper to find input/select elements by nearby label text
  const getInputByWrapperText = (textRegex) => {
    const elements = screen.getAllByText(textRegex);
    for (const el of elements) {
      const wrapper = el.closest('.budget-input-row, .input-wrapper, .form-group');
      if (wrapper) {
        const input = wrapper.querySelector('input, select');
        if (input) return input;
      }
    }
    return null;
  };

  test('New default plans route 100% of savings to brokerage and 0 to others', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      includeTaxes: false
    };
    const results = runFireSimulation(inputs);
    const firstYearLog = results.nominalData[0];
    const actual = firstYearLog.actualContributions;

    expect(actual.brokerage).toBe(625 * 12);
    expect(actual.checking).toBe(0);
    expect(actual.hysa).toBe(0);
    expect(actual.emergency).toBe(0);
    expect(actual.trad401k).toBe(0);
    expect(actual.rothIra).toBe(0);
    expect(actual.hsa).toBe(0);
    expect(actual.debt).toBe(0);
    expect(actual.other).toBe(0);
  });

  test('Brokerage grows from both contributions and returns', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      includeTaxes: false,
      expectedReturn: 7, // 7% returns
      inflationRate: 0, // no inflation to simplify
      incomeList: [
        {
          ...DEFAULT_FIRE_INPUTS.incomeList[0],
          growthRate: 0
        }
      ],
      assets: {
        checking: 0,
        emergencyFund: 0,
        brokerage: 5000 // starts at 5000
      }
    };
    const results = runFireSimulation(inputs);
    const log0 = results.nominalData[0]; // age 35
    const log1 = results.nominalData[1]; // age 36

    // At age 35 (year 0), starting balance is 5000, contributions is 625 * 12 = 7500. No returns are added in the first year.
    expect(log0.brokerageBalance).toBe(12500);

    // At age 36 (year 1), starting balance is 12500, returns are 12500 * 7% = 875, contributions are 7500.
    // Ending balance = 12500 + 875 + 7500 = 20875.
    expect(log1.brokerageBalance).toBeCloseTo(20875, -1);
  });

  test('Existing customized plans retain their allocations', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      hasCustomizedSavingsAllocation: true,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      includeTaxes: false,
      budgetDetails: {
        ...DEFAULT_FIRE_INPUTS.budgetDetails,
        savings: {
          trad401k: 200,
          rothIra: 100,
          tradIra: 0,
          hsa: 50,
          brokerage: 0,
          checking: 100,
          hysa: 100,
          emergency: 75,
          debt: 0,
          other: 0
        }
      }
    };
    const results = runFireSimulation(inputs);
    const firstYearLog = results.nominalData[0];
    const actual = firstYearLog.actualContributions;

    expect(actual.trad401k).toBe(200 * 12);
    expect(actual.rothIra).toBe(100 * 12);
    expect(actual.checking).toBe(100 * 12);
    expect(actual.hysa).toBe(100 * 12);
    expect(actual.emergency).toBe(75 * 12);
    expect(actual.brokerage).toBe(0);
  });


  test('Career raise / income change with an uncustomized budget sends the increased surplus to brokerage', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      includeTaxes: false,
      inflationRate: 0,
      incomeList: [
        {
          ...DEFAULT_FIRE_INPUTS.incomeList[0],
          growthRate: 0
        }
      ],
      simpleIncome: 50000,
      simpleExpenses: 42500, // surplus 7500/yr (625/mo)
      lifeEvents: [
        {
          id: 'raise',
          type: 'incomeItem',
          name: 'Raise',
          amount: 60000, // increase income to 60k/yr starting at age 40
          growthRate: 0,
          startAge: 40,
          endAge: 65,
          enabled: true
        }
      ]
    };
    const results = runFireSimulation(inputs);
    const logAge35 = results.nominalData.find(d => d.age === 35);
    const logAge41 = results.nominalData.find(d => d.age === 41);

    // Age 35: surplus is 50000 - 42500 = 7500. Brokerage contribution is 7500.
    expect(logAge35.actualContributions.brokerage).toBe(7500);
    
    // Age 41: income is 60000, expenses are 42500. Surplus is 17500. Brokerage contribution is 17496 due to monthly rounding.
    expect(logAge41.actualContributions.brokerage).toBe(17496);
  });

  test('Spending increase with an uncustomized budget reduces brokerage contributions dynamically', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      includeTaxes: false,
      inflationRate: 0,
      incomeList: [
        {
          ...DEFAULT_FIRE_INPUTS.incomeList[0],
          growthRate: 0
        }
      ],
      simpleIncome: 50000,
      simpleExpenses: 42500, // surplus 7500/yr (625/mo)
      lifeEvents: [
        {
          id: 'expense-increase',
          type: 'spendingItem',
          name: 'Lifestyle Inflation',
          amount: 45000, // increase expenses to 45k/yr starting at age 40 (net increase of 2500/yr)
          growthRate: 0,
          startAge: 40,
          endAge: 65,
          enabled: true
        }
      ]
    };
    const results = runFireSimulation(inputs);
    const logAge35 = results.nominalData.find(d => d.age === 35);
    const logAge41 = results.nominalData.find(d => d.age === 41);

    // Age 35: surplus is 50000 - 42500 = 7500.
    expect(logAge35.actualContributions.brokerage).toBe(7500);
    
    // Age 41: income is 50000, expenses are 45000. Surplus is 5000. Brokerage contribution is 50004 - 45000 = 5004 due to monthly rounding.
    expect(logAge41.actualContributions.brokerage).toBe(5004);
  });

  test('Saving the budget flips hasCustomizedSavingsAllocation to true and prevents future overrides', async () => {
    render(<FireSimulator />);

    // Open Budget Modal from Step 1
    const budgetBtn = screen.getByRole('button', { name: /Set Budget|Calculate from budget/i });
    fireEvent.click(budgetBtn);

    // Expand the Savings section
    const savingsCard = document.querySelector('.budget-modal-card .budget-card.save') || screen.getAllByText(/Save & Invest/i)[0];
    fireEvent.click(savingsCard);

    // Click Edit Savings to enable inputs
    const editSavingsLink = screen.getByText(/Edit Savings/i);
    fireEvent.click(editSavingsLink);

    // Change checking account savings to 50
    const checkingAccInput = getInputByWrapperText(/Checking Account/i);
    expect(checkingAccInput).not.toBeNull();
    fireEvent.change(checkingAccInput, { target: { value: '50' } });

    // Click Save Budget
    const saveBudgetBtn = screen.getByRole('button', { name: /Save Budget/i });
    fireEvent.click(saveBudgetBtn);

    // Verify we are back on the main dashboard
    expect(screen.getByText(/Your Current Situation/i)).toBeDefined();
  });
});
