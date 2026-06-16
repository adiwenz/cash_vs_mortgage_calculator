// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Simulation Debugger UI Tests', () => {
  const originalLocation = window.location;
  const originalEnv = import.meta.env.DEV;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    // Default to production and no debug search query
    import.meta.env.DEV = false;
    delete window.location;
    window.location = new URL('http://localhost');
  });

  afterEach(() => {
    window.location = originalLocation;
    import.meta.env.DEV = originalEnv;
  });

  test('Debug button is hidden by default in production mode without URL param', () => {
    render(<FireSimulator />);

    // First go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Build My Life Plan/i })[0];
    fireEvent.click(buildBtn);

    const debugBtn = screen.queryByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeNull();
  });

  test('Debug button appears in development mode', () => {
    import.meta.env.DEV = true;
    render(<FireSimulator />);

    // First go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Build My Life Plan/i })[0];
    fireEvent.click(buildBtn);

    const debugBtn = screen.getByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeDefined();
  });

  test('Debug button appears when ?debug=true is in the URL query', () => {
    delete window.location;
    window.location = new URL('http://localhost/?debug=true');
    import.meta.env.DEV = false;

    render(<FireSimulator />);

    // First go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Build My Life Plan/i })[0];
    fireEvent.click(buildBtn);

    const debugBtn = screen.getByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeDefined();
  });

  test('Clicking Debug button opens the drawer, and tabs work correctly', async () => {
    import.meta.env.DEV = true;
    render(<FireSimulator />);

    // Go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Build My Life Plan/i })[0];
    fireEvent.click(buildBtn);

    const debugBtn = screen.getByRole('button', { name: /Debug/i });
    fireEvent.click(debugBtn);

    // Verify Drawer header is present
    expect(screen.getByText('⚙️ Simulation Debugger')).toBeDefined();

    // Verify Tab buttons are present
    const inputsTab = screen.getByRole('button', { name: 'Inputs' });
    const eventsTab = screen.getByRole('button', { name: 'Events' });
    const accountsTab = screen.getByRole('button', { name: 'Accounts & Allocations' });
    const timelineTab = screen.getByRole('button', { name: 'Year-by-Year Timeline' });
    const summaryTab = screen.getByRole('button', { name: 'Summary' });

    expect(inputsTab).toBeDefined();
    expect(eventsTab).toBeDefined();
    expect(accountsTab).toBeDefined();
    expect(timelineTab).toBeDefined();
    expect(summaryTab).toBeDefined();

    // Verify Raw User Inputs title in default Inputs tab
    expect(screen.getByText('Raw User Inputs')).toBeDefined();

    // Click Events tab and verify
    fireEvent.click(eventsTab);
    expect(screen.getByText('Normalized Timeline Events')).toBeDefined();

    // Click Summary tab and verify Copy Summary button is present
    fireEvent.click(summaryTab);
    expect(screen.getByRole('button', { name: /Copy Summary/i })).toBeDefined();

    // Click Close button and verify drawer closes
    const closeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('⚙️ Simulation Debugger')).toBeNull();
  });
});
