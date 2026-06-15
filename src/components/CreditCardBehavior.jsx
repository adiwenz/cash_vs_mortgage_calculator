import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  LabelList
} from 'recharts';
import { simulateDebt } from '../debtSimulationEngine';
import './CreditCardBehavior.css';

// Default inputs (defaults to Carry Balance configuration on load)
const DEFAULT_INPUTS = {
  balance: 10000,
  apr: 24,
  monthlyPayment: 200,
  monthlyNewDebt: 0,
  extraPayment: 0,
  startingCash: 0
};

// Behavior metadata and descriptions
const BEHAVIOR_METADATA = {
  payInFull: {
    name: 'Payoff in Full',
    description: 'You pay off the entire statement balance each month to avoid interest charges.',
    rule: 'Monthly payment covers the full balance.',
    icon: '🛡️'
  },
  paydown: {
    name: 'Paydown',
    description: 'You are paying enough to meaningfully reduce principal.',
    rule: 'Monthly payment is comfortably above monthly interest.',
    icon: '📈'
  },
  slowPaydown: {
    name: 'Slow Paydown',
    description: 'You are paying more than interest, but progress is slow.',
    rule: 'Monthly payment is slightly above monthly interest.',
    icon: '📉'
  },
  carryBalance: {
    name: 'Carry Balance',
    description: 'You are paying the interest but not reducing the principal.',
    rule: 'Monthly payment equals monthly interest.',
    icon: '💳'
  },
  interestTrap: {
    name: 'Interest Trap',
    description: 'You are paying something, but not enough to cover interest.',
    rule: 'Monthly payment is below monthly interest.',
    icon: '🪤'
  },
  budgetGap: {
    name: 'Budget Gap',
    description: 'You are adding new charges faster than you are paying the card down.',
    rule: 'Monthly new spending is greater than zero.',
    icon: '⚠️'
  }
};

const EDUCATIONAL_EXPLANATIONS = {
  payInFull: 'Paying in full every month is the optimal behavior. You use the credit card’s grace period to avoid all interest charges and credit card drag.',
  paydown: 'Your payment is reducing principal. Your net worth still falls at first because of interest, but the drag ends once the balance is paid off.',
  slowPaydown: 'Your balance is going down, but slowly. Most of your payment is still going toward interest, so credit card drag continues for years.',
  carryBalance: 'You are covering interest, but not principal. The balance stays flat, and your net worth keeps falling by the interest amount.',
  interestTrap: 'You are paying something, but not enough to cover interest. The unpaid interest is added to the balance, so debt grows.',
  budgetGap: 'You are adding new charges faster than you are paying the card down. This creates the fastest debt growth.'
};

// Formats number to currency USD
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

// Formats Y-axis labels for Recharts
const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

