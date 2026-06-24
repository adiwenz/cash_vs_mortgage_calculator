// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import useEventEditingControllerLegacy from '../../../features/fire/events/useEventEditingController';
import useEventEditingControllerNew from './useEventEditingController';

describe('useEventEditingController API compatibility', () => {
  const defaultArgs = {
    scenarios: [],
    setScenarios: vi.fn(),
    currentScenarioId: 's1',
    inputs: { currentAge: 35, lifeExpectancy: 85, lifeEvents: [] },
    updateInput: vi.fn(),
    timelineEvents: [],
    isMobile: false,
    setShowImprovementModal: vi.fn(),
    commitEventAgeChange: vi.fn()
  };

  const expectedKeys = [
    'editingEvent',
    'setEditingEvent',
    'childImpactSummary',
    'setChildImpactSummary',
    'houseImpactSummary',
    'setHouseImpactSummary',
    'houseRebalanceSummary',
    'setHouseRebalanceSummary',
    'editingCondition',
    'setEditingCondition',
    'draggingInfo',
    'setDraggingInfo',
    'notification',
    'setNotification',
    'selectedEventId',
    'setSelectedEventId',
    'selectedEvent',
    'setSelectedEvent',
    'isFullPartnerProfileOpen',
    'setIsFullPartnerProfileOpen',
    'isZeroSpendingConfirmed',
    'setIsZeroSpendingConfirmed',
    'isPartnerZeroSpendingConfirmed',
    'setIsPartnerZeroSpendingConfirmed',
    'dragOccurredRef',
    'handleCreateEvent',
    'handleEditRoadmapEvent',
    'handleSaveEvent',
    'handleDeleteEvent',
    'handleDeleteRoadmapEvent',
    'handleSaveCurrentCondition',
    'handleRemoveCurrentCondition',
    'handleNodeDragStart'
  ];

  test('legacy import path returns all expected API keys', () => {
    const { result } = renderHook(() => useEventEditingControllerLegacy(defaultArgs));
    
    expectedKeys.forEach(key => {
      expect(result.current).toHaveProperty(key);
    });
  });

  test('new composition hook returns identical API keys', () => {
    const { result } = renderHook(() => useEventEditingControllerNew(defaultArgs));
    
    expectedKeys.forEach(key => {
      expect(result.current).toHaveProperty(key);
    });
  });
});
