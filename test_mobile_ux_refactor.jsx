// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';
import MobileFireSimulator from './src/components/fire-simulator/MobileFireSimulatorView';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';
import { runFireSimulation } from './src/fireCalculations';

// Mock Recharts
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
    expect(screen.getByText('Plan', { selector: '.mobile-nav-item' })).toBeDefined();
    expect(screen.getByText('Results', { selector: '.mobile-nav-item' })).toBeDefined();
    expect(screen.getByText('Details', { selector: '.mobile-nav-item' })).toBeDefined();
  });

  test('Plan tab is selected by default', () => {
    render(<FireSimulator />);
    
    // The Plan tab should have the active class style/representation
    const planBtn = screen.getByRole('button', { name: /^Plan$/i });
    expect(planBtn.className).toContain('active');
    
    // Should display Plan section titles
    expect(screen.getByText(/Add life events to personalize/i)).toBeDefined();
    expect(screen.getByText('Budget Phases')).toBeDefined();
  });

  test('Bottom navigation switches tabs correctly', () => {
    render(<FireSimulator />);
    
    // Switch to Results Tab
    const resultsBtn = screen.getByRole('button', { name: /Results/i });
    fireEvent.click(resultsBtn);
    expect(resultsBtn.className).toContain('active');
    expect(screen.getByText('Compare projections and view progress charts')).toBeDefined();
    expect(screen.queryByText(/Add life events to personalize/i)).toBeNull();

    // Switch to Details Tab
    const detailsBtn = screen.getByRole('button', { name: /^Details$/i });
    fireEvent.click(detailsBtn);
    expect(detailsBtn.className).toContain('active');
    expect(screen.getByText(/Starting Account Balances/i)).toBeDefined();

    // Switch back to Plan Tab
    const planBtn = screen.getByRole('button', { name: /^Plan$/i });
    fireEvent.click(planBtn);
    expect(planBtn.className).toContain('active');
    expect(screen.getByText(/Add life events to personalize/i)).toBeDefined();
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
    expect(screen.getByText('Stop Working', { selector: '.mobile-roadmap-label-text' })).toBeDefined();
    expect(screen.getByText('Social Sec.', { selector: '.mobile-roadmap-label-text' })).toBeDefined();

    // Verify long sentences / descriptions are NOT rendered directly in the track
    const scroller = document.querySelector('.mobile-roadmap-track');
    expect(scroller.textContent).not.toContain('Eligible for Medicare. Premium drops from $10,000/yr to $4,000/yr.');

    // 2. The first event (Medicare) is selected by default. Since it's not editable, clicking it again does not edit.
    const medicareMilestoneBtn = screen.getByText('Medicare').closest('button');
    fireEvent.click(medicareMilestoneBtn);
    expect(handleEditRoadmapEvent).not.toHaveBeenCalled();

    // 3. Click the Social Security milestone to select it
    const ssMilestoneBtn = screen.getByText('Social Sec.').closest('button');
    fireEvent.click(ssMilestoneBtn);

    // 4. Click the Social Security milestone again (since it is selected and editable, it should trigger handleEditRoadmapEvent)
    fireEvent.click(ssMilestoneBtn);
    expect(handleEditRoadmapEvent).toHaveBeenCalledWith(timelineEvents[2]);

    // 5. Verify Target Retirement edit event callback
    const retireMilestoneBtn = screen.getByText('Stop Working').closest('button');
    fireEvent.click(retireMilestoneBtn); // select it
    fireEvent.click(retireMilestoneBtn); // edit it
    expect(handleEditRoadmapEvent).toHaveBeenCalledWith(timelineEvents[1]);
  });

  test('Plan tab renders recommendation banner and expanding it shows MobileRecommendationsPanel when plan is not on track', () => {
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

    // Verify Outcome Preview section is rendered (expanded by default)
    const outcomeHeader = screen.getByText(/Outcome Preview/i);
    expect(outcomeHeader).toBeDefined();

    // Verify recommendations banner is rendered
    expect(screen.getByText(/Recommendation details available/i)).toBeDefined();

    // Click "View Suggestions" to expand the phase containing MobileRecommendationsPanel
    const viewSuggestionsBtn = screen.getByRole('button', { name: /View Suggestions/i });
    fireEvent.click(viewSuggestionsBtn);

    // Verify recommendations card are rendered
    expect(screen.getByText('Save More')).toBeDefined();
    expect(screen.getByText('Save an additional $500/month.')).toBeDefined();

    // Verify apply button works
    const applyBtn = screen.getByRole('button', { name: 'Apply Recommendation' });
    fireEvent.click(applyBtn);
    expect(handleApplyImprovementScenario).toHaveBeenCalledWith(mockImprovementPlan.rankedPlan[0]);
  });

  test('Plan tab renders MobileRecommendationsPanel inside recommendations stack when plan is not on track', () => {
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
        handleEditRoadmapEvent={vi.fn()}
      />
    );

    const buttons = container.querySelectorAll('.mobile-roadmap-milestone');
    expect(buttons.length).toBe(4);
    
    // Extract positions
    const positions = Array.from(buttons).map(btn => parseFloat(btn.style.left));
    
    // Total usable width = W - 72. Positions must increase linearly:
    const diff1 = positions[1] - positions[0];
    const diff2 = positions[2] - positions[1];
    const diff3 = positions[3] - positions[2];
    
    expect(diff1).toBeCloseTo(diff2, 1);
    expect(diff2).toBeCloseTo(diff3, 1);
    expect(positions[0]).toBe(36); // Pinned left
  });

  test('Many events (10+) density visibility rules', () => {
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
        handleEditRoadmapEvent={vi.fn()}
      />
    );

    // With 11 events, showAge (<=12) should be true, showTitle (<=8) should be false.
    // Check that age elements exist but title labels do not.
    const ageElements = container.querySelectorAll('.mobile-roadmap-age');
    expect(ageElements.length).toBe(11);

    const titleElements = container.querySelectorAll('.mobile-roadmap-label-text');
    expect(titleElements.length).toBe(0);
  });

  test('Consistent static marker sizes (48px base, 60px selected)', () => {
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
        handleEditRoadmapEvent={vi.fn()}
      />
    );

    const circles = container.querySelectorAll('.mobile-roadmap-circle');
    
    // First circle is base (48px)
    expect(circles[0].style.width).toBe('48px');
    expect(circles[0].style.height).toBe('48px');

    // Second circle is selected (60px)
    expect(circles[1].style.width).toBe('60px');
    expect(circles[1].style.height).toBe('60px');
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

