import { BEHAVIOR_KEYS, PAYMENT_OFFSETS } from './debtConstants.js';

export function classifyBehavior(balance, apr, payment, newSpending) {
  const monthlyInterest = balance * (apr / 100) / 12;
  if (payment >= balance) return BEHAVIOR_KEYS.PAYOFF_IN_FULL;
  if (newSpending > 0) return BEHAVIOR_KEYS.BUDGET_GAP;
  if (payment < monthlyInterest - 1) return BEHAVIOR_KEYS.INTEREST_TRAP;
  if (payment <= monthlyInterest + 1) return BEHAVIOR_KEYS.CARRY_BALANCE;
  if (payment <= monthlyInterest + 100) return BEHAVIOR_KEYS.SLOW_PAYDOWN;
  return BEHAVIOR_KEYS.PAYDOWN;
}

export function getBehaviorDefaults(behavior, balance, apr) {
  const interest = balance * (apr / 100) / 12;
  switch (behavior) {
    case BEHAVIOR_KEYS.PAYOFF_IN_FULL:
      return { payment: balance, spending: 0 };
    case BEHAVIOR_KEYS.PAYDOWN:
      return { payment: Math.round(interest + PAYMENT_OFFSETS.PAYDOWN), spending: 0 };
    case BEHAVIOR_KEYS.SLOW_PAYDOWN:
      return { payment: Math.round(interest + PAYMENT_OFFSETS.SLOW_PAYDOWN), spending: 0 };
    case BEHAVIOR_KEYS.CARRY_BALANCE:
    case BEHAVIOR_KEYS.PAYMENT_EQUALS_INTEREST:
      return { payment: Math.round(interest), spending: 0 };
    case BEHAVIOR_KEYS.INTEREST_TRAP:
      return { payment: Math.max(10, Math.round(interest + PAYMENT_OFFSETS.INTEREST_TRAP)), spending: 0 };
    case BEHAVIOR_KEYS.BUDGET_GAP:
      return { payment: Math.round(interest), spending: PAYMENT_OFFSETS.BUDGET_GAP_SPENDING };
    default:
      return { payment: Math.round(interest), spending: 0 };
  }
}
