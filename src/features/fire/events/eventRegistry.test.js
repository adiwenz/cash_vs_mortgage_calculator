import { describe, test, expect } from 'vitest';
import {
  getCanonicalEventType,
  getEventDefinition,
  getEventLabel,
  getEventShortLabel,
  getEventEmoji,
  getEventTimelineCategory,
  isEventDraggable,
  isEventEditable,
  isChildEvent,
  isHousingEvent
} from './index';

describe('Event Registry & Helpers', () => {
  test('aliases resolve correctly', () => {
    // Child aliases
    expect(getCanonicalEventType('child')).toBe('haveChild');
    expect(getCanonicalEventType('createChild')).toBe('haveChild');
    expect(getCanonicalEventType('haveChild')).toBe('haveChild');

    // Housing aliases
    expect(getCanonicalEventType('housePurchase')).toBe('buyHouse');
    expect(getCanonicalEventType('housing')).toBe('buyHouse');
    expect(getCanonicalEventType('buyHouse')).toBe('buyHouse');

    // Retirement aliases
    expect(getCanonicalEventType('retirement')).toBe('retire');
    expect(getCanonicalEventType('retire')).toBe('retire');

    // Career change aliases
    expect(getCanonicalEventType('career')).toBe('careerChange');
    expect(getCanonicalEventType('careerChange')).toBe('careerChange');

    // Payoff aliases
    expect(getCanonicalEventType('payoff')).toBe('debtPayoff');
    expect(getCanonicalEventType('debtPayoff')).toBe('debtPayoff');

    // Expense aliases
    expect(getCanonicalEventType('lifestyle')).toBe('expenseChange');
    expect(getCanonicalEventType('spendingChange')).toBe('expenseChange');
    expect(getCanonicalEventType('expenseChange')).toBe('expenseChange');

    // Non-aliased types return themselves
    expect(getCanonicalEventType('someRandomType')).toBe('someRandomType');
  });

  test('child aliases classify as child events', () => {
    expect(isChildEvent({ type: 'child' })).toBe(true);
    expect(isChildEvent({ type: 'createChild' })).toBe(true);
    expect(isChildEvent({ type: 'haveChild' })).toBe(true);

    // Other events should not classify as child
    expect(isChildEvent({ type: 'marriage' })).toBe(false);
  });

  test('housing aliases classify as housing events', () => {
    expect(isHousingEvent({ type: 'buyHouse' })).toBe(true);
    expect(isHousingEvent({ type: 'housePurchase' })).toBe(true);
    expect(isHousingEvent({ type: 'housing' })).toBe(true);
    expect(isHousingEvent({ type: 'move' })).toBe(true);
    expect(isHousingEvent({ type: 'sellHouse' })).toBe(true);
    expect(isHousingEvent({ type: 'mortgageOff' })).toBe(true);

    // Other events should not classify as housing
    expect(isHousingEvent({ type: 'socialSecurity' })).toBe(false);
  });

  test('unknown events use safe fallback', () => {
    const unknownType = 'customCrazyEvent';
    const def = getEventDefinition(unknownType);

    expect(def.category).toBe('other');
    expect(def.timelineCategory).toBe('events');
    expect(def.isEditable).toBe(true);
    expect(def.isDraggable).toBe(true);
    expect(def.emoji).toBe('❓');

    const mockEvent = { type: unknownType };
    expect(getEventTimelineCategory(mockEvent)).toBe('events');
    expect(isEventDraggable(mockEvent)).toBe(true);
    expect(isEventEditable(mockEvent)).toBe(true);
    expect(getEventEmoji(mockEvent)).toBe('❓'); // fallback emoji from definition
  });

  test('event labels prefer event.name/title/label where applicable', () => {
    const marriageDef = { type: 'marriage' };
    
    // Default fallback from registry
    expect(getEventLabel(marriageDef)).toBe('Marriage');

    // Prefer label
    expect(getEventLabel({ ...marriageDef, label: 'Custom Label' })).toBe('Custom Label');

    // Prefer title over label
    expect(getEventLabel({ ...marriageDef, label: 'Custom Label', title: 'Custom Title' })).toBe('Custom Title');

    // Prefer name over title
    expect(getEventLabel({ ...marriageDef, label: 'Custom Label', title: 'Custom Title', name: 'Custom Name' })).toBe('Custom Name');
  });

  test('registry helpers do not mutate events', () => {
    const testEvent = Object.freeze({
      type: 'child',
      label: 'Have Child: Tommy'
    });

    // Calling helpers on frozen object should not throw (which means they don't try to mutate it)
    expect(() => {
      getCanonicalEventType(testEvent.type);
      getEventDefinition(testEvent.type);
      getEventLabel(testEvent);
      getEventShortLabel(testEvent);
      getEventEmoji(testEvent);
      getEventTimelineCategory(testEvent);
      isEventDraggable(testEvent);
      isEventEditable(testEvent);
      isChildEvent(testEvent);
    }).not.toThrow();

    // Verify it returns expected outputs without changing object
    expect(getEventShortLabel(testEvent)).toBe('Tommy');
  });

  test('getEventEmoji precedence rules', () => {
    // 1. Canonical special-case icon
    expect(getEventEmoji({ type: 'retirementReadyComfortable', icon: '🎉', emoji: '🌟' })).toBe('✓');
    expect(getEventEmoji({ type: 'socialSecurity', icon: '💰', emoji: '💵' })).toBe('🎂');
    expect(getEventEmoji({ type: 'promotion', icon: '💼', emoji: '💸' })).toBe('📈');
    expect(getEventEmoji({ type: 'retirement', icon: '⭐', emoji: '🏖️' })).toBe('🏖');

    // 2. event.emoji
    expect(getEventEmoji({ type: 'buyHouse', emoji: '🏠', icon: '🏡' })).toBe('🏠');
    expect(getEventEmoji({ type: 'customType', emoji: '🎸', icon: '🎺' })).toBe('🎸');

    // 3. event.icon
    expect(getEventEmoji({ type: 'buyHouse', icon: '🏡' })).toBe('🏡');
    expect(getEventEmoji({ type: 'customType', icon: '🎺' })).toBe('🎺');

    // 4. Registry default emoji
    expect(getEventEmoji({ type: 'buyHouse' })).toBe('🏠');

    // 5. Fallback emoji
    expect(getEventEmoji({ type: 'unknownCrazyEvent' })).toBe('❓');
  });
});
