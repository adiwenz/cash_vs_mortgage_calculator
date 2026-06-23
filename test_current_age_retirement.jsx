// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { runFireSimulation, getNormalizedPhases, getEditableBudgetPhases } from './src/fireCalculations.js';
import { getBudgetForAge } from './src/components/fire-simulator/helpers.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import CurrentSituationCard from './src/components/fire-simulator/CurrentSituationCard';
import GoalHeroCard from './src/components/fire-simulator/GoalHeroCard';

describe('Current Age Retirement Budget Collision', () => {
  let baseInputs;

  beforeEach(() => {
    baseInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    baseInputs.currentAge = 35;
    baseInputs.targetRetirementAge = 35;
    baseInputs.simpleIncome = 50000;
    baseInputs.simpleExpenses = 42500;
    baseInputs.preTaxSavingsRate = 15;
    baseInputs.lifeEvents = [
      {
        id: 'retire-1',
        type: 'retire',
        name: 'Retirement',
        enabled: true,
        age: 35,
        spendingPercent: 70
      }
    ];
    baseInputs.budgetDetails = {
      hsaCoverage: 'single',
      expenses: {
        housing: 1500,
        utilities: 300,
        food: 400,
        diningOut: 200,
        transportation: 400,
        healthcare: 300,
        leisure: 300,
        misc: 141
      },
      savings: {
        brokerage: 625
      }
    };
  });

  test('getEditableBudgetPhases returns real normalized phases including retirement phases', () => {
    const editablePhases = getEditableBudgetPhases(baseInputs);
    // Since targetRetirementAge is currentAge = 35,
    // the first phase should start at 35 and be a retirement phase (type: 'retire').
    expect(editablePhases.length).toBeGreaterThan(0);
    const firstPhase = editablePhases[0];
    expect(firstPhase.startAge).toBe(35);
    expect(firstPhase.type).toBe('retire');
    // Verify it contains 'retire' phase type
    expect(editablePhases.some(p => p.type === 'retire')).toBe(true);
  });

  test('getBudgetForAge at currentAge resolves retirement budget details when retired today', () => {
    const ageBudget = getBudgetForAge(baseInputs, 35);
    expect(ageBudget).toBeDefined();
    
    // retired income = 0
    expect(ageBudget.income).toBe(0);
    expect(ageBudget.savingsRate).toBe(0);
    
    // expenses should be scaled
    // housing (1500), healthcare (300) are essential/needs, leisure (300) wants
    // verify the phase type is 'retire'
    expect(ageBudget.phase.type).toBe('retire');
  });

  test('homepage inputs remain anchored to reality', () => {
    // Verifying that simpleIncome and simpleExpenses are preserved
    expect(baseInputs.simpleIncome).toBe(50000);
    expect(baseInputs.simpleExpenses).toBe(42500);
    expect(baseInputs.preTaxSavingsRate).toBe(15);
  });

  test('yearly snapshot age 35 should use retirement lifestyle spending scaled by spendingPercent (70%)', () => {
    // Enable healthcare model false to isolate lifestyle spending
    baseInputs.enableHealthcareModel = false;
    baseInputs.includeTaxes = false;
    
    const results = runFireSimulation(baseInputs);
    const nominalAt35 = results.nominalData.find(d => d.age === 35);
    expect(nominalAt35).toBeDefined();

    // Lifestyle spending today = 42500 / yr.
    // At retirement, it should scale to 42500 * 70% = 29750/yr.
    expect(nominalAt35.expenses).toBeCloseTo(29750, -1);
  });

  test('CurrentSituationCard renders dynamic retired values and edit link when currentAge === targetRetirementAge', () => {
    const handleSetBudgetClick = () => {};
    const onOpenLifeProfile = () => {};
    const handleCreateEvent = () => {};
    const updateInput = () => {};
    const handleEditRoadmapEventSpy = vi.fn();

    const { rerender } = render(
      <CurrentSituationCard
        inputs={baseInputs}
        handleSetBudgetClick={handleSetBudgetClick}
        onOpenLifeProfile={onOpenLifeProfile}
        handleCreateEvent={handleCreateEvent}
        updateInput={updateInput}
        handleEditRoadmapEvent={handleEditRoadmapEventSpy}
      />
    );

    // 1. Assert Retired values
    // Income shows $0
    expect(screen.getByText('$0')).toBeDefined();
    // Retired badge label exists next to Annual Income
    expect(screen.getByText('Retired')).toBeDefined();
    // Savings Rate shows 0%
    expect(screen.getByText('0%')).toBeDefined();
    // Spending (budget) displays scaled retirement baseline: $29,750
    expect(screen.getByText('$29,750')).toBeDefined();
    // Renders the link
    expect(screen.getByText('(70% retirement baseline ·')).toBeDefined();
    const editBtn = screen.getByText('Edit');
    expect(editBtn).toBeDefined();

    // 2. Click edit and assert spy call payload
    editBtn.click();
    expect(handleEditRoadmapEventSpy).toHaveBeenCalledTimes(1);
    expect(handleEditRoadmapEventSpy).toHaveBeenCalledWith(baseInputs.lifeEvents[0]);

    // 3. Toggling behavior: targetRetirementAge = 65 should revert to working values
    const workingInputs = {
      ...baseInputs,
      targetRetirementAge: 65
    };

    rerender(
      <CurrentSituationCard
        inputs={workingInputs}
        handleSetBudgetClick={handleSetBudgetClick}
        onOpenLifeProfile={onOpenLifeProfile}
        handleCreateEvent={handleCreateEvent}
        updateInput={updateInput}
        handleEditRoadmapEvent={handleEditRoadmapEventSpy}
      />
    );

    // Income shows input box value (e.g. via input selector or check elements)
    expect(screen.queryByText('Retired')).toBeNull();
    expect(screen.queryByText('$29,750')).toBeNull();
    // Spending should revert to baseline: $42,500
    expect(screen.getByText('$42,500')).toBeDefined();
  });

  test('CurrentSituationCard handleEditRoadmapEvent safe fallback handling when retire event is missing', () => {
    const handleSetBudgetClick = () => {};
    const onOpenLifeProfile = () => {};
    const handleCreateEvent = () => {};
    const updateInput = () => {};
    const handleEditRoadmapEventSpy = vi.fn();

    // Remove retire event from inputs
    const inputsNoRetire = {
      ...baseInputs,
      lifeEvents: []
    };

    render(
      <CurrentSituationCard
        inputs={inputsNoRetire}
        handleSetBudgetClick={handleSetBudgetClick}
        onOpenLifeProfile={onOpenLifeProfile}
        handleCreateEvent={handleCreateEvent}
        updateInput={updateInput}
        handleEditRoadmapEvent={handleEditRoadmapEventSpy}
      />
    );

    // Edit link should still render
    const editBtn = screen.getByText('Edit');
    expect(editBtn).toBeDefined();

    // Click edit and verify it calls with fallback object
    editBtn.click();
    expect(handleEditRoadmapEventSpy).toHaveBeenCalledTimes(1);
    const passedEvent = handleEditRoadmapEventSpy.mock.calls[0][0];
    expect(passedEvent.type).toBe('retire');
    expect(passedEvent.id).toBeDefined();
  });

  test('GoalHeroCard renders "🏖️ Stop Working Today" when currentAge === targetRetirementAge', () => {
    const onTargetAgeChange = () => {};
    const onViewRecommendations = () => {};

    render(
      <GoalHeroCard
        currentAge={35}
        targetRetirementAge={35}
        projectedRetirementAge={35}
        status="comfortable"
        onTargetAgeChange={onTargetAgeChange}
        onViewRecommendations={onViewRecommendations}
      />
    );

    expect(screen.getByText('🏖️ Stop Working Today')).toBeDefined();
  });
});
