/**
 * Mathematical Calculation Engine for the FIRE & Retirement Life Simulator (Refined for Cash Flow Planner)
 */

/**
 * Runs a year-by-year simulation from currentAge to lifeExpectancy.
 *
 * @param {Object} inputs - All parameters entered by the user
 * @returns {Object} Results containing year-by-year breakdown and summary metrics
 */
const U_S_TAX_DATA = {
  single: {
    standardDeduction: 16100,
    brackets: [
      { limit: 12400, rate: 0.10 },
      { limit: 50400, rate: 0.12 },
      { limit: 105700, rate: 0.22 },
      { limit: 201775, rate: 0.24 },
      { limit: 256225, rate: 0.32 },
      { limit: 640600, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  },
  married: {
    standardDeduction: 32200,
    brackets: [
      { limit: 24800, rate: 0.10 },
      { limit: 100800, rate: 0.12 },
      { limit: 211400, rate: 0.22 },
      { limit: 403550, rate: 0.24 },
      { limit: 512450, rate: 0.32 },
      { limit: 768700, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  }
};

function calculateUSTax(grossIncome, standardDeduction, brackets) {
  const taxable = Math.max(0, grossIncome - standardDeduction);
  let tax = 0;
  let prevLimit = 0;
  for (const bracket of brackets) {
    if (taxable > bracket.limit) {
      tax += (bracket.limit - prevLimit) * bracket.rate;
      prevLimit = bracket.limit;
    } else {
      tax += (taxable - prevLimit) * bracket.rate;
      break;
    }
  }
  return tax;
}

function getMarginalTaxRate(grossIncome, standardDeduction, brackets) {
  const taxable = Math.max(0, grossIncome - standardDeduction);
  if (taxable <= 0) return 0;
  for (const bracket of brackets) {
    if (taxable <= bracket.limit) {
      return bracket.rate;
    }
  }
  return 0.37;
}

function solveTraditionalWithdrawal(remainingDeficit, maxPreTaxAvailable, I_0, standardDeduction, nominalBrackets) {
  if (remainingDeficit <= 0) return 0;
  const T_0 = calculateUSTax(I_0, standardDeduction, nominalBrackets);
  const netMax = maxPreTaxAvailable - (calculateUSTax(I_0 + maxPreTaxAvailable, standardDeduction, nominalBrackets) - T_0);
  if (remainingDeficit >= netMax) {
    return maxPreTaxAvailable;
  }
  let W = remainingDeficit / (1 - getMarginalTaxRate(I_0, standardDeduction, nominalBrackets));
  for (let iter = 0; iter < 10; iter++) {
    const taxCurrent = calculateUSTax(I_0 + W, standardDeduction, nominalBrackets);
    const netCurrent = W - (taxCurrent - T_0);
    const diff = netCurrent - remainingDeficit;
    if (Math.abs(diff) < 0.01) break;
    const marginalRate = getMarginalTaxRate(I_0 + W, standardDeduction, nominalBrackets);
    const slope = 1 - marginalRate;
    W -= diff / slope;
    if (W < 0) {
      W = 0;
      break;
    }
    if (W > maxPreTaxAvailable) {
      W = maxPreTaxAvailable;
      break;
    }
  }
  return W;
}

export function getSocialSecurityFactor(claimingAge) {
  const age = Math.max(62, Math.min(70, claimingAge));
  if (age === 67) return 1.0;
  if (age < 67) {
    const monthsEarly = (67 - age) * 12;
    if (monthsEarly <= 36) {
      return 1 - monthsEarly * (5 / 900);
    } else {
      return 1 - (36 * (5 / 900) + (monthsEarly - 36) * (5 / 1200));
    }
  } else {
    const monthsLate = Math.min(36, (age - 67) * 12);
    return 1 + monthsLate * (8 / 1200);
  }
}

export function runFireSimulation(inputs) {
  const currentAge = Math.max(0, Number(inputs.currentAge) || 30);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  
  const lifeEvents = inputs.lifeEvents || [];
  const enabledEvents = lifeEvents.filter(e => e.enabled);
  
  // Find retirement event dynamically
  const retireEvent = enabledEvents.find(e => e.type === 'retire');
  const targetRetirementAge = retireEvent 
    ? Math.max(currentAge, Number(retireEvent.age) || 65) 
    : lifeExpectancy; // default to lifeExpectancy if no retirement event
    
  const retirementSpendingPercent = retireEvent
    ? Number(retireEvent.spendingPercent !== undefined ? retireEvent.spendingPercent : 70) / 100
    : 0.7;

  const expectedReturn = (Number(inputs.expectedReturn) || 7) / 100;
  const postRetirementReturn = inputs.postRetirementReturn !== undefined
    ? (Number(inputs.postRetirementReturn) || 0) / 100
    : expectedReturn;
  const inflationRate = (Number(inputs.inflationRate) || 3) / 100;
  const lifestyleUpgrades = (Number(inputs.lifestyleUpgrades) || 0) / 100;
  const swr = (Number(inputs.swr) || 4) / 100;
  const fireMode = inputs.fireMode || 'traditional'; // 'traditional' | 'coast' | 'barista' | 'lean' | 'fat'

  const includeTaxes = !!inputs.includeTaxes;
  const enableHealthcareModel = inputs.enableHealthcareModel !== false;
  const filingStatus = inputs.filingStatus || 'single';
  const isAdvanced = !!inputs.isAdvancedMode;

  let year0Taxes = 0;
  if (includeTaxes) {
    const simpleIncome = Number(inputs.simpleIncome) || 50000;
    const simpleExpenses = Number(inputs.simpleExpenses) || 42500;
    const rate = simpleIncome > 0 ? ((simpleIncome - simpleExpenses) / simpleIncome) : 0.15;
    const preTaxSavings = simpleIncome * rate;
    const taxableIncome0 = Math.max(0, simpleIncome - preTaxSavings);
    
    const taxConfig = U_S_TAX_DATA[filingStatus] || U_S_TAX_DATA.single;
    const stdDeduction0 = taxConfig.standardDeduction;
    const brackets0 = taxConfig.brackets;
    year0Taxes = calculateUSTax(taxableIncome0, stdDeduction0, brackets0);
  }

  const assets = inputs.assets || {};
  
  let homeEquityBaseline = Number(assets.realEstate) || 0;
  let debtBalance = 0; // Removed from starting assets, tracked dynamically via debtList

  const incomeList = inputs.incomeList || [];
  const spendingPhases = inputs.spendingPhases || [];
  const allocationRules = inputs.allocationRules || [];
  const debtList = inputs.debtList || [];

  const yearsToCompute = Math.max(1, lifeExpectancy - currentAge);

  // Initialize Debts & Loans Schedule
  let activeLoans = debtList.map(d => ({
    id: d.id,
    name: d.name || 'Loan',
    balance: Number(d.balance) || 0,
    interestRate: (Number(d.interestRate) || 0) / 100,
    payment: d.frequency === 'monthly' ? (Number(d.payment) || 0) * 12 : (Number(d.payment) || 0),
    extraPayment: d.frequency === 'monthly' ? (Number(d.extraPayment) || 0) * 12 : (Number(d.extraPayment) || 0),
    frequency: d.frequency || 'monthly',
    paydownPlanEnabled: !!d.paydownPlanEnabled,
    startAge: d.startAge !== undefined ? Number(d.startAge) : currentAge
  }));

  // Initial sum of loan balances
  let initialDebtSum = activeLoans.reduce((sum, l) => sum + l.balance, 0);

  // Track Milestones state
  let retirementIncomeSourcesInTodayDollars = 0;
  enabledEvents.forEach(ev => {
    if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
      const monthlyBenefit = Number(ev.monthlyBenefit) || 0;
      retirementIncomeSourcesInTodayDollars += monthlyBenefit * 12;
    }
  });

  let retirementReadyAge = null;

  const cashReturnRate = 0.025; // 2.5% conservative growth rate for cash and emergency fund

  // Helper to format currency
  function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  }

  function getAssetLabel(key) {
    const labels = {
      cash: 'Cash',
      emergencyFund: 'Emergency Fund',
      brokerage: 'Taxable Brokerage',
      trad401k: 'Traditional 401k',
      tradIra: 'Traditional IRA',
      rothIra: 'Roth IRA',
      hsa: 'HSA',
      other: 'Other Assets'
    };
    return labels[key] || key;
  }

  const executeSimulation = (targetRetirementAge, customLifeExpectancy = null) => {
    const simLifeExpectancy = customLifeExpectancy || lifeExpectancy;
    const simYearsToCompute = Math.max(1, simLifeExpectancy - currentAge);
    let balances = {
      cash: Number(assets.cash) || 0,
      emergencyFund: Number(assets.emergencyFund) || 0,
      brokerage: Number(assets.brokerage) || 0,
      trad401k: Number(assets.trad401k) || 0,
      tradIra: Number(assets.tradIra) || 0,
      rothIra: Number(assets.rothIra) || 0,
      hsa: Number(assets.hsa) || 0,
      other: Number(assets.other) || 0
    };

    let activeLoans = debtList.map(d => ({
      id: d.id,
      name: d.name || 'Loan',
      balance: Number(d.balance) || 0,
      interestRate: (Number(d.interestRate) || 0) / 100,
      payment: d.frequency === 'monthly' ? (Number(d.payment) || 0) * 12 : (Number(d.payment) || 0),
      extraPayment: d.frequency === 'monthly' ? (Number(d.extraPayment) || 0) * 12 : (Number(d.extraPayment) || 0),
      frequency: d.frequency || 'monthly',
      paydownPlanEnabled: !!d.paydownPlanEnabled,
      startAge: d.startAge !== undefined ? Number(d.startAge) : currentAge
    }));

    let hasRunOut = false;
    let runOutAge = null;
    let endingSurplusShortfall = 0;
    let initialSpending;
    const initialPhase = spendingPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge);
    if (initialPhase) {
      if (initialPhase.frequency === 'monthly') {
        initialSpending = (Number(initialPhase.amount) || 0) * 12;
      } else if (initialPhase.frequency === 'yearly') {
        initialSpending = Number(initialPhase.amount) || 0;
      } else {
        initialSpending = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
      }
    } else if (spendingPhases.length > 0) {
      const firstPhase = spendingPhases[0];
      if (firstPhase.frequency === 'monthly') {
        initialSpending = (Number(firstPhase.amount) || 0) * 12;
      } else if (firstPhase.frequency === 'yearly') {
        initialSpending = Number(firstPhase.amount) || 0;
      } else {
        initialSpending = Number(firstPhase.annualSpending) || Number(firstPhase.amount) || 0;
      }
    } else {
      initialSpending = Number(inputs.currentExpenses) || Number(inputs.simpleExpenses) || 42500;
    }

    if (!isAdvanced && includeTaxes) {
      initialSpending = Math.max(0, initialSpending - year0Taxes);
    }
    
    let lastWorkingYearSpendingNominal = initialSpending;
    let purchasedProperties = [];
    let isCoasting = false;
    let coastAge = null;
    let logs = [];
    let dynamicMilestones = [];
    let retirementReadyReached = false;

    let standardDeduction = 0;
    let nominalBrackets = [];
    let taxableIncome = 0;

    // Drawdowns / Shortfall coverage order
    const coverShortfall = (amountToDeduct) => {
      let remaining = amountToDeduct;
      
      // Withdrawal order: Cash -> Emergency Fund -> Brokerage -> Trad accounts (grossed for taxes) -> Roth IRA -> HSA -> Other
      const drawdownSequence = ['cash', 'emergencyFund', 'brokerage'];
    
    for (const key of drawdownSequence) {
      if (balances[key] > 0) {
        const withdraw = Math.min(balances[key], remaining);
        balances[key] -= withdraw;
        remaining -= withdraw;
        if (remaining <= 0) return 0;
      }
    }

    // Pre-tax accounts (Traditional 401k & IRA) withdrawals are taxable post-retirement
    if (includeTaxes) {
      const maxPreTaxAvailable = (balances.trad401k || 0) + (balances.tradIra || 0);
      if (maxPreTaxAvailable > 0 && remaining > 0) {
        const totalGrossPreTaxWithdrawal = solveTraditionalWithdrawal(
          remaining,
          maxPreTaxAvailable,
          taxableIncome,
          standardDeduction,
          nominalBrackets
        );

        const T_0 = calculateUSTax(taxableIncome, standardDeduction, nominalBrackets);
        const T_final = calculateUSTax(taxableIncome + totalGrossPreTaxWithdrawal, standardDeduction, nominalBrackets);
        const actualNetProceeds = totalGrossPreTaxWithdrawal - (T_final - T_0);

        let withdrawalRemaining = totalGrossPreTaxWithdrawal;
        const preTaxSequence = ['trad401k', 'tradIra'];
        for (const key of preTaxSequence) {
          if (balances[key] > 0) {
            const withdraw = Math.min(balances[key], withdrawalRemaining);
            balances[key] -= withdraw;
            withdrawalRemaining -= withdraw;
          }
        }

        remaining -= actualNetProceeds;
        taxableIncome += totalGrossPreTaxWithdrawal;
      }
    } else {
      const preTaxSequence = ['trad401k', 'tradIra'];
      for (const key of preTaxSequence) {
        if (balances[key] > 0) {
          const withdraw = Math.min(balances[key], remaining);
          balances[key] -= withdraw;
          remaining -= withdraw;
          if (remaining <= 0) return 0;
        }
      }
    }

    // Roth IRA, HSA, Other
    const taxFreeSequence = ['rothIra', 'hsa', 'other'];
    for (const key of taxFreeSequence) {
      if (balances[key] > 0) {
        const withdraw = Math.min(balances[key], remaining);
        balances[key] -= withdraw;
        remaining -= withdraw;
        if (remaining <= 0) return 0;
      }
    }

    return remaining; // Leftover shortfall
  };

  // Helper to withdraw for down payments
  const deductFromLiquidAssets = (amountToDeduct) => {
    let remaining = amountToDeduct;
    // Prefer cash / emergency fund / brokerage / other for large capital expenditures
    const order = ['cash', 'emergencyFund', 'brokerage', 'other', 'rothIra', 'tradIra', 'trad401k', 'hsa'];
    for (const assetKey of order) {
      if (balances[assetKey] > 0) {
        const withdraw = Math.min(balances[assetKey], remaining);
        balances[assetKey] -= withdraw;
        remaining -= withdraw;
        if (remaining <= 0) break;
      }
    }
    return remaining;
  };

  // Run simulation year-by-year
  for (let year = 0; year <= simYearsToCompute; year++) {
    const age = currentAge + year;
    const nominalFactor = Math.pow(1 + inflationRate, year);

    // Set progressive tax values for this year (adjusted for inflation)
    const taxConfig = U_S_TAX_DATA[filingStatus] || U_S_TAX_DATA.single;
    standardDeduction = taxConfig.standardDeduction * nominalFactor;
    nominalBrackets = taxConfig.brackets.map(b => ({
      limit: b.limit === Infinity ? Infinity : b.limit * nominalFactor,
      rate: b.rate
    }));

    // ----------------------------------------------------
    // 0. Asset Compounding (only from year > 0)
    // ----------------------------------------------------
    if (year > 0) {
      const activeReturnRate = (age - 1) >= targetRetirementAge ? postRetirementReturn : expectedReturn;
      balances.brokerage *= (1 + activeReturnRate);
      balances.trad401k *= (1 + activeReturnRate);
      balances.tradIra *= (1 + activeReturnRate);
      balances.rothIra *= (1 + activeReturnRate);
      balances.hsa *= (1 + activeReturnRate);
      balances.other *= (1 + activeReturnRate);
      balances.cash *= (1 + cashReturnRate);
      balances.emergencyFund *= (1 + cashReturnRate);
    }

    // ----------------------------------------------------
    // 0.5. One-time Asset Transfers
    // ----------------------------------------------------
    enabledEvents.forEach(ev => {
      if (ev.type === 'assetTransfer' && age === Number(ev.transferAge)) {
        const fromAsset = ev.fromAsset;
        const toAsset = ev.toAsset;
        const amount = Number(ev.amount) || 0;
        
        if (balances[fromAsset] !== undefined && balances[toAsset] !== undefined) {
          const actualTransfer = Math.max(0, Math.min(balances[fromAsset], amount));
          balances[fromAsset] -= actualTransfer;
          balances[toAsset] += actualTransfer;
          if (actualTransfer > 0) {
            dynamicMilestones.push({
              age,
              label: `Transfer: ${formatCurrency(actualTransfer)} from ${getAssetLabel(fromAsset)} to ${getAssetLabel(toAsset)}`,
              type: 'assetTransfer',
              isMilestone: false
            });
          }
        }
      }
    });

    // ----------------------------------------------------
    // 1. Incomes Calculations
    // ----------------------------------------------------
    let annualIncome = 0;
    taxableIncome = 0;

    incomeList.forEach(inc => {
      const effectiveEndAge = isAdvanced ? Math.min(inc.endAge, targetRetirementAge) : targetRetirementAge;
      if (age >= inc.startAge && age < effectiveEndAge) {
        const yearsGrown = age - inc.startAge;
        const baseAmount = inc.frequency === 'monthly' ? Number(inc.amount) * 12 : Number(inc.amount);
        let amount = baseAmount * Math.pow(1 + (Number(inc.growthRate) || 0), yearsGrown);

        // Apply Barista FIRE salary overrides: job salary drops to 0
        const hasBaristaActive = enabledEvents.some(e => e.type === 'baristaFire' && age >= Number(e.startAge));
        if (hasBaristaActive) {
          if (inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
            amount = 0;
          }
        }

        // Apply Sabbaticals
        enabledEvents.forEach(ev => {
          if (ev.type === 'sabbatical') {
            const start = Number(ev.startAge);
            const end = Number(ev.endAge);
            if (age >= start && age < end) {
              const reduction = Number(ev.incomeReduction) || 0;
              amount = Math.max(0, amount * (1 - reduction / 100));
            }
          }
        });

        annualIncome += amount;
        if (inc.isTaxable) {
          taxableIncome += amount;
        }
      }
    });


    // Add Barista FIRE part-time incomes
    enabledEvents.forEach(ev => {
      if (ev.type === 'baristaFire' && age >= Number(ev.startAge)) {
        const partTimeInc = Number(ev.partTimeIncome) || 0;
        const nominalPartTime = partTimeInc * nominalFactor;
        annualIncome += nominalPartTime;
        taxableIncome += nominalPartTime;
      }
    });

    // Add retirement income sources (Social Security, pension, rentalIncome, annuity, otherRetirementIncome)
    enabledEvents.forEach(ev => {
      if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
        const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
        if (age >= claimingAge) {
          let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
          if (ev.type === 'socialSecurity') {
            if (claimingAge < 62) {
              monthlyBenefit = 0;
            } else {
              monthlyBenefit = monthlyBenefit * getSocialSecurityFactor(claimingAge);
            }
          }
          let annualAmt = monthlyBenefit * 12;
          if (ev.inflationAdjusted) {
            annualAmt = annualAmt * nominalFactor;
          }
          annualIncome += annualAmt;
          taxableIncome += annualAmt;
        }
      }
    });

    // Add windfalls/inheritances / business sales
    let windfallReceived = 0;
    enabledEvents.forEach(ev => {
      if ((ev.type === 'windfall' || ev.type === 'inheritance' || ev.type === 'sellBusiness') && age === Number(ev.ageReceived || ev.age)) {
        const amt = Number(ev.amount) || 0;
        const tax = (Number(ev.taxRate) || 0) / 100;
        windfallReceived += amt * (1 - tax);
      }
    });

    // ----------------------------------------------------
    // 2. Expenses Calculations
    // ----------------------------------------------------
    let annualExpenses = 0;

    // Load spending phase
    const activePhase = spendingPhases.find(p => age >= p.startAge && age < p.endAge);
    let baseSpending;
    if (activePhase) {
      if (activePhase.frequency === 'monthly') {
        baseSpending = (Number(activePhase.amount) || 0) * 12;
      } else if (activePhase.frequency === 'yearly') {
        baseSpending = Number(activePhase.amount) || 0;
      } else {
        baseSpending = Number(activePhase.annualSpending) || Number(activePhase.amount) || 0;
      }
    } else if (spendingPhases.length > 0) {
      const firstPhase = spendingPhases[0];
      if (firstPhase.frequency === 'monthly') {
        baseSpending = (Number(firstPhase.amount) || 0) * 12;
      } else if (firstPhase.frequency === 'yearly') {
        baseSpending = Number(firstPhase.amount) || 0;
      } else {
        baseSpending = Number(firstPhase.annualSpending) || Number(firstPhase.amount) || 0;
      }
    } else {
      baseSpending = Number(inputs.currentExpenses) || Number(inputs.simpleExpenses) || 42500;
    }

    const rate = (activePhase && activePhase.inflationOverride !== null && activePhase.inflationOverride !== undefined && activePhase.inflationOverride !== '')
      ? (Number(activePhase.inflationOverride) / 100)
      : inflationRate;

    let adjustedBase = baseSpending;
    if (!isAdvanced && includeTaxes) {
      adjustedBase = Math.max(0, baseSpending - year0Taxes);
    }

    let spendingForYear = adjustedBase * Math.pow(1 + rate + lifestyleUpgrades, age - currentAge);
    if (age >= targetRetirementAge) {
      spendingForYear = lastWorkingYearSpendingNominal * retirementSpendingPercent * Math.pow(1 + inflationRate, age - Math.max(currentAge, targetRetirementAge - 1));
    } else {
      lastWorkingYearSpendingNominal = spendingForYear;
    }
    annualExpenses += spendingForYear;

    // Add Healthcare Bridge & Medicare costs if enabled and retired
    if (enableHealthcareModel && age >= targetRetirementAge) {
      const preMedicarePremium = Number(inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000);
      const medicarePremium = Number(inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000);
      
      if (age < 65) {
        annualExpenses += preMedicarePremium * nominalFactor;
      } else {
        annualExpenses += medicarePremium * nominalFactor;
      }
    }

    // Add children events childcare/support
    enabledEvents.forEach(ev => {
      if (ev.type === 'haveChild' && age >= Number(ev.birthAge)) {
        const birthAge = Number(ev.birthAge);
        const childAge = age - birthAge;

        if (childAge === 0) {
          annualExpenses += (Number(ev.oneTimeBirthCost) || 0) * nominalFactor;
        }
        const ccEndAge = Number(ev.childcareEndAge) || 5;
        if (childAge >= 0 && childAge < ccEndAge) {
          annualExpenses += (Number(ev.annualChildcareCost) || 0) * nominalFactor;
        }
        const supportEndAge = Number(ev.supportEndAge) || 18;
        if (childAge >= 0 && childAge < supportEndAge) {
          annualExpenses += (Number(ev.annualChildExpense) || 0) * nominalFactor;
        }
      }
    });

    // Add colleges events
    enabledEvents.forEach(ev => {
      if (ev.type === 'college' && age >= Number(ev.startAge)) {
        const start = Number(ev.startAge);
        const duration = Number(ev.duration) || 4;
        if (age >= start && age < start + duration) {
          annualExpenses += (Number(ev.tuitionCost) || 0) * nominalFactor;
        }
      }
    });

    // Add medical / windfall custom expenses
    enabledEvents.forEach(ev => {
      if (ev.type === 'medicalExpense' && age === Number(ev.age)) {
        annualExpenses += (Number(ev.amount) || 0) * nominalFactor;
      }
    });

    // Add Sabbaticals
    enabledEvents.forEach(ev => {
      if (ev.type === 'sabbatical') {
        const start = Number(ev.startAge);
        const end = Number(ev.endAge);
        if (age >= start && age < end) {
          const change = Number(ev.expenseChange) || 0;
          annualExpenses += change * nominalFactor;
        }
      }
    });

    // Add Barista FIRE overrides
    enabledEvents.forEach(ev => {
      if (ev.type === 'baristaFire' && age >= Number(ev.startAge)) {
        const baristaExp = Number(ev.annualExpenses) || 42500;
        const hcChange = Number(ev.healthcareCostChange) || 0;
        annualExpenses = (baristaExp + hcChange) * nominalFactor;
      }
    });

    // Resolve property buying events down payments
    enabledEvents.forEach(ev => {
      if (ev.type === 'buyHouse' && age === Number(ev.purchaseAge)) {
        const p = Number(ev.homePrice) || 0;
        const purchaseType = ev.purchaseType || 'mortgage';

        if (purchaseType === 'cash') {
          const closingCosts = p * 0.02;
          deductFromLiquidAssets(p + closingCosts);

          purchasedProperties.push({
            purchaseAge: age,
            purchaseType: 'cash',
            homePrice: p,
            currentValue: p,
            mortgageBalance: 0,
            annualPI: 0,
            loanTerm: 0,
            propertyTaxRate: (Number(ev.propertyTax) || 1.2) / 100,
            insuranceRate: (Number(ev.insurance) || 0.5) / 100,
            maintenanceRate: (Number(ev.maintenance) || 1.0) / 100,
            appreciationRate: (Number(ev.appreciationRate) || 3.0) / 100
          });
        } else {
          const dp = Number(ev.downPayment) || 0;
          const closingCosts = p * 0.02;
          deductFromLiquidAssets(dp + closingCosts);

          const rate = (Number(ev.mortgageRate) || 6.5) / 100;
          const mortgageTerm = Number(ev.loanTerm) || 30;
          const loanAmount = Math.max(0, p - dp);
          let annualPI = 0;

          if (loanAmount > 0 && mortgageTerm > 0) {
            const r = rate / 12;
            const n = mortgageTerm * 12;
            const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            annualPI = monthlyPayment * 12;
          }

          purchasedProperties.push({
            purchaseAge: age,
            purchaseType: 'mortgage',
            homePrice: p,
            downPayment: dp,
            mortgageRate: rate,
            loanTerm: mortgageTerm,
            loanAmount,
            annualPI,
            currentValue: p,
            mortgageBalance: loanAmount,
            propertyTaxRate: (Number(ev.propertyTax) || 1.2) / 100,
            insuranceRate: (Number(ev.insurance) || 0.5) / 100,
            maintenanceRate: (Number(ev.maintenance) || 1.0) / 100,
            appreciationRate: (Number(ev.appreciationRate) || 3.0) / 100
          });
        }
      }
    });

    // Appreciate home values and compile mortgage payments / property costs
    let totalHomeValue = homeEquityBaseline * nominalFactor;
    let totalMortgageBalance = 0;

    purchasedProperties.forEach(prop => {
      prop.currentValue = prop.currentValue * (1 + prop.appreciationRate);
      totalHomeValue += prop.currentValue;

      // Mortgage payments
      if (prop.purchaseType === 'mortgage') {
        if (age >= prop.purchaseAge && age < prop.purchaseAge + prop.loanTerm) {
          annualExpenses += prop.annualPI;

          // Amortize
          const elapsedYears = age - prop.purchaseAge;
          const r = prop.mortgageRate / 12;
          const n = prop.loanTerm * 12;
          const elapsedMonths = elapsedYears * 12;
          const remainingMonths = n - elapsedMonths;
          const pmt = prop.annualPI / 12;

          prop.mortgageBalance = r === 0 ? pmt * remainingMonths : pmt * (1 - Math.pow(1 + r, -remainingMonths)) / r;
        } else {
          prop.mortgageBalance = 0;
        }

        totalMortgageBalance += prop.mortgageBalance;
      }

      // Taxes, Insurance, Maintenance (applies to both cash and mortgage purchases)
      const propTax = prop.currentValue * prop.propertyTaxRate;
      const ins = prop.currentValue * prop.insuranceRate;
      const maint = prop.currentValue * prop.maintenanceRate;
      annualExpenses += propTax + ins + maint;
    });

    // Amortize ongoing debts (minimum payments + extra paydown plans)
    let annualDebtPayments = 0;
    activeLoans.forEach(loan => {
      if (loan.balance > 0) {
        const interest = loan.balance * loan.interestRate;
        
        let totalPayment = loan.payment;
        if (loan.paydownPlanEnabled && age >= loan.startAge) {
          totalPayment += loan.extraPayment;
        }

        let actualPaid;

        if (loan.balance + interest <= totalPayment) {
          actualPaid = loan.balance + interest;
          loan.balance = 0;
          dynamicMilestones.push({
            age,
            label: `Paid off: ${loan.name}`,
            type: 'debtPayoff',
            isMilestone: true
          });
        } else {
          actualPaid = totalPayment;
          loan.balance = loan.balance + interest - actualPaid;
        }

        annualDebtPayments += actualPaid;
      }
    });

    annualExpenses += annualDebtPayments;

    // Debt payoff event (legacy template option - reduces portfolio, sets debtBalance to 0)
    enabledEvents.forEach(ev => {
      if (ev.type === 'debtPayoff' && age === Number(ev.payoffAge)) {
        const amt = Number(ev.remainingBalance) || 0;
        deductFromLiquidAssets(amt);
        debtBalance = 0;
      }
    });

    // ----------------------------------------------------
    // 3. Coast FIRE targets
    // ----------------------------------------------------
    let isCoastAchieved = false;
    let coastFireNumber = 0;
    const currentLiquidWorth = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other;

    if (age < targetRetirementAge) {
      const yearsToRetire = targetRetirementAge - age;
      let projectedExpensesAtRetirement = annualExpenses * Math.pow(1 + inflationRate, yearsToRetire);
      if (includeTaxes) {
        const factor = Math.pow(1 + inflationRate, yearsToRetire);
        const stdDeductionAtRetirement = standardDeduction * factor;
        const bracketsAtRetirement = nominalBrackets.map(b => ({
          limit: b.limit === Infinity ? Infinity : b.limit * factor,
          rate: b.rate
        }));

        projectedExpensesAtRetirement = solveTraditionalWithdrawal(
          projectedExpensesAtRetirement,
          Infinity,
          0,
          stdDeductionAtRetirement,
          bracketsAtRetirement
        );
      }
      const targetPortfolioAtRetirement = projectedExpensesAtRetirement / swr;
      coastFireNumber = targetPortfolioAtRetirement / Math.pow(1 + expectedReturn, yearsToRetire);

      if (currentLiquidWorth >= coastFireNumber) {
        isCoastAchieved = true;
        const hasCoastEventActive = enabledEvents.some(e => e.type === 'coastFire' && age >= Number(e.startAge));
        if (fireMode === 'coast' || hasCoastEventActive) {
          isCoasting = true;
          if (coastAge === null) {
            coastAge = age;
          }
        }
      }
    }

    // ----------------------------------------------------
    // 4. Allocation Rules & Surplus Cash Flows
    // ----------------------------------------------------
    let totalPreTaxAllocations = 0;
    let savingsContribution = 0;
    let employerMatchContribution = 0;
    let taxes = 0;
    let grossSurplus = annualIncome - annualExpenses;

    // Sort allocation rules by priority
    const sortedAllocations = [...allocationRules]
      .map(r => ({ ...r, priority: Number(r.priority) || 99 }))
      .sort((a, b) => a.priority - b.priority);

    // Only save/allocate if not coasting and not retired
    const isSavingPeriod = !isCoasting && age < targetRetirementAge;

    // Step 1: Pre-Tax allocations dry run
    if (isSavingPeriod && grossSurplus > 0) {
      let tempGrossSurplus = grossSurplus;

      sortedAllocations.forEach(rule => {
        const dest = rule.destination;
        const isPreTax = dest === 'trad401k' || dest === 'tradIra' || dest === 'hsa';
        if (isPreTax && tempGrossSurplus > 0) {
          // Determine amount
          let amt = 0;
          if (rule.type === 'fixed') {
            amt = rule.frequency === 'monthly' ? Number(rule.value) * 12 : Number(rule.value);
          } else if (rule.type === 'percentIncome') {
            amt = annualIncome * (Number(rule.value) / 100);
          } else if (rule.type === 'percentSurplus') {
            amt = tempGrossSurplus * (Number(rule.value) / 100);
          }

          // Smart Target cap
          if (rule.smartRule && rule.smartRule.enabled) {
            const targetVal = Number(rule.smartRule.targetValue) || 0;
            const space = Math.max(0, targetVal - (balances[dest] || 0));
            amt = Math.min(amt, space);
          }

          const allocatedAmt = Math.max(0, Math.min(tempGrossSurplus, amt));
          tempGrossSurplus -= allocatedAmt;
          rule.computedPreTaxAmt = allocatedAmt;
          totalPreTaxAllocations += allocatedAmt;
        }
      });
    }

    // Step 2: Taxes computation
    if (includeTaxes) {
      const isPostRet = age >= targetRetirementAge;
      if (!isPostRet) {
        const adjustedTaxable = Math.max(0, taxableIncome - totalPreTaxAllocations);
        taxes = calculateUSTax(adjustedTaxable, standardDeduction, nominalBrackets);
      } else {
        // Post-retirement base tax (on Social Security and part-time income before withdrawals)
        taxes = calculateUSTax(taxableIncome, standardDeduction, nominalBrackets);
      }
    }

    // Step 3: Cash allocation execution
    let netSurplus = grossSurplus - taxes + windfallReceived - totalPreTaxAllocations;
    let netCashFlow = netSurplus; // Tracker for total cash flow this year

    if (isSavingPeriod) {
      // Run pre-tax allocations for real
      sortedAllocations.forEach(rule => {
        const dest = rule.destination;
        const isPreTax = dest === 'trad401k' || dest === 'tradIra' || dest === 'hsa';
        if (isPreTax) {
          const amt = rule.computedPreTaxAmt || 0;
          if (amt > 0) {
            balances[dest] += amt;
            savingsContribution += amt;
            // Matches
            if (rule.employerMatch) {
              const matchAmt = rule.frequency === 'monthly' ? Number(rule.employerMatch) * 12 : Number(rule.employerMatch);
              balances[dest] += matchAmt;
              employerMatchContribution += matchAmt;
            }
          }
        }
      });

      // Run post-tax allocations
      sortedAllocations.forEach(rule => {
        const dest = rule.destination;
        const isPreTax = dest === 'trad401k' || dest === 'tradIra' || dest === 'hsa';
        if (!isPreTax && netSurplus > 0) {
          let amt = 0;
          if (rule.type === 'fixed') {
            amt = rule.frequency === 'monthly' ? Number(rule.value) * 12 : Number(rule.value);
          } else if (rule.type === 'percentIncome') {
            amt = annualIncome * (Number(rule.value) / 100);
          } else if (rule.type === 'percentSurplus') {
            amt = netSurplus * (Number(rule.value) / 100);
          }

          let finalDest = dest;
          let spaceLimit = Infinity;

          // Goal-based Smart redirects
          if (rule.smartRule && rule.smartRule.enabled) {
            const targetVal = Number(rule.smartRule.targetValue) || 0;
            
            if (dest === 'extraMortgage') {
              // Redirect if no mortgage active
              const activeMortgageSum = purchasedProperties.reduce((sum, p) => sum + p.mortgageBalance, 0);
              if (activeMortgageSum <= 0) {
                finalDest = rule.smartRule.redirectDestination || 'brokerage';
              } else {
                spaceLimit = activeMortgageSum;
              }
            } else if (dest.startsWith('loan-') || dest === 'debtPaydown') {
              // Redirect if loan paid off
              const loanId = dest.startsWith('loan-') ? dest.replace('loan-', '') : null;
              const targetLoan = activeLoans.find(l => l.id === loanId || l.id === dest);
              if (!targetLoan || targetLoan.balance <= 0) {
                finalDest = rule.smartRule.redirectDestination || 'brokerage';
              } else {
                spaceLimit = targetLoan.balance;
              }
            } else {
              // Standard asset target limit redirect
              const currentBal = balances[dest] || 0;
              if (currentBal >= targetVal) {
                finalDest = rule.smartRule.redirectDestination || 'brokerage';
              } else {
                spaceLimit = Math.max(0, targetVal - currentBal);
              }
            }
          }

          let allocatedAmt = Math.max(0, Math.min(netSurplus, amt));
          if (allocatedAmt > spaceLimit) {
            // Redirect remainder
            const spillOver = allocatedAmt - spaceLimit;
            allocatedAmt = spaceLimit;
            
            const redirectDest = (rule.smartRule && rule.smartRule.redirectDestination) || 'brokerage';
            const spillAlloc = Math.max(0, Math.min(netSurplus - allocatedAmt, spillOver));
            if (spillAlloc > 0) {
              if (balances[redirectDest] !== undefined) {
                balances[redirectDest] += spillAlloc;
              }
            }
          }

          if (allocatedAmt > 0) {
            netSurplus -= allocatedAmt;
            if (balances[finalDest] !== undefined) {
              balances[finalDest] += allocatedAmt;
              savingsContribution += allocatedAmt;
            } else if (finalDest === 'extraMortgage') {
              // Pay extra mortgage
              let mortgageRemaining = allocatedAmt;
              for (const prop of purchasedProperties) {
                if (prop.purchaseType === 'mortgage' && prop.mortgageBalance > 0) {
                  const pay = Math.min(prop.mortgageBalance, mortgageRemaining);
                  prop.mortgageBalance -= pay;
                  mortgageRemaining -= pay;
                  if (mortgageRemaining <= 0) break;
                }
              }
            } else {
              // Specific loan paydown
              const loanId = finalDest.startsWith('loan-') ? finalDest.replace('loan-', '') : null;
              const targetLoan = activeLoans.find(l => l.id === loanId || l.id === finalDest);
              if (targetLoan) {
                targetLoan.balance = Math.max(0, targetLoan.balance - allocatedAmt);
              }
            }
          }
        }
      });

      // Leftover Surplus Sweep into Brokerage
      if (netSurplus > 0) {
        balances.brokerage += netSurplus;
        savingsContribution += netSurplus;
        netSurplus = 0;
      }
    } else {
      // In retirement or coasting: we do not save new contributions.
      // Leftover surplus (if positive, e.g. from SS or pensions) is swept into Brokerage.
      if (netSurplus > 0) {
        balances.brokerage += netSurplus;
        netSurplus = 0;
      }
    }

    // ----------------------------------------------------
    // 5. Drawdowns & Deficit Funding
    // ----------------------------------------------------
    let withdrawal = 0;
    let shortfall = 0;

    if (netCashFlow < 0) {
      const deficit = -netCashFlow;
      const leftShortfall = coverShortfall(deficit);
      withdrawal = deficit - leftShortfall;

      if (leftShortfall > 0.01) {
        shortfall = leftShortfall;
        if (age >= targetRetirementAge) {
          hasRunOut = true;
          if (runOutAge === null) {
            runOutAge = age;
          }
        }
      }
    }

    if (includeTaxes) {
      const isPostRet = age >= targetRetirementAge;
      if (isPostRet) {
        taxes = calculateUSTax(taxableIncome, standardDeduction, nominalBrackets);
      }
    }

    // Sum of remaining loan balances
    const currentDebtSum = activeLoans.reduce((sum, l) => sum + l.balance, 0) + debtBalance;

    // ----------------------------------------------------
    // 6. Net Worth & FI Targets
    // ----------------------------------------------------
    // Net Worth = Liquid Assets + Real Estate Value - Mortgage Balances - Debt balances
    const liquidNW = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other;
    const netWorth = liquidNW + totalHomeValue - totalMortgageBalance - currentDebtSum;

    // Apply FIRE Mode Multipliers for retirement spending target
    let retirementBaseExpenses = spendingForYear + taxes;
    if (age < targetRetirementAge) {
      const estRetSpending = spendingForYear * retirementSpendingPercent;
      retirementBaseExpenses = estRetSpending + taxes;
    }
    if (age >= targetRetirementAge) {
      if (fireMode === 'lean') {
        retirementBaseExpenses *= 0.8;
      } else if (fireMode === 'fat') {
        retirementBaseExpenses *= 1.3;
      }
    }

    // Add Healthcare Bridge & Medicare costs to retirement base expenses if enabled
    if (enableHealthcareModel) {
      const preMedicarePremium = Number(inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000);
      const medicarePremium = Number(inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000);
      
      const referenceAge = Math.max(age, targetRetirementAge);
      if (referenceAge < 65) {
        retirementBaseExpenses += preMedicarePremium * nominalFactor;
      } else {
        retirementBaseExpenses += medicarePremium * nominalFactor;
      }
    }

    // Calculate active retirement income sources for the current age, and discount future ones
    let activeRetirementIncomeThisYearInTodayDollars = 0;
    let futureRetirementIncomeDiscountedSumInTodayDollars = 0;

    enabledEvents.forEach(ev => {
      if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
        const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
        let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
        if (ev.type === 'socialSecurity') {
          if (claimingAge < 62) {
            monthlyBenefit = 0;
          } else {
            monthlyBenefit = monthlyBenefit * getSocialSecurityFactor(claimingAge);
          }
        }
        let annualAmt = monthlyBenefit * 12;
        
        if (age >= claimingAge) {
          if (!ev.inflationAdjusted) {
            annualAmt = annualAmt / nominalFactor;
          }
          activeRetirementIncomeThisYearInTodayDollars += annualAmt;
        } else {
          let deflatedAnnualAmt = annualAmt;
          if (!ev.inflationAdjusted) {
            deflatedAnnualAmt = annualAmt / Math.pow(1 + inflationRate, claimingAge - currentAge);
          }
          
          let discountedValue;
          if (age >= targetRetirementAge) {
            const realReturn = Math.max(0.001, postRetirementReturn - inflationRate);
            const yearsToClaim = claimingAge - age;
            discountedValue = deflatedAnnualAmt / Math.pow(1 + realReturn, yearsToClaim);
          } else {
            const yearsPre = Math.max(0, Math.min(claimingAge, targetRetirementAge) - age);
            const yearsPost = Math.max(0, claimingAge - Math.max(age, targetRetirementAge));
            const realPre = Math.max(0.001, expectedReturn - inflationRate);
            const realPost = Math.max(0.001, postRetirementReturn - inflationRate);
            discountedValue = deflatedAnnualAmt / (Math.pow(1 + realPre, yearsPre) * Math.pow(1 + realPost, yearsPost));
          }
          futureRetirementIncomeDiscountedSumInTodayDollars += discountedValue;
        }
      }
    });

    // Retirement Ready Target (portfolio + active retirement income sources cover spending, discounting future ones)
    const nominalActiveSS = activeRetirementIncomeThisYearInTodayDollars * nominalFactor;
    const nominalDiscountedSS = futureRetirementIncomeDiscountedSumInTodayDollars * nominalFactor;

    const retirementReadyTargetForYear = Math.max(0, 
      retirementBaseExpenses - nominalActiveSS - nominalDiscountedSS
    ) / swr;

    if (liquidNW >= retirementReadyTargetForYear && !retirementReadyReached) {
      retirementReadyReached = true;
      retirementReadyAge = age;
    }

    if (age === simLifeExpectancy) {
      endingSurplusShortfall = hasRunOut ? -shortfall : liquidNW;
    }

    const totalPortfolio = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other;

    logs.push({
      year,
      age,
      income: annualIncome + windfallReceived,
      expenses: annualExpenses + taxes,
      taxes,
      savings: savingsContribution,
      employerMatch: employerMatchContribution,
      withdrawals: withdrawal,
      shortfall,
      portfolio: totalPortfolio,
      homeValue: totalHomeValue,
      homeEquity: Math.max(0, totalHomeValue - totalMortgageBalance),
      mortgageBalance: totalMortgageBalance,
      debtBalance: currentDebtSum,
      netWorth,
      isFI: liquidNW >= retirementReadyTargetForYear,
      fiNumber: retirementReadyTargetForYear,
      retirementReadyTarget: retirementReadyTargetForYear,
      coastFireNumber,
      isCoastAchieved,
      // Record detailed asset allocations for breakdowns
      cashBalance: balances.cash,
      emergencyFundBalance: balances.emergencyFund,
      brokerageBalance: balances.brokerage,
      trad401kBalance: balances.trad401k,
      tradIraBalance: balances.tradIra,
      rothIraBalance: balances.rothIra,
      hsaBalance: balances.hsa,
      otherBalance: balances.other
    });
  }

    return {
      moneyLasts: !hasRunOut,
      runOutAge,
      endingSurplusShortfall,
      logs,
      dynamicMilestones,
      coastAge,
      lastWorkingYearSpendingNominal
    };
  };

  const plannedResults = executeSimulation(targetRetirementAge);

  // Deflate all logged money values to Today's (Real) Dollars
  const deflatedLogs = plannedResults.logs.map(log => {
    const yearsElapsed = log.age - currentAge;
    const factor = Math.pow(1 + inflationRate, yearsElapsed);
    
    return {
      ...log,
      income: log.income / factor,
      expenses: log.expenses / factor,
      taxes: (log.taxes || 0) / factor,
      savings: log.savings / factor,
      employerMatch: log.employerMatch / factor,
      withdrawals: log.withdrawals / factor,
      shortfall: log.shortfall / factor,
      portfolio: log.portfolio / factor,
      homeValue: log.homeValue / factor,
      homeEquity: log.homeEquity / factor,
      mortgageBalance: log.mortgageBalance / factor,
      debtBalance: log.debtBalance / factor,
      netWorth: log.netWorth / factor,
      fiNumber: log.fiNumber / factor,
      retirementReadyTarget: log.retirementReadyTarget / factor,
      coastFireNumber: log.coastFireNumber / factor,
      cashBalance: log.cashBalance / factor,
      emergencyFundBalance: log.emergencyFundBalance / factor,
      brokerageBalance: log.brokerageBalance / factor,
      trad401kBalance: log.trad401kBalance / factor,
      tradIraBalance: log.tradIraBalance / factor,
      rothIraBalance: log.rothIraBalance / factor,
      hsaBalance: log.hsaBalance / factor,
      otherBalance: log.otherBalance / factor
    };
  });

  // Search for the earliest retirement ready age (SWR-based / Indefinite)
  let retirementReadyAgeSWR = null;
  for (let testAge = currentAge; testAge <= lifeExpectancy; testAge++) {
    const testRes = executeSimulation(testAge);
    if (testRes.moneyLasts) {
      const lastLog = testRes.logs[testRes.logs.length - 1];
      if (lastLog && lastLog.portfolio >= lastLog.retirementReadyTarget) {
        retirementReadyAgeSWR = testAge;
        break;
      }
    }
  }

  // Search for the earliest retirement ready age (Comfortable: survives to lifeExpectancy + 10)
  let retirementReadyAgeComfortable = null;
  for (let testAge = currentAge; testAge <= lifeExpectancy; testAge++) {
    const testRes = executeSimulation(testAge, lifeExpectancy + 10);
    if (testRes.moneyLasts) {
      retirementReadyAgeComfortable = testAge;
      break;
    }
  }

  // Search for the earliest retirement ready age (Survival-based / Sustainable)
  let retirementReadyAgeSurvival = null;
  for (let testAge = currentAge; testAge <= lifeExpectancy; testAge++) {
    const testRes = executeSimulation(testAge);
    if (testRes.moneyLasts) {
      retirementReadyAgeSurvival = testAge;
      break;
    }
  }

  const readinessCriteria = inputs.readinessCriteria || 'lastsIndefinitely';
  if (readinessCriteria === 'lastsLifeExp') {
    retirementReadyAge = retirementReadyAgeSurvival;
  } else if (readinessCriteria === 'lastsComfortable') {
    retirementReadyAge = retirementReadyAgeComfortable;
  } else {
    retirementReadyAge = retirementReadyAgeSWR;
  }

  let retirementReadyTarget = 0;
  if (retirementReadyAge !== null) {
    const readyLog = deflatedLogs.find(l => l.age === retirementReadyAge);
    if (readyLog) {
      retirementReadyTarget = readyLog.fiNumber;
    } else {
      const factor = Math.pow(1 + inflationRate, retirementReadyAge - currentAge);
      const initialPhase = spendingPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge) || spendingPhases[0];
      let baseSpending = 42500;
      if (initialPhase) {
        baseSpending = Number(initialPhase.amount) || Number(initialPhase.annualSpending) || 42500;
        if (initialPhase.frequency === 'monthly') baseSpending *= 12;
      }
      const rate = (initialPhase && initialPhase.inflationOverride !== null && initialPhase.inflationOverride !== undefined && initialPhase.inflationOverride !== '')
        ? (Number(initialPhase.inflationOverride) / 100)
        : inflationRate;
      let estRetSpending = baseSpending * Math.pow(1 + rate + lifestyleUpgrades, retirementReadyAge - currentAge) * retirementSpendingPercent;
      
      if (enableHealthcareModel) {
        const preMedicarePremium = Number(inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000);
        const medicarePremium = Number(inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000);
        
        if (retirementReadyAge < 65) {
          estRetSpending += preMedicarePremium * factor;
        } else {
          estRetSpending += medicarePremium * factor;
        }
      }
      
      let activeRetIncome = 0;
      let futureRetIncomeDiscountedSum = 0;
      const realReturn = Math.max(0.001, postRetirementReturn - inflationRate);
      
      enabledEvents.forEach(ev => {
        if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
          const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
          let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
          if (ev.type === 'socialSecurity') {
            if (claimingAge < 62) {
              monthlyBenefit = 0;
            } else {
              monthlyBenefit = monthlyBenefit * getSocialSecurityFactor(claimingAge);
            }
          }
          let annualAmt = monthlyBenefit * 12; // in today's dollars
          
          if (retirementReadyAge >= claimingAge) {
            if (!ev.inflationAdjusted) {
              annualAmt = annualAmt / factor;
            }
            activeRetIncome += annualAmt;
          } else {
            const yearsToClaim = claimingAge - retirementReadyAge;
            let deflatedAnnualAmt = annualAmt;
            if (!ev.inflationAdjusted) {
              deflatedAnnualAmt = annualAmt / Math.pow(1 + inflationRate, claimingAge - currentAge);
            }
            const discountedValue = deflatedAnnualAmt / Math.pow(1 + realReturn, yearsToClaim);
            futureRetIncomeDiscountedSum += discountedValue;
          }
        }
      });
      retirementReadyTarget = Math.max(0, (estRetSpending / factor) - activeRetIncome - futureRetIncomeDiscountedSum) / swr;
    }
  }

  const retirementLog = deflatedLogs.find(log => log.age === targetRetirementAge) || deflatedLogs[deflatedLogs.length - 1];
  
  // Also deflate ending surplus/shortfall
  const finalSurplusShortfall = plannedResults.endingSurplusShortfall / Math.pow(1 + inflationRate, yearsToCompute);

  // Compute Retirement Outcome
  let retirementOutcome;
  if (plannedResults.runOutAge === null) {
    const portAtRet = retirementLog ? retirementLog.portfolio : 0;
    const portAtEnd = deflatedLogs.length > 0 ? deflatedLogs[deflatedLogs.length - 1].portfolio : 0;
    const annSpending = retirementLog ? retirementLog.expenses : 50000;
    
    if (readinessCriteria === 'lastsIndefinitely') {
      if (retirementReadyAgeSWR !== null && targetRetirementAge >= retirementReadyAgeSWR) {
        retirementOutcome = 'comfortable';
      } else {
        retirementOutcome = 'sustainable';
      }
    } else {
      // Comfortable if ending portfolio is >= 50% of portfolio at retirement, or is >= 10x annual retirement spending, or remains above $100k
      if (portAtEnd >= portAtRet * 0.5 || portAtEnd >= annSpending * 10 || portAtEnd >= 100000) {
        retirementOutcome = 'comfortable';
      } else {
        retirementOutcome = 'sustainable';
      }
    }
  } else {
    // runs out before life expectancy
    retirementOutcome = 'retirementGap';
  }

  return {
    currentNetWorth: (Number(assets.cash) || 0) +
                     (Number(assets.emergencyFund) || 0) +
                     (Number(assets.brokerage) || 0) +
                     (Number(assets.trad401k) || 0) +
                     (Number(assets.tradIra) || 0) +
                     (Number(assets.rothIra) || 0) +
                     (Number(assets.hsa) || 0) +
                     (Number(assets.other) || 0) +
                     homeEquityBaseline -
                     initialDebtSum -
                     plannedResults.logs[plannedResults.logs.length - 1].debtBalance,
    fiNumber: retirementReadyTarget,
    fiAge: retirementReadyAge,
    yearsToFI: retirementReadyAge !== null ? Math.max(0, retirementReadyAge - currentAge) : null,
    retirementReadyAge: retirementReadyAge,
    retirementReadyTarget: retirementReadyTarget,
    retirementReadyAgeSWR,
    retirementReadyAgeSurvival,
    readinessCriteria,
    retirementIncomeSources: retirementIncomeSourcesInTodayDollars,
    targetRetirementAge,
    portfolioAtRetirement: retirementLog ? retirementLog.portfolio : 0,
    netWorthAtRetirement: retirementLog ? retirementLog.netWorth : 0,
    annualRetirementSpending: retirementLog ? retirementLog.expenses : 0,
    moneyLasts: plannedResults.moneyLasts,
    runOutAge: plannedResults.runOutAge,
    retirementOutcome,
    endingSurplusShortfall: finalSurplusShortfall,
    coastAge: plannedResults.coastAge,
    dynamicMilestones: plannedResults.dynamicMilestones,
    data: deflatedLogs
  };
}

