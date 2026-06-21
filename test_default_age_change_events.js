// @vitest-environment jsdom
import { renderHook, cleanup } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { normalizeInputsStage } from './src/calculators/fire/pipeline/normalizeInputs.js';
import { useTimelineEvents } from './src/hooks/useTimelineEvents.js';

describe('Default Age Change Events Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  test('Simple Mode age change normalizes inc-1 and spend-1 and does not create timeline events for them', () => {
    const rawInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // Change age from 35 to 20
    rawInputs.currentAge = 20;
    rawInputs.isAdvancedMode = false;

    // Run inputs normalization
    const normalized = normalizeInputsStage(rawInputs);

    // Verify inc-1 and spend-1 start ages are updated to 20
    const inc1 = normalized.incomeList.find(i => i.id === 'inc-1');
    const spend1 = normalized.spendingPhases.find(p => p.id === 'spend-1');

    expect(inc1).toBeDefined();
    expect(inc1.startAge).toBe(20);

    expect(spend1).toBeDefined();
    expect(spend1.startAge).toBe(20);

    // Run useTimelineEvents hook to check that no events at age 35 are generated
    const mockDisplayedResults = { 
      nominalData: [],
      incomeList: normalized.incomeList,
      spendingPhases: normalized.spendingPhases
    };
    const { result } = renderHook(() => useTimelineEvents(rawInputs, mockDisplayedResults));

    const events = result.current;
    
    // There should be no career or lifestyle events at age 35 (since startAge was aligned to 20)
    const eventAt35 = events.find(e => e.age === 35 && (e.type === 'career' || e.type === 'lifestyle'));
    expect(eventAt35).toBeUndefined();
  });

  test('Advanced Mode does not mutate custom income/spending start ages when currentAge changes', () => {
    const rawInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // Set to Advanced Mode
    rawInputs.isAdvancedMode = true;
    rawInputs.currentAge = 20;

    // Add a custom career phase starting at 35
    rawInputs.incomeList = [
      {
        id: 'career-custom',
        name: 'Custom Career',
        startAge: 35,
        endAge: 60,
        amount: 80000,
        frequency: 'yearly'
      }
    ];

    // Add a custom spending phase starting at 35
    rawInputs.spendingPhases = [
      {
        id: 'spend-custom',
        name: 'Custom Spending',
        startAge: 35,
        endAge: 85,
        amount: 30000,
        frequency: 'yearly',
        annualSpending: 30000
      }
    ];

    // Run normalization
    const normalized = normalizeInputsStage(rawInputs);

    // Verify custom start ages are NOT mutated to 20
    const customInc = normalized.incomeList.find(i => i.id === 'career-custom');
    const customSpend = normalized.spendingPhases.find(p => p.id === 'spend-custom');

    expect(customInc).toBeDefined();
    expect(customInc.startAge).toBe(35);

    expect(customSpend).toBeDefined();
    expect(customSpend.startAge).toBe(35);
  });
});
