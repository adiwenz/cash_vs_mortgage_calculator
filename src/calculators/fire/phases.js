import { getActiveChildrenCountAtAge } from '../../simulatorMathUtils.js';
import {
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit
} from './socialSecurity.js';
import { getProfileFromInputs, getEventsFromInputs } from './normalizeInputs.js';
import { calculateYearlyChildCosts } from './children.js';
import { getActiveDebtsForAge, calculateAmortizedLoanPayoffAge } from './debts.js';

export function getPartitionedPhases(startAge, endAge, enabledEvents) {
  const segments = [];
  if (startAge >= endAge) return segments;

  let currentType = getActiveChildrenCountAtAge(startAge, enabledEvents) > 0 ? 'childcare' : 'standard';
  let segmentStart = startAge;

  for (let age = startAge + 1; age < endAge; age++) {
    const type = getActiveChildrenCountAtAge(age, enabledEvents) > 0 ? 'childcare' : 'standard';
    if (type !== currentType) {
      segments.push({
        type: currentType,
        startAge: segmentStart,
        endAge: age
      });
      currentType = type;
      segmentStart = age;
    }
  }
  segments.push({
    type: currentType,
    startAge: segmentStart,
    endAge: endAge
  });
  return segments;
}

export function getActiveEventsForInterval(startAge, endAge, enabledEvents, profile) {
  const active = [];
  const marriageEvent = enabledEvents.find(ev => ev.type === 'marriage');
  const spouseMember = enabledEvents.find(ev => ev.type === 'spouseMember');

  enabledEvents.forEach(e => {
    let isActive = false;
    if (e.type === 'marriage') {
      isActive = startAge >= Number(e.age);
    } else if (e.type === 'spouseMember') {
      if (marriageEvent && startAge >= Number(marriageEvent.age)) {
        const spouseCurrentAge = Number(e.currentAge) || Number(marriageEvent.spouseCurrentAge) || profile.currentAge;
        const spouseLifeExpectancy = Number(e.spouseLifeExpectancy || e.lifeExpectancy) || Number(marriageEvent.spouseLifeExpectancy) || profile.lifeExpectancy;
        const userAgeWhenSpouseDies = profile.currentAge + (spouseLifeExpectancy - spouseCurrentAge);
        isActive = startAge < userAgeWhenSpouseDies;
      }
    } else if (e.type === 'haveChild') {
      const birthAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
      const childStartAge = Number(e.childStartAge !== undefined ? e.childStartAge : 0);
      const includeCollege = e.includeCollege !== undefined ? e.includeCollege : false;
      const maxAge = includeCollege ? 22 : 18;
      isActive = startAge >= (birthAge + childStartAge) && startAge < (birthAge + maxAge);
    } else if (e.type === 'borrowing' || e.type === 'debtItem') {
      const activeDebts = getActiveDebtsForAge(profile, enabledEvents, startAge);
      isActive = activeDebts.some(d => d.id === e.id);
    } else if (e.type === 'buyHouse') {
      const purchaseAge = Number(e.purchaseAge !== undefined ? e.purchaseAge : e.age);
      let saleAge = profile.lifeExpectancy;
      const sellEv = enabledEvents.find(ev => ev.type === 'sellHouse' && ev.houseId === e.id);
      if (sellEv) {
        saleAge = Number(sellEv.age);
      } else if (e.yearsUntilSale !== undefined && e.yearsUntilSale !== null && e.yearsUntilSale !== '') {
        const val = Number(e.yearsUntilSale);
        if (!isNaN(val) && val > 0) {
          if (val < profile.currentAge) {
            saleAge = purchaseAge + val;
          } else {
            saleAge = val;
          }
        }
      }
      isActive = startAge >= purchaseAge && startAge < saleAge;
    } else if (e.type === 'sellHouse') {
      isActive = startAge === Number(e.age);
    } else if (e.type === 'incomeItem') {
      if (!(e.id && typeof e.id === 'string' && e.id.startsWith('child-income-boost'))) {
        isActive = startAge >= Number(e.startAge) && startAge < Number(e.endAge);
      }
    } else if (e.type === 'spendingItem') {
      isActive = startAge >= Number(e.startAge) && startAge < Number(e.endAge);
    } else if (e.type === 'sabbatical') {
      isActive = startAge >= Number(e.startAge) && startAge < Number(e.endAge);
    } else if (e.type === 'baristaFire') {
      isActive = startAge >= Number(e.startAge) && startAge < profile.targetRetirementAge;
    } else if (e.type === 'socialSecurity') {
      const claimAge = Number(e.claimingAge !== undefined ? e.claimingAge : e.age) || 67;
      isActive = startAge >= claimAge;
    } else if (e.type === 'retire') {
      isActive = startAge >= Number(e.age);
    }

    if (isActive) {
      active.push(e.id || e.type);
    }
  });

  return active;
}

function generateIntervalLabel(startAge, endAge, activeEventsList, enabledEvents, profile, hasHadDebts) {
  const isRetired = startAge >= profile.targetRetirementAge;
  const isMarried = enabledEvents.some(e => e.type === 'marriage' && startAge >= Number(e.age));
  const childCount = getActiveChildrenCountAtAge(startAge, enabledEvents);
  const activeDebts = getActiveDebtsForAge(profile, enabledEvents, startAge);

  const parts = [];
  if (isRetired) {
    parts.push("Retired");
    if (enabledEvents.some(e => e.type === 'socialSecurity' && startAge >= (Number(e.claimingAge !== undefined ? e.claimingAge : e.age) || 67))) {
      parts.push("Social Security");
    }
  } else {
    if (isMarried) {
      if (childCount > 0) {
        parts.push("Married");
        parts.push("Childcare");
      } else {
        parts.push("Working");
      }
    } else {
      parts.push("Working");
      if (childCount > 0) {
        parts.push("Childcare");
      }
    }

    if (activeDebts.length > 0) {
      const studentLoan = activeDebts.find(d => d.type === 'studentLoan');
      const creditCard = activeDebts.find(d => d.type === 'creditCard');
      const autoLoan = activeDebts.find(d => d.type === 'carLoan');
      const mortgage = activeDebts.find(d => d.type === 'mortgage');
      if (studentLoan) parts.push("Student Loan");
      else if (creditCard) parts.push("Credit Card");
      else if (autoLoan) parts.push("Auto Loan");
      else if (mortgage) parts.push("Mortgage");
      else parts.push("Debt Payoff");
    }

    const sabbatical = enabledEvents.find(ev => ev.type === 'sabbatical' && startAge >= ev.startAge && startAge < ev.endAge);
    if (sabbatical) {
      parts.push("Sabbatical");
    }
    const baristaFire = enabledEvents.find(ev => ev.type === 'baristaFire' && startAge >= Number(ev.startAge));
    if (baristaFire) {
      parts.push("Barista FIRE");
    }
  }

  if (hasHadDebts && activeDebts.length === 0 && !isRetired) {
    if (parts.length === 1 && parts[0] === "Working") {
      parts[0] = "Debt-Free Years";
    }
  }

  if (parts.length === 0) {
    parts.push("Standard Phase");
  }

  const uniqueParts = Array.from(new Set(parts));
  return uniqueParts.join(" + ");
}

