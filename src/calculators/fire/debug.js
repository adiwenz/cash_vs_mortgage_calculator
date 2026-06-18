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
      warningsErrors: log.shortfall > 0 ? [`Shortfall of ${log.shortfall} encountered`] : [],
      budgetScalingMode: log.budgetScalingMode || 'lifestyle',
      phaseIncomeAtCreation: log.phaseIncomeAtCreation ?? 0,
      currentIncome: log.currentIncome ?? 0,
      scalingMultiplier: log.scalingMultiplier ?? 1.0,
      budgetDrift: log.budgetDrift ?? 0,
      contributionRoutingSource: log.contributionRoutingSource,
      ignoredAllocationRules: log.ignoredAllocationRules,
      routingWarning: log.routingWarning || null,
      annualContributionsByAccount: log.annualContributionsByAccount,
      growthByAccount: log.growthByAccount,
      startBalanceByAccount: log.startBalanceByAccount,
      endBalanceByAccount: log.endBalanceByAccount,
      brokerageAudit: log.brokerageAudit,
      budgetScaling: log.budgetScaling
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

  // --- NEW DEBUG SECTIONS ---
  const targetRetirementAge = normInputs.targetRetirementAge ?? 65;

  // 1. Simulation Assumptions
  const salaryGrowthRate = normInputs.incomeList?.find(inc => inc.name?.toLowerCase().includes('salary') || inc.id === 'inc-1' || inc.id.startsWith('simple-inc'))?.growthRate ?? 0.03;
  const socialSecurityEnabled = rawInputs.lifeEvents?.some(e => e.type === 'socialSecurity' && e.enabled) ?? false;
  
  const simulationAssumptions = {
    currentAge: normInputs.currentAge ?? 35,
    retirementAge: targetRetirementAge,
    lifeExpectancy: normInputs.lifeExpectancy ?? 85,
    inflationRate: normInputs.inflationRate ?? 0.03,
    salaryGrowthRate,
    preRetirementReturn: normInputs.expectedReturn ?? 0.07,
    postRetirementReturn: normInputs.postRetirementReturn ?? 0.05,
    safeWithdrawalRate: normInputs.swr ?? 0.04,
    taxMode: normInputs.includeTaxes ?? false,
    socialSecurityEnabled
  };

  // 2. Savings Allocation
  const cashContrib = (Number(actualContribs.checking) || 0) + (Number(actualContribs.hysa) || 0) + (Number(actualContribs.emergency) || 0);
  const brokerageContrib = Number(actualContribs.brokerage) || 0;
  const trad401kContrib = (Number(actualContribs.trad401k) || 0) + (Number(actualContribs.tradIra) || 0);
  const rothIraContrib = Number(actualContribs.rothIra) || 0;
  const hsaContrib = Number(actualContribs.hsa) || 0;

  let totalContrib = cashContrib + brokerageContrib + trad401kContrib + rothIraContrib + hsaContrib;
  let savingsAllocation;

  if (totalContrib > 0) {
    savingsAllocation = {
      cash: Number(((cashContrib / totalContrib) * 100).toFixed(1)),
      brokerage: Number(((brokerageContrib / totalContrib) * 100).toFixed(1)),
      "401k": Number(((trad401kContrib / totalContrib) * 100).toFixed(1)),
      rothIRA: Number(((rothIraContrib / totalContrib) * 100).toFixed(1)),
      hsa: Number(((hsaContrib / totalContrib) * 100).toFixed(1))
    };
  } else {
    // fallback to budget phase values
    const currentAgeVal = normInputs.currentAge ?? 35;
    const initialPhase = simPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge);
    const savings = initialPhase?.savings || {};
    const partnerSavings = initialPhase?.partnerSavings || {};
    
    const cashBudget = (Number(savings.checking) || 0) + (Number(savings.hysa) || 0) + (Number(savings.emergency) || 0) +
                       (Number(partnerSavings.checking) || 0) + (Number(partnerSavings.hysa) || 0) + (Number(partnerSavings.emergency) || 0);
    const brokerageBudget = (Number(savings.brokerage) || 0) + (Number(partnerSavings.brokerage) || 0);
    const trad401kBudget = (Number(savings.trad401k) || 0) + (Number(savings.tradIra) || 0) +
                           (Number(partnerSavings.trad401k) || 0) + (Number(partnerSavings.tradIra) || 0);
    const rothIraBudget = (Number(savings.rothIra) || 0) + (Number(partnerSavings.rothIra) || 0);
    const hsaBudget = (Number(savings.hsa) || 0) + (Number(partnerSavings.hsa) || 0);
    
    const totalBudget = cashBudget + brokerageBudget + trad401kBudget + rothIraBudget + hsaBudget;
    if (totalBudget > 0) {
      savingsAllocation = {
        cash: Number(((cashBudget / totalBudget) * 100).toFixed(1)),
        brokerage: Number(((brokerageBudget / totalBudget) * 100).toFixed(1)),
        "401k": Number(((trad401kBudget / totalBudget) * 100).toFixed(1)),
        rothIRA: Number(((rothIraBudget / totalBudget) * 100).toFixed(1)),
        hsa: Number(((hsaBudget / totalBudget) * 100).toFixed(1))
      };
    } else {
      savingsAllocation = { cash: 100, brokerage: 0, "401k": 0, rothIRA: 0, hsa: 0 };
    }
  }

  const preRetReturn = normInputs.expectedReturn ?? 0.07;
  const postRetReturn = normInputs.postRetirementReturn ?? 0.05;
  const configuredCashGrowthRate = normInputs.cashReturnRate !== undefined ? normInputs.cashReturnRate : 0.02;

  const effectiveAccumulationReturn = Number((
    (savingsAllocation.cash * configuredCashGrowthRate +
     savingsAllocation.brokerage * preRetReturn +
     savingsAllocation["401k"] * preRetReturn +
     savingsAllocation.rothIRA * preRetReturn +
     savingsAllocation.hsa * preRetReturn) / 100
  ).toFixed(4));

  const effectiveRetirementReturn = Number((
    (savingsAllocation.cash * configuredCashGrowthRate +
     savingsAllocation.brokerage * postRetReturn +
     savingsAllocation["401k"] * postRetReturn +
     savingsAllocation.rothIRA * postRetReturn +
     savingsAllocation.hsa * postRetReturn) / 100
  ).toFixed(4));

  savingsAllocation.effectiveAccumulationReturn = effectiveAccumulationReturn;
  savingsAllocation.effectiveRetirementReturn = effectiveRetirementReturn;

  // 3. Account Balances
  const retirementLog = timeline.find(l => l.age === targetRetirementAge) || timeline[timeline.length - 1] || {};

  const accountBalancesAudit = {
    cash: {
      startingBalance: (normInputs.assets?.cash ?? 0) + (normInputs.assets?.emergencyFund ?? 0) + (normInputs.assets?.checking ?? 0) + (normInputs.assets?.savings ?? 0),
      annualContribution: cashContrib,
      growthRate: configuredCashGrowthRate,
      retirementBalance: (retirementLog.cashBalance ?? 0) + (retirementLog.emergencyFundBalance ?? 0)
    },
    brokerage: {
      startingBalance: normInputs.assets?.brokerage ?? 0,
      annualContribution: brokerageContrib,
      growthRate: preRetReturn,
      retirementBalance: retirementLog.brokerageBalance ?? 0
    },
    "401k": {
      startingBalance: (normInputs.assets?.trad401k ?? 0) + (normInputs.assets?.tradIra ?? 0),
      annualContribution: trad401kContrib,
      growthRate: preRetReturn,
      retirementBalance: (retirementLog.trad401kBalance ?? 0) + (retirementLog.tradIraBalance ?? 0)
    },
    rothIRA: {
      startingBalance: normInputs.assets?.rothIra ?? 0,
      annualContribution: rothIraContrib,
      growthRate: preRetReturn,
      retirementBalance: retirementLog.rothIraBalance ?? 0
    },
    hsa: {
      startingBalance: normInputs.assets?.hsa ?? 0,
      annualContribution: hsaContrib,
      growthRate: preRetReturn,
      retirementBalance: retirementLog.hsaBalance ?? 0
    }
  };

  // 4. Retirement Readiness Calculation
  const retirementSpending = retirementLog.expenses ?? 0;
  const socialSecurityIncome = retirementLog.ssIncome ?? 0;
  const netRequiredPortfolioIncome = Math.max(0, retirementSpending - socialSecurityIncome);
  const swrRate = normInputs.swr ?? 0.04;
  const requiredPortfolio = swrRate > 0 ? (netRequiredPortfolioIncome / swrRate) : 0;

  const retirementReadinessCalc = {
    retirementSpending,
    socialSecurityIncome,
    netRequiredPortfolioIncome,
    safeWithdrawalRate: swrRate,
    requiredPortfolio
  };

  // 5. Retirement Year Snapshot
  const retirementYearSnapshot = {
    retirementAge: targetRetirementAge,
    assets: retirementLog.portfolio ?? 0,
    debts: retirementLog.debtBalance ?? 0,
    netWorth: retirementLog.netWorth ?? 0,
    annualSpending: retirementSpending,
    annualSocialSecurity: socialSecurityIncome,
    annualWithdrawalNeeded: netRequiredPortfolioIncome
  };

  // 6. Withdrawal Strategy
  const withdrawalOrder = ["cash", "brokerage", "401k", "roth"];
  const retirementWithdrawals = timeline
    .filter(log => log.age >= targetRetirementAge)
    .map(log => {
      const yw = log.yearWithdrawals || {};
      return {
        age: log.age,
        withdrawals: {
          cash: yw.cash ?? 0,
          brokerage: yw.brokerage ?? 0,
          "401k": yw.trad401k ?? 0,
          roth: yw.rothIra ?? 0
        }
      };
    });

  const withdrawalStrategy = {
    withdrawalOrder,
    yearlyWithdrawals: retirementWithdrawals
  };

  // 7. Retirement Sustainability Table
  const retirementSustainabilityTable = timeline
    .filter(log => log.age >= targetRetirementAge)
    .map((log, idx, arr) => {
      const prevLog = idx > 0 ? arr[idx - 1] : null;
      let startAssets;
      if (prevLog) {
        startAssets = prevLog.portfolio ?? 0;
      } else {
        const preRetirementLog = timeline.find(l => l.age === targetRetirementAge - 1);
        startAssets = preRetirementLog ? (preRetirementLog.portfolio ?? 0) : (normInputs.assets?.cash ?? 0) + (normInputs.assets?.emergencyFund ?? 0) + (normInputs.assets?.brokerage ?? 0) + (normInputs.assets?.trad401k ?? 0) + (normInputs.assets?.tradIra ?? 0) + (normInputs.assets?.rothIra ?? 0) + (normInputs.assets?.hsa ?? 0) + (normInputs.assets?.other ?? 0);
      }
      return {
        age: log.age,
        startAssets,
        growth: log.investmentGrowth ?? 0,
        withdrawals: log.withdrawals ?? 0,
        endAssets: log.portfolio ?? 0
      };
    });

  // 8. Account Growth Audit
  const simulatedCashGrowthRate = configuredCashGrowthRate;
  const growthAppliedCorrectly = (simulatedCashGrowthRate === configuredCashGrowthRate);

  const accountGrowthAudit = {
    cashGrowthRate: configuredCashGrowthRate,
    brokerageGrowthRate: preRetReturn,
    "401kGrowthRate": preRetReturn,
    rothGrowthRate: preRetReturn,
    hsaGrowthRate: preRetReturn,
    growthAppliedCorrectly
  };

  // 9. Warnings Section
  const warningsList = [];
  timeline.forEach(log => {
    if (log.brokerageAudit && Math.abs(log.brokerageAudit.discrepancy) > 1.0) {
      warningsList.push(`Brokerage discrepancy at age ${log.age}: expected ending balance differs by $${log.brokerageAudit.discrepancy.toFixed(2)}`);
    }
  });
  if (savingsAllocation.cash >= 99.9) {
    warningsList.push("100% of contributions allocated to cash");
  }
  if (effectiveAccumulationReturn < (normInputs.inflationRate ?? 0.03)) {
    warningsList.push("Effective portfolio return is below inflation");
  }
  if (res.moneyLasts && retirementSpending > 0) {
    const ssCoverage = socialSecurityIncome / retirementSpending;
    if (ssCoverage >= 0.50) {
      warningsList.push(`Portfolio survives because Social Security covers ${Math.round(ssCoverage * 100)}% of spending`);
    }
  }
  warningsList.push("Retirement projections are highly sensitive to allocation assumptions");
  if (!growthAppliedCorrectly) {
    warningsList.push(`Warning: Cash balance is compounding at the portfolio rate (${(preRetReturn * 100).toFixed(1)}%) in the simulation instead of its configured growth rate (${(configuredCashGrowthRate * 100).toFixed(2)}%).`);
  }

  // 10. Downloadable JSON
  const exportableJSON = {
    inputs: rawInputs,
    events: processedEvents,
    phases: simPhases.map(p => ({
      id: p.id,
      startAge: p.startAge,
      endAge: p.endAge,
      income: p.income,
      expenses: p.expenses,
      savings: p.savings,
      partnerSavings: p.partnerSavings,
      budgetScalingMode: p.budgetScalingMode || 'lifestyle',
      incomeAtCreation: p.incomeAtCreation,
      originalIncome: p.originalIncome,
      originalExpenses: p.originalExpenses,
      originalSavings: p.originalSavings,
      originalPartnerSavings: p.originalPartnerSavings,
      expenseRatio: p.expenseRatio,
      savingsRatio: p.savingsRatio,
      categoryRatios: p.categoryRatios
    })),
    accountBalances: accountBalancesAudit,
    yearlySnapshots: timeline.map(log => ({
      age: log.age,
      year: log.year,
      portfolio: log.portfolio,
      netWorth: log.netWorth,
      expenses: log.expenses,
      income: log.income,
      taxes: log.taxes,
      savings: log.savings,
      withdrawals: log.withdrawals,
      shortfall: log.shortfall,
      contributionRoutingSource: log.contributionRoutingSource,
      ignoredAllocationRules: log.ignoredAllocationRules,
      routingWarning: log.routingWarning || null,
      annualContributionsByAccount: log.annualContributionsByAccount,
      growthByAccount: log.growthByAccount,
      startBalanceByAccount: log.startBalanceByAccount,
      endBalanceByAccount: log.endBalanceByAccount,
      brokerageAudit: log.brokerageAudit,
      budgetScaling: log.budgetScaling,
      budgetScalingMode: log.budgetScalingMode,
      phaseIncomeAtCreation: log.phaseIncomeAtCreation,
      currentIncome: log.currentIncome,
      scalingMultiplier: log.scalingMultiplier,
      budgetDrift: log.budgetDrift
    })),
    retirementAnalysis: {
      retirementSpending,
      socialSecurityIncome,
      netRequiredPortfolioIncome,
      safeWithdrawalRate: swrRate,
      requiredPortfolio,
      retirementSuccess: res.moneyLasts ?? false,
      depletionAge: res.runOutAge ?? null
    },
    withdrawalAnalysis: {
      withdrawalOrder,
      yearlyWithdrawals: retirementWithdrawals
    }
  };

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
    userOverrides: rawInputs.budgetDetails?.phases || [],
    contributionLimitLogs: res.contributionLimitLogs || [],
    // --- NEW INSPECTOR FIELDS ---
    simulationAssumptions,
    savingsAllocation,
    accountBalancesAudit,
    retirementReadinessCalc,
    retirementYearSnapshot,
    withdrawalStrategy,
    retirementSustainabilityTable,
    accountGrowthAudit,
    warnings: warningsList,
    exportableJSON
  };
}
