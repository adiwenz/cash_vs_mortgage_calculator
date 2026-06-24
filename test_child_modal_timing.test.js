// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { childEventHandler } from './src/features/fire/events/handlers/childEventHandler.js';
import { getChildEventBirthAge } from './src/utils/childEventHelpers.js';
import { getTimelineItems } from './src/models/lifeTimeline/timelineSelectors.js';
import { useTimelineEvents } from './src/hooks/useTimelineEvents.js';

describe('Child Modal Save Canonical Event Timing & Precedence', () => {
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
    householdMembers: [],
    children: []
  };

  test('1. Modal save updates canonical event age in all supported timing fields', () => {
    // 1. Start with child event at age 35
    const originalEvent = {
      id: 'child-1',
      type: 'haveChild',
      birthAge: 35,
      childStartAge: 0,
      childName: 'Emma',
      costMethod: 'default',
      includeCollege: false
    };

    // 2. Save modal with child arrival age 40
    const saveResult = childEventHandler.save({
      ...originalEvent,
      birthAge: 40 // simulated input value from modal
    }, baseInputs);

    const savedEvent = saveResult.savedEvent;

    // 3. Assert the saved event has canonical age 40 in every timing field the app supports
    expect(savedEvent.birthAge).toBe(40);
    expect(savedEvent.arrivalAge).toBe(40);
    expect(savedEvent.parentAge).toBe(40);
    expect(savedEvent.age).toBe(40);
    expect(savedEvent.startAge).toBe(40);
    expect(savedEvent.timing?.age).toBe(40);
    expect(savedEvent.data?.birthAge).toBe(40);
    expect(savedEvent.data?.parentAge).toBe(40);
    expect(savedEvent.details?.birthAge).toBe(40);

    // 4. Assert getChildEventBirthAge(savedEvent) === 40
    expect(getChildEventBirthAge(savedEvent)).toBe(40);
  });

  test('2. Homepage and Life Planner derive same age (40) from saved event', () => {
    const originalEvent = {
      id: 'child-1',
      type: 'haveChild',
      birthAge: 35,
      childStartAge: 0,
      childName: 'Emma',
      costMethod: 'default',
      includeCollege: false
    };

    const saveResult = childEventHandler.save({
      ...originalEvent,
      birthAge: 40
    }, baseInputs);

    const updatedInputs = saveResult.updatedInputs;
    const mockDisplayedResults = {
      incomeList: updatedInputs.incomeList,
      spendingPhases: updatedInputs.spendingPhases
    };

    // Run Homepage timeline hook
    const { result } = renderHook(() => useTimelineEvents(updatedInputs, mockDisplayedResults));
    const homepageEvents = result.current;

    // Run Life Planner selector
    const lifePlannerItems = getTimelineItems(updatedInputs);

    // Find the child arrival event on both timelines
    const homeChildEvent = homepageEvents.find(e => e.type === 'haveChild');
    const lpChildItem = lifePlannerItems.find(item => item.id.startsWith('event-child-point-'));

    expect(homeChildEvent).toBeDefined();
    expect(lpChildItem).toBeDefined();

    // Both should render the child event at age 40
    expect(homeChildEvent.age).toBe(40);
    expect(lpChildItem.age).toBe(40);
  });

  test('3. Modal reopen uses saved canonical age 40, not stale fallback', () => {
    // Save child age 40
    const originalEvent = {
      id: 'child-1',
      type: 'haveChild',
      birthAge: 35,
      childStartAge: 0,
      childName: 'Emma',
      costMethod: 'default',
      includeCollege: false
    };

    const saveResult = childEventHandler.save({
      ...originalEvent,
      birthAge: 40
    }, baseInputs);

    const savedEvent = saveResult.savedEvent;

    // Reinitialize modal draft state logic (which reads getChildEventBirthAge)
    const draftBirthAge = getChildEventBirthAge(savedEvent);
    expect(draftBirthAge).toBe(40);
  });

  test('4. No stale age fallback to currentAge (35) or baseline 0 when haveChild event exists', () => {
    const originalEvent = {
      id: 'child-1',
      type: 'haveChild',
      birthAge: 35,
      childStartAge: 0,
      childName: 'Emma',
      costMethod: 'default',
      includeCollege: false
    };

    const saveResult = childEventHandler.save({
      ...originalEvent,
      birthAge: 40
    }, baseInputs);

    const updatedInputs = saveResult.updatedInputs;
    const mockDisplayedResults = {
      incomeList: updatedInputs.incomeList,
      spendingPhases: updatedInputs.spendingPhases
    };

    // Verify neither homepage timeline events nor Life Planner selector fall back to currentAge (35)
    const { result } = renderHook(() => useTimelineEvents(updatedInputs, mockDisplayedResults));
    const homepageEvents = result.current;
    const lifePlannerItems = getTimelineItems(updatedInputs);

    const homeChild = homepageEvents.find(e => e.type === 'haveChild');
    const lpChild = lifePlannerItems.find(item => item.id.startsWith('event-child-point-'));

    expect(homeChild.age).toBe(40);
    expect(lpChild.age).toBe(40);
    expect(homeChild.age).not.toBe(35);
    expect(lpChild.age).not.toBe(35);
  });

  test('5. Stale mixed-field precedence logic', () => {
    const mixedEvent = {
      type: 'haveChild',
      age: 35,
      startAge: 35,
      birthAge: 40,
      arrivalAge: 40,
      parentAge: 40,
    };

    // Assert getChildEventBirthAge(mixedEvent) resolves to the newer child-specific field (40), not the generic age (35)
    expect(getChildEventBirthAge(mixedEvent)).toBe(40);

    const inputs = {
      ...baseInputs,
      lifeEvents: [
        {
          id: 'child-mixed',
          enabled: true,
          ...mixedEvent
        }
      ]
    };

    const mockDisplayedResults = {
      incomeList: inputs.incomeList,
      spendingPhases: inputs.spendingPhases
    };

    // Assert selectors/timelines use age 40 for this mixed-field event
    const { result } = renderHook(() => useTimelineEvents(inputs, mockDisplayedResults));
    const homepageEvents = result.current;
    const lifePlannerItems = getTimelineItems(inputs);

    const homeChild = homepageEvents.find(e => e.type === 'haveChild');
    const lpChild = lifePlannerItems.find(item => item.id.startsWith('event-child-point-'));

    expect(homeChild.age).toBe(40);
    expect(lpChild.age).toBe(40);
  });
});
