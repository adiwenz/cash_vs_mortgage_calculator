// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';
import { useScenarioState } from './src/features/fire/state/useScenarioState.js';
import { retirementEventHandler } from './src/features/fire/events/handlers/retirementEventHandler.js';
import { useBudgetState } from './src/hooks/useBudgetState.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Retirement Age Synchronization Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  test('useScenarioState commitEventAgeChange correctly syncs targetRetirementAge, retire event, and career income endAge when oldAge is undefined', () => {
    const { result } = renderHook(() => useScenarioState());

    // 1. Initial State checks for baseline
    let baseline = result.current.scenarios.find(s => s.id === 'baseline');
    expect(baseline.inputs.targetRetirementAge).toBe(65);
    expect(baseline.inputs.lifeEvents.find(e => e.type === 'retire').age).toBe(65);
    expect(baseline.inputs.incomeList.find(i => i.id === 'inc-1').endAge).toBe(65);

    // 2. Commit a retirement age change to Age 70 (representing GoalHeroCard input update where evt has no age)
    act(() => {
      result.current.commitEventAgeChange({ type: 'retire' }, 70, 'baseline');
    });

    baseline = result.current.scenarios.find(s => s.id === 'baseline');
    expect(baseline.inputs.targetRetirementAge).toBe(70);
    expect(baseline.inputs.lifeEvents.find(e => e.type === 'retire').age).toBe(70);
    expect(baseline.inputs.incomeList.find(i => i.id === 'inc-1').endAge).toBe(70);
  });

  test('retirementEventHandler save and delete synchronize incomeList endAge', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.targetRetirementAge = 65;
    inputs.incomeList = [{ id: 'inc-1', name: 'Salary', amount: 50000, startAge: 35, endAge: 65 }];

    // 1. Save retirement event at Age 60
    const editingEvent = { id: 'retire-1', type: 'retire', age: 60, spendingPercent: 70 };
    const saveResult = retirementEventHandler.save(editingEvent, inputs);
    const updatedInputs = saveResult.updatedInputs;

    expect(updatedInputs.targetRetirementAge).toBe(60);
    expect(updatedInputs.incomeList.find(i => i.id === 'inc-1').endAge).toBe(60);

    // 2. Delete retirement event
    const deleteResult = retirementEventHandler.delete(editingEvent, updatedInputs);
    const deletedInputs = deleteResult.updatedInputs;

    expect(deletedInputs.targetRetirementAge).toBe(deletedInputs.lifeExpectancy || 85);
    expect(deletedInputs.incomeList.find(i => i.id === 'inc-1').endAge).toBe(deletedInputs.lifeExpectancy || 85);
  });

  test('useBudgetState pendingImprovement application synchronizes incomeList endAge', () => {
    // Setup inputs and scenario state
    const initialInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    initialInputs.targetRetirementAge = 65;
    initialInputs.incomeList = [{ id: 'inc-1', name: 'Salary', amount: 50000, startAge: 35, endAge: 65 }];

    const scenarios = [
      { id: 'baseline', name: 'Baseline', inputs: initialInputs }
    ];
    let updatedScenarios = scenarios;
    const setScenarios = (updater) => {
      if (typeof updater === 'function') {
        updatedScenarios = updater(updatedScenarios);
      } else {
        updatedScenarios = updater;
      }
    };

    const activeResults = { retirementReadyAge: 65, targetRetirementAge: 65 };
    const updateInput = () => {};
    const setEditingEvent = () => {};

    const { result } = renderHook(() => useBudgetState(
      updatedScenarios,
      setScenarios,
      'baseline',
      initialInputs,
      updateInput,
      activeResults,
      null,
      setEditingEvent
    ));

    // 1. Set a pending improvement that extends retirement by 3 years
    act(() => {
      result.current.setPendingImprovement({
        scenario: { type: 'workLonger', value: 3 }
      });
      result.current.setActiveBudgetPhase('standard');
      result.current.setEditedPhases({
        standard: { income: 5000, expenses: {}, savings: {}, partnerSavings: {} }
      });
    });

    // 2. Trigger save budget which applies the pending improvement
    act(() => {
      result.current.handleSaveBudget();
    });

    const baselineScen = updatedScenarios.find(s => s.id === 'baseline');
    expect(baselineScen.inputs.targetRetirementAge).toBe(68);
    expect(baselineScen.inputs.incomeList.find(i => i.id === 'inc-1').endAge).toBe(68);
  });

  test('LifePlanScreen renders GoalHeroCard and calls commitEventAgeChange from timeline prop on target age change', async () => {
    const { vi } = await import('vitest');
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const React = await import('react');
    const LifePlanScreen = (await import('./src/components/fire-simulator/LifePlanScreen.jsx')).default;

    const mockSimulation = {
      activeResults: { retirementReadyAge: 65, targetRetirementAge: 65, isRetirementSuccessful: true, retirementOutcome: 'comfortable' },
      displayedResults: { retirementReadyAge: 65, targetRetirementAge: 65, isRetirementSuccessful: true, retirementOutcome: 'comfortable' },
      chartData: [],
      validation: { errors: [] }
    };
    const mockScenario = {
      inputs: { currentAge: 35, targetRetirementAge: 65, lifeEvents: [{ type: 'retire', age: 65, enabled: true }] },
      updateInput: () => {}
    };
    const commitEventAgeChangeSpy = vi.fn();
    const mockTimeline = {
      timelineEvents: [],
      commitEventAgeChange: commitEventAgeChangeSpy
    };

    render(
      <LifePlanScreen
        simulation={mockSimulation}
        scenario={mockScenario}
        timeline={mockTimeline}
        eventController={{}}
        budgetController={{}}
        recommendationController={{}}
        uiState={{}}
      />
    );

    // Find the textbox input
    const input = screen.getByDisplayValue('65');
    expect(input).toBeDefined();

    // Simulate user typing a new retirement age '70' and pressing Enter to commit
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Verify commitEventAgeChange was called with the new retirement age
    expect(commitEventAgeChangeSpy).toHaveBeenCalledWith({ type: 'retire' }, 70);
  });
});
