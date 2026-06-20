// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import ProjectionGraph from './src/components/fire-simulator/ProjectionGraph';

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Recharts specifically for this test to render CustomEventMarker shape
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    ReferenceDot: ({ shape, x, y, ...props }) => {
      // Re-create Recharts behavior where shape is called with coordinate props
      if (typeof shape === 'function') {
        const cyVal = (y !== undefined && y < 1000) ? y : 150;
        return shape({ cx: 200, cy: cyVal, ...props });
      }
      return null;
    }
  };
});

describe('ProjectionGraph Event Markers Sizing, Glow, Hover and Tooltip Behavior', () => {
  const chartData = [
    { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
    { age: 36, netWorth: 120000, assets: 120000, debt: 0 }
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
    {
      age: 36,
      type: 'buyHouse',
      title: 'Buy House',
      description: 'Buying a primary residence.',
      icon: '🏠',
      originalId: 'event-1'
    },
    {
      age: 63,
      type: 'retirementReadyComfortable',
      title: 'Comfortable Ready',
      description: 'You can retire comfortably.',
      icon: '🎉',
      originalId: 'event-2'
    }
  ];

  beforeEach(() => {
    cleanup();
  });

  test('Standard event marker scales on hover, glow intensifies on hover, and no HTML tooltip/card appears on hover', async () => {
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

    // Find the buyHouse badge group
    const badges = container.querySelectorAll('.custom-chart-badge');
    // The first badge is Buy House (age 36), the second is Comfortable Ready (age 63)
    const houseBadge = badges[0];
    expect(houseBadge).not.toBeNull();

    // Initially, standard event has no glow circle (only 1 circle - the main badge)
    let circles = houseBadge.querySelectorAll('circle');
    expect(circles.length).toBe(1);
    const mainCircle = circles[0];
    const initialR = parseFloat(mainCircle.getAttribute('r'));
    const initialCy = parseFloat(mainCircle.getAttribute('cy'));

    // Assert that no HTML tooltip is rendered initially
    expect(container.querySelector('.timeline-tooltip')).toBeNull();

    // Trigger mouse enter (hover)
    fireEvent.mouseEnter(houseBadge);

    // Verify hovered class is added
    expect(houseBadge.classList.contains('hovered')).toBe(true);

    // Verify main circle radius has scaled up (1.15x)
    circles = houseBadge.querySelectorAll('circle');
    const updatedMainCircle = circles[circles.length - 1];
    expect(parseFloat(updatedMainCircle.getAttribute('r'))).toBeCloseTo(initialR * 1.15, 2);

    // Verify main circle has floated upwards (lower cy value by 3px)
    expect(parseFloat(updatedMainCircle.getAttribute('cy'))).toBe(initialCy - 3);

    // Verify glow circle is rendered on hover and has intensified purple glow fill
    expect(circles.length).toBe(2);
    const glowCircle = circles[0];
    expect(glowCircle.getAttribute('fill')).toBe('rgba(30, 58, 95, 0.4)');

    // Verify that NO HTML tooltip is rendered on hover
    expect(container.querySelector('.timeline-tooltip')).toBeNull();

    // Trigger mouse leave
    fireEvent.mouseLeave(houseBadge);

    // Verify hovered class is removed and circles/radii reset
    expect(houseBadge.classList.contains('hovered')).toBe(false);
    circles = houseBadge.querySelectorAll('circle');
    expect(circles.length).toBe(1);
  });

  test('Work Optional / Retirement event marker scales on hover, glow intensifies on hover, and has no permanent label', async () => {
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

    const badges = container.querySelectorAll('.custom-chart-badge');
    const retirementBadge = badges[1]; // Comfortable Ready at age 63
    expect(retirementBadge).not.toBeNull();

    // Initially, retirement event has a persistent subtle green glow (so 2 circles: 1 glow, 1 main badge)
    let circles = retirementBadge.querySelectorAll('circle');
    expect(circles.length).toBe(2);
    const glowCircle = circles[0];
    expect(glowCircle.getAttribute('fill')).toBe('rgba(22, 163, 74, 0.18)');

    const mainCircle = circles[1];
    const initialR = parseFloat(mainCircle.getAttribute('r'));

    // Trigger mouse enter (hover)
    fireEvent.mouseEnter(retirementBadge);

    // Verify hovered class is added
    expect(retirementBadge.classList.contains('hovered')).toBe(true);

    // Verify main circle radius has scaled up (1.15x)
    circles = retirementBadge.querySelectorAll('circle');
    const updatedMainCircle = circles[circles.length - 1];
    expect(parseFloat(updatedMainCircle.getAttribute('r'))).toBeCloseTo(initialR * 1.15, 2);

    // Verify glow circle is still rendered and has intensified green glow fill
    expect(circles.length).toBe(2);
    const updatedGlowCircle = circles[0];
    expect(updatedGlowCircle.getAttribute('fill')).toBe('rgba(22, 163, 74, 0.4)');

    // Trigger mouse leave
    fireEvent.mouseLeave(retirementBadge);

    // Verify hovered class is removed and glow fill resets
    expect(retirementBadge.classList.contains('hovered')).toBe(false);
    circles = retirementBadge.querySelectorAll('circle');
    expect(circles.length).toBe(2);
    expect(circles[0].getAttribute('fill')).toBe('rgba(22, 163, 74, 0.18)');
  });

  test('Stack of events that fits without overflowing is fully rendered', () => {
    const multipleEventsSameAge = [
      {
        age: 36,
        type: 'buyHouse',
        title: 'Buy House',
        description: 'Buy house 1',
        icon: '🏠',
        originalId: 'event-1'
      },
      {
        age: 36,
        type: 'haveChild',
        title: 'Have Child',
        description: 'Have a baby',
        icon: '👶',
        originalId: 'event-2'
      },
      {
        age: 36,
        type: 'college',
        title: 'College Funding',
        description: 'Send to college',
        icon: '🎓',
        originalId: 'event-3'
      }
    ];

    const { container } = render(
      <ProjectionGraph
        chartData={chartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={vi.fn()}
        timelineEvents={multipleEventsSameAge}
        isMobile={false}
      />
    );

    // Since cy = 150, the top event lane is lane 2 (y_2 = 150 - 100 = 50). Top edge: 50 - 12.5 = 37.5 >= 0.
    // It fits, so all 3 event badges should be rendered.
    const badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(3);

    // No "+" collapse badge should be present
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(0); // since none is collapsed, no rect badges are rendered
  });

  test('Stack of events that overflows is collapsed into a single icon with +N badge', () => {
    // We pass y = 50 in chartData so that ReferenceDot receives y = 50 as cy.
    const customChartData = [
      { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
      { age: 36, netWorth: 50, assets: 120000, debt: 0 } // netWorth is 50, so y = 50
    ];

    const multipleEventsSameAge = [
      {
        age: 36,
        type: 'buyHouse',
        title: 'Buy House',
        description: 'Buy house 1',
        icon: '🏠',
        originalId: 'event-1'
      },
      {
        age: 36,
        type: 'haveChild',
        title: 'Have Child',
        description: 'Have a baby',
        icon: '👶',
        originalId: 'event-2'
      }
    ];

    const { container } = render(
      <ProjectionGraph
        chartData={customChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={vi.fn()}
        timelineEvents={multipleEventsSameAge}
        isMobile={false}
      />
    );

    // At cy = 50:
    // Lane 0: 50 - 36 = 14 (fits)
    // Lane 1: 50 - 68 = -18 (overflows: -18 - 12.5 = -30.5 < 0)
    // The stack goes over, so it collapses.
    // Only lane 0 is rendered (1 badge group).
    const badges = container.querySelectorAll('.custom-chart-badge');
    expect(badges.length).toBe(1);

    // The text should contain "+1"
    const texts = Array.from(container.querySelectorAll('text')).map(el => el.textContent);
    expect(texts).toContain('+1');
  });

  test('Clicking a collapsed cluster marker opens the popover, lists the events, and edit button triggers handleEditRoadmapEvent', async () => {
    const customChartData = [
      { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
      { age: 36, netWorth: 50, assets: 120000, debt: 0 }
    ];

    const multipleEventsSameAge = [
      {
        age: 36,
        type: 'buyHouse',
        title: 'Buy House',
        description: 'Buy house 1',
        icon: '🏠',
        originalId: 'event-1'
      },
      {
        age: 36,
        type: 'haveChild',
        title: 'Have Child',
        description: 'Have a baby',
        icon: '👶',
        originalId: 'event-2'
      }
    ];

    const handleEditRoadmapEvent = vi.fn();

    const { container } = render(
      <ProjectionGraph
        chartData={customChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={vi.fn()}
        timelineEvents={multipleEventsSameAge}
        isMobile={false}
        handleEditRoadmapEvent={handleEditRoadmapEvent}
      />
    );

    // The popover panel should not be in the document initially
    expect(container.querySelector('.cluster-popover-panel')).toBeNull();

    // Click the collapsed badge
    const badge = container.querySelector('.custom-chart-badge');
    expect(badge).not.toBeNull();
    fireEvent.click(badge);

    // The popover panel should now be in the document
    const popover = container.querySelector('.cluster-popover-panel');
    expect(popover).not.toBeNull();

    // The popover should display both event titles
    expect(screen.getByText('Buy House')).not.toBeNull();
    expect(screen.getByText('Have Child')).not.toBeNull();

    // It should have two Edit buttons
    const editButtons = screen.getAllByText('Edit');
    expect(editButtons.length).toBe(2);

    // Click the second Edit button (corresponding to 'Have Child')
    fireEvent.click(editButtons[1]);

    // handleEditRoadmapEvent should have been called with the second event
    expect(handleEditRoadmapEvent).toHaveBeenCalledWith(multipleEventsSameAge[1]);

    // The popover panel should be closed/removed from DOM
    expect(container.querySelector('.cluster-popover-panel')).toBeNull();
  });

  test('Clicking the backdrop of the popover closes it', async () => {
    const customChartData = [
      { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
      { age: 36, netWorth: 50, assets: 120000, debt: 0 }
    ];

    const multipleEventsSameAge = [
      {
        age: 36,
        type: 'buyHouse',
        title: 'Buy House',
        description: 'Buy house 1',
        icon: '🏠',
        originalId: 'event-1'
      },
      {
        age: 36,
        type: 'haveChild',
        title: 'Have Child',
        description: 'Have a baby',
        icon: '👶',
        originalId: 'event-2'
      }
    ];

    const { container } = render(
      <ProjectionGraph
        chartData={customChartData}
        inputs={inputs}
        displayedResults={displayedResults}
        showAssets={true}
        showDebt={true}
        showNetWorth={true}
        setSelectedYear={vi.fn()}
        timelineEvents={multipleEventsSameAge}
        isMobile={false}
      />
    );

    // Click the collapsed badge
    const badge = container.querySelector('.custom-chart-badge');
    fireEvent.click(badge);

    const popover = container.querySelector('.cluster-popover-panel');
    expect(popover).not.toBeNull();

    // Click the backdrop
    const backdrop = container.querySelector('.cluster-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);

    // The popover and backdrop should be closed/removed from DOM
    expect(container.querySelector('.cluster-popover-panel')).toBeNull();
    expect(container.querySelector('.cluster-backdrop')).toBeNull();
  });
});

