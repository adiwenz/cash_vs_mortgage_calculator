/**
 * Financial Calculation Engine for Cash vs. Mortgage Calculator
 */

/**
 * Calculates the monthly mortgage payment (P&I)
 * Formula: P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function calculateMonthlyPayment(principal, annualRate, termYears) {
  if (termYears <= 0) return 0;
  if (annualRate === 0) return principal / (termYears * 12);
  const r = annualRate / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Calculates the remaining mortgage balance after a given number of years
 * Formula: PMT * (1 - (1+r)^-remaining_months) / r
 */
export function calculateRemainingBalance(principal, annualRate, termYears, elapsedYears) {
  if (termYears <= 0) return 0;
  if (elapsedYears >= termYears) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  const elapsedMonths = elapsedYears * 12;
  const remainingMonths = n - elapsedMonths;
  const pmt = calculateMonthlyPayment(principal, annualRate, termYears);
  if (r === 0) return pmt * remainingMonths;
  return pmt * (1 - Math.pow(1 + r, -remainingMonths)) / r;
}

/**
 * Calculates capital gains tax for liquidating a certain net cash amount
 * Net Cash = Gross Liquidation - Tax
 * Gross Liquidation = Net Cash / (1 - EffectiveTaxRate)
 * Tax = Gross Liquidation * EffectiveTaxRate = Net Cash * EffectiveTaxRate / (1 - EffectiveTaxRate)
 */
export function calculateTaxPaid(netCashNeeded, effectiveTaxRate) {
  if (effectiveTaxRate >= 1) return 0; // Prevent division by zero
  return netCashNeeded * (effectiveTaxRate / (1 - effectiveTaxRate));
}

/**
 * Computes the year-by-year comparison data for the 2 scenarios based on active decisions
 */
export function calculateScenarios(inputs, mortgageLeftoverDest, cashSavingsDest) {
  const {
    homePrice,
    downPaymentPercent,
    mortgageTerm,
    mortgageRate,
    stockReturn,
    homeAppreciation,
    propertyTaxRate,
    insuranceRate,
    investmentPortfolioValue,
    investmentCostBasis,
    cashPurchaseDiscount,
    capitalGainsRate,
    savingsRate
  } = inputs;

  const yearsToCompute = Math.max(30, mortgageTerm); // compute at least 30 years to show long term growth
  const data = [];

  // Calculate Gain Ratio of the portfolio
  const portfolioGain = Math.max(0, investmentPortfolioValue - investmentCostBasis);
  const gainRatio = investmentPortfolioValue > 0 ? portfolioGain / investmentPortfolioValue : 0;
  const effectiveTaxRate = capitalGainsRate * gainRatio;

  // Day 1 (Year 0) Calculations
  const cashBuyerPrice = homePrice - cashPurchaseDiscount;
  const cashBuyerTax = calculateTaxPaid(cashBuyerPrice, effectiveTaxRate);
  const cashBuyerGrossSold = cashBuyerPrice + cashBuyerTax;
  
  const downPaymentAmount = homePrice * downPaymentPercent;
  const mortgageBuyerTax = calculateTaxPaid(downPaymentAmount, effectiveTaxRate);
  const mortgageBuyerGrossSold = downPaymentAmount + mortgageBuyerTax;
  
  const mortgagePrincipal = homePrice - downPaymentAmount;
  const monthlyPmt = calculateMonthlyPayment(mortgagePrincipal, mortgageRate, mortgageTerm);
  const annualPI = monthlyPmt * 12;

  // Determine Growth Rates based on Radio Decisions ('invest', 'savings', 'cash')
  const getGrowthRate = (dest) => {
    if (dest === 'invest') return stockReturn;
    if (dest === 'savings') return savingsRate;
    return 0; // 'cash'
  };

  const cashBuyerStockRate = getGrowthRate(cashSavingsDest);
  const mortgageBuyerStockRate = getGrowthRate(mortgageLeftoverDest);

  // Set up Year 0 values
  let cashBuyerStock = investmentPortfolioValue - cashBuyerGrossSold;
  let mortgageBuyerStock = investmentPortfolioValue - mortgageBuyerGrossSold;

  data.push({
    year: 0,
    homeValue: homePrice,
    mortgageBalance: mortgagePrincipal,
    
    // Stocks
    cashBuyerStock,
    mortgageBuyerStock,
    
    // Net Worths
    cashBuyerNW: homePrice + cashBuyerStock,
    mortgageBuyerNW: homePrice + mortgageBuyerStock - mortgagePrincipal
  });

  // Calculate year by year
  for (let y = 1; y <= yearsToCompute; y++) {
    const homeValue = homePrice * Math.pow(1 + homeAppreciation, y);
    const mortgageBalance = calculateRemainingBalance(mortgagePrincipal, mortgageRate, mortgageTerm, y);
    
    // Cash buyer savings additions (only during the mortgage term)
    const annualSavingsAdd = y <= mortgageTerm ? annualPI : 0;

    // Calculate annual property tax and insurance costs based on current home value
    const propertyTax = homeValue * propertyTaxRate;
    const insurance = homeValue * insuranceRate;
    const annualExpenses = propertyTax + insurance;

    // Compound stock portfolios and subtract annual expenses
    cashBuyerStock = cashBuyerStock * (1 + cashBuyerStockRate) + annualSavingsAdd - annualExpenses;
    mortgageBuyerStock = mortgageBuyerStock * (1 + mortgageBuyerStockRate) - annualExpenses;

    // Net Worth Calculations
    data.push({
      year: y,
      homeValue,
      mortgageBalance,
      
      // Stock Portfolio values for reference
      cashBuyerStock,
      mortgageBuyerStock,

      // Net Worths
      cashBuyerNW: homeValue + cashBuyerStock,
      mortgageBuyerNW: homeValue + mortgageBuyerStock - mortgageBalance
    });
  }

  return {
    annualPI,
    cashBuyerTax,
    mortgageBuyerTax,
    cashBuyerStartingStock: investmentPortfolioValue - cashBuyerGrossSold,
    mortgageBuyerStartingStock: investmentPortfolioValue - mortgageBuyerGrossSold,
    data
  };
}

