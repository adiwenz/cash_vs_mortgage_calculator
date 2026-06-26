import { derivePhasesFromEvents } from '../phases.js';
import { initializeActiveLoans } from '../debts.js';
import { resolveSavingsRoutingSource } from './resolveSavingsRoutingSource.js';
import { isRelationshipStartEvent } from '../../../features/fire/events/eventTypeGuards.js';

export function buildSimulationContext(profile, phases, events, targetRetirementAge, customLifeExpectancy = null) {
  const updatedEvents = events.map(e => {
    if (e.type === 'retire') {
      return { ...e, age: targetRetirementAge };
    }
    return e;
  });
  const useLifeProfile = !!profile.useLifeProfile;
  const currentAge = profile.currentAge;
  const lifeExpectancy = profile.lifeExpectancy;
  const expectedReturn = profile.expectedReturn;
  const postRetirementReturn = profile.postRetirementReturn;
  const accountReturnOverrides = profile.accountReturnOverrides || {};
  const inflationRate = profile.inflationRate;
  const cashReturnRate = profile.cashReturnRate !== undefined ? profile.cashReturnRate : 0.02;
  const lifestyleUpgrades = profile.lifestyleUpgrades;
  const swr = profile.swr;
  const includeTaxes = profile.includeTaxes;
  const enableHealthcareModel = profile.enableHealthcareModel;
  const filingStatus = profile.filingStatus;
  const enforceEarlyWithdrawalPenalty = true;
  const allocationRules = profile.allocationRules || [];
  const assets = profile.assets || {};
  const retireEv = updatedEvents.find(e => e.type === 'retire' && e.enabled !== false);
  const retirementSpendingPercent = (retireEv?.spendingPercent !== undefined
    ? Number(retireEv.spendingPercent)
    : 70) / 100;
  const currentConditions = updatedEvents.filter(e => e.type === 'conditionItem');
  
  const customHousesStartingValue = currentConditions
    .filter(c => c.type === 'house')
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const homeEquityBaseline = (Number(assets.realEstate) || 0) + customHousesStartingValue;

  const marriageEvent = updatedEvents.find(isRelationshipStartEvent);
  const spouseMember = updatedEvents.find(e => e.type === 'spouseMember');
  const hasMarriage = !!marriageEvent;
  const marriageAge = marriageEvent ? (Number(marriageEvent.age) || 40) : 999;
  const weddingAge = marriageEvent ? (Number(marriageEvent.weddingAge) || marriageAge) : 999;
  const includeWeddingCost = marriageEvent ? !!marriageEvent.includeWeddingCost : false;
  const weddingCost = marriageEvent ? (Number(marriageEvent.weddingCost) || 0) : 0;

  const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
    ? Number(spouseMember.currentAge)
    : (marriageEvent && marriageEvent.spouseCurrentAge !== undefined ? Number(marriageEvent.spouseCurrentAge) : currentAge);
  const spouseLifeExpectancy = spouseMember && spouseMember.spouseLifeExpectancy !== undefined && spouseMember.spouseLifeExpectancy !== null && spouseMember.spouseLifeExpectancy !== ''
    ? Number(spouseMember.spouseLifeExpectancy)
    : (spouseMember && spouseMember.lifeExpectancy !== undefined && spouseMember.lifeExpectancy !== null && spouseMember.lifeExpectancy !== ''
      ? Number(spouseMember.lifeExpectancy)
      : (marriageEvent && marriageEvent.spouseLifeExpectancy !== undefined ? Number(marriageEvent.spouseLifeExpectancy) : lifeExpectancy));
  const userAgeWhenSpouseDies = currentAge + (spouseLifeExpectancy - spouseCurrentAge);
  const ageDifference = spouseCurrentAge - currentAge;

  const maxLifeExpectancy = hasMarriage ? Math.max(lifeExpectancy, userAgeWhenSpouseDies) : lifeExpectancy;

  const simLifeExpectancy = customLifeExpectancy || maxLifeExpectancy;
  const simYearsToCompute = Math.max(1, simLifeExpectancy - currentAge);
  
  const simPhases = (targetRetirementAge === profile.targetRetirementAge && simLifeExpectancy === profile.lifeExpectancy)
    ? phases
    : derivePhasesFromEvents({ ...profile, targetRetirementAge, lifeExpectancy: simLifeExpectancy }, updatedEvents, profile.budgetDetails?.phases || []);

  const routingSource = resolveSavingsRoutingSource(profile);
  let effectivePhases = simPhases;
  if (routingSource !== 'budget_savings') {
    effectivePhases = simPhases.map(p => ({
      ...p,
      savings: {},
      partnerSavings: {}
    }));
  }

  let checkingBalance = (assets.checking !== undefined && !isNaN(Number(assets.checking))) ? Number(assets.checking) : (Number(assets.cash) || 0);
  let hysaBalance = (assets.hysa !== undefined && !isNaN(Number(assets.hysa))) ? Number(assets.hysa) : 0;
  
  let balances = {
    cash: checkingBalance + hysaBalance,
    emergencyFund: Number(assets.emergencyFund) || 0,
    brokerage: Number(assets.brokerage) || 0,
    trad401k: Number(assets.trad401k) || 0,
    tradIra: Number(assets.tradIra) || 0,
    rothIra: Number(assets.rothIra) || 0,
    hsa: Number(assets.hsa) || 0,
    other: Number(assets.other) || 0
  };

  currentConditions.forEach(cond => {
    const val = Number(cond.value) || 0;
    if (val <= 0) return;
    if (cond.type === 'checkingSavings') {
      balances.cash += val;
      checkingBalance += val;
    } else if (cond.type === 'brokerage') {
      balances.brokerage += val;
    } else if (cond.type === 'retirement') {
      const sub = cond.subtype || 'trad401k';
      if (balances[sub] !== undefined) {
        balances[sub] += val;
      }
    } else if (cond.type === 'asset') {
      balances.other += val;
    }
  });

  let activeLoans = initializeActiveLoans(profile, currentConditions, currentAge);

  let customAssets = currentConditions
    .filter(c => ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type))
    .map(c => ({
      id: c.id,
      type: c.type,
      subtype: c.subtype,
      name: c.name,
      balance: Number(c.value) || 0,
      growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : null,
      monthlyContribution: Number(c.monthlyAmount) || 0,
      endAge: c.endAge ? Number(c.endAge) : null
    }));

  let customHouses = currentConditions
    .filter(c => c.type === 'house')
    .map(c => ({
      id: c.id,
      name: c.name,
      value: Number(c.value) || 0,
      growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : 0.03,
      monthlyCost: Number(c.monthlyAmount) || 0,
      endAge: c.endAge ? Number(c.endAge) : null
    }));

  let customChildren = currentConditions
    .filter(c => c.type === 'child')
    .map(c => ({
      id: c.id,
      name: c.name,
      monthlyCost: Number(c.monthlyAmount) || 0,
      growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : inflationRate,
      endAge: c.endAge ? Number(c.endAge) : null
    }));

  let customObligations = currentConditions
    .filter(c => c.type === 'obligation' || (c.type === 'debt' && (c.creditCardHandling === 'payoff' || !(Number(c.value) > 0))))
    .map(c => ({
      id: c.id,
      name: c.name || (c.type === 'debt' ? `${c.subtype || 'Debt'} Payment` : 'Obligation'),
      monthlyCost: Number(c.monthlyAmount) || 0,
      growthRate: (c.type === 'debt') ? 0 : (c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : inflationRate),
      endAge: c.endAge ? Number(c.endAge) : null
    }));

  const brokerageExists = profile.assets && (profile.assets.brokerage !== undefined);
  const redirectDest = brokerageExists ? 'brokerage' : 'cash';

  const isCombined = marriageEvent ? (marriageEvent.combineFinances !== false) : true;
  const isLivingTogether = marriageEvent ? (marriageEvent.livingTogether !== false) : true;
  const combinedSpendingAfterMarriage = isCombined ? (marriageEvent ? (Number(marriageEvent.combinedSpendingAfterMarriage) || 0) : 0) : 0;

  let initialSpending;
  
  const spendingPhases = profile.spendingPhases || [];
  const incomeList = profile.incomeList || [];

  if (marriageEvent && currentAge >= Number(marriageEvent.age) && isCombined && combinedSpendingAfterMarriage > 0) {
    initialSpending = combinedSpendingAfterMarriage;
  } else {
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
      initialSpending = Number(profile.simpleExpenses) || 42500;
    }
  }

  const isAdvanced = !!profile.isAdvancedMode;
  if (!isAdvanced && includeTaxes) {
    initialSpending = Math.max(0, initialSpending - (profile.year0Taxes || 0));
  }

  let spouseIncome = isCombined ? (spouseMember ? (Number(spouseMember.income) || 0) : (marriageEvent ? (Number(marriageEvent.spouseIncome) || 0) : 0)) : 0;
  let spouseGrowth = isCombined ? (spouseMember 
    ? (Number(spouseMember.incomeGrowthRate !== undefined ? spouseMember.incomeGrowthRate : spouseMember.growthRate) || 0)
    : (marriageEvent ? (Number(marriageEvent.incomeGrowthRate !== undefined ? marriageEvent.incomeGrowthRate : marriageEvent.growthRate) || 0) : 0)) : 0;
  if (spouseGrowth > 0.5) spouseGrowth /= 100;
  spouseGrowth = Math.min(0.25, Math.max(0, spouseGrowth));

  let spouseSavingsRate = isCombined ? (spouseMember ? (Number(spouseMember.savingsRate) || 0) : (marriageEvent ? (Number(marriageEvent.savingsRate) || 0) : 0)) : 0;
  let spouseCash = isCombined ? (spouseMember?.assets ? (Number(spouseMember.assets.cash) || 0) : (marriageEvent ? (Number(marriageEvent.cash) || 0) : 0)) : 0;
  let spouseInvestments = isCombined ? (spouseMember?.assets ? (Number(spouseMember.assets.investments) || 0) : (marriageEvent ? (Number(marriageEvent.investments) || 0) : 0)) : 0;
  let spouseRetirement = isCombined ? (spouseMember?.assets ? (Number(spouseMember.assets.retirement) || 0) : (marriageEvent ? (Number(marriageEvent.retirement) || 0) : 0)) : 0;

  const spouseDebtStudent = isCombined ? (Number(spouseMember?.debts?.student) || Number(marriageEvent?.debtStudent) || 0) : 0;
  const spouseDebtCredit = isCombined ? (Number(spouseMember?.debts?.credit) || Number(marriageEvent?.debtCredit) || 0) : 0;
  const spouseDebtOther = isCombined ? (Number(spouseMember?.debts?.other) || Number(marriageEvent?.debtOther) || 0) : 0;

  const spouseRetirementSpendingNeed = isCombined ? (spouseMember ? (Number(spouseMember.spouseRetirementSpending) || 0) : (marriageEvent ? (Number(marriageEvent.spouseRetirementSpending) || 0) : 0)) : 0;
  const lifestyleAdjustment = isCombined ? (marriageEvent ? (Number(marriageEvent.lifestyleAdjustment) || 0) : 0) : 0;
  const housingSavings = (isCombined && isLivingTogether) ? (marriageEvent ? (Number(marriageEvent.housingSavings) || 0) : 0) : 0;
  const housingCost = (isCombined && isLivingTogether) ? (marriageEvent ? (Number(marriageEvent.housingCost) || 0) : 0) : 0;

  const socialSecurityDetails = profile.socialSecurityDetails || { monthlyBenefit: 0 };
  const spouseSocialSecurityDetails = profile.spouseSocialSecurityDetails;

  const customIncomes = currentConditions
    .filter(c => c.type === 'income')
    .map(c => ({
      id: c.id || `custom-income-${Date.now()}`,
      name: c.name || 'Income Source',
      amount: Number(c.monthlyAmount || 0) * 12,
      startAge: currentAge,
      endAge: c.endAge ? Number(c.endAge) : lifeExpectancy,
      growthRate: c.rate !== undefined && c.rate !== null && c.rate !== '' ? (Number(c.rate) / 100) : 0.03,
      frequency: 'yearly',
      isTaxable: true
    }));
  const combinedIncomeList = [...incomeList, ...customIncomes];

  const enabledEvents = updatedEvents.filter(e => e.enabled !== false);

  return {
    currentAge,
    lifeExpectancy,
    expectedReturn,
    postRetirementReturn,
    inflationRate,
    cashReturnRate,
    lifestyleUpgrades,
    swr,
    includeTaxes,
    enableHealthcareModel,
    filingStatus,
    enforceEarlyWithdrawalPenalty,
    allocationRules,
    assets,
    retirementSpendingPercent,
    currentConditions,
    customHousesStartingValue,
    homeEquityBaseline,
    marriageEvent,
    spouseMember,
    hasMarriage,
    marriageAge,
    weddingAge,
    includeWeddingCost,
    weddingCost,
    spouseCurrentAge,
    spouseLifeExpectancy,
    userAgeWhenSpouseDies,
    ageDifference,
    maxLifeExpectancy,
    simLifeExpectancy,
    simYearsToCompute,
    simPhases: effectivePhases,
    checkingBalance,
    hysaBalance,
    balances,
    activeLoans,
    customAssets,
    customHouses,
    customChildren,
    customObligations,
    brokerageExists,
    redirectDest,
    initialSpending,
    spouseIncome,
    spouseGrowth,
    spouseSavingsRate,
    spouseCash,
    spouseInvestments,
    spouseRetirement,
    spouseDebtStudent,
    spouseDebtCredit,
    spouseDebtOther,
    spouseRetirementSpendingNeed,
    combinedSpendingAfterMarriage,
    lifestyleAdjustment,
    housingSavings,
    housingCost,
    socialSecurityDetails,
    spouseSocialSecurityDetails,
    combinedIncomeList,
    enabledEvents,
    useLifeProfile,
    accountReturnOverrides
  };
}
