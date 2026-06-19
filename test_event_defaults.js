import { describe, test, expect } from 'vitest';
import { getDefaultEvent, EVENT_TYPES } from './src/features/fire/events/eventDefaults.js';

describe('Event Defaults Module', () => {
  const context = {
    inputs: {
      currentAge: 35,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      preTaxSavingsRate: 15,
      assets: {
        cash: 10000,
        brokerage: 20000
      }
    }
  };

  test('EVENT_TYPES is defined with standard event keys', () => {
    expect(EVENT_TYPES).toBeDefined();
    expect(EVENT_TYPES.BUY_HOUSE).toBe('buyHouse');
    expect(EVENT_TYPES.MARRIAGE).toBe('marriage');
  });

  test('getDefaultEvent maps and returns correct default config for buyHouse', () => {
    const desktopEvent = getDefaultEvent('buyHouse', context);
    expect(desktopEvent.type).toBe('buyHouse');
    expect(desktopEvent.purchaseAge).toBe(40);
    expect(desktopEvent.homePrice).toBe(500000);

    const mobileEvent = getDefaultEvent('buyHouse', { ...context, isMobile: true });
    expect(mobileEvent.type).toBe('buyHouse');
    expect(mobileEvent.purchaseAge).toBe(Math.min(85, context.inputs.currentAge + 5));
    expect(mobileEvent.homePrice).toBe(500000);
  });

  test('getDefaultEvent returns default config for sellHouse', () => {
    const event = getDefaultEvent('sellHouse', context);
    expect(event.type).toBe('sellHouse');
    expect(event.sellingCost).toBe(6);
  });

  test('getDefaultEvent maps and returns default config for child/haveChild', () => {
    const event1 = getDefaultEvent('child', context);
    expect(event1.type).toBe('haveChild');
    expect(event1.childName).toBe('');

    const event2 = getDefaultEvent('haveChild', { ...context, isMobile: true });
    expect(event2.type).toBe('haveChild');
    expect(event2.childName).toBe('Child');
  });

  test('getDefaultEvent returns default config for marriage', () => {
    const desktopEvent = getDefaultEvent('marriage', context);
    expect(desktopEvent.type).toBe('marriage');
    expect(desktopEvent.investments).toBe(30000); // 10000 cash + 20000 brokerage
    expect(desktopEvent.includeWeddingCost).toBe(true);

    const mobileEvent = getDefaultEvent('marriage', { ...context, isMobile: true });
    expect(mobileEvent.type).toBe('marriage');
    expect(mobileEvent.investments).toBe(0);
    expect(mobileEvent.includeWeddingCost).toBe(false);
  });

  test('getDefaultEvent returns default config for careerChange', () => {
    const event = getDefaultEvent('careerChange', context);
    expect(event.type).toBe('careerChange');
    expect(event.amount).toBe(150000);
  });

  test('getDefaultEvent returns default config for debt/borrowing types', () => {
    const event1 = getDefaultEvent('debt', context);
    expect(event1.type).toBe('borrowing');
    expect(event1.borrowingType).toBe('studentLoan');

    const event2 = getDefaultEvent('studentLoan', context);
    expect(event2.type).toBe('borrowing');
    expect(event2.borrowingType).toBe('studentLoan');
    expect(event2.balance).toBe(30000);
  });

  test('getDefaultEvent returns default config for college', () => {
    const event = getDefaultEvent('college', context);
    expect(event.type).toBe('college');
    expect(event.tuitionCost).toBe(30000);
  });

  test('getDefaultEvent returns default config for retirement/workOptional', () => {
    const event1 = getDefaultEvent('retirement', context);
    expect(event1.type).toBe('retire');
    expect(event1.spendingPercent).toBe(70);

    const event2 = getDefaultEvent('workOptional', context);
    expect(event2.type).toBe('retire');
  });

  test('getDefaultEvent returns default config for move', () => {
    const event = getDefaultEvent('move', context);
    expect(event.type).toBe('move');
    expect(event.newSpending).toBe(40000);
  });

  test('getDefaultEvent returns default config for custom/generic', () => {
    const event1 = getDefaultEvent('generic', context);
    expect(event1.type).toBe('custom');
    expect(event1.name).toBe('Custom Event');

    const event2 = getDefaultEvent('custom', { ...context, isMobile: true });
    expect(event2.type).toBe('custom');
    expect(event2.name).toBe('Custom Goal');
  });
});
