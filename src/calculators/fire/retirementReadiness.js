import { projectYearlyBalances } from './yearlySimulation.js';

export function calculateMinimumPortfolioForRetirement(profile, phases, events, retirementAge, simLifeExpectancy, readinessCriteria, excludeSS = false) {
  const testRes = projectYearlyBalances(profile, phases, events, retirementAge, simLifeExpectancy);
  const logs = testRes.logs;

  const retirementLogs = logs.filter(l => l.age >= retirementAge && l.age <= simLifeExpectancy);
  if (retirementLogs.length === 0) return 0;

  const swr = profile.swr !== undefined && profile.swr !== null ? Number(profile.swr) : 0.04;
  const postRetirementReturn = profile.postRetirementReturn !== undefined && profile.postRetirementReturn !== null ? Number(profile.postRetirementReturn) : 0.07;

  let endingTarget = 0;
  if (readinessCriteria === 'lastsIndefinitely') {
    const lastLog = retirementLogs[retirementLogs.length - 1];
    const lastNominalExpense = lastLog.expenses;
    const lastNominalIncome = lastLog.income - (excludeSS ? (lastLog.ssIncome || 0) : 0);
    endingTarget = Math.max(0, lastNominalExpense - lastNominalIncome) / swr;
  }

  let pNext = endingTarget;
  for (let i = retirementLogs.length - 1; i >= 0; i--) {
    const log = retirementLogs[i];
    const nominalExpense = log.expenses;
    const nominalIncome = log.income - (excludeSS ? (log.ssIncome || 0) : 0);
    const withdrawalNeeded = Math.max(0, nominalExpense - nominalIncome);
    pNext = (pNext + withdrawalNeeded) / (1 + postRetirementReturn);
  }

  return pNext;
}

