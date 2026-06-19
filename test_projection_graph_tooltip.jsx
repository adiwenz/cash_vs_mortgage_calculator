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

describe('ProjectionGraph Hover Tooltip Positioning and Styling', () => {
  const chartData = [
    { age: 35, netWorth: 100000, assets: 100000, debt: 0 },
    { age: 36, netWorth: 120000, assets: 120000, debt: 0 }
  ];

  const inputs = {
    currentAge: 35,
    lifeExpectancy: 85
  };

  const displayedResults = {
    targetRetirementAge: 65
  };

  const timelineEvents = [
    {
      age: 36,
      type: 'buyHouse',
      title: 'Buy House',
      description: 'Buying a primary residence.',
      icon: '🏠',
      originalId: 'event-1'
    }
  ];

  beforeEach(() => {
    cleanup();
  });

  test('hovering an event marker applies visual emphasis (glow, float, scale) and tiny text label, but NO HTML tooltip', async () => {
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

    // Find the badge group (g element with className containing custom-chart-badge)
    const badgeGroup = container.querySelector('.custom-chart-badge');
    expect(badgeGroup).not.toBeNull();

    // Verify initial state (not hovered)
    expect(badgeGroup.classList.contains('hovered')).toBe(false);

    // Find the main circle inside the badge group.
    // In our component, we have a few circles (glow, selection ring, main badge).
    // The main badge circle is the last circle element.
    const circles = badgeGroup.querySelectorAll('circle');
    const mainCircle = circles[circles.length - 1]; // Last circle is the main badge circle
    const initialR = parseFloat(mainCircle.getAttribute('r'));
    const initialCy = parseFloat(mainCircle.getAttribute('cy'));

    // Assert that no HTML tooltip is rendered initially
    expect(container.querySelector('.timeline-tooltip')).toBeNull();

    // Trigger mouse enter (hover)
    fireEvent.mouseEnter(badgeGroup);

    // Verify hovered class is added
    expect(badgeGroup.classList.contains('hovered')).toBe(true);

    // Verify main circle radius has scaled up (1.15x)
    const hoveredR = parseFloat(mainCircle.getAttribute('r'));
    expect(hoveredR).toBeCloseTo(initialR * 1.15, 2);

    // Verify main circle has floated upwards (lower cy value by 3px)
    const hoveredCy = parseFloat(mainCircle.getAttribute('cy'));
    expect(hoveredCy).toBe(initialCy - 3);

    // Verify that NO HTML tooltip is rendered on hover
    expect(container.querySelector('.timeline-tooltip')).toBeNull();

    // Verify that a tiny SVG <text> label is rendered directly above the badge
    // (excluding the hidden accessibility texts which are inside a display: none g element)
    const visibleTexts = Array.from(badgeGroup.querySelectorAll('text')).filter(txt => {
      let parent = txt.parentElement;
      while (parent && parent !== badgeGroup) {
        if (parent.style.display === 'none') return false;
        parent = parent.parentElement;
      }
      return true;
    });

    // One text is the emoji, the other should be the text label "Buy House"
    const labelTextNode = visibleTexts.find(txt => txt.textContent === 'Buy House');
    expect(labelTextNode).toBeDefined();

    // Trigger mouse leave
    fireEvent.mouseLeave(badgeGroup);

    // Verify hovered class is removed and values reset
    expect(badgeGroup.classList.contains('hovered')).toBe(false);
    expect(parseFloat(mainCircle.getAttribute('r'))).toBe(initialR);
    expect(parseFloat(mainCircle.getAttribute('cy'))).toBe(initialCy);
  });
});