function getRepresentativeIcon(type, activeEventsList, enabledEvents) {
  if (type === 'retire') return '🌴';
  if (activeEventsList.some(id => {
    const e = enabledEvents.find(ev => ev.id === id);
    return e?.type === 'haveChild';
  })) return '👶';
  if (activeEventsList.some(id => {
    const e = enabledEvents.find(ev => ev.id === id);
    return e?.type === 'borrowing' || e?.type === 'debtItem';
  })) {
    const debtEv = enabledEvents.find(ev => activeEventsList.includes(ev.id) && (ev.type === 'borrowing' || ev.type === 'debtItem'));
    if (debtEv?.borrowingType === 'studentLoan') return '🎓';
    if (debtEv?.borrowingType === 'creditCard') return '💳';
    if (debtEv?.borrowingType === 'carLoan') return '🚗';
    if (debtEv?.borrowingType === 'mortgage') return '🏠';
    return '💸';
  }
  if (type === 'marriage') return '💍';
  return '💼';
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

export function derivePhasesFromEvents(profile, events, budgetOverrides = []) {
  const currentAge = profile.currentAge;
  const lifeExpectancy = profile.lifeExpectancy;
  const targetRetirementAge = profile.targetRetirementAge;
  const enabledEvents = events.filter(e => e.enabled !== false);
  const marriageEvent = enabledEvents.find(e => e.type === 'marriage');
  const spouseMember = enabledEvents.find(e => e.type === 'spouseMember');

  const boundaries = new Set();
  boundaries.add(currentAge);
  boundaries.add(targetRetirementAge);
  boundaries.add(lifeExpectancy);

  const ssEv = enabledEvents.find(e => e.type === 'socialSecurity');
  if (ssEv) {
    const claimAge = Number(ssEv.claimingAge !== undefined ? ssEv.claimingAge : ssEv.age) || 67;
    if (claimAge > currentAge && claimAge < lifeExpectancy) {
      boundaries.add(claimAge);
    }
  }

  enabledEvents.forEach(e => {
    if (e.id && typeof e.id === 'string' && e.id.startsWith('child-income-boost')) {
      return;
    }
    const ages = [
      e.age,
      e.startAge,
      e.endAge,
      e.purchaseAge,
      e.saleAge,
      e.claimingAge,
      e.birthAge,
      e.payoffAge
    ];

    if (e.type === 'haveChild') {
      const birthAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
      const startAge = Number(e.childStartAge !== undefined ? e.childStartAge : 0);
      const includeCollege = e.includeCollege !== undefined ? e.includeCollege : false;
      const maxAge = includeCollege ? 22 : 18;
      ages.push(birthAge + startAge);
      ages.push(birthAge + maxAge);
    }

    if (e.type === 'marriage') {
      const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
        ? Number(spouseMember.currentAge)
        : (Number(e.spouseCurrentAge) || currentAge);
      const spouseDesiredRetirementAge = (spouseMember && spouseMember.spouseDesiredRetirementAge !== undefined && spouseMember.spouseDesiredRetirementAge !== null && spouseMember.spouseDesiredRetirementAge !== '')
        ? spouseMember.spouseDesiredRetirementAge
        : ((spouseMember && spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== '')
          ? spouseMember.desiredRetirementAge
          : e.spouseDesiredRetirementAge);
      const spouseLifeExpectancy = spouseMember && spouseMember.spouseLifeExpectancy !== undefined && spouseMember.spouseLifeExpectancy !== null && spouseMember.spouseLifeExpectancy !== ''
        ? Number(spouseMember.spouseLifeExpectancy)
        : (spouseMember && spouseMember.lifeExpectancy !== undefined && spouseMember.lifeExpectancy !== null && spouseMember.lifeExpectancy !== ''
          ? Number(spouseMember.lifeExpectancy)
          : e.spouseLifeExpectancy || lifeExpectancy);

      if (spouseDesiredRetirementAge !== undefined && spouseDesiredRetirementAge !== null && spouseDesiredRetirementAge !== '') {
        const userAgeWhenSpouseRetires = currentAge + (Number(spouseDesiredRetirementAge) - spouseCurrentAge);
        ages.push(userAgeWhenSpouseRetires);
      }
      const userAgeWhenSpouseDies = currentAge + (spouseLifeExpectancy - spouseCurrentAge);
      ages.push(userAgeWhenSpouseDies);
    }

    ages.forEach(val => {
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val);
        if (!isNaN(num) && num > currentAge && num < lifeExpectancy) {
          boundaries.add(num);
        }
      }
    });
  });

  let prevActiveDebtsStr = JSON.stringify(getActiveDebtsForAge(profile, enabledEvents, currentAge).map(d => d.id).sort());
  for (let age = currentAge + 1; age < lifeExpectancy; age++) {
    const activeDebts = getActiveDebtsForAge(profile, enabledEvents, age);
    const activeDebtsStr = JSON.stringify(activeDebts.map(d => d.id).sort());
    if (activeDebtsStr !== prevActiveDebtsStr) {
      if (age > currentAge && age < lifeExpectancy) {
        boundaries.add(age);
      }
      prevActiveDebtsStr = activeDebtsStr;
    }
  }

  for (let age = currentAge + 1; age < lifeExpectancy; age++) {
    const prevCount = getActiveChildrenCountAtAge(age - 1, enabledEvents);
    const count = getActiveChildrenCountAtAge(age, enabledEvents);
    if (count !== prevCount) {
      boundaries.add(age);
    }
  }

  const sortedBoundaries = Array.from(boundaries)
    .filter(age => age <= lifeExpectancy)
    .sort((a, b) => a - b);
  const phases = [];

  // Standard defaults representing the standard work phase
  let standardIncome = (profile.simpleIncome !== undefined && profile.simpleIncome !== null && profile.simpleIncome !== '')
    ? Math.round(Number(profile.simpleIncome) / 12)
    : 4167;
  let standardExpenses = profile.budgetDetails?.expenses ? { ...profile.budgetDetails.expenses } : {};
  let standardSavings = profile.budgetDetails?.savings ? { ...profile.budgetDetails.savings } : {};
  let standardPartnerSavings = profile.budgetDetails?.partnerSavings ? { ...profile.budgetDetails.partnerSavings } : {};
  let standardSavingsAllocMode = profile.budgetDetails?.savingsAllocMode || 'fixed';

  if (Object.keys(standardExpenses).length === 0) {
    const defaultTemplate = profile.budgetDetails?.defaultTemplate || { needsPct: 50, wantsPct: 30, savingsPct: 20 };
    const totalInc = standardIncome;
    let needsTotal, wantsTotal, savingsTotal;
    if (profile.simpleExpenses !== undefined && profile.simpleExpenses !== null && profile.simpleExpenses !== '') {
      const expTotal = Number(profile.simpleExpenses) / 12;
      const pctSum = (defaultTemplate.needsPct ?? 50) + (defaultTemplate.wantsPct ?? 30);
      needsTotal = pctSum > 0 ? expTotal * ((defaultTemplate.needsPct ?? 50) / pctSum) : expTotal;
      wantsTotal = pctSum > 0 ? expTotal * ((defaultTemplate.wantsPct ?? 30) / pctSum) : 0;
      savingsTotal = Math.max(0, totalInc - expTotal);
    } else {
      needsTotal = totalInc * ((defaultTemplate.needsPct ?? 50) / 100);
      wantsTotal = totalInc * ((defaultTemplate.wantsPct ?? 30) / 100);
      savingsTotal = totalInc * ((defaultTemplate.savingsPct ?? 20) / 100);
    }

    standardExpenses = {
      housing: Math.round(needsTotal * (40 / 78)),
      utilities: Math.round(needsTotal * (10 / 78)),
      food: Math.round(needsTotal * (10 / 78)),
      transportation: Math.round(needsTotal * (10 / 78)),
      healthcare: Math.round(needsTotal * (8 / 78)),
      diningOut: Math.round(wantsTotal * (5 / 22)),
      leisure: Math.round(wantsTotal * (8 / 22)),
      misc: Math.round(wantsTotal * (9 / 22))
    };
    const sumVal = Object.values(standardExpenses).reduce((a, b) => a + b, 0);
    const diff = Math.round(needsTotal + wantsTotal) - sumVal;
    standardExpenses.misc = (standardExpenses.misc || 0) + diff;

    standardSavings = {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: Math.round(savingsTotal), checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
    };
    standardPartnerSavings = {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
    };
  }

  // Remove debt and childcare keys from standardExpenses
  Object.keys(standardExpenses).forEach(k => {
    if (k.startsWith('debt_') || k === 'childcare') {
      delete standardExpenses[k];
    }
  });

  // Helper to resolve childcare budget
  function resolveChildcareBudget(childCount, profile, standardIncome, standardExpenses, standardSavings, standardPartnerSavings) {
    const finalChildcareBudgets = profile.budgetDetails?.childcareBudgets || {};
    let ccIncome = profile.budgetDetails?.childcareIncome;
    let ccExpenses = profile.budgetDetails?.childcareExpenses;
    let ccSavings = profile.budgetDetails?.savings;

    if (finalChildcareBudgets[childCount]) {
      ccIncome = finalChildcareBudgets[childCount].income;
      ccExpenses = finalChildcareBudgets[childCount].expenses;
      ccSavings = finalChildcareBudgets[childCount].savings;
    } else if (Object.keys(finalChildcareBudgets).length > 0) {
      const configuredCounts = Object.keys(finalChildcareBudgets).map(Number).sort((a, b) => a - b);
      const closestCount = configuredCounts.find(c => c >= childCount) || configuredCounts[configuredCounts.length - 1];
      const targetBudget = finalChildcareBudgets[closestCount];
      
      ccIncome = targetBudget.income;
      if (childCount < closestCount && ccIncome !== undefined && ccIncome !== null) {
        const baseIncomeVal = Number(profile.budgetDetails?.income) || (profile.simpleIncome / 12) || 4166.67;
        const boost = ccIncome - baseIncomeVal;
        ccIncome = baseIncomeVal + boost * (childCount / closestCount);
      }
      ccExpenses = { ...targetBudget.expenses };
      ccSavings = { ...targetBudget.savings };
    }

    const result = {
      income: ccIncome !== undefined && ccIncome !== null ? Number(ccIncome) : standardIncome,
      expenses: ccExpenses ? { ...ccExpenses } : { ...standardExpenses },
      savings: ccSavings ? { ...ccSavings } : { ...standardSavings },
      partnerSavings: finalChildcareBudgets[childCount]?.partnerSavings ? { ...finalChildcareBudgets[childCount].partnerSavings } : { ...standardPartnerSavings },
      savingsAllocMode: finalChildcareBudgets[childCount]?.savingsAllocMode || 'fixed'
    };

    // Clean up dynamic keys from expenses
    Object.keys(result.expenses).forEach(k => {
      if (k.startsWith('debt_') || k === 'childcare') {
        delete result.expenses[k];
      }
    });

    return result;
  }

  let baseIncome = 0;
  let baseExpenses = {};
  let baseSavings = {};
  let basePartnerSavings = {};
  let savingsAllocMode = 'fixed';
  let hasHadDebts = false;

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];

    const childCount = getActiveChildrenCountAtAge(start, enabledEvents);
    const ssClaimingAge = ssEv ? (Number(ssEv.claimingAge !== undefined ? ssEv.claimingAge : ssEv.age) || 67) : 67;
    const isReceivingSS = ssEv && start >= ssClaimingAge;
    const isMarried = !!(marriageEvent && start >= Number(marriageEvent.age));
    const activeDebts = getActiveDebtsForAge(profile, enabledEvents, start);
    if (activeDebts.length > 0) hasHadDebts = true;

    let loadedCustomChildcare = false;

    if (start < targetRetirementAge) {
      if (i > 0) {
        const priorChildCount = phases[i - 1].childCount || 0;
        if (childCount !== priorChildCount) {
          if (childCount > 0) {
            const ccBudget = resolveChildcareBudget(childCount, profile, standardIncome, standardExpenses, standardSavings, standardPartnerSavings);
            baseIncome = ccBudget.income;
            baseExpenses = { ...ccBudget.expenses };
            baseSavings = { ...ccBudget.savings };
            basePartnerSavings = { ...ccBudget.partnerSavings };
            savingsAllocMode = ccBudget.savingsAllocMode;
            
            const finalChildcareBudgets = profile.budgetDetails?.childcareBudgets || {};
            if (finalChildcareBudgets[childCount] || Object.keys(finalChildcareBudgets).length > 0) {
              loadedCustomChildcare = true;
            }
          } else {
            baseIncome = standardIncome;
            baseExpenses = { ...standardExpenses };
            baseSavings = { ...standardSavings };
            basePartnerSavings = { ...standardPartnerSavings };
            savingsAllocMode = standardSavingsAllocMode;
          }
        } else {
          baseIncome = phases[i - 1].baseSalaryMonthly;
          baseExpenses = { ...phases[i - 1].baseExpenses };
          baseSavings = { ...phases[i - 1].baseSavings };
          basePartnerSavings = { ...phases[i - 1].basePartnerSavings };
          savingsAllocMode = phases[i - 1].savingsAllocMode;
          if (childCount > 0) {
            const finalChildcareBudgets = profile.budgetDetails?.childcareBudgets || {};
            if (finalChildcareBudgets[childCount] || Object.keys(finalChildcareBudgets).length > 0) {
              loadedCustomChildcare = true;
            }
          }
        }
      } else {
        if (childCount > 0) {
          const ccBudget = resolveChildcareBudget(childCount, profile, standardIncome, standardExpenses, standardSavings, standardPartnerSavings);
          baseIncome = ccBudget.income;
          baseExpenses = { ...ccBudget.expenses };
          baseSavings = { ...ccBudget.savings };
          basePartnerSavings = { ...ccBudget.partnerSavings };
          savingsAllocMode = ccBudget.savingsAllocMode;
          
          const finalChildcareBudgets = profile.budgetDetails?.childcareBudgets || {};
          if (finalChildcareBudgets[childCount] || Object.keys(finalChildcareBudgets).length > 0) {
            loadedCustomChildcare = true;
          }
        } else {
          baseIncome = standardIncome;
          baseExpenses = { ...standardExpenses };
          baseSavings = { ...standardSavings };
          basePartnerSavings = { ...standardPartnerSavings };
          savingsAllocMode = standardSavingsAllocMode;
        }
      }
    } else {
      baseIncome = 0;
      baseSavings = { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0 };
      basePartnerSavings = { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0 };
      savingsAllocMode = standardSavingsAllocMode;
    }

    Object.keys(baseExpenses).forEach(k => {
      if (k.startsWith('debt_') || k === 'childcare') {
        delete baseExpenses[k];
      }
    });

    let growthRate = 0.03;

    const mainIncomeItem = enabledEvents.find(inc => inc.type === 'incomeItem' && start >= inc.startAge && start < inc.endAge && isGeneratedMainIncome(inc.id));
    if (mainIncomeItem) {
      growthRate = (mainIncomeItem.growthRate !== undefined && mainIncomeItem.growthRate !== null && mainIncomeItem.growthRate !== '') ? Number(mainIncomeItem.growthRate) : 0.03;
    }

    const rawIncomeItem = enabledEvents.find(inc => inc.type === 'incomeItem' && start >= inc.startAge && start < inc.endAge && !isGeneratedMainIncome(inc.id));
    if (rawIncomeItem) {
      baseIncome = Math.round(rawIncomeItem.frequency === 'monthly' ? Number(rawIncomeItem.amount) : Number(rawIncomeItem.amount) / 12);
      growthRate = (rawIncomeItem.growthRate !== undefined && rawIncomeItem.growthRate !== null && rawIncomeItem.growthRate !== '') ? Number(rawIncomeItem.growthRate) : 0.03;
    }
    
    const sabbatical = enabledEvents.find(ev => ev.type === 'sabbatical' && start >= ev.startAge && start < ev.endAge);
    if (sabbatical) {
      const reduction = Number(sabbatical.incomeReduction) || 0;
      baseIncome = Math.round(Math.max(0, baseIncome * (1 - reduction / 100)));
    }

    const baristaFire = enabledEvents.find(ev => ev.type === 'baristaFire' && start >= Number(ev.startAge));
    if (baristaFire) {
      const partTimeInc = Number(baristaFire.partTimeIncome) || 0;
      baseIncome = Math.round(partTimeInc / 12);
      growthRate = 0.03;
    }

    const spouseCurrentAge = marriageEvent ? (Number(marriageEvent.spouseCurrentAge) || currentAge) : currentAge;
    const spouseAgeAtStart = spouseCurrentAge + (start - currentAge);
    const partnerRetirementAge = spouseMember && spouseMember.spouseDesiredRetirementAge !== undefined && spouseMember.spouseDesiredRetirementAge !== null && spouseMember.spouseDesiredRetirementAge !== ''
      ? Number(spouseMember.spouseDesiredRetirementAge)
      : (spouseMember && spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== ''
        ? spouseMember.desiredRetirementAge
        : (marriageEvent && marriageEvent.spouseDesiredRetirementAge !== undefined && marriageEvent.spouseDesiredRetirementAge !== null && marriageEvent.spouseDesiredRetirementAge !== ''
          ? Number(marriageEvent.spouseDesiredRetirementAge)
          : (targetRetirementAge + (spouseCurrentAge - currentAge))));
    const isPartnerRetiredInPhase = isMarried && spouseAgeAtStart >= partnerRetirementAge;

    let spouseIncome = 0;
    let spouseIncomeGrowthRate = 0;
    let spouseSavingsRate = 0;
    let spouseCash = 0;
    let spouseInvestments = 0;
    let spouseRetirement = 0;
    let partnerSSMonthlyIncome = 0;

    if (isMarried) {
      const spouseClaimAge = spouseMember ? Number(spouseMember.spouseSocialSecurityAge !== undefined ? spouseMember.spouseSocialSecurityAge : 67) : 67;
      if (start >= spouseClaimAge && spouseMember) {
        if (spouseMember.spouseEstimatedSocialSecurityBenefit !== undefined && Number(spouseMember.spouseEstimatedSocialSecurityBenefit) > 0) {
          const baseBenefit = Number(spouseMember.spouseEstimatedSocialSecurityBenefit);
          const factor = getSocialSecurityFactor(spouseClaimAge);
          partnerSSMonthlyIncome = Math.round(baseBenefit * factor);
        } else if (spouseMember.income > 0) {
          const spouseRetAge = spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null
            ? Number(spouseMember.desiredRetirementAge)
            : (targetRetirementAge + (spouseMember.currentAge !== undefined ? spouseMember.currentAge : spouseCurrentAge) - currentAge);
          const spouseWorkYears = Math.max(0, spouseRetAge - 22);
          const spouseIncomeHistory = new Array(spouseWorkYears).fill(Number(spouseMember.income) || 0);
          const spouseSSCalc = calculateSocialSecurityBenefit({
            incomeHistory: spouseIncomeHistory,
            claimAge: spouseClaimAge
          });
          partnerSSMonthlyIncome = Math.round(spouseSSCalc.monthlyBenefit);
        }
      }

      if (!isPartnerRetiredInPhase) {
        spouseIncome = Math.round(spouseMember ? (Number(spouseMember.income) || 0) / 12 : (Number(marriageEvent.spouseIncome) || 0) / 12);
        spouseIncomeGrowthRate = spouseMember
          ? (Number(spouseMember.incomeGrowthRate !== undefined ? spouseMember.incomeGrowthRate : spouseMember.growthRate) || 0)
          : (Number(marriageEvent.incomeGrowthRate !== undefined ? marriageEvent.incomeGrowthRate : marriageEvent.growthRate) || 0);
        if (spouseIncomeGrowthRate > 0.5) spouseIncomeGrowthRate /= 100;

        spouseSavingsRate = spouseMember ? (Number(spouseMember.savingsRate) || 0) : (Number(marriageEvent.savingsRate) || 0);
        spouseCash = spouseMember?.assets ? (Number(spouseMember.assets.cash) || 0) : (Number(marriageEvent.cash) || 0);
        spouseInvestments = spouseMember?.assets ? (Number(spouseMember.assets.investments) || 0) : (Number(marriageEvent.investments) || 0);
        spouseRetirement = spouseMember?.assets ? (Number(spouseMember.assets.retirement) || 0) : (Number(marriageEvent.retirement) || 0);
      } else {
        spouseIncome = partnerSSMonthlyIncome;
      }

      if (!loadedCustomChildcare && start < targetRetirementAge) {
        if (marriageEvent.combinedSpendingAfterMarriage) {
          const combExp = Math.round(Number(marriageEvent.combinedSpendingAfterMarriage) / 12);
          baseExpenses = {
            housing: Math.round(combExp * (40 / 78)),
            utilities: Math.round(combExp * (10 / 78)),
            food: Math.round(combExp * (10 / 78)),
            transportation: Math.round(combExp * (10 / 78)),
            healthcare: Math.round(combExp * (8 / 78)),
            diningOut: Math.round(combExp * (5 / 22)),
            leisure: Math.round(combExp * (8 / 22)),
            misc: Math.round(combExp * (9 / 22))
          };
          const sumVal = Object.values(baseExpenses).reduce((a, b) => a + b, 0);
          const diff = combExp - sumVal;
          baseExpenses.misc += diff;
        } else {
          const spousePersonal = Math.round(spouseIncome * (1 - spouseSavingsRate / 100));
          const lifestyle = Number(marriageEvent.lifestyleAdjustment || 0);
          const housing = Number(marriageEvent.housingSavings || 0);
          baseExpenses.misc = (baseExpenses.misc || 0) + spousePersonal + lifestyle;
          baseExpenses.housing = Math.max(0, (baseExpenses.housing || 0) + housing);
        }
      }
    }

    const resolvedExpenses = { ...baseExpenses };

    if (start >= targetRetirementAge) {
      const retireEv = enabledEvents.find(e => e.type === 'retire' && e.enabled !== false);
      const pct = (retireEv?.spendingPercent !== undefined ? Number(retireEv.spendingPercent) : 70) / 100;
      Object.keys(resolvedExpenses).forEach(k => {
        resolvedExpenses[k] = Math.round(resolvedExpenses[k] * pct);
      });
    }

    enabledEvents.forEach(ev => {
      if (ev.type === 'buyHouse') {
        const purchaseAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
        let saleAge = profile.lifeExpectancy;
        const sellEv = enabledEvents.find(e => e.type === 'sellHouse' && e.houseId === ev.id);
        if (sellEv) {
          saleAge = Number(sellEv.age);
        } else if (ev.yearsUntilSale !== undefined && ev.yearsUntilSale !== null && ev.yearsUntilSale !== '') {
          const val = Number(ev.yearsUntilSale);
          if (!isNaN(val) && val > 0) {
            if (val < profile.currentAge) {
              saleAge = purchaseAge + val;
            } else {
              saleAge = val;
            }
          }
        }
        
        if (start >= purchaseAge && start < saleAge) {
          const asset = (ev.houseId && profile.houseAssets)
            ? profile.houseAssets.find(h => h.id === ev.houseId)
            : ev;
          const p = Number(asset.homePrice !== undefined ? asset.homePrice : (asset.purchasePrice !== undefined ? asset.purchasePrice : 0)) || 0;
          const dp = Number(asset.downPayment) || 0;
          const isCash = dp >= p || asset.purchaseType === 'cash';
          
          if (!isCash) {
            const rate = (asset.mortgageRate !== undefined ? Number(asset.mortgageRate) : 6.5) / 100;
            const mortgageTerm = asset.loanTerm !== undefined ? Number(asset.loanTerm) : (asset.loanTermYears !== undefined ? Number(asset.loanTermYears) : 30);
            const loanAmount = Math.max(0, p - dp);
            
            if (start < purchaseAge + mortgageTerm) {
              let annualPI = 0;
              if (loanAmount > 0 && mortgageTerm > 0) {
                const r = rate / 12;
                const n = mortgageTerm * 12;
                const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                annualPI = monthlyPayment * 12;
              }
              resolvedExpenses[`debt_${ev.id}`] = Math.round(annualPI / 12);
            }
          }
        }
      }
    });

    let childCostsScale = 1.0;
    if (start >= targetRetirementAge) {
      const retireEv = enabledEvents.find(e => e.type === 'retire' && e.enabled !== false);
      childCostsScale = (retireEv?.spendingPercent !== undefined ? Number(retireEv.spendingPercent) : 70) / 100;
    }

    if (childCount > 0) {
      const monthlyChildCosts = calculateYearlyChildCosts(start, enabledEvents, profile, currentAge, [], 1) / 12;
      if (monthlyChildCosts > 0) {
        resolvedExpenses['childcare'] = Math.round(monthlyChildCosts * childCostsScale);
      }
    }

    let childBoost = 0;
    if (childCount > 0) {
      let activeBoostMonthly = 0;
      enabledEvents.forEach(inc => {
        if (inc.type === 'incomeItem' && inc.id && typeof inc.id === 'string' && inc.id.startsWith('child-income-boost')) {
          if (inc.startAge <= start && inc.endAge > start) {
            const boostYearly = inc.frequency === 'monthly' ? Number(inc.amount) * 12 : Number(inc.amount);
            activeBoostMonthly += boostYearly / 12;
          }
        }
      });
      childBoost = activeBoostMonthly * childCostsScale;
    }

    activeDebts.forEach(debt => {
      resolvedExpenses[`debt_${debt.id}`] = debt.monthlyPayment;
    });

    let ssMonthlyIncome = 0;
    if (isReceivingSS && ssEv) {
      if (ssEv.useEarnings) {
        const incomeHistory = getIncomeHistory({ currentAge, lifeExpectancy, lifeEvents: enabledEvents }, ssEv, true);
        const ssCalculated = calculateSocialSecurityBenefit({
          incomeHistory,
          claimAge: ssClaimingAge
        });
        ssMonthlyIncome = Math.round(ssCalculated.monthlyBenefit);
      } else {
        const baseBenefit = Number(ssEv.monthlyBenefit !== undefined ? ssEv.monthlyBenefit : 2000);
        const factor = getSocialSecurityFactor(ssClaimingAge);
        ssMonthlyIncome = Math.round(baseBenefit * factor);
      }
    }

    let passiveMonthlyIncome = 0;
    enabledEvents.forEach(ev => {
      if (['pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
        const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
        if (start >= claimingAge) {
          const amt = Number(ev.monthlyBenefit !== undefined ? ev.monthlyBenefit : (ev.amount !== undefined ? ev.amount : 0)) || 0;
          passiveMonthlyIncome += amt;
        }
      }
    });

    let resolvedIncome = baseIncome + ssMonthlyIncome + passiveMonthlyIncome + childBoost;

    if (start >= targetRetirementAge) {
      resolvedIncome = ssMonthlyIncome + passiveMonthlyIncome + childBoost;
      baseIncome = 0;
      baseSavings = { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0 };
      basePartnerSavings = { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0 };
    }

    const activeEventsList = getActiveEventsForInterval(start, end, enabledEvents, profile);
    const activeEventsKey = activeEventsList.slice().sort().join(',');

    let type = 'workSave';
    if (start >= targetRetirementAge) {
      type = 'retire';
    } else if (childCount > 0) {
      type = 'childcare';
    } else if (activeDebts.length > 0) {
      const studentLoan = activeDebts.find(d => d.type === 'studentLoan');
      const creditCard = activeDebts.find(d => d.type === 'creditCard');
      const autoLoan = activeDebts.find(d => d.type === 'carLoan');
      const mortgage = activeDebts.find(d => d.type === 'mortgage');
      if (studentLoan) type = 'studentLoan';
      else if (creditCard) type = 'creditCard';
      else if (autoLoan) type = 'carLoan';
      else if (mortgage) type = 'mortgage';
      else type = 'debt';
    } else if (enabledEvents.some(e => e.type === 'incomeItem' && Number(e.startAge) === start && start > currentAge && !e.id?.startsWith('child-income-boost') && !e.id?.startsWith('simple-inc-prechild') && !e.id?.startsWith('simple-inc-worksave') && !e.id?.startsWith('simple-inc-childcare'))) {
      type = 'careerChange';
    } else if (isMarried) {
      type = 'marriage';
    } else if (hasHadDebts && activeDebts.length === 0) {
      type = 'debtFree';
    }

    const id = `${type}_${start}_${end}`;

    let savedPhase = budgetOverrides.find(p => p.id === id);
    if (!savedPhase) {
      savedPhase = budgetOverrides.find(p => p.activeEventsKey === activeEventsKey);
    }
    if (!savedPhase) {
      savedPhase = budgetOverrides.find(p => Number(p.startAge) === start && Number(p.endAge) === end);
    }
    if (!savedPhase) {
      savedPhase = budgetOverrides.find(p => Number(p.startAge) === start && p.type === type);
    }
    if (!savedPhase) {
      savedPhase = budgetOverrides.find(p => {
        const overrideActiveEvents = getActiveEventsForInterval(Number(p.startAge), Number(p.endAge), enabledEvents, profile);
        const overrideKey = overrideActiveEvents.slice().sort().join(',');
        return overrideKey === activeEventsKey;
      });
    }
    if (!savedPhase) {
      const myIndexInType = phases.filter(p => p.type === type).length;
      const savedOfSameType = budgetOverrides.filter(p => p.type === type);
      if (savedOfSameType[myIndexInType]) {
        savedPhase = savedOfSameType[myIndexInType];
      }
    }

    if (savedPhase) {
      baseExpenses = { ...savedPhase.expenses };
      baseSavings = { ...savedPhase.savings };
      if (savedPhase.partnerSavings) basePartnerSavings = { ...savedPhase.partnerSavings };
      savingsAllocMode = savedPhase.savingsAllocMode || savingsAllocMode;
      if (savedPhase.income !== undefined) {
        resolvedIncome = Number(savedPhase.income);
        if (start < targetRetirementAge) {
          const threshold = standardIncome;
          if (resolvedIncome <= threshold) {
            baseIncome = resolvedIncome - ssMonthlyIncome - passiveMonthlyIncome;
            resolvedIncome = baseIncome + ssMonthlyIncome + passiveMonthlyIncome + childBoost;
          } else {
            baseIncome = resolvedIncome - ssMonthlyIncome - passiveMonthlyIncome - childBoost;
          }
        } else {
          baseIncome = 0;
        }
      }
      Object.keys(savedPhase.expenses).forEach(k => {
        resolvedExpenses[k] = savedPhase.expenses[k];
      });
    }

    if (isMarried && start < targetRetirementAge) {
      const spouseSavingsTotal = Math.round(spouseIncome * (spouseSavingsRate / 100));
      const partnerSavingsTotal = Object.values(basePartnerSavings).reduce((sum, v) => sum + (Number(v) || 0), 0);
      if (spouseSavingsTotal > 0 && partnerSavingsTotal === 0) {
        const userTotalSavings = Object.values(baseSavings).reduce((sum, v) => sum + (Number(v) || 0), 0);
        if (userTotalSavings > 0) {
          Object.keys(baseSavings).forEach(key => {
            basePartnerSavings[key] = Math.round(spouseSavingsTotal * ((Number(baseSavings[key]) || 0) / userTotalSavings));
          });
          const newPartnerTotal = Object.values(basePartnerSavings).reduce((sum, v) => sum + v, 0);
          const diff = spouseSavingsTotal - newPartnerTotal;
          if (diff !== 0) {
            let maxKey = 'brokerage';
            Object.keys(basePartnerSavings).forEach(key => {
              if (basePartnerSavings[key] > (basePartnerSavings[maxKey] || 0)) {
                maxKey = key;
              }
            });
            basePartnerSavings[maxKey] = Math.max(0, basePartnerSavings[maxKey] + diff);
          }
        } else {
          basePartnerSavings.brokerage = spouseSavingsTotal;
        }
      }
    }

    const label = generateIntervalLabel(start, end, activeEventsList, enabledEvents, profile, hasHadDebts);
    let icon = getRepresentativeIcon(type, activeEventsList, enabledEvents);
    if (isReceivingSS) {
      icon = '🇺🇸';
    }

    const effectsApplied = ["Base/default budget"];
    if (rawIncomeItem) effectsApplied.push(`Career income change: ${rawIncomeItem.name}`);
    if (sabbatical) effectsApplied.push(`Sabbatical income reduction: ${sabbatical.incomeReduction}%`);
    if (baristaFire) effectsApplied.push(`Barista FIRE part-time income: ${baristaFire.partTimeIncome}/yr`);
    if (isMarried) {
      effectsApplied.push("Marriage/household changes (spouse income & savings)");
    }
    const mortgagePIAdded = Object.keys(resolvedExpenses).some(k => k.startsWith('debt_') && enabledEvents.find(ev => ev.id === k.replace('debt_', '') && ev.type === 'buyHouse'));
    if (mortgagePIAdded) {
      effectsApplied.push("Housing mortgage payment (P&I)");
    }
    if (childCount > 0) {
      effectsApplied.push("Child/dependent costs (childcare)");
    }
    if (activeDebts.length > 0) {
      effectsApplied.push("Debt payment obligations");
    }
    if (start >= targetRetirementAge) {
      effectsApplied.push("Retirement expense scaling and Social Security changes");
    }
    if (savedPhase) {
      effectsApplied.push("User overrides applied");
    }

    let name = 'Current Life';
    if (start >= targetRetirementAge) {
      name = childCount > 0 
        ? `${childCount} Child${childCount === 1 ? '' : 'ren'} (Retired)`
        : 'Retirement';
    } else if (childCount > 0) {
      name = 'Childcare Years';
    } else if (enabledEvents.some(e => e.type === 'incomeItem' && Number(e.startAge) === start && start > currentAge && !e.id?.startsWith('child-income-boost') && !e.id?.startsWith('simple-inc-prechild') && !e.id?.startsWith('simple-inc-worksave') && !e.id?.startsWith('simple-inc-childcare'))) {
      name = 'Higher Income Years';
    } else if (activeDebts.length > 0) {
      const studentLoan = activeDebts.find(d => d.type === 'studentLoan');
      const creditCard = activeDebts.find(d => d.type === 'creditCard');
      const autoLoan = activeDebts.find(d => d.type === 'carLoan');
      const mortgage = activeDebts.find(d => d.type === 'mortgage');
      if (studentLoan) name = 'Student Loan Years';
      else if (creditCard) name = 'Credit Card Years';
      else if (autoLoan) name = 'Auto Loan Years';
      else if (mortgage) name = 'Mortgage Years';
      else name = 'Debt Payoff Years';
    } else if (marriageEvent && Number(marriageEvent.age) === start) {
      name = 'Married Life';
    } else if (hasHadDebts && activeDebts.length === 0) {
      name = 'Debt-Free Years';
    } else {
      if (i === 0) {
        name = 'Current Life';
      } else {
        name = 'Standard Work Phase';
      }
    }

    if (isReceivingSS) {
      if (start < targetRetirementAge) {
        if (type === 'marriage') {
          name = 'Marriage Phase (Receiving SS)';
        } else {
          name = 'Working (Receiving SS)';
        }
      } else if (childCount === 0) {
        name = 'Receiving SS';
      }
    }

    phases.push({
      id,
      name,
      label,
      icon,
      type,
      startAge: start,
      endAge: end,
      childCount,
      income: resolvedIncome,
      baseSalaryMonthly: baseIncome,
      childBoost,
      ssMonthlyIncome,
      passiveMonthlyIncome,
      incomeGrowthRate: growthRate,
      savingsAllocMode,
      savings: { ...baseSavings },
      partnerSavings: { ...basePartnerSavings },
      expenses: resolvedExpenses,
      baseExpenses: { ...baseExpenses },
      baseSavings: { ...baseSavings },
      basePartnerSavings: { ...basePartnerSavings },
      activeDebts,
      activeEvents: activeEventsList,
      activeEventsKey,
      effectsApplied,
      isMarried,
      spouseIncome,
      partnerSSMonthlyIncome,
      spouseIncomeGrowthRate,
      spouseSavingsRate,
      spouseCash,
      spouseInvestments,
      spouseRetirement
    });
  }

  return phases;
}

