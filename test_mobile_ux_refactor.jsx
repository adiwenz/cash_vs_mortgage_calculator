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
    ReferenceLine: () => <div data-testid="ReferenceLine" />
  };
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
    expect(screen.getByText('Life Events')).toBeDefined();
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
    const detailsBtn = screen.getByRole('button', { name: /Details/i });
    fireEvent.click(detailsBtn);
    expect(detailsBtn.className).toContain('active');
    expect(screen.getByText(/Starting Account Balances/i)).toBeDefined();
  });

  test('Tapping a phase opens full-screen phase detail screen', () => {
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

    // Overlay phase detail screen should open
    expect(screen.getByText('Why this phase exists')).toBeDefined();
    expect(screen.getByText('Budget')).toBeDefined();
    expect(screen.getByText('Savings Allocation')).toBeDefined();
    expect(screen.getByText('Impact of This Phase')).toBeDefined();

    // Verify back button works to close the overlay
    const backBtn = screen.getByRole('button', { name: /Back to Roadmap/i });
    fireEvent.click(backBtn);
    
    // Detail screen elements should be closed/hidden
    expect(screen.queryByText('Why this phase exists')).toBeNull();
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

    // Verify long sentences / descriptions are NOT rendered directly in the scroller
    const scroller = document.querySelector('.mobile-roadmap-scroll-container');
    expect(scroller.textContent).not.toContain('Eligible for Medicare. Premium drops from $10,000/yr to $4,000/yr.');

    // 2. The first event (Medicare) should be selected by default and display details card
    expect(screen.getByText('Why it matters')).toBeDefined();
    expect(screen.getByText('Starts at Age 65')).toBeDefined();
    expect(screen.getByText('Healthcare Premium Impact')).toBeDefined();

    // 3. Click the Social Security milestone
    const ssMilestoneBtn = screen.getByText('Social Sec.').closest('button');
    fireEvent.click(ssMilestoneBtn);

    // 4. Verify Social Security details card is displayed
    expect(screen.getByText('Estimated Benefit')).toBeDefined();
    expect(screen.getByText('$24,000/year ($2,000/month)')).toBeDefined();

    // 5. Verify Target Retirement detail and edit event callback
    const retireMilestoneBtn = screen.getByText('Retire').closest('button');
    fireEvent.click(retireMilestoneBtn);

    const editBtn = screen.getByRole('button', { name: /Edit Event/i });
    fireEvent.click(editBtn);
    expect(handleEditRoadmapEvent).toHaveBeenCalledWith(timelineEvents[1]);
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

  test('Roadmap tab renders MobileRecommendationsPanel inside recommendations stack when plan is not on track', () => {
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

    // Verify recommendations header is rendered
    expect(screen.getByText('💡 Recommendations')).toBeDefined();

    // Since plan is not on track, it should render MobileRecommendationsPanel instead of static mockup recommendations
    expect(screen.getByText('Save More')).toBeDefined();
    expect(screen.getByText('Save an additional $500/month.')).toBeDefined();

    // It should NOT render "Delay Social Security" or "Reduce Spending" which are mockup recommendations
    expect(screen.queryByText('Delay Social Security')).toBeNull();
  });
});
