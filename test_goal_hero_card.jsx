// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import GoalHeroCard from './src/components/fire-simulator/GoalHeroCard';
import { runFireSimulation } from './src/fireCalculations';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('GoalHeroCard Component Redesign', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('Shows projected age state when projectedRetirementAge is valid (State A)', () => {
    render(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={63}
        lifeExpectancy={85}
        hasSolvableRecommendations={false}
        status="comfortable"
        onTargetAgeChange={vi.fn()}
        isRetirementSuccessful={true}
      />
    );

    // Should display target age input
    const input = screen.getByRole('textbox');
    expect(input.value).toBe('60');

    // Should display projected age results (State A)
    expect(screen.getByText('Based on your current plan...')).toBeDefined();
    expect(screen.getByText('You can stop working at')).toBeDefined();
    expect(screen.getByText('63')).toBeDefined();
    expect(screen.getAllByText('years old').length).toBeGreaterThanOrEqual(2);
  });

  test('Shows earlier/on-track/later badge correctly', () => {
    const { rerender } = render(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={63} // later
        lifeExpectancy={85}
        hasSolvableRecommendations={false}
        status="comfortable"
        onTargetAgeChange={vi.fn()}
        isRetirementSuccessful={true}
      />
    );

    expect(screen.getByText('3 years later than your goal')).toBeDefined();

    // Rerender with earlier
    rerender(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={58} // earlier
        lifeExpectancy={85}
        hasSolvableRecommendations={false}
        status="comfortable"
        onTargetAgeChange={vi.fn()}
        isRetirementSuccessful={true}
      />
    );

    expect(screen.queryByText("You're on track")).toBeNull();

    // Rerender with on track (equal)
    rerender(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={60} // on track
        lifeExpectancy={85}
        hasSolvableRecommendations={false}
        status="comfortable"
        onTargetAgeChange={vi.fn()}
        isRetirementSuccessful={true}
      />
    );

    expect(screen.queryByText("You're on track")).toBeNull();
  });

  test('Shows encouragement state when projectedRetirementAge is null/Infinity/greater than lifeExpectancy (State B)', () => {
    const { rerender } = render(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={null} // null
        lifeExpectancy={85}
        hasSolvableRecommendations={true} // solvable
        status="sustainable"
        onTargetAgeChange={vi.fn()}
      />
    );

    // State B with solvable recommendations
    expect(screen.getByText('A few adjustments away.')).toBeDefined();
    expect(screen.getByText('Let’s get you there.')).toBeDefined();
    expect(screen.queryByText('You can stop working at')).toBeNull();

    // Rerender with Infinity
    rerender(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={Infinity}
        lifeExpectancy={85}
        hasSolvableRecommendations={true}
        status="sustainable"
        onTargetAgeChange={vi.fn()}
      />
    );
    expect(screen.getByText('A few adjustments away.')).toBeDefined();

    // Rerender with greater than life expectancy
    rerender(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={90} // > 85
        lifeExpectancy={85}
        hasSolvableRecommendations={true}
        status="sustainable"
        onTargetAgeChange={vi.fn()}
      />
    );
    expect(screen.getByText('A few adjustments away.')).toBeDefined();

    // Rerender with unsolvable recommendations
    rerender(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={null}
        lifeExpectancy={85}
        hasSolvableRecommendations={false} // unsolvable
        status="sustainable"
        onTargetAgeChange={vi.fn()}
      />
    );

    expect(screen.getByText('You’ve got a starting point.')).toBeDefined();
    expect(screen.getByText('Let’s build from here.')).toBeDefined();
    expect(screen.queryByText('A few adjustments away.')).toBeNull();
  });

  test('Never renders “Never” in the hero', () => {
    render(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge="never"
        lifeExpectancy={85}
        hasSolvableRecommendations={false}
        status="sustainable"
        onTargetAgeChange={vi.fn()}
      />
    );

    // Should render State B encouragement text
    expect(screen.getByText('You’ve got a starting point.')).toBeDefined();

    // Should NOT contain the word "never" anywhere in the hero card
    const container = screen.getByText('When do you want to stop working?').closest('.goal-hero-card');
    expect(container.textContent.toLowerCase()).not.toContain('never');
    expect(container.textContent.toLowerCase()).not.toContain('cannot retire');
    expect(container.textContent.toLowerCase()).not.toContain('not possible');
  });

  test('Target age input debounces changes and commits on blur/Enter', async () => {
    const handleTargetAgeChange = vi.fn();
    render(
      <GoalHeroCard
        currentAge={30}
        targetRetirementAge={60}
        projectedRetirementAge={63}
        lifeExpectancy={85}
        hasSolvableRecommendations={false}
        status="comfortable"
        onTargetAgeChange={handleTargetAgeChange}
        isRetirementSuccessful={true}
      />
    );

    const input = screen.getByRole('textbox');

    // Test debouncing: change value but do not advance time yet
    fireEvent.change(input, { target: { value: '55' } });
    expect(handleTargetAgeChange).not.toHaveBeenCalled();

    // Advance time by 150ms (less than 300ms)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(handleTargetAgeChange).not.toHaveBeenCalled();

    // Advance remaining time (150ms) to trigger debounce
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(handleTargetAgeChange).toHaveBeenCalledWith(55);

    // Reset mock
    handleTargetAgeChange.mockClear();

    // Test commit on blur: change value and blur
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.blur(input);
    expect(handleTargetAgeChange).toHaveBeenCalledWith(50);

    // Reset mock
    handleTargetAgeChange.mockClear();

    // Test commit on Enter key: change value and press Enter
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(handleTargetAgeChange).toHaveBeenCalledWith(45);
  });

  test('Regression: $0 invested assets + 0% savings + income equals spending yields null readyAge and encouragement State B', () => {
    const inputs = {
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7.0,
      postRetirementReturn: 5.0,
      inflationRate: 3.0,
      cashReturnRate: 2.0,
      lifestyleUpgrades: 0.0,
      swr: 4.0,
      includeTaxes: false,
      readinessCriteria: 'lastsComfortable',
      simpleIncome: 50000,
      simpleExpenses: 50000, // 0% savings rate
      simpleInvestments: 0,
      assets: {
        cash: 0,
        emergencyFund: 0,
        brokerage: 0,
        trad401k: 0,
        tradIra: 0,
        rothIra: 0,
        hsa: 0,
        realEstate: 0,
        other: 0,
        debts: 0
      },
      lifeEvents: [
        {
          id: 'retire-1',
          type: 'retire',
          name: 'Retirement',
          enabled: true,
          age: 65,
          spendingPercent: 70
        }
      ]
    };

    const simResult = runFireSimulation(inputs);
    expect(simResult.retirementReadyAge).toBeNull();
    expect(simResult.isRetirementSuccessful).toBe(false);

    render(
      <GoalHeroCard
        currentAge={35}
        targetRetirementAge={65}
        projectedRetirementAge={simResult.retirementReadyAge}
        lifeExpectancy={85}
        hasSolvableRecommendations={true}
        status={simResult.retirementOutcome}
        onTargetAgeChange={vi.fn()}
        isRetirementSuccessful={simResult.isRetirementSuccessful}
      />
    );

    expect(screen.getByText('A few adjustments away.')).toBeDefined();
    expect(screen.queryByText('You can stop working at')).toBeNull();
  });

  test('Regression: A valid funded plan still shows projected age normally', () => {
    const inputs = {
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7.0,
      postRetirementReturn: 5.0,
      inflationRate: 3.0,
      cashReturnRate: 2.0,
      lifestyleUpgrades: 0.0,
      swr: 4.0,
      includeTaxes: false,
      readinessCriteria: 'lastsComfortable',
      simpleIncome: 80000,
      simpleExpenses: 40000, // 50% savings rate
      simpleInvestments: 40000,
      assets: {
        cash: 50000,
        emergencyFund: 0,
        brokerage: 100000,
        trad401k: 0,
        tradIra: 0,
        rothIra: 0,
        hsa: 0,
        realEstate: 0,
        other: 0,
        debts: 0
      },
      lifeEvents: [
        {
          id: 'retire-1',
          type: 'retire',
          name: 'Retirement',
          enabled: true,
          age: 65,
          spendingPercent: 70
        }
      ]
    };

    const simResult = runFireSimulation(inputs);
    expect(simResult.retirementReadyAge).not.toBeNull();
    expect(simResult.retirementReadyAge).toBeLessThanOrEqual(85);
    expect(simResult.isRetirementSuccessful).toBe(true);

    render(
      <GoalHeroCard
        currentAge={35}
        targetRetirementAge={65}
        projectedRetirementAge={simResult.retirementReadyAge}
        lifeExpectancy={85}
        hasSolvableRecommendations={false}
        status={simResult.retirementOutcome}
        onTargetAgeChange={vi.fn()}
        isRetirementSuccessful={simResult.isRetirementSuccessful}
      />
    );

    expect(screen.getByText('Based on your current plan...')).toBeDefined();
    expect(screen.getByText('You can stop working at')).toBeDefined();
    expect(screen.getByText(String(simResult.retirementReadyAge))).toBeDefined();
  });
});
