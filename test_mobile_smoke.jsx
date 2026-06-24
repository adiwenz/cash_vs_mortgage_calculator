/* eslint-disable no-undef */
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import FireSimulator from './src/components/FireSimulator';
import MobileFireSimulatorView from './src/components/fire-simulator/MobileFireSimulatorView';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';
import { runFireSimulation } from './src/fireCalculations';

// Mock Recharts and ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Mobile Fire Simulator Smoke Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    global.window.innerWidth = 375; // Force mobile layout
  });

  afterEach(() => {
    cleanup();
    global.window.innerWidth = 1024; // Reset to desktop layout
  });

  test('Structural smoke test: header, goal input, nav tabs, and actions render in mobile mode', () => {
    render(<FireSimulator />);

    // 1. Header renders
    const headerElement = screen.getByText('Finley');
    expect(headerElement).toBeDefined();

    // 2. Goal section / age input renders
    const goalInputText = screen.getByText(/When would you like to stop working\?/i);
    expect(goalInputText).toBeDefined();

    // 3. Main nav tabs render
    const planTab = screen.getByRole('button', { name: /^Plan$/i });
    const resultsTab = screen.getByRole('button', { name: /^Results$/i });
    const detailsTab = screen.getByRole('button', { name: /^Details$/i });
    
    expect(planTab).toBeDefined();
    expect(resultsTab).toBeDefined();
    expect(detailsTab).toBeDefined();

    // 4. Action buttons render (like "Add Life Event", "Edit Budget")
    expect(screen.getByText(/Add Life Event/i)).toBeDefined();
    expect(screen.getByText(/Edit Budget/i)).toBeDefined();
  });

  test('Direct render of MobileFireSimulatorView with mocked props works correctly', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);
    
    const mockSimulation = {
      inputs,
      updateInput: vi.fn(),
      activeResults: activeRes,
      displayedResults: activeRes,
      displayedBaselineResults: activeRes,
      baselineResults: activeRes,
      chartData: [],
      totalNetWorth: 100000,
    };

    const mockScenario = {
      inputs,
      updateInput: vi.fn(),
    };

    const mockEventController = {
      handleCreateEvent: vi.fn(),
      handleEditRoadmapEvent: vi.fn(),
      handleDeleteEvent: vi.fn(),
    };

    const mockBudgetController = {
      handleSetBudgetClick: vi.fn(),
    };

    const mockRecommendationController = {
      handleApplyMobileRecommendation: vi.fn(),
    };

    const mockTimeline = {
      timelineEvents: [],
    };

    const mockUiState = {
      isMobile: true,
      activeTab: 'Plan',
      setActiveTab: vi.fn(),
      editingEvent: null,
      setEditingEvent: vi.fn(),
    };

    render(
      <MobileFireSimulatorView
        simulation={mockSimulation}
        scenario={mockScenario}
        eventController={mockEventController}
        budgetController={mockBudgetController}
        recommendationController={mockRecommendationController}
        timeline={mockTimeline}
        uiState={mockUiState}
      />
    );

    // Verify key structural components are present
    expect(screen.getByText('Finley')).toBeDefined();
    expect(screen.getByText(/When would you like to stop working\?/i)).toBeDefined();
    expect(screen.getByText('Plan', { selector: '.mobile-nav-item' })).toBeDefined();
    expect(screen.getByText(/Add Life Event/i)).toBeDefined();
  });
});
