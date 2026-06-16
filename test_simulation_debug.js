import { describe, test, expect } from 'vitest';
import { runFireSimulation, getProfileFromInputs, getEventsFromInputs, buildSimulationDebugSnapshot } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('buildSimulationDebugSnapshot', () => {
  test('Debug snapshot includes raw inputs, normalized inputs, events, timeline, and final result', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 80000,
      lifeEvents: [
        {
          id: 'ss-1',
          type: 'socialSecurity',
          name: 'Social Security',
          enabled: true,
          claimingAge: 67,
          monthlyBenefit: 2000,
          inflationAdjusted: true
        },
        {
          id: 'retire-1',
          type: 'retire',
          name: 'Retirement',
          enabled: true,
          age: 65,
          spendingPercent: 70
        }
      ]
    };

    const normalizedInputs = getProfileFromInputs(inputs);
    const events = getEventsFromInputs(inputs);
    const results = runFireSimulation(inputs);
    const yearlyTimeline = results.nominalData;

    const snapshot = buildSimulationDebugSnapshot(inputs, normalizedInputs, events, results, yearlyTimeline);

    // 1. Verify raw inputs and normalized inputs are present
    expect(snapshot.rawInputs).toBeDefined();
    expect(snapshot.rawInputs.currentAge).toBe(35);
    expect(snapshot.normalizedInputs).toBeDefined();
    expect(snapshot.normalizedInputs.currentAge).toBe(35);

    // 2. Verify events appear in raw and normalized forms
    expect(snapshot.events).toBeDefined();
    expect(snapshot.events.rawEvents).toBeDefined();
    expect(snapshot.events.rawEvents.length).toBeGreaterThan(0);
    expect(snapshot.events.normalizedEvents).toBeDefined();
    expect(snapshot.events.normalizedEvents.length).toBeGreaterThan(0);
    const ssEvent = snapshot.events.normalizedEvents.find(e => e.type === 'socialSecurity');
    expect(ssEvent).toBeDefined();
    expect(ssEvent.startAge).toBe(67);

    // 3. Verify year-by-year timeline includes age, year, grossIncome, expenses, contributions, assetBalance, debtBalance, and net worth
    expect(snapshot.yearlyTimeline).toBeDefined();
    expect(snapshot.yearlyTimeline.length).toBeGreaterThan(0);
    const firstYear = snapshot.yearlyTimeline[0];
    expect(firstYear.age).toBe(35);
    expect(firstYear.year).toBeDefined();
    expect(firstYear.grossIncome).toBeDefined();
    expect(firstYear.expenses).toBeDefined();
    expect(firstYear.contributions).toBeDefined();
    expect(firstYear.withdrawals).toBeDefined();
    expect(firstYear.investmentGrowth).toBeDefined();
    expect(firstYear.debtBalance).toBeDefined();
    expect(firstYear.assetBalance).toBeDefined();
    expect(firstYear.netWorth).toBeDefined();

    // 4. Verify download JSON produces valid JSON pretty printed with 2 spaces
    const prettyJson = JSON.stringify(snapshot, null, 2);
    expect(() => JSON.parse(prettyJson)).not.toThrow();
    expect(prettyJson).toContain('  "rawInputs"');
  });
});