export function validateInputs(inputs) {
  const errors = [];
  const warnings = [];
  const info = [];

  const {
    homePrice,
    downPaymentPercent,
    mortgageTerm,
    mortgageRate,
    stockReturn,
    homeAppreciation,
    propertyTaxRate,
    insuranceRate,
    investmentPortfolioValue,
    investmentCostBasis,
    cashPurchaseDiscount,
    capitalGainsRate,
    savingsRate
  } = inputs;

  // --- Investment Liquidation Errors & Warnings ---
  // 1. Portfolio Value is less than or equal to 0
  if (investmentPortfolioValue <= 0) {
    errors.push("Enter a portfolio value greater than $0.");
  }

  // 2. Cost Basis is less than 0
  if (investmentCostBasis < 0) {
    errors.push("Cost basis cannot be negative.");
  }

  // 3. Cost Basis is greater than Portfolio Value
  if (investmentPortfolioValue > 0 && investmentCostBasis > investmentPortfolioValue) {
    warnings.push("Your cost basis is higher than your portfolio value, which means this investment has an unrealized loss. Capital gains tax will be treated as $0.");
  }

  // Calculate Gain Ratio of the portfolio for validation steps 4, 5, 9
  const portfolioGain = Math.max(0, investmentPortfolioValue - investmentCostBasis);
  const gainRatio = investmentPortfolioValue > 0 ? portfolioGain / investmentPortfolioValue : 0;
  const effectiveTaxRate = capitalGainsRate * gainRatio;

  // 4. Portfolio Value is less than home price for cash purchase
  const cashBuyerPrice = homePrice - cashPurchaseDiscount;
  if (investmentPortfolioValue > 0 && investmentPortfolioValue < cashBuyerPrice) {
    errors.push("Your portfolio is not large enough to buy this home in cash.");
  }

  // 5. Portfolio Value is not enough to cover home price plus estimated tax
  if (investmentPortfolioValue > 0 && investmentPortfolioValue >= cashBuyerPrice) {
    const cashBuyerTax = calculateTaxPaid(cashBuyerPrice, effectiveTaxRate);
    const cashBuyerGrossSold = cashBuyerPrice + cashBuyerTax;
    if (investmentPortfolioValue < cashBuyerGrossSold) {
      errors.push("After estimated capital gains tax, your portfolio is not large enough to complete a cash purchase.");
    }
  }

  // --- Down Payment Errors ---
  // 6. Down payment percent is less than 0%
  if (downPaymentPercent < 0) {
    errors.push("Down payment cannot be negative.");
  }

  // 7. Down payment percent is greater than 100%
  if (downPaymentPercent > 1) {
    errors.push("Down payment cannot be more than 100% of the home price.");
  }

  // 8. Down payment amount is greater than portfolio value
  const downPaymentAmount = homePrice * downPaymentPercent;
  if (downPaymentPercent >= 0 && downPaymentPercent <= 1 && investmentPortfolioValue > 0 && downPaymentAmount > investmentPortfolioValue) {
    errors.push("Your portfolio is not large enough to fund this down payment.");
  }

  // 9. Portfolio is not enough to cover down payment plus estimated tax
  if (downPaymentPercent >= 0 && downPaymentPercent <= 1 && investmentPortfolioValue > 0 && downPaymentAmount <= investmentPortfolioValue) {
    const mortgageBuyerTax = calculateTaxPaid(downPaymentAmount, effectiveTaxRate);
    const mortgageBuyerGrossSold = downPaymentAmount + mortgageBuyerTax;
    if (investmentPortfolioValue < mortgageBuyerGrossSold) {
      errors.push("After estimated capital gains tax, your portfolio is not large enough to fund this down payment.");
    }
  }

  // --- Mortgage Errors ---
  // 10. Home price is less than or equal to 0
  if (homePrice <= 0) {
    errors.push("Enter a home price greater than $0.");
  }

  // 11. Mortgage term is less than or equal to 0
  if (mortgageTerm <= 0) {
    errors.push("Mortgage term must be greater than 0 years.");
  }

  // 12. Mortgage rate is less than 0%
  if (mortgageRate < 0) {
    errors.push("Mortgage rate cannot be negative.");
  }

  // 13. Mortgage rate is unusually high (> 15%)
  if (mortgageRate > 0.15) {
    warnings.push("This mortgage rate is unusually high. Double-check that you entered the rate correctly.");
  }

  // --- Tax Errors ---
  // 14. Capital gains tax rate is less than 0%
  if (capitalGainsRate < 0) {
    errors.push("Capital gains tax rate cannot be negative.");
  }

  // 15. Capital gains tax rate is greater than 100%
  if (capitalGainsRate > 1.0) {
    errors.push("Capital gains tax rate cannot be more than 100%.");
  }

  // --- Investment Return Warnings ---
  // 16. Stock market return is less than 0%
  if (stockReturn < 0) {
    warnings.push("You entered a negative stock return. This is allowed, but the investment account will shrink over time.");
  }

  // 17. Stock market return is unusually high (> 12%)
  if (stockReturn > 0.12) {
    warnings.push("This stock return is very high. Long-term projections may look overly optimistic.");
  }

  // 18. Savings account return is greater than stock market return
  if (savingsRate > stockReturn) {
    warnings.push("Your savings account return is higher than your stock market return. This may be possible short-term, but it is unusual over long periods.");
  }

  // --- Property Cost Warnings ---
  // 19. Property tax rate is unusually high (> 3%)
  if (propertyTaxRate > 0.03) {
    warnings.push("This property tax rate is high and may significantly affect affordability.");
  }

  // 20. Insurance rate is unusually high (> 2%)
  if (insuranceRate > 0.02) {
    warnings.push("This insurance rate is high and may significantly affect affordability.");
  }

  return {
    errors,
    warnings,
    info
  };
}

