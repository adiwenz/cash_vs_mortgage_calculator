// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenarioState } from './src/features/fire/state/useScenarioState.js';
import { useSimulationResults } from './src/features/fire/state/useSimulationResults.js';
import { useSimulationController } from './src/features/fire/state/useSimulationController.js';
import {
  getActiveScenario,
  getInputsForScenario,
  getBaselineScenario,
  getScenarioById
} from './src/features/fire/state/scenarioSelectors.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Scenario & Simulation State Refactoring Tests', () => {
  const sampleScenarios = [
    {
      id: 'baseline',
      name: 'Baseline Plan',
      inputs: {
        currentAge: 35,
        lifeExpectancy: 85,
        targetRetirementAge: 65,
        assets: { cash: 10000, brokerage: 20000 },
        lifeEvents: [],
        incomeList: [],
        spendingPhases: []
      }
    },
    {
      id: 'compare-test',
      name: 'Compare Scenario',
      inputs: {
        currentAge: 35,
        lifeExpectancy: 85,
        targetRetirementAge: 55,
        assets: { cash: 15000, brokerage: 30000 },
        lifeEvents: [],
        incomeList: [],
        spendingPhases: []
      }
    }
  ];

  describe('1. Selector Tests', () => {
    test('getScenarioById finds correct scenario', () => {
      const result = getScenarioById(sampleScenarios, 'compare-test');
      expect(result).toBeDefined();
      expect(result.name).toBe('Compare Scenario');
    });

    test('getBaselineScenario finds baseline or fallback', () => {
      const result = getBaselineScenario(sampleScenarios);
      expect(result.id).toBe('baseline');

      const fallbackResult = getBaselineScenario([{ id: 'custom', name: 'Custom' }]);
      expect(fallbackResult.id).toBe('custom');
    });

    test('getActiveScenario returns matching scenario or falls back to baseline', () => {
      const active = getActiveScenario(sampleScenarios, 'compare-test');
      expect(active.id).toBe('compare-test');

      const fallback = getActiveScenario(sampleScenarios, 'non-existent');
      expect(fallback.id).toBe('baseline');
    });

    test('getInputsForScenario returns correct inputs block', () => {
      const inputs = getInputsForScenario(sampleScenarios, 'compare-test');
      expect(inputs.targetRetirementAge).toBe(55);
    });
  });

  describe('2. Scenario Duplication', () => {
    test('duplicating a scenario produces a new copy and does not mutate original', () => {
      const { result } = renderHook(() => useScenarioState());

      let newId;
      act(() => {
        newId = result.current.handleDuplicateScenario(result.current.scenarios[0]);
      });

      expect(newId).toBeDefined();
      expect(result.current.scenarios.length).toBe(3);
      expect(result.current.scenarios[2].id).toBe(newId);
      expect(result.current.scenarios[2].name).toContain('(Copy)');
      
      // Verify independence
      act(() => {
        result.current.updateInput('targetRetirementAge', 62, newId);
      });
      expect(result.current.scenarios[2].inputs.targetRetirementAge).toBe(62);
      expect(result.current.scenarios[0].inputs.targetRetirementAge).not.toBe(62);
    });
  });

  describe('3. Scenario Deletion', () => {
    test('scenario is removed correctly and active id falls back if deleted', () => {
      const { result } = renderHook(() => useScenarioState());
      const initialCount = result.current.scenarios.length;

      let newId;
      act(() => {
        newId = result.current.handleDuplicateScenario(result.current.scenarios[0]);
      });
      expect(result.current.scenarios.length).toBe(initialCount + 1);

      // Setup active ID state
      let activeId = newId;
      const setActiveId = (id) => { activeId = id; };

      act(() => {
        result.current.handleDeleteScenario(newId, activeId, setActiveId);
      });

      expect(result.current.scenarios.length).toBe(initialCount);
      expect(result.current.scenarios.find(s => s.id === newId)).toBeUndefined();
      expect(activeId).toBe('baseline');
    });
  });

  describe('4. Event Age Change Cascades', () => {
    test('child birthAge change cascades to linked promotion in income list', () => {
      const { result } = renderHook(() => useScenarioState());
      const childEventId = 'child-1';
      const promoEventId = 'promo-1';

      // Manually set up a scenario with a child and a linked promotion
      act(() => {
        result.current.setScenarios([
          {
            id: 'baseline',
            name: 'Baseline Plan',
            inputs: {
              currentAge: 35,
              lifeExpectancy: 85,
              lifeEvents: [
                {
                  id: childEventId,
                  originalId: childEventId,
                  type: 'haveChild',
                  birthAge: 36,
                  age: 36,
                  childStartAge: 2,
                  linkedEventId: promoEventId
                }
              ],
              incomeList: [
                {
                  id: promoEventId,
                  parentEventId: childEventId,
                  type: 'careerChange',
                  startAge: 38
                }
              ]
            }
          }
        ]);
      });

      // Shift child age from 36 to 40
      act(() => {
        const childEvent = result.current.scenarios[0].inputs.lifeEvents[0];
        result.current.commitEventAgeChange(childEvent, 40, 'baseline');
      });

      const updatedInputs = result.current.scenarios[0].inputs;
      expect(updatedInputs.lifeEvents[0].birthAge).toBe(40);
      expect(updatedInputs.lifeEvents[0].age).toBe(40);
      
      // Linked promotion start age should shift: new birth age (40) + childStartAge (2) = 42
      expect(updatedInputs.incomeList[0].startAge).toBe(42);
    });

    test('borrowing start age change cascades to linked payoff plan details', () => {
      const { result } = renderHook(() => useScenarioState());
      const borrowId = 'borrow-1';
      const payoffId = 'payoff-1';

      act(() => {
        result.current.setScenarios([
          {
            id: 'baseline',
            inputs: {
              currentAge: 35,
              lifeExpectancy: 85,
              lifeEvents: [
                {
                  id: borrowId,
                  originalId: borrowId,
                  type: 'borrowing',
                  startAge: 36,
                  age: 36
                },
                {
                  id: payoffId,
                  borrowingId: borrowId,
                  type: 'payoffPlan',
                  startAge: 36,
                  payoffAge: 46,
                  targetPayoffAge: 46,
                  linked: true
                }
              ]
            }
          }
        ]);
      });

      // Shift borrowing start age from 36 to 40 (delta +4)
      act(() => {
        const borrowEvent = result.current.scenarios[0].inputs.lifeEvents[0];
        result.current.commitEventAgeChange(borrowEvent, 40, 'baseline');
      });

      const updatedEvents = result.current.scenarios[0].inputs.lifeEvents;
      const updatedBorrow = updatedEvents.find(e => e.id === borrowId);
      const updatedPayoff = updatedEvents.find(e => e.id === payoffId);

      expect(updatedBorrow.startAge).toBe(40);
      expect(updatedBorrow.age).toBe(40);
      
      // Linked payoff plan start age shifts to 40, payoffAge shifts by delta (46 + 4) = 50
      expect(updatedPayoff.startAge).toBe(40);
      expect(updatedPayoff.payoffAge).toBe(50);
      expect(updatedPayoff.targetPayoffAge).toBe(50);
    });
  });

  describe('5. Simulation Purity Tests', () => {
    function deepFreeze(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach(prop => {
        if (Object.prototype.hasOwnProperty.call(obj, prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
            !Object.isFrozen(obj[prop])) {
          deepFreeze(obj[prop]);
        }
      });
      return obj;
    }

    test('running simulation results does not mutate inputs or scenarios', () => {
      const inputsCopy = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      const scenariosCopy = [
        { id: 'baseline', name: 'Baseline Plan', inputs: inputsCopy }
      ];

      // Deep freeze the inputs and scenarios to ensure absolute purity
      deepFreeze(inputsCopy);
      deepFreeze(scenariosCopy);

      const { result } = renderHook(() => useSimulationResults(inputsCopy, scenariosCopy, null));

      // Assert calculations executed cleanly and returned outputs
      expect(result.current.baselineResults).toBeDefined();
      expect(result.current.activeResults).toBeDefined();
      expect(result.current.displayedResults).toBeDefined();
      expect(result.current.chartData).toBeDefined();
      expect(result.current.chartData.length).toBeGreaterThan(0);
      
      // Ensure displayMode toggles work cleanly
      act(() => {
        result.current.setDisplayMode('today');
      });
      expect(result.current.displayMode).toBe('today');
      expect(result.current.displayedResults.data[0].portfolio).toBeDefined();
    });
  });

  describe('6. Backwards Compatibility', () => {
    test('useFireSimulation hook exports the exact expected API shape', () => {
      const { result } = renderHook(() => useSimulationController());

      // Ensure all major properties are exported and fully functional
      expect(result.current.scenarios).toBeDefined();
      expect(result.current.setScenarios).toBeDefined();
      expect(result.current.currentScenarioId).toBeDefined();
      expect(result.current.setCurrentScenarioId).toBeDefined();
      expect(result.current.activeScenario).toBeDefined();
      expect(result.current.inputs).toBeDefined();
      expect(result.current.updateInput).toBeDefined();
      expect(result.current.updateAsset).toBeDefined();
      expect(result.current.displayMode).toBeDefined();
      expect(result.current.setDisplayMode).toBeDefined();
      expect(result.current.baselineResults).toBeDefined();
      expect(result.current.activeResults).toBeDefined();
      expect(result.current.displayedResults).toBeDefined();
      expect(result.current.chartData).toBeDefined();
      expect(result.current.validation).toBeDefined();
      expect(result.current.handleDuplicateScenario).toBeDefined();
      expect(result.current.handleDeleteScenario).toBeDefined();
      expect(result.current.commitEventAgeChange).toBeDefined();
    });
  });
});
