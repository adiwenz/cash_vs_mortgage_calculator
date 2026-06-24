// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { useTimelineEvents } from './src/hooks/useTimelineEvents.js';
import { runFireSimulation } from './src/fireCalculations.js';

describe('Timeline regression test', () => {
  test('currentAge = 35 vs 40 and timelineEvents validation', () => {
    // 1. age = 35 with lifeProfile
    const inputs35 = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeExpectancy: 85,
      targetRetirementAge: 65,
      useLifeProfile: true,
      lifeProfile: {
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
        home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
        children: [],
        debts: [],
        assets: { cash: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, crypto: 0, businessEquity: 0 },
        incomeSources: []
      }
    };
    const results35 = runFireSimulation(inputs35);
    const mockDisplayedResults35 = {
      nominalData: results35.nominalData,
      deflatedData: results35.deflatedData,
      incomeList: inputs35.incomeList,
      spendingPhases: inputs35.spendingPhases,
      ...results35,
    };

    const { result: result35 } = renderHook(() => useTimelineEvents(inputs35, mockDisplayedResults35));
    const events35 = result35.current;
    console.log('Age 35 events count:', events35.length);

    expect(events35.length).toBeGreaterThan(0);

    // 2. age = 40 with lifeProfile
    const inputs40 = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 40,
      lifeExpectancy: 85,
      targetRetirementAge: 65,
      useLifeProfile: true,
      lifeProfile: {
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
        home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
        children: [],
        debts: [],
        assets: { cash: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, crypto: 0, businessEquity: 0 },
        incomeSources: []
      }
    };
    const results40 = runFireSimulation(inputs40);
    const mockDisplayedResults40 = {
      nominalData: results40.nominalData,
      deflatedData: results40.deflatedData,
      incomeList: inputs40.incomeList,
      spendingPhases: inputs40.spendingPhases,
      ...results40,
    };

    const { result: result40 } = renderHook(() => useTimelineEvents(inputs40, mockDisplayedResults40));
    const events40 = result40.current;
    console.log('Age 40 events count:', events40.length);

    expect(events40.length).toBeGreaterThan(0);
  });

  test('getTimelineProjection validation with currentAge = 40', () => {
    const { getTimelineProjection } = require('./src/models/lifeTimeline/timelineProjectionSelectors.js');

    // 1. With currentAge = 40, selectedAge = 40
    const inputs40 = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 40,
      lifeExpectancy: 85,
      targetRetirementAge: 65,
      useLifeProfile: true,
      lifeProfile: {
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
        home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
        children: [],
        debts: [],
        assets: { cash: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, crypto: 0, businessEquity: 0 },
        incomeSources: []
      }
    };

    const { getTimelineItems } = require('./src/models/lifeTimeline/timelineSelectors.js');
    const items = getTimelineItems(inputs40);
    console.log('Timeline items with currentAge=40:', items.map(item => ({
      id: item.id,
      category: item.category,
      kind: item.kind,
      age: item.age,
      startAge: item.startAge,
      endAge: item.endAge
    })));

    const projection = getTimelineProjection(inputs40, { selectedAge: 40 });
    console.log('Projection with selectedAge=40:', {
      currentAge: projection.currentAge,
      minAge: projection.minAge,
      maxAge: projection.maxAge,
      selectedAge: projection.selectedAge
    });

    expect(projection.minAge).toBe(40);
    expect(projection.maxAge).toBe(85);
    expect(projection.selectedAge).toBe(40);

    // 2. Validate inputs
    const { buildEffectiveSimulationInputs } = require('./src/calculators/fire/effectiveInputs.js');
    const { validateFireInputs } = require('./src/calculators/fire/normalizeInputs.js');
    const effectiveInputs = buildEffectiveSimulationInputs(inputs40);
    const validation = validateFireInputs(effectiveInputs);
    console.log('Validation results for currentAge = 40:', validation);
    expect(validation.errors).toEqual([]);

    // 3. With currentAge = 40, selectedAge = 35 (like when it is not updated in state)
    const projection35 = getTimelineProjection(inputs40, { selectedAge: 35 });
    console.log('Projection with selectedAge=35:', {
      currentAge: projection35.currentAge,
      minAge: projection35.minAge,
      maxAge: projection35.maxAge,
      selectedAge: projection35.selectedAge
    });

    expect(projection35.minAge).toBe(40);
    expect(projection35.maxAge).toBe(85);
  });

  test('Timeline bounds never become NaN, undefined, null, or inverted', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: NaN, // Invalid age
      lifeExpectancy: undefined, // Invalid life expectancy
    };
    const { getTimelineProjection } = require('./src/models/lifeTimeline/timelineProjectionSelectors.js');
    const projection = getTimelineProjection(inputs);

    expect(projection.minAge).toBeDefined();
    expect(projection.maxAge).toBeDefined();
    expect(isNaN(projection.minAge)).toBe(false);
    expect(isNaN(projection.maxAge)).toBe(false);
    expect(projection.minAge).toBeLessThanOrEqual(projection.maxAge);
  });

  test('Current age = 40 with only past events still produces a non-empty timeline projection', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 40,
      lifeEvents: [
        {
          id: 'past-marriage',
          type: 'marriage',
          name: 'Marriage at 30',
          age: 30,
          enabled: true
        }
      ]
    };
    const { getTimelineProjection } = require('./src/models/lifeTimeline/timelineProjectionSelectors.js');
    const projection = getTimelineProjection(inputs);

    expect(projection.currentAge).toBe(40);
    expect(projection.minAge).toBe(30); // Should include the past event at 30
    expect(projection.maxAge).toBe(85);
    expect(projection.rows.length).toBe(8);
  });
});
