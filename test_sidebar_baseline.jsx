// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import CurrentSituationCard from './src/components/fire-simulator/CurrentSituationCard';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';
import { buildBaselineCurrentInputs } from './src/fireCalculations';

describe('Sidebar baseline decoupling from timeline events', () => {
  beforeEach(() => {
    cleanup();
  });

  test('buildBaselineCurrentInputs filters out timeline events but keeps derived events', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        children: [{ id: 'derived-baby', name: 'Existing Child', age: 2 }]
      },
      lifeEvents: [
        {
          id: 'timeline-baby',
          type: 'haveChild',
          name: 'Have a Child',
          enabled: true,
          age: 35
        }
      ]
    };

    const baseline = buildBaselineCurrentInputs(inputs);
    expect(baseline.lifeEvents.some(e => e.id === 'derived-baby')).toBe(true);
    expect(baseline.lifeEvents.some(e => e.id === 'timeline-baby')).toBe(false);
  });

  test('sidebar current situation is stable when timeline events are added, edited, or deleted', () => {
    const handleSetBudgetClickMock = vi.fn();
    const onOpenLifeProfileMock = vi.fn();
    const handleCreateEventMock = vi.fn();
    const updateInputMock = vi.fn();

    // 1. Start with baseline:
    // currentAge: 35, income: $50,000, savings rate: 15%, no shortfall
    const initialInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      simpleIncome: 50000,
      simpleExpenses: 42500, // 50,000 * (1 - 0.15) = 42500, savings rate = 15%
      savingsRate: 15,
      displayedSavingsRate: 15,
      hasCustomizedBudget: false,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        assets: { cash: 0, brokerage: 5000 },
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0 },
        home: { status: 'rent', monthlyRent: 1500 },
        children: [],
        debts: []
      },
      lifeEvents: [
        { id: 'retire-1', type: 'retire', name: 'Retirement', enabled: true, age: 65 }
      ]
    };

    const { rerender } = render(
      <CurrentSituationCard
        inputs={initialInputs}
        handleSetBudgetClick={handleSetBudgetClickMock}
        onOpenLifeProfile={onOpenLifeProfileMock}
        handleCreateEvent={handleCreateEventMock}
        updateInput={updateInputMock}
      />
    );

    // Sidebar spending should be baseline: $42,500
    expect(screen.getByText('$42,500')).toBeDefined();
    // Shortfall should not be present
    expect(screen.queryByText('Shortfall')).toBeNull();

    // 2. Add child event at age 35 with $15,000 annual childcare
    const inputsWithChildEvent = {
      ...initialInputs,
      lifeEvents: [
        ...initialInputs.lifeEvents,
        {
          id: 'child-timeline-event',
          type: 'haveChild',
          name: 'Have a Child',
          enabled: true,
          age: 35,
          birthAge: 35,
          childStartAge: 0,
          annualChildcareCost: 15000
        }
      ]
    };

    rerender(
      <CurrentSituationCard
        inputs={inputsWithChildEvent}
        handleSetBudgetClick={handleSetBudgetClickMock}
        onOpenLifeProfile={onOpenLifeProfileMock}
        handleCreateEvent={handleCreateEventMock}
        updateInput={updateInputMock}
      />
    );

    // Sidebar spending should STILL be baseline: $42,500
    expect(screen.getByText('$42,500')).toBeDefined();
    // Sidebar should NOT show a shortfall
    expect(screen.queryByText('Shortfall')).toBeNull();

    // 3. Add child event at age 40
    const inputsWithChildEventAge40 = {
      ...initialInputs,
      lifeEvents: [
        ...initialInputs.lifeEvents,
        {
          id: 'child-timeline-event-40',
          type: 'haveChild',
          name: 'Have a Child',
          enabled: true,
          age: 40,
          birthAge: 40,
          childStartAge: 0,
          annualChildcareCost: 15000
        }
      ]
    };

    rerender(
      <CurrentSituationCard
        inputs={inputsWithChildEventAge40}
        handleSetBudgetClick={handleSetBudgetClickMock}
        onOpenLifeProfile={onOpenLifeProfileMock}
        handleCreateEvent={handleCreateEventMock}
        updateInput={updateInputMock}
      />
    );

    // Sidebar spending should STILL be baseline: $42,500
    expect(screen.getByText('$42,500')).toBeDefined();
    expect(screen.queryByText('Shortfall')).toBeNull();

    // 4. Edit the actual current budget manually to include childcare ($1,250/mo)
    const inputsWithManualBudgetUpdate = {
      ...initialInputs,
      hasCustomizedBudget: true,
      budgetDetails: {
        ...initialInputs.budgetDetails,
        phases: [
          {
            id: 'phase-35',
            type: 'work',
            name: 'Working Phase',
            startAge: 35,
            endAge: 65,
            income: 4166.67,
            expenses: {
              housing: 1500,
              utilities: 300,
              food: 400,
              diningOut: 200,
              transportation: 400,
              healthcare: 300,
              leisure: 300,
              misc: 141,
              childcare: 1250 // added childcare manually!
            },
            savings: { brokerage: 0 }
          }
        ]
      }
    };

    rerender(
      <CurrentSituationCard
        inputs={inputsWithManualBudgetUpdate}
        handleSetBudgetClick={handleSetBudgetClickMock}
        onOpenLifeProfile={onOpenLifeProfileMock}
        handleCreateEvent={handleCreateEventMock}
        updateInput={updateInputMock}
      />
    );

    // Sidebar spending should update to: (1500+300+400+200+400+300+300+141+1250)*12 = 4791 * 12 = $57,492
    expect(screen.getByText('$57,492')).toBeDefined();
    // And since spending ($57,492) exceeds simpleIncome ($50,000), it should show a shortfall!
    // monthly shortfall = 4791 - (50000 / 12) = 4791 - 4166.67 = 624.33 => $624/mo shortfall
    expect(screen.getByText('Shortfall')).toBeDefined();
    expect(screen.getByText('-$624/mo')).toBeDefined();

    // 5. Delete the child event (using initialInputs which doesn't have it)
    rerender(
      <CurrentSituationCard
        inputs={initialInputs}
        handleSetBudgetClick={handleSetBudgetClickMock}
        onOpenLifeProfile={onOpenLifeProfileMock}
        handleCreateEvent={handleCreateEventMock}
        updateInput={updateInputMock}
      />
    );

    // Sidebar spending should be baseline: $42,500
    expect(screen.getByText('$42,500')).toBeDefined();
    expect(screen.queryByText('Shortfall')).toBeNull();
  });

  test('when income is decreased to $1,000, it still shows spending as baseline needs ($21,600)', () => {
    const handleSetBudgetClickMock = vi.fn();
    const onOpenLifeProfileMock = vi.fn();
    const handleCreateEventMock = vi.fn();
    const updateInputMock = vi.fn();

    // Start with baseline: currentAge: 35, income: $1,000, savings rate: 0%, no shortfall initially (except the one driven by high expenses)
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      simpleIncome: 1000,
      simpleExpenses: 42500, // simpleExpenses exceeds simpleIncome, so savings rate will be 0%
      savingsRate: 0,
      displayedSavingsRate: 0,
      hasCustomizedBudget: false,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        assets: { cash: 0, brokerage: 5000 },
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0 },
        home: { status: 'rent', monthlyRent: 1500 }, // rent = 1500, healthcare = 300 => 1800/mo = 21600/yr
        children: [],
        debts: []
      },
      lifeEvents: []
    };

    render(
      <CurrentSituationCard
        inputs={inputs}
        handleSetBudgetClick={handleSetBudgetClickMock}
        onOpenLifeProfile={onOpenLifeProfileMock}
        handleCreateEvent={handleCreateEventMock}
        updateInput={updateInputMock}
      />
    );

    // Sidebar spending should be baseline needs: $21,600 (not $1,000)
    expect(screen.getByText('$21,600')).toBeDefined();
    
    // Shortfall should be shown because spending ($21,600) exceeds income ($1,000)
    // monthly shortfall = 1800 - (1000 / 12) = 1800 - 83.33 = 1716.67 => -$1,717/mo
    expect(screen.getByText('Shortfall')).toBeDefined();
    expect(screen.getByText('-$1,717/mo')).toBeDefined();
  });
});
