// @vitest-environment jsdom
import { renderHook, act, cleanup, render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useScenarioState } from './src/features/fire/state/useScenarioState.js';
import { useTimelineEvents } from './src/hooks/useTimelineEvents.js';
import { deriveTimelineStage } from './src/calculators/fire/pipeline/deriveTimeline.js';
import { normalizeInputsStage } from './src/calculators/fire/pipeline/normalizeInputs.js';
import { useEventEditingController } from './src/features/fire/events/useEventEditingController.js';
import { getDefaultEvent } from './src/features/fire/events/eventDefaults.js';
import EventModalForm from './src/components/fire-simulator/EventModalForm/EventModalForm.jsx';

describe('Social Security Milestone Behavior Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // 1. Dragging Social Security updates claiming age and clamps it between 62 and 70
  test('Dragging Social Security updates claiming age and clamps between 62 and 70', () => {
    const { result } = renderHook(() => useScenarioState());
    
    // Add socialSecurity event to baseline scenario
    act(() => {
      result.current.setScenarios(prev => prev.map(scen => {
        if (scen.id !== 'baseline') return scen;
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            lifeEvents: [
              ...(scen.inputs.lifeEvents || []),
              {
                id: 'ss-1',
                type: 'socialSecurity',
                claimingAge: 67,
                age: 67,
                enabled: true
              }
            ],
            socialSecurity: {
              claimingAge: 67,
              enabled: true
            }
          }
        };
      }));
    });

    // Verify initial claimingAge is 67
    let baseline = result.current.scenarios.find(s => s.id === 'baseline');
    let ssEv = baseline.inputs.lifeEvents.find(e => e.type === 'socialSecurity');
    expect(ssEv.claimingAge).toBe(67);

    // 1a. Drag to age 60 (clamps to 62)
    act(() => {
      const ssEvent = result.current.scenarios.find(s => s.id === 'baseline').inputs.lifeEvents.find(e => e.type === 'socialSecurity');
      result.current.commitEventAgeChange(ssEvent, 60, 'baseline');
    });
    
    baseline = result.current.scenarios.find(s => s.id === 'baseline');
    ssEv = baseline.inputs.lifeEvents.find(e => e.type === 'socialSecurity');
    expect(ssEv.claimingAge).toBe(62);
    expect(baseline.inputs.socialSecurity.claimingAge).toBe(62);

    // 1b. Drag to age 75 (clamps to 70)
    act(() => {
      const ssEvent = result.current.scenarios.find(s => s.id === 'baseline').inputs.lifeEvents.find(e => e.type === 'socialSecurity');
      result.current.commitEventAgeChange(ssEvent, 75, 'baseline');
    });

    baseline = result.current.scenarios.find(s => s.id === 'baseline');
    ssEv = baseline.inputs.lifeEvents.find(e => e.type === 'socialSecurity');
    expect(ssEv.claimingAge).toBe(70);
    expect(baseline.inputs.socialSecurity.claimingAge).toBe(70);

    // 1c. Drag to age 66 (sets to 66)
    act(() => {
      const ssEvent = result.current.scenarios.find(s => s.id === 'baseline').inputs.lifeEvents.find(e => e.type === 'socialSecurity');
      result.current.commitEventAgeChange(ssEvent, 66, 'baseline');
    });

    baseline = result.current.scenarios.find(s => s.id === 'baseline');
    ssEv = baseline.inputs.lifeEvents.find(e => e.type === 'socialSecurity');
    expect(ssEv.claimingAge).toBe(66);
    expect(baseline.inputs.socialSecurity.claimingAge).toBe(66);
  });

  // 2. Removing Social Security hides the marker and sets benefits to $0
  test('Removing Social Security hides the marker and sets benefits to $0', () => {
    const inputs = {
      currentAge: 35,
      lifeExpectancy: 85,
      includeSocialSecurity: false, // removed/disabled
      incomeList: [],
      householdMembers: [],
      spendingPhases: [],
      socialSecurity: {
        claimingAge: 67,
        monthlyBenefit: 2000,
        enabled: false
      },
      lifeEvents: [
        {
          id: 'ss-1',
          type: 'socialSecurity',
          claimingAge: 67,
          age: 67,
          enabled: false
        }
      ]
    };

    // Verify timeline events does NOT include Social Security
    const { result } = renderHook(() => useTimelineEvents(inputs, {}));
    const timelineEvents = result.current;
    const hasSSMarker = timelineEvents.some(e => e.type === 'socialSecurity');
    expect(hasSSMarker).toBe(false);

    // Verify deriveTimelineStage returns $0 benefits
    const results = deriveTimelineStage(inputs);
    expect(results.socialSecurityDetails.monthlyBenefit).toBe(0);
    expect(results.socialSecurityDetails.annualBenefit).toBe(0);
  });

  // 3. Removing and re-adding preserves prior configuration (AIME, earnings, overrides, spouse settings)
  test('Removing and re-adding preserves prior config (AIME, earnings, manual overrides, spouse)', () => {
    // Initial state with customized Social Security config
    const initialInputs = {
      currentAge: 35,
      lifeExpectancy: 85,
      includeSocialSecurity: true,
      socialSecurity: {
        claimingAge: 65,
        monthlyBenefit: 2500, // custom manual override
        useEarnings: false, // manual benefit override
        enabled: true,
        firstBendPoint: 1200, // custom AIME bend points
        secondBendPoint: 7500,
        earningsRecord: [50000, 60000, 70000] // custom earnings record data
      },
      householdMembers: [
        {
          id: 'spouse',
          currentAge: 35,
          spouseSocialSecurityAge: 68, // custom spouse age
          spouseEstimatedSocialSecurityBenefit: 1800 // custom spouse benefit
        }
      ],
      lifeEvents: [
        {
          id: 'ss-1',
          type: 'socialSecurity',
          claimingAge: 65,
          age: 65,
          monthlyBenefit: 2500,
          useEarnings: false,
          enabled: true
        }
      ]
    };

    // Step 1: Remove Social Security (sets includeSocialSecurity = false, enabled = false)
    const nextInputs = { ...initialInputs };
    nextInputs.includeSocialSecurity = false;
    nextInputs.socialSecurity = {
      ...nextInputs.socialSecurity,
      enabled: false
    };
    nextInputs.lifeEvents = nextInputs.lifeEvents.map(e =>
      e.type === 'socialSecurity' ? { ...e, enabled: false } : e
    );

    // Assert that the customized config fields are NOT deleted/cleared
    expect(nextInputs.socialSecurity.claimingAge).toBe(65);
    expect(nextInputs.socialSecurity.monthlyBenefit).toBe(2500);
    expect(nextInputs.socialSecurity.useEarnings).toBe(false);
    expect(nextInputs.socialSecurity.earningsRecord).toEqual([50000, 60000, 70000]);
    expect(nextInputs.householdMembers[0].spouseSocialSecurityAge).toBe(68);
    expect(nextInputs.householdMembers[0].spouseEstimatedSocialSecurityBenefit).toBe(1800);

    // Step 2: Re-add Social Security via hook/controller.
    // Set up a mock scenarios state
    let scenariosState = [
      {
        id: 'baseline',
        inputs: nextInputs
      }
    ];
    const setScenariosMock = vi.fn((updater) => {
      scenariosState = updater(scenariosState);
    });

    const editingEventState = { value: null };
    const setEditingEventMock = vi.fn((val) => {
      editingEventState.value = val;
    });

    const { result } = renderHook(() => useEventEditingController({
      scenarios: scenariosState,
      setScenarios: setScenariosMock,
      currentScenarioId: 'baseline',
      inputs: nextInputs,
      updateInput: vi.fn(),
      setEditingEvent: setEditingEventMock
    }));

    // Trigger handleCreateEvent for socialSecurity
    act(() => {
      result.current.handleCreateEvent('socialSecurity');
    });

    // Check that scenarios inputs are updated back to includeSocialSecurity = true
    const updatedInputs = scenariosState[0].inputs;
    expect(updatedInputs.includeSocialSecurity).toBe(true);
    expect(updatedInputs.socialSecurity.enabled).toBe(true);
    expect(updatedInputs.lifeEvents.find(e => e.type === 'socialSecurity').enabled).toBe(true);

    // Assert that customized details are fully preserved and restored
    expect(updatedInputs.socialSecurity.claimingAge).toBe(65);
    expect(updatedInputs.socialSecurity.monthlyBenefit).toBe(2500);
    expect(updatedInputs.socialSecurity.useEarnings).toBe(false);
    expect(updatedInputs.socialSecurity.earningsRecord).toEqual([50000, 60000, 70000]);
    expect(updatedInputs.householdMembers[0].spouseSocialSecurityAge).toBe(68);
    expect(updatedInputs.householdMembers[0].spouseEstimatedSocialSecurityBenefit).toBe(1800);

    // Verify that the editor modal is opened with the restored config
    expect(editingEventState.value).toBeDefined();
    expect(editingEventState.value.type).toBe('socialSecurity');
    expect(editingEventState.value.claimingAge).toBe(65);
  });

  // 4. Modal form claiming age validation (limits 62-70)
  test('Modal form claiming age validation prevents invalid input and clamps/warns', () => {
    const setEditingEventMock = vi.fn();
    const handleSaveEventMock = vi.fn();

    const mockEventController = {
      editingEvent: {
        type: 'socialSecurity',
        claimingAge: 71, // Invalid claiming age (above 70)
        enabled: true
      },
      setEditingEvent: setEditingEventMock,
      handleSaveEvent: handleSaveEventMock,
      handleDeleteEvent: vi.fn()
    };

    const inputs = {
      currentAge: 35,
      lifeExpectancy: 85,
      inflationRate: 3,
      incomeList: [],
      householdMembers: [],
      spendingPhases: []
    };

    // Render the form modal with claimingAge = 71
    const { rerender } = render(
      <EventModalForm
        inputs={inputs}
        eventController={mockEventController}
      />
    );

    // Verify warning is displayed
    expect(screen.getByText(/Social Security can only be taken between 62-70/i)).toBeDefined();

    // Verify Save button is disabled
    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    expect(saveBtn.disabled).toBe(true);

    // Rerender with valid claimingAge = 65
    mockEventController.editingEvent.claimingAge = 65;
    rerender(
      <EventModalForm
        inputs={inputs}
        eventController={mockEventController}
      />
    );

    // Verify warning is NOT displayed
    expect(screen.queryByText(/Social Security can only be taken between 62-70/i)).toBeNull();

    // Verify Save button is enabled
    expect(saveBtn.disabled).toBe(false);
  });

  // 5. Initial Social Security calculation and ageStartedWorking default / normalization
  test('Initial Social Security calculation uses ageStartedWorking = 22, normalizes correctly, and changing it recalculates benefits', () => {
    // 5a. Missing ageStartedWorking normalizes to 22
    const rawInputs = {
      currentAge: 35,
      lifeExpectancy: 85,
      targetRetirementAge: 45,
      simpleIncome: 100000, // higher income to see differences
      includeSocialSecurity: true,
      incomeList: [],
      householdMembers: [],
      spendingPhases: [],
      socialSecurity: {
        claimingAge: 67,
        useEarnings: true,
        enabled: true
        // ageStartedWorking is missing
      },
      lifeEvents: [
        {
          id: 'ss-1',
          type: 'socialSecurity',
          claimingAge: 67,
          useEarnings: true,
          enabled: true
          // ageStartedWorking is missing
        },
        {
          id: 'retire-1',
          type: 'retire',
          age: 45,
          enabled: true
        }
      ]
    };

    // Run simulation
    const resultsInitial = deriveTimelineStage(normalizeInputsStage(rawInputs));
    const initialBenefit = resultsInitial.socialSecurityDetails.monthlyBenefit;
    expect(initialBenefit).toBeGreaterThan(0);

    // 5b. Initial benefit matches the benefit with explicit ageStartedWorking = 22
    const explicitInputs = {
      ...rawInputs,
      socialSecurity: {
        ...rawInputs.socialSecurity,
        ageStartedWorking: 22
      },
      lifeEvents: rawInputs.lifeEvents.map(e => e.type === 'socialSecurity' ? { ...e, ageStartedWorking: 22 } : e)
    };
    const resultsExplicit = deriveTimelineStage(normalizeInputsStage(explicitInputs));
    const explicit22Benefit = resultsExplicit.socialSecurityDetails.monthlyBenefit;
    expect(initialBenefit).toBe(explicit22Benefit);

    // 5c. Changing ageStartedWorking to 30 lowers/recalculates the benefit consistently
    const lateStartInputs = {
      ...rawInputs,
      socialSecurity: {
        ...rawInputs.socialSecurity,
        ageStartedWorking: 30
      },
      lifeEvents: rawInputs.lifeEvents.map(e => e.type === 'socialSecurity' ? { ...e, ageStartedWorking: 30 } : e)
    };
    const resultsLateStart = deriveTimelineStage(normalizeInputsStage(lateStartInputs));
    const lateStartBenefit = resultsLateStart.socialSecurityDetails.monthlyBenefit;
    // With ageStartedWorking = 30, they worked 8 fewer years, so the AIME and monthly benefit should be lower!
    expect(lateStartBenefit).toBeLessThan(explicit22Benefit);

    // 5d. Manual benefit mode is not overwritten by calculated mode normalization
    const manualInputs = {
      ...rawInputs,
      socialSecurity: {
        ...rawInputs.socialSecurity,
        useEarnings: false,
        monthlyBenefit: 3000
      },
      lifeEvents: rawInputs.lifeEvents.map(e => e.type === 'socialSecurity' ? { ...e, useEarnings: false, monthlyBenefit: 3000 } : e)
    };
    const resultsManual = deriveTimelineStage(normalizeInputsStage(manualInputs));
    expect(resultsManual.socialSecurityDetails.monthlyBenefit).toBe(3000); // exactly the manual override amount
  });
});
