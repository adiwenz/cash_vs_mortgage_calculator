// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';

// Mock Recharts to avoid layout/sizable errors in jsdom
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



    const debugBtn = screen.queryByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeNull();
  });

  test('Debug button appears in development mode', () => {
    import.meta.env.DEV = true;
    render(<FireSimulator />);



    const debugBtn = screen.getByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeDefined();
  });

  test('Debug button appears when ?debug=true is in the URL query', () => {
    delete window.location;
    window.location = new URL('http://localhost/?debug=true');
    import.meta.env.DEV = false;

    render(<FireSimulator />);



    const debugBtn = screen.getByRole('button', { name: /Debug/i });
    expect(debugBtn).toBeDefined();
  });

  test('Clicking Debug button opens the drawer, and tabs work correctly', async () => {
    import.meta.env.DEV = true;
    render(<FireSimulator />);



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
