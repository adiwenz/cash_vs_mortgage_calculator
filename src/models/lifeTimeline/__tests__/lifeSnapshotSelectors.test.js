import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs.js';
import { getLifeSnapshotAtAge } from '../lifeSnapshotSelectors.js';

describe('lifeSnapshotSelectors', () => {
  test('getLifeSnapshotAtAge safely handles empty or minimal inputs', () => {
    const snapshot = getLifeSnapshotAtAge({}, 40);
    
    expect(snapshot).toBeDefined();
    expect(snapshot.age).toBe(40);
    expect(snapshot.currentAge).toBe(35); // Safe default fallback
    expect(snapshot.relationshipStatus).toBe('single');
    expect(snapshot.housingStatus).toBe('rent');
    expect(snapshot.people.self).toBeDefined();
    expect(snapshot.people.self.currentAge).toBe(40);
    expect(snapshot.people.partner).toBeNull();
    expect(snapshot.children).toEqual([]);
    expect(snapshot.income.annualIncome).toBe(0);
    expect(snapshot.debts.activeDebts).toEqual([]);
    expect(snapshot.assets.investedAssets).toBe(0);
  });

  test('getLifeSnapshotAtAge returns current relationship status', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      filingStatus: 'single',
      useLifeProfile: false
    };
    const snapshot = getLifeSnapshotAtAge(inputs, 35);
    expect(snapshot.relationshipStatus).toBe('single');

    const inputsMarried = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      filingStatus: 'married',
      useLifeProfile: false
    };
    const snapshotMarried = getLifeSnapshotAtAge(inputsMarried, 35);
    expect(snapshotMarried.relationshipStatus).toBe('married');
    expect(snapshotMarried.people.partner).toBeDefined();
    expect(snapshotMarried.people.partner.currentAge).toBe(35);
  });

  test('getLifeSnapshotAtAge returns future married status after marriage event', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      filingStatus: 'single',
      useLifeProfile: false,
      lifeEvents: [
        { id: 'marriage-1', type: 'marriage', age: 38, enabled: true, spouseIncome: 50000 }
      ]
    };
    
    // Age 37: Single
    const snapshot37 = getLifeSnapshotAtAge(inputs, 37);
    expect(snapshot37.relationshipStatus).toBe('single');
    expect(snapshot37.people.partner).toBeNull();

    // Age 38: Married
    const snapshot38 = getLifeSnapshotAtAge(inputs, 38);
    expect(snapshot38.relationshipStatus).toBe('married');
    expect(snapshot38.people.partner).toBeDefined();
    expect(snapshot38.people.partner.currentAge).toBe(38);
  });

  test('getLifeSnapshotAtAge returns future homeowner status after home purchase event', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      lifeEvents: [
        { id: 'buy-house-1', type: 'buyHouse', age: 42, homePrice: 400000, downPayment: 80000, loanTerm: 30, enabled: true }
      ]
    };
    
    // Age 41: Renting
    const snapshot41 = getLifeSnapshotAtAge(inputs, 41);
    expect(snapshot41.housingStatus).toBe('rent');
    expect(snapshot41.debts.activeDebts.some(d => d.type === 'mortgage')).toBe(false);

    // Age 42: Homeowner and active Mortgage
    const snapshot42 = getLifeSnapshotAtAge(inputs, 42);
    expect(snapshot42.housingStatus).toBe('own');
    expect(snapshot42.debts.activeDebts.some(d => d.type === 'mortgage')).toBe(true);
  });

  test('getLifeSnapshotAtAge does not require simulation results and safely returns structural state only', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      assets: {
        brokerage: 10000,
        cash: 2000
      }
    };
    
    const snapshot = getLifeSnapshotAtAge(inputs, 50);
    
    // Invested assets should equal starting baseline assets
    expect(snapshot.assets.investedAssets).toBe(12000);
    // Does not perform projection calculations
    expect(snapshot.assets.investedAssets).not.toBeGreaterThan(12000);
  });

  test('getLifeSnapshotAtAge does not mutate inputs', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    Object.freeze(inputs);
    
    expect(() => getLifeSnapshotAtAge(inputs, 45)).not.toThrow();
  });
});