export function validateMortgageScenario(scenario) {
  const errors = [];
  const {
    homePrice,
    downPaymentPercent,
    mortgageRate,
    mortgageTerm,
    cashAvailableToday,
    amountInvestedOutside,
    amountKeptInSavings
  } = scenario;

  if (homePrice <= 0) {
    errors.push("Home price must be greater than $0.");
  }
  if (downPaymentPercent < 0) {
    errors.push("Down payment cannot be negative.");
  }
  if (downPaymentPercent > 1.0) {
    errors.push("Down payment cannot exceed 100%.");
  }
  if (mortgageRate < 0) {
    errors.push("Mortgage rate cannot be negative.");
  }
  if (mortgageTerm <= 0) {
    errors.push("Mortgage term must be greater than 0.");
  }

  const downPaymentAmount = homePrice * downPaymentPercent;
  const cashAllocated = downPaymentAmount + amountInvestedOutside + amountKeptInSavings;
  if (cashAllocated > cashAvailableToday) {
    errors.push("Cash allocated to down payment, investments, and savings cannot exceed total cash available.");
  }

  return errors;
}

export function calculateMortgageScenarioData(scenario) {
  const {
    homePrice,
    downPaymentPercent,
    mortgageRate,
    mortgageTerm,
    homeAppreciation,
    stockReturn,
    savingsRate,
    amountInvestedOutside,
    amountKeptInSavings
  } = scenario;

  const data = [];
  const loanAmount = Math.max(0, homePrice - (homePrice * downPaymentPercent));
  const monthlyPI = calculateMonthlyPayment(loanAmount, mortgageRate, mortgageTerm);
  const annualPI = monthlyPI * 12;

  // Let's compute up to 30 years
  const yearsToCompute = 30;

  // Year 0
  data.push({
    year: 0,
    homeValue: homePrice,
    mortgageBalance: loanAmount,
    homeEquity: homePrice - loanAmount,
    investmentValue: amountInvestedOutside,
    savingsValue: amountKeptInSavings,
    netWorth: (homePrice - loanAmount) + amountInvestedOutside + amountKeptInSavings,
    interestPaidThisYear: 0,
    cumulativeInterestPaid: 0
  });

  let currentInvestments = amountInvestedOutside;
  let currentSavings = amountKeptInSavings;

  for (let y = 1; y <= yearsToCompute; y++) {
    const homeValue = homePrice * Math.pow(1 + homeAppreciation, y);
    const mortgageBalance = calculateRemainingBalance(loanAmount, mortgageRate, mortgageTerm, y);
    const homeEquity = homeValue - mortgageBalance;

    // Compounding investments and savings
    currentInvestments = currentInvestments * (1 + stockReturn);
    currentSavings = currentSavings * (1 + savingsRate);

    // Cumulative interest paid calculations
    // Payments made up to year y
    const paymentsMade = annualPI * Math.min(y, mortgageTerm);
    // Principal paid up to year y
    const principalPaid = loanAmount - mortgageBalance;
    const cumulativeInterestPaid = Math.max(0, paymentsMade - principalPaid);

    const netWorth = homeEquity + currentInvestments + currentSavings;

    data.push({
      year: y,
      homeValue,
      mortgageBalance,
      homeEquity,
      investmentValue: currentInvestments,
      savingsValue: currentSavings,
      netWorth,
      cumulativeInterestPaid
    });
  }

  // Calculate total interest paid over the life of the loan
  const totalInterestPaid = Math.max(0, (annualPI * mortgageTerm) - loanAmount);

  return {
    loanAmount,
    monthlyPI,
    totalInterestPaid,
    data
  };
}

