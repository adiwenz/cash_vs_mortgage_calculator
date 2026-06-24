// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { useTimelineDragController } from './useTimelineDragController';

describe('useTimelineDragController Hook', () => {
  test('returns expected public properties and refs', () => {
    const inputs = { currentAge: 35, lifeExpectancy: 85 };
    const commitEventAgeChangeMock = vi.fn();
    const setNotificationMock = vi.fn();

    const { result } = renderHook(() => useTimelineDragController({
      inputs,
      timelineEvents: [],
      commitEventAgeChange: commitEventAgeChangeMock,
      setNotification: setNotificationMock
    }));

    expect(result.current.draggingInfo).toBeNull();
    expect(result.current.dragOccurredRef).toBeDefined();
    expect(result.current.dragOccurredRef.current).toBe(false);
    expect(result.current.handleNodeDragStart).toBeTypeOf('function');
  });
});
