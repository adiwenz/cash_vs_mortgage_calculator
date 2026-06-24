// @vitest-environment jsdom
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import ProjectionGraph from './src/components/fire-simulator/ProjectionGraph';
import { lastChartChangeTypeRef } from './src/components/fire-simulator/changeTypeTracker';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Recharts to capture Y-axis domain prop
let lastYAxisDomain = null;
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => null,
    XAxis: () => null,
    YAxis: ({ domain }) => {
      lastYAxisDomain = domain;
      return <div data-testid="YAxis" data-domain={JSON.stringify(domain)} />;
    },
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceArea: () => null,
    ReferenceLine: () => null
  };
});

describe('ProjectionGraph Stable Y-Axis and Animated Rescaling', () => {
  const baseChartData = [
    { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
    { age: 40, netWorth: 120000, assets: 120000, debt: 0 },
    { age: 50, netWorth: 150000, assets: 150000, debt: 0 },
    { age: 60, netWorth: 200000, assets: 200000, debt: 0 }
  ];

  const inputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    readinessCriteria: 'lastsComfortable'
  };

  const displayedResults = {
    targetRetirementAge: 65,
    retirementReadyAge: 63
  };

  beforeEach(() => {
    cleanup();
    lastYAxisDomain = null;
    lastChartChangeTypeRef.current = null;
    vi.useFakeTimers();

    const mockRaf = (cb) => {
      return setTimeout(() => {
        cb(Date.now());
      }, 16);
    };
    const mockCaf = (id) => {
      clearTimeout(id);
    };

    vi.stubGlobal('requestAnimationFrame', mockRaf);
    vi.stubGlobal('cancelAnimationFrame', mockCaf);

    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'requestAnimationFrame', {
        value: mockRaf,
        writable: true,
        configurable: true
      });
      Object.defineProperty(window, 'cancelAnimationFrame', {
        value: mockCaf,
        writable: true,
        configurable: true
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('1. Moving an event age (event_timing_change) does not change Y-axis domain', () => {
    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    const initialDomain = [...lastYAxisDomain];
    expect(initialDomain).toBeDefined();

    // Simulate event timing change (Y-axis should remain locked/stable)
    lastChartChangeTypeRef.current = 'event_timing_change';
    const shiftedData = baseChartData.map(d => d.age === 40 ? { ...d, age: 42 } : d);

    rerender(
      <ProjectionGraph
        chartData={shiftedData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // Domain should remain exactly the same as initial
    expect(lastYAxisDomain).toEqual(initialDomain);
  });

  test('2. Dragging an event freezes Y-axis during drag', () => {
    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
        draggingInfo={null}
      />
    );

    const initialDomain = [...lastYAxisDomain];

    // Trigger drag starting
    lastChartChangeTypeRef.current = 'event_drag';
    // Huge net worth change (magnitude change) during drag should NOT update Y-axis domain
    const dragData = baseChartData.map(d => ({ ...d, netWorth: d.netWorth * 10 }));

    rerender(
      <ProjectionGraph
        chartData={dragData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
        draggingInfo={{ initialAge: 40, currentAge: 45 }}
      />
    );

    expect(lastYAxisDomain).toEqual(initialDomain);
  });

  test('3. Adding a windfall recalculates and animates Y-axis domain', () => {
    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );



    // Adding windfall change
    lastChartChangeTypeRef.current = 'windfall_change';
    const windfallData = baseChartData.map(d => d.age >= 50 ? { ...d, netWorth: d.netWorth + 500000 } : d);

    rerender(
      <ProjectionGraph
        chartData={windfallData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // Should not immediately jump to final calculated domain
    expect(lastYAxisDomain[1]).toBeLessThan(700000); // 700000+ would be final padded domain for $700k

    // Run fake timers to advance the animation
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Final animated domain should be reached
    expect(lastYAxisDomain[1]).toBeGreaterThan(700000);
  });

  test('4. Editing income recalculates and animates Y-axis domain', () => {
    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    lastChartChangeTypeRef.current = 'income_change';
    const higherIncomeData = baseChartData.map(d => ({ ...d, netWorth: d.netWorth * 3 }));

    rerender(
      <ProjectionGraph
        chartData={higherIncomeData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    const beforeTimers = lastYAxisDomain[1];
    act(() => {
      vi.advanceTimersByTime(350);
    });
    const afterTimers = lastYAxisDomain[1];

    expect(afterTimers).toBeGreaterThan(beforeTimers);
  });

  test('5. Changing desired retirement age does not rescale Y-axis', () => {
    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    const initialDomain = [...lastYAxisDomain];

    lastChartChangeTypeRef.current = 'goal_age_change';
    const changedRetireAgeData = baseChartData.map(d => d);

    rerender(
      <ProjectionGraph
        chartData={changedRetireAgeData}
        inputs={{ ...inputs, targetRetirementAge: 60 }}
        displayedResults={{ ...displayedResults, targetRetirementAge: 60 }}
        showNetWorth={true}
      />
    );

    expect(lastYAxisDomain).toEqual(initialDomain);
  });

  test('6. Severe clipping after drag end triggers one animated rescale', () => {
    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    const initialDomain = [...lastYAxisDomain];

    // Drag ends (event_timing_change), but the resulting path is severely clipped (e.g. net worth 10x larger)
    lastChartChangeTypeRef.current = 'event_timing_change';
    const extremeShiftData = baseChartData.map(d => ({ ...d, netWorth: d.netWorth * 10 }));

    rerender(
      <ProjectionGraph
        chartData={extremeShiftData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
        draggingInfo={null}
      />
    );

    // It should detect severe clipping and trigger animation
    const beforeTimers = lastYAxisDomain[1];
    act(() => {
      vi.advanceTimersByTime(350);
    });
    const afterTimers = lastYAxisDomain[1];

    expect(afterTimers).toBeGreaterThan(beforeTimers);
    expect(afterTimers).toBeGreaterThan(initialDomain[1] * 5);
  });

  test('7. Required Path and Current Plan values are both included in domain calculation', () => {
    const dataWithPlanAndPath = [
      { age: 35, netWorth: 10000, currentPlan: 500000, requiredPath: 800000 }
    ];

    render(
      <ProjectionGraph
        chartData={dataWithPlanAndPath}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // The domain calculation should account for 800,000 (highest value), not just 10,000 (netWorth)
    expect(lastYAxisDomain[1]).toBeGreaterThan(800000);
  });

  test('8. Negative net worth values are included in the Y-axis domain', () => {
    const negativeData = [
      { age: 35, netWorth: -50000, assets: 0, debt: 50000 }
    ];

    render(
      <ProjectionGraph
        chartData={negativeData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // The minimum domain should be negative (specifically below -50000 with padding)
    expect(lastYAxisDomain[0]).toBeLessThan(-50000);
  });

  test('9. Animation cancels cleanly if another domain change starts', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // Start first animation
    lastChartChangeTypeRef.current = 'income_change';
    const firstChange = baseChartData.map(d => ({ ...d, netWorth: d.netWorth * 2 }));
    rerender(
      <ProjectionGraph
        chartData={firstChange}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // Start second animation immediately
    lastChartChangeTypeRef.current = 'windfall_change';
    const secondChange = baseChartData.map(d => ({ ...d, netWorth: d.netWorth * 4 }));
    rerender(
      <ProjectionGraph
        chartData={secondChange}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // cancelAnimationFrame should have been called to cancel the first animation
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('10. "Scale updated" appears only for animated rescale events', () => {
    const { rerender } = render(
      <ProjectionGraph
        chartData={baseChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    // Case A: Simple timing change (should NOT show scale updated)
    lastChartChangeTypeRef.current = 'event_timing_change';
    const shiftedData = baseChartData.map(d => d);
    rerender(
      <ProjectionGraph
        chartData={shiftedData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    expect(screen.queryByText('Scale updated')).toBeNull();

    // Case B: Income change (animated, should show scale updated)
    lastChartChangeTypeRef.current = 'income_change';
    const higherIncomeData = baseChartData.map(d => ({ ...d, netWorth: d.netWorth * 3 }));
    rerender(
      <ProjectionGraph
        chartData={higherIncomeData}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    expect(screen.queryByText('Scale updated')).not.toBeNull();

    // Advance timers past 1200ms
    act(() => {
      vi.advanceTimersByTime(1300);
    });

    // Badge should disappear
    expect(screen.queryByText('Scale updated')).toBeNull();
  });

  test('11. Goal age change 62 -> 90 -> 62 hysteresis behavior (2.5x threshold)', () => {
    // Start at goal 62 with max 100k
    const data62 = [
      { age: 35, netWorth: 100000 },
      { age: 62, netWorth: 100000 }
    ];
    const { rerender } = render(
      <ProjectionGraph
        chartData={data62}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );
    
    const initialMax = lastYAxisDomain[1];
    expect(initialMax).toBe(100000);

    // Expand to goal 90 (max 500k)
    lastChartChangeTypeRef.current = 'goal_age_change';
    const data90 = [
      { age: 35, netWorth: 100000 },
      { age: 90, netWorth: 500000 }
    ];
    
    rerender(
      <ProjectionGraph
        chartData={data90}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const expandedMax = lastYAxisDomain[1];
    expect(expandedMax).toBeGreaterThan(500000);

    // Change back to 62 (max 100k).
    // The ratio expandedMax / 100k is >= 2.5, so it should shrink.
    lastChartChangeTypeRef.current = 'goal_age_change';
    rerender(
      <ProjectionGraph
        chartData={data62}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(lastYAxisDomain[1]).toBeLessThan(expandedMax);
    expect(lastYAxisDomain[1]).toBe(100000);
  });

  test('12. Small goal age changes do not constantly rescale the chart (under 2.5x)', () => {
    // Start at max 200k
    const dataLarge = [
      { age: 35, netWorth: 200000 },
      { age: 60, netWorth: 200000 }
    ];
    const { rerender } = render(
      <ProjectionGraph
        chartData={dataLarge}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    const initialMax = lastYAxisDomain[1];
    
    // Change to max 100k (under 2.5x reduction, so it should keep 200k nice max)
    lastChartChangeTypeRef.current = 'goal_age_change';
    const dataSmall = [
      { age: 35, netWorth: 100000 },
      { age: 60, netWorth: 100000 }
    ];

    rerender(
      <ProjectionGraph
        chartData={dataSmall}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(lastYAxisDomain[1]).toEqual(initialMax);
  });

  test('13. Switching scenario resets the sticky Y-axis and recalculates fresh', () => {
    const dataLarge = [
      { age: 35, netWorth: 500000 }
    ];
    const { rerender } = render(
      <ProjectionGraph
        chartData={dataLarge}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
        scenarioId="scenario-A"
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const maxA = lastYAxisDomain[1];
    expect(maxA).toBeGreaterThan(500000);

    const dataSmall = [
      { age: 35, netWorth: 100000 }
    ];

    // Change scenario ID and use smaller data
    rerender(
      <ProjectionGraph
        chartData={dataSmall}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
        scenarioId="scenario-B"
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(lastYAxisDomain[1]).toBe(100000);
  });

  test('14. Changing life expectancy resets sticky max and recalculates fresh', () => {
    const dataLarge = [
      { age: 35, netWorth: 500000 }
    ];
    const { rerender } = render(
      <ProjectionGraph
        chartData={dataLarge}
        inputs={{ ...inputs, lifeExpectancy: 85 }}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const dataSmall = [
      { age: 35, netWorth: 100000 }
    ];

    // Change life expectancy
    rerender(
      <ProjectionGraph
        chartData={dataSmall}
        inputs={{ ...inputs, lifeExpectancy: 95 }}
        displayedResults={displayedResults}
        showNetWorth={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(lastYAxisDomain[1]).toBe(100000);
  });

  test('15. Changing visible series toggles resets sticky max and recalculates fresh', () => {
    const dataLarge = [
      { age: 35, netWorth: 500000, assets: 100000 }
    ];
    const { rerender } = render(
      <ProjectionGraph
        chartData={dataLarge}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={true}
        showAssets={false}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Toggle showNetWorth=false, showAssets=true
    rerender(
      <ProjectionGraph
        chartData={dataLarge}
        inputs={inputs}
        displayedResults={displayedResults}
        showNetWorth={false}
        showAssets={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(lastYAxisDomain[1]).toBe(100000);
  });
});
