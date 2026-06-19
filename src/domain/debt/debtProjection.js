import { simulateDebt } from '../../debtSimulationEngine.js';
import { BEHAVIOR_KEYS, PAYMENT_OFFSETS } from './debtConstants.js';

export function calculateAmortizedPayment(balance, apr, years) {
  const N = years * 12;
  const r = apr / 100 / 12;
  if (r === 0) return balance / N;
  return balance * (r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
}

export function calculateAmortizedLoanPayoffAge(balance, annualRate, monthlyPayment, startAge) {
  if (balance <= 0) return startAge;
  if (monthlyPayment <= 0) return Infinity;
  
  const r = (annualRate / 100) / 12;
  if (monthlyPayment <= balance * r) return Infinity; // grows forever / interest trap
  
  if (r === 0) {
    const months = balance / monthlyPayment;
    return startAge + months / 12;
  }
  
  const months = Math.log(monthlyPayment / (monthlyPayment - r * balance)) / Math.log(1 + r);
  return startAge + months / 12;
}

export function calculatePayoffTimeline(params) {
  return simulateDebt(params);
}

export function getYAxisBoundsAt36(inputs, activeBehavior) {
  const { balance, monthlyPayment, monthlyNewDebt, extraPayment, startingCash } = inputs;
  const r = 0.36; // 36% APR
  const I = balance * (r / 12);

  const P_payInFull = activeBehavior === BEHAVIOR_KEYS.PAYOFF_IN_FULL ? monthlyPayment : balance;
  const S_payInFull = activeBehavior === BEHAVIOR_KEYS.PAYOFF_IN_FULL ? monthlyNewDebt : 0;

  const P_aggressive = activeBehavior === BEHAVIOR_KEYS.PAYDOWN ? monthlyPayment : Math.round(I + PAYMENT_OFFSETS.PAYDOWN);
  const S_aggressive = activeBehavior === BEHAVIOR_KEYS.PAYDOWN ? monthlyNewDebt : 0;

  const P_slow = activeBehavior === BEHAVIOR_KEYS.SLOW_PAYDOWN ? monthlyPayment : Math.round(I + PAYMENT_OFFSETS.SLOW_PAYDOWN);
  const S_slow = activeBehavior === BEHAVIOR_KEYS.SLOW_PAYDOWN ? monthlyNewDebt : 0;

  const P_neutral = (activeBehavior === BEHAVIOR_KEYS.CARRY_BALANCE || activeBehavior === BEHAVIOR_KEYS.PAYMENT_EQUALS_INTEREST) ? monthlyPayment : Math.round(I);
  const S_neutral = (activeBehavior === BEHAVIOR_KEYS.CARRY_BALANCE || activeBehavior === BEHAVIOR_KEYS.PAYMENT_EQUALS_INTEREST) ? monthlyNewDebt : 0;

  const P_trap = activeBehavior === BEHAVIOR_KEYS.INTEREST_TRAP ? monthlyPayment : Math.max(10, Math.round(I + PAYMENT_OFFSETS.INTEREST_TRAP));
  const S_trap = activeBehavior === BEHAVIOR_KEYS.INTEREST_TRAP ? monthlyNewDebt : 0;

  const P_budget = activeBehavior === BEHAVIOR_KEYS.BUDGET_GAP ? monthlyPayment : Math.round(I);
  const S_budget = activeBehavior === BEHAVIOR_KEYS.BUDGET_GAP ? monthlyNewDebt : PAYMENT_OFFSETS.BUDGET_GAP_SPENDING;

  const payInFull = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_payInFull, monthlyNewDebt: S_payInFull, extraPayment, startingCash });
  const aggressive = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_aggressive, monthlyNewDebt: S_aggressive, extraPayment, startingCash });
  const slow = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_slow, monthlyNewDebt: S_slow, extraPayment, startingCash });
  const neutral = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_neutral, monthlyNewDebt: S_neutral, extraPayment, startingCash });
  const trap = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_trap, monthlyNewDebt: S_trap, extraPayment, startingCash });
  const budgetGap = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_budget, monthlyNewDebt: S_budget, extraPayment, startingCash });

  const sims36 = [payInFull, aggressive, slow, neutral, trap, budgetGap];
  
  let maxBalance = balance;
  let minNetWorth = startingCash - balance;

  sims36.forEach((sim) => {
    sim.yearlyData.forEach((d) => {
      if (d.year <= 5) {
        if (d.balance > maxBalance) maxBalance = d.balance;
        if (d.netWorth < minNetWorth) minNetWorth = d.netWorth;
      }
    });
  });

  const initialNetWorth = startingCash - balance;
  if (initialNetWorth < minNetWorth) minNetWorth = initialNetWorth;

  const maxPayoffPayment = calculateAmortizedPayment(balance, 36, 1);

  return {
    maxBalance: Math.ceil(maxBalance),
    minNetWorth: Math.floor(minNetWorth),
    maxPayoffPayment: Math.ceil(maxPayoffPayment)
  };
}
