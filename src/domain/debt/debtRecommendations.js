import { BEHAVIOR_KEYS } from './debtConstants.js';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export const formatPayoffText = (months) => {
  if (months === null || months === undefined) return 'Never';
  const yrs = Math.floor(months / 12);
  const m = months % 12;
  if (yrs === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${yrs} year${yrs !== 1 ? 's' : ''}`;
  return `${yrs} yr${yrs !== 1 ? 's' : ''} ${m} mo${m !== 1 ? 's' : ''}`;
};

export const formatPayoffSummary = (simObj, balance) => {
  const sim = simObj.current;
  if (simObj.name === 'Budget Gap' && sim.yearlyData[30].balance > balance) {
    return `Grows to ${formatCurrency(sim.yearlyData[5].balance)} (5y)`;
  }
  if (sim.isPaidOff) {
    return formatPayoffText(sim.monthsToPayoff);
  }
  if (sim.yearlyData[30].balance > balance) {
    return `Grows to ${formatCurrency(sim.yearlyData[5].balance)} (5y)`;
  }
  return 'Never';
};

export const getScenarioStatus = (key, simObj, balance) => {
  const sim = simObj.current;
  if (key === BEHAVIOR_KEYS.PAYOFF_IN_FULL) {
    return { label: 'Interest-Free', class: 'status-success' };
  }
  if (key === BEHAVIOR_KEYS.BUDGET_GAP && sim.yearlyData[30].balance > balance) {
    return { label: 'Compounding Spiral', class: 'status-danger' };
  }
  if (sim.isPaidOff) {
    return { label: 'Decreasing', class: 'status-success' };
  }
  if (sim.yearlyData[30].balance > balance) {
    return { label: 'Growing Slowly', class: 'status-warning' };
  }
  return { label: 'Stuck Forever', class: 'status-neutral' };
};

export function getEducationalInsights(activeBehavior, inputs, curSim, baseSim) {
  const extra = inputs.extraPayment;
  
  switch (activeBehavior) {
    case BEHAVIOR_KEYS.PAYOFF_IN_FULL:
      return `Paying off your statement balance in full each month is the optimal way to use a credit card. By doing so, you take advantage of the grace period to avoid all interest, maintaining your net worth and completely eliminating credit card drag.`;
    case BEHAVIOR_KEYS.PAYDOWN:
      if (extra > 0) {
        const yrsBase = baseSim.monthsToPayoff ? (baseSim.monthsToPayoff / 12) : 30;
        const yrsCur = curSim.monthsToPayoff ? (curSim.monthsToPayoff / 12) : 30;
        const timeSaved = Math.max(0, yrsBase - yrsCur).toFixed(1);
        const interestSaved = Math.max(0, baseSim.totalInterestPaid - curSim.totalInterestPaid);

        return `Paying an extra $${extra}/month eliminates debt ${timeSaved} years sooner, saves ${formatCurrency(interestSaved)} in interest, and stops future credit card drag.`;
      }
      return `Paying off debt stops future credit card drag. Paying significantly above the interest ensures that your payments go directly to reducing the principal.`;

    case BEHAVIOR_KEYS.SLOW_PAYDOWN:
      if (extra > 0) {
        const yrsBase = baseSim.monthsToPayoff ? (baseSim.monthsToPayoff / 12) : 30;
        const yrsCur = curSim.monthsToPayoff ? (curSim.monthsToPayoff / 12) : 30;
        const timeSaved = Math.max(0, yrsBase - yrsCur).toFixed(1);
        const interestSaved = Math.max(0, baseSim.totalInterestPaid - curSim.totalInterestPaid);
        return `Although the baseline balance shrunk very slowly, adding $${extra}/month eliminates debt ${timeSaved} years sooner and saves ${formatCurrency(interestSaved)} in interest, reducing wealth loss.`;
      }
      return `Most of your payment is still going toward interest. Although the balance is shrinking, interest persists for many years, creating a long-term drag on your net worth.`;

    case BEHAVIOR_KEYS.CARRY_BALANCE:
    case BEHAVIOR_KEYS.PAYMENT_EQUALS_INTEREST:
      if (extra > 0) {
        return `Your extra payment of $${extra}/month broke the cycle! Instead of carrying debt forever and leaking wealth, you will be debt-free in ${formatPayoffText(curSim.monthsToPayoff)} and save ${formatCurrency(Math.max(0, baseSim.totalInterestPaid - curSim.totalInterestPaid))} in interest.`;
      }
      return `You are making payments but not reducing the balance. The payment covers interest only. The principal never decreases, causing wealth to decline forever in a straight line.`;

    case BEHAVIOR_KEYS.INTEREST_TRAP:
      if (extra > 0) {
        const isNowDecreasing = curSim.isPaidOff || curSim.yearlyData[30].balance < inputs.balance;
        if (isNowDecreasing) {
          return `Adding $${extra}/month pulled you out of the Interest Trap! The balance is now decreasing, and you will become debt-free in ${formatPayoffText(curSim.monthsToPayoff)}, reversing your wealth decline.`;
        } else {
          return `Adding $${extra}/month slows down the debt growth, but your payment does not keep up with interest. You remain in the trap with net worth falling faster over time.`;
        }
      }
      return `Your payment does not keep up with interest. The payment is less than the monthly interest charged. Debt grows over time, and net worth falls faster and faster.`;

    case BEHAVIOR_KEYS.BUDGET_GAP:
      if (extra > 0) {
        const isNowDecreasing = curSim.isPaidOff || curSim.yearlyData[30].balance < inputs.balance;
        if (isNowDecreasing) {
          return `Adding $${extra}/month covers your new spending and interest! The balance is now shrinking toward payoff, halting the compounding drag.`;
        } else {
          return `Adding $${extra}/month helps, but new spending exceeds payments. Debt compounds on a growing balance, and net worth continues to decline fastest.`;
        }
      }
      return `New spending exceeds payments and debt accelerates. Debt compounds rapidly on a growing balance, leading to the fastest net worth decline.`;

    default:
      return '';
  }
}
