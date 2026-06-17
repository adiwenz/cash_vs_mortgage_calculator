import {
  U_S_TAX_DATA,
  calculateUSTax,
  getActiveChildrenCountAtAge
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

function sumNonDebtExpenses(expensesMap) {
  if (!expensesMap) return 0;
  return Object.keys(expensesMap)
    .filter(k => !k.startsWith('debt_') && k !== '🏠 Mortgage' && k !== 'mortgage')
    .reduce((sum, k) => sum + (Number(expensesMap[k]) || 0), 0);
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

  currentConditions.forEach(cond => {
    const val = Number(cond.value) || 0;
    if (val <= 0) return;
    if (cond.type === 'checkingSavings') {
      balances.cash += val;
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

  for (let year = 0; year <= simYearsToCompute; year++) {
    const age = currentAge + year;
    const nominalFactor = Math.pow(1 + inflationRate, year);
    state.annualEarlyWithdrawalPenalties = 0;
    const activePhaseForAge = simPhases.find(p => age >= p.startAge && age < p.endAge);

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
    }

    if (hasMarriage && includeWeddingCost && age === weddingAge) {
      handleWeddingCost(
        age, weddingAge, weddingCost, nominalFactor,
        deductFromLiquidAssets, state, dynamicMilestones, formatCurrency,
        marriageEvent, activeLoans
      );
    }

    if (hasMarriage && age === marriageAge) {
      handleMarriageDebtInjection(
        age, marriageAge, activeLoans,
        spouseDebtStudent, spouseDebtCredit, spouseDebtOther,
        nominalFactor
      );
    }

    let yearChildCosts = ((activePhaseForAge && activePhaseForAge.expenses && activePhaseForAge.expenses.childcare) || 0) * 12 * Math.pow(1 + inflationRate, age - currentAge);

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

    if (year > 0) {
      const activeReturnRate = (age - 1) >= targetRetirementAge ? postRetirementReturn : expectedReturn;
      balances.brokerage *= (1 + activeReturnRate);
      balances.trad401k *= (1 + activeReturnRate);
      balances.tradIra *= (1 + activeReturnRate);
      balances.rothIra *= (1 + activeReturnRate);
      balances.hsa *= (1 + activeReturnRate);
      balances.other *= (1 + activeReturnRate);
      balances.cash *= (1 + activeReturnRate);
      balances.emergencyFund *= (1 + activeReturnRate);

      if (state.cumulativeShortfall > 0) {
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
      const monthlyNonDebt = sumNonDebtExpenses(activePhaseForAge.expenses);
      spendingForYear = (monthlyNonDebt * 12) * Math.pow(1 + inflationRate + lifestyleUpgrades, age - currentAge);
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

    purchasedProperties = handleHouseSale(
      age, currentAge, enabledEvents, purchasedProperties, state, dynamicMilestones, formatCurrency
    );

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
    annualExpenses += annualMinPayments;

    const extraDebtShortfall = deductFromLiquidAssets(annualExtraPayments, age, state);
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
        if (debtShortfall > 0.01) {
          state.hasRunOut = true;
          if (state.runOutAge === null) {
            state.runOutAge = age;
          }
        }
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

    if (isSavingPeriod && activeBudgetPhase) {
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
            uPreTax[k] = (Number(savings[k]) || 0) * 12;
            pPreTax[k] = (Number(partnerSavings[k]) || 0) * 12;
            totalPreTaxTarget += uPreTax[k] + pPreTax[k];
          });
        }

        const scale = totalPreTaxTarget > grossSurplus ? (grossSurplus / totalPreTaxTarget) : 1;
        preTaxKeys.forEach(k => {
          const uAlloc = (uPreTax[k] || 0) * scale;
          const pAlloc = (pPreTax[k] || 0) * scale;
          const totalAlloc = uAlloc + pAlloc;
          if (totalAlloc > 0) {
            totalPreTaxAllocations += totalAlloc;
            actualContributions[k] = totalAlloc;
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

    let netSurplus = grossSurplus - taxes + windfallReceived - totalPreTaxAllocations;
    let netCashFlow = netSurplus;

    if (isSavingPeriod) {
      const preTaxKeys = ['trad401k', 'tradIra', 'hsa'];
      preTaxKeys.forEach(k => {
        const amt = actualContributions[k] || 0;
        if (amt > 0) {
          balances[k] += amt;
          savingsContribution += amt;
        }
      });

      if (allocationRules.length > 0) {
        allocationRules.forEach(rule => {
          if (rule.employerMatch) {
            const dest = rule.destination;
            const matchAmt = rule.frequency === 'monthly' ? Number(rule.employerMatch) * 12 : Number(rule.employerMatch);
            if (balances[dest] !== undefined) {
              balances[dest] += matchAmt;
              employerMatchContribution += matchAmt;
            }
          }
        });
      }

      if (state.cumulativeShortfall > 0 && netSurplus > 0) {
        const payDown = Math.min(state.cumulativeShortfall, netSurplus);
        state.cumulativeShortfall -= payDown;
        netSurplus -= payDown;
      }

      if (activeBudgetPhase && netSurplus > 0) {
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
            uPostTax[k] = (Number(savings[k]) || 0) * 12;
            pPostTax[k] = (Number(partnerSavings[k]) || 0) * 12;
            totalPostTaxTarget += uPostTax[k] + pPostTax[k];
          });
        }

        const scale = totalPostTaxTarget > netSurplus ? (netSurplus / totalPostTaxTarget) : 1;
        const actualPostTax = {};
        postTaxKeys.forEach(k => {
          actualPostTax[k] = ((uPostTax[k] || 0) + (pPostTax[k] || 0)) * scale;
        });

        postTaxKeys.forEach(k => {
          const amt = actualPostTax[k] || 0;
          if (amt > 0) {
            if (k === 'rothIra') {
              balances.rothIra += amt;
              savingsContribution += amt;
              actualContributions.rothIra = amt;
            } else if (k === 'brokerage') {
              balances.brokerage += amt;
              savingsContribution += amt;
              actualContributions.brokerage = amt;
            } else if (k === 'checking') {
              balances.cash += amt;
              savingsContribution += amt;
              actualContributions.checking = amt;
            } else if (k === 'hysa') {
              balances.cash += amt;
              savingsContribution += amt;
              actualContributions.hysa = amt;
            } else if (k === 'emergency') {
              balances.emergencyFund += amt;
              savingsContribution += amt;
              actualContributions.emergency = amt;
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
              }
              actualContributions.debt = amt - debtRemaining;
            }
          }
        });

        if (mode === 'fixed' && netSurplus > totalPostTaxTarget) {
          const leftover = netSurplus - totalPostTaxTarget;
          balances.brokerage += leftover;
          savingsContribution += leftover;
          actualContributions.brokerage = (actualContributions.brokerage || 0) + leftover;
        }
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
        netSurplus = 0;
      }
    }

    let withdrawal = 0;
    let shortfall = 0;

    if (netCashFlow < 0) {
      const deficit = -netCashFlow;
      const leftShortfall = coverShortfall(deficit, age, state);
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

    const currentDebtSum = activeLoans.reduce((sum, l) => sum + l.balance, 0) + debtBalance;

    const customAssetsSum = customAssets.reduce((sum, ca) => sum + ca.balance, 0);
    const liquidNW = balances.cash + balances.emergencyFund + balances.brokerage + balances.trad401k + balances.tradIra + balances.rothIra + balances.hsa + balances.other + customAssetsSum;
    const netWorth = liquidNW + totalHomeValue - totalMortgageBalance - currentDebtSum - state.cumulativeShortfall;

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
          plannedPreTaxSavings += ((Number(savings[k]) || 0) + (Number(partnerSavings[k]) || 0)) * 12;
        });
        postTaxKeys.forEach(k => {
          plannedPostTaxSavings += ((Number(savings[k]) || 0) + (Number(partnerSavings[k]) || 0)) * 12;
        });
      }
    }
    const totalPlannedSavings = plannedPreTaxSavings + plannedPostTaxSavings;
    const incomeAvailable = annualIncome + windfallReceived;
    const gapForYear = incomeAvailable - taxes - annualExpenses - totalPlannedSavings;
    const lifestyleGapValue = (age < targetRetirementAge && gapForYear < 0) ? -gapForYear : 0;
    const weddingLoan = activeLoans.find(l => l.id === 'wedding-debt');
    const weddingDebtBalance = weddingLoan ? weddingLoan.balance : 0;
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
      actualContributions: { ...actualContributions }
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

    weddingFinancingDetails = {
      weddingCost: weddingCost,
      paidFromSavings: state.weddingPaidFromSavings ?? 0,
      financedAmount: state.weddingFinancedAmount ?? 0,
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
    weddingFinancingDetails
  };
}
