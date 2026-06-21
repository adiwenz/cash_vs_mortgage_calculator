// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ProjectionGraph from './src/components/fire-simulator/ProjectionGraph';
import DesktopTimeline from './src/components/fire-simulator/DesktopTimeline';
import MobileTimeline from './src/components/fire-simulator/MobileTimeline';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Recharts
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children, onClick, onMouseMove, onMouseLeave, onMouseDown, onMouseUp }) => (
      <div 
        data-testid="LineChart"
        onClick={() => onClick && onClick({ activeLabel: 36 })}
        onMouseDown={() => onMouseDown && onMouseDown({ activeLabel: 35 })}
        onMouseMove={() => onMouseMove && onMouseMove({ activeCoordinate: { x: 100, y: 150 }, activeLabel: 36 })}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
      >
        {children}
      </div>
    ),
    Line: () => <div data-testid="Line" />,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: ({ content, active, payload, label }) => {
      // Allow testing tooltip rendering by invoking content
      if (typeof content === 'function') {
        return content({ active: true, payload: [{ name: 'Net Worth', value: 120000, stroke: '#10b981' }], label: 36 });
      }
      return null;
    },
    ReferenceLine: () => <div data-testid="ReferenceLine" />,
    ReferenceDot: () => <div data-testid="ReferenceDot" />,
    ReferenceArea: () => <div data-testid="ReferenceArea" />
  };
});