/**
 * Validates inputs for the simple cash vs mortgage calculator
 */
export function validateSimpleInputs(inputs) {
  const errors = [];
  const {
    homePrice,
    downPaymentPercent,
    mortgageRate,
    mortgageTerm,
    stockReturn,
    savingsRate,
    cashPurchaseDiscount
  } = inputs;

  const discount = cashPurchaseDiscount || 0;

  if (homePrice <= 0) {
    errors.push("Home price must be greater than 0.");
  }
  if (downPaymentPercent < 0 || downPaymentPercent > 1.0) {
    errors.push("Down payment must be between 0% and 100%.");
  }
  if (mortgageRate < 0) {
    errors.push("Mortgage rate cannot be negative.");
  }
  if (mortgageTerm <= 0) {
    errors.push("Mortgage term must be greater than 0.");
  }
  if (stockReturn < -1.0) {
    errors.push("Stock market return cannot be less than -100%.");
  }
  if (savingsRate < -1.0) {
    errors.push("Savings account return cannot be less than -100%.");
  }
  if (discount > homePrice) {
    errors.push("Cash purchase discount cannot exceed the home price.");
  }

  return errors;
}

/**
 * Simple calculation engine for beginner/high school students
 */
export function calculateSimpleScenarios(inputs, mortgageLeftoverDest, cashSavingsDest) {
  const {
    homePrice,
    downPaymentPercent,
    mortgageRate,
    mortgageTerm,
    homeAppreciation,
    stockReturn,
    savingsRate,
    cashPurchaseDiscount
  } = inputs;

  const discount = cashPurchaseDiscount || 0;
  const data = [];
  const yearsToCompute = 30;

  const loanAmount = Math.max(0, homePrice - (homePrice * downPaymentPercent));
  const monthlyPI = calculateMonthlyPayment(loanAmount, mortgageRate, mortgageTerm);
  const annualPI = monthlyPI * 12;

  // Year 0
  let cashBuyerStock = discount;
  const mortgageRemainingCash = homePrice - (homePrice * downPaymentPercent);
  let mortgageBuyerStock = mortgageRemainingCash;

  data.push({
    year: 0,
    homeValue: homePrice,
    // Cash Buyer
    cashBuyerStock,
    cashBuyerNW: homePrice + cashBuyerStock,
    // Mortgage Buyer
    mortgageBalance: loanAmount,
    mortgageBuyerStock,
    mortgageBuyerNW: homePrice + mortgageBuyerStock - loanAmount,
    mortgageEquity: homePrice - loanAmount
  });

  const getGrowthRate = (dest) => {
    if (dest === 'invest') return stockReturn;
    if (dest === 'savings') return savingsRate;
    return 0; // 'none'
  };

  const cashBuyerStockRate = getGrowthRate(cashSavingsDest);
  const mortgageBuyerStockRate = getGrowthRate(mortgageLeftoverDest);

  let cashBuyerStockVal = cashBuyerStock;
  let mortgageBuyerStockVal = mortgageBuyerStock;

  for (let y = 1; y <= yearsToCompute; y++) {
    const homeValue = homePrice * Math.pow(1 + homeAppreciation, y);
    const mortgageBalance = calculateRemainingBalance(loanAmount, mortgageRate, mortgageTerm, y);
    const mortgageEquity = homeValue - mortgageBalance;

    // Cash Buyer compounding and adding avoided payment during term
    const annualSavingsAdd = y <= mortgageTerm ? annualPI : 0;
    cashBuyerStockVal = cashBuyerStockVal * (1 + cashBuyerStockRate) + annualSavingsAdd;

    // Mortgage Buyer compounding
    mortgageBuyerStockVal = mortgageBuyerStockVal * (1 + mortgageBuyerStockRate);

    data.push({
      year: y,
      homeValue,
      // Cash Buyer
      cashBuyerStock: cashBuyerStockVal,
      cashBuyerNW: homeValue + cashBuyerStockVal,
      // Mortgage Buyer
      mortgageBalance,
      mortgageBuyerStock: mortgageBuyerStockVal,
      mortgageBuyerNW: homeValue + mortgageBuyerStockVal - mortgageBalance,
      mortgageEquity
    });
  }

  return {
    loanAmount,
    monthlyPI,
    annualPI,
    data
  };
}

