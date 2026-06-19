export const BEHAVIOR_KEYS = {
  PAYOFF_IN_FULL: 'payoffInFull',
  PAYDOWN: 'paydown',
  SLOW_PAYDOWN: 'slowPaydown',
  CARRY_BALANCE: 'carryBalance',
  INTEREST_TRAP: 'interestTrap',
  BUDGET_GAP: 'budgetGap',
  PAYMENT_EQUALS_INTEREST: 'paymentEqualsInterest'
};

export const DEFAULT_APR = 24;
export const DEFAULT_PAYMENT = 200;

export const PAYMENT_OFFSETS = {
  PAYDOWN: 300,
  SLOW_PAYDOWN: 50,
  INTEREST_TRAP: -50,
  BUDGET_GAP_SPENDING: 300
};

export const BEHAVIOR_METADATA = {
  [BEHAVIOR_KEYS.PAYOFF_IN_FULL]: {
    name: 'Payoff in Full',
    description: 'You pay off the entire statement balance each month to avoid interest charges.',
    rule: 'Monthly payment covers the full balance.',
    icon: '🛡️'
  },
  [BEHAVIOR_KEYS.PAYDOWN]: {
    name: 'Paydown',
    description: 'You are paying enough to meaningfully reduce principal.',
    rule: 'Monthly payment is comfortably above monthly interest.',
    icon: '📈'
  },
  [BEHAVIOR_KEYS.SLOW_PAYDOWN]: {
    name: 'Slow Paydown',
    description: 'You are paying more than interest, but progress is slow.',
    rule: 'Monthly payment is slightly above monthly interest.',
    icon: '📉'
  },
  [BEHAVIOR_KEYS.CARRY_BALANCE]: {
    name: 'Carry Balance',
    description: 'You are paying the interest but not reducing the principal.',
    rule: 'Monthly payment equals monthly interest.',
    icon: '💳'
  },
  [BEHAVIOR_KEYS.INTEREST_TRAP]: {
    name: 'Interest Trap',
    description: 'You are paying something, but not enough to cover interest.',
    rule: 'Monthly payment is below monthly interest.',
    icon: '🪤'
  },
  [BEHAVIOR_KEYS.BUDGET_GAP]: {
    name: 'Budget Gap',
    description: 'You are adding new charges faster than you are paying the card down.',
    rule: 'Monthly new spending is greater than zero.',
    icon: '⚠️'
  },
  [BEHAVIOR_KEYS.PAYMENT_EQUALS_INTEREST]: {
    name: 'Payment Equals Interest',
    description: 'You are paying the interest but not reducing the principal.',
    rule: 'Monthly payment equals monthly interest.',
    icon: '💳'
  }
};

export const EDUCATIONAL_EXPLANATIONS = {
  [BEHAVIOR_KEYS.PAYOFF_IN_FULL]: 'Paying in full every month is the optimal behavior. You use the credit card’s grace period to avoid all interest charges and credit card drag.',
  [BEHAVIOR_KEYS.PAYDOWN]: 'Your payment is reducing principal. Your net worth still falls at first because of interest, but the drag ends once the balance is paid off.',
  [BEHAVIOR_KEYS.SLOW_PAYDOWN]: 'Your balance is going down, but slowly. Most of your payment is still going toward interest, so credit card drag continues for years.',
  [BEHAVIOR_KEYS.CARRY_BALANCE]: 'You are covering interest, but not principal. The balance stays flat, and your net worth keeps falling by the interest amount.',
  [BEHAVIOR_KEYS.INTEREST_TRAP]: 'You are paying something, but not enough to cover interest. The unpaid interest is added to the balance, so debt grows.',
  [BEHAVIOR_KEYS.BUDGET_GAP]: 'You are adding new charges faster than you are paying the card down. This creates the fastest debt growth.',
  [BEHAVIOR_KEYS.PAYMENT_EQUALS_INTEREST]: 'You are covering interest, but not principal. The balance stays flat, and your net worth keeps falling by the interest amount.'
};

export const EDUCATIONAL_TAKEAWAYS = {
  [BEHAVIOR_KEYS.PAYOFF_IN_FULL]: "Paying your statement balance in full every month is the single best credit card habit. You completely avoid interest charges, meaning you use the bank's money for free during the grace period.",
  [BEHAVIOR_KEYS.PAYDOWN]: "Paying extra is the fastest way to reduce principal. Every dollar added directly reduces the amount that interest accumulates on, halting wealth decay.",
  [BEHAVIOR_KEYS.SLOW_PAYDOWN]: "When payments only slightly exceed interest, interest compounds consume almost your entire payment. You end up renting your debt and leaking wealth for decades.",
  [BEHAVIOR_KEYS.CARRY_BALANCE]: "This is a common trap. Paying only interest keeps the principal completely intact. You make payments, but your net worth falls continuously.",
  [BEHAVIOR_KEYS.INTEREST_TRAP]: "This occurs when minimum payments are set below interest charges. The debt expands automatically, eating into your future wealth.",
  [BEHAVIOR_KEYS.BUDGET_GAP]: "This is the most critical pattern to break. Adding new debt while carrying a balance creates a compounding cycle that escalates rapidly, destroying net worth.",
  [BEHAVIOR_KEYS.PAYMENT_EQUALS_INTEREST]: "This is a common trap. Paying only interest keeps the principal completely intact. You make payments, but your net worth falls continuously."
};

export const DEFAULT_CC_INPUTS = {
  balance: 10000,
  apr: DEFAULT_APR,
  monthlyPayment: DEFAULT_PAYMENT,
  monthlyNewDebt: 0,
  extraPayment: 0,
  startingCash: 0
};
