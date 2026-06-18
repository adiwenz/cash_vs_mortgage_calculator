import { test, vi } from 'vitest';
import React from 'react';

// Register a dummy test so Vitest recognizes these self-executing files as valid test suites
test('Self-executing test script runs successfully', () => {
  // The actual assertions run during module import.
  // If they fail, they throw an exception which fails the suite.
  // If they pass, this dummy test passes.
});

// Mock process.exit so Vitest doesn't abort during watch mode or execution.
// process.exit(0) is allowed to exit cleanly, and non-zero exit codes throw to report test failure.
process.exit = (code) => {
  if (code !== 0) {
    throw new Error(`process.exit called with non-zero code: ${code}`);
  }
};

// Mock ResizeObserver globally for JSDOM environments
if (typeof globalThis !== 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock window.scrollTo to suppress JSDOM environment warnings
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}

// Mock Recharts globally to avoid layout/sizable errors in JSDOM

vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => React.createElement('div', { 'data-testid': 'ResponsiveContainer' }, children),
    LineChart: ({ children, ...props }) => React.createElement('div', { 'data-testid': 'LineChart', ...props }, children),
    Line: (props) => React.createElement('div', { 'data-testid': 'Line', ...props }),
    XAxis: (props) => React.createElement('div', { 'data-testid': 'XAxis', ...props }),
    YAxis: (props) => React.createElement('div', { 'data-testid': 'YAxis', ...props }),
    CartesianGrid: (props) => React.createElement('div', { 'data-testid': 'CartesianGrid', ...props }),
    Tooltip: (props) => React.createElement('div', { 'data-testid': 'Tooltip', ...props }),
    ReferenceLine: ({ x, ...props }) => React.createElement('div', { 'data-testid': 'ReferenceLine', 'data-x': x, ...props }),
    ReferenceDot: ({ x, y, ...props }) => React.createElement('div', { 'data-testid': 'ReferenceDot', 'data-x': x, 'data-y': y, ...props }),
    PieChart: ({ children, ...props }) => React.createElement('div', { 'data-testid': 'PieChart', ...props }, children),
    Pie: ({ children, ...props }) => React.createElement('div', { 'data-testid': 'Pie', ...props }, children),
    Cell: (props) => React.createElement('div', { 'data-testid': 'Cell', ...props }),
    Legend: (props) => React.createElement('div', { 'data-testid': 'Legend', ...props }),
    AreaChart: ({ children, ...props }) => React.createElement('div', { 'data-testid': 'AreaChart', ...props }, children),
    Area: (props) => React.createElement('div', { 'data-testid': 'Area', ...props }),
    BarChart: ({ children, ...props }) => React.createElement('div', { 'data-testid': 'BarChart', ...props }, children),
    Bar: (props) => React.createElement('div', { 'data-testid': 'Bar', ...props }),
  };
});

