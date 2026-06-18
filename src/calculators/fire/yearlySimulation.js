import {
  U_S_TAX_DATA,
  calculateUSTax,
  getActiveChildrenCountAtAge,
  getRetirementLimit
} from '../../simulatorMathUtils.js';
import { derivePhasesFromEvents } from './phases.js';
import { getSocialSecurityFactor } from './socialSecurity.js';
import {
  deductFromLiquidAssets,
  coverShortfall,
  solveTraditionalWithdrawal
} from './assetsAndWithdrawals.js';
import {
  initializeActiveLoans,
  processYearlyDebtPayments
} from './debts.js';
import {
  handleHousePurchase,
  handleHouseSale,
  processYearlyHousingUpdates
} from './housing.js';
import { calculateYearlyChildCosts } from './children.js';
import {
  handleMarriageAssetInjection,
  handleWeddingCost,
  handleMarriageDebtInjection
} from './marriage.js';

function formatCurrency(val) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
}

function sumNonDebtExpenses(expensesMap, activeProperties = [], age = null) {
  if (!expensesMap) return 0;
  let housingCost = Number(expensesMap.housing) || 0;
  if (activeProperties.length > 0 && age !== null) {
    activeProperties.forEach(prop => {
      if (age >= prop.purchaseAge) {
        const p = prop.homePrice || 0;
        const propTaxRate = prop.propertyTaxRate || 0;
        const insRate = prop.insuranceRate || 0;
        const maintRate = prop.maintenanceRate || 0;
        
        const monthlyPropTax = (p * propTaxRate) / 12;
        const monthlyIns = (p * insRate) / 12;
        const monthlyMaint = (p * maintRate) / 12;
        const monthlyHoa = prop.hoa || 0;
        const monthlyUtil = prop.utilitiesIncrease || 0;
        
        let monthlyPmi = 0;
        if (prop.purchaseType !== 'cash' && prop.downPayment < p * 0.2) {
          const pmiRate = prop.pmiRate || 0.5;
          const loanAmount = Math.max(0, p - prop.downPayment);
          monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
        }
        
        const propertyNonMortgageCosts = monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi;
        housingCost = Math.max(0, housingCost - Math.round(propertyNonMortgageCosts));
      }
    });
  }
  return Object.keys(expensesMap)
    .filter(k => !k.startsWith('debt_') && k !== '🏠 Mortgage' && k !== 'mortgage' && k !== 'housing')
    .reduce((sum, k) => sum + (Number(expensesMap[k]) || 0), 0) + housingCost;
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

function isGeneratedMainIncome(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('child-income-boost') ||
         id.startsWith('simple-inc-prechild') ||
         id.startsWith('simple-inc-worksave') ||
         id.startsWith('simple-inc-childcare') ||
         id === 'simple-inc' ||
         id === 'inc-1';
}

export function projectYearlyBalances(profile, phases, events, targetRetirementAge, customLifeExpectancy = null) {
  const currentAge = profile.currentAge;
  const lifeExpectancy = profile.lifeExpectancy;
  const expectedReturn = profile.expectedReturn;
  const postRetirementReturn = profile.postRetirementReturn;
  const inflationRate = profile.inflationRate;
  const cashReturnRate = profile.cashReturnRate !== undefined ? profile.cashReturnRate : 0.02;
  const lifestyleUpgrades = profile.lifestyleUpgrades;
  const swr = profile.swr;
  const fireMode = profile.fireMode;
  const includeTaxes = profile.includeTaxes;
  const enableHealthcareModel = profile.enableHealthcareModel;
  const filingStatus = profile.filingStatus;
  const enforceEarlyWithdrawalPenalty = true;
  const allocationRules = profile.allocationRules || [];
  const assets = profile.assets || {};
  const retireEv = events.find(e => e.type === 'retire' && e.enabled !== false);
  const retirementSpendingPercent = (retireEv?.spendingPercent !== undefined
    ? Number(retireEv.spendingPercent)
    : 70) / 100;
  const currentConditions = events.filter(e => e.type === 'conditionItem');
  
  const customHousesStartingValue = currentConditions
    .filter(c => c.type === 'house')
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const homeEquityBaseline = (Number(assets.realEstate) || 0) + customHousesStartingValue;

  const marriageEvent = events.find(e => e.type === 'marriage');
  const spouseMember = events.find(e => e.type === 'spouseMember');
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
    : derivePhasesFromEvents({ ...profile, targetRetirementAge, lifeExpectancy: simLifeExpectancy }, events, profile.budgetDetails?.phases || []);

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

  let hasRunOut = false;
  let runOutAge = null;
  let endingSurplusShortfall = 0;
  let cumulativeShortfall = 0;
  
  const brokerageExists = profile.assets && (profile.assets.brokerage !== undefined);
  const redirectDest = brokerageExists ? 'brokerage' : 'cash';
  let yearsWithLimitsReached = 0;
  let totalRedirectedSavings = 0;
  let contributionLimitLogs = [];
  let debtBalance = 0;
  let initialSpending;
  
  const spendingPhases = profile.spendingPhases || [];
  const incomeList = profile.incomeList || [];

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

  const isAdvanced = !!profile.isAdvancedMode;
  if (!isAdvanced && includeTaxes) {
    initialSpending = Math.max(0, initialSpending - (profile.year0Taxes || 0));
  }
  
  let lastWorkingYearSpendingNominal = initialSpending;
  let userLastWorkingSpendingNominal = initialSpending;
  let purchasedProperties = [];
  let isCoasting = false;
  let coastAge = null;
  let logs = [];
  let dynamicMilestones = [];

  let standardDeduction = 0;
  let nominalBrackets = [];
  let taxableIncome = 0;
  let annualEarlyWithdrawalPenalties = 0;

  let spouseIncome = spouseMember ? (Number(spouseMember.income) || 0) : (marriageEvent ? (Number(marriageEvent.spouseIncome) || 0) : 0);
  let spouseGrowth = spouseMember 
    ? (Number(spouseMember.incomeGrowthRate !== undefined ? spouseMember.incomeGrowthRate : spouseMember.growthRate) || 0)
    : (marriageEvent ? (Number(marriageEvent.incomeGrowthRate !== undefined ? marriageEvent.incomeGrowthRate : marriageEvent.growthRate) || 0) : 0);
  if (spouseGrowth > 0.5) spouseGrowth /= 100;

  let spouseSavingsRate = spouseMember ? (Number(spouseMember.savingsRate) || 0) : (marriageEvent ? (Number(marriageEvent.savingsRate) || 0) : 0);
  let spouseCash = spouseMember?.assets ? (Number(spouseMember.assets.cash) || 0) : (marriageEvent ? (Number(marriageEvent.cash) || 0) : 0);
  let spouseInvestments = spouseMember?.assets ? (Number(spouseMember.assets.investments) || 0) : (marriageEvent ? (Number(marriageEvent.investments) || 0) : 0);
  let spouseRetirement = spouseMember?.assets ? (Number(spouseMember.assets.retirement) || 0) : (marriageEvent ? (Number(marriageEvent.retirement) || 0) : 0);

  const spouseDebtStudent = Number(spouseMember?.debts?.student) || Number(marriageEvent?.debtStudent) || 0;
  const spouseDebtCredit = Number(spouseMember?.debts?.credit) || Number(marriageEvent?.debtCredit) || 0;
  const spouseDebtOther = Number(spouseMember?.debts?.other) || Number(marriageEvent?.debtOther) || 0;

  const spouseRetirementSpendingNeed = spouseMember ? (Number(spouseMember.spouseRetirementSpending) || 0) : (marriageEvent ? (Number(marriageEvent.spouseRetirementSpending) || 0) : 0);
  const combinedSpendingAfterMarriage = marriageEvent ? (Number(marriageEvent.combinedSpendingAfterMarriage) || 0) : 0;
  const lifestyleAdjustment = marriageEvent ? (Number(marriageEvent.lifestyleAdjustment) || 0) : 0;
  const housingSavings = marriageEvent ? (Number(marriageEvent.housingSavings) || 0) : 0;
  const housingCost = marriageEvent ? (Number(marriageEvent.housingCost) || 0) : 0;

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

  const enabledEvents = events.filter(e => e.enabled !== false);

  // We wrap the loop state variables in a mutable state object to pass into our helpers
  const state = {
    balances,
    customAssets,
    taxableIncome,
    annualEarlyWithdrawalPenalties,
    hasRunOut,
    runOutAge,
    cumulativeShortfall,
    includeTaxes,
    enforceEarlyWithdrawalPenalty,
    standardDeduction,
    nominalBrackets,
    currentAge
  };

  const syncVirtualCashBalancesFromBalancesCash = () => {
    const totalVirtual = checkingBalance + hysaBalance;
    const actualCash = balances.cash;
    if (Math.abs(totalVirtual - actualCash) < 0.01) return;
    if (actualCash <= 0) {
      checkingBalance = 0;
      hysaBalance = 0;
    } else if (totalVirtual <= 0) {
      checkingBalance = actualCash;
      hysaBalance = 0;
    } else {
      const checkingRatio = checkingBalance / totalVirtual;
      checkingBalance = actualCash * checkingRatio;
      hysaBalance = actualCash - checkingBalance;
    }
  };

  for (let year = 0; year <= simYearsToCompute; year++) {
    const age = currentAge + year;
    const nominalFactor = Math.pow(1 + inflationRate, year);
    state.annualEarlyWithdrawalPenalties = 0;
    let activePhaseForAge = simPhases.find(p => age >= p.startAge && age < p.endAge);
    if (!activePhaseForAge && simPhases.length > 0 && age >= simPhases[simPhases.length - 1].startAge) {
      activePhaseForAge = simPhases[simPhases.length - 1];
    }


    // Save starting balances for telemetry
    const checkingStart = checkingBalance;
    const hysaStart = hysaBalance;
    const emergencyStart = balances.emergencyFund;
    const brokerageStart = balances.brokerage;
    const trad401kStart = balances.trad401k;
    const rothIraStart = balances.rothIra;
    const hsaStart = balances.hsa;

    // Initialize contribution tracking for telemetry
    let checkingContrib = 0;
    let hysaContrib = 0;
    let emergencyContrib = 0;
    let brokerageContrib = 0;
    let trad401kContrib = 0;
    let rothIraContrib = 0;
    let hsaContrib = 0;

    let explicitBrokerageContrib = 0;
    let allocationRuleBrokerageContrib = 0;
    let surplusFallbackBrokerageContrib = 0;
    let transferBrokerageContrib = 0;

    state.weddingFinancedAmount = 0;
    state.weddingPaidFromSavings = 0;
    state.sellingCosts = 0;
    state.lumpSumDebtPayoffs = 0;
    state.annualInterestPaid = 0;
    state.housePurchaseTransactionCosts = 0;
    state.yearWithdrawals = {
      cash: 0,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      other: 0
    };
    state.mortgagePayoffFromSale = 0;
    state.housePurchaseShortfall = 0;
    state.purchaseDebugThisYear = null;
    const brokerageStartingBalance = balances.brokerage + customAssets.filter(ca => ca.type === 'brokerage').reduce((sum, ca) => sum + ca.balance, 0);
    let brokerageGrowthThisYear = 0;

    const startAssets = year === 0
      ? (
          (balances.cash || 0) +
          (balances.emergencyFund || 0) +
          (balances.brokerage || 0) +
          (balances.trad401k || 0) +
          (balances.tradIra || 0) +
          (balances.rothIra || 0) +
          (balances.hsa || 0) +
          (balances.other || 0) +
          customAssets.reduce((sum, ca) => sum + ca.balance, 0) +
          homeEquityBaseline
        )
      : logs[year - 1].assets;

    const startDebt = year === 0
      ? (activeLoans.reduce((sum, l) => sum + l.balance, 0) + debtBalance + state.cumulativeShortfall)
      : logs[year - 1].debt;

    const startNetWorth = startAssets - startDebt;

    const startCustomAssetsSum = customAssets.reduce((sum, ca) => sum + ca.balance, 0);
    const liquidAssetsBeforePurchase = (balances.cash || 0) + (balances.emergencyFund || 0) + (balances.brokerage || 0) + (balances.trad401k || 0) + (balances.tradIra || 0) + (balances.rothIra || 0) + (balances.hsa || 0) + (balances.other || 0) + startCustomAssetsSum;
    const netWorthBeforePurchase = startNetWorth;

    // Activate future borrowing events starting this year
    activeLoans.forEach(loan => {
      if (loan.isFutureBorrowing && age === loan.startAge && !loan.activated) {
        loan.balance = loan.startingBalance;
        loan.activated = true;
      }
    });

    const isUserAlive = age <= lifeExpectancy;
    const spouseAge = age + ageDifference;
    const isSpouseActive = hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies;
    const isSpouseAlive = isSpouseActive && spouseAge <= spouseLifeExpectancy;
    const spouseRetirementAge = (spouseMember && spouseMember.spouseDesiredRetirementAge !== undefined && spouseMember.spouseDesiredRetirementAge !== null && spouseMember.spouseDesiredRetirementAge !== '')
      ? Number(spouseMember.spouseDesiredRetirementAge)
      : ((spouseMember && spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== '')
        ? Number(spouseMember.desiredRetirementAge)
        : (marriageEvent && marriageEvent.spouseDesiredRetirementAge !== undefined && marriageEvent.spouseDesiredRetirementAge !== null && marriageEvent.spouseDesiredRetirementAge !== ''
           ? Number(marriageEvent.spouseDesiredRetirementAge)
           : (targetRetirementAge + ageDifference)));
    const isSpouseWorking = isSpouseAlive && spouseAge < spouseRetirementAge;

    if (hasMarriage && age === marriageAge) {
      handleMarriageAssetInjection(
        age, marriageAge, balances,
        spouseCash, spouseInvestments, spouseRetirement,
        nominalFactor, dynamicMilestones, formatCurrency
      );
      checkingBalance += spouseCash * nominalFactor;
      balances.cash = checkingBalance + hysaBalance;
      transferBrokerageContrib += spouseInvestments * nominalFactor;
    }

    if (hasMarriage && includeWeddingCost && age === weddingAge) {
      handleWeddingCost(
        age, weddingAge, weddingCost, nominalFactor,
        deductFromLiquidAssets, state, dynamicMilestones, formatCurrency,
        marriageEvent, activeLoans
      );
      syncVirtualCashBalancesFromBalancesCash();
    }

    if (hasMarriage && age === marriageAge) {
      handleMarriageDebtInjection(
        age, marriageAge, activeLoans,
        spouseDebtStudent, spouseDebtCredit, spouseDebtOther,
        nominalFactor
      );
    }

    let yearChildCosts = 0;

    let currentFilingStatus = filingStatus;
    if (hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies) {
      currentFilingStatus = (marriageEvent && marriageEvent.filingStatus) || 'jointly';
    }
    if (currentFilingStatus === 'jointly' || currentFilingStatus === 'marriedJointly') {
      currentFilingStatus = 'married';
    }
    const taxConfig = U_S_TAX_DATA[currentFilingStatus] || U_S_TAX_DATA.single;
    standardDeduction = taxConfig.standardDeduction * nominalFactor;
    nominalBrackets = taxConfig.brackets.map(b => ({
      limit: b.limit === Infinity ? Infinity : b.limit * nominalFactor,
      rate: b.rate
    }));

    // Update state deductors
    state.standardDeduction = standardDeduction;
    state.nominalBrackets = nominalBrackets;

    let checkingGrowth = 0;
    let hysaGrowth = 0;
    let emergencyGrowth = 0;
    let brokerageGrowth = 0;
    let trad401kGrowth = 0;
    let rothIraGrowth = 0;
    let hsaGrowth = 0;

    if (year > 0) {
      const activeReturnRate = (age - 1) >= targetRetirementAge ? postRetirementReturn : expectedReturn;
      const activeCashReturnRate = cashReturnRate;
      
      checkingGrowth = checkingBalance * activeCashReturnRate;
      hysaGrowth = hysaBalance * activeCashReturnRate;
      emergencyGrowth = (balances.emergencyFund || 0) * activeCashReturnRate;
      brokerageGrowth = (balances.brokerage || 0) * activeReturnRate;
      trad401kGrowth = (balances.trad401k || 0) * activeReturnRate;
      const tradIraGrowth = (balances.tradIra || 0) * activeReturnRate;
      rothIraGrowth = (balances.rothIra || 0) * activeReturnRate;
      hsaGrowth = (balances.hsa || 0) * activeReturnRate;
      const otherGrowth = (balances.other || 0) * activeReturnRate;
      const cashGrowth = (balances.cash || 0) * activeCashReturnRate;
      const emergencyFundGrowth = emergencyGrowth;

      state.yearInvestmentGrowth = brokerageGrowth + trad401kGrowth + tradIraGrowth + rothIraGrowth + hsaGrowth + otherGrowth + cashGrowth + emergencyFundGrowth;

      let customBrokerageGrowthVal = 0;
      customAssets.forEach(ca => {
        if (ca.type === 'brokerage' && ca.balance > 0) {
          if (ca.endAge !== null && age > ca.endAge) return;
          let rateToApply = ca.growthRate !== null ? ca.growthRate : activeReturnRate;
          customBrokerageGrowthVal += ca.balance * rateToApply;
        }
      });
      brokerageGrowthThisYear = brokerageGrowth + customBrokerageGrowthVal;

      checkingBalance += checkingGrowth;
      hysaBalance += hysaGrowth;

      balances.brokerage *= (1 + activeReturnRate);
      balances.trad401k *= (1 + activeReturnRate);
      balances.tradIra *= (1 + activeReturnRate);
      balances.rothIra *= (1 + activeReturnRate);
      balances.hsa *= (1 + activeReturnRate);
      balances.other *= (1 + activeReturnRate);
      balances.cash = checkingBalance + hysaBalance;
      balances.emergencyFund *= (1 + activeCashReturnRate);

      if (state.cumulativeShortfall > 0) {
        state.yearInvestmentGrowth -= state.cumulativeShortfall * activeReturnRate;
        state.cumulativeShortfall *= (1 + activeReturnRate);
      }

      customAssets.forEach(ca => {
        if (ca.balance <= 0) return;
        if (ca.endAge !== null && age > ca.endAge) {
          ca.balance = 0;
          return;
        }
        let rateToApply = ca.growthRate;
        if (rateToApply === null) {
          rateToApply = activeReturnRate;
        }
        state.yearInvestmentGrowth += ca.balance * rateToApply;
        ca.balance *= (1 + rateToApply);
      });

      customHouses.forEach(h => {
        if (h.value <= 0) return;
        if (h.endAge !== null && age > h.endAge) {
          h.value = 0;
          return;
        }
        h.value *= (1 + h.growthRate);
      });
    }

    enabledEvents.forEach(ev => {
      if (ev.type === 'assetTransfer' && age === Number(ev.transferAge)) {
        const fromAsset = ev.fromAsset;
        const toAsset = ev.toAsset;
        const amount = Number(ev.amount) || 0;
        
        if (balances[fromAsset] !== undefined && balances[toAsset] !== undefined) {
          const actualTransfer = Math.max(0, Math.min(balances[fromAsset], amount));
          balances[fromAsset] -= actualTransfer;
          balances[toAsset] += actualTransfer;

          // Sync virtual checking/hysa balances
          if (fromAsset === 'cash' || fromAsset === 'checking') {
            const fromChecking = Math.min(checkingBalance, actualTransfer);
            checkingBalance -= fromChecking;
            const fromHysa = actualTransfer - fromChecking;
            hysaBalance -= fromHysa;
          } else if (fromAsset === 'hysa') {
            const fromHysa = Math.min(hysaBalance, actualTransfer);
            hysaBalance -= fromHysa;
            const fromChecking = actualTransfer - fromHysa;
            checkingBalance -= fromChecking;
          }

          if (toAsset === 'cash' || toAsset === 'checking') {
            checkingBalance += actualTransfer;
          } else if (toAsset === 'hysa') {
            hysaBalance += actualTransfer;
          }

          balances.cash = checkingBalance + hysaBalance;

          // Track brokerage transfer contribution
          if (toAsset === 'brokerage') {
            transferBrokerageContrib += actualTransfer;
          } else if (fromAsset === 'brokerage') {
            transferBrokerageContrib -= actualTransfer;
          }

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

    let annualIncome = 0;
    state.taxableIncome = 0;
    let yearSocialSecurityIncome = 0;

    if (activePhaseForAge) {
      const yearsGrown = age - currentAge;

      const userChildBoost = activePhaseForAge.childBoost || 0;
      const userSSBenefit = activePhaseForAge.ssMonthlyIncome || 0;
      const userPassiveMonthly = activePhaseForAge.passiveMonthlyIncome || 0;

      let userBaseSalaryNominal = 0;
      if (age < targetRetirementAge) {
        const activeCareerChanges = enabledEvents.filter(inc => 
          inc.type === 'incomeItem' && 
          age >= inc.startAge && 
          age < inc.endAge && 
          !isGeneratedMainIncome(inc.id)
        );

        const latestReset = [...activeCareerChanges]
          .reverse()
          .find(inc => inc.incomeChangeType !== 'increaseByAmount');

        if (latestReset) {
          // Career-change salary is interpreted as nominal dollars at the event start age,
          // not "today's dollars" inflated into the future.
          let baseVal = Number(latestReset.amount) || 0;
          let yearsSinceReset = age - latestReset.startAge;
          userBaseSalaryNominal = baseVal * Math.pow(1 + activePhaseForAge.incomeGrowthRate, yearsSinceReset);

          activeCareerChanges.forEach(inc => {
            if (inc.incomeChangeType === 'increaseByAmount' && inc.startAge > latestReset.startAge) {
              const increaseAmount = Number(inc.salaryIncrease !== undefined ? inc.salaryIncrease : inc.amount) || 0;
              let yearsSinceInc = age - inc.startAge;
              userBaseSalaryNominal += increaseAmount * Math.pow(1 + activePhaseForAge.incomeGrowthRate, yearsSinceInc);
            }
          });
        } else {
          let standardBaseSalary = activePhaseForAge.baseSalaryMonthly || 0;
          activeCareerChanges.forEach(inc => {
            if (inc.incomeChangeType === 'increaseByAmount') {
              const increaseMonthly = Math.round((Number(inc.salaryIncrease !== undefined ? inc.salaryIncrease : inc.amount) || 0) / 12);
              standardBaseSalary = Math.max(0, standardBaseSalary - increaseMonthly);
            }
          });

          userBaseSalaryNominal = (standardBaseSalary * 12) * Math.pow(1 + activePhaseForAge.incomeGrowthRate, yearsGrown);

          activeCareerChanges.forEach(inc => {
            if (inc.incomeChangeType === 'increaseByAmount') {
              const increaseAmount = Number(inc.salaryIncrease !== undefined ? inc.salaryIncrease : inc.amount) || 0;
              let yearsSinceInc = age - inc.startAge;
              userBaseSalaryNominal += increaseAmount * Math.pow(1 + activePhaseForAge.incomeGrowthRate, yearsSinceInc);
            }
          });
        }
      }

      const userChildBoostNominal = (userChildBoost * 12) * nominalFactor;
      const userSSNominal = (userSSBenefit * 12) * nominalFactor;
      const userPassiveNominal = (userPassiveMonthly * 12) * nominalFactor;

      const userIncomeNominal = userBaseSalaryNominal + userChildBoostNominal + userSSNominal + userPassiveNominal;
      annualIncome += userIncomeNominal;
      state.taxableIncome += userIncomeNominal;
      yearSocialSecurityIncome += userSSNominal;

      if (hasMarriage && age >= marriageAge && age <= userAgeWhenSpouseDies) {
        const spouseBaseSalary = (activePhaseForAge.spouseIncome || 0) - (activePhaseForAge.partnerSSMonthlyIncome || 0);
        const spouseSSBenefit = activePhaseForAge.partnerSSMonthlyIncome || 0;

        const spouseBaseSalaryNominal = (spouseBaseSalary * 12) * Math.pow(1 + activePhaseForAge.spouseIncomeGrowthRate, yearsGrown);
        const spouseSSNominal = (spouseSSBenefit * 12) * nominalFactor;

        const spouseIncomeNominal = spouseBaseSalaryNominal + spouseSSNominal;
        annualIncome += spouseIncomeNominal;
        state.taxableIncome += spouseIncomeNominal;
        yearSocialSecurityIncome += spouseSSNominal;
      }
    }

    let budgetScalingMode = 'lifestyle';
    let phaseIncomeAtCreation = 50000;
    let incomeMultiplier = 1.0;
    let savingsMultiplier = 1.0;
    let scalingMultiplier = 1.0;

    if (activePhaseForAge) {
      budgetScalingMode = activePhaseForAge.budgetScalingMode || 'lifestyle';
      phaseIncomeAtCreation = activePhaseForAge.incomeAtCreation !== undefined ? activePhaseForAge.incomeAtCreation : (activePhaseForAge.income * 12);
      if (budgetScalingMode === 'lifestyle') {
        incomeMultiplier = phaseIncomeAtCreation > 0 ? (annualIncome / phaseIncomeAtCreation) : 1.0;
        scalingMultiplier = incomeMultiplier;
        savingsMultiplier = incomeMultiplier;
      } else { // 'fixed'
        incomeMultiplier = 1.0;
        scalingMultiplier = 1.0;
        savingsMultiplier = Math.pow(1 + inflationRate, age - currentAge);
      }
    }

    if (activePhaseForAge) {
      if (budgetScalingMode === 'lifestyle') {
        yearChildCosts = (activePhaseForAge.expenses?.childcare || 0) * 12 * incomeMultiplier;
      } else {
        yearChildCosts = (activePhaseForAge.expenses?.childcare || 0) * 12 * Math.pow(1 + inflationRate, age - currentAge);
      }
    }

    let windfallReceived = 0;
    enabledEvents.forEach(ev => {
      if ((ev.type === 'windfall' || ev.type === 'inheritance' || ev.type === 'sellBusiness') && age === Number(ev.ageReceived || ev.age)) {
        const amt = Number(ev.amount) || 0;
        const tax = (Number(ev.taxRate) || 0) / 100;
        windfallReceived += amt * (1 - tax);
      }
    });

    let annualExpenses = 0;
    let spendingForYear = 0;

    if (activePhaseForAge) {
      const monthlyNonDebt = sumNonDebtExpenses(activePhaseForAge.expenses, purchasedProperties, age);
      if (budgetScalingMode === 'lifestyle') {
        spendingForYear = (monthlyNonDebt * 12) * incomeMultiplier;
      } else {
        spendingForYear = (monthlyNonDebt * 12) * Math.pow(1 + inflationRate + lifestyleUpgrades, age - currentAge);
      }

      // Double-counting rent check
      const hasActiveOwnedPrimaryResidence = purchasedProperties.some(prop => age >= prop.purchaseAge);
      if (hasActiveOwnedPrimaryResidence && activePhaseForAge.expenses) {
        const activeProps = purchasedProperties.filter(prop => age >= prop.purchaseAge);
        const hasKeepRentFalseProp = activeProps.some(prop => !prop.keepRent);
        if (hasKeepRentFalseProp) {
          let expectedPropertyCosts = 0;
          activeProps.forEach(prop => {
            if (!prop.keepRent) {
              const p = prop.homePrice || 0;
              const propTaxRate = prop.propertyTaxRate || 0;
              const insRate = prop.insuranceRate || 0;
              const maintRate = prop.maintenanceRate || 0;
              
              const monthlyPropTax = (p * propTaxRate) / 12;
              const monthlyIns = (p * insRate) / 12;
              const monthlyMaint = (p * maintRate) / 12;
              const monthlyHoa = prop.hoa || 0;
              const monthlyUtil = prop.utilitiesIncrease || 0;
              
              let monthlyPmi = 0;
              if (prop.purchaseType !== 'cash' && prop.downPayment < p * 0.2) {
                const pmiRate = prop.pmiRate || 0.5;
                const loanAmount = Math.max(0, p - prop.downPayment);
                monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
              }
              
              expectedPropertyCosts += monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi;
            }
          });
          
          const actualHousingExpense = Number(activePhaseForAge.expenses.housing) || 0;
          if (actualHousingExpense > expectedPropertyCosts + 50) {
            console.warn(`[WARNING] Possible double-counting rent and ownership costs at age ${age}: phase housing expense is ${actualHousingExpense} but expected property non-mortgage costs are ${Math.round(expectedPropertyCosts)}.`);
          }
        }
      }
    } else {
      spendingForYear = (Number(profile.simpleExpenses) || 42500) * Math.pow(1 + inflationRate + lifestyleUpgrades, age - currentAge);
    }

    if (age < targetRetirementAge) {
      lastWorkingYearSpendingNominal = spendingForYear;
      userLastWorkingSpendingNominal = spendingForYear;
    }
    annualExpenses += spendingForYear;

    if (enableHealthcareModel && age >= targetRetirementAge) {
      const preMedicarePremium = profile.preMedicarePremium || 10000;
      const medicarePremium = profile.medicarePremium || 4000;
      if (age < 65) {
        annualExpenses += preMedicarePremium * nominalFactor;
      } else {
        annualExpenses += medicarePremium * nominalFactor;
      }
    }



    enabledEvents.forEach(ev => {
      if (ev.type === 'college' && age >= Number(ev.startAge)) {
        const start = Number(ev.startAge);
        const duration = Number(ev.duration) || 4;
        if (age >= start && age < start + duration) {
          annualExpenses += (Number(ev.tuitionCost) || 0) * nominalFactor;
        }
      }
    });

    enabledEvents.forEach(ev => {
      if (ev.type === 'medicalExpense' && age === Number(ev.age)) {
        annualExpenses += (Number(ev.amount) || 0) * nominalFactor;
      }
    });

    enabledEvents.forEach(ev => {
      if (ev.type === 'spendingItem' && ev.movingCost && age === Number(ev.startAge)) {
        annualExpenses += (Number(ev.movingCost) || 0);
      }
    });

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

    enabledEvents.forEach(ev => {
      if (ev.type === 'baristaFire' && age >= Number(ev.startAge)) {
        const baristaExp = Number(ev.annualExpenses) || 42500;
        const hcChange = Number(ev.healthcareCostChange) || 0;
        annualExpenses = (baristaExp + hcChange) * nominalFactor;
      }
    });

    customObligations.forEach(o => {
      if (age >= currentAge && (o.endAge === null || age < o.endAge)) {
        const yearsElapsed = age - currentAge;
        const costForYear = (o.monthlyCost * 12) * Math.pow(1 + o.growthRate, yearsElapsed);
        annualExpenses += costForYear;
      }
    });

    customHouses.forEach(h => {
      if (age >= currentAge && (h.endAge === null || age < h.endAge)) {
        const costForYear = h.monthlyCost * 12;
        annualExpenses += costForYear;
      }
    });

    handleHousePurchase(
      age, enabledEvents, profile, purchasedProperties, deductFromLiquidAssets, state
    );
    syncVirtualCashBalancesFromBalancesCash();

    const preHouseSaleCash = balances.cash;
    const preHouseSaleBrokerage = balances.brokerage;

    purchasedProperties = handleHouseSale(
      age, currentAge, enabledEvents, purchasedProperties, state, dynamicMilestones, formatCurrency
    );

    const houseSaleCashReceived = balances.cash - preHouseSaleCash;
    if (houseSaleCashReceived > 0) {
      checkingBalance += houseSaleCashReceived;
      balances.cash = checkingBalance + hysaBalance;
    }

    const houseSaleBrokerageReceived = balances.brokerage - preHouseSaleBrokerage;
    if (houseSaleBrokerageReceived > 0) {
      transferBrokerageContrib += houseSaleBrokerageReceived;
    }

    const housingUpdates = processYearlyHousingUpdates(
      age, currentAge, homeEquityBaseline, nominalFactor, customHouses, purchasedProperties, inflationRate
    );
    const totalHomeValue = housingUpdates.totalHomeValue;
    const totalMortgageBalance = housingUpdates.totalMortgageBalance;
    annualExpenses += housingUpdates.annualHousingExpenses;

    let annualMinPayments = 0;
    let annualExtraPayments = 0;
    const debtPayments = processYearlyDebtPayments(
      age, activeLoans, dynamicMilestones
    );
    annualMinPayments = debtPayments.annualMinPayments;
    annualExtraPayments = debtPayments.annualExtraPayments;
    state.annualInterestPaid = debtPayments.annualInterestPaid || 0;
    annualExpenses += annualMinPayments;

    const extraDebtShortfall = deductFromLiquidAssets(annualExtraPayments, age, state);
    syncVirtualCashBalancesFromBalancesCash();
    if (extraDebtShortfall > 0.01) {
      state.hasRunOut = true;
      if (state.runOutAge === null) {
        state.runOutAge = age;
      }
    }

    enabledEvents.forEach(ev => {
      if (ev.type === 'debtPayoff' && age === Number(ev.payoffAge)) {
        const amt = Number(ev.remainingBalance !== undefined ? ev.remainingBalance : ev.amount) || 0;
        const debtShortfall = deductFromLiquidAssets(amt, age, state);
        syncVirtualCashBalancesFromBalancesCash();
        if (debtShortfall > 0.01) {
          state.hasRunOut = true;
          if (state.runOutAge === null) {
            state.runOutAge = age;
          }
        }
        state.lumpSumDebtPayoffs = (state.lumpSumDebtPayoffs || 0) + amt;
        debtBalance = 0;
      }
    });

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
        const pRateAtRetirement = (enforceEarlyWithdrawalPenalty && targetRetirementAge < 59.5) ? 0.10 : 0.0;
        projectedExpensesAtRetirement = solveTraditionalWithdrawal(
          projectedExpensesAtRetirement,
          Infinity,
          0,
          stdDeductionAtRetirement,
          bracketsAtRetirement,
          pRateAtRetirement
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

    let totalPreTaxAllocations = 0;
    let savingsContribution = 0;
    let employerMatchContribution = 0;
    let taxes = 0;
    let grossSurplus = annualIncome - annualExpenses;
    let preTaxRedirectedThisYear = 0;
    let postTaxRedirectedThisYear = 0;

    const sortedAllocations = [...allocationRules]
      .filter(rule => {
        const start = rule.startAge !== undefined ? Number(rule.startAge) : 0;
        const end = rule.endAge !== undefined ? Number(rule.endAge) : Infinity;
        return age >= start && age < end;
      })
      .map(r => ({ ...r, priority: Number(r.priority) || 99 }))
      .sort((a, b) => a.priority - b.priority);

    const isSavingPeriod = !isCoasting && age < targetRetirementAge;

    const actualContributions = {
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      brokerage: 0,
      checking: 0,
      hysa: 0,
      emergency: 0,
      other: 0,
      debt: 0
    };

    const activeBudgetPhase = simPhases.find(p => age >= p.startAge && age < p.endAge);

    let contributionRoutingSource = 'default_surplus_fallback';
    let ignoredRulesThisYear = [];

    const hasExplicitPhaseSavings = !!(activeBudgetPhase && (
      Object.values(activeBudgetPhase.savings || {}).some(v => Number(v) > 0) ||
      Object.values(activeBudgetPhase.partnerSavings || {}).some(v => Number(v) > 0)
    ));

    if (isSavingPeriod) {
      if (hasExplicitPhaseSavings) {
        const mode = activeBudgetPhase.savingsAllocMode || 'fixed';
        contributionRoutingSource = mode === 'percentSurplus' ? 'phase_percent_surplus' : 'phase_fixed_savings';
        ignoredRulesThisYear = sortedAllocations.map(r => r.id || 'unnamed-rule');
      } else if (sortedAllocations.length > 0) {
        contributionRoutingSource = 'allocation_rules';
      }
    }

    if (isSavingPeriod && hasExplicitPhaseSavings) {
      const mode = activeBudgetPhase.savingsAllocMode || 'fixed';
      const savings = activeBudgetPhase.savings || {};
      const partnerSavings = activeBudgetPhase.partnerSavings || {};
      const preTaxKeys = ['trad401k', 'tradIra', 'hsa'];

      const uPreTax = {};
      const pPreTax = {};
      let totalPreTaxTarget = 0;



      if (grossSurplus > 0) {
        if (mode === 'percentSurplus') {
          preTaxKeys.forEach(k => {
            uPreTax[k] = grossSurplus * ((Number(savings[k]) || 0) / 100);
            pPreTax[k] = grossSurplus * ((Number(partnerSavings[k]) || 0) / 100);
            totalPreTaxTarget += uPreTax[k] + pPreTax[k];
          });
        } else {
          preTaxKeys.forEach(k => {
            uPreTax[k] = (Number(savings[k]) || 0) * 12 * savingsMultiplier;
            pPreTax[k] = (Number(partnerSavings[k]) || 0) * 12 * savingsMultiplier;
            totalPreTaxTarget += uPreTax[k] + pPreTax[k];
          });
        }

        const scale = totalPreTaxTarget > grossSurplus ? (grossSurplus / totalPreTaxTarget) : 1;

        // Determine annual desired pre-tax targets after scaling
        const uPreTaxDesired = {};
        const pPreTaxDesired = {};
        preTaxKeys.forEach(k => {
          uPreTaxDesired[k] = (uPreTax[k] || 0) * scale;
          pPreTaxDesired[k] = (pPreTax[k] || 0) * scale;
        });

        // Track contributions this year
        const userContributionsThisYear = { trad401k: 0, tradIra: 0, hsa: 0 };
        const partnerContributionsThisYear = { trad401k: 0, tradIra: 0, hsa: 0 };

        const uLimit = {};
        const pLimit = {};
        preTaxKeys.forEach(k => {
          uLimit[k] = getRetirementLimit(k, age, currentFilingStatus);
          pLimit[k] = getRetirementLimit(k, spouseAge, currentFilingStatus);
        });

        const userAttemptedThisYear = { trad401k: 0, tradIra: 0, hsa: 0 };
        const partnerAttemptedThisYear = { trad401k: 0, tradIra: 0, hsa: 0 };

        // 12-month deposit loop
        for (let m = 1; m <= 12; m++) {
          preTaxKeys.forEach(k => {
            // User
            const uMonthlyDesired = uPreTaxDesired[k] / 12;
            if (uMonthlyDesired > 0) {
              userAttemptedThisYear[k] += uMonthlyDesired;
              const uLimitRemaining = uLimit[k] - userContributionsThisYear[k];
              const uAllowed = Math.min(uMonthlyDesired, Math.max(0, uLimitRemaining));
              userContributionsThisYear[k] += uAllowed;
              const uExcess = uMonthlyDesired - uAllowed;
              preTaxRedirectedThisYear += uExcess;
            }

            // Spouse/Partner
            if (isSpouseActive) {
              const pMonthlyDesired = pPreTaxDesired[k] / 12;
              if (pMonthlyDesired > 0) {
                partnerAttemptedThisYear[k] += pMonthlyDesired;
                const pLimitRemaining = pLimit[k] - partnerContributionsThisYear[k];
                const pAllowed = Math.min(pMonthlyDesired, Math.max(0, pLimitRemaining));
                partnerContributionsThisYear[k] += pAllowed;
                const pExcess = pMonthlyDesired - pAllowed;
                preTaxRedirectedThisYear += pExcess;
              }
            }
          });
        }

        // Save pre-tax allocations
        preTaxKeys.forEach(k => {
          const uAllowedTotal = userContributionsThisYear[k];
          const pAllowedTotal = partnerContributionsThisYear[k];
          const totalAlloc = uAllowedTotal + pAllowedTotal;
          if (totalAlloc > 0) {
            totalPreTaxAllocations += totalAlloc;
            actualContributions[k] = totalAlloc;
          }

          // Debug logging for User limit hits
          const uAttemptedTotal = userAttemptedThisYear[k];
          if (uAttemptedTotal > uLimit[k]) {
            const uExcessTotal = uAttemptedTotal - uAllowedTotal;
            if (uExcessTotal > 0.01) {
              let limitAccountName = k === 'trad401k' ? '401k' : (k === 'tradIra' ? 'traditionalIRA' : k);
              contributionLimitLogs.push({
                year: new Date().getFullYear() + year,
                account: limitAccountName,
                attemptedContribution: Math.round(uAttemptedTotal),
                allowedContribution: Math.round(uAllowedTotal),
                excessRedirected: Math.round(uExcessTotal),
                redirectedTo: redirectDest
              });
            }
          }

          // Debug logging for Partner limit hits
          if (isSpouseActive) {
            const pAttemptedTotal = partnerAttemptedThisYear[k];
            if (pAttemptedTotal > pLimit[k]) {
              const pExcessTotal = pAttemptedTotal - pAllowedTotal;
              if (pExcessTotal > 0.01) {
                let limitAccountName = k === 'trad401k' ? '401k' : (k === 'tradIra' ? 'traditionalIRA' : k);
                contributionLimitLogs.push({
                  year: new Date().getFullYear() + year,
                  account: limitAccountName,
                  attemptedContribution: Math.round(pAttemptedTotal),
                  allowedContribution: Math.round(pAllowedTotal),
                  excessRedirected: Math.round(pExcessTotal),
                  redirectedTo: redirectDest
                });
              }
            }
          }
        });
      }
    }

    if (includeTaxes) {
      const isPostRet = age >= targetRetirementAge;
      if (!isPostRet) {
        const adjustedTaxable = Math.max(0, state.taxableIncome - totalPreTaxAllocations);
        taxes = calculateUSTax(adjustedTaxable, standardDeduction, nominalBrackets);
      } else {
        taxes = calculateUSTax(state.taxableIncome, standardDeduction, nominalBrackets);
      }
    }

    let netSurplus = grossSurplus - taxes + windfallReceived - totalPreTaxAllocations - (housingUpdates.totalMortgagePrincipalPaid || 0);
    let netCashFlow = netSurplus;

    if (isSavingPeriod) {
      const preTaxKeys = ['trad401k', 'tradIra', 'hsa'];
      preTaxKeys.forEach(k => {
        const amt = actualContributions[k] || 0;
        if (amt > 0) {
          balances[k] += amt;
          savingsContribution += amt;
          if (k === 'trad401k') trad401kContrib += amt;
          else if (k === 'hsa') hsaContrib += amt;
        }
      });

      if (contributionRoutingSource === 'allocation_rules') {
        sortedAllocations.forEach(rule => {
          if (rule.employerMatch) {
            const dest = rule.destination;
            const matchAmt = rule.frequency === 'monthly' ? Number(rule.employerMatch) * 12 : Number(rule.employerMatch);
            if (balances[dest] !== undefined) {
              balances[dest] += matchAmt;
              employerMatchContribution += matchAmt;

              // Track in virtual sub-balances or transfers
              if (dest === 'cash' || dest === 'checking') {
                checkingBalance += matchAmt;
                balances.cash = checkingBalance + hysaBalance;
              } else if (dest === 'hysa') {
                hysaBalance += matchAmt;
                balances.cash = checkingBalance + hysaBalance;
              } else if (dest === 'brokerage') {
                transferBrokerageContrib += matchAmt;
              }
            }
          }
        });
      }

      if (state.cumulativeShortfall > 0 && netSurplus > 0) {
        const payDown = Math.min(state.cumulativeShortfall, netSurplus);
        state.cumulativeShortfall -= payDown;
        netSurplus -= payDown;
      }

      if (hasExplicitPhaseSavings && netSurplus > 0) {
        const mode = activeBudgetPhase.savingsAllocMode || 'fixed';
        const savings = activeBudgetPhase.savings || {};
        const partnerSavings = activeBudgetPhase.partnerSavings || {};
        const postTaxKeys = ['rothIra', 'brokerage', 'checking', 'hysa', 'emergency', 'other', 'debt'];

        const uPostTax = {};
        const pPostTax = {};
        let totalPostTaxTarget = 0;

        if (mode === 'percentSurplus') {
          postTaxKeys.forEach(k => {
            uPostTax[k] = netSurplus * ((Number(savings[k]) || 0) / 100);
            pPostTax[k] = netSurplus * ((Number(partnerSavings[k]) || 0) / 100);
            totalPostTaxTarget += uPostTax[k] + pPostTax[k];
          });
        } else {
          postTaxKeys.forEach(k => {
            uPostTax[k] = (Number(savings[k]) || 0) * 12 * savingsMultiplier;
            pPostTax[k] = (Number(partnerSavings[k]) || 0) * 12 * savingsMultiplier;
            totalPostTaxTarget += uPostTax[k] + pPostTax[k];
          });
        }

        const scale = totalPostTaxTarget > netSurplus ? (netSurplus / totalPostTaxTarget) : 1;
        const actualPostTax = {};
        postTaxKeys.forEach(k => {
          actualPostTax[k] = ((uPostTax[k] || 0) + (pPostTax[k] || 0)) * scale;
        });

        // Calculate User and Spouse Roth IRA limits
        const uRothDesired = (uPostTax['rothIra'] || 0) * scale;
        const pRothDesired = (pPostTax['rothIra'] || 0) * scale;
        const uRothLimit = getRetirementLimit('rothIra', age, currentFilingStatus);
        const pRothLimit = getRetirementLimit('rothIra', spouseAge, currentFilingStatus);

        let userRothAllowed = 0;
        let partnerRothAllowed = 0;
        let userRothAttempted = 0;
        let partnerRothAttempted = 0;

        for (let m = 1; m <= 12; m++) {
          // User rothIra
          const uMonthlyDesired = uRothDesired / 12;
          if (uMonthlyDesired > 0) {
            userRothAttempted += uMonthlyDesired;
            const uLimitRemaining = uRothLimit - userRothAllowed;
            const uAllowed = Math.min(uMonthlyDesired, Math.max(0, uLimitRemaining));
            userRothAllowed += uAllowed;
            const uExcess = uMonthlyDesired - uAllowed;
            postTaxRedirectedThisYear += uExcess;
          }

          // Partner rothIra
          if (isSpouseActive) {
            const pMonthlyDesired = pRothDesired / 12;
            if (pMonthlyDesired > 0) {
              partnerRothAttempted += pMonthlyDesired;
              const pLimitRemaining = pRothLimit - partnerRothAllowed;
              const pAllowed = Math.min(pMonthlyDesired, Math.max(0, pLimitRemaining));
              partnerRothAllowed += pAllowed;
              const pExcess = pMonthlyDesired - pAllowed;
              postTaxRedirectedThisYear += pExcess;
            }
          }
        }

        const actualRothIra = userRothAllowed + partnerRothAllowed;

        // Debug logging for Roth IRA limit hits
        if (userRothAttempted > uRothLimit) {
          const uExcessTotal = userRothAttempted - userRothAllowed;
          if (uExcessTotal > 0.01) {
            contributionLimitLogs.push({
              year: new Date().getFullYear() + year,
              account: 'rothIRA',
              attemptedContribution: Math.round(userRothAttempted),
              allowedContribution: Math.round(userRothAllowed),
              excessRedirected: Math.round(uExcessTotal),
              redirectedTo: redirectDest
            });
          }
        }
        if (isSpouseActive && partnerRothAttempted > pRothLimit) {
          const pExcessTotal = partnerRothAttempted - partnerRothAllowed;
          if (pExcessTotal > 0.01) {
            contributionLimitLogs.push({
              year: new Date().getFullYear() + year,
              account: 'rothIRA',
              attemptedContribution: Math.round(partnerRothAttempted),
              allowedContribution: Math.round(partnerRothAllowed),
              excessRedirected: Math.round(pExcessTotal),
              redirectedTo: redirectDest
            });
          }
        }

        postTaxKeys.forEach(k => {
          const amt = actualPostTax[k] || 0;
          if (amt > 0) {
            if (k === 'rothIra') {
              balances.rothIra += actualRothIra;
              savingsContribution += actualRothIra;
              actualContributions.rothIra = actualRothIra;
              rothIraContrib += actualRothIra;
            } else if (k === 'brokerage') {
              balances.brokerage += amt;
              savingsContribution += amt;
              actualContributions.brokerage = amt;
              brokerageContrib += amt;
              explicitBrokerageContrib += amt;
            } else if (k === 'checking') {
              balances.cash += amt;
              savingsContribution += amt;
              actualContributions.checking = amt;
              checkingBalance += amt;
              checkingContrib += amt;
            } else if (k === 'hysa') {
              balances.cash += amt;
              savingsContribution += amt;
              actualContributions.hysa = amt;
              hysaBalance += amt;
              hysaContrib += amt;
            } else if (k === 'emergency') {
              balances.emergencyFund += amt;
              savingsContribution += amt;
              actualContributions.emergency = amt;
              emergencyContrib += amt;
            } else if (k === 'other') {
              balances.other += amt;
              savingsContribution += amt;
              actualContributions.other = amt;
            } else if (k === 'debt') {
              let debtRemaining = amt;
              for (const loan of activeLoans) {
                if (loan.balance > 0) {
                  const pay = Math.min(loan.balance, debtRemaining);
                  loan.balance -= pay;
                  debtRemaining -= pay;
                  if (debtRemaining <= 0) break;
                }
              }
              if (debtRemaining > 0) {
                balances.brokerage += debtRemaining;
                savingsContribution += debtRemaining;
                actualContributions.brokerage = (actualContributions.brokerage || 0) + debtRemaining;
                brokerageContrib += debtRemaining;
                transferBrokerageContrib += debtRemaining;
              }
              actualContributions.debt = amt - debtRemaining;
            }
          }
        });

        if (mode === 'fixed' && netSurplus > totalPostTaxTarget) {
          const leftover = netSurplus - totalPostTaxTarget;
          balances.cash += leftover;
          checkingBalance += leftover;
          checkingContrib += leftover;
        }

        // Handle redirection of excess contributions (pre-tax + post-tax)
        const totalRedirect = preTaxRedirectedThisYear + postTaxRedirectedThisYear;
        if (totalRedirect > 0.01) {
          totalRedirectedSavings += totalRedirect;
          if (brokerageExists) {
            balances.brokerage += totalRedirect;
            actualContributions.brokerage = (actualContributions.brokerage || 0) + totalRedirect;
            brokerageContrib += totalRedirect;
            transferBrokerageContrib += totalRedirect;
          } else {
            balances.cash += totalRedirect;
            actualContributions.checking = (actualContributions.checking || 0) + totalRedirect;
            checkingBalance += totalRedirect;
            checkingContrib += totalRedirect;
          }
          savingsContribution += totalRedirect;
        }

        if (preTaxRedirectedThisYear > 0.01 || postTaxRedirectedThisYear > 0.01) {
          yearsWithLimitsReached++;
        }

        netSurplus = 0;
      } else if (contributionRoutingSource === 'allocation_rules' && netSurplus > 0) {
        sortedAllocations.forEach(rule => {
          if (rule.type === 'percentSurplus') {
            const pct = (Number(rule.value) || 0) / 100;
            const amt = netSurplus * pct;
            if (amt > 0) {
              const dest = rule.destination;
              if (dest === 'brokerage') {
                balances.brokerage += amt;
                savingsContribution += amt;
                actualContributions.brokerage = (actualContributions.brokerage || 0) + amt;
                brokerageContrib += amt;
                allocationRuleBrokerageContrib += amt;
              } else if (dest === 'cash' || dest === 'checking') {
                balances.cash += amt;
                savingsContribution += amt;
                actualContributions.checking = (actualContributions.checking || 0) + amt;
                checkingBalance += amt;
                checkingContrib += amt;
              } else if (dest === 'hysa') {
                balances.cash += amt;
                savingsContribution += amt;
                actualContributions.hysa = (actualContributions.hysa || 0) + amt;
                hysaBalance += amt;
                hysaContrib += amt;
              } else if (dest === 'emergency') {
                balances.emergencyFund += amt;
                savingsContribution += amt;
                actualContributions.emergency = (actualContributions.emergency || 0) + amt;
                emergencyContrib += amt;
              } else if (balances[dest] !== undefined) {
                balances[dest] += amt;
                savingsContribution += amt;
                actualContributions[dest] = (actualContributions[dest] || 0) + amt;
                if (dest === 'trad401k') trad401kContrib += amt;
                else if (dest === 'rothIra') rothIraContrib += amt;
                else if (dest === 'hsa') hsaContrib += amt;
              }
            }
          }
        });
        netSurplus = 0;
      } else if (contributionRoutingSource === 'default_surplus_fallback' && netSurplus > 0) {
        balances.brokerage += netSurplus;
        savingsContribution += netSurplus;
        actualContributions.brokerage = (actualContributions.brokerage || 0) + netSurplus;
        brokerageContrib += netSurplus;
        surplusFallbackBrokerageContrib += netSurplus;
        netSurplus = 0;
      }
    } else {
      if (state.cumulativeShortfall > 0 && netSurplus > 0) {
        const payDown = Math.min(state.cumulativeShortfall, netSurplus);
        state.cumulativeShortfall -= payDown;
        netSurplus -= payDown;
      }
      if (netSurplus > 0) {
        balances.brokerage += netSurplus;
        brokerageContrib += netSurplus;
        surplusFallbackBrokerageContrib += netSurplus;
        netSurplus = 0;
      }
    }

    let withdrawal = 0;
    let shortfall = 0;

    if (netCashFlow < 0) {
      const deficit = -netCashFlow;
      const leftShortfall = coverShortfall(deficit, age, state);
      syncVirtualCashBalancesFromBalancesCash();
      withdrawal = deficit - leftShortfall;

      if (leftShortfall > 0.01) {
        shortfall = leftShortfall;
        state.cumulativeShortfall += leftShortfall;
        state.hasRunOut = true;
        if (state.runOutAge === null) {
          state.runOutAge = age;
        }
      }
    }

    if (includeTaxes) {
      const isPostRet = age >= targetRetirementAge;
      if (isPostRet) {
        taxes = calculateUSTax(state.taxableIncome, standardDeduction, nominalBrackets);
      } else {
        const adjustedTaxable = Math.max(0, state.taxableIncome - totalPreTaxAllocations);
        taxes = calculateUSTax(adjustedTaxable, standardDeduction, nominalBrackets);
      }
    }
    taxes += state.annualEarlyWithdrawalPenalties;

    if (state.cumulativeShortfall <= 0.01) {
      state.cumulativeShortfall = 0;
      state.hasRunOut = false;
      state.runOutAge = null;
    }

    const currentDebtSum = activeLoans.reduce((sum, l) => sum + l.balance, 0) + debtBalance;

    const customAssetsSum = customAssets.reduce((sum, ca) => sum + ca.balance, 0);
    const liquidNW = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other + customAssetsSum;
    const endingAssets = liquidNW + totalHomeValue;
    const endingDebt = currentDebtSum + totalMortgageBalance + state.cumulativeShortfall;
    const endingNetWorth = endingAssets - endingDebt;
    const netWorth = endingNetWorth;

    // Audited ledger variables calculation
    const weddingFinancedAmount = state.weddingFinancedAmount || 0;
    const weddingPaidFromSavings = state.weddingPaidFromSavings || 0;
    const weddingCostTotal = weddingFinancedAmount + weddingPaidFromSavings;
    const weddingLoan = activeLoans.find(l => l.id === 'wedding-debt');
    const weddingDebtBalance = weddingLoan ? weddingLoan.balance : 0;

    const sellingCosts = state.sellingCosts || 0;

    const spouseAssetsAdded = (hasMarriage && age === marriageAge)
      ? (spouseCash + spouseInvestments + spouseRetirement) * nominalFactor
      : 0;
    const spouseDebtAdded = (hasMarriage && age === marriageAge)
      ? (spouseDebtStudent + spouseDebtCredit + spouseDebtOther) * nominalFactor
      : 0;
    const spouseNetWorthAdded = spouseAssetsAdded - spouseDebtAdded;

    let newMortgageDebt = 0;
    purchasedProperties.forEach(prop => {
      if (prop.purchaseAge === age && prop.purchaseType === 'mortgage') {
        newMortgageDebt += prop.loanAmount || 0;
      }
    });

    let futureBorrowingActivated = 0;
    activeLoans.forEach(loan => {
      if (loan.isFutureBorrowing && age === loan.startAge && loan.activated) {
        futureBorrowingActivated += loan.startingBalance || 0;
      }
    });

    const shortfallVal = (shortfall || 0) + (state.housePurchaseShortfall || 0);
    const newDebtAdded = weddingFinancedAmount + newMortgageDebt + futureBorrowingActivated + shortfallVal;

    const activeLoansInterestPaid = state.annualInterestPaid || 0;

    const annualMortgageInterest = housingUpdates.annualMortgageInterest || 0;
    const annualMortgagePrincipal = housingUpdates.totalMortgagePrincipalPaid || 0;

    const interestPaid = activeLoansInterestPaid + annualMortgageInterest;

    // Savings represents net cash flow from income/spending (after min interest/principal but before extra payments/payoffs)
    const grossIncome = annualIncome + windfallReceived;
    const grossExpenses = annualExpenses;
    const savingsAfterInterest = grossIncome - grossExpenses - taxes - annualExtraPayments - (state.lumpSumDebtPayoffs || 0) - annualMortgagePrincipal;

    // Savings before interest to reconcile with -interestPaid in formula
    const savings = savingsAfterInterest + interestPaid;

    // Investment Growth calculated directly on assets
    let investmentGrowth = 0;
    let homeAppreciation = 0;
    if (year > 0) {
      investmentGrowth += state.yearInvestmentGrowth || 0;

      // Real estate appreciation
      const prevNominalFactor = Math.pow(1 + inflationRate, year - 1);
      homeAppreciation = homeEquityBaseline * (nominalFactor - prevNominalFactor);
      purchasedProperties.forEach(prop => {
        if (age >= prop.purchaseAge) {
          const prevVal = prop.currentValue / (1 + prop.appreciationRate);
          homeAppreciation += prop.currentValue - prevVal;
        }
      });
      investmentGrowth += homeAppreciation;
    }

    const mortgagePrincipalPaidVal = annualMortgagePrincipal;
    const mortgageInterestPaidVal = annualMortgageInterest;

    // Home purchase activity variables
    let homeAssetAddedValue = 0;
    let downPaymentUsedValue = 0;
    let closingCostsPaidValue = 0;
    let mortgageDebtAddedValue = 0;
    let liquidAssetsAfterPurchase = liquidAssetsBeforePurchase;
    let netWorthAfterPurchase = netWorthBeforePurchase;
    let netWorthImpactFromPurchase = 0;

    const purchaseInfo = state.purchaseDebugThisYear;
    if (purchaseInfo) {
      homeAssetAddedValue = purchaseInfo.purchasePrice;
      downPaymentUsedValue = purchaseInfo.downPaymentUsed;
      closingCostsPaidValue = purchaseInfo.closingCostsPaid;
      mortgageDebtAddedValue = purchaseInfo.mortgageOriginalBalance;

      const cashNeeded = downPaymentUsedValue + closingCostsPaidValue;
      liquidAssetsAfterPurchase = liquidAssetsBeforePurchase - cashNeeded;
      netWorthAfterPurchase = netWorthBeforePurchase - closingCostsPaidValue;
      netWorthImpactFromPurchase = netWorthAfterPurchase - netWorthBeforePurchase;

      const netWorthDeltaFromDownPaymentTransfer = netWorthAfterPurchase - netWorthBeforePurchase + closingCostsPaidValue;
      if (Math.abs(netWorthDeltaFromDownPaymentTransfer) > 1.0) {
        console.warn(`[WARNING] Down payment asset transfer affected net worth at age ${age}: delta is ${netWorthDeltaFromDownPaymentTransfer}`);
      }
    }

    let homeAccountingDebug = null;
    if (purchasedProperties.length > 0 || purchaseInfo) {
      homeAccountingDebug = {
        homeValueStart: housingUpdates.homeValueStart || 0,
        homeValueEnd: housingUpdates.homeValueEnd || 0,
        purchasePrice: homeAssetAddedValue,
        downPaymentUsed: downPaymentUsedValue,
        closingCostsPaid: closingCostsPaidValue,
        mortgageOriginalBalance: mortgageDebtAddedValue,
        mortgageBalanceStart: housingUpdates.mortgageBalanceStart || 0,
        mortgageBalanceEnd: housingUpdates.mortgageBalanceEnd || 0,
        principalPaid: mortgagePrincipalPaidVal,
        interestPaid: mortgageInterestPaidVal,
        propertyTaxPaid: housingUpdates.propertyTaxPaid || 0,
        insurancePaid: housingUpdates.insurancePaid || 0,
        maintenancePaid: housingUpdates.maintenancePaid || 0,
        homeEquityStart: Math.max(0, (housingUpdates.homeValueStart || 0) - (housingUpdates.mortgageBalanceStart || 0)),
        homeEquityEnd: Math.max(0, (housingUpdates.homeValueEnd || 0) - (housingUpdates.mortgageBalanceEnd || 0)),
        liquidAssetsBeforePurchase,
        liquidAssetsAfterPurchase,
        netWorthBeforePurchase,
        netWorthAfterPurchase,
        netWorthImpactFromPurchase
      };
    }

    const lifeEventCosts = weddingPaidFromSavings + sellingCosts + (state.housePurchaseTransactionCosts || 0);
    const startDebtExcludingShortfall = startDebt - (year === 0 ? 0 : (logs[year - 1]?.cumulativeShortfall || 0));
    const endingDebtExcludingShortfall = endingDebt - (state.cumulativeShortfall || 0);
    const newDebtAddedExcludingShortfall = newDebtAdded - shortfallVal;
    const debtPrincipalPaid = Math.max(0, startDebtExcludingShortfall + newDebtAddedExcludingShortfall + spouseDebtAdded - endingDebtExcludingShortfall - (state.mortgagePayoffFromSale || 0));

    // Validate reconciliation
    const expectedEndingNetWorth = startNetWorth + savings + investmentGrowth - lifeEventCosts - newDebtAdded + debtPrincipalPaid - interestPaid + spouseNetWorthAdded + shortfallVal + newMortgageDebt;
    const reconciliationDifference = endingNetWorth - expectedEndingNetWorth;
    if (Math.abs(reconciliationDifference) > 1.0) {
      console.warn(`[WARNING] Net Worth Reconciliation failed at Age ${age}! Difference: ${reconciliationDifference}`);
    }

    const netWorthLedgerDebug = {
      startingNetWorth: startNetWorth,
      savings,
      investmentGrowth,
      lifeEventCosts,
      newDebtAdded,
      debtPrincipalPaid,
      interestPaid,
      endingNetWorth,
      reconciliationDifference
    };

    // Build UI ledger rows
    const rows = [];
    if (Math.abs(savings) > 0.01) {
      rows.push({
        label: 'Savings',
        value: savings,
        type: savings > 0 ? 'positive' : 'negative',
        section: 'incomeInvesting'
      });
    }

    // Subtract home appreciation from investmentGrowth for the general row
    const otherInvestmentGrowth = investmentGrowth - homeAppreciation;
    if (Math.abs(otherInvestmentGrowth) > 0.01) {
      rows.push({
        label: otherInvestmentGrowth > 0 ? 'Investment Growth' : 'Investment Loss',
        value: otherInvestmentGrowth,
        type: otherInvestmentGrowth > 0 ? 'positive' : 'negative',
        section: 'incomeInvesting'
      });
    }

    // Life events (exclude transaction costs since they will be in homeActivity)
    const otherLifeEventCosts = lifeEventCosts - closingCostsPaidValue;
    if (weddingCostTotal > 0) {
      rows.push({
        label: 'Wedding Cost',
        value: -weddingCostTotal,
        type: 'negative',
        section: 'lifeEvents',
        expandable: true,
        details: {
          paidFromSavings: weddingPaidFromSavings,
          financed: weddingFinancedAmount,
          currentDebtBalance: weddingDebtBalance
        }
      });
    }
    if (spouseAssetsAdded > 0) {
      rows.push({
        label: 'Spouse Assets Added',
        value: spouseAssetsAdded,
        type: 'positive',
        section: 'lifeEvents'
      });
    }
    if (spouseDebtAdded > 0) {
      rows.push({
        label: 'Spouse Debt Added',
        value: -spouseDebtAdded,
        type: 'negative',
        section: 'lifeEvents'
      });
    }
    if (sellingCosts > 0) {
      rows.push({
        label: 'House Sale transaction costs',
        value: -sellingCosts,
        type: 'negative',
        section: 'lifeEvents'
      });
    }

    // Home purchase activity rows
    if (homeAssetAddedValue > 0) {
      rows.push({
        label: 'Home Value',
        value: homeAssetAddedValue,
        type: 'neutral',
        section: 'homeActivity',
        subgroup: 'homePurchased'
      });
    }
    if (mortgageDebtAddedValue > 0) {
      rows.push({
        label: 'Mortgage',
        value: -mortgageDebtAddedValue,
        type: 'negative',
        section: 'homeActivity',
        subgroup: 'homePurchased'
      });

      const homeEquityCreated = homeAssetAddedValue - mortgageDebtAddedValue;
      if (homeEquityCreated > 0) {
        rows.push({
          label: 'Initial Equity',
          value: homeEquityCreated,
          type: 'neutral',
          section: 'homeActivity',
          subgroup: 'homePurchased',
          isSummary: true
        });
      }
    }
    if (downPaymentUsedValue > 0) {
      rows.push({
        label: 'Cash → Home Equity',
        value: downPaymentUsedValue,
        type: 'neutral',
        section: 'homeActivity',
        subgroup: 'equityTransfer',
        isTransfer: true,
        helperText: `$${Math.round(downPaymentUsedValue).toLocaleString()} transferred from cash into home equity.`
      });
    }
    if (closingCostsPaidValue > 0) {
      rows.push({
        label: 'Closing Costs Paid',
        value: -closingCostsPaidValue,
        type: 'negative',
        section: 'homeActivity',
        subgroup: 'purchaseCosts'
      });
    }
    if (mortgagePrincipalPaidVal > 0) {
      rows.push({
        label: 'Principal Paid',
        value: mortgagePrincipalPaidVal,
        type: 'positive',
        section: 'homeActivity',
        subgroup: 'homeOwnership'
      });
    }
    if (homeAppreciation > 0) {
      rows.push({
        label: 'Home Appreciation',
        value: homeAppreciation,
        type: 'positive',
        section: 'homeActivity',
        subgroup: 'homeOwnership'
      });
    }
    if (mortgageInterestPaidVal > 0) {
      rows.push({
        label: 'Interest Paid',
        value: -mortgageInterestPaidVal,
        type: 'negative',
        section: 'homeActivity',
        subgroup: 'homeOwnership'
      });
    }

    // General Debt activity (excluding mortgage debt/principal/interest which are in homeActivity)
    const otherDebtAdded = newDebtAdded - mortgageDebtAddedValue;
    if (otherDebtAdded > 0 && otherDebtAdded !== weddingFinancedAmount) {
      rows.push({
        label: 'Debt Added',
        value: -otherDebtAdded,
        type: 'negative',
        section: 'debtActivity'
      });
    }
    const otherDebtPrincipalPaid = Math.max(0, debtPrincipalPaid - mortgagePrincipalPaidVal);
    if (otherDebtPrincipalPaid > 0) {
      rows.push({
        label: 'Principal Repaid',
        value: otherDebtPrincipalPaid,
        type: 'positive',
        section: 'debtActivity'
      });
    }
    const otherInterestPaid = Math.max(0, interestPaid - mortgageInterestPaidVal);
    if (otherInterestPaid > 0) {
      rows.push({
        label: 'Interest Paid',
        value: -otherInterestPaid,
        type: 'negative',
        section: 'debtActivity'
      });
    }

    const netWorthLedger = {
      startingNetWorth: startNetWorth,
      savings: savingsAfterInterest,
      withdrawals: withdrawal,
      investmentGrowth,
      newDebtAdded,
      debtPrincipalPaid,
      majorEventCosts: lifeEventCosts,
      endingNetWorth,
      weddingFinancedAmount,
      weddingPaidFromSavings,
      rows
    };

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

    if (enableHealthcareModel) {
      const preMedicarePremium = profile.preMedicarePremium || 10000;
      const medicarePremium = profile.medicarePremium || 4000;
      const referenceAge = Math.max(age, targetRetirementAge);
      if (referenceAge < 65) {
        retirementBaseExpenses += preMedicarePremium * nominalFactor;
      } else {
        retirementBaseExpenses += medicarePremium * nominalFactor;
      }
    }

    let nominalActiveSS = 0;

    enabledEvents.forEach(ev => {
      if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
        const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
        let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
        if (ev.type === 'socialSecurity') {
          monthlyBenefit = socialSecurityDetails.monthlyBenefit;
        }
        let annualAmt = monthlyBenefit * 12;
        const isInflationAdjusted = ev.type === 'socialSecurity' || ev.inflationAdjusted;
        
        if (age >= claimingAge) {
          if (isInflationAdjusted) {
            annualAmt = annualAmt * nominalFactor;
          }
          nominalActiveSS += annualAmt;
        }
      }
    });

    const retirementReadyTargetForYear = age >= targetRetirementAge
      ? Math.max(0, retirementBaseExpenses - nominalActiveSS) / swr
      : 0;

    if (age === simLifeExpectancy) {
      endingSurplusShortfall = state.cumulativeShortfall > 0 ? -state.cumulativeShortfall : liquidNW;
    }

    const totalPortfolio = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other + customAssetsSum;

    let plannedPreTaxSavings = 0;
    let plannedPostTaxSavings = 0;
    if (isSavingPeriod && activeBudgetPhase) {
      const mode = activeBudgetPhase.savingsAllocMode || 'fixed';
      const savings = activeBudgetPhase.savings || {};
      const partnerSavings = activeBudgetPhase.partnerSavings || {};
      const preTaxKeys = ['trad401k', 'tradIra', 'hsa'];
      const postTaxKeys = ['rothIra', 'brokerage', 'checking', 'hysa', 'emergency', 'other', 'debt'];

      if (mode === 'percentSurplus') {
        if (grossSurplus > 0) {
          preTaxKeys.forEach(k => {
            plannedPreTaxSavings += grossSurplus * (((Number(savings[k]) || 0) + (Number(partnerSavings[k]) || 0)) / 100);
          });
        }
        const netSurp = Math.max(0, grossSurplus - taxes + windfallReceived - totalPreTaxAllocations);
        if (netSurp > 0) {
          postTaxKeys.forEach(k => {
            plannedPostTaxSavings += netSurp * (((Number(savings[k]) || 0) + (Number(partnerSavings[k]) || 0)) / 100);
          });
        }
      } else {
        preTaxKeys.forEach(k => {
          plannedPreTaxSavings += ((Number(savings[k]) || 0) + (Number(partnerSavings[k]) || 0)) * 12 * savingsMultiplier;
        });
        postTaxKeys.forEach(k => {
          plannedPostTaxSavings += ((Number(savings[k]) || 0) + (Number(partnerSavings[k]) || 0)) * 12 * savingsMultiplier;
        });
      }
    }
    const totalPlannedSavings = plannedPreTaxSavings + plannedPostTaxSavings;
    const incomeAvailable = annualIncome + windfallReceived;
    const gapForYear = incomeAvailable - taxes - annualExpenses - totalPlannedSavings;
    const lifestyleGapValue = (age < targetRetirementAge && gapForYear < 0) ? -gapForYear : 0;


    const brokerageWithdrawn = state.yearWithdrawals?.brokerage || 0;
    transferBrokerageContrib -= brokerageWithdrawn;

    const brokerageEndingBalance = balances.brokerage;
    const expectedBrokerageEndingBalance = brokerageStart + explicitBrokerageContrib + allocationRuleBrokerageContrib + surplusFallbackBrokerageContrib + transferBrokerageContrib + brokerageGrowth;
    const brokerageDiscrepancy = brokerageEndingBalance - expectedBrokerageEndingBalance;
    if (Math.abs(brokerageDiscrepancy) > 1.0) {
      console.warn(`Warning: Brokerage discrepancy at age ${age}: actual ending balance = ${brokerageEndingBalance}, expected ending balance = ${expectedBrokerageEndingBalance}, discrepancy = ${brokerageDiscrepancy}`);
    }

    let baseMonthlySavings = 0;
    let baseMonthlyExpenses = 0;
    if (activePhaseForAge) {
      const savingsObj = activePhaseForAge.savings || {};
      const partnerSavingsObj = activePhaseForAge.partnerSavings || {};
      const savingsKeys = ['checking', 'hysa', 'emergency', 'brokerage', 'trad401k', 'rothIra', 'hsa', 'tradIra', 'debt', 'other'];
      savingsKeys.forEach(k => {
        baseMonthlySavings += (Number(savingsObj[k]) || 0) + (Number(partnerSavingsObj[k]) || 0);
      });
      baseMonthlyExpenses = sumNonDebtExpenses(activePhaseForAge.expenses, purchasedProperties, age);
    }
    const scaledMonthlySavings = baseMonthlySavings * savingsMultiplier;
    const scaledMonthlyExpenses = baseMonthlyExpenses * scalingMultiplier;
    const budgetBalanceCheck = {
      income: annualIncome,
      expenses: spendingForYear,
      savings: scaledMonthlySavings * 12,
      difference: annualIncome - (spendingForYear + (scaledMonthlySavings * 12) + taxes)
    };

    let routingWarning = null;
    if (isSavingPeriod && hasExplicitPhaseSavings && allocationRules && allocationRules.length > 0) {
      routingWarning = "Phase savings are active; allocationRules ignored this year.";
    }

    const currentDrift = isSavingPeriod
      ? ((annualIncome + windfallReceived) - (annualExpenses + savingsContribution + taxes + annualExtraPayments))
      : 0;

    if (budgetScalingMode === 'lifestyle' && isSavingPeriod && Math.abs(currentDrift) > 1.0) {
      console.warn(`[Budget Drift Guardrail Warning] Age ${age}: income (${annualIncome + windfallReceived}) does not match expenses (${annualExpenses}) + savings (${savingsContribution}) + taxes (${taxes}) + extra debt payments (${annualExtraPayments}). Drift: ${currentDrift}`);
    }

    logs.push({
      intervalId: activePhaseForAge ? activePhaseForAge.id : null,
      year,
      age,
      income: annualIncome + windfallReceived,
      expenses: annualExpenses + taxes,
      taxes,
      weddingDebtBalance,
      debtPayoffAllocation: annualExtraPayments,
      minDebtPayment: annualMinPayments,
      savings: savingsContribution,
      employerMatch: employerMatchContribution,
      withdrawals: withdrawal,
      shortfall,
      cumulativeShortfall: state.cumulativeShortfall,
      portfolio: totalPortfolio,
      homeValue: totalHomeValue,
      homeEquity: Math.max(0, totalHomeValue - totalMortgageBalance),
      mortgageBalance: totalMortgageBalance,
      debtBalance: currentDebtSum,
      netWorth,
      assets: endingAssets,
      debt: endingDebt,
      netWorthLedger,
      netWorthLedgerDebug,
      homeAccountingDebug,
      isFI: liquidNW >= retirementReadyTargetForYear,
      fiNumber: retirementReadyTargetForYear,
      ssIncome: yearSocialSecurityIncome,
      retirementReadyTarget: retirementReadyTargetForYear,
      coastFireNumber,
      isCoastAchieved,
      childCosts: yearChildCosts,
      lifestyleGap: lifestyleGapValue,
      cashBalance: balances.cash + customAssets.filter(ca => ca.type === 'checkingSavings').reduce((sum, ca) => sum + ca.balance, 0),
      emergencyFundBalance: balances.emergencyFund,
      brokerageBalance: balances.brokerage + customAssets.filter(ca => ca.type === 'brokerage').reduce((sum, ca) => sum + ca.balance, 0),
      trad401kBalance: balances.trad401k + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'trad401k').reduce((sum, ca) => sum + ca.balance, 0),
      tradIraBalance: balances.tradIra + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'tradIra').reduce((sum, ca) => sum + ca.balance, 0),
      rothIraBalance: balances.rothIra + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'rothIra').reduce((sum, ca) => sum + ca.balance, 0),
      hsaBalance: balances.hsa + customAssets.filter(ca => ca.type === 'retirement' && ca.subtype === 'hsa').reduce((sum, ca) => sum + ca.balance, 0),
      otherBalance: balances.other + customAssets.filter(ca => ca.type === 'asset').reduce((sum, ca) => sum + ca.balance, 0),
      actualContributions: { ...actualContributions },
      contributionRoutingSource,
      annualContributionsByAccount: {
        checking: checkingContrib,
        hysa: hysaContrib,
        emergency: emergencyContrib,
        brokerage: brokerageContrib,
        trad401k: trad401kContrib,
        rothIra: rothIraContrib,
        hsa: hsaContrib
      },
      growthByAccount: {
        checking: year === 0 ? 0 : checkingGrowth,
        hysa: year === 0 ? 0 : hysaGrowth,
        emergency: year === 0 ? 0 : emergencyGrowth,
        brokerage: year === 0 ? 0 : brokerageGrowth,
        trad401k: year === 0 ? 0 : trad401kGrowth,
        rothIra: year === 0 ? 0 : rothIraGrowth,
        hsa: year === 0 ? 0 : hsaGrowth
      },
      startBalanceByAccount: {
        checking: checkingStart,
        hysa: hysaStart,
        emergency: emergencyStart,
        brokerage: brokerageStart,
        trad401k: trad401kStart,
        rothIra: rothIraStart,
        hsa: hsaStart
      },
      endBalanceByAccount: {
        checking: checkingBalance,
        hysa: hysaBalance,
        emergency: balances.emergencyFund,
        brokerage: balances.brokerage,
        trad401k: balances.trad401k,
        rothIra: balances.rothIra,
        hsa: balances.hsa
      },
      brokerageAudit: {
        startingBalance: brokerageStart,
        explicitContribution: explicitBrokerageContrib,
        allocationRuleContribution: allocationRuleBrokerageContrib,
        surplusFallbackContribution: surplusFallbackBrokerageContrib,
        transferContribution: transferBrokerageContrib,
        growth: brokerageGrowth,
        endingBalance: brokerageEndingBalance,
        expectedEndingBalance: expectedBrokerageEndingBalance,
        discrepancy: brokerageDiscrepancy
      },
      budgetScaling: {
        mode: budgetScalingMode,
        phaseIncomeAtCreation,
        currentIncome: annualIncome,
        scalingMultiplier,
        baseMonthlySavings,
        scaledMonthlySavings,
        baseMonthlyExpenses,
        scaledMonthlyExpenses,
        budgetBalanceCheck
      },
      routingWarning,
      ignoredAllocationRules: ignoredRulesThisYear,
      brokerageStartingBalance,
      brokerageContribution: actualContributions.brokerage || 0,
      brokerageGrowth: brokerageGrowthThisYear,
      brokerageEndingBalance: balances.brokerage + customAssets.filter(ca => ca.type === 'brokerage').reduce((sum, ca) => sum + ca.balance, 0),
      yearWithdrawals: {
        cash: (state.yearWithdrawals?.cash || 0) + (state.yearWithdrawals?.emergencyFund || 0),
        brokerage: (state.yearWithdrawals?.brokerage || 0),
        trad401k: (state.yearWithdrawals?.trad401k || 0) + (state.yearWithdrawals?.tradIra || 0),
        rothIra: (state.yearWithdrawals?.rothIra || 0),
        hsa: (state.yearWithdrawals?.hsa || 0)
      },
      budgetScalingMode,
      phaseIncomeAtCreation,
      currentIncome: annualIncome,
      scalingMultiplier,
      budgetDrift: currentDrift
    });
  }

  const debtSummaries = activeLoans.map(loan => ({
    id: loan.id,
    name: loan.name,
    totalInterestPaid: loan.totalInterestPaid || 0,
    payoffAge: loan.balance <= 0 ? loan.payoffAge : null
  }));

  let weddingFinancingDetails = null;
  if (hasMarriage && includeWeddingCost) {
    const weddingLog = logs.find(l => l.age === weddingAge);
    const preWeddingLog = logs.find(l => l.age === weddingAge - 1);
    const weddingDebtBalanceByYear = {};
    logs.forEach(l => {
      if (l.age >= weddingAge && l.weddingDebtBalance !== undefined) {
        weddingDebtBalanceByYear[l.age] = l.weddingDebtBalance;
      }
    });

    const paidFromSavingsVal = weddingLog && weddingLog.netWorthLedger ? weddingLog.netWorthLedger.weddingPaidFromSavings : 0;
    const financedAmountVal = weddingLog && weddingLog.netWorthLedger ? weddingLog.netWorthLedger.weddingFinancedAmount : 0;

    weddingFinancingDetails = {
      weddingCost: weddingCost,
      paidFromSavings: paidFromSavingsVal,
      financedAmount: financedAmountVal,
      weddingDebtBalanceByYear,
      netWorthBeforeWedding: preWeddingLog ? preWeddingLog.netWorth : null,
      netWorthAfterWedding: weddingLog ? weddingLog.netWorth : null
    };
  }

  return {
    moneyLasts: !state.hasRunOut,
    runOutAge: state.runOutAge,
    endingSurplusShortfall,
    logs,
    dynamicMilestones,
    coastAge,
    lastWorkingYearSpendingNominal,
    debtSummaries,
    weddingFinancingDetails,
    yearsWithLimitsReached,
    totalRedirectedSavings,
    contributionLimitLogs,
    redirectedToCash: !brokerageExists
  };
}
