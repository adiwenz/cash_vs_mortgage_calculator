/**
 * Financial Calculation Engine for Cash vs. Mortgage Calculator
 */

/**
 * Calculates the monthly mortgage payment (P&I)
 * Formula: P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function calculateMonthlyPayment(principal, annualRate, termYears) {
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
export function calculateTaxPaid(netCashNeeded, capitalGainsRate, taxablePortion) {
  const effectiveTaxRate = capitalGainsRate * taxablePortion;
  if (effectiveTaxRate >= 1) return 0; // Prevent division by zero
  return netCashNeeded * (effectiveTaxRate / (1 - effectiveTaxRate));
}

/**
 * Computes the year-by-year comparison data for the 2 scenarios
 */
export function calculateScenarios(inputs) {
  const {
    homePrice,
    downPaymentPercent,
    mortgageTerm,
    mortgageRate,
    stockReturn,
    homeAppreciation,
    propertyTaxRate,
    insuranceRate,
    cashBuyerInitialStock,
    mortgageBuyerInitialStock,
    cashPurchaseDiscount,
    capitalGainsRate,
    taxablePortion
  } = inputs;

  const yearsToCompute = Math.max(30, mortgageTerm); // compute at least 30 years to show long term growth
  const data = [];

  // Day 1 (Year 0) Calculations
  // Merged Cash Buyer purchases home at (Home Price - Cash Purchase Discount)
  const cashBuyerPrice = homePrice - cashPurchaseDiscount;
  const cashBuyerTax = calculateTaxPaid(cashBuyerPrice, capitalGainsRate, taxablePortion);
  
  const downPaymentAmount = homePrice * downPaymentPercent;
  const mortgageBuyerTax = calculateTaxPaid(downPaymentAmount, capitalGainsRate, taxablePortion);
  
  const initialUninvestedAmount = mortgageBuyerInitialStock - mortgageBuyerTax;
  const mortgagePrincipal = homePrice - downPaymentAmount;
  const monthlyPmt = calculateMonthlyPayment(mortgagePrincipal, mortgageRate, mortgageTerm);
  const annualPI = monthlyPmt * 12;

  // Set up Year 0 values
  // Cash buyer starts with stock equal to the cash purchase discount (if any)
  let cashBuyerStock = cashPurchaseDiscount;
  let mortgageBuyerStock = initialUninvestedAmount;

  data.push({
    year: 0,
    homeValue: homePrice,
    mortgageBalance: mortgagePrincipal,
    
    // Stocks
    cashBuyerStock,
    mortgageBuyerStock,
    
    // Net Worths
    cashBuyerNW: homePrice + cashBuyerStock - cashBuyerTax,
    mortgageBuyerNW: homePrice + mortgageBuyerStock - mortgagePrincipal
  });

  // Calculate year by year
  for (let y = 1; y <= yearsToCompute; y++) {
    const homeValue = homePrice * Math.pow(1 + homeAppreciation, y);
    const mortgageBalance = calculateRemainingBalance(mortgagePrincipal, mortgageRate, mortgageTerm, y);
    
    // Cash buyer savings additions (only during the mortgage term, i.e. when they are "saving" the mortgage payment)
    const annualSavingsAdd = y <= mortgageTerm ? annualPI : 0;

    // Stock returns
    cashBuyerStock = cashBuyerStock * (1 + stockReturn) + annualSavingsAdd;
    mortgageBuyerStock = mortgageBuyerStock * (1 + stockReturn);

    // Net Worth Calculations
    data.push({
      year: y,
      homeValue,
      mortgageBalance,
      
      // Stock Portfolio values for reference
      cashBuyerStock,
      mortgageBuyerStock,

      // Net Worths
      cashBuyerNW: homeValue + cashBuyerStock - cashBuyerTax,
      mortgageBuyerNW: homeValue + mortgageBuyerStock - mortgageBalance
    });
  }

  return {
    annualPI,
    cashBuyerTax,
    mortgageBuyerTax,
    initialUninvestedAmount,
    data
  };
}
