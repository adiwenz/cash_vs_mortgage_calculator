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

export function derivePhasesFromEvents(profile, events, budgetOverrides = []) {
  const currentAge = profile.currentAge;
  const lifeExpectancy = profile.lifeExpectancy;
  const targetRetirementAge = profile.targetRetirementAge;
  const enabledEvents = events.filter(e => e.enabled !== false);

  const boundaries = new Set();
  boundaries.add(currentAge);
  boundaries.add(targetRetirementAge);
  boundaries.add(lifeExpectancy);

  // Social Security Claiming Age Boundary
  const ssEv = enabledEvents.find(e => e.type === 'socialSecurity');
  if (ssEv) {
    const claimAge = Number(ssEv.claimingAge !== undefined ? ssEv.claimingAge : ssEv.age) || 67;
    if (claimAge > currentAge && claimAge < lifeExpectancy) {
      boundaries.add(claimAge);
    }
  }

  // A. Career Changes (from income list events)
  enabledEvents.forEach(e => {
    if (e.type === 'incomeItem') {
      if (e.id && typeof e.id === 'string' && e.id.startsWith('child-income-boost')) return;
      const start = Number(e.startAge);
      if (start > currentAge && start < targetRetirementAge) {
        boundaries.add(start);
      }
    }
    if (e.type === 'spendingItem') {
      const start = Number(e.startAge);
      if (start > currentAge && start < targetRetirementAge) {
        boundaries.add(start);
      }
    }
    if (e.type === 'sabbatical') {
      const start = Number(e.startAge);
      const end = Number(e.endAge);
      if (start > currentAge && start < targetRetirementAge) boundaries.add(start);
      if (end > currentAge && end < targetRetirementAge) boundaries.add(end);
    }
    if (e.type === 'baristaFire') {
      const start = Number(e.startAge);
      if (start > currentAge && start < targetRetirementAge) boundaries.add(start);
    }
    if (['marriage', 'divorce', 'haveChild', 'buyHouse', 'sellHouse'].includes(e.type)) {
      const age = Number(e.age || e.purchaseAge || e.birthAge || e.startAge || e.saleAge);
      if (age > currentAge && age < targetRetirementAge) {
        boundaries.add(age);
      }
    }
  });

  // Spouse retirement boundary
  const marriageEvent = enabledEvents.find(e => e.type === 'marriage');
  const spouseMember = enabledEvents.find(e => e.type === 'spouseMember');
  if (marriageEvent) {
    const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
      ? Number(spouseMember.currentAge)
      : (Number(marriageEvent.spouseCurrentAge) || currentAge);
    const spouseDesiredRetirementAge = (spouseMember && spouseMember.spouseDesiredRetirementAge !== undefined && spouseMember.spouseDesiredRetirementAge !== null && spouseMember.spouseDesiredRetirementAge !== '')
      ? spouseMember.spouseDesiredRetirementAge
      : ((spouseMember && spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== '')
        ? spouseMember.desiredRetirementAge
        : marriageEvent.spouseDesiredRetirementAge);
    if (spouseDesiredRetirementAge !== undefined && spouseDesiredRetirementAge !== null && spouseDesiredRetirementAge !== '') {
      const userAgeWhenSpouseRetires = currentAge + (Number(spouseDesiredRetirementAge) - spouseCurrentAge);
      if (userAgeWhenSpouseRetires > currentAge && userAgeWhenSpouseRetires < targetRetirementAge) {
        boundaries.add(userAgeWhenSpouseRetires);
      }
    }
  }

  // D. Child count transitions
  for (let age = currentAge + 1; age < lifeExpectancy; age++) {
    const prevCount = getActiveChildrenCountAtAge(age - 1, enabledEvents);
    const count = getActiveChildrenCountAtAge(age, enabledEvents);
    if (count !== prevCount) {
      boundaries.add(age);
    }
  }

  // E. Debt starts and payoffs boundaries
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

  const sortedBoundaries = Array.from(boundaries)
    .filter(age => age <= lifeExpectancy)
    .sort((a, b) => a - b);
  const phases = [];

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

    // Passive retirement/passive incomes (pension, rentalIncome, annuity, otherRetirementIncome)
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

    // A. Active Debts
    const activeDebts = getActiveDebtsForAge(profile, enabledEvents, start);
    if (activeDebts.length > 0) {
      hasHadDebts = true;
    }

    // B. Naming & Icon
    let type = 'workSave';
    let name = 'Current Life';
    let icon = '💼';

    if (start >= targetRetirementAge) {
      type = 'retire';
      name = childCount > 0 
        ? `${childCount} Child${childCount === 1 ? '' : 'ren'} (Retired)`
        : 'Retirement';
      icon = '🌴';
    } else if (childCount > 0) {
      type = 'childcare';
      name = 'Childcare Years';
      icon = '👶';
    } else if (enabledEvents.some(e => e.type === 'incomeItem' && Number(e.startAge) === start && start > currentAge && !e.id?.startsWith('child-income-boost') && !e.id?.startsWith('simple-inc-prechild') && !e.id?.startsWith('simple-inc-worksave') && !e.id?.startsWith('simple-inc-childcare'))) {
      type = 'careerChange';
      name = 'Higher Income Years';
      icon = '💼';
    } else if (activeDebts.length > 0) {
      const studentLoan = activeDebts.find(d => d.type === 'studentLoan');
      const creditCard = activeDebts.find(d => d.type === 'creditCard');
      const autoLoan = activeDebts.find(d => d.type === 'carLoan');
      const mortgage = activeDebts.find(d => d.type === 'mortgage');
      
      if (studentLoan) {
        type = 'studentLoan';
        name = 'Student Loan Years';
        icon = '🎓';
      } else if (creditCard) {
        type = 'creditCard';
        name = 'Credit Card Years';
        icon = '💳';
      } else if (autoLoan) {
        type = 'carLoan';
        name = 'Auto Loan Years';
        icon = '🚗';
      } else if (mortgage) {
        type = 'mortgage';
        name = 'Mortgage Years';
        icon = '🏠';
      } else {
        type = 'debt';
        name = 'Debt Payoff Years';
        icon = '💸';
      }
    } else if (marriageEvent && Number(marriageEvent.age) === start) {
      type = 'marriage';
      name = 'Married Life';
      icon = '💍';
    } else if (hasHadDebts && activeDebts.length === 0) {
      type = 'debtFree';
      name = 'Debt-Free Years';
      icon = '🎉';
    } else {
      type = 'workSave';
      if (i === 0) {
        name = 'Current Life';
        icon = '💼';
      } else {
        name = 'Standard Work Phase';
        icon = '💼';
      }
    }

    if (isReceivingSS) {
      icon = '🇺🇸';
      if (type === 'retire') {
        if (childCount === 0) {
          name = 'Receiving SS';
        }
      } else if (isMarried) {
        name = 'Marriage Phase (Receiving SS)';
      } else {
        name = 'Working (Receiving SS)';
      }
    }

    const id = `${type}_${start}_${end}`;

    // C. User income parts
    const rawIncomeItem = enabledEvents.find(inc => inc.type === 'incomeItem' && start >= inc.startAge && start < inc.endAge && !inc.id.startsWith('child-income-boost'));
    const sabbatical = enabledEvents.find(ev => ev.type === 'sabbatical' && start >= ev.startAge && start < ev.endAge && ev.enabled !== false);
    const baristaFire = enabledEvents.find(ev => ev.type === 'baristaFire' && start >= Number(ev.startAge) && ev.enabled !== false);

    let baseSalaryMonthly = 0;
    let growthRate = 0.03;
    if (start >= targetRetirementAge) {
      baseSalaryMonthly = 0;
      growthRate = 0;
    } else if (baristaFire) {
      const partTimeInc = Number(baristaFire.partTimeIncome) || 0;
      baseSalaryMonthly = Math.round(partTimeInc / 12);
      growthRate = 0.03;
    } else {
      if (rawIncomeItem) {
        baseSalaryMonthly = Math.round(rawIncomeItem.frequency === 'monthly' ? Number(rawIncomeItem.amount) : Number(rawIncomeItem.amount) / 12);
        growthRate = (rawIncomeItem.growthRate !== undefined && rawIncomeItem.growthRate !== null && rawIncomeItem.growthRate !== '') ? Number(rawIncomeItem.growthRate) : 0.03;
      } else {
        baseSalaryMonthly = Math.round(profile.simpleIncome / 12);
        growthRate = 0.03;
      }
      if (sabbatical) {
        const reduction = Number(sabbatical.incomeReduction) || 0;
        baseSalaryMonthly = Math.round(Math.max(0, baseSalaryMonthly * (1 - reduction / 100)));
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
      let childCostsScale = 1.0;
      if (type === 'retire') {
        const retireEv = enabledEvents.find(e => e.type === 'retire' && e.enabled !== false);
        childCostsScale = (retireEv?.spendingPercent !== undefined ? Number(retireEv.spendingPercent) : 70) / 100;
      }
      childBoost = activeBoostMonthly * childCostsScale;
    }

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

    // D. Spouse income parts
    const spouseCurrentAge = marriageEvent ? (Number(marriageEvent.spouseCurrentAge) || currentAge) : currentAge;
    const spouseAgeAtStart = spouseCurrentAge + (start - currentAge);
    const partnerRetirementAge = (spouseMember && spouseMember.spouseDesiredRetirementAge !== undefined && spouseMember.spouseDesiredRetirementAge !== null && spouseMember.spouseDesiredRetirementAge !== '')
      ? Number(spouseMember.spouseDesiredRetirementAge)
      : ((spouseMember && spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== '')
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

      if (start < targetRetirementAge && !isPartnerRetiredInPhase) {
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
    }

    // E. Budget Base Inheritance & Setup
    // E. Budget Base Inheritance & Setup
    if (i === 0) {
      // First phase
      baseIncome = baseSalaryMonthly;
      savingsAllocMode = profile.budgetDetails?.savingsAllocMode || 'fixed';

      // Check for user overrides
      const savedPhase = budgetOverrides.find(p => p.id === id || (Number(p.startAge) === start && p.type === type));
      if (savedPhase) {
        baseExpenses = { ...savedPhase.expenses };
        baseSavings = { ...savedPhase.savings };
        basePartnerSavings = { ...savedPhase.partnerSavings || {} };
        savingsAllocMode = savedPhase.savingsAllocMode || savingsAllocMode;
        if (savedPhase.income !== undefined) {
          baseIncome = Number(savedPhase.income) - ssMonthlyIncome - passiveMonthlyIncome;
        }
      } else if (type === 'childcare') {
        // Initialize from childcareBudgets or childcareIncome
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

        if (ccIncome !== undefined && ccIncome !== null) {
          baseIncome = Number(ccIncome);
        }
        if (ccExpenses) {
          baseExpenses = { ...ccExpenses };
        } else if (profile.budgetDetails?.expenses && Object.keys(profile.budgetDetails.expenses).length > 0) {
          baseExpenses = { ...profile.budgetDetails.expenses };
        } else {
          baseExpenses = {
            housing: 1500, utilities: 300, food: 400, diningOut: 200, transportation: 400, healthcare: 300, leisure: 300, misc: 141
          };
        }
        if (ccSavings) {
          baseSavings = { ...ccSavings };
        } else if (profile.budgetDetails?.savings) {
          baseSavings = { ...profile.budgetDetails.savings };
        }
        basePartnerSavings = profile.budgetDetails?.partnerSavings ? { ...profile.budgetDetails.partnerSavings } : {};
      } else if (profile.budgetDetails?.expenses && Object.keys(profile.budgetDetails.expenses).length > 0) {
        baseExpenses = { ...profile.budgetDetails.expenses };
        baseSavings = { ...profile.budgetDetails.savings || {} };
        basePartnerSavings = { ...profile.budgetDetails.partnerSavings || {} };
        Object.keys(baseExpenses).forEach(k => {
          if (k.startsWith('debt_') || k === 'childcare') {
            delete baseExpenses[k];
          }
        });
      } else {
        // Apply default budget template
        const defaultTemplate = profile.budgetDetails?.defaultTemplate || { needsPct: 50, wantsPct: 30, savingsPct: 20 };
        const totalInc = baseSalaryMonthly + childBoost + ssMonthlyIncome + passiveMonthlyIncome;
        
        let needsTotal, wantsTotal, savingsTotal;
        if (profile.simpleExpenses !== undefined && profile.simpleExpenses !== null && profile.simpleExpenses !== '') {
          const expTotal = Number(profile.simpleExpenses) / 12;
          const pctSum = (defaultTemplate.needsPct || 50) + (defaultTemplate.wantsPct || 30);
          needsTotal = pctSum > 0 ? expTotal * ((defaultTemplate.needsPct || 50) / pctSum) : expTotal;
          wantsTotal = pctSum > 0 ? expTotal * ((defaultTemplate.wantsPct || 30) / pctSum) : 0;
          savingsTotal = Math.max(0, totalInc - expTotal);
        } else {
          needsTotal = totalInc * (defaultTemplate.needsPct / 100);
          wantsTotal = totalInc * (defaultTemplate.wantsPct / 100);
          savingsTotal = totalInc * (defaultTemplate.savingsPct / 100);
        }

        baseExpenses = {
          housing: Math.round(needsTotal * (40 / 78)),
          utilities: Math.round(needsTotal * (10 / 78)),
          food: Math.round(needsTotal * (10 / 78)),
          transportation: Math.round(needsTotal * (10 / 78)),
          healthcare: Math.round(needsTotal * (8 / 78)),
          diningOut: Math.round(wantsTotal * (5 / 22)),
          leisure: Math.round(wantsTotal * (8 / 22)),
          misc: Math.round(wantsTotal * (9 / 22))
        };
        const sumVal = Object.values(baseExpenses).reduce((a, b) => a + b, 0);
        const diff = Math.round(needsTotal + wantsTotal) - sumVal;
        baseExpenses.misc = (baseExpenses.misc || 0) + diff;

        baseSavings = {
          trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: Math.round(savingsTotal), checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
        };
        basePartnerSavings = {
          trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
        };
      }
    } else {
      // Subsequent phases - inherit/initialize
      const priorBaseIncome = baseIncome;
      let baseExpensesOverwritten = false;
      
      // Default to inheriting from the prior phase's base budget
      baseIncome = priorBaseIncome;
      baseExpenses = { ...phases[i - 1].baseExpenses };
      baseSavings = { ...phases[i - 1].baseSavings };
      basePartnerSavings = { ...phases[i - 1].basePartnerSavings };
      savingsAllocMode = phases[i - 1].savingsAllocMode;

      // If career change starts at this phase, update baseIncome
      if (rawIncomeItem && Number(rawIncomeItem.startAge) === start) {
        baseIncome = baseSalaryMonthly;
      }

      // If childcare count changes, load appropriate childcare/standard budget
      const priorChildCount = phases[i - 1].childCount || 0;
      if (childCount !== priorChildCount) {
        if (childCount > 0) {
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

          if (ccIncome !== undefined && ccIncome !== null) {
            baseIncome = Number(ccIncome);
          }
          if (ccExpenses) {
            baseExpenses = { ...ccExpenses };
            baseExpensesOverwritten = true;
          }
          if (ccSavings) {
            baseSavings = { ...ccSavings };
          }
        } else {
          // Revert to standard
          baseIncome = baseSalaryMonthly;
          const lastStandardPhase = phases.slice().reverse().find(p => p.childCount === 0);
          if (lastStandardPhase) {
            baseExpenses = { ...lastStandardPhase.baseExpenses };
            baseExpensesOverwritten = true;
            baseSavings = { ...lastStandardPhase.baseSavings };
            basePartnerSavings = { ...lastStandardPhase.basePartnerSavings };
          }
        }
      }

      // If marriage starts at this phase, adjust base expenses
      const isMarriageTransition = isMarried && !phases[i - 1].isMarried;
      if (isMarriageTransition) {
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
          baseExpensesOverwritten = true;
        } else {
          const spousePersonal = Math.round(spouseIncome * (1 - spouseSavingsRate / 100));
          const lifestyle = Number(marriageEvent.lifestyleAdjustment || 0);
          const housing = Number(marriageEvent.housingSavings || 0);
          
          baseExpenses = { ...baseExpenses };
          baseExpenses.misc = (baseExpenses.misc || 0) + spousePersonal + lifestyle;
          baseExpenses.housing = Math.max(0, (baseExpenses.housing || 0) + housing);
          baseExpensesOverwritten = true;
        }
        
        basePartnerSavings = {
          trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
        };
      }

      // If transitioning to retirement, or base expenses were overwritten during retirement, scale expenses by retirement spending percentage
      // If transitioning to retirement, or base expenses were overwritten during retirement, scale expenses by retirement spending percentage
      if (type === 'retire') {
        if (phases[i - 1].type !== 'retire' || baseExpensesOverwritten) {
          const retireEv = enabledEvents.find(e => e.type === 'retire' && e.enabled !== false);
          const pct = (retireEv?.spendingPercent !== undefined ? Number(retireEv.spendingPercent) : 70) / 100;
          const scaledExpenses = {};
          Object.keys(baseExpenses).forEach(k => {
            scaledExpenses[k] = Math.round(baseExpenses[k] * pct);
          });
          baseExpenses = scaledExpenses;
        }
        baseIncome = 0;
        baseSavings = { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0 };
        basePartnerSavings = { trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0 };
      }

      // Look for user overrides for this phase
      const myIndexInType = phases.filter(p => p.type === type).length;
      const savedOfSameType = budgetOverrides.filter(p => p.type === type);
      const savedPhase = budgetOverrides.find(p => p.id === id || (Number(p.startAge) === start && p.type === type))
        || savedOfSameType[myIndexInType];

      if (savedPhase) {
        baseExpenses = { ...savedPhase.expenses };
        baseSavings = { ...savedPhase.savings };
        if (savedPhase.partnerSavings) basePartnerSavings = { ...savedPhase.partnerSavings };
        savingsAllocMode = savedPhase.savingsAllocMode || savingsAllocMode;
        if (savedPhase.income !== undefined) {
          baseIncome = Number(savedPhase.income) - childBoost - ssMonthlyIncome - passiveMonthlyIncome;
        }
      }
    }

    // If married and partner savings is not yet configured, distribute partner savings proportionally to user savings
    if (isMarried && type !== 'retire') {
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

    // F. Clean up dynamic keys from baseExpenses
    Object.keys(baseExpenses).forEach(k => {
      if (k.startsWith('debt_') || k === 'childcare') {
        delete baseExpenses[k];
      }
    });

    // G. Layer event modifications on top of baseExpenses
    const resolvedExpenses = { ...baseExpenses };
    
    let childCostsScale = 1.0;
    if (type === 'retire') {
      const retireEv = enabledEvents.find(e => e.type === 'retire' && e.enabled !== false);
      childCostsScale = (retireEv?.spendingPercent !== undefined ? Number(retireEv.spendingPercent) : 70) / 100;
    }
    
    let resolvedIncome = baseIncome + ssMonthlyIncome + passiveMonthlyIncome;
    const standardBase = (start >= targetRetirementAge) ? ssMonthlyIncome : baseSalaryMonthly;
    if (resolvedIncome <= standardBase) {
      resolvedIncome += childBoost;
    }
    const actualChildBoost = resolvedIncome - baseIncome - ssMonthlyIncome - passiveMonthlyIncome;

    // 1. Childcare
    const monthlyChildCosts = calculateYearlyChildCosts(start, enabledEvents, profile, currentAge, [], 1) / 12;
    if (monthlyChildCosts > 0) {
      resolvedExpenses['childcare'] = Math.round(monthlyChildCosts * childCostsScale);
    }

    // 2. Debts
    activeDebts.forEach(debt => {
      resolvedExpenses[`debt_${debt.id}`] = debt.monthlyPayment;
    });

    phases.push({
      id,
      name,
      icon,
      type,
      startAge: start,
      endAge: end,
      childCount,
      income: resolvedIncome,
      baseSalaryMonthly: baseIncome,
      childBoost: actualChildBoost,
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