export function computeRetirementResult(profile, phases, events, plannedProjection) {
  const currentAge = profile.currentAge;
  const lifeExpectancy = profile.lifeExpectancy;
  const targetRetirementAge = profile.targetRetirementAge;
  const inflationRate = profile.inflationRate;
  const swr = profile.swr;
  const assets = profile.assets || {};
  const currentConditions = events.filter(e => e.type === 'conditionItem');
  
  const customAssetsStartingValue = currentConditions
    .filter(c => ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type))
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const customHousesStartingValue = currentConditions
    .filter(c => c.type === 'house')
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const homeEquityBaseline = (Number(assets.realEstate) || 0) + customHousesStartingValue;

  const marriageEvent = events.find(e => e.type === 'marriage');
  const spouseMember = events.find(e => e.type === 'spouseMember');
  const hasMarriage = !!marriageEvent;
  const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
    ? Number(spouseMember.currentAge)
    : (marriageEvent && marriageEvent.spouseCurrentAge !== undefined ? Number(marriageEvent.spouseCurrentAge) : currentAge);
  const spouseLifeExpectancy = spouseMember && spouseMember.spouseLifeExpectancy !== undefined && spouseMember.spouseLifeExpectancy !== null && spouseMember.spouseLifeExpectancy !== ''
    ? Number(spouseMember.spouseLifeExpectancy)
    : (spouseMember && spouseMember.lifeExpectancy !== undefined && spouseMember.lifeExpectancy !== null && spouseMember.lifeExpectancy !== ''
      ? Number(spouseMember.lifeExpectancy)
      : (marriageEvent && marriageEvent.spouseLifeExpectancy !== undefined ? Number(marriageEvent.spouseLifeExpectancy) : lifeExpectancy));
  const userAgeWhenSpouseDies = currentAge + (spouseLifeExpectancy - spouseCurrentAge);
  const maxLifeExpectancy = hasMarriage ? Math.max(lifeExpectancy, userAgeWhenSpouseDies) : lifeExpectancy;

  const simYearsToCompute = Math.max(1, maxLifeExpectancy - currentAge);
  
  const deflatedLogs = plannedProjection.logs.map(log => {
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
      assets: log.assets / factor,
      debt: log.debt / factor,
      netWorthLedger: log.netWorthLedger ? {
        startingNetWorth: log.netWorthLedger.startingNetWorth / factor,
        savings: log.netWorthLedger.savings / factor,
        withdrawals: log.netWorthLedger.withdrawals / factor,
        investmentGrowth: log.netWorthLedger.investmentGrowth / factor,
        newDebtAdded: log.netWorthLedger.newDebtAdded / factor,
        debtPrincipalPaid: log.netWorthLedger.debtPrincipalPaid / factor,
        majorEventCosts: log.netWorthLedger.majorEventCosts / factor,
        endingNetWorth: log.netWorthLedger.endingNetWorth / factor,
        rows: log.netWorthLedger.rows.map(r => ({
          ...r,
          value: r.value / factor
        }))
      } : null,
      netWorthLedgerDebug: log.netWorthLedgerDebug ? {
        startingNetWorth: log.netWorthLedgerDebug.startingNetWorth / factor,
        savings: log.netWorthLedgerDebug.savings / factor,
        investmentGrowth: log.netWorthLedgerDebug.investmentGrowth / factor,
        lifeEventCosts: log.netWorthLedgerDebug.lifeEventCosts / factor,
        newDebtAdded: log.netWorthLedgerDebug.newDebtAdded / factor,
        debtPrincipalPaid: log.netWorthLedgerDebug.debtPrincipalPaid / factor,
        interestPaid: log.netWorthLedgerDebug.interestPaid / factor,
        endingNetWorth: log.netWorthLedgerDebug.endingNetWorth / factor,
        reconciliationDifference: log.netWorthLedgerDebug.reconciliationDifference / factor
      } : null,
      fiNumber: log.fiNumber / factor,
      fiNumberNoSS: log.fiNumberNoSS / factor,
      ssIncome: log.ssIncome / factor,
      retirementReadyTarget: log.retirementReadyTarget / factor,
      coastFireNumber: log.coastFireNumber / factor,
      childCosts: log.childCosts / factor,
      lifestyleGap: log.lifestyleGap / factor,
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

  const enabledEvents = events.filter(e => e.enabled !== false);
  const socialSecurityDetails = profile.socialSecurityDetails || { monthlyBenefit: 0 };
  
  const customDebtsSum = currentConditions
    .filter(c => c.type === 'debt' && c.creditCardHandling !== 'payoff' && (Number(c.value) || 0) > 0)
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const baseActiveLoansSum = (profile.debtList || []).reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
  const initialDebtSum = baseActiveLoansSum + customDebtsSum;

  const currentInvestedAssets = (Number(assets.cash) || 0) +
                       (Number(assets.emergencyFund) || 0) +
                       (Number(assets.brokerage) || 0) +
                       (Number(assets.trad401k) || 0) +
                       (Number(assets.tradIra) || 0) +
                       (Number(assets.rothIra) || 0) +
                       (Number(assets.hsa) || 0) +
                       (Number(assets.other) || 0) +
                       customAssetsStartingValue;

  const simpleIncome = Number(profile.simpleIncome) || 0;
  const simpleExpenses = Number(profile.simpleExpenses) || 0;
  const annualSavings = simpleIncome - simpleExpenses;

  let retirementIncomeSourcesInTodayDollarsGuard = 0;
  enabledEvents.forEach(ev => {
    if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
      let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
      if (ev.type === 'socialSecurity') {
        monthlyBenefit = socialSecurityDetails.monthlyBenefit;
      }
      retirementIncomeSourcesInTodayDollarsGuard += monthlyBenefit * 12;
    }
  });

  const retireEv = events.find(e => e.type === 'retire' && e.enabled !== false);
  const retSpendingPercent = (retireEv?.spendingPercent !== undefined
    ? Number(retireEv.spendingPercent)
    : 70) / 100;
  const retirementSpending = simpleExpenses * retSpendingPercent;

  const hasGuaranteedFutureRetirementIncome = retirementIncomeSourcesInTodayDollarsGuard >= retirementSpending;

  const shouldSkipSearch = profile.skipReadyAgeSearch || (
    currentInvestedAssets <= 0 && 
    annualSavings <= 0 && 
    !hasGuaranteedFutureRetirementIncome
  );

  let retirementReadyAgeSWR = null;
  let retirementReadyAgeComfortable = null;
  let retirementReadyAgeSurvival = null;

  if (!shouldSkipSearch) {
    let lowS = currentAge;
    let highS = maxLifeExpectancy;
    while (lowS <= highS) {
      const mid = Math.floor((lowS + highS) / 2);
      const testRes = projectYearlyBalances(profile, phases, events, mid);
      if (testRes.moneyLasts) {
        retirementReadyAgeSurvival = mid;
        highS = mid - 1;
      } else {
        lowS = mid + 1;
      }
    }
  }

  const retirementReadyAge = retirementReadyAgeSurvival;
  retirementReadyAgeSurvival = retirementReadyAge;
  retirementReadyAgeComfortable = retirementReadyAge;
  retirementReadyAgeSWR = retirementReadyAge;
  const readinessCriteria = 'lastsLifeExp';

  const retirementSpendingPercent = (events.find(e => e.type === 'retire' && e.enabled)?.spendingPercent !== undefined
    ? Number(events.find(e => e.type === 'retire' && e.enabled).spendingPercent)
    : 70) / 100;

  let retirementReadyTarget = 0;
  let nominalRetirementReadyTarget = 0;
  let retirementReadyTargetNoSS = 0;
  let nominalRetirementReadyTargetNoSS = 0;
  if (retirementReadyAge !== null) {
    const maxAgeOverride = maxLifeExpectancy;
    const nominalTarget = calculateMinimumPortfolioForRetirement(profile, phases, events, retirementReadyAge, maxAgeOverride, readinessCriteria, false);
    nominalRetirementReadyTarget = nominalTarget;
    const factor = Math.pow(1 + inflationRate, retirementReadyAge - currentAge);
    retirementReadyTarget = nominalTarget / factor;

    // Retire Indefinitely without SS (SWR target)
    const nominalTargetNoSS = calculateMinimumPortfolioForRetirement(profile, phases, events, retirementReadyAge, maxLifeExpectancy, 'lastsIndefinitely', true);
    nominalRetirementReadyTargetNoSS = nominalTargetNoSS;
    retirementReadyTargetNoSS = nominalTargetNoSS / factor;
  }

  let retirementReadyTargetComfortable = 0;
  let retirementReadyTargetSurvival = 0;

  if (retirementReadyAgeSurvival !== null) {
    retirementReadyTargetSurvival = calculateMinimumPortfolioForRetirement(profile, phases, events, retirementReadyAgeSurvival, maxLifeExpectancy, 'lastsLifeExp', false);
    retirementReadyTargetComfortable = retirementReadyTargetSurvival;
  }

  const swrVal = profile.swr !== undefined && profile.swr !== null ? Number(profile.swr) : 0.04;
  const currentExpenses = profile.simpleExpenses !== undefined && profile.simpleExpenses !== null ? Number(profile.simpleExpenses) : 42500;
  const retireTodayTarget = swrVal > 0 ? currentExpenses / swrVal : 0;

  const retirementLog = deflatedLogs.find(log => log.age === targetRetirementAge) || deflatedLogs[deflatedLogs.length - 1];
  const finalSurplusShortfall = plannedProjection.endingSurplusShortfall / Math.pow(1 + inflationRate, simYearsToCompute);

  // Calculate shortfall and required assets at desired retirement age (targetRetirementAge)
  const nominalRequiredAtDesired = calculateMinimumPortfolioForRetirement(profile, phases, events, targetRetirementAge, maxLifeExpectancy, 'lastsLifeExp', false);
  const factorAtDesired = Math.pow(1 + inflationRate, Math.max(0, targetRetirementAge - currentAge));
  const deflatedRequiredAtDesired = nominalRequiredAtDesired / factorAtDesired;

  const nominalRetirementLog = plannedProjection.logs.find(log => log.age === targetRetirementAge) || plannedProjection.logs[plannedProjection.logs.length - 1];
  const nominalProjectedAtDesired = nominalRetirementLog ? nominalRetirementLog.portfolio : 0;
  const deflatedProjectedAtDesired = retirementLog ? retirementLog.portfolio : 0;

  // Plan success check: user stops working at desired retirement age,
  // and total net worth never drops below $0 from desired retirement age through lifeExpectancy.
  let isSolventAtDesired = true;
  if (!plannedProjection.moneyLasts) {
    isSolventAtDesired = false;
  } else {
    for (let i = 0; i < deflatedLogs.length; i++) {
      const log = deflatedLogs[i];
      if (log.age >= targetRetirementAge && log.age <= lifeExpectancy) {
        if (log.netWorth < 0) {
          isSolventAtDesired = false;
          break;
        }
      }
    }
  }

  let deflatedShortfallAtDesired = isSolventAtDesired ? 0 : deflatedRequiredAtDesired - deflatedProjectedAtDesired;
  if (!isSolventAtDesired && deflatedShortfallAtDesired <= 0) {
    deflatedShortfallAtDesired = 1; // force a small positive shortfall to trigger the options button
  }
  let nominalShortfallAtDesired = isSolventAtDesired ? 0 : nominalRequiredAtDesired - nominalProjectedAtDesired;
  if (!isSolventAtDesired && nominalShortfallAtDesired <= 0) {
    nominalShortfallAtDesired = 1;
  }

  let retirementOutcome;
  if (plannedProjection.runOutAge === null && isSolventAtDesired) {
    if (retirementReadyAgeComfortable !== null && targetRetirementAge >= retirementReadyAgeComfortable) {
      retirementOutcome = 'comfortable';
    } else {
      retirementOutcome = 'sustainable';
    }
  } else {
    retirementOutcome = 'retirementGap';
  }


  let nominalRetirementIncomeSources = 0;
  let retirementIncomeSourcesInTodayDollars = 0;
  enabledEvents.forEach(ev => {
    if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
      const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
      let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
      if (ev.type === 'socialSecurity') {
        monthlyBenefit = socialSecurityDetails.monthlyBenefit;
      }
      let annualAmt = monthlyBenefit * 12;
      retirementIncomeSourcesInTodayDollars += annualAmt;
      const isInflationAdjusted = ev.type === 'socialSecurity' || ev.inflationAdjusted !== false;
      if (isInflationAdjusted) {
        const factor = Math.pow(1 + inflationRate, claimingAge - currentAge);
        annualAmt = annualAmt * factor;
      }
      nominalRetirementIncomeSources += annualAmt;
    }
  });

  return {
    currentNetWorth: (Number(assets.cash) || 0) +
                     (Number(assets.emergencyFund) || 0) +
                     (Number(assets.brokerage) || 0) +
                     (Number(assets.trad401k) || 0) +
                     (Number(assets.tradIra) || 0) +
                     (Number(assets.rothIra) || 0) +
                     (Number(assets.hsa) || 0) +
                     (Number(assets.other) || 0) +
                     customAssetsStartingValue +
                     homeEquityBaseline -
                     initialDebtSum -
                     plannedProjection.logs[plannedProjection.logs.length - 1].debtBalance,
    fiNumber: retirementReadyTarget,
    fiAge: retirementReadyAge,
    yearsToFI: retirementReadyAge !== null ? Math.max(0, retirementReadyAge - currentAge) : null,
    retirementReadyAge: retirementReadyAge,
    isRetirementSuccessful: retirementReadyAge !== null && retirementReadyAge !== undefined,
    retirementReadyTarget: retirementReadyTarget,
    retirementReadyTargetNoSS: retirementReadyTargetNoSS,
    retirementReadyTargetComfortable,
    retirementReadyTargetSurvival,
    retireTodayTarget,
    deflatedRetirementReadyTargetComfortable: retirementReadyTargetComfortable / Math.pow(1 + inflationRate, (retirementReadyAgeComfortable || currentAge) - currentAge),
    deflatedRetirementReadyTargetSurvival: retirementReadyTargetSurvival / Math.pow(1 + inflationRate, (retirementReadyAgeSurvival || currentAge) - currentAge),
    retirementReadyAgeSWR,
    retirementReadyAgeComfortable,
    retirementReadyAgeSurvival,
    readinessCriteria,
    retirementIncomeSources: retirementIncomeSourcesInTodayDollars,
    targetRetirementAge,
    portfolioAtRetirement: retirementLog ? retirementLog.portfolio : 0,
    netWorthAtRetirement: retirementLog ? retirementLog.netWorth : 0,
    annualRetirementSpending: retirementLog ? retirementLog.expenses : 0,
    retirementOutcome,
    moneyLasts: plannedProjection.moneyLasts,
    runOutAge: plannedProjection.runOutAge,
    endingSurplusShortfall: finalSurplusShortfall,
    coastAge: plannedProjection.coastAge,
    dynamicMilestones: plannedProjection.dynamicMilestones,
    debtSummaries: plannedProjection.debtSummaries,
    weddingFinancingDetails: plannedProjection.weddingFinancingDetails,
    data: deflatedLogs,
    socialSecurityDetails,
    deflatedData: deflatedLogs,
    nominalData: plannedProjection.logs,
    nominalRetirementReadyTarget,
    nominalRetirementReadyTargetNoSS,
    deflatedRetirementReadyTarget: retirementReadyTarget,
    deflatedRetirementReadyTargetNoSS: retirementReadyTargetNoSS,
    nominalPortfolioAtRetirement: nominalRetirementLog ? nominalRetirementLog.portfolio : 0,
    deflatedPortfolioAtRetirement: retirementLog ? retirementLog.portfolio : 0,
    nominalNetWorthAtRetirement: nominalRetirementLog ? nominalRetirementLog.netWorth : 0,
    deflatedNetWorthAtRetirement: retirementLog ? retirementLog.netWorth : 0,
    nominalAnnualRetirementSpending: nominalRetirementLog ? nominalRetirementLog.expenses : 0,
    deflatedAnnualRetirementSpending: retirementLog ? retirementLog.expenses : 0,
    nominalEndingSurplusShortfall: plannedProjection.nominalEndingSurplusShortfall !== undefined ? plannedProjection.nominalEndingSurplusShortfall : plannedProjection.endingSurplusShortfall,
    deflatedEndingSurplusShortfall: finalSurplusShortfall,
    nominalRetirementIncomeSources,
    deflatedRetirementIncomeSources: retirementIncomeSourcesInTodayDollars,
    nominalRequiredAtDesired,
    deflatedRequiredAtDesired,
    nominalProjectedAtDesired,
    deflatedProjectedAtDesired,
    nominalShortfallAtDesired,
    deflatedShortfallAtDesired,
    isSolventAtDesired
  };
}
