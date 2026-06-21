// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ProjectionGraph from './src/components/fire-simulator/ProjectionGraph';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Recharts to expose drag events and render children/ReferenceDot shapes
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children, onMouseDown, onMouseMove, onMouseUp, onClick }) => {
      const createRechartsEvent = (e) => {
        const activeLabel = e.activeLabel !== undefined ? e.activeLabel : e.nativeEvent?.activeLabel;
        return {
          activeLabel,
          activeCoordinate: { x: 100, y: 100 }
        };
      };
      return (
        <div
          data-testid="LineChart"
          onMouseDown={(e) => onMouseDown && onMouseDown(createRechartsEvent(e))}
          onMouseMove={(e) => onMouseMove && onMouseMove(createRechartsEvent(e))}
          onMouseUp={(e) => onMouseUp && onMouseUp(createRechartsEvent(e))}
          onClick={(e) => onClick && onClick(createRechartsEvent(e))}
        >
          {children}
        </div>
      );
    },
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    ReferenceArea: ({ x1, x2 }) => <div data-testid="ReferenceArea" data-x1={x1} data-x2={x2} />,
    ReferenceDot: ({ shape, y, ...props }) => {
      if (typeof shape === 'function') {
        const cyVal = (y !== undefined && y < 1000) ? y : 150;
        return shape({ cx: 200, cy: cyVal, ...props });
      }
      return null;
    }
  };
});

// Helper to fire events with custom properties in JSDOM
const fireChartEvent = (element, type, props = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props);
  fireEvent(element, event);
};

