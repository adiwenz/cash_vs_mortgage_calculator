// @vitest-environment jsdom
import fs from 'fs';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';

// Mock Recharts to avoid layout/sizable errors in jsdom
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => <div data-testid="Line" />,
    XAxis: () => <div data-testid="XAxis" />,
    YAxis: () => <div data-testid="YAxis" />,
    CartesianGrid: () => <div data-testid="CartesianGrid" />,
    Tooltip: () => <div data-testid="Tooltip" />,
    Legend: () => <div data-testid="Legend" />,
    ReferenceLine: () => <div data-testid="ReferenceLine" />,
    AreaChart: ({ children }) => <div data-testid="AreaChart">{children}</div>,
    Area: () => <div data-testid="Area" />,
  };
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Child Event Linked Dragging Regression Test', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const navigateToStep2 = () => {
    render(<FireSimulator />);
    
    // Click "Build My Life Plan" to go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
    fireEvent.click(buildBtn);

    // Expand Advanced Detail accordion
    const advancedTrigger = screen.getAllByRole('button', { name: /Advanced Detail/i })[0];
    fireEvent.click(advancedTrigger);
  };

  test('Simulating click-hold/dragging of child start event preserves linked span without duplicating', async () => {
    const logBuffer = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logBuffer.push(args.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' '));
      originalLog(...args);
    };

    navigateToStep2();

    // 1. Create a child event
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'haveChild' } });

    // Assert haveChild modal opens
    expect(screen.getByRole('heading', { name: /Have a Child/i })).toBeDefined();

    // Enter child name
    const childNameInput = screen.getByPlaceholderText(/e.g. Liam/i);
    fireEvent.change(childNameInput, { target: { value: 'Liam' } });

    // Keep parent's age when born at 35 (default)
    // Save
    fireEvent.click(screen.getByRole('button', { name: /Save Event/i }));

    // Done on welcome modal
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Welcome, Liam!/i })).toBeDefined();
    });
    const doneButtons = screen.getAllByRole('button', { name: /Done/i });
    const doneBtn = doneButtons.find(btn => btn.classList.contains('btn-primary')) || doneButtons[0];
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Welcome, Liam!/i })).toBeNull();
    });

    // Verify initial positions of markers
    // There should be exactly two child milestone icons (one for birth, one for support end)
    const babyMilestones = document.querySelectorAll('.milestone-circle-wrapper, .financial-milestone-wrapper');
    // Let's filter to find those with '👶'
    const childMilestones = Array.from(babyMilestones).filter(node => node.textContent.includes('👶'));
    expect(childMilestones.length).toBe(2);

    // Find the child start and support end elements by text inside their tooltips
    const birthTextNode = screen.getByText('👶 Have Child: Liam');
    const endTextNode = screen.getByText('👶 Support for Liam Ends');

    const birthNode = birthTextNode.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');
    const endNode = endTextNode.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');

    expect(birthNode).not.toBeNull();
    expect(endNode).not.toBeNull();

    // Verify initial display ages in tooltip descriptions
    expect(birthNode.textContent).toContain('Age 35');
    expect(endNode.textContent).toContain('Age 53');

    // 2. Drag Simulation
    // Mock getBoundingClientRect for track
    const track = document.querySelector('.timeline-track-inner');
    expect(track).not.toBeNull();
    track.getBoundingClientRect = () => ({
      width: 1000,
      left: 0,
      right: 1000,
      top: 0,
      bottom: 0
    });

    // Click and hold (mouse down) child start event
    fireEvent.mouseDown(birthNode, { clientX: 100 });

    // Drag child start event: move right by 200px (corresponds to +10 years on 1000px width track and 50 total years)
    fireEvent.mouseMove(document, { clientX: 300 });

    // 3. Verify during drag preview:
    // a. Only one child start marker is visible
    // b. Only one child end marker is visible
    // c. The child end marker remains offset by the correct span (18 years)
    // d. No duplicate child milestone nodes have been created
    const babyMilestonesDuringDrag = document.querySelectorAll('.milestone-circle-wrapper, .financial-milestone-wrapper');
    const childMilestonesDuringDrag = Array.from(babyMilestonesDuringDrag).filter(node => node.textContent.includes('👶'));
    expect(childMilestonesDuringDrag.length).toBe(2); // Only 2 baby icons, no duplicates!

    // Verify both nodes are updated to correct displayAge during drag
    // Birth milestone age: 35 + 10 = 45
    // Support ends milestone age: 53 + 10 = 63
    expect(birthNode.textContent).toContain('Age 45');
    expect(endNode.textContent).toContain('Age 63');

    // Verify visual horizontal positioning properties (style.left) in jsdom
    expect(parseFloat(birthNode.style.left)).toBeCloseTo(20);
    expect(parseFloat(endNode.style.left)).toBeCloseTo(56);
    expect(birthNode.style.left).not.toBe(endNode.style.left); // Must not overlap/render on top of each other!

    // Drop event
    fireEvent.mouseUp(document);

    // 4. Verify post-drop committed state
    // Make sure they committed to Age 45 and Age 63
    await waitFor(() => {
      const updatedBirthText = screen.getByText('👶 Have Child: Liam');
      const updatedEndText = screen.getByText('👶 Support for Liam Ends');
      const updatedBirthNode = updatedBirthText.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');
      const updatedEndNode = updatedEndText.closest('.milestone-circle-wrapper, .financial-milestone-wrapper');
      expect(updatedBirthNode.textContent).toContain('Age 45');
      expect(updatedEndNode.textContent).toContain('Age 63');
    });

    // Double check that there are still only 2 child milestone nodes total
    const babyMilestonesPostDrop = document.querySelectorAll('.milestone-circle-wrapper, .financial-milestone-wrapper');
    const childMilestonesPostDrop = Array.from(babyMilestonesPostDrop).filter(node => node.textContent.includes('👶'));
    expect(childMilestonesPostDrop.length).toBe(2);

    console.log = originalLog;
    fs.writeFileSync('./scratch/drag_debug.log', logBuffer.join('\n'));
  });
});