// Computes required monthly payment to pay off balance in N years at APR
const calculateAmortizedPayment = (balance, apr, years) => {
  const N = years * 12;
  const r = apr / 100 / 12;
  if (r === 0) return balance / N;
  return balance * (r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
};

// Default value generator for behavior sync
const getBehaviorDefaults = (behavior, balance, apr, currentPayment) => {
  const interest = balance * (apr / 100) / 12;
  switch (behavior) {
    case 'payInFull':
      return { payment: balance, spending: 0 };
    case 'paydown':
      return { payment: Math.round(interest + 300), spending: 0 };
    case 'slowPaydown':
      return { payment: Math.round(interest + 50), spending: 0 };
    case 'carryBalance':
      return { payment: Math.round(interest), spending: 0 };
    case 'interestTrap':
      return { payment: Math.max(10, Math.round(interest - 50)), spending: 0 };
    case 'budgetGap':
      return { payment: Math.round(interest), spending: 300 };
    default:
      return { payment: Math.round(interest), spending: 0 };
  }
};

// Behavior classifier helper
const classifyBehavior = (balance, apr, payment, newSpending) => {
  const monthlyInterest = balance * (apr / 100) / 12;
  if (payment >= balance) return 'payInFull';
  if (newSpending > 0) return 'budgetGap';
  if (payment < monthlyInterest - 1) return 'interestTrap';
  if (payment <= monthlyInterest + 1) return 'carryBalance';
  if (payment <= monthlyInterest + 100) return 'slowPaydown';
  return 'paydown';
};

export default function CreditCardBehavior() {
  const [inputs, setInputs] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('tool');
    if (tool !== 'creditcard') return DEFAULT_INPUTS;

    return {
      balance: getNumParam(params, 'balance', DEFAULT_INPUTS.balance),
      apr: getNumParam(params, 'apr', DEFAULT_INPUTS.apr),
      monthlyPayment: getNumParam(params, 'monthlyPayment', DEFAULT_INPUTS.monthlyPayment),
      monthlyNewDebt: getNumParam(params, 'monthlyNewDebt', DEFAULT_INPUTS.monthlyNewDebt),
      extraPayment: getNumParam(params, 'extraPayment', DEFAULT_INPUTS.extraPayment),
      startingCash: getNumParam(params, 'startingCash', DEFAULT_INPUTS.startingCash)
    };
  });

  const [activeBehavior, setActiveBehavior] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('behavior') || 'carryBalance';
  });

  const [isManualOverride, setIsManualOverride] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hasInputs = params.has('monthlyPayment') || params.has('monthlyNewDebt');
    return hasInputs;
  });

  const [compareMode, setCompareMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('compare') === 'true';
  });

  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [activeTab, setActiveTab] = useState('drag'); // 'drag' | 'balance' | 'payoff'
  const [hoveredBar, setHoveredBar] = useState(null);

  // Sync inputs with URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tool') !== 'creditcard') return;

    Object.keys(inputs).forEach((key) => {
      if (inputs[key] !== DEFAULT_INPUTS[key]) {
        params.set(key, inputs[key]);
      } else {
        params.delete(key);
      }
    });

    if (activeBehavior !== 'carryBalance') {
      params.set('behavior', activeBehavior);
    } else {
      params.delete('behavior');
    }

    if (compareMode) {
      params.set('compare', 'true');
    } else {
      params.delete('compare');
    }

    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [inputs, activeBehavior, compareMode]);

  // Utility to retrieve numerical URL params safely
  function getNumParam(params, key, fallback) {
    const val = params.get(key);
    if (val === null || val === '') return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }

  // Handle local state text input editing to allow typing decimals without immediate jumping
  const [localValues, setLocalValues] = useState({});
  const activeFieldRef = useRef(null);

  useEffect(() => {
    const nextLocals = { ...localValues };
    let changed = false;

    Object.keys(inputs).forEach((key) => {
      if (activeFieldRef.current !== key) {
        const displayVal = inputs[key].toString();
        if (nextLocals[key] !== displayVal) {
          nextLocals[key] = displayVal;
          changed = true;
        }
      }
    });

    if (changed) {
      setLocalValues(nextLocals);
    }
  }, [inputs]);

  const handleInputChange = (key, valueString) => {
    let sanitized = valueString.replace(/^0+(?=\d)/, '');
    if (sanitized !== '' && sanitized !== '.') {
      const parsedVal = parseFloat(sanitized);
      if (!isNaN(parsedVal)) {
        if (key === 'apr' && parsedVal > 36) sanitized = '36';
        if (parsedVal < 0) sanitized = '0';
      }
    }

    setLocalValues((prev) => ({ ...prev, [key]: sanitized }));

    let numericVal = 0;
    if (sanitized !== '' && sanitized !== '.') {
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed)) {
        numericVal = parsed;
      }
    }

    setInputs((prev) => {
      const next = { ...prev, [key]: numericVal };

      // Sync monthly payment and spending when balance/APR changes and user hasn't manually overridden them
      if ((key === 'balance' || key === 'apr') && !isManualOverride) {
        const defaults = getBehaviorDefaults(activeBehavior, next.balance, next.apr, next.monthlyPayment);
        next.monthlyPayment = defaults.payment;
        next.monthlyNewDebt = defaults.spending;
      }

      return next;
    });

    // If manually changing payment or spending, set manual override and reclassify behavior
    if (key === 'monthlyPayment' || key === 'monthlyNewDebt') {
      setIsManualOverride(true);
      setInputs((currentInputs) => {
        const classified = classifyBehavior(
          currentInputs.balance,
          currentInputs.apr,
          currentInputs.monthlyPayment,
          currentInputs.monthlyNewDebt
        );
        setActiveBehavior(classified);
        return currentInputs;
      });
    }
  };

  const handleBlur = (key) => {
    activeFieldRef.current = null;
    const rawVal = inputs[key];
    const displayVal = rawVal.toString();
    setLocalValues((prev) => ({ ...prev, [key]: displayVal }));
  };

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setActiveBehavior('carryBalance');
    setIsManualOverride(false);
    setCompareMode(false);
  };

  const handleBehaviorCardClick = (behaviorKey) => {
    setIsManualOverride(false);
    setActiveBehavior(behaviorKey);
    setInputs((prev) => {
      const defaults = getBehaviorDefaults(behaviorKey, prev.balance, prev.apr, prev.monthlyPayment);
      return {
        ...prev,
        monthlyPayment: defaults.payment,
        monthlyNewDebt: defaults.spending
      };
    });
  };

  // Run dynamic math configurations
  const simulations = useMemo(() => {
    const { balance, apr, monthlyPayment, monthlyNewDebt, extraPayment, startingCash } = inputs;
    const r = apr / 100;
    const I = balance * (r / 12);

    // Get default values for each behavior
    const def_payInFull = { payment: balance, spending: 0 };
    const def_paydown = { payment: Math.round(I + 300), spending: 0 };
    const def_slow = { payment: Math.round(I + 50), spending: 0 };
    const def_carry = { payment: Math.round(I), spending: 0 };
    const def_trap = { payment: Math.max(10, Math.round(I - 50)), spending: 0 };
    const def_budget = { payment: Math.round(I), spending: 300 };

    // If active behavior is X, use user's actual inputs. Otherwise use defaults.
    const P_payInFull = activeBehavior === 'payInFull' ? monthlyPayment : def_payInFull.payment;
    const S_payInFull = activeBehavior === 'payInFull' ? monthlyNewDebt : def_payInFull.spending;

    const P_paydown = activeBehavior === 'paydown' ? monthlyPayment : def_paydown.payment;
    const S_paydown = activeBehavior === 'paydown' ? monthlyNewDebt : def_paydown.spending;

    const P_slow = activeBehavior === 'slowPaydown' ? monthlyPayment : def_slow.payment;
    const S_slow = activeBehavior === 'slowPaydown' ? monthlyNewDebt : def_slow.spending;

    const P_carry = activeBehavior === 'carryBalance' ? monthlyPayment : def_carry.payment;
    const S_carry = activeBehavior === 'carryBalance' ? monthlyNewDebt : def_carry.spending;

    const P_trap = activeBehavior === 'interestTrap' ? monthlyPayment : def_trap.payment;
    const S_trap = activeBehavior === 'interestTrap' ? monthlyNewDebt : def_trap.spending;

    const P_budget = activeBehavior === 'budgetGap' ? monthlyPayment : def_budget.payment;
    const S_budget = activeBehavior === 'budgetGap' ? monthlyNewDebt : def_budget.spending;

    // Simulation outputs with extra payments
    const payInFullSim = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_payInFull, monthlyNewDebt: S_payInFull, extraPayment, startingCash });
    const paydownSim = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_paydown, monthlyNewDebt: S_paydown, extraPayment, startingCash });
    const slowSim = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_slow, monthlyNewDebt: S_slow, extraPayment, startingCash });
    const carrySim = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_carry, monthlyNewDebt: S_carry, extraPayment, startingCash });
    const trapSim = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_trap, monthlyNewDebt: S_trap, extraPayment, startingCash });
    const budgetSim = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_budget, monthlyNewDebt: S_budget, extraPayment, startingCash });

    // Baseline outputs (no extra payment) to calculate before/after impact
    const payInFullBase = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_payInFull, monthlyNewDebt: S_payInFull, extraPayment: 0, startingCash });
    const paydownBase = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_paydown, monthlyNewDebt: S_paydown, extraPayment: 0, startingCash });
    const slowBase = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_slow, monthlyNewDebt: S_slow, extraPayment: 0, startingCash });
    const carryBase = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_carry, monthlyNewDebt: S_carry, extraPayment: 0, startingCash });
    const trapBase = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_trap, monthlyNewDebt: S_trap, extraPayment: 0, startingCash });
    const budgetBase = simulateDebt({ startingBalance: balance, apr: r, monthlyPayment: P_budget, monthlyNewDebt: S_budget, extraPayment: 0, startingCash });

    return {
      payInFull: { current: payInFullSim, base: payInFullBase, payment: P_payInFull + extraPayment, name: 'Payoff in Full' },
      paydown: { current: paydownSim, base: paydownBase, payment: P_paydown + extraPayment, name: 'Paydown' },
      slowPaydown: { current: slowSim, base: slowBase, payment: P_slow + extraPayment, name: 'Slow Paydown' },
      carryBalance: { current: carrySim, base: carryBase, payment: P_carry + extraPayment, name: 'Carry Balance' },
      interestTrap: { current: trapSim, base: trapBase, payment: P_trap + extraPayment, name: 'Interest Trap' },
      budgetGap: { current: budgetSim, base: budgetBase, payment: P_budget + extraPayment, name: 'Budget Gap' }
    };
  }, [inputs, activeBehavior]);

  // Aggregate year-by-year data points for the main chart comparison
  const chartData = useMemo(() => {
    const list = [];
    for (let y = 0; y <= 5; y++) {
      const dataPoint = { year: y };
      Object.keys(simulations).forEach((key) => {
        const sim = simulations[key].current;
        const entry = sim.yearlyData.find(d => d.year === y) || sim.yearlyData[sim.yearlyData.length - 1];
        dataPoint[simulations[key].name] = Math.round(entry.balance);
        dataPoint[`${simulations[key].name} NW`] = Math.round(entry.netWorth);
      });
      dataPoint["Pay in Full"] = 0;
      dataPoint["Pay in Full NW"] = Math.round(inputs.startingCash - inputs.balance);
      list.push(dataPoint);
    }
    return list;
  }, [simulations, inputs.startingCash, inputs.balance]);

  // Calculate required monthly payment data for years 1 to 5
  const payoffScenariosData = useMemo(() => {
    return [
      { name: '12 months', label: '1 Year', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 1)), color: '#0ea5e9' },
      { name: '24 months', label: '2 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 2)), color: '#10b981' },
      { name: '36 months', label: '3 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 3)), color: '#16a34a' },
      { name: '48 months', label: '4 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 4)), color: '#eab308' },
      { name: '60 months', label: '5 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 5)), color: '#f97316' }
    ];
  }, [inputs.balance, inputs.apr]);

  // Calculate y-axis bounds corresponding to APR 36% for the current balance and inputs
  const yAxisBoundsAt36 = useMemo(() => {
    const { balance, monthlyPayment, monthlyNewDebt, extraPayment, startingCash } = inputs;
    const r = 0.36; // 36% APR
    const I = balance * (r / 12);

    const P_payInFull = activeBehavior === 'payInFull' ? monthlyPayment : balance;
    const S_payInFull = activeBehavior === 'payInFull' ? monthlyNewDebt : 0;

    const P_aggressive = activeBehavior === 'paydown' ? monthlyPayment : Math.round(I + 300);
    const S_aggressive = activeBehavior === 'paydown' ? monthlyNewDebt : 0;

    const P_slow = activeBehavior === 'slowPaydown' ? monthlyPayment : Math.round(I + 50);
    const S_slow = activeBehavior === 'slowPaydown' ? monthlyNewDebt : 0;

    const P_neutral = activeBehavior === 'carryBalance' ? monthlyPayment : Math.round(I);
    const S_neutral = activeBehavior === 'carryBalance' ? monthlyNewDebt : 0;

    const P_trap = activeBehavior === 'interestTrap' ? monthlyPayment : Math.max(10, Math.round(I - 50));
    const S_trap = activeBehavior === 'interestTrap' ? monthlyNewDebt : 0;

    const P_budget = activeBehavior === 'budgetGap' ? monthlyPayment : Math.round(I);
    const S_budget = activeBehavior === 'budgetGap' ? monthlyNewDebt : 300;

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
  }, [inputs.balance, inputs.monthlyPayment, inputs.monthlyNewDebt, inputs.extraPayment, inputs.startingCash, activeBehavior]);

  // Determine line colors based on color-blind setting
  const getLineColors = (key) => {
    if (key === 'payInFull') return '#22c55e';
    if (colorBlindMode) {
      switch (key) {
        case 'paydown': return '#2563eb'; // Blue
        case 'slowPaydown': return '#0284c7';       // Sky Blue
        case 'carryBalance': return '#ea580c';    // Orange
        case 'interestTrap': return '#dc2626';       // Bright Red
        case 'budgetGap': return '#4f46e5';  // Indigo
        default: return '#94a3b8';
      }
    } else {
      switch (key) {
        case 'paydown': return '#10b981'; // Emerald
        case 'slowPaydown': return '#0ea5e9';       // Sky
        case 'carryBalance': return '#f59e0b';    // Amber
        case 'interestTrap': return '#f43f5e';       // Rose
        case 'budgetGap': return '#8b5cf6';  // Violet
        default: return '#64748b';
      }
    }
  };

  const activeSim = simulations[activeBehavior];
  const monthlyInterest = inputs.balance * (inputs.apr / 100 / 12);

  // Format payoff text helper
  const formatPayoffText = (months) => {
    if (months === null || months === undefined) return 'Never';
    const yrs = Math.floor(months / 12);
    const m = months % 12;
    if (yrs === 0) return `${m} month${m !== 1 ? 's' : ''}`;
    if (m === 0) return `${yrs} year${yrs !== 1 ? 's' : ''}`;
    return `${yrs} yr${yrs !== 1 ? 's' : ''} ${m} mo${m !== 1 ? 's' : ''}`;
  };

  // Generate dynamic educational summary and insights
  const educationalInsights = useMemo(() => {
    const extra = inputs.extraPayment;
    const baseSim = activeSim.base;
    const curSim = activeSim.current;
    
    switch (activeBehavior) {
      case 'payInFull':
        return `Paying off your statement balance in full each month is the optimal way to use a credit card. By doing so, you take advantage of the grace period to avoid all interest, maintaining your net worth and completely eliminating credit card drag.`;
      case 'paydown':
        if (extra > 0) {
          const yrsBase = baseSim.monthsToPayoff ? (baseSim.monthsToPayoff / 12) : 30;
          const yrsCur = curSim.monthsToPayoff ? (curSim.monthsToPayoff / 12) : 30;
          const timeSaved = Math.max(0, yrsBase - yrsCur).toFixed(1);
          const interestSaved = Math.max(0, baseSim.totalInterestPaid - curSim.totalInterestPaid);

          return `Paying an extra $${extra}/month eliminates debt ${timeSaved} years sooner, saves ${formatCurrency(interestSaved)} in interest, and stops future credit card drag.`;
        }
        return `Paying off debt stops future credit card drag. Paying significantly above the interest ensures that your payments go directly to reducing the principal.`;

      case 'slowPaydown':
        if (extra > 0) {
          const yrsBase = baseSim.monthsToPayoff ? (baseSim.monthsToPayoff / 12) : 30;
          const yrsCur = curSim.monthsToPayoff ? (curSim.monthsToPayoff / 12) : 30;
          const timeSaved = Math.max(0, yrsBase - yrsCur).toFixed(1);
          const interestSaved = Math.max(0, baseSim.totalInterestPaid - curSim.totalInterestPaid);
          return `Although the baseline balance shrunk very slowly, adding $${extra}/month eliminates debt ${timeSaved} years sooner and saves ${formatCurrency(interestSaved)} in interest, reducing wealth loss.`;
        }
        return `Most of your payment is still going toward interest. Although the balance is shrinking, interest persists for many years, creating a long-term drag on your net worth.`;

      case 'carryBalance':
        if (extra > 0) {
          return `Your extra payment of $${extra}/month broke the cycle! Instead of carrying debt forever and leaking wealth, you will be debt-free in ${formatPayoffText(curSim.monthsToPayoff)} and save ${formatCurrency(Math.max(0, baseSim.totalInterestPaid - curSim.totalInterestPaid))} in interest.`;
        }
        return `You are making payments but not reducing the balance. The payment covers interest only. The principal never decreases, causing wealth to decline forever in a straight line.`;

      case 'interestTrap':
        if (extra > 0) {
          const isNowDecreasing = curSim.isPaidOff || curSim.yearlyData[30].balance < inputs.balance;
          if (isNowDecreasing) {
            return `Adding $${extra}/month pulled you out of the Interest Trap! The balance is now decreasing, and you will become debt-free in ${formatPayoffText(curSim.monthsToPayoff)}, reversing your wealth decline.`;
          } else {
            return `Adding $${extra}/month slows down the debt growth, but your payment does not keep up with interest. You remain in the trap with net worth falling faster over time.`;
          }
        }
        return `Your payment does not keep up with interest. The payment is less than the monthly interest charged. Debt grows over time, and net worth falls faster and faster.`;

      case 'budgetGap':
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
  }, [activeBehavior, activeSim, inputs, monthlyInterest]);

  // Format payoff timeline helper for rendering cards
  const formatPayoffSummary = (simObj) => {
    const sim = simObj.current;
    if (simObj.name === 'Budget Gap' && sim.yearlyData[30].balance > inputs.balance) {
      return `Grows to ${formatCurrency(sim.yearlyData[5].balance)} (5y)`;
    }
    if (sim.isPaidOff) {
      return formatPayoffText(sim.monthsToPayoff);
    }
    if (sim.yearlyData[30].balance > inputs.balance) {
      return `Grows to ${formatCurrency(sim.yearlyData[5].balance)} (5y)`;
    }
    return 'Never';
  };

  const getScenarioStatus = (key, simObj) => {
    const sim = simObj.current;
    if (key === 'payInFull') {
      return { label: 'Interest-Free', class: 'status-success' };
    }
    if (key === 'budgetGap' && sim.yearlyData[30].balance > inputs.balance) {
      return { label: 'Compounding Spiral', class: 'status-danger' };
    }
    if (sim.isPaidOff) {
      return { label: 'Decreasing', class: 'status-success' };
    }
    if (sim.yearlyData[30].balance > inputs.balance) {
      return { label: 'Growing Slowly', class: 'status-warning' };
    }
    return { label: 'Stuck Forever', class: 'status-neutral' };
  };

  // Compute metric values for the Drag Metrics Cards
  const annualDrag = activeSim.current.annualInterestYear1;
  const lifetimeDrag = activeSim.current.totalInterestPaid;
  const debtFreeDateText = activeSim.current.isPaidOff ? formatPayoffText(activeSim.current.monthsToPayoff) : 'Never';
  
  const interestSaved = useMemo(() => {
    const carryBaseline = simulations.carryBalance.base.totalInterestPaid;
    const currentInterest = activeSim.current.totalInterestPaid;
    return Math.max(0, carryBaseline - currentInterest);
  }, [simulations, activeSim]);

  return (
    <div className="credit-card-calculator" id="credit-card-calculator-main">

      <div className="dashboard-grid">
        {/* Left Column: Interactive Controls */}
        <div className="assumptions-section">
          <div className="glass-card">
            <div className="card-header-clean">
              <h3 className="card-title">Starting Debt & Behavior</h3>
              <button className="reset-btn" onClick={handleReset}>Reset All</button>
            </div>

            <div className="inputs-list">
              {/* Balance Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Current Balance</span>
                  <div className="input-field-wrap">
                    <span className="unit">$</span>
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.balance ?? ''}
                      onFocus={() => { activeFieldRef.current = 'balance'; }}
                      onChange={(e) => handleInputChange('balance', e.target.value)}
                      onBlur={() => handleBlur('balance')}
                      id="cc-input-balance"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="500"
                  max="50000"
                  step="500"
                  className="custom-range"
                  value={inputs.balance}
                  onChange={(e) => handleInputChange('balance', e.target.value)}
                  id="cc-slider-balance"
                />
              </div>

              {/* APR Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Annual APR</span>
                  <div className="input-field-wrap">
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.apr ?? ''}
                      onFocus={() => { activeFieldRef.current = 'apr'; }}
                      onChange={(e) => handleInputChange('apr', e.target.value)}
                      onBlur={() => handleBlur('apr')}
                      id="cc-input-apr"
                    />
                    <span className="unit">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="36"
                  step="0.5"
                  className="custom-range"
                  value={inputs.apr}
                  onChange={(e) => handleInputChange('apr', e.target.value)}
                  id="cc-slider-apr"
                />
              </div>

              {/* Monthly Payment Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Minimum Monthly Payment</span>
                  <div className="input-field-wrap">
                    <span className="unit">$</span>
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.monthlyPayment ?? ''}
                      onFocus={() => { activeFieldRef.current = 'monthlyPayment'; }}
                      onChange={(e) => handleInputChange('monthlyPayment', e.target.value)}
                      onBlur={() => handleBlur('monthlyPayment')}
                      id="cc-input-payment"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="10"
                  max={Math.max(2000, inputs.balance)}
                  step="10"
                  className="custom-range"
                  value={inputs.monthlyPayment}
                  onChange={(e) => handleInputChange('monthlyPayment', e.target.value)}
                  id="cc-slider-payment"
                />
              </div>

              {/* Monthly New Debt Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Monthly New Spending</span>
                  <div className="input-field-wrap">
                    <span className="unit">$</span>
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.monthlyNewDebt ?? ''}
                      onFocus={() => { activeFieldRef.current = 'monthlyNewDebt'; }}
                      onChange={(e) => handleInputChange('monthlyNewDebt', e.target.value)}
                      onBlur={() => handleBlur('monthlyNewDebt')}
                      id="cc-input-newdebt"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="10"
                  className="custom-range"
                  value={inputs.monthlyNewDebt}
                  onChange={(e) => handleInputChange('monthlyNewDebt', e.target.value)}
                  id="cc-slider-newdebt"
                />
              </div>


            </div>

            {/* Interest Threshold Helper Card */}
            <div className="interest-threshold-alert">
              <span className="alert-icon">💡</span>
              <span className="alert-text">
                Your monthly interest charges start at <strong>{formatCurrency(monthlyInterest)}</strong>. Any payment below this amount triggers an <strong>Interest Trap</strong>.
              </span>
            </div>

            {/* Manual Override Reclassification Indicator */}
            {isManualOverride && (
              <div className="manual-override-note" id="cc-manual-override-note">
                <span className="override-icon">✏️</span>
                <span className="override-text">
                  Your inputs now match <strong>{BEHAVIOR_METADATA[activeBehavior].name}</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Prominent Extra Payment Box */}
          <div className="glass-card extra-payment-card">
            <div className="extra-payment-title-row">
              <span className="extra-payment-badge">OPTIMIZE</span>
              <h3 className="extra-payment-title">Extra Payment Per Month</h3>
            </div>
            
            <div className="extra-value-display">
              <span className="extra-dollar">+ {formatCurrency(inputs.extraPayment)}</span>
              <span className="extra-freq">/ month</span>
            </div>

            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              className="custom-range extra-payment-range"
              value={inputs.extraPayment}
              onChange={(e) => handleInputChange('extraPayment', e.target.value)}
              id="cc-slider-extrapayment"
            />
            
            <p className="extra-help-text">Increase this slider to see how small additional payments crush the interest compounds and accelerate your payoff date.</p>
          </div>
        </div>

        {/* Right Column: Visualization & Insights */}
        <div className="results-display">
          
          {/* Detailed Behavior Selector Cards */}
          <div className="behavior-cards-grid">
            {Object.keys(simulations).map((key) => {
              const simObj = simulations[key];
              const isActive = activeBehavior === key;
              const status = getScenarioStatus(key, simObj);
              const meta = BEHAVIOR_METADATA[key];

              return (
                <div
                  key={key}
                  className={`behavior-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleBehaviorCardClick(key)}
                  style={{ '--border-glow': getLineColors(key) }}
                  id={`cc-scenario-card-${key}`}
                >
                  <div className="behavior-card-header">
                    <span className="behavior-icon">{meta.icon}</span>
                    <span className="behavior-name-text">{meta.name}</span>
                  </div>
                  <p className="behavior-description">{meta.description}</p>
                  <div className="behavior-rule-badge">
                    <span className="rule-label">Rule:</span> {meta.rule}
                  </div>
                  <div className="behavior-outcome-preview">
                    <span className="outcome-label">Outcome preview:</span>
                    <div className="outcome-details">
                      <span className="outcome-timeline">{formatPayoffSummary(simObj)}</span>
                      <span className={`status-badge ${status.class}`}>{status.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Metric Dashboard block */}
          <div className="cc-metrics-dashboard">
            <div className="cc-metric-card border-amber">
              <span className="cc-metric-title">Annual Credit Card Drag</span>
              <span className="cc-metric-value text-amber">{formatCurrency(annualDrag)} / yr</span>
              <span className="cc-metric-subtitle">Interest paid in Year 1</span>
            </div>

            <div className="cc-metric-card border-rose">
              <span className="cc-metric-title">Lifetime Credit Card Drag</span>
              <span className="cc-metric-value text-rose">{formatCurrency(lifetimeDrag)}</span>
              <span className="cc-metric-subtitle">Total interest paid</span>
            </div>

            <div className="cc-metric-card border-primary">
              <span className="cc-metric-title">Debt-Free Date</span>
              <span className="cc-metric-value text-primary">{debtFreeDateText}</span>
              <span className="cc-metric-subtitle">Payoff timeline duration</span>
            </div>

            <div className="cc-metric-card border-emerald">
              <span className="cc-metric-title">Interest Saved</span>
              <span className="cc-metric-value text-emerald">{formatCurrency(interestSaved)}</span>
              <span className="cc-metric-subtitle">Compared to Carry Balance</span>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="cc-chart-tabs" id="cc-chart-tabs-nav">
            <button
              className={`cc-tab-btn ${activeTab === 'drag' ? 'active' : ''}`}
              onClick={() => setActiveTab('drag')}
              id="cc-tab-btn-drag"
            >
              📉 Credit Card Drag
            </button>
            <button
              className={`cc-tab-btn ${activeTab === 'balance' ? 'active' : ''}`}
              onClick={() => setActiveTab('balance')}
              id="cc-tab-btn-balance"
            >
              💳 Debt Balance
            </button>
            <button
              className={`cc-tab-btn ${activeTab === 'payoff' ? 'active' : ''}`}
              onClick={() => setActiveTab('payoff')}
              id="cc-tab-btn-payoff"
            >
              📊 Alternate Payoffs
            </button>
          </div>

          {/* Chart 1: Debt Balance Over Time */}
          {activeTab === 'balance' && (
            <div className="glass-card chart-card" id="cc-balance-chart-card">
              <div className="chart-header-row">
                <div>
                  <h3 className="card-title">Debt Balance Over Time</h3>
                  <span className="chart-subtitle">Comparing remaining debt balance profiles over 5 years</span>
                </div>

                <div className="chart-controls">
                  <label className="toggle-label-checkbox compare-toggle" id="cc-compare-toggle">
                    <input
                      type="checkbox"
                      checked={compareMode}
                      onChange={(e) => setCompareMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    🔄 Compare all behaviors
                  </label>
                  <label className="toggle-label-checkbox">
                    <input
                      type="checkbox"
                      checked={colorBlindMode}
                      onChange={(e) => setColorBlindMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    👁️ Color-blind Mode
                  </label>
                </div>
              </div>

              <div className="chart-container-inner" style={{ height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      type="number"
                      dataKey="year"
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: 'var(--text-tertiary)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={formatYAxis}
                      width={55}
                      domain={[0, yAxisBoundsAt36.maxBalance]}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="custom-chart-tooltip">
                              <p className="tooltip-year-label"><strong>Year {label}</strong></p>
                              {payload.map((entry, index) => (
                                <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
                                  {entry.name}: <strong>{formatCurrency(entry.value)}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-body)', paddingTop: 10 }}
                    />
                    
                    {(!compareMode ? ['payInFull', 'paydown', 'slowPaydown', 'carryBalance', 'interestTrap', 'budgetGap'].filter(k => k === activeBehavior) : ['payInFull', 'paydown', 'slowPaydown', 'carryBalance', 'interestTrap', 'budgetGap']).map((key) => {
                      const simName = simulations[key].name;
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={simName}
                          name={simName}
                          stroke={getLineColors(key)}
                          strokeWidth={activeBehavior === key ? 3.5 : 1.5}
                          dot={false}
                          activeDot={{ r: 6 }}
                        />
                      );
                    })}
                    <Line
                      type="monotone"
                      dataKey="Pay in Full"
                      name="Pay in Full"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />

                    <ReferenceLine x={0} stroke="var(--border-color)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Chart 2: Credit Card Drag Over Time */}
          {activeTab === 'drag' && (
            <div className="glass-card chart-card" id="cc-drag-chart-card">
              <div className="chart-header-row">
                <div>
                  <h3 className="card-title">Credit Card Drag Over Time</h3>
                  <span className="chart-subtitle">Net worth impact of different credit card payment behaviors</span>
                </div>

                <div className="chart-controls">
                  <label className="toggle-label-checkbox compare-toggle" id="cc-compare-toggle-drag">
                    <input
                      type="checkbox"
                      checked={compareMode}
                      onChange={(e) => setCompareMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    🔄 Compare all behaviors
                  </label>
                  <label className="toggle-label-checkbox">
                    <input
                      type="checkbox"
                      checked={colorBlindMode}
                      onChange={(e) => setColorBlindMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    👁️ Color-blind Mode
                  </label>
                </div>
              </div>

              <div className="chart-container-inner" style={{ height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      type="number"
                      dataKey="year"
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: 'var(--text-tertiary)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={formatYAxis}
                      width={55}
                      domain={[yAxisBoundsAt36.minNetWorth, inputs.startingCash - inputs.balance]}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="custom-chart-tooltip">
                              <p className="tooltip-year-label"><strong>Year {label}</strong></p>
                              {payload.map((entry, index) => (
                                <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
                                  {entry.name.replace(' NW', '')}: <strong>{formatCurrency(entry.value)}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-body)', paddingTop: 10 }}
                    />
                    
                    {(!compareMode ? ['payInFull', 'paydown', 'slowPaydown', 'carryBalance', 'interestTrap', 'budgetGap'].filter(k => k === activeBehavior) : ['payInFull', 'paydown', 'slowPaydown', 'carryBalance', 'interestTrap', 'budgetGap']).map((key) => {
                      const simName = simulations[key].name;
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={`${simName} NW`}
                          name={simName}
                          stroke={getLineColors(key)}
                          strokeWidth={activeBehavior === key ? 3.5 : 1.5}
                          dot={false}
                          activeDot={{ r: 6 }}
                        />
                      );
                    })}
                    <Line
                      type="monotone"
                      dataKey="Pay in Full NW"
                      name="Pay in Full"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />

                    <ReferenceLine x={0} stroke="var(--border-color)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Chart 3: Alternate Payoff Scenarios */}
          {activeTab === 'payoff' && (
            <div className="glass-card chart-card alternate-payoff-scenarios-card" id="cc-payoff-scenarios-card">
              <div className="chart-header-row">
                <div>
                  <h3 className="card-title">Alternate Payoff Scenarios</h3>
                  <span className="chart-subtitle">Monthly payment required to pay off debt in 1 to 5 years</span>
                </div>
              </div>

              <div className="chart-container-inner" style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={payoffScenariosData}
                    margin={{ top: 30, right: 10, left: 10, bottom: 5 }}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={(val) => `$${val}`}
                      domain={[0, Math.ceil(yAxisBoundsAt36.maxPayoffPayment * 1.15)]}
                    />
                    <Bar dataKey="payment" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {payoffScenariosData.map((entry, index) => {
                        const isHovered = hoveredBar === index;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            onMouseEnter={() => setHoveredBar(index)}
                            style={{
                              filter: isHovered 
                                ? `drop-shadow(0 0 10px ${entry.color}) brightness(1.2)` 
                                : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          />
                        );
                      })}
                      <LabelList
                        dataKey="payment"
                        position="top"
                        formatter={(val) => formatCurrency(val)}
                        style={{ fill: 'var(--text-primary)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Behavior-Specific Educational Explanation Card */}
          <div className="glass-card behavior-explanation-card" id="cc-behavior-explanation-card" style={{ borderLeftColor: getLineColors(activeBehavior) }}>
            <h4 className="explanation-title" style={{ color: getLineColors(activeBehavior) }}>
              {BEHAVIOR_METADATA[activeBehavior].name} Explanation
            </h4>
            <p className="explanation-text">
              {EDUCATIONAL_EXPLANATIONS[activeBehavior]}
            </p>
          </div>

          {/* Educational Callout Block */}
          <div className="glass-card cc-drag-callout-card">
            <h4 className="cc-callout-title">What is Credit Card Drag?</h4>
            <div className="cc-callout-body">
              <p>Every dollar paid toward principal simply transfers money from cash to debt, keeping your total net worth identical.</p>
              <p className="highlight-text">Every dollar paid in interest permanently reduces net worth.</p>
              <p><strong>Credit Card Drag</strong> is the wealth lost to credit card interest over time. Reducing high-interest debt reduces future drag and improves long-term financial outcomes.</p>
            </div>
          </div>

          {/* Educational Insights Box */}
          <div className="glass-card active-insights-card" style={{ borderLeft: `5px solid ${getLineColors(activeBehavior)}` }}>
            <div className="insights-header">
              <span className="insights-bulb">💡</span>
              <h4 className="insights-title">Insights: {activeSim.name}</h4>
            </div>

            <div className="insights-content-layout">
              <div className="insights-text-block">
                <p className="educational-insight-text">{educationalInsights}</p>
              </div>

              {/* Scenario details dashboard */}
              <div className="insights-metrics-panel">
                {activeBehavior === 'payInFull' || activeBehavior === 'paydown' || activeBehavior === 'slowPaydown' || activeBehavior === 'carryBalance' ? (
                  <>
                    <div className="insight-metric">
                      <span className="metric-label">Debt-Free Timeline</span>
                      <span className="metric-value">
                        {debtFreeDateText}
                      </span>
                      {inputs.extraPayment > 0 && activeSim.base.isPaidOff && (
                        <span className="metric-comparison">
                          Saved {((activeSim.base.monthsToPayoff - activeSim.current.monthsToPayoff) / 12).toFixed(1)} years
                        </span>
                      )}
                      {inputs.extraPayment > 0 && !activeSim.base.isPaidOff && activeSim.current.isPaidOff && (
                        <span className="metric-comparison">
                          Broke infinite debt cycle!
                        </span>
                      )}
                    </div>
                    
                    <div className="insight-metric">
                      <span className="metric-label">Total Interest Paid</span>
                      <span className="metric-value">{formatCurrency(lifetimeDrag)}</span>
                      {inputs.extraPayment > 0 && (
                        <span className="metric-comparison positive">
                          Saved {formatCurrency(Math.max(0, activeSim.base.totalInterestPaid - activeSim.current.totalInterestPaid))}
                        </span>
                      )}
                    </div>

                    <div className="insight-metric">
                      <span className="metric-label">Total Payments Made</span>
                      <span className="metric-value">{formatCurrency(activeSim.current.totalPayments)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="insight-metric">
                      <span className="metric-label">Debt Growth (Year 1)</span>
                      <span className="metric-value text-danger">
                        +{formatCurrency(activeSim.current.debtAfter1Year - inputs.balance)}
                      </span>
                    </div>
                    
                    <div className="insight-metric">
                      <span className="metric-label">Debt After 5 Years</span>
                      <span className="metric-value text-danger">
                        {formatCurrency(activeSim.current.debtAfter5Years)}
                      </span>
                    </div>

                    <div className="insight-metric">
                      <span className="metric-label">Debt After 10 Years</span>
                      <span className="metric-value text-danger">
                        {formatCurrency(activeSim.current.debtAfter10Years)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* General tips panel */}
            <div className="insights-action-tips">
              <span className="tip-badge">EDUCATIONAL TAKEAWAY</span>
              <p className="tip-message">
                {activeBehavior === 'payInFull' && "Paying your statement balance in full every month is the single best credit card habit. You completely avoid interest charges, meaning you use the bank's money for free during the grace period."}
                {activeBehavior === 'paydown' && "Paying extra is the fastest way to reduce principal. Every dollar added directly reduces the amount that interest accumulates on, halting wealth decay."}
                {activeBehavior === 'slowPaydown' && "When payments only slightly exceed interest, interest compounds consume almost your entire payment. You end up renting your debt and leaking wealth for decades."}
                {activeBehavior === 'carryBalance' && "This is a common trap. Paying only interest keeps the principal completely intact. You make payments, but your net worth falls continuously."}
                {activeBehavior === 'interestTrap' && "This occurs when minimum payments are set below interest charges. The debt expands automatically, eating into your future wealth."}
                {activeBehavior === 'budgetGap' && "This is the most critical pattern to break. Adding new debt while carrying a balance creates a compounding cycle that escalates rapidly, destroying net worth."}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