describe('ProjectionGraph Drag-to-Zoom Behavior', () => {
  const chartData = [
    { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
    { age: 40, netWorth: 150000, assets: 150000, debt: 0 },
    { age: 50, netWorth: 200000, assets: 200000, debt: 0 },
    { age: 60, netWorth: 300000, assets: 300000, debt: 0 }
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

  const timelineEvents = [
    { age: 35, type: 'today', title: 'Today', description: 'Current point', icon: '📍' },
    { age: 40, type: 'buyHouse', title: 'Buy House', description: 'Buying house', icon: '🏠' },
    { age: 50, type: 'college', title: 'College', description: 'College funds', icon: '🎓' },
    { age: 60, type: 'retire', title: 'Retire', description: 'Retirement age', icon: '🎉' }
  ];

  beforeEach(() => {
    cleanup();
  });

  test('Dragging a valid range shows the Reset zoom button and hides out-of-range markers', () => {
    const setSelectedYear = vi.fn();
    const { container } = render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={setSelectedYear}
        timelineEvents={timelineEvents}
        isMobile={false}
      />
    );

    // Initial state: Reset zoom button should not exist.
    expect(screen.queryByText('Reset zoom')).toBeNull();

    // Check that all 4 markers are rendered initially (via custom-chart-badge CSS class).
    let badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(4);

    const lineChart = screen.getByTestId('LineChart');

    // Simulate drag: mousedown at age 40, mousemove to age 50, mouseup.
    fireChartEvent(lineChart, 'mousedown', { activeLabel: 40 });
    // Verify that reference area is rendered during drag.
    expect(screen.queryByTestId('ReferenceArea')).not.toBeNull();

    fireChartEvent(lineChart, 'mousemove', { activeLabel: 50 });
    fireChartEvent(lineChart, 'mouseup');

    // After drag zoom:
    // 1. Reset zoom button should appear.
    expect(screen.getByText('Reset zoom')).not.toBeNull();

    // 2. Event markers outside age range [40, 50] (i.e. ages 35 and 60) should disappear.
    // Only ages 40 (Buy House) and 50 (College) remain.
    badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(2);

    // Verify correct event content is visible in hidden overlay as well.
    const hiddenOverlay = container.querySelector('.timeline-events-hidden-test-overlay');
    expect(hiddenOverlay.textContent).toContain('Buy House');
    expect(hiddenOverlay.textContent).toContain('College');
    expect(hiddenOverlay.textContent).not.toContain('Today');
    expect(hiddenOverlay.textContent).not.toContain('Retire');
  });

  test('Clicking Reset zoom makes all normal markers visible again', () => {
    const setSelectedYear = vi.fn();
    const { container } = render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={setSelectedYear}
        timelineEvents={timelineEvents}
        isMobile={false}
      />
    );

    const lineChart = screen.getByTestId('LineChart');

    // Zoom in.
    fireChartEvent(lineChart, 'mousedown', { activeLabel: 40 });
    fireChartEvent(lineChart, 'mousemove', { activeLabel: 50 });
    fireChartEvent(lineChart, 'mouseup');

    expect(screen.getByText('Reset zoom')).not.toBeNull();
    let badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(2);

    // Reset zoom.
    const resetBtn = screen.getByText('Reset zoom');
    fireEvent.click(resetBtn);

    // After reset:
    // 1. Reset zoom button should disappear.
    expect(screen.queryByText('Reset zoom')).toBeNull();

    // 2. All 4 markers should be visible again.
    badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(4);
  });

  test('A click without drag still selects the year', () => {
    const setSelectedYear = vi.fn();
    render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={setSelectedYear}
        timelineEvents={timelineEvents}
        isMobile={false}
      />
    );

    const lineChart = screen.getByTestId('LineChart');

    // Simulate standard click at age 42.
    fireChartEvent(lineChart, 'click', { activeLabel: 42 });

    expect(setSelectedYear).toHaveBeenCalledTimes(1);
    expect(setSelectedYear).toHaveBeenCalledWith(42);
  });

  test('A drag zoom does not trigger year selection (click suppression)', () => {
    const setSelectedYear = vi.fn();
    render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={setSelectedYear}
        timelineEvents={timelineEvents}
        isMobile={false}
      />
    );

    const lineChart = screen.getByTestId('LineChart');

    // Drag from 40 to 50.
    fireChartEvent(lineChart, 'mousedown', { activeLabel: 40 });
    fireChartEvent(lineChart, 'mousemove', { activeLabel: 50 });
    fireChartEvent(lineChart, 'mouseup');

    // Immediately after mouseUp, standard React/DOM click fires.
    fireChartEvent(lineChart, 'click', { activeLabel: 50 });

    // Verify click year selection was suppressed.
    expect(setSelectedYear).not.toHaveBeenCalled();
  });

  test('Mobile does not trigger drag zoom', () => {
    const setSelectedYear = vi.fn();
    const { container } = render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={setSelectedYear}
        timelineEvents={timelineEvents}
        isMobile={true}
      />
    );

    const lineChart = screen.getByTestId('LineChart');

    // Attempt drag from 40 to 50.
    fireChartEvent(lineChart, 'mousedown', { activeLabel: 40 });
    fireChartEvent(lineChart, 'mousemove', { activeLabel: 50 });
    fireChartEvent(lineChart, 'mouseup');

    // Verify that zoom did NOT occur (no reset button, all markers visible).
    expect(screen.queryByText('Reset zoom')).toBeNull();
    const badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(4);

    // Verify click year selection still works on mobile.
    fireChartEvent(lineChart, 'click', { activeLabel: 45 });
    expect(setSelectedYear).toHaveBeenCalledTimes(1);
    expect(setSelectedYear).toHaveBeenCalledWith(45);
  });

  test('Safe clearing check on invalid or too short drag', () => {
    const setSelectedYear = vi.fn();
    const { container } = render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={setSelectedYear}
        timelineEvents={timelineEvents}
        isMobile={false}
      />
    );

    const lineChart = screen.getByTestId('LineChart');

    // Drag with range < 1 year (e.g. 40 to 40).
    fireChartEvent(lineChart, 'mousedown', { activeLabel: 40 });
    fireChartEvent(lineChart, 'mousemove', { activeLabel: 40 });
    fireChartEvent(lineChart, 'mouseup');

    expect(screen.queryByText('Reset zoom')).toBeNull();
    expect(container.querySelectorAll('.custom-chart-badge').length).toBe(4);
  });
});
