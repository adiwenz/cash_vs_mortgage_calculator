import { describe, test, expect } from 'vitest';
import { BEHAVIOR_KEYS } from './src/domain/debt/debtConstants.js';
import { classifyBehavior, getBehaviorDefaults } from './src/domain/debt/creditCardStates.js';
import { calculatePayoffTimeline, calculateAmortizedPayment, calculateAmortizedLoanPayoffAge } from './src/domain/debt/debtProjection.js';

describe('Debt Domain Logic', () => {
  describe('1. Carry Balance Does Not Auto-Payoff', () => {
    test('balance does not auto-pay to zero unless explicit paydown behavior is selected', () => {
      const balance = 10000;
      const apr = 24; // 24%
      
      const defaults = getBehaviorDefaults(BEHAVIOR_KEYS.CARRY_BALANCE, balance, apr);
      // defaults should be: payment = Math.round(interest) = 200, spending = 0
      expect(defaults.payment).toBe(200);
      expect(defaults.spending).toBe(0);

      const sim = calculatePayoffTimeline({
        startingBalance: balance,
        apr: apr / 100,
        monthlyPayment: defaults.payment,
        monthlyNewDebt: defaults.spending,
        extraPayment: 0,
        simulationYears: 30
      });

      expect(sim.isPaidOff).toBe(false);
      expect(sim.monthsToPayoff).toBeNull();
      // Verify balance remains flat at 10000 at the end of simulation
      expect(sim.yearlyData[30].balance).toBeCloseTo(10000, 0);
    });
  });

  describe('2. Interest Trap Grows', () => {
    test('given monthly payment less than monthly interest, projected balance increases', () => {
      const balance = 10000;
      const apr = 24; // 24%
      
      const sim = calculatePayoffTimeline({
        startingBalance: balance,
        apr: apr / 100,
        monthlyPayment: 150, // Interest is 200
        monthlyNewDebt: 0,
        extraPayment: 0,
        simulationYears: 5
      });

      expect(sim.isPaidOff).toBe(false);
      expect(sim.debtAfter1Year).toBeGreaterThan(balance);
      expect(sim.debtAfter5Years).toBeGreaterThan(sim.debtAfter1Year);
    });
  });

  describe('3. Budget Gap Adds New Debt', () => {
    test('given new spending exceeds payment capacity, balance grows from both interest and new spending', () => {
      const balance = 10000;
      const apr = 24; // 24%
      
      const sim = calculatePayoffTimeline({
        startingBalance: balance,
        apr: apr / 100,
        monthlyPayment: 200, // payment equals interest
        monthlyNewDebt: 300, // new spending of 300
        extraPayment: 0,
        simulationYears: 5
      });

      expect(sim.isPaidOff).toBe(false);
      // Growth should exceed interest (which is covered) + new spending compounding
      expect(sim.debtAfter5Years).toBeGreaterThan(balance + (300 * 12 * 5));
    });
  });

  describe('4. Payment Equals Interest Is Stable', () => {
    test('given payment approximately equals monthly interest, principal remains roughly flat', () => {
      const balance = 10000;
      const apr = 24; // 24%
      
      const sim = calculatePayoffTimeline({
        startingBalance: balance,
        apr: apr / 100,
        monthlyPayment: 200, // exact interest
        monthlyNewDebt: 0,
        extraPayment: 0,
        simulationYears: 5
      });

      expect(sim.debtAfter1Year).toBeCloseTo(10000, 0);
      expect(sim.debtAfter5Years).toBeCloseTo(10000, 0);
    });
  });

  describe('5. Payoff In Full', () => {
    test('given payment covers full balance, payoff timeline is immediate or one month depending on existing simulator convention', () => {
      const balance = 10000;
      
      // If apr is 0, payoff should be immediate (1 month)
      const simZeroApr = calculatePayoffTimeline({
        startingBalance: balance,
        apr: 0,
        monthlyPayment: balance,
        monthlyNewDebt: 0,
        extraPayment: 0,
        simulationYears: 1
      });
      expect(simZeroApr.isPaidOff).toBe(true);
      expect(simZeroApr.monthsToPayoff).toBe(1);

      // If apr is 24%, paying exactly the balance leaves some interest, taking 2 months in the simulator
      const simWithApr = calculatePayoffTimeline({
        startingBalance: balance,
        apr: 0.24,
        monthlyPayment: balance,
        monthlyNewDebt: 0,
        extraPayment: 0,
        simulationYears: 1
      });
      expect(simWithApr.isPaidOff).toBe(true);
      expect(simWithApr.monthsToPayoff).toBe(2);
    });
  });

  describe('6. Classifications and Defaults', () => {
    test('classifyBehavior correctly maps scenarios to keys', () => {
      // payInFull
      expect(classifyBehavior(10000, 24, 10000, 0)).toBe(BEHAVIOR_KEYS.PAYOFF_IN_FULL);
      // budgetGap
      expect(classifyBehavior(10000, 24, 200, 50)).toBe(BEHAVIOR_KEYS.BUDGET_GAP);
      // interestTrap (payment < 200 - 1)
      expect(classifyBehavior(10000, 24, 150, 0)).toBe(BEHAVIOR_KEYS.INTEREST_TRAP);
      // carryBalance (payment <= 200 + 1)
      expect(classifyBehavior(10000, 24, 200, 0)).toBe(BEHAVIOR_KEYS.CARRY_BALANCE);
      // slowPaydown (payment <= 200 + 100)
      expect(classifyBehavior(10000, 24, 250, 0)).toBe(BEHAVIOR_KEYS.SLOW_PAYDOWN);
      // paydown
      expect(classifyBehavior(10000, 24, 500, 0)).toBe(BEHAVIOR_KEYS.PAYDOWN);
    });

    test('getBehaviorDefaults returns expected values', () => {
      const balance = 10000;
      const apr = 24;

      const pInFull = getBehaviorDefaults(BEHAVIOR_KEYS.PAYOFF_IN_FULL, balance, apr);
      expect(pInFull.payment).toBe(10000);
      expect(pInFull.spending).toBe(0);

      const paydown = getBehaviorDefaults(BEHAVIOR_KEYS.PAYDOWN, balance, apr);
      expect(paydown.payment).toBe(500); // 200 + 300
      expect(paydown.spending).toBe(0);

      const slow = getBehaviorDefaults(BEHAVIOR_KEYS.SLOW_PAYDOWN, balance, apr);
      expect(slow.payment).toBe(250); // 200 + 50
      expect(slow.spending).toBe(0);

      const carry = getBehaviorDefaults(BEHAVIOR_KEYS.CARRY_BALANCE, balance, apr);
      expect(carry.payment).toBe(200); // 200
      expect(carry.spending).toBe(0);

      const trap = getBehaviorDefaults(BEHAVIOR_KEYS.INTEREST_TRAP, balance, apr);
      expect(trap.payment).toBe(150); // 200 - 50
      expect(trap.spending).toBe(0);

      const budget = getBehaviorDefaults(BEHAVIOR_KEYS.BUDGET_GAP, balance, apr);
      expect(budget.payment).toBe(200); // 200
      expect(budget.spending).toBe(300); // 300
    });
  });
});
