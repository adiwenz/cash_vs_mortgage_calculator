/**
 * General-Purpose Debt Simulation Engine
 * Highly modular to support multiple debt types in the future.
 */

/**
 * Simulates a single debt over time.
 * 
 * @param {Object} params
 * @param {number} params.startingBalance - The initial debt balance ($)
 * @param {number} params.apr - Annual Percentage Rate (e.g., 0.24 for 24%)
 * @param {number} params.monthlyPayment - Base payment amount per month ($)
 * @param {number} params.monthlyNewDebt - New purchases/debt added per month ($)
 * @param {number} params.extraPayment - Extra payment per month ($)
 * @param {number} params.simulationYears - Number of years to chart/simulate (default: 30)
 * @param {number} params.startingCash - Initial cash reserve for net worth calculation (default: 0)
 * @returns {Object} Simulation results including year-by-year details and summary statistics
 */
export function simulateDebt({
  startingBalance,
  apr,
  monthlyPayment,
  monthlyNewDebt = 0,
  extraPayment = 0,
  simulationYears = 30,
  startingCash = 0
}) {
  const chartMonths = simulationYears * 12;
  const maxSimulationMonths = 100 * 12; // Safety limit of 100 years
  const monthlyRate = apr / 12;
  const targetPayment = Math.max(0, monthlyPayment + extraPayment);

  let balance = startingBalance;
  let cash = startingCash;
  let cumulativeInterest = 0;
  let cumulativePayments = 0;
  let interestYear1 = 0;
  let payoffMonth = null;
  
  // Track stats at the 30-year mark (or end of simulationYears)
  let interestAtSimulationEnd = 0;
  let paymentsAtSimulationEnd = 0;

  // Monthly history
  const monthlyHistory = [];
  
  // Month 0 (Starting State)
  monthlyHistory.push({
    month: 0,
    year: 0,
    balance: startingBalance,
    cash: startingCash,
    cumulativeInterest: 0,
    cumulativePayments: 0,
    netWorth: startingCash - startingBalance
  });

  for (let m = 1; m <= maxSimulationMonths; m++) {
    if (balance <= 0) {
      if (payoffMonth === null) {
        payoffMonth = m - 1;
      }
      
      // If we are past the chart years, we can break
      if (m > chartMonths) break;

      // Keep pushing entries up to chartMonths
      monthlyHistory.push({
        month: m,
        year: m / 12,
        balance: 0,
        cash,
        cumulativeInterest,
        cumulativePayments,
        netWorth: cash // Net worth is just cash since balance is 0
      });
      continue;
    }

    // Calculate interest for this month
    const interest = balance * monthlyRate;
    const totalDue = balance + interest + monthlyNewDebt;
    const actualPayment = Math.min(targetPayment, totalDue);
    const nextBalance = Math.max(0, totalDue - actualPayment);

    balance = nextBalance;
    cash = cash - actualPayment;
    cumulativeInterest += interest;
    cumulativePayments += actualPayment;

    // Sum interest paid in the first 12 months
    if (m <= 12) {
      interestYear1 += interest;
    }

    if (balance <= 0 && payoffMonth === null) {
      payoffMonth = m;
    }

    // Record stats at the end of simulationYears (e.g. 30 years)
    if (m === chartMonths) {
      interestAtSimulationEnd = cumulativeInterest;
      paymentsAtSimulationEnd = cumulativePayments;
    }

    // Record monthly entry if within chartYears
    if (m <= chartMonths) {
      monthlyHistory.push({
        month: m,
        year: m / 12,
        balance,
        cash,
        cumulativeInterest,
        cumulativePayments,
        netWorth: cash - balance
      });
    }
  }

  // If payoff occurred after chartMonths but before 100 years
  const isPaidOff = payoffMonth !== null && payoffMonth <= maxSimulationMonths;

  // Compile year-by-year data points (Year 0, 1, 2, ..., 30) for the charts
  const yearlyData = [];
  for (let y = 0; y <= simulationYears; y++) {
    const monthIndex = y * 12;
    const record = monthlyHistory.find(h => h.month === monthIndex) || monthlyHistory[monthlyHistory.length - 1];
    yearlyData.push({
      year: y,
      balance: Math.round(record.balance * 100) / 100,
      cash: Math.round(record.cash * 100) / 100,
      cumulativeInterest: Math.round(record.cumulativeInterest * 100) / 100,
      cumulativePayments: Math.round(record.cumulativePayments * 100) / 100,
      netWorth: Math.round(record.netWorth * 100) / 100
    });
  }

  // Get milestone values
  const getBalanceAtYear = (y) => {
    const dataPoint = yearlyData.find(d => d.year === y);
    return dataPoint ? dataPoint.balance : 0;
  };

  const debtAfter1Year = getBalanceAtYear(1);
  const debtAfter5Years = getBalanceAtYear(5);
  const debtAfter10Years = getBalanceAtYear(10);
  const annualDebtGrowth = Math.max(0, debtAfter1Year - startingBalance);

  return {
    isPaidOff,
    payoffMonth,
    monthsToPayoff: payoffMonth,
    totalInterestPaid: isPaidOff ? cumulativeInterest : interestAtSimulationEnd,
    totalPayments: isPaidOff ? cumulativePayments : paymentsAtSimulationEnd,
    yearlyData,
    debtAfter1Year,
    debtAfter5Years,
    debtAfter10Years,
    annualDebtGrowth,
    annualInterestYear1: interestYear1
  };
}
