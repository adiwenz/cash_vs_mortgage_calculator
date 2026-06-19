// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulationController } from './src/features/fire/state/useSimulationController.js';
import { useEventEditingController } from './src/features/fire/events/useEventEditingController.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('useSimulationController tests', () => {
  test('loads correctly and exposes expected state', () => {
    const { result } = renderHook(() => useSimulationController());

    expect(result.current.scenarios).toBeDefined();
    expect(result.current.currentScenarioId).toBeDefined();
    expect(result.current.inputs).toBeDefined();
    expect(result.current.activeResults).toBeDefined();
    expect(result.current.chartData).toBeDefined();
    expect(result.current.updateInput).toBeTypeOf('function');
    expect(result.current.updateAsset).toBeTypeOf('function');
  });

  test('updates inputs and scenarios', () => {
    const { result } = renderHook(() => useSimulationController());

    act(() => {
      result.current.updateInput('simpleIncome', 120000);
    });

    expect(result.current.inputs.simpleIncome).toBe(120000);
    const activeScenario = result.current.scenarios.find(s => s.id === result.current.currentScenarioId);
    expect(activeScenario.inputs.simpleIncome).toBe(120000);
  });
});

describe('useEventEditingController tests', () => {
  test('loads correctly and executes event & condition CRUD functions', () => {
    const mockSetScenarios = vi.fn();
    const mockUpdateInput = vi.fn();
    const mockCommitEventAgeChange = vi.fn();
    const mockSetShowImprovementModal = vi.fn();

    const initialInputs = {
      ...DEFAULT_FIRE_INPUTS,
      lifeEvents: [],
      currentConditions: []
    };

    const { result } = renderHook(() => useEventEditingController({
      scenarios: [{ id: 'scen-1', inputs: initialInputs }],
      setScenarios: mockSetScenarios,
      currentScenarioId: 'scen-1',
      inputs: initialInputs,
      updateInput: mockUpdateInput,
      activeResults: {},
      timelineEvents: [],
      handleSetBudgetClick: vi.fn(),
      setIsBudgetOpenFromMarriageWizard: vi.fn(),
      isMobile: false,
      setShowImprovementModal: mockSetShowImprovementModal,
      commitEventAgeChange: mockCommitEventAgeChange
    }));

    // Verify initial values
    expect(result.current.editingEvent).toBeNull();
    expect(result.current.editingCondition).toBeNull();

    // 1. Event CRUD - Create Event
    act(() => {
      result.current.handleCreateEvent('haveChild');
    });
    expect(result.current.editingEvent).not.toBeNull();
    expect(result.current.editingEvent.type).toBe('haveChild');

    // 2. Event CRUD - Save Event
    act(() => {
      result.current.handleSaveEvent({
        ...result.current.editingEvent,
        age: 38,
        cost: 15000
      });
    });
    expect(mockSetScenarios).toHaveBeenCalled();

    // 3. Condition CRUD - Create & Save
    act(() => {
      result.current.setEditingCondition({
        type: 'jobChange',
        age: 40,
        value: 5000
      });
    });
    act(() => {
      result.current.handleSaveCurrentCondition();
    });
    expect(mockUpdateInput).toHaveBeenCalledWith('currentConditions', expect.any(Array));

    // 4. Condition CRUD - Remove
    act(() => {
      result.current.handleRemoveCurrentCondition('cond-123');
    });
    expect(mockUpdateInput).toHaveBeenCalledWith('currentConditions', expect.any(Array));
  });

  test('deleting a child event clears selectedEventId, selectedEvent, and editingEvent', () => {
    const mockSetScenarios = vi.fn();
    const mockUpdateInput = vi.fn();
    const mockCommitEventAgeChange = vi.fn();

    const initialInputs = {
      ...DEFAULT_FIRE_INPUTS,
      lifeEvents: [
        { id: 'child-1', type: 'haveChild', childName: 'Liam', birthAge: 35 }
      ]
    };

    const { result } = renderHook(() => useEventEditingController({
      scenarios: [{ id: 'scen-1', inputs: initialInputs }],
      setScenarios: mockSetScenarios,
      currentScenarioId: 'scen-1',
      inputs: initialInputs,
      updateInput: mockUpdateInput,
      activeResults: {},
      timelineEvents: [],
      handleSetBudgetClick: vi.fn(),
      setIsBudgetOpenFromMarriageWizard: vi.fn(),
      isMobile: false,
      setShowImprovementModal: vi.fn(),
      commitEventAgeChange: mockCommitEventAgeChange
    }));

    act(() => {
      result.current.setSelectedEventId('child-1');
      result.current.setSelectedEvent(initialInputs.lifeEvents[0]);
      result.current.setEditingEvent(initialInputs.lifeEvents[0]);
    });

    expect(result.current.selectedEventId).toBe('child-1');
    expect(result.current.selectedEvent).toEqual(initialInputs.lifeEvents[0]);
    expect(result.current.editingEvent).toEqual(initialInputs.lifeEvents[0]);

    act(() => {
      result.current.handleDeleteEvent(initialInputs.lifeEvents[0]);
    });

    expect(mockSetScenarios).toHaveBeenCalled();
    expect(result.current.selectedEventId).toBeNull();
    expect(result.current.selectedEvent).toBeNull();
    expect(result.current.editingEvent).toBeNull();
  });
});