export function getNormalizedPhases(inputs) {
  const profile = getProfileFromInputs(inputs);
  const events = getEventsFromInputs(inputs);
  const budgetOverrides = inputs.budgetDetails?.phases || [];
  return derivePhasesFromEvents(profile, events, budgetOverrides);
}

export function getPhaseChangeExplanations(activePhaseObj, normalizedPhases) {
  if (!activePhaseObj || !normalizedPhases) return [];
  
  const activeIndex = normalizedPhases.findIndex(p => p.id === activePhaseObj.id);
  if (activeIndex === -1) return [];
  
  const explanations = [];
  const fmt = (val) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
  
  if (activeIndex === 0) {
    explanations.push({
      text: "Starting phase for your financial timeline.",
      icon: "💼",
      type: "info"
    });
    
    if (activePhaseObj.childCount > 0) {
      explanations.push({
        text: `Starting with childcare active for ${activePhaseObj.childCount} child${activePhaseObj.childCount === 1 ? '' : 'ren'}.`,
        icon: "👶",
        type: "childcare"
      });
    }
    
    if (activePhaseObj.activeDebts && activePhaseObj.activeDebts.length > 0) {
      activePhaseObj.activeDebts.forEach(debt => {
        explanations.push({
          text: `Starting with active debt payment: ${debt.name} (${fmt(debt.monthlyPayment)}/mo).`,
          icon: debt.icon || "💳",
          type: "debt"
        });
      });
    }
    
    if (activePhaseObj.isMarried) {
      explanations.push({
        text: "Starting timeline as married with combined income.",
        icon: "💍",
        type: "marriage"
      });
    }
    
    return explanations;
  }
  
  const prior = normalizedPhases[activeIndex - 1];
  
  if (activePhaseObj.type === 'retire' && prior.type !== 'retire') {
    explanations.push({
      text: "Reaching retirement! Active career income ends, and you transition to retirement spending rules.",
      icon: "🌴",
      type: "retirement",
      changeType: "neutral"
    });
  }
  
  if (activePhaseObj.childCount !== prior.childCount) {
    if (activePhaseObj.childCount > prior.childCount) {
      explanations.push({
        text: `Child count increased to ${activePhaseObj.childCount}, adding childcare costs.`,
        icon: "👶",
        type: "childcare",
        changeType: "negative"
      });
    } else {
      explanations.push({
        text: `Child count decreased to ${activePhaseObj.childCount}, reducing childcare costs.`,
        icon: "🎉",
        type: "childcare",
        changeType: "positive"
      });
    }
  }
  
  if (activePhaseObj.isMarried && !prior.isMarried) {
    explanations.push({
      text: "Got married! Combined budget inherits spouse's income and savings allocations.",
      icon: "💍",
      type: "marriage",
      changeType: "positive"
    });
  } else if (!activePhaseObj.isMarried && prior.isMarried) {
    explanations.push({
      text: "No longer married phase.",
      icon: "💔",
      type: "marriage",
      changeType: "negative"
    });
  }
  
  const activeSalary = activePhaseObj.baseSalaryMonthly || 0;
  const priorSalary = prior.baseSalaryMonthly || 0;
  if (activeSalary !== priorSalary) {
    if (activeSalary > priorSalary) {
      explanations.push({
        text: `Income increased from ${fmt(priorSalary)} to ${fmt(activeSalary)}/mo.`,
        icon: "📈",
        type: "income",
        changeType: "positive"
      });
    } else if (activeSalary < priorSalary && activePhaseObj.type !== 'retire') {
      explanations.push({
        text: `Income decreased from ${fmt(priorSalary)} to ${fmt(activeSalary)}/mo (e.g. sabbatical or part-time work).`,
        icon: "📉",
        type: "income",
        changeType: "negative"
      });
    }
  }
  
  if (activePhaseObj.ssMonthlyIncome > 0 && prior.ssMonthlyIncome === 0) {
    explanations.push({
      text: `Claimed Social Security: adding ${fmt(activePhaseObj.ssMonthlyIncome)}/mo to your income.`,
      icon: "💰",
      type: "income",
      changeType: "positive"
    });
  }
  if (activePhaseObj.partnerSSMonthlyIncome > 0 && prior.partnerSSMonthlyIncome === 0) {
    explanations.push({
      text: `Partner claimed Social Security: adding ${fmt(activePhaseObj.partnerSSMonthlyIncome)}/mo to combined income.`,
      icon: "💰",
      type: "income",
      changeType: "positive"
    });
  }
  
  if (activePhaseObj.passiveMonthlyIncome > prior.passiveMonthlyIncome) {
    const diff = activePhaseObj.passiveMonthlyIncome - prior.passiveMonthlyIncome;
    explanations.push({
      text: `Passive/Retirement income started, adding ${fmt(diff)}/mo.`,
      icon: "🏦",
      type: "income",
      changeType: "positive"
    });
  }
  
  const activeDebtIds = (activePhaseObj.activeDebts || []).map(d => d.id);
  const priorDebtIds = (prior.activeDebts || []).map(d => d.id);
  
  const addedDebts = (activePhaseObj.activeDebts || []).filter(d => !priorDebtIds.includes(d.id));
  const removedDebts = (prior.activeDebts || []).filter(d => !activeDebtIds.includes(d.id));
  
  addedDebts.forEach(debt => {
    explanations.push({
      text: `New debt obligations active: ${debt.name} (+${fmt(debt.monthlyPayment)}/mo).`,
      icon: debt.icon || "💸",
      type: "debt",
      changeType: "negative"
    });
  });
  
  removedDebts.forEach(debt => {
    explanations.push({
      text: `Debt payoff complete for ${debt.name} (saving ${fmt(debt.monthlyPayment)}/mo).`,
      icon: "🎉",
      type: "debt",
      changeType: "positive"
    });
  });
  
  if (explanations.length === 0) {
    explanations.push({
      text: `Transitioned to a new phase boundary at age ${activePhaseObj.startAge}.`,
      icon: "ℹ️",
      type: "info",
      changeType: "neutral"
    });
  }
  
  return explanations;
}
