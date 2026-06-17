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
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
    fireEvent.click(buildBtn);

    const debugBtn = screen.queryByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeNull();
  });

  test('Debug button appears in development mode', () => {
    import.meta.env.DEV = true;
    render(<FireSimulator />);

    // First go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
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
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
    fireEvent.click(buildBtn);

    const debugBtn = screen.getByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeDefined();
  });

  test('Clicking Debug button opens the drawer, and tabs work correctly', async () => {
    import.meta.env.DEV = true;
    render(<FireSimulator />);

    // Go to Step 2
    const buildBtn = screen.getAllByRole('button', { name: /Start Planning/i })[0];
    fireEvent.click(buildBtn);

    const debugBtn = screen.getByRole('button', { name: /Debug/i });
    fireEvent.click(debugBtn);

    // Verify Drawer header is present
    expect(screen.getByText('⚙️ Simulation Debugger')).toBeDefined();

    // Verify Tab buttons are present
    const assumptionsTab = screen.getByRole('button', { name: 'Assumptions & Growth' });
    const balancesTab = screen.getByRole('button', { name: 'Account Balances' });
    const readinessTab = screen.getByRole('button', { name: 'Retirement Readiness' });
    const drawdownsTab = screen.getByRole('button', { name: 'Drawdowns & Sustainability' });
    const timelineTab = screen.getByRole('button', { name: 'Year-by-Year Timeline' });
    const exportTab = screen.getByRole('button', { name: 'Warnings & Export' });

    expect(assumptionsTab).toBeDefined();
    expect(balancesTab).toBeDefined();
    expect(readinessTab).toBeDefined();
    expect(drawdownsTab).toBeDefined();
    expect(timelineTab).toBeDefined();
    expect(exportTab).toBeDefined();

    // Verify Simulation Assumptions in default Assumptions & Growth tab
    expect(screen.getByText(/Simulation Assumptions/i)).toBeDefined();

    // Click Account Balances tab and verify
    fireEvent.click(balancesTab);
    expect(screen.getByText(/Starting vs Retirement Account Balances/i)).toBeDefined();

    // Click Retirement Readiness tab and verify
    fireEvent.click(readinessTab);
    expect(screen.getByText(/FIRE Number Calculation/i)).toBeDefined();

    // Click Drawdowns & Sustainability tab and verify
    fireEvent.click(drawdownsTab);
    expect(screen.getByText(/Withdrawal Drawdown Sequence/i)).toBeDefined();

    // Click Warnings & Export tab and verify
    fireEvent.click(exportTab);
    expect(screen.getByText(/Simulation Inspector Warnings/i)).toBeDefined();

    // Click Close button and verify drawer closes
    const closeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('⚙️ Simulation Debugger')).toBeNull();
  });
});
