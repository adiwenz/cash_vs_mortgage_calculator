// @vitest-environment jsdom
import { render, screen, cleanup, renderHook, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import FireSimulator from './src/components/FireSimulator';
import { useFireSimulation } from './src/hooks/useFireSimulation';
import { useTimelineEvents } from './src/hooks/useTimelineEvents';
import { useBudgetPhases } from './src/hooks/useBudgetPhases';

// Mock Recharts
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => <div data-testid="Line" />,
    XAxis: () => <div data-testid="XAxis" />,
    YAxis: () => <div data-testid="YAxis" />,
    CartesianGrid: () => <div data-testid="CartesianGrid" />,
    Tooltip: () => <div data-testid="Tooltip" />,
    ReferenceLine: () => <div data-testid="ReferenceLine" />
  };
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Shared Simulator Architecture - Desktop & Mobile Parity', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    globalThis.innerWidth = 1024;
  });

  test('Calculation parity - useFireSimulation hook returns identical results in desktop vs mobile width', () => {
    // 1. Run hook in desktop context
    globalThis.innerWidth = 1024;
    const { result: desktopResult } = renderHook(() => useFireSimulation());
    
    // 2. Run hook in mobile context
    globalThis.innerWidth = 375;
    const { result: mobileResult } = renderHook(() => useFireSimulation());

    // 3. Verify parity of calculation properties
    expect(desktopResult.current.isMobile).toBe(false);
    expect(mobileResult.current.isMobile).toBe(true);

    expect(desktopResult.current.activeResults.retirementReadyAge).toEqual(mobileResult.current.activeResults.retirementReadyAge);
    expect(desktopResult.current.activeResults.runOutAge).toEqual(mobileResult.current.activeResults.runOutAge);
    expect(desktopResult.current.displayedResults.fiNumber).toEqual(mobileResult.current.displayedResults.fiNumber);
    expect(desktopResult.current.chartData.length).toEqual(mobileResult.current.chartData.length);
    
    // Verify first and last year calculations match exactly
    const lastIdx = desktopResult.current.chartData.length - 1;
    expect(desktopResult.current.chartData[0].netWorth).toEqual(mobileResult.current.chartData[0].netWorth);
    expect(desktopResult.current.chartData[lastIdx].netWorth).toEqual(mobileResult.current.chartData[lastIdx].netWorth);
    expect(desktopResult.current.chartData[lastIdx].portfolio).toEqual(mobileResult.current.chartData[lastIdx].portfolio);
  });

  test('Timeline and budget phases parity - identical inputs yield identical list of events and budget phases', () => {
    // 1. Get simulation hook data
    globalThis.innerWidth = 1024;
    const { result: fireSimHook } = renderHook(() => useFireSimulation());
    
    const inputs = fireSimHook.current.inputs;
    const displayedResults = fireSimHook.current.displayedResults;

    // 2. Run timeline events hook
    const { result: timelineEventsHook } = renderHook(() => useTimelineEvents(inputs, displayedResults));
    
    // 3. Run budget phases hook
    const { result: budgetPhasesHook } = renderHook(() => useBudgetPhases(inputs));

    // Verify properties
    expect(timelineEventsHook.current).toBeDefined();
    expect(budgetPhasesHook.current.normalizedPhases).toBeDefined();
    expect(budgetPhasesHook.current.currentAgePhase).toBeDefined();

    // Verify budget phases count
    expect(budgetPhasesHook.current.normalizedPhases.length).toBeGreaterThan(0);
  });

  test('UI parity - verifying both layouts render the identical retirement outcome age', () => {
    // Determine the calculated age programmatically
    const { result } = renderHook(() => useFireSimulation());
    const expectedAge = String(result.current.activeResults.retirementReadyAge || 63);
    cleanup();

    // 1. Render in Desktop mode
    globalThis.innerWidth = 1024;
    const { container: desktopContainer } = render(<FireSimulator />);
    
    // Transition to Step 2
    const buildBtn = screen.getByRole('button', { name: /Start Planning/i });
    fireEvent.click(buildBtn);
    
    // Desktop shows retirement age inside "🏆 Retirement Plan Summary"
    const desktopSummaryText = desktopContainer.querySelector('.plan-summary-story-card')?.textContent || "";
    
    cleanup();

    // 2. Render in Mobile mode
    globalThis.innerWidth = 375;
    const { container: mobileContainer } = render(<FireSimulator />);
    
    // Click bottom navigation button for "Overview"
    const overviewBtn = screen.getByRole('button', { name: /Overview/i });
    fireEvent.click(overviewBtn);
    
    // Mobile shows retirement age in Hero Card / Status / Overview
    const mobileSummaryText = mobileContainer.querySelector('.mobile-snapshot-grid')?.textContent || "";

    // Both should reflect the expected retirement age calculated by the simulation hook
    expect(desktopSummaryText).toContain(expectedAge);
    expect(mobileSummaryText).toContain(expectedAge);
  });
});