describe('ProjectionGraph and Timelines - Life Events Decoupling', () => {
  const chartData = [
    { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
    { age: 36, netWorth: 120000, assets: 120000, debt: 0 }
  ];

  const inputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    targetRetirementAge: 65,
    lifeEvents: [
      { id: 'event-1', type: 'buyHouse', age: 36, enabled: true },
      { id: 'event-2', type: 'haveChild', age: 38, enabled: true },
      { id: 'event-3', type: 'marriage', age: 40, enabled: true }
    ],
    houseAssets: [],
    lifeProfile: { household: { status: 'single' } }
  };

  const displayedResults = {
    targetRetirementAge: 65,
    retirementReadyAge: 63,
    runOutAge: 75
  };

  const timelineEvents = [
    {
      age: 36,
      type: 'buyHouse',
      title: 'Buy House',
      description: 'Buying a primary residence.',
      icon: '🏠',
      originalId: 'event-1',
      stackIndex: 0
    },
    {
      age: 63,
      type: 'retirementReadyComfortable',
      title: 'Comfortable Ready',
      description: 'You can retire comfortably.',
      icon: '🎉',
      originalId: 'event-2',
      stackIndex: 0
    },
    {
      age: 65,
      type: 'retire',
      title: 'Stop Working Event',
      description: 'Target age to stop working.',
      icon: '🏖️',
      originalId: 'retire-1',
      stackIndex: 0
    },
    {
      age: 67,
      type: 'socialSecurity',
      title: 'Social Security',
      description: 'Claim Social Security.',
      icon: '💰',
      originalId: 'ss-1',
      stackIndex: 0
    }
  ];

  beforeEach(() => {
    cleanup();
  });

  test('The graph does not render life event emoji markers, Goal Age, or Assets Run Out lines', () => {
    const { container } = render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={vi.fn()}
        timelineEvents={timelineEvents}
        isMobile={false}
      />
    );

    // No CustomEventMarker or badge elements should be found in the container of ProjectionGraph
    const badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(0);

    // Recharts Mock should not render ReferenceLine or ReferenceDot since they are removed
    const refLines = container.querySelectorAll('[data-testid="ReferenceLine"]');
    expect(refLines.length).toBe(0);

    const refDots = container.querySelectorAll('[data-testid="ReferenceDot"]');
    expect(refDots.length).toBe(0);
  });

  test('The desktop timeline renders life events with correct emoji mappings', () => {
    const handleEditRoadmapEvent = vi.fn();
    const { container } = render(
      <DesktopTimeline
        inputs={inputs}
        timelineEvents={timelineEvents}
        editingEvent={null}
        draggingInfo={null}
        dragOccurredRef={{ current: false }}
        handleNodeDragStart={vi.fn()}
        handleEditRoadmapEvent={handleEditRoadmapEvent}
      />
    );

    // Verify milestones are rendered in timeline
    const textContent = container.textContent;
    
    // Emojis mapping verification:
    // buyHouse -> 🏠
    expect(textContent).toContain('🏠');
    
    // retirementReadyComfortable -> ✓ (current plan work optional age)
    expect(textContent).toContain('✓');

    // retire -> ⭐ (goal retirement age)
    expect(textContent).toContain('⭐');

    // socialSecurity -> 🎂
    expect(textContent).toContain('🎂');
  });

  test('Clicking a desktop timeline marker triggers handleEditRoadmapEvent edit flow', () => {
    const handleEditRoadmapEvent = vi.fn();
    const { container } = render(
      <DesktopTimeline
        inputs={inputs}
        timelineEvents={timelineEvents}
        editingEvent={null}
        draggingInfo={null}
        dragOccurredRef={{ current: false }}
        handleNodeDragStart={vi.fn()}
        handleEditRoadmapEvent={handleEditRoadmapEvent}
      />
    );

    // Click on the Buy House timeline event wrapper (excluding the today-pin wrapper)
    const milestones = container.querySelectorAll('.milestone-circle-wrapper, .financial-milestone-wrapper:not(.today-pin)');
    expect(milestones.length).toBeGreaterThan(0);

    // Trigger click on first milestone (Buy House)
    fireEvent.click(milestones[0]);
    expect(handleEditRoadmapEvent).toHaveBeenCalledWith(timelineEvents[0]);
  });

  test('Collapsed timeline state still renders the compact milestone view (MobileTimeline 11+ events density rules)', () => {
    // Generate 12 events to trigger compact mode (eventCount >= 11)
    const denseEvents = Array.from({ length: 12 }, (_, i) => ({
      age: 35 + i,
      type: 'custom',
      title: `Event ${i}`,
      label: `Event ${i}`,
      icon: '💼',
      originalId: `evt-${i}`
    }));

    const { container } = render(
      <MobileTimeline
        scenario={{ inputs }}
        timeline={{ timelineEvents: denseEvents }}
        selectedEventIndex={-1}
        setSelectedEventIndex={vi.fn()}
        onEventTap={vi.fn()}
      />
    );

    // Under density rule (11+ events), only selected event, first event, and last event show their labels.
    // Since none is selected, only Event 0 and Event 11 should have visible labels.
    const visibleLabels = Array.from(container.querySelectorAll('.mobile-roadmap-label-text')).map(el => el.textContent);
    
    expect(visibleLabels).toContain('Event 0');
    expect(visibleLabels).toContain('Event 11');
    expect(visibleLabels).not.toContain('Event 5');
  });

  test('Expanded timeline state renders the full milestone view (MobileTimeline < 11 events)', () => {
    // Generate 5 events (full mode)
    const sparseEvents = Array.from({ length: 5 }, (_, i) => ({
      age: 35 + i,
      type: 'custom',
      title: `Event ${i}`,
      label: `Event ${i}`,
      icon: '💼',
      originalId: `evt-${i}`
    }));

    const { container } = render(
      <MobileTimeline
        scenario={{ inputs }}
        timeline={{ timelineEvents: sparseEvents }}
        selectedEventIndex={-1}
        setSelectedEventIndex={vi.fn()}
        onEventTap={vi.fn()}
      />
    );

    // In expanded/sparse mode (< 11 events), all labels should be rendered
    const visibleLabels = Array.from(container.querySelectorAll('.mobile-roadmap-label-text')).map(el => el.textContent);
    
    expect(visibleLabels.length).toBe(5);
    expect(visibleLabels).toContain('Event 0');
    expect(visibleLabels).toContain('Event 2');
    expect(visibleLabels).toContain('Event 4');
  });

  test('Existing graph line, tooltip, and click-to-select-year behavior remain functional', () => {
    const setSelectedYear = vi.fn();
    const { getByTestId, container } = render(
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

    // Check line is rendered
    expect(getByTestId('Line')).not.toBeNull();

    // Check chart click triggers setSelectedYear
    const lineChart = getByTestId('LineChart');
    fireEvent.click(lineChart);
    expect(setSelectedYear).toHaveBeenCalledWith(36);
  });
});
