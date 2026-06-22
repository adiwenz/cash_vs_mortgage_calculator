// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';
import MobileFireSimulator from './src/components/fire-simulator/MobileFireSimulatorView';
import MobileEventWizard from './src/components/fire-simulator/MobileEventWizard';
import ReviewStep from './src/components/fire-simulator/mobile-event-wizard/ReviewStep';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';
import { runFireSimulation } from './src/fireCalculations';
import { getChildCostOffsetRecommendations } from './src/recommendations';
import { useState, useMemo, useEffect } from 'react';

// Mock Recharts
// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Mobile Event Wizard & Flow', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    global.window.innerWidth = 375;
  });

  afterEach(() => {
    cleanup();
    global.window.innerWidth = 1024;
  });

  test('FAB and inline button trigger editingEvent to open wizard', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);
    const setEditingEvent = vi.fn();

    render(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={activeRes}
        displayedResults={activeRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={[]}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={vi.fn()}
        handleSetBudgetClick={vi.fn()}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={100000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={[]}
        editingEvent={null}
        setEditingEvent={setEditingEvent}
        handleSaveEvent={vi.fn()}
        handleDeleteEvent={vi.fn()}
        getInputsWithEvent={vi.fn()}
        displayedBaselineResults={activeRes}
        baselineResults={activeRes}
      />
    );

    // 1. FAB button "➕ Add Life Event"
    const fabBtn = screen.getByRole('button', { name: /^➕ Add Life Event/i });
    expect(fabBtn).toBeDefined();
    fireEvent.click(fabBtn);
    expect(setEditingEvent).toHaveBeenCalledWith({ type: 'selectType', isNew: true });
  });

  test('Wizard overlay hides bottom navigation bar', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const activeRes = runFireSimulation(inputs);

    const { rerender } = render(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={activeRes}
        displayedResults={activeRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={[]}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={vi.fn()}
        handleSetBudgetClick={vi.fn()}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={100000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={[]}
        editingEvent={null}
        setEditingEvent={vi.fn()}
        handleSaveEvent={vi.fn()}
        handleDeleteEvent={vi.fn()}
        getInputsWithEvent={vi.fn()}
        displayedBaselineResults={activeRes}
        baselineResults={activeRes}
      />
    );

    // Bottom navigation is visible when not editing
    expect(screen.getByRole('navigation', { selector: '.mobile-bottom-nav' })).toBeDefined();

    // Rerender with editingEvent active
    rerender(
      <MobileFireSimulator
        inputs={inputs}
        updateInput={vi.fn()}
        displayMode="deflated"
        setDisplayMode={vi.fn()}
        activeResults={activeRes}
        displayedResults={activeRes}
        selectedYear={35}
        setSelectedYear={vi.fn()}
        chartData={[]}
        validation={{}}
        handleCreateEvent={vi.fn()}
        handleEditRoadmapEvent={vi.fn()}
        handleSetBudgetClick={vi.fn()}
        handleOpenSavingsDetails={vi.fn()}
        isMobile={true}
        totalNetWorth={100000}
        activeStep={2}
        setActiveStep={vi.fn()}
        timelineEvents={[]}
        editingEvent={{ type: 'selectType', isNew: true }}
        setEditingEvent={vi.fn()}
        handleSaveEvent={vi.fn()}
        handleDeleteEvent={vi.fn()}
        getInputsWithEvent={vi.fn()}
        displayedBaselineResults={activeRes}
        baselineResults={activeRes}
      />
    );

    // Bottom navigation should be hidden
    expect(screen.queryByRole('navigation', { selector: '.mobile-bottom-nav' })).toBeNull();
  });

  test('Step 2: Choose Event Type categorizes and searches events correctly', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const setEditingEvent = vi.fn();
    const onClose = vi.fn();

    render(
      <MobileEventWizard
        inputs={inputs}
        editingEvent={{ type: 'selectType', isNew: true }}
        setEditingEvent={setEditingEvent}
        handleSaveEvent={vi.fn()}
        handleDeleteEvent={vi.fn()}
        onClose={onClose}
        getInputsWithEvent={vi.fn()}
        baselineResults={null}
      />
    );

    // Checks title is present
    expect(screen.getByText('What would you like to plan?')).toBeDefined();

    // Verify search works
    const searchInput = screen.getByPlaceholderText('Search events...');
    fireEvent.change(searchInput, { target: { value: 'Child' } });

    // Displays matching search result
    expect(screen.getByText('Child / Adoption')).toBeDefined();
    // Non-matching should not be shown
    expect(screen.queryByText('Home Purchase')).toBeNull();
  });

  test('Step 3: timing screen is shown and handles age sliders', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const setEditingEvent = vi.fn();

    // Render starting at selection screen
    render(
      <MobileEventWizard
        inputs={inputs}
        editingEvent={{ type: 'selectType', isNew: true }}
        setEditingEvent={setEditingEvent}
        handleSaveEvent={vi.fn()}
        handleDeleteEvent={vi.fn()}
        onClose={vi.fn()}
        getInputsWithEvent={vi.fn()}
        baselineResults={null}
      />
    );

    // Click on Move / Relocate
    const careerBtn = screen.getByText('Move / Relocate');
    fireEvent.click(careerBtn);

    // Step 3 Timing screen has title "When does this happen?"
    expect(screen.getByText('When does this happen?')).toBeDefined();


    // Verify segments toggle (Age vs Year)
    const yearToggle = screen.getByRole('button', { name: 'Year' });
    fireEvent.click(yearToggle);
    expect(screen.getByText('calendar year', { exact: false })).toBeDefined();

    const ageToggle = screen.getByRole('button', { name: 'Age' });
    fireEvent.click(ageToggle);
    expect(screen.getByText('years old', { exact: false })).toBeDefined();

    // Next button proceeds to Step 4
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn);

    // Should display detail configuration screen title
    expect(screen.getByText('Configure details')).toBeDefined();
  });

  test('Manage screen (Step 8) supports editing, duplicating, and deleting', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const setEditingEvent = vi.fn();
    const handleDeleteEvent = vi.fn();
    const handleSaveEvent = vi.fn();

    render(
      <MobileEventWizard
        inputs={inputs}
        editingEvent={{ id: 'child-1', type: 'haveChild', birthAge: 32, childName: 'Tommy', isNew: false }}
        setEditingEvent={setEditingEvent}
        handleSaveEvent={handleSaveEvent}
        handleDeleteEvent={handleDeleteEvent}
        onClose={vi.fn()}
        getInputsWithEvent={vi.fn()}
        baselineResults={null}
      />
    );

    // Title for edit/manage screen should be "Event Details"
    expect(screen.getByText('Event Details')).toBeDefined();
    expect(screen.getAllByText(/Tommy/)[0]).toBeDefined();



    // 1. Edit details triggers step progression
    const editBtn = screen.getByText('Edit Event Details');
    fireEvent.click(editBtn);
    expect(screen.getByText('When does this happen?')).toBeDefined();

    // Go back to step 8
    const backBtn = screen.getAllByRole('button')[0];
    fireEvent.click(backBtn);

    // 2. Duplicate Event
    const duplicateBtn = screen.getByText('Duplicate Event');
    fireEvent.click(duplicateBtn);
    expect(setEditingEvent).toHaveBeenCalled();

    // 3. Delete Event
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const deleteBtn = screen.getByText('Delete Event');
    fireEvent.click(deleteBtn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(handleDeleteEvent).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test.skip('Step 7: displays mobile recommendation cards and calls handleApplyMobileRecommendation when clicked', async () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const handleApplyMobileRecommendation = vi.fn();
    const handleSaveEvent = vi.fn();
    const onClose = vi.fn();

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

    const mockGetInputsWithEvent = (inps, evt) => {
      const copyEvt = { ...evt, id: 'child-1' };
      return {
        newInputs: {
          ...inps,
          lifeEvents: [...(inps.lifeEvents || []), copyEvt]
        },
        savedEvent: copyEvt
      };
    };

    render(
      <MobileEventWizard
        inputs={inputs}
        editingEvent={{ type: 'haveChild', birthAge: 32, childName: 'Jane', isNew: true }}
        setEditingEvent={vi.fn()}
        handleSaveEvent={handleSaveEvent}
        handleDeleteEvent={vi.fn()}
        onClose={onClose}
        getInputsWithEvent={mockGetInputsWithEvent}
        baselineResults={{ retirementReadyAge: 63 }}
        handleApplyMobileRecommendation={handleApplyMobileRecommendation}
        improvementPlan={mockImprovementPlan}
      />
    );

    // Initial step is 2 since isNew is true. Choose Child category.
    const childBtn = screen.getByText('Child / Adoption');
    fireEvent.click(childBtn);

    // Step 3: Timing screen. Click Next.
    const nextBtn3 = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn3);

    // Step 4: Configure details. Click Next.
    const nextBtn4 = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn4);

    // Step 5: Impact Preview. Click Next (triggers save and transitions to Step 7).
    const nextBtn5 = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn5);

    // Wait for the setTimeout in onSave (50ms)
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should display Step 7 with recommendations
    expect(screen.getByText('👶 Child Added to Timeline!')).toBeDefined();
    expect(screen.getAllByText('Save More').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Save an additional $500/month.')).toBeDefined();
    expect(screen.getByText('New Ready Age')).toBeDefined();

    // Click Apply Adjustment
    const applyBtn = screen.getByRole('button', { name: 'Apply Adjustment' });
    fireEvent.click(applyBtn);

    expect(handleApplyMobileRecommendation).toHaveBeenCalledWith(mockImprovementPlan.rankedPlan[0]);
    expect(onClose).toHaveBeenCalled();
  });

  test.skip('Step 5: calculates metrics from deflatedData and shows Needs Adjustment if unsustainable', async () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const handleSaveEvent = vi.fn();
    const onClose = vi.fn();

    const mockGetInputsWithEvent = (inps, evt) => {
      const copyEvt = { ...evt, id: 'child-1', enabled: true };
      return {
        newInputs: {
          ...inps,
          lifeEvents: [...(inps.lifeEvents || []), copyEvt]
        },
        savedEvent: copyEvt
      };
    };

    render(
      <MobileEventWizard
        inputs={inputs}
        editingEvent={{
          type: 'haveChild',
          birthAge: 35,
          childName: 'Jane',
          costMethod: 'custom',
          customAges0to4: 900000,
          isNew: true
        }}
        setEditingEvent={vi.fn()}
        handleSaveEvent={handleSaveEvent}
        handleDeleteEvent={vi.fn()}
        onClose={onClose}
        getInputsWithEvent={mockGetInputsWithEvent}
        baselineResults={runFireSimulation(inputs)}
      />
    );

    const childBtn = screen.getByText('Child / Adoption');
    fireEvent.click(childBtn);

    const nextBtn3 = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn3);

    const nextBtn4 = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn4);

    expect(screen.getByText("Here's how this affects your plan")).toBeDefined();

    const savingsCard = screen.getByText('Savings Rate').closest('.impact-metric-card');
    expect(savingsCard.textContent).toContain('→');
    expect(savingsCard.textContent).not.toContain('0%→0%');

    const nwCard = screen.getByText('Net Worth at Age 85').closest('.impact-metric-card');
    expect(nwCard.textContent).not.toContain('$0→$0');

    const ageCard = screen.getByText('Can Stop Working Age').closest('.impact-metric-card');
    expect(ageCard.textContent).toContain('Needs Adjustment');
  });

  test.skip('Step 7: local childcare offset recommendation is generated and applied', async () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const handleApplyMobileRecommendation = vi.fn();
    const handleSaveEvent = vi.fn();
    const onClose = vi.fn();

    const mockGetInputsWithEvent = (inps, evt) => {
      const copyEvt = { ...evt, id: 'jane-child-event', originalId: 'jane-child-event', enabled: true };
      return {
        newInputs: {
          ...inps,
          lifeEvents: [...(inps.lifeEvents || []), copyEvt]
        },
        savedEvent: copyEvt
      };
    };

    const { container } = render(
      <MobileEventWizard
        inputs={inputs}
        updateInput={vi.fn()}
        draftEvent={{
          type: 'haveChild',
          birthAge: 35,
          childName: 'Jane',
          costMethod: 'custom',
          customAges0to4: 15000,
          isNew: true
        }}
        setEditingEvent={vi.fn()}
        handleSaveEvent={handleSaveEvent}
        handleDeleteEvent={vi.fn()}
        onClose={onClose}
        getInputsWithEvent={mockGetInputsWithEvent}
        baselineResults={runFireSimulation(inputs)}
        handleApplyMobileRecommendation={handleApplyMobileRecommendation}
        improvementPlan={{ rankedPlan: [] }}
      />
    );

    const childBtn = screen.getByText('Child / Adoption');
    fireEvent.click(childBtn);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(screen.getByText('👶 Child Added to Timeline!')).toBeDefined();
    expect(screen.getByText('Get a Promotion', { exact: false })).toBeDefined();
    expect(screen.getByText('Earn More')).toBeDefined();
    expect(screen.getAllByText('Apply Adjustment')[0]).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'Apply Adjustment' })[0]);
    expect(handleApplyMobileRecommendation).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test.skip('Mobile recommendations flow: adds child, shows shortfall, and applies recommendation to update simulation', async () => {
    const defaultInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    const Wrapper = ({ initialInputs }) => {
      const [inputs, setInputs] = useState(initialInputs);
      
      useEffect(() => {
        setInputs(initialInputs);
      }, [initialInputs]);
      
      const activeRes = runFireSimulation(inputs);
      
      const improvementPlan = useMemo(() => {
        const list = [];
        const childRecs = getChildCostOffsetRecommendations(inputs);
        childRecs.forEach(rec => {
          const clonedInputs = JSON.parse(JSON.stringify(inputs));
          const promoEvent = {
            id: `promo-${rec.childEventId}`,
            type: 'careerChange',
            name: rec.childName ? `Promotion (${rec.childName})` : 'Get a Promotion',
            startAge: rec.parentStartAge,
            endAge: inputs.targetRetirementAge,
            growthRate: 0.03,
            isTaxable: true,
            amount: rec.peakCost,
            salaryIncrease: rec.peakCost,
            incomeChangeType: 'increaseByAmount',
            permanent: true,
            parentEventId: rec.childEventId
          };
          clonedInputs.incomeList = [...(clonedInputs.incomeList || []), promoEvent];
          const boostResults = runFireSimulation(clonedInputs);
          
          list.push({
            type: `childPromotion-${rec.childEventId}`,
            icon: '🟦',
            title: 'Get a Promotion',
            details: `Increase your income by $${rec.peakCost}/year permanently.`,
            readyAge: boostResults.retirementReadyAge || 65,
            promoEvent: promoEvent,
            savingsFocus: 'Earn More',
            savingsEffortScore: 2
          });
        });
        
        return { rankedPlan: list };
      }, [inputs]);

      const handleApplyMobileRecommendation = (scenario) => {
        let newInputs = JSON.parse(JSON.stringify(inputs));
        if (scenario.type.startsWith('childPromotion') && scenario.promoEvent) {
          newInputs.incomeList = [...(newInputs.incomeList || []), scenario.promoEvent];
        }
        setInputs(newInputs);
      };

      return (
        <MobileFireSimulator
          inputs={inputs}
          improvementPlan={improvementPlan}
          updateInput={vi.fn()}
          displayMode="deflated"
          setDisplayMode={vi.fn()}
          activeResults={activeRes}
          displayedResults={activeRes}
          selectedYear={35}
          setSelectedYear={vi.fn()}
          chartData={[]}
          validation={{}}
          handleCreateEvent={vi.fn()}
          handleEditRoadmapEvent={vi.fn()}
          handleSetBudgetClick={vi.fn()}
          handleOpenSavingsDetails={vi.fn()}
          isMobile={true}
          totalNetWorth={100000}
          activeStep={2}
          setActiveStep={vi.fn()}
          timelineEvents={[]}
          editingEvent={null}
          setEditingEvent={vi.fn()}
          handleSaveEvent={vi.fn()}
          handleDeleteEvent={vi.fn()}
          getInputsWithEvent={vi.fn()}
          displayedBaselineResults={activeRes}
          baselineResults={activeRes}
          handleApplyMobileRecommendation={handleApplyMobileRecommendation}
          improvementPlan={improvementPlan}
        />
      );
    };

    const { rerender } = render(<Wrapper initialInputs={defaultInputs} />);
    fireEvent.click(screen.getByRole('button', { name: /^Plan$/i }));

    // Default inputs on track: no recommendations panel should be rendered
    expect(screen.queryByText('💡 Actionable Recommendations')).toBeNull();

    // 2. Render with a child event added (which causes a shortfall)
    const childInputs = {
      ...defaultInputs,
      lifeEvents: [
        ...(defaultInputs.lifeEvents || []),
        {
          id: 'child-test',
          type: 'haveChild',
          enabled: true,
          birthAge: 35,
          childStartAge: 0,
          customAges0to4: 900000,
          costMethod: 'custom',
          includeCollege: false
        }
      ]
    };

    rerender(<Wrapper initialInputs={childInputs} />);

    // Now the plan requires adjustments. Verify status message and recommendations panel
    expect(screen.getByText(/Adjustment Needed/i)).toBeDefined();
    expect(screen.getByText(/Recommendation details available/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /View Suggestions/i }));
    
    expect(screen.getByText('Get a Promotion', { exact: false })).toBeDefined();

    // 3. Click "Apply Recommendation" button on the card
    const applyBtn = screen.getByRole('button', { name: 'Apply Recommendation' });
    fireEvent.click(applyBtn);

    // 4. Verifying recommendation applied:
    // When applied, incomeList has the child income boost added, which offsets the costs,
    // making the plan on track again, and the banner disappears.
    expect(screen.queryByText(/Recommendation details available/i)).toBeNull();
    expect(screen.getAllByText(/On Track/i).length).toBeGreaterThan(0);
  });

  describe('Refactored Wizard Split - Specific Scenarios & Verification', () => {
    // Helper to select an event type and navigate to Step 4
    const navigateToStep4 = (itemLabel) => {
      let btn = screen.queryByText(itemLabel);
      if (!btn) {
        const showMoreBtn = screen.queryByText('Show More ↓');
        if (showMoreBtn) {
          fireEvent.click(showMoreBtn);
        }
        btn = screen.getByText(itemLabel);
      }
      fireEvent.click(btn);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    };

    test('1. Wizard shell opens/closes', () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      const onClose = vi.fn();
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'selectType', isNew: true }}
          onClose={onClose}
          setEditingEvent={vi.fn()}
        />
      );
      expect(screen.getByText('What would you like to plan?')).toBeDefined();
      const closeBtn = screen.getAllByRole('button')[0];
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });

    test('2. Event type selection still works', () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      const setEditingEvent = vi.fn();
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'selectType', isNew: true }}
          setEditingEvent={setEditingEvent}
        />
      );
      const houseBtn = screen.getByText('Home Purchase');
      fireEvent.click(houseBtn);
      expect(screen.getByText('When does this happen?')).toBeDefined();
    });

    test('3. Buy house inputs still update draft event', () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'selectType', isNew: true }}
          setEditingEvent={vi.fn()}
          getInputsWithEvent={vi.fn().mockReturnValue({ newInputs: inputs })}
          baselineResults={runFireSimulation(inputs)}
        />
      );
      navigateToStep4('Home Purchase');
      const priceInput = screen.getByPlaceholderText('e.g. 500000') || screen.getByRole('spinbutton');
      fireEvent.change(priceInput, { target: { value: '600000' } });
      expect(priceInput.value).toBe('600000');
    });

    test.skip('4. Child inputs still update draft event', () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'selectType', isNew: true }}
          setEditingEvent={vi.fn()}
        />
      );
      navigateToStep4('Child / Adoption');
      const childNameInput = screen.getByPlaceholderText('Child name');
      fireEvent.change(childNameInput, { target: { value: 'Tommy' } });
      expect(childNameInput.value).toBe('Tommy');
    });

    test.skip('5. Marriage inputs still update draft event', () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'selectType', isNew: true }}
          setEditingEvent={vi.fn()}
        />
      );
      navigateToStep4('Marriage / Partner');
      const spouseIncomeInput = screen.getByPlaceholderText('e.g. 80000');
      fireEvent.change(spouseIncomeInput, { target: { value: '90000' } });
      expect(spouseIncomeInput.value).toBe('90000');
    });

    test('6. Debt inputs still update draft event', () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'selectType', isNew: true }}
          setEditingEvent={vi.fn()}
        />
      );
      navigateToStep4('Student Loan');
      const balanceInput = screen.getByPlaceholderText('e.g. 20000');
      fireEvent.change(balanceInput, { target: { value: '25000' } });
      expect(balanceInput.value).toBe('25000');
    });

    test.skip('7. Recommendation step renders child promotion/offset recommendations', async () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      const handleSaveEvent = vi.fn();
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'haveChild', birthAge: 32, childName: 'Jane', isNew: true }}
          setEditingEvent={vi.fn()}
          handleSaveEvent={handleSaveEvent}
          handleDeleteEvent={vi.fn()}
          onClose={vi.fn()}
          getInputsWithEvent={(inps, evt) => {
            const copyEvt = { ...evt, id: 'jane-child-event', originalId: 'jane-child-event', enabled: true };
            return { newInputs: { ...inps, lifeEvents: [copyEvt] }, savedEvent: copyEvt };
          }}
          baselineResults={{ retirementReadyAge: 63 }}
          improvementPlan={{ rankedPlan: [] }}
        />
      );
      const childBtn = screen.getByText('Child / Adoption');
      fireEvent.click(childBtn);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(screen.getByText('👶 Child Added to Timeline!')).toBeDefined();
      expect(screen.getByText('Get a Promotion', { exact: false })).toBeDefined();
    });

    test.skip('8. Applying a mobile recommendation calls the shared recommendation path', async () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      const handleApplyMobileRecommendation = vi.fn();
      const handleSaveEvent = vi.fn();
      const onClose = vi.fn();
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'haveChild', birthAge: 32, childName: 'Jane', isNew: true }}
          setEditingEvent={vi.fn()}
          handleSaveEvent={handleSaveEvent}
          handleDeleteEvent={vi.fn()}
          onClose={onClose}
          getInputsWithEvent={(inps, evt) => {
            const copyEvt = { ...evt, id: 'jane-child-event', originalId: 'jane-child-event', enabled: true };
            return { newInputs: { ...inps, lifeEvents: [copyEvt] }, savedEvent: copyEvt };
          }}
          baselineResults={{ retirementReadyAge: 63 }}
          handleApplyMobileRecommendation={handleApplyMobileRecommendation}
          improvementPlan={{ rankedPlan: [] }}
        />
      );
      const childBtn = screen.getByText('Child / Adoption');
      fireEvent.click(childBtn);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await new Promise(resolve => setTimeout(resolve, 150));
      const applyBtn = screen.getAllByRole('button', { name: 'Apply Adjustment' })[0];
      fireEvent.click(applyBtn);
      expect(handleApplyMobileRecommendation).toHaveBeenCalled();
    });

    test('9. Review step save calls the shared event save path', () => {
      const onConfirm = vi.fn();
      render(
        <ReviewStep
          step={6}
          draftEvent={{ type: 'haveChild', childName: 'Tommy' }}
          inputs={{}}
          isNew={true}
          hasEndAge={false}
          startAgeVal={35}
          endAgeVal={40}
          primaryCta="Add to Plan"
          onConfirm={onConfirm}
          onEdit={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />
      );
      const saveBtn = screen.getByRole('button', { name: 'Add to Plan' });
      fireEvent.click(saveBtn);
      expect(onConfirm).toHaveBeenCalled();
    });

    test('10. Delete action calls the shared event delete path', () => {
      const onDelete = vi.fn();
      const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
      render(
        <ReviewStep
          step={8}
          draftEvent={{ type: 'haveChild', childName: 'Jane' }}
          inputs={{}}
          isNew={false}
          hasEndAge={false}
          startAgeVal={35}
          endAgeVal={40}
          primaryCta="Save Changes"
          onConfirm={vi.fn()}
          onEdit={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={onDelete}
          onClose={vi.fn()}
        />
      );
      const deleteBtn = screen.getByText('Delete Event');
      fireEvent.click(deleteBtn);
      expect(confirmSpy).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    test('12. Life Decision picker displays primary options by default and toggles advanced options with Show More/Less', () => {
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      render(
        <MobileEventWizard
          inputs={inputs}
          editingEvent={{ type: 'selectType', isNew: true }}
          setEditingEvent={vi.fn()}
          handleSaveEvent={vi.fn()}
          handleDeleteEvent={vi.fn()}
          onClose={vi.fn()}
          getInputsWithEvent={vi.fn()}
          baselineResults={null}
        />
      );

      // Verify primary events are visible
      expect(screen.getByText('Marriage / Partner')).toBeDefined();
      expect(screen.getByText('Home Purchase')).toBeDefined();
      expect(screen.getByText('Child / Adoption')).toBeDefined();

      // Verify advanced events are NOT visible by default
      expect(screen.queryByText(/Stop Working/i)).toBeNull();
      expect(screen.queryByText(/Social Security/i)).toBeNull();
      expect(screen.queryByText(/Pension Inflow/i)).toBeNull();

      // Verify Show More button is visible
      const toggleBtn = screen.getByText('Show More ↓');
      expect(toggleBtn).toBeDefined();

      // Click Show More
      fireEvent.click(toggleBtn);

      // Now advanced events should be visible
      expect(screen.getByText(/Stop Working/i)).toBeDefined();
      expect(screen.getByText(/Social Security/i)).toBeDefined();
      expect(screen.getByText(/Pension Inflow/i)).toBeDefined();
      expect(screen.getByText('Show Less ↑')).toBeDefined();

      // Click Show Less
      fireEvent.click(screen.getByText('Show Less ↑'));

      // Advanced events should be hidden again
      expect(screen.queryByText(/Stop Working/i)).toBeNull();
      expect(screen.queryByText(/Social Security/i)).toBeNull();
      expect(screen.queryByText(/Pension Inflow/i)).toBeNull();
      expect(screen.getByText('Show More ↓')).toBeDefined();

      // Verify search reveals advanced events directly without Show More
      const searchInput = screen.getByPlaceholderText('Search events...');
      fireEvent.change(searchInput, { target: { value: 'pension' } });

      // Displays Pension Inflow directly
      expect(screen.getByText('Pension Inflow')).toBeDefined();
      // Show More / Less button should not be displayed
      expect(screen.queryByText('Show More ↓')).toBeNull();
      expect(screen.queryByText('Show Less ↑')).toBeNull();
    });
  });
});

