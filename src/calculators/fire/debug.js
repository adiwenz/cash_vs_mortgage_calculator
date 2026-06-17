import { getNormalizedPhases } from './phases.js';

export function buildSimulationDebugSnapshot(inputs, normalizedInputs, events, results, yearlyTimeline) {
  // Ensure we don't mutate anything. Deep clone where needed.
  const rawInputs = inputs ? JSON.parse(JSON.stringify(inputs)) : {};
  const normInputs = normalizedInputs ? JSON.parse(JSON.stringify(normalizedInputs)) : {};
  const evs = events ? JSON.parse(JSON.stringify(events)) : [];
  const res = results ? JSON.parse(JSON.stringify(results)) : {};
  const timeline = yearlyTimeline ? JSON.parse(JSON.stringify(yearlyTimeline)) : [];

  // Extract global assumptions
  const globalAssumptions = {
    currentAge: normInputs.currentAge ?? 35,
    retirementAge: normInputs.targetRetirementAge ?? 65,
    lifeExpectancy: normInputs.lifeExpectancy ?? 85,
    inflation: normInputs.inflationRate ?? 0.03,
    salaryGrowth: normInputs.incomeList?.[0]?.growthRate ?? 0.03,
    preRetirementReturn: normInputs.expectedReturn ?? 0.07,
    postRetirementReturn: normInputs.postRetirementReturn ?? 0.07,
    safeWithdrawalRate: normInputs.swr ?? 0.04,
    taxSettings: {
      includeTaxes: normInputs.includeTaxes ?? false,
      filingStatus: normInputs.filingStatus ?? 'single',
    },
    socialSecuritySettings: {
      useEarnings: rawInputs.lifeEvents?.find(e => e.type === 'socialSecurity')?.useEarnings ?? false,
      claimingAge: rawInputs.lifeEvents?.find(e => e.type === 'socialSecurity')?.claimingAge ?? 67,
      monthlyBenefit: rawInputs.lifeEvents?.find(e => e.type === 'socialSecurity')?.monthlyBenefit ?? 0,
    },
    healthcareSettings: {
      enableHealthcareModel: normInputs.enableHealthcareModel ?? true,
      preMedicarePremium: normInputs.preMedicarePremium ?? 10000,
      medicarePremium: normInputs.medicarePremium ?? 4000,
    }
  };

  // Extract budget assumptions
  const budgetAssumptions = {
    income: normInputs.simpleIncome ?? 0,
    expenses: normInputs.simpleExpenses ?? 0,
    needsWantsSavings: {
      needs: normInputs.budgetDetails?.expenses?.housing ?? 0,
      wants: normInputs.budgetDetails?.expenses?.leisure ?? 0,
      savings: normInputs.budgetDetails?.savings ?? {}
    },
    savingsRate: normInputs.preTaxSavingsRate ?? null,
    monthlyAnnualConversions: "Monthly inputs converted to annual by multiplying by 12"
  };

  // Extract savings allocations
  const currentAge = normInputs.currentAge ?? 35;
  const simPhases = getNormalizedPhases(normInputs);
  const initialPhase = simPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge);

  const accountLabels = {
    trad401k: 'Traditional 401(k)',
    tradIra: 'Traditional IRA',
    rothIra: 'Roth IRA',
    hsa: 'HSA',
    brokerage: 'Taxable Brokerage',
    checking: 'Checking',
    hysa: 'HYSA / Savings',
    emergency: 'Emergency Fund',
    other: 'Other Assets',
    debt: 'Debt Paydown'
  };

  const firstYearLog = timeline[0] || {};
  const actualContribs = firstYearLog.actualContributions || {};

  const comparison = Object.keys(accountLabels).map(key => {
    const expectedMonthly = (Number(initialPhase?.savings?.[key]) || 0) + (Number(initialPhase?.partnerSavings?.[key]) || 0);
    const actualMonthly = (Number(actualContribs[key]) || 0) / 12;
    const annualContribution = Number(actualContribs[key]) || 0;

    let cumulativeBalance = 0;
    if (key === 'trad401k') cumulativeBalance = firstYearLog.trad401kBalance ?? 0;
    else if (key === 'tradIra') cumulativeBalance = firstYearLog.tradIraBalance ?? 0;
    else if (key === 'rothIra') cumulativeBalance = firstYearLog.rothIraBalance ?? 0;
    else if (key === 'hsa') cumulativeBalance = firstYearLog.hsaBalance ?? 0;
    else if (key === 'brokerage') cumulativeBalance = firstYearLog.brokerageBalance ?? 0;
    else if (key === 'checking' || key === 'hysa') cumulativeBalance = firstYearLog.cashBalance ?? 0;
    else if (key === 'emergency') cumulativeBalance = firstYearLog.emergencyFundBalance ?? 0;
    else if (key === 'other') cumulativeBalance = firstYearLog.otherBalance ?? 0;
    else if (key === 'debt') cumulativeBalance = firstYearLog.debtBalance ?? 0;

    return {
      key,
      label: accountLabels[key],
      expectedMonthly,
      actualMonthly,
      annualContribution,
      cumulativeBalance
    };
  });

  const warnings = [];
  const expectedTotalMonthly = comparison.reduce((sum, item) => sum + item.expectedMonthly, 0);
  const actualTotalMonthly = comparison.reduce((sum, item) => sum + item.actualMonthly, 0);

  if (Math.abs(expectedTotalMonthly - actualTotalMonthly) > 0.01) {
    warnings.push(`Total monthly savings mismatch: budget defined $${expectedTotalMonthly.toFixed(0)}/mo, but simulation actually saved $${actualTotalMonthly.toFixed(0)}/mo.`);
  }

  comparison.forEach(item => {
    if (Math.abs(item.expectedMonthly - item.actualMonthly) > 0.01) {
      warnings.push(`${item.label} mismatch: budget allocated $${item.expectedMonthly.toFixed(0)}/mo, simulation actually saved $${item.actualMonthly.toFixed(0)}/mo.`);
    }
  });

  const savingsAllocations = {
    checking: normInputs.assets?.checking ?? 0,
    savings: normInputs.assets?.savings ?? 0,
    trad401k: normInputs.assets?.trad401k ?? 0,
    rothIra: normInputs.assets?.rothIra ?? 0,
    tradIra: normInputs.assets?.tradIra ?? 0,
    hsa: normInputs.assets?.hsa ?? 0,
    brokerage: normInputs.assets?.brokerage ?? 0,
    debtPaydown: normInputs.assets?.debtPaydown ?? 0,
    allocationRules: normInputs.allocationRules || [],
    comparison,
    warnings
  };

  // Helper for starting balances
  const startingBalances = {
    cash: normInputs.assets?.cash ?? 0,
    emergencyFund: normInputs.assets?.emergencyFund ?? 0,
    brokerage: normInputs.assets?.brokerage ?? 0,
    trad401k: normInputs.assets?.trad401k ?? 0,
    tradIra: normInputs.assets?.tradIra ?? 0,
    rothIra: normInputs.assets?.rothIra ?? 0,
    hsa: normInputs.assets?.hsa ?? 0,
    other: normInputs.assets?.other ?? 0
  };

  // Extract account balances starting/yearly
  const accountBalances = {
    startingBalances,
    yearlyBalances: timeline.map((log, index) => {
      const prevLog = index > 0 ? timeline[index - 1] : null;
      const portfolioPrev = prevLog ? (prevLog.portfolio ?? 0) : (
        startingBalances.cash +
        startingBalances.emergencyFund +
        startingBalances.brokerage +
        startingBalances.trad401k +
        startingBalances.tradIra +
        startingBalances.rothIra +
        startingBalances.hsa +
        startingBalances.other
      );
      const contributions = log.savings ?? 0;
      const withdrawals = log.withdrawals ?? 0;
      const portfolioCurrent = log.portfolio ?? 0;
      const growth = portfolioCurrent - portfolioPrev - contributions + withdrawals;

      return {
        age: log.age,
        year: log.year,
        cash: log.cashBalance ?? 0,
        emergencyFund: log.emergencyFundBalance ?? 0,
        brokerage: log.brokerageBalance ?? 0,
        trad401k: log.trad401kBalance ?? 0,
        tradIra: log.tradIraBalance ?? 0,
        rothIra: log.rothIraBalance ?? 0,
        hsa: log.hsaBalance ?? 0,
        other: log.otherBalance ?? 0,
        contributions,
        withdrawals,
        growth
      };
    })
  };

  // Extract debts starting/yearly
  const debts = {
    startingBalances: normInputs.debtList || [],
    interestRates: (normInputs.debtList || []).map(d => ({ name: d.name, rate: d.rate })),
    minimumPayments: (normInputs.debtList || []).map(d => ({ name: d.name, payment: d.payment })),
    paydownStrategy: rawInputs.debtPaydownStrategy || 'avalanche',
    yearlyBalances: timeline.map(log => ({
      age: log.age,
      year: log.year,
      debtBalance: log.debtBalance ?? 0
    }))
  };

  // Process events
  const processedEvents = evs.map(e => {
    const startAge = e.startAge ?? e.age ?? e.purchaseAge ?? e.birthAge ?? e.claimingAge ?? null;
    const endAge = e.endAge ?? null;
    const impact = e.amount ?? e.value ?? e.monthlyBenefit ?? null;
    return {
      id: e.id,
      name: e.name || e.type,
      type: e.type,
      enabled: e.enabled !== false,
      startAge,
      endAge,
      financialImpact: impact,
      raw: e
    };
  });

  const debugEvents = {
    rawEvents: rawInputs.lifeEvents || [],
    normalizedEvents: processedEvents,
    linkedEvents: processedEvents.filter(e => ['haveChild', 'buyHouse', 'marriage'].includes(e.type))
  };

  // Year-by-year computed timeline
  const computedTimeline = timeline.map((log, index) => {
    const prevLog = index > 0 ? timeline[index - 1] : null;
    const portfolioPrev = prevLog ? (prevLog.portfolio ?? 0) : (
      startingBalances.cash +
      startingBalances.emergencyFund +
      startingBalances.brokerage +
      startingBalances.trad401k +
      startingBalances.tradIra +
      startingBalances.rothIra +
      startingBalances.hsa +
      startingBalances.other
    );
    const contributions = log.savings ?? 0;
    const withdrawals = log.withdrawals ?? 0;
    const portfolioCurrent = log.portfolio ?? 0;
    const growth = portfolioCurrent - portfolioPrev - contributions + withdrawals;

    const activeEventsThisAge = processedEvents.filter(e => {
      if (e.startAge === null) return false;
      const end = e.endAge ?? e.startAge;
      return log.age >= e.startAge && log.age <= end;
    }).map(e => e.name || e.type);

    return {
      age: log.age,
      year: log.year,
      grossIncome: log.income ?? 0,
      taxes: log.taxes ?? 0,
      netIncome: (log.income ?? 0) - (log.taxes ?? 0),
      expenses: log.expenses ?? 0,
      contributions,
      withdrawals,
      investmentGrowth: growth,
      debtBalance: log.debtBalance ?? 0,
      assetBalance: log.portfolio ?? 0,
      netWorth: log.netWorth ?? 0,
      netWorthLedger: log.netWorthLedger || null,
      netWorthLedgerDebug: log.netWorthLedgerDebug || null,
      retirementStatus: log.age >= (normInputs.targetRetirementAge ?? 65) ? 'Retired' : 'Working',
      intervalId: log.intervalId ?? null,
      activeEvents: activeEventsThisAge,
      warningsErrors: log.shortfall > 0 ? [`Shortfall of ${log.shortfall} encountered`] : []
    };
  });

  // Final result
  const finalResult = {
    retirementReadyAge: res.retirementReadyAge ?? null,
    fiNumber: res.fiNumber ?? null,
    depletionAge: res.runOutAge ?? null,
    retirementSuccess: res.moneyLasts ?? false,
    failureReason: res.moneyLasts ? null : `Portfolio depleted at age ${res.runOutAge}`
  };

  const boundaries = Array.from(new Set(simPhases.flatMap(p => [p.startAge, p.endAge]))).sort((a, b) => a - b);

  const marriageEvent = rawInputs.lifeEvents?.find(e => e.type === 'marriage' && e.enabled);
  const weddingAge = marriageEvent 
    ? (marriageEvent.weddingAge !== undefined ? Number(marriageEvent.weddingAge) : (marriageEvent.age !== undefined ? Number(marriageEvent.age) : globalAssumptions.currentAge))
    : null;
  const weddingDebtBalance = weddingAge !== null ? (res.weddingFinancingDetails?.weddingDebtBalanceByYear?.[weddingAge] ?? 0) : null;
  const totalDebt = weddingAge !== null ? (timeline.find(t => t.age === weddingAge)?.debtBalance ?? 0) : null;

  return {
    rawInputs,
    normalizedInputs: normInputs,
    globalAssumptions,
    budgetAssumptions,
    savingsAllocations,
    accountBalances,
    debts,
    events: debugEvents,
    yearlyTimeline: computedTimeline,
    finalResult,
    boundaries,
    weddingCost: res.weddingFinancingDetails?.weddingCost ?? null,
    paidFromSavings: res.weddingFinancingDetails?.paidFromSavings ?? null,
    financedAmount: res.weddingFinancingDetails?.financedAmount ?? null,
    weddingDebtBalance,
    totalDebt,
    weddingDebtBalanceByYear: res.weddingFinancingDetails?.weddingDebtBalanceByYear ?? {},
    netWorthBeforeWedding: res.weddingFinancingDetails?.netWorthBeforeWedding ?? null,
    netWorthAfterWedding: res.weddingFinancingDetails?.netWorthAfterWedding ?? null,
    generatedBudgetIntervals: simPhases.map(p => ({
      id: p.id,
      startAge: p.startAge,
      endAge: p.endAge,
      activeEvents: p.activeEvents || [],
      label: p.label || p.name,
      icon: p.icon,
      type: p.type,
      resolvedBudget: {
        income: p.income,
        expenses: p.expenses,
        savings: p.savings,
        partnerSavings: p.partnerSavings
      },
      effectsApplied: p.effectsApplied || []
    })),
    userOverrides: rawInputs.budgetDetails?.phases || []
  };
}
