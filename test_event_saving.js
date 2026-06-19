// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { eventSaveRouter } from './src/features/fire/events/eventSaveRouter.js';
import { houseEventHandler } from './src/features/fire/events/handlers/houseEventHandler.js';
import { childEventHandler } from './src/features/fire/events/handlers/childEventHandler.js';
import { debtEventHandler } from './src/features/fire/events/handlers/debtEventHandler.js';
import { genericEventHandler } from './src/features/fire/events/handlers/genericEventHandler.js';
import { useEventActions } from './src/hooks/useEventActions.js';
import { renderHook } from '@testing-library/react';

describe('Event Actions Refactoring - Saving & Deleting Events', () => {
  const baseInputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    targetRetirementAge: 65,
    lifeEvents: [],
    houseAssets: [],
    incomeList: [
      { id: 'main-sal', name: 'Salary', amount: 80000, startAge: 35, endAge: 65 }
    ],
    spendingPhases: [
      { id: 'base-spend', name: 'Lifestyle', startAge: 35, endAge: 85, annualSpending: 40000 }
    ],
    householdMembers: []
  };

  describe('1. Handler Purity', () => {
    test('calling a handler does not mutate the original inputs object', () => {
      const inputs = JSON.parse(JSON.stringify(baseInputs));
      const editingEvent = {
        type: 'custom',
        id: 'cust-1',
        age: 40,
        amount: 5000,
        name: 'Custom Trip'
      };

      const result = genericEventHandler.save(editingEvent, inputs);
      
      // Verify inputs was not mutated
      expect(inputs.lifeEvents.length).toBe(0);
      
      // Verify result returns a new object
      expect(result.updatedInputs).not.toBe(inputs);
      expect(result.updatedInputs.lifeEvents.length).toBe(1);
      expect(result.updatedInputs.lifeEvents[0].id).toBe('cust-1');
    });
  });

  describe('2. Transient Metadata Stripping', () => {
    test('transient recommendation/applied metadata is stripped on save', () => {
      const inputs = JSON.parse(JSON.stringify(baseInputs));
      const editingEvent = {
        type: 'custom',
        id: 'cust-2',
        age: 45,
        amount: 2000,
        name: 'Recommendation Test',
        recommendationApplied: true,
        appliedRecommendationType: 'optimization',
        appliedRecommendationAt: 35,
        retirementTimingChanged: true,
        modalOnlyField: 'transientValue'
      };

      const result = genericEventHandler.save(editingEvent, inputs);
      const saved = result.savedEvent;

      expect(saved.recommendationApplied).toBeUndefined();
      expect(saved.appliedRecommendationType).toBeUndefined();
      expect(saved.appliedRecommendationAt).toBeUndefined();
      expect(saved.retirementTimingChanged).toBeUndefined();
    });
  });

  describe('3. Linked Event Cleanup', () => {
    test('deleting a child removes the linked promotion in income list', () => {
      let inputs = JSON.parse(JSON.stringify(baseInputs));
      
      // Save child
      const saveResult = childEventHandler.save({
        type: 'haveChild',
        birthAge: 35,
        childStartAge: 0,
        childName: 'Emma',
        costMethod: 'default',
        includeCollege: false
      }, inputs);

      inputs = saveResult.updatedInputs;
      expect(inputs.lifeEvents.length).toBe(1);
      expect(inputs.incomeList.length).toBe(2); // main salary + promotion
      
      const childEvent = inputs.lifeEvents[0];

      // Delete child
      const deleteResult = childEventHandler.delete(childEvent, inputs);
      const cleanedInputs = deleteResult.updatedInputs;

      expect(cleanedInputs.lifeEvents.length).toBe(0);
      expect(cleanedInputs.incomeList.length).toBe(1); // promotion removed
    });

    test('deleting buyHouse removes matching sellHouse and house asset', () => {
      let inputs = JSON.parse(JSON.stringify(baseInputs));
      
      const saveResult = houseEventHandler.save({
        type: 'buyHouse',
        homePrice: 500000,
        downPayment: 100000,
        purchaseAge: 38,
        purchaseType: 'mortgage'
      }, inputs);

      inputs = saveResult.updatedInputs;
      // Should have: buyHouse and sellHouse events
      expect(inputs.lifeEvents.length).toBe(2);
      expect(inputs.houseAssets.length).toBe(1);

      const buyEvent = inputs.lifeEvents.find(e => e.type === 'buyHouse');

      // Delete buyHouse
      const deleteResult = houseEventHandler.delete(buyEvent, inputs);
      const cleanedInputs = deleteResult.updatedInputs;

      expect(cleanedInputs.lifeEvents.length).toBe(0);
      expect(cleanedInputs.houseAssets.length).toBe(0);
    });

    test('deleting debt payoff plan disables/removes payoff plan and preserves original borrowing event', () => {
      let inputs = JSON.parse(JSON.stringify(baseInputs));
      
      const saveResult = debtEventHandler.save({
        type: 'borrowing',
        balance: 20000,
        interestRate: 6,
        minPayment: 300,
        payoffPlanEnabled: true,
        extraPayment: 100,
        timing: 'current'
      }, inputs);

      inputs = saveResult.updatedInputs;
      expect(inputs.lifeEvents.length).toBe(2); // borrowing + payoffPlan

      const payoffPlan = inputs.lifeEvents.find(e => e.type === 'payoffPlan');

      // Delete payoff plan
      const deleteResult = debtEventHandler.delete(payoffPlan, inputs);
      const cleanedInputs = deleteResult.updatedInputs;

      expect(cleanedInputs.lifeEvents.length).toBe(1); // borrowing remains
      const remainingBorrowing = cleanedInputs.lifeEvents[0];
      expect(remainingBorrowing.type).toBe('borrowing');
      expect(remainingBorrowing.payoffPlanEnabled).toBe(false);
    });
  });

  describe('4. Fallback & Custom Events', () => {
    test('custom and fallback events route through genericEventHandler', () => {
      const inputs = JSON.parse(JSON.stringify(baseInputs));
      
      const saveResult = eventSaveRouter.routeSave({
        type: 'custom',
        age: 42,
        amount: 8000,
        name: 'Big Event'
      }, inputs);

      expect(saveResult.savedEvent.type).toBe('custom');
      expect(saveResult.updatedInputs.lifeEvents.length).toBe(1);
    });
  });

  describe('5. Router Coverage', () => {
    test('every supported event type routes to the expected handler', () => {
      const inputs = JSON.parse(JSON.stringify(baseInputs));

      // 1. house
      const buyHouseResult = eventSaveRouter.routeSave({ type: 'buyHouse', homePrice: 300000, purchaseAge: 35 }, inputs);
      expect(buyHouseResult.savedEvent.type).toBe('buyHouse');

      // 2. child
      const childResult = eventSaveRouter.routeSave({ type: 'haveChild', birthAge: 30 }, inputs);
      expect(childResult.savedEvent.type).toBe('haveChild');

      // 3. marriage
      const marriageResult = eventSaveRouter.routeSave({ type: 'marriage', age: 32 }, inputs);
      expect(marriageResult.savedEvent.type).toBe('marriage');

      // 4. debt
      const debtResult = eventSaveRouter.routeSave({ type: 'borrowing', balance: 5000 }, inputs);
      expect(debtResult.savedEvent.type).toBe('borrowing');

      // 5. income
      const incomeResult = eventSaveRouter.routeSave({ type: 'careerChange', amount: 90000, startAge: 40 }, inputs);
      expect(incomeResult.savedEvent.type).toBe('careerChange');

      // 6. retirement
      const retirementResult = eventSaveRouter.routeSave({ type: 'retire', age: 60 }, inputs);
      expect(retirementResult.savedEvent.type).toBe('retire');

      // 7. generic / move
      const moveResult = eventSaveRouter.routeSave({ type: 'move', moveAge: 40, newSpending: 50000, location: 'Austin' }, inputs);
      expect(moveResult.savedEvent.name).toBe('Moved to Austin');
    });
  });

  describe('6. Backwards Compatibility', () => {
    test('existing imports and calls of useEventActions work identically via wrapper', () => {
      const scenarios = [{ id: 'scen-1', inputs: baseInputs }];
      const setScenarios = vi.fn();
      const updateInput = vi.fn();
      const setShowImprovementModal = vi.fn();

      const { result } = renderHook(() => useEventActions(
        scenarios,
        setScenarios,
        'scen-1',
        baseInputs,
        updateInput,
        vi.fn(),
        vi.fn(),
        false,
        setShowImprovementModal
      ));

      expect(result.current.handleCreateEvent).toBeDefined();
      expect(result.current.handleSaveEvent).toBeDefined();
      expect(result.current.handleDeleteEvent).toBeDefined();
    });
  });
});
