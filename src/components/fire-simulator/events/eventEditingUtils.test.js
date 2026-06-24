import { describe, test, expect } from 'vitest';
import {
  clampDragAge,
  resolveEditingEvent,
  getEventAge,
  getEventId
} from './eventEditingUtils';

describe('eventEditingUtils', () => {
  describe('clampDragAge', () => {
    test('clamps Social Security to range 62-70', () => {
      const opts = { minAge: 30, maxAge: 85 };
      expect(clampDragAge(55, 'socialSecurity', null, opts)).toBe(62);
      expect(clampDragAge(65, 'socialSecurity', null, opts)).toBe(65);
      expect(clampDragAge(75, 'socialSecurity', null, opts)).toBe(70);
    });

    test('clamps buyHouse to be at least minAge and at most sellHouse age - 1', () => {
      const lifeEvents = [
        { type: 'sellHouse', houseId: 'h1', age: 50 }
      ];
      const opts = { minAge: 35, maxAge: 85, lifeEvents };
      // Normal clamp
      expect(clampDragAge(40, 'buyHouse', 'h1', opts)).toBe(40);
      // Below minAge
      expect(clampDragAge(30, 'buyHouse', 'h1', opts)).toBe(35);
      // Above sellHouse age - 1
      expect(clampDragAge(55, 'buyHouse', 'h1', opts)).toBe(49);
      // No matching sellHouse maps to maxAge
      expect(clampDragAge(90, 'buyHouse', 'h2', opts)).toBe(85);
    });

    test('clamps sellHouse to be at least buyHouse purchaseAge + 1 and at most maxAge', () => {
      const lifeEvents = [
        { type: 'buyHouse', houseId: 'h1', purchaseAge: 40 }
      ];
      const opts = { minAge: 35, maxAge: 85, lifeEvents };
      // Normal clamp
      expect(clampDragAge(50, 'sellHouse', 'h1', opts)).toBe(50);
      // Below buyHouse purchaseAge + 1
      expect(clampDragAge(38, 'sellHouse', 'h1', opts)).toBe(41);
      // Above maxAge
      expect(clampDragAge(90, 'sellHouse', 'h1', opts)).toBe(85);
      // No matching buyHouse maps to minAge
      expect(clampDragAge(30, 'sellHouse', 'h2', opts)).toBe(35);
    });

    test('clamps haveChild to be at most maxAge - childEndOffset', () => {
      const opts = { minAge: 30, maxAge: 85, childEndOffset: 18 };
      expect(clampDragAge(40, 'haveChild', null, opts)).toBe(40);
      // Above maxAge - offset (85 - 18 = 67)
      expect(clampDragAge(70, 'haveChild', null, opts)).toBe(67);
      // Below minAge
      expect(clampDragAge(25, 'haveChild', null, opts)).toBe(30);
    });

    test('default clamp using minAge and maxAge', () => {
      const opts = { minAge: 30, maxAge: 85 };
      expect(clampDragAge(50, 'sabbatical', null, opts)).toBe(50);
      expect(clampDragAge(20, 'sabbatical', null, opts)).toBe(30);
      expect(clampDragAge(90, 'sabbatical', null, opts)).toBe(85);
    });
  });

  describe('resolveEditingEvent', () => {
    test('prefers passed event if not a React synthetic event', () => {
      const editing = { id: 'editing' };
      const passed = { id: 'passed' };
      expect(resolveEditingEvent(passed, editing)).toBe(passed);
    });

    test('returns editing event if passed event is a synthetic event', () => {
      const editing = { id: 'editing' };
      const synthetic = { preventDefault: () => {}, nativeEvent: {} };
      expect(resolveEditingEvent(synthetic, editing)).toBe(editing);
    });

    test('returns editing event if passed event is undefined', () => {
      const editing = { id: 'editing' };
      expect(resolveEditingEvent(undefined, editing)).toBe(editing);
    });
  });

  describe('getEventAge', () => {
    test('extracts age using various age keys', () => {
      expect(getEventAge({ age: 40 })).toBe(40);
      expect(getEventAge({ startAge: 45 })).toBe(45);
      expect(getEventAge({ purchaseAge: 50 })).toBe(50);
      expect(getEventAge({ birthAge: 35 })).toBe(35);
      expect(getEventAge({ claimingAge: 62 })).toBe(62);
      expect(getEventAge({ ageReceived: 21 })).toBe(21);
      expect(getEventAge({ moveAge: 33 })).toBe(33);
      expect(getEventAge({})).toBeNull();
    });
  });

  describe('getEventId', () => {
    test('extracts id or originalId', () => {
      expect(getEventId({ id: 'e1' })).toBe('e1');
      expect(getEventId({ originalId: 'e2' })).toBe('e2');
      expect(getEventId({ id: 'e1', originalId: 'e2' })).toBe('e1');
      expect(getEventId({})).toBeNull();
    });
  });
});
