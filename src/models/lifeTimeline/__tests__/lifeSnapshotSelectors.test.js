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

  test('getLifeSnapshotAtAge infers currentAge from legacy fields', () => {
    const inputs1 = { age: 40 };
    expect(getLifeSnapshotAtAge(inputs1, 45).currentAge).toBe(40);

    const inputs2 = {
      householdModel: {
        people: {
          self: {
            age: 42
          }
        }
      }
    };
    expect(getLifeSnapshotAtAge(inputs2, 45).currentAge).toBe(42);

    const inputs3 = {
      householdModel: {
        people: {
          self: {
            demographics: {
              currentAge: 44
            }
          }
        }
      }
    };
    expect(getLifeSnapshotAtAge(inputs3, 45).currentAge).toBe(44);
  });

  test('getLifeSnapshotAtAge extracts partner and calculates their age correctly', () => {
    const inputs = {
      currentAge: 35,
      filingStatus: 'married',
      householdModel: {
        people: {
          partner: {
            role: 'partner',
            displayName: 'My Spouse',
            currentAge: 38
          }
        }
      }
    };

    const snapshot = getLifeSnapshotAtAge(inputs, 45);
    expect(snapshot.relationshipStatus).toBe('married');
    expect(snapshot.people.partner).toBeDefined();
    expect(snapshot.people.partner.displayName).toBe('My Spouse');
    expect(snapshot.people.partner.currentAge).toBe(48); // 38 + (45 - 35)
  });

  test('getLifeSnapshotAtAge sums annualIncome and falls back correctly', () => {
    const inputsNoIncomeList = {
      currentAge: 35,
      simpleIncome: 100000
    };
    const snapshotNoList = getLifeSnapshotAtAge(inputsNoIncomeList, 40);
    expect(snapshotNoList.income.annualIncome).toBe(100000);

    const inputsWithIncomeList = {
      currentAge: 35,
      incomeList: [
        { id: 'inc-1', name: 'Salary', amount: 80000, startAge: 35, endAge: 65 }
      ]
    };
    const snapshotWithList = getLifeSnapshotAtAge(inputsWithIncomeList, 40);
    expect(snapshotWithList.income.annualIncome).toBe(80000);

    // Active at 40, but retired at 70 (activeIncomeItems is empty, so falls back to currentAnnualIncome (80000))
    const snapshotRetired = getLifeSnapshotAtAge(inputsWithIncomeList, 70);
    expect(snapshotRetired.income.annualIncome).toBe(80000);
  });

  test('getLifeSnapshotAtAge derives activeDebts from active periods', () => {
    const inputs = {
      currentAge: 35,
      debtList: [
        { id: 'debt-1', name: 'Student Loan', balance: 20000, interestRate: 5.0, payment: 200, frequency: 'monthly', startAge: 35 }
      ]
    };

    // Active at 40
    const snapshot40 = getLifeSnapshotAtAge(inputs, 40);
    expect(snapshot40.debts.activeDebts.length).toBe(1);
    expect(snapshot40.debts.activeDebts[0].name).toBe('Student Loan');
    expect(snapshot40.debts.activeDebts[0].monthlyPayment).toBe(200);

    // Inactive at 70 (amortized loan payoff age is calculated to be before age 70)
    const snapshot70 = getLifeSnapshotAtAge(inputs, 70);
    expect(snapshot70.debts.activeDebts.length).toBe(0);
  });

  test('getLifeSnapshotAtAge returns current housing status', () => {
    const inputsOwn = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        home: { status: 'own', homeValue: 300000, mortgageBalance: 150000, monthlyPayment: 1000 }
      }
    };
    const snapshotOwn = getLifeSnapshotAtAge(inputsOwn, 35);
    expect(snapshotOwn.housingStatus).toBe('own');

    const inputsRent = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        home: { status: 'rent', monthlyRent: 2000 }
      }
    };
    const snapshotRent = getLifeSnapshotAtAge(inputsRent, 35);
    expect(snapshotRent.housingStatus).toBe('rent');
  });

  test('getLifeSnapshotAtAge returns future annual income after an income change event', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      incomeList: [
        { id: 'inc-1', name: 'Salary', amount: 50000, startAge: 35, endAge: 45 }
      ],
      lifeEvents: [
        { id: 'inc-change', type: 'careerChange', name: 'New Job', startAge: 45, amount: 80000, endAge: 65, enabled: true }
      ]
    };

    // Age 40: Should be original salary
    const snapshot40 = getLifeSnapshotAtAge(inputs, 40);
    expect(snapshot40.income.annualIncome).toBe(50000);

    // Age 46: Should be new job salary
    const snapshot46 = getLifeSnapshotAtAge(inputs, 46);
    expect(snapshot46.income.annualIncome).toBe(80000);
  });
});
