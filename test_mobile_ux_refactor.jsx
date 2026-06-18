// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';
import MobileFireSimulator from './src/components/fire-simulator/MobileFireSimulatorView';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';
import { runFireSimulation } from './src/fireCalculations';

// Mock Recharts
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => <div data-testid="Line" />,
    XAxis: () => <div data-testid="XAxis" />,
    YAxis: () => <div data-testid="YAxis" />,
    CartesianGrid: () => <div data-testid="CartesianGrid" />,
    Tooltip: () => <div data-testid="Tooltip" />,
    ReferenceLine: ({ x }) => <div data-testid="ReferenceLine" data-x={x} />,
    ReferenceDot: ({ x, y }) => <div data-testid="ReferenceDot" data-x={x} data-y={y} />
  };
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import MobileTimeline from './src/components/fire-simulator/MobileTimeline';

describe('Mobile UX Refactor - Finley-Style Roadmap Experience', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    
    // Set window width to mobile by default
    global.window.innerWidth = 375;
  });

  afterEach(() => {
    cleanup();
    global.window.innerWidth = 1024;
  });

  test('Renders MobileFireSimulator when screen width is < 768px', () => {
    render(<FireSimulator />);
    
    // The mobile layout header should have the logo text "Finley"
    expect(screen.getByText('Finley')).toBeDefined();
    
    // The bottom navigation tab buttons should exist
    expect(screen.getByText('Overview', { selector: '.mobile-nav-item' })).toBeDefined();
    expect(screen.getByText('Roadmap', { selector: '.mobile-nav-item' })).toBeDefined();
    expect(screen.getByText('Results', { selector: '.mobile-nav-item' })).toBeDefined();
    expect(screen.getByText('Details', { selector: '.mobile-nav-item' })).toBeDefined();
  });

  test('Roadmap tab is selected by default', () => {
    render(<FireSimulator />);
    
    // The Roadmap tab should have the active class style/representation
    const roadmapBtn = screen.getByRole('button', { name: /Roadmap/i });
    expect(roadmapBtn.className).toContain('active');
    
    // Should display Roadmap section titles
    expect(screen.getByText('Interactive Roadmap')).toBeDefined();
    expect(screen.getByText('Your Life Journey ✨')).toBeDefined();
    expect(screen.getByText('Budget Phases')).toBeDefined();
  });

  test('Bottom navigation switches tabs correctly', () => {
    render(<FireSimulator />);
    
    // Switch to Overview Tab
    const overviewBtn = screen.getByRole('button', { name: /Overview/i });
    fireEvent.click(overviewBtn);
    expect(overviewBtn.className).toContain('active');
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.queryByText('Interactive Roadmap')).toBeNull();

    // Switch to Results Tab
    const resultsBtn = screen.getByRole('button', { name: /Results/i });
    fireEvent.click(resultsBtn);
    expect(resultsBtn.className).toContain('active');
    expect(screen.getByText('Compare projections and view progress charts')).toBeDefined();

    // Switch to Details Tab
    const detailsBtn = screen.getByRole('button', { name: /^Details$/i });
    fireEvent.click(detailsBtn);
    expect(detailsBtn.className).toContain('active');
    expect(screen.getByText(/Starting Account Balances/i)).toBeDefined();
  });

  test('Tapping a phase expands phase inline details', () => {
    // We can test MobileFireSimulator props directly
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);
    const displayedRes = {
      ...activeRes,
      phases: activeRes.phases || []
    };

    const handleSetBudgetClick = vi.fn();
    const handleEditRoadmapEvent = vi.fn();

    render(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={activeRes}
        displayedResults={displayedRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={[]}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={handleEditRoadmapEvent}
        handleSetBudgetClick={handleSetBudgetClick}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={5000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={[]}
        editingEvent={null}
        displayedBaselineResults={displayedRes}
        baselineResults={activeRes}
      />
    );

    // Tap first phase card: Work & Save
    const workSavePhaseBtn = screen.getByText('Working', { selector: '.mobile-phase-card-title' });
    fireEvent.click(workSavePhaseBtn);

    // Accordion details should expand inline
    expect(screen.getByText('💵 Income')).toBeDefined();
    expect(screen.getByText('💸 Expenses')).toBeDefined();
    expect(screen.getByText('💰 Savings')).toBeDefined();
    expect(screen.getByText('🏠 Housing Cost')).toBeDefined();

    // Verify edit button triggers handleSetBudgetClick
    const editBtn = screen.getByText('⚙️ Edit Budget Configuration');
    fireEvent.click(editBtn);
    expect(handleSetBudgetClick).toHaveBeenCalled();

    // Collapse again
    fireEvent.click(workSavePhaseBtn);
    expect(screen.queryByText('💵 Income')).toBeNull();
  });

  test('Roadmap tab milestones rendering and interaction', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);
    const displayedRes = {
      ...activeRes,
      phases: activeRes.phases || []
    };

    const timelineEvents = [
      {
        age: 65,
        title: 'Medicare Eligibility',
        label: 'Medicare Eligibility',
        icon: '🏥',
        type: 'medicareEligibility',
        description: 'Eligible for Medicare. Premium drops from $10,000/yr to $4,000/yr.'
      },
      {
        originalId: 'retire-event',
        age: 65,
        title: 'Target Retirement',
        label: 'Retirement',
        icon: '🏖️',
        type: 'retire',
        description: 'Target retirement age reached.'
      },
      {
        originalId: 'ss-event',
        age: 67,
        title: 'Social Security starts at 67: ~$24,000/yr',
        label: 'Social Security starts at 67: ~$24,000/yr',
        icon: '💰',
        type: 'socialSecurity',
        description: 'Receiving Social Security of $2,000/month ($24,000/year).'
      }
    ];

    const handleEditRoadmapEvent = vi.fn();
    const handleDeleteEvent = vi.fn();

    render(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={activeRes}
        displayedResults={displayedRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={[]}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={handleEditRoadmapEvent}
        handleDeleteEvent={handleDeleteEvent}
        handleSetBudgetClick={vi.fn()}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={5000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={timelineEvents}
        editingEvent={null}
        displayedBaselineResults={displayedRes}
        baselineResults={activeRes}
      />
    );

    // 1. Verify timeline nodes display shortened labels and NO sentences
    expect(screen.getByText('Medicare', { selector: '.mobile-roadmap-label-text' })).toBeDefined();
    expect(screen.getByText('Retire', { selector: '.mobile-roadmap-label-text' })).toBeDefined();
    expect(screen.getByText('Social Sec.', { selector: '.mobile-roadmap-label-text' })).toBeDefined();

    // Verify long sentences / descriptions are NOT rendered directly in the track
    const scroller = document.querySelector('.mobile-roadmap-track');
    expect(scroller.textContent).not.toContain('Eligible for Medicare. Premium drops from $10,000/yr to $4,000/yr.');

    // 2. Click the Medicare milestone. Since it's a system event, it shouldn't show edit/delete actions, but should show system message.
    const medicareMilestoneBtn = screen.getByText('Medicare').closest('button');
    fireEvent.click(medicareMilestoneBtn);
    expect(screen.getByText('Event Options')).toBeDefined();
    expect(screen.getByText('System Event — cannot be modified')).toBeDefined();
    expect(screen.queryByText('Edit Event Details')).toBeNull();

    // 3. Click the Social Security milestone to open the Event Options sheet
    const ssMilestoneBtn = screen.getByText('Social Sec.').closest('button');
    fireEvent.click(ssMilestoneBtn);
    expect(screen.getByText('Event Options')).toBeDefined();
    expect(screen.getByText('Social Security')).toBeDefined();

    // 4. Click the "Edit Event Details" action button in the bottom sheet
    const editDetailsBtn = screen.getByText('Edit Event Details');
    fireEvent.click(editDetailsBtn);
    expect(handleEditRoadmapEvent).toHaveBeenCalledWith(timelineEvents[2]);

    // 5. Verify Target Retirement edit event callback from bottom sheet
    const retireMilestoneBtn = screen.getByText('Retire').closest('button');
    fireEvent.click(retireMilestoneBtn); // open bottom sheet
    const editRetireBtn = screen.getByText('Edit Event Details');
    fireEvent.click(editRetireBtn);
    expect(handleEditRoadmapEvent).toHaveBeenCalledWith(timelineEvents[1]);

    // 6. Test Delete Event confirmation flow from bottom sheet
    const deleteConfirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    fireEvent.click(retireMilestoneBtn); // open bottom sheet again
    const deleteBtn = screen.getByText('Delete Event');
    fireEvent.click(deleteBtn);
    expect(deleteConfirmSpy).toHaveBeenCalled();
    expect(handleDeleteEvent).toHaveBeenCalledWith(timelineEvents[1]);
    deleteConfirmSpy.mockRestore();
  });

  test('Overview tab renders MobileRecommendationsPanel when plan is not on track', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);
    const displayedRes = {
      ...activeRes,
      phases: activeRes.phases || []
    };

    const mockImprovementPlan = {
      rankedPlan: [
        {
          type: 'savings',
          icon: '💸',
          title: 'Save More',
          details: 'Save an additional $500/month.',
          bulletPoints: ['Reduces discretionary spending'],
          readyAge: 63,
          savingsFocus: 'Save More',
          savingsEffortScore: 2
        }
      ]
    };

    const handleApplyImprovementScenario = vi.fn();

    render(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={{ ...activeRes, retirementOutcome: 'shortfall' }} // Force not on track
        displayedResults={displayedRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={[]}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={vi.fn()}
        handleSetBudgetClick={vi.fn()}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={5000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={[]}
        editingEvent={null}
        displayedBaselineResults={displayedRes}
        baselineResults={activeRes}
        handleApplyImprovementScenario={handleApplyImprovementScenario}
        improvementPlan={mockImprovementPlan}
      />
    );

    // Default tab is Roadmap, click Overview to switch
    const overviewBtn = screen.getByRole('button', { name: /Overview/i });
    fireEvent.click(overviewBtn);

    // Verify recommendations header and cards are rendered
    expect(screen.getByText('💡 Actionable Recommendations')).toBeDefined();
    expect(screen.getByText('Save More')).toBeDefined();
    expect(screen.getByText('Save an additional $500/month.')).toBeDefined();

    // Verify apply button works
    const applyBtn = screen.getByRole('button', { name: 'Apply Recommendation' });
    fireEvent.click(applyBtn);
    expect(handleApplyImprovementScenario).toHaveBeenCalledWith(mockImprovementPlan.rankedPlan[0]);
  });

  test('Roadmap tab does not render MobileRecommendationsPanel inside budget phases', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);
    const displayedRes = {
      ...activeRes,
      phases: activeRes.phases || []
    };

    const mockImprovementPlan = {
      rankedPlan: [
        {
          type: 'savings',
          icon: '💸',
          title: 'Save More',
          details: 'Save an additional $500/month.',
          bulletPoints: ['Reduces discretionary spending'],
          readyAge: 63,
          savingsFocus: 'Save More',
          savingsEffortScore: 2
        }
      ]
    };

    render(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={{ ...activeRes, retirementOutcome: 'shortfall' }} // Force not on track
        displayedResults={displayedRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={[]}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={vi.fn()}
        handleSetBudgetClick={vi.fn()}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={5000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={[]}
        editingEvent={null}
        displayedBaselineResults={displayedRes}
        baselineResults={activeRes}
        handleApplyImprovementScenario={vi.fn()}
        improvementPlan={mockImprovementPlan}
      />
    );

    // We should be on Roadmap tab by default. Tap the Working phase to open details
    const workSavePhaseBtn = screen.getByText('Working', { selector: '.mobile-phase-card-title' });
    fireEvent.click(workSavePhaseBtn);

    // Verify recommendations header is NOT rendered
    expect(screen.queryByText('💡 Recommendations')).toBeNull();
    expect(screen.queryByText('Save More')).toBeNull();
  });

  test('Dense cluster even spacing logic', () => {
    const inputs = { currentAge: 35, lifeExpectancy: 85 };
    const timelineEvents = [
      { age: 63, title: 'Coast FIRE', label: 'Coast FIRE', icon: '⛵', type: 'coastFire' },
      { age: 65, title: 'Medicare', label: 'Medicare', icon: '🏥', type: 'medicareEligibility' },
      { age: 65, title: 'Retire', label: 'Retire', icon: '🏖️', type: 'retire' },
      { age: 67, title: 'SS Claim', label: 'SS Claim', icon: '💰', type: 'socialSecurity' }
    ];

    const { container } = render(
      <MobileTimeline
        inputs={inputs}
        timelineEvents={timelineEvents}
        selectedEventIndex={0}
        setSelectedEventIndex={vi.fn()}
      />
    );

    const buttons = container.querySelectorAll('.mobile-roadmap-milestone');
    expect(buttons.length).toBe(4);
    
    // Extract positions
    const positions = Array.from(buttons).map(btn => parseFloat(btn.style.left));
    
    // Total usable width = W - (paddingLeft + paddingRight). Positions must increase linearly:
    const diff1 = positions[1] - positions[0];
    const diff2 = positions[2] - positions[1];
    const diff3 = positions[3] - positions[2];
    
    expect(diff1).toBeCloseTo(diff2, 1);
    expect(diff2).toBeCloseTo(diff3, 1);
    expect(positions[0]).toBe(35); // 54/2 + 8 = 35
  });

  test('Many events (11+) density visibility rules', () => {
    const inputs = { currentAge: 35, lifeExpectancy: 85 };
    const timelineEvents = Array.from({ length: 11 }, (_, i) => ({
      age: 35 + i * 4,
      title: `Event ${i + 1}`,
      label: `Ev ${i + 1}`,
      icon: '📅',
      type: 'lifestyle'
    }));

    const { container } = render(
      <MobileTimeline
        inputs={inputs}
        timelineEvents={timelineEvents}
        selectedEventIndex={0}
        setSelectedEventIndex={vi.fn()}
      />
    );

    // Keep age pills visible for all events
    const ageElements = container.querySelectorAll('.mobile-roadmap-age');
    expect(ageElements.length).toBe(11);

    // Non-selected event names should be hidden. Under compact mode, only selected, first and last are visible
    // Since selected is 0 (which is also first), we only have index 0 and index 10 visible.
    const titleElements = Array.from(container.querySelectorAll('.mobile-roadmap-label-text'))
      .filter(el => el.style.visibility !== 'hidden');
    
    expect(titleElements.length).toBe(2);
  });

  test('Consistent marker sizes for 1-6 events (44px base, 54px selected)', () => {
    const inputs = { currentAge: 35, lifeExpectancy: 85 };
    const timelineEvents = [
      { age: 35, title: 'Today', label: 'Today', icon: '👤', type: 'career' },
      { age: 50, title: 'Midlife', label: 'Midlife', icon: '📈', type: 'lifestyle' }
    ];

    const { container } = render(
      <MobileTimeline
        inputs={inputs}
        timelineEvents={timelineEvents}
        selectedEventIndex={1} // Select the second one
        setSelectedEventIndex={vi.fn()}
      />
    );

    const circles = container.querySelectorAll('.mobile-roadmap-circle');
    
    // First circle is base (44px)
    expect(circles[0].style.width).toBe('44px');
    expect(circles[0].style.height).toBe('44px');

    // Second circle is selected (54px)
    expect(circles[1].style.width).toBe('54px');
    expect(circles[1].style.height).toBe('54px');
  });

  test('Net Worth graph highlights selected milestone age correctly', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);
    const displayedRes = {
      ...activeRes,
      phases: activeRes.phases || []
    };

    const timelineEvents = [
      { age: 40, title: 'Buy Home', label: 'Buy Home', icon: '🏠', type: 'buyHouse' },
      { age: 65, title: 'Retire', label: 'Retire', icon: '🏖️', type: 'retire' }
    ];

    const chartData = [
      { age: 35, netWorth: 10000, income: 50000, expenses: 40000 },
      { age: 40, netWorth: 25000, income: 55000, expenses: 42000 },
      { age: 65, netWorth: 500000, income: 0, expenses: 60000 }
    ];

    const { container } = render(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={activeRes}
        displayedResults={displayedRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={chartData}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={vi.fn()}
        handleSetBudgetClick={vi.fn()}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={5000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={timelineEvents}
        editingEvent={null}
        displayedBaselineResults={displayedRes}
        baselineResults={activeRes}
      />
    );

    // Select the first milestone (Buy Home at Age 40). By default, index 0 is selected.
    // Verify ReferenceLine and ReferenceDot are rendered with target x = 40.
    const refLine = container.querySelector('[data-testid="ReferenceLine"]');
    const refDot = container.querySelector('[data-testid="ReferenceDot"]');

    expect(refLine).not.toBeNull();
    expect(refLine.getAttribute('data-x')).toBe('40');

    expect(refDot).not.toBeNull();
    expect(refDot.getAttribute('data-x')).toBe('40');
  });
});

