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
        return shape({ cx: 200, cy: 150, ...props });
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
    expect(glowCircle.getAttribute('fill')).toBe('rgba(99, 102, 241, 0.4)');

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
    expect(glowCircle.getAttribute('fill')).toBe('rgba(16, 185, 129, 0.18)');

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
    expect(updatedGlowCircle.getAttribute('fill')).toBe('rgba(16, 185, 129, 0.4)');

    // Trigger mouse leave
    fireEvent.mouseLeave(retirementBadge);

    // Verify hovered class is removed and glow fill resets
    expect(retirementBadge.classList.contains('hovered')).toBe(false);
    circles = retirementBadge.querySelectorAll('circle');
    expect(circles.length).toBe(2);
    expect(circles[0].getAttribute('fill')).toBe('rgba(16, 185, 129, 0.18)');
  });
});

