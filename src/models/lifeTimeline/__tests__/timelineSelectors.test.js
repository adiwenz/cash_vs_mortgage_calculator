import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs.js';
import {
  getTimelineItems,
  getActiveEventsAtAge,
  getActivePeriodsAtAge
} from '../timelineSelectors.js';
import { TIMELINE_ITEM_KIND, TIMELINE_CATEGORY } from '../timelineTypes.js';

describe('timelineSelectors', () => {
  test('getTimelineItems returns current relationship status period', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeExpectancy: 85,
      filingStatus: 'single',
      useLifeProfile: false,
      lifeEvents: []
    };
    const items = getTimelineItems(inputs);
    const relStatus = items.find(item => item.category === TIMELINE_CATEGORY.RELATIONSHIP && item.kind === TIMELINE_ITEM_KIND.STATUS);
    
    expect(relStatus).toBeDefined();
    expect(relStatus.label).toBe('Single');
    expect(relStatus.startAge).toBe(35);
    expect(relStatus.endAge).toBeNull();
  });

  test('getTimelineItems returns current housing status period', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        home: { status: 'rent', monthlyRent: 1500 }
      }
    };
    const items = getTimelineItems(inputs);
    const housingStatus = items.find(item => item.category === TIMELINE_CATEGORY.HOUSING && item.kind === TIMELINE_ITEM_KIND.STATUS);
    
    expect(housingStatus).toBeDefined();
    expect(housingStatus.label).toBe('Renting');
    expect(housingStatus.startAge).toBe(35);
    expect(housingStatus.endAge).toBeNull();
  });

  test('getTimelineItems maps unknown events to point markers', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 30,
      lifeEvents: [
        { id: 'unknown-ev-1', type: 'randomEvent', name: 'My Special Day', age: 33, enabled: true }
      ]
    };
    const items = getTimelineItems(inputs);
    const pointEvent = items.find(item => item.sourceId === 'unknown-ev-1');
    
    expect(pointEvent).toBeDefined();
    expect(pointEvent.kind).toBe(TIMELINE_ITEM_KIND.POINT);
    expect(pointEvent.category).toBe(TIMELINE_CATEGORY.MAJOR_EVENT);
    expect(pointEvent.label).toBe('My Special Day');
    expect(pointEvent.age).toBe(33);
  });

  test('getTimelineItems maps income change to point marker plus income phase', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        { id: 'income-change-1', type: 'careerChange', name: 'Big Promotion', startAge: 40, amount: 80000, endAge: 65, enabled: true }
      ]
    };
    const items = getTimelineItems(inputs);
    const pointEvent = items.find(item => item.id === 'event-incomechange-point-income-change-1');
    const periodEvent = items.find(item => item.id === 'event-incomechange-period-income-change-1');

    expect(pointEvent).toBeDefined();
    expect(pointEvent.kind).toBe(TIMELINE_ITEM_KIND.POINT);
    expect(pointEvent.age).toBe(40);
    expect(pointEvent.label).toBe('Big Promotion');

    expect(periodEvent).toBeDefined();
    expect(periodEvent.kind).toBe(TIMELINE_ITEM_KIND.PERIOD);
    expect(periodEvent.startAge).toBe(40);
    expect(periodEvent.endAge).toBe(65);
    expect(periodEvent.label).toBe('Income Phase: Big Promotion');
  });

  test('getTimelineItems maps marriage to point marker plus relationship status period', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      filingStatus: 'single',
      lifeEvents: [
        { id: 'marriage-1', type: 'marriage', age: 38, enabled: true }
      ]
    };
    const items = getTimelineItems(inputs);
    const pointEvent = items.find(item => item.id === 'event-marriage-point-marriage-1');
    const marriedStatus = items.find(item => item.id === 'status-relationship-married');
    const singleStatus = items.find(item => item.id === 'status-relationship-single');

    expect(pointEvent).toBeDefined();
    expect(pointEvent.kind).toBe(TIMELINE_ITEM_KIND.POINT);
    expect(pointEvent.age).toBe(38);

    expect(marriedStatus).toBeDefined();
    expect(marriedStatus.kind).toBe(TIMELINE_ITEM_KIND.STATUS);
    expect(marriedStatus.startAge).toBe(38);
    expect(marriedStatus.endAge).toBeNull();

    expect(singleStatus).toBeDefined();
    expect(singleStatus.kind).toBe(TIMELINE_ITEM_KIND.STATUS);
    expect(singleStatus.startAge).toBe(35);
    expect(singleStatus.endAge).toBe(38);
  });

  test('getTimelineItems maps home purchase to point marker plus housing status period', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      lifeEvents: [
        { id: 'buy-house-1', type: 'buyHouse', age: 40, homePrice: 500000, downPayment: 100000, loanTerm: 30, enabled: true }
      ]
    };
    const items = getTimelineItems(inputs);
    const pointEvent = items.find(item => item.id === 'event-buyhouse-point-buy-house-1');
    const homeownerStatus = items.find(item => item.id === 'status-housing-owner');
    const mortgagePeriod = items.find(item => item.id === 'event-buyhouse-mortgage-period-buy-house-1');

    expect(pointEvent).toBeDefined();
    expect(pointEvent.kind).toBe(TIMELINE_ITEM_KIND.POINT);
    expect(pointEvent.age).toBe(40);

    expect(homeownerStatus).toBeDefined();
    expect(homeownerStatus.kind).toBe(TIMELINE_ITEM_KIND.STATUS);
    expect(homeownerStatus.startAge).toBe(40);
    expect(homeownerStatus.endAge).toBeNull();

    expect(mortgagePeriod).toBeDefined();
    expect(mortgagePeriod.kind).toBe(TIMELINE_ITEM_KIND.PERIOD);
    expect(mortgagePeriod.startAge).toBe(40);
    expect(mortgagePeriod.endAge).toBe(70); // 40 + 30
  });

  test('getActiveEventsAtAge returns exact-age point events', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        { id: 'event-1', type: 'retire', age: 60, enabled: true },
        { id: 'event-2', type: 'marriage', age: 38, enabled: true }
      ]
    };
    const activeAt38 = getActiveEventsAtAge(inputs, 38);
    expect(activeAt38.length).toBe(1);
    expect(activeAt38[0].label).toBe('Marriage');

    const activeAt60 = getActiveEventsAtAge(inputs, 60);
    expect(activeAt60.length).toBe(1);
    expect(activeAt60[0].label).toBe('Retirement');

    const activeAt40 = getActiveEventsAtAge(inputs, 40);
    expect(activeAt40.length).toBe(0);
  });

  test('getActivePeriodsAtAge includes active periods and excludes period at exclusive end age', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        { id: 'child-1', type: 'haveChild', age: 40, includeCollege: false, enabled: true }
      ]
    };

    // Child is dependent from age 40 to 58 (40 + 18)
    const activeAt40 = getActivePeriodsAtAge(inputs, 40);
    const activeAt50 = getActivePeriodsAtAge(inputs, 50);
    const activeAt58 = getActivePeriodsAtAge(inputs, 58);

    const childPeriodAt40 = activeAt40.find(p => p.id === 'event-child-dependent-period-child-1');
    const childPeriodAt50 = activeAt50.find(p => p.id === 'event-child-dependent-period-child-1');
    const childPeriodAt58 = activeAt58.find(p => p.id === 'event-child-dependent-period-child-1');

    expect(childPeriodAt40).toBeDefined();
    expect(childPeriodAt50).toBeDefined();
    expect(childPeriodAt58).toBeUndefined(); // Exclusive of endAge (58)
  });

  test('Selectors do not mutate inputs', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    Object.freeze(inputs);
    
    expect(() => getTimelineItems(inputs)).not.toThrow();
    expect(() => getActiveEventsAtAge(inputs, 40)).not.toThrow();
    expect(() => getActivePeriodsAtAge(inputs, 40)).not.toThrow();
  });

  test('getEventAge defends against inconsistent field names', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        { id: 'ev-1', type: 'marriage', marriageAge: 39, enabled: true },
        { id: 'ev-2', type: 'homePurchase', purchaseAge: 44, enabled: true },
        { id: 'ev-3', type: 'createChild', arrivalAge: 41, enabled: true },
        { id: 'ev-4', type: 'incomeChange', changeAge: 52, enabled: true },
        { id: 'ev-5', type: 'windfall', eventAge: 37, enabled: true }
      ]
    };
    
    const items = getTimelineItems(inputs);
    
    const marriagePoint = items.find(item => item.id === 'event-marriage-point-ev-1');
    expect(marriagePoint).toBeDefined();
    expect(marriagePoint.age).toBe(39);

    const homePoint = items.find(item => item.id === 'event-buyhouse-point-ev-2');
    expect(homePoint).toBeDefined();
    expect(homePoint.age).toBe(44);

    const childPoint = items.find(item => item.id === 'event-child-point-ev-3');
    expect(childPoint).toBeDefined();
    expect(childPoint.age).toBe(41);

    const incomePoint = items.find(item => item.id === 'event-incomechange-point-ev-4');
    expect(incomePoint).toBeDefined();
    expect(incomePoint.age).toBe(52);

    const windfallPoint = items.find(item => item.id === 'event-windfall-point-ev-5');
    expect(windfallPoint).toBeDefined();
    expect(windfallPoint.age).toBe(37);
  });

  test('supports type aliases like getMarried, buyHome, createChild', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        { id: 'alias-marriage', type: 'getMarried', age: 37, enabled: true },
        { id: 'alias-home', type: 'buyHome', age: 41, enabled: true },
        { id: 'alias-child', type: 'createChild', age: 39, enabled: true }
      ]
    };
    
    const items = getTimelineItems(inputs);
    
    const marriagePoint = items.find(item => item.id === 'event-marriage-point-alias-marriage');
    expect(marriagePoint).toBeDefined();
    expect(marriagePoint.age).toBe(37);

    const homePoint = items.find(item => item.id === 'event-buyhouse-point-alias-home');
    expect(homePoint).toBeDefined();
    expect(homePoint.age).toBe(41);

    const childPoint = items.find(item => item.id === 'event-child-point-alias-child');
    expect(childPoint).toBeDefined();
    expect(childPoint.age).toBe(39);
  });
});
