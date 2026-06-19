// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { applyRecommendation } from './src/features/fire/recommendations/applyRecommendation.js';
import { hasResolvedRecommendationTradeoffs } from './src/features/fire/recommendations/recommendationUtils.js';
import { useRecommendationController } from './src/features/fire/recommendations/useRecommendationController.js';
import { eventSaveRouter } from './src/features/fire/events/eventSaveRouter.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Recommendations and Controller Refactoring Tests', () => {

  test('1. Purity of applyRecommendation', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.simpleIncome = 100000;
    inputs.simpleExpenses = 60000;
    
    const originalInputsJson = JSON.stringify(inputs);
    
    // Test the budget scenario savings recommendation
    const result = applyRecommendation(inputs, { type: 'savings' }, null);
    
    // Check that original inputs was NOT mutated
    expect(JSON.stringify(inputs)).toBe(originalInputsJson);
    
    // Check standard return shape
    expect(result.updatedInputs).toBeDefined();
    expect(result.sideEffects).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(result.updatedInputs).not.toBe(inputs); // Check new object reference
  });

  test('2. Coverage of Handlers', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // A. Child Handler test
    const childResult = applyRecommendation(inputs, { type: 'childPromotion' }, null);
    expect(childResult.updatedInputs).toBeDefined();
    
    // B. Housing Handler test
    const inputsWithHouse = {
      ...inputs,
      lifeEvents: [
        { id: 'house1', type: 'buyHouse', enabled: true, homePrice: 500000 }
      ]
    };
    const housingResult = applyRecommendation(inputsWithHouse, { type: 'reduceHomePrice', value: 250000 }, { id: 'house1', type: 'buyHouse', homePrice: 500000 });
    expect(housingResult.updatedInputs).toBeDefined();
    expect(housingResult.updatedEditingEvent.homePrice).toBe(250000);
    
    // C. Budget Handler test
    const budgetResult = applyRecommendation(inputs, { type: 'spending' }, null);
    expect(budgetResult.updatedInputs).toBeDefined();
    
    // D. Debt Handler test
    const debtResult = applyRecommendation(inputs, { type: 'startDebtPayoff' }, null);
    expect(debtResult.updatedInputs).toBeDefined();
    
    // E. Retirement Handler test
    const retirementResult = applyRecommendation(inputs, { type: 'retire65' }, null);
    expect(retirementResult.updatedInputs).toBeDefined();
  });

  test('3. Metadata tracking & Event Save Router stripping', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const inputsWithHouse = {
      ...inputs,
      lifeEvents: [
        { id: 'house1', type: 'buyHouse', enabled: true, homePrice: 500000 }
      ]
    };
    
    // Apply a recommendation to editingEvent
    const housingResult = applyRecommendation(inputsWithHouse, { type: 'reduceHomePrice', value: 200000 }, { id: 'house1', type: 'buyHouse', homePrice: 500000 });
    
    const updatedEvent = housingResult.updatedEditingEvent;
    expect(updatedEvent.recommendationApplied).toBe(true);
    expect(updatedEvent.appliedRecommendationType).toBe('reduceHomePrice');
    
    // Verify that eventSaveRouter routes to the correct handler and strips transient metadata
    const scenarios = [
      {
        id: 'baseline',
        inputs: inputsWithHouse
      }
    ];
    
    const saveResult = eventSaveRouter.routeSave(updatedEvent, inputsWithHouse, scenarios, 'baseline');
    expect(saveResult).toBeDefined();
    
    // The saved event inside savedEvent should not contain recommendationApplied
    expect(saveResult.savedEvent.recommendationApplied).toBeUndefined();
    expect(saveResult.savedEvent.appliedRecommendationType).toBeUndefined();
  });

  test('4. Home purchase regression validation (allowing save once recommendationApplied is true)', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.assets = { cash: 10000, brokerage: 0 }; // Low cash
    
    const buyHouseEvent = {
      id: 'house1',
      type: 'buyHouse',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000 // Shortfall: needs 100k down payment, but cash is only 10k
    };
    
    // Run simulation to get baseline
    const mockResults = {
      retirementReadyAge: 65,
      nominalData: [
        { age: 39, netWorth: 10000 },
        { age: 40, netWorth: 20000 }
      ]
    };
    
    // 1. Without recommendation, hasResolvedRecommendationTradeoffs should return false (needs options review)
    const initiallyResolved = hasResolvedRecommendationTradeoffs(buyHouseEvent, inputs, mockResults);
    expect(initiallyResolved).toBe(false);
    
    // 2. Apply recommendation: update price or adjust down payment
    const appliedEvent = {
      ...buyHouseEvent,
      recommendationApplied: true
    };
    
    // With recommendationApplied: true, it should return true (resolved!)
    const finallyResolved = hasResolvedRecommendationTradeoffs(appliedEvent, inputs, mockResults);
    expect(finallyResolved).toBe(true);
  });

  test('5. useRecommendationController hook orchestrates React state', () => {
    const scenarios = [{ id: 'baseline', inputs: DEFAULT_FIRE_INPUTS }];
    const setScenarios = vi.fn();
    const setEditingEvent = vi.fn();
    const setNotification = vi.fn();
    const setIsBudgetModalOpen = vi.fn();
    
    const { result } = renderHook(() => useRecommendationController({
      setScenarios,
      currentScenarioId: 'baseline',
      inputs: DEFAULT_FIRE_INPUTS,
      editingEvent: null,
      setEditingEvent,
      setNotification,
      setIsBudgetModalOpen
    }));
    
    act(() => {
      result.current.applyRecommendationAction({ type: 'savings' });
    });
    
    // Verifies that setScenarios was triggered
    expect(setScenarios).toHaveBeenCalled();
  });
});
