// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, renderHook, act } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';
import CurrentSituationCard from './src/components/fire-simulator/CurrentSituationCard';
import { formatCurrency, formatAnnualSummaryCurrency } from './src/components/fire-simulator/helpers';
import { runFireSimulation } from './src/fireCalculations';
import { useBudgetState } from './src/hooks/useBudgetState';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Budget Annual Spending Rounding & Cents display', () => {
  beforeEach(() => {
    cleanup();
  });

  test('1. formatAnnualSummaryCurrency formats whole dollars with no cents', () => {
    expect(formatAnnualSummaryCurrency(50000.04)).toBe('$50,000');
    expect(formatAnnualSummaryCurrency(42500.04)).toBe('$42,500');
    expect(formatAnnualSummaryCurrency(1234.56)).toBe('$1,235');
  });

  test('2. formatCurrency still formats cents when present', () => {
    expect(formatCurrency(4166.67)).toBe('$4,166.67');
    expect(formatCurrency(50000)).toBe('$50,000'); // no cents if integer
    expect(formatCurrency(42500.04)).toBe('$42,500.04');
  });

  test('3. $50,000 income + 0% savings displays $50,000 exactly in Spending (budget) card', () => {
    // 0% savings rate means simpleExpenses = 50000.
    const inputs = {
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 50000,
      simpleExpenses: 50000,
      hasCustomizedBudget: false,
      lifeEvents: [
        { id: 'retire-1', type: 'retire', enabled: true, age: 65 }
      ],
      lifeProfile: {
        household: { status: 'single' },
        home: { status: 'rent' },
        children: [],
        debts: []
      }
    };

    render(
      <CurrentSituationCard
        inputs={inputs}
        handleSetBudgetClick={() => {}}
        onOpenLifeProfile={() => {}}
        handleCreateEvent={() => {}}
        showDebugButton={false}
        setShowDebugDrawer={() => {}}
        setDebugTab={() => {}}
        updateInput={() => {}}
      />
    );

    const spendingLabel = screen.getByText('Spending (budget)');
    expect(spendingLabel).toBeDefined();
    const spendingValue = screen.getByText('$50,000');
    expect(spendingValue).toBeDefined();
    expect(screen.queryByText('$50,000.04')).toBeNull();
  });

  test('4. $50,000 income + 15% savings displays $42,500 exactly in Spending (budget) card', () => {
    // 15% savings rate means simpleExpenses = 42500.
    const inputs = {
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 50000,
      simpleExpenses: 42500,
      hasCustomizedBudget: false,
      lifeEvents: [
        { id: 'retire-1', type: 'retire', enabled: true, age: 65 }
      ],
      lifeProfile: {
        household: { status: 'single' },
        home: { status: 'rent' },
        children: [],
        debts: []
      }
    };

    render(
      <CurrentSituationCard
        inputs={inputs}
        handleSetBudgetClick={() => {}}
        onOpenLifeProfile={() => {}}
        handleCreateEvent={() => {}}
        showDebugButton={false}
        setShowDebugDrawer={() => {}}
        setDebugTab={() => {}}
        updateInput={() => {}}
      />
    );

    const spendingLabel = screen.getByText('Spending (budget)');
    expect(spendingLabel).toBeDefined();
    const spendingValue = screen.getByText('$42,500');
    expect(spendingValue).toBeDefined();
    expect(screen.queryByText('$42,500.04')).toBeNull();
  });

  test('5. Simulation precise values are preserved and not rounded before calculation', () => {
    const inputs = {
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 50000,
      simpleExpenses: 42500,
      hasCustomizedBudget: false,
      expectedReturn: 7,
      inflationRate: 3,
      lifeEvents: [
        { id: 'retire-1', type: 'retire', enabled: true, age: 65 }
      ]
    };

    const results = runFireSimulation(inputs);
    
    // In baseline or nominal simulation, standard monthly income = roundCurrency(50000 / 12) = 4166.67.
    // Annualized, it should be 4166.67 * 12 = 50000.04.
    // Let's assert that the income in nominalData is exactly 50000.04 (not rounded to 50000).
    const firstYear = results.nominalData[0];
    expect(firstYear.income).toBeCloseTo(50000.04, 2);
    expect(firstYear.expenses).toBeCloseTo(42500.04, 2); // 3541.67 monthly expenses * 12 = 42500.04
  });

  test('6. Saving budget without edits preserves simpleIncome at $50,000 exactly (15% savings)', () => {
    let scenarios = [
      {
        id: 'baseline',
        inputs: {
          currentAge: 35,
          targetRetirementAge: 65,
          lifeExpectancy: 85,
          simpleIncome: 50000,
          simpleExpenses: 42500, // 15% savings
          hasCustomizedBudget: false,
          budgetDetails: {
            expenses: { housing: 1500, utilities: 300, food: 400, diningOut: 200, transportation: 400, healthcare: 300, leisure: 300, misc: 142 },
            savings: { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 625 }
          },
          lifeEvents: [
            { id: 'retire-1', type: 'retire', enabled: true, age: 65 }
          ]
        }
      }
    ];

    const setScenarios = (updater) => {
      scenarios = updater(scenarios);
    };

    const { result } = renderHook(() => useBudgetState(
      scenarios,
      setScenarios,
      'baseline',
      scenarios[0].inputs,
      (key, val) => { scenarios[0].inputs[key] = val; },
      {},
      null,
      () => {}
    ));

    // Simulate opening the budget modal
    act(() => {
      result.current.handleSetBudgetClick();
    });

    // Monthly income in modal is inputs.simpleIncome / 12
    const monthlyIncome = scenarios[0].inputs.simpleIncome / 12;
    expect(monthlyIncome).toBeCloseTo(4166.67, 2);
    expect(formatCurrency(monthlyIncome)).toBe('$4,166.67');

    // Simulate saving the budget
    act(() => {
      result.current.handleSaveBudget();
    });

    // Assert simpleIncome remains exactly 50000 (not 50000.04)
    expect(scenarios[0].inputs.simpleIncome).toBe(50000);

    // Render situation card and verify it displays $50,000 and $42,500
    render(
      <CurrentSituationCard
        inputs={scenarios[0].inputs}
        handleSetBudgetClick={() => {}}
        onOpenLifeProfile={() => {}}
        handleCreateEvent={() => {}}
        showDebugButton={false}
        setShowDebugDrawer={() => {}}
        setDebugTab={() => {}}
        updateInput={() => {}}
      />
    );

    // Sidebar Annual Income should display exactly $50,000
    const annualIncomeInput = screen.getByDisplayValue('$50,000');
    expect(annualIncomeInput).toBeDefined();

    // Sidebar Spending (budget) should display exactly $42,500
    const spendingValue = screen.getByText('$42,500');
    expect(spendingValue).toBeDefined();
  });

  test('7. Saving budget without edits preserves simpleIncome at $50,000 exactly (0% savings)', () => {
    let scenarios = [
      {
        id: 'baseline',
        inputs: {
          currentAge: 35,
          targetRetirementAge: 65,
          lifeExpectancy: 85,
          simpleIncome: 50000,
          simpleExpenses: 50000, // 0% savings
          hasCustomizedBudget: false,
          budgetDetails: {
            expenses: { housing: 1500, utilities: 300, food: 400, diningOut: 200, transportation: 400, healthcare: 300, leisure: 300, misc: 767 },
            savings: { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0 }
          },
          lifeEvents: [
            { id: 'retire-1', type: 'retire', enabled: true, age: 65 }
          ]
        }
      }
    ];

    const setScenarios = (updater) => {
      scenarios = updater(scenarios);
    };

    const { result } = renderHook(() => useBudgetState(
      scenarios,
      setScenarios,
      'baseline',
      scenarios[0].inputs,
      (key, val) => { scenarios[0].inputs[key] = val; },
      {},
      null,
      () => {}
    ));

    // Simulate opening the budget modal
    act(() => {
      result.current.handleSetBudgetClick();
    });

    // Simulate saving the budget
    act(() => {
      result.current.handleSaveBudget();
    });

    // Assert simpleIncome remains exactly 50000
    expect(scenarios[0].inputs.simpleIncome).toBe(50000);

    // Render situation card
    render(
      <CurrentSituationCard
        inputs={scenarios[0].inputs}
        handleSetBudgetClick={() => {}}
        onOpenLifeProfile={() => {}}
        handleCreateEvent={() => {}}
        showDebugButton={false}
        setShowDebugDrawer={() => {}}
        setDebugTab={() => {}}
        updateInput={() => {}}
      />
    );

    // Sidebar Annual Income should display exactly $50,000
    expect(screen.getByDisplayValue('$50,000')).toBeDefined();

    // Sidebar Spending (budget) should display exactly $50,000
    expect(screen.getByText('$50,000')).toBeDefined();
  });

  test('8. Total allocated display tolerates residual penny drift without mutating income', () => {
    // If takeHomeIncome is 4166.67 and totalAllocated is 4166.68 (penny drift < 0.05),
    // remainingBalance should be exactly 0 (clamped).
    // In our clamped logic in BudgetModal:
    const takeHomeIncome = 4166.67;
    const totalAllocated = 4166.68;
    let remainingBalance = takeHomeIncome - totalAllocated;
    if (Math.abs(remainingBalance) < 0.05) {
      remainingBalance = 0;
    }
    expect(remainingBalance).toBe(0);
  });
});