/**
 * Validates inputs for the FIRE simulator calculator
 *
 * @param {Object} inputs - User inputs
 * @returns {Object} Errors, warnings, and info arrays
 */
export function validateFireInputs(inputs) {
  const errors = [];
  const warnings = [];

  const currentAge = Number(inputs.currentAge);
  const targetRetirementAge = inputs.targetRetirementAge ? Number(inputs.targetRetirementAge) : null;
  const lifeExpectancy = Number(inputs.lifeExpectancy);
  const expectedReturn = Number(inputs.expectedReturn);
  const inflationRate = Number(inputs.inflationRate);
  const swr = Number(inputs.swr);

  // Validation Rules
  if (isNaN(currentAge) || currentAge < 0) {
    errors.push("Current age cannot be negative.");
  }
  if (targetRetirementAge !== null && targetRetirementAge < currentAge) {
    errors.push("Target retirement age cannot be lower than your current age.");
  }
  if (isNaN(lifeExpectancy) || lifeExpectancy <= currentAge) {
    errors.push("Life expectancy must be greater than your current age.");
  }
  if (isNaN(swr) || swr <= 0) {
    errors.push("Safe withdrawal rate must be greater than 0%.");
  }
  const lifestyleUpgrades = Number(inputs.lifestyleUpgrades);
  if (isNaN(lifestyleUpgrades) || lifestyleUpgrades < 0) {
    errors.push("Lifestyle upgrades rate cannot be negative.");
  }

  // Warnings
  if (expectedReturn < inflationRate) {
    warnings.push("Your expected investment return is lower than the inflation rate. This means your investments will lose purchasing power over time.");
  }

  const postRetirementReturn = inputs.postRetirementReturn !== undefined ? Number(inputs.postRetirementReturn) : expectedReturn;
  if (postRetirementReturn < inflationRate) {
    warnings.push("Your post-retirement expected return rate is lower than the inflation rate. This means your investments will lose purchasing power in retirement.");
  }

  if (Number(inputs.currentExpenses) > Number(inputs.currentIncome)) {
    warnings.push("Your current annual expenses exceed your current annual income. This indicates deficit spending and will drain your portfolio unless you adjust your plan.");
  }

  const incomeList = inputs.incomeList || [];
  const spendingPhases = inputs.spendingPhases || [];
  const debtList = inputs.debtList || [];
  const lifeEvents = inputs.lifeEvents || [];

  incomeList.forEach((inc, i) => {
    if (inc.endAge < inc.startAge) {
      errors.push(`Income Phase #${i+1} ("${inc.name}") has an end age (${inc.endAge}) that is earlier than its start age (${inc.startAge}).`);
    }
  });

  spendingPhases.forEach((p, i) => {
    if (p.endAge < p.startAge) {
      errors.push(`Spending Phase #${i+1} ("${p.name}") has an end age (${p.endAge}) that is earlier than its start age (${p.startAge}).`);
    }
  });

  debtList.forEach((debt, i) => {
    if (debt.balance < 0) {
      errors.push(`Debt entry #${i+1} ("${debt.name}") cannot have a negative balance.`);
    }
    if (debt.payment < 0) {
      errors.push(`Debt entry #${i+1} ("${debt.name}") cannot have a negative payment.`);
    }
  });

  // Verify life events
  lifeEvents.forEach((ev, i) => {
    if (ev.type === 'buyHouse' && ev.enabled) {
      const purchaseAge = Number(ev.purchaseAge);
      if (purchaseAge < currentAge) {
        errors.push(`Home Purchase age (${purchaseAge}) for event #${i+1} cannot be in the past.`);
      }
    }
    if (ev.type === 'haveChild' && ev.enabled) {
      const birthAge = Number(ev.birthAge);
      if (birthAge < currentAge) {
        errors.push(`Child birth age (${birthAge}) for event #${i+1} cannot be in the past.`);
      }
    }
    if (ev.type === 'sabbatical' && ev.enabled) {
      const start = Number(ev.startAge);
      const end = Number(ev.endAge);
      if (end < start) {
        errors.push(`Sabbatical end age (${end}) for event #${i+1} cannot be earlier than start age (${start}).`);
      }
    }
    if (ev.type === 'college' && ev.enabled) {
      const start = Number(ev.startAge);
      if (start < currentAge) {
        errors.push(`College start age (${start}) for event #${i+1} cannot be in the past.`);
      }
    }
  });

  return {
    errors,
    warnings
  };
}
