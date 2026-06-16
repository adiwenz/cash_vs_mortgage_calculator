import { getActiveChildrenCountAtAge } from '../../simulatorMathUtils.js';
import {
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit
} from './socialSecurity.js';
import { getProfileFromInputs, getEventsFromInputs } from './normalizeInputs.js';

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

  const sortedBoundaries = Array.from(boundaries)
    .filter(age => age <= lifeExpectancy)
    .sort((a, b) => a - b);
  const phases = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];

    const childCount = getActiveChildrenCountAtAge(start, enabledEvents);
    const ssClaimingAge = ssEv ? (Number(ssEv.claimingAge !== undefined ? ssEv.claimingAge : ssEv.age) || 67) : 67;
    const isReceivingSS = ssEv && start >= ssClaimingAge;

    // Identify primary type, name, and icon
    let type = 'workSave';
    let name = isReceivingSS ? 'Working (Receiving SS)' : 'Standard Work Phase';
    let icon = isReceivingSS ? '🇺🇸' : '💼';

    if (start >= targetRetirementAge) {
      type = 'retire';
      if (isReceivingSS) {
        icon = '🇺🇸';
        name = childCount > 0
          ? (childCount === 1 ? '1 Child (Receiving SS)' : `${childCount} Kids (Receiving SS)`)
          : 'Receiving SS';
      } else {
        icon = childCount > 0 ? '👶' : '🌴';
        name = childCount > 0 
          ? (childCount === 1 ? '1 Child (Retired)' : `${childCount} Kids (Retired)`)
          : 'Retirement';
      }
    } else if (childCount > 0) {
      type = 'childcare';
      if (isReceivingSS) {
        icon = '🇺🇸';
        name = childCount === 1 ? '1 Child (Receiving SS)' : `${childCount} Kids (Receiving SS)`;
      } else {
        name = childCount === 1 ? '1 Child' : `${childCount} Kids`;
        icon = '👶';
      }
    } else {
      const isMarriageBoundary = marriageEvent && Number(marriageEvent.age) === start;
      if (isMarriageBoundary) {
        type = 'marriage';
        name = isReceivingSS ? 'Marriage Phase (Receiving SS)' : 'Marriage Phase';
        icon = isReceivingSS ? '🇺🇸' : '💍';
      }
    }

    const id = `${type}_${start}_${end}`;

    // User monthly income
    const rawIncomeItem = enabledEvents.find(inc => inc.type === 'incomeItem' && start >= inc.startAge && start < inc.endAge && !inc.id.startsWith('child-income-boost'));
    let baseSalaryMonthly = 0;
    let growthRate = 0.03;
    if (start >= targetRetirementAge) {
      baseSalaryMonthly = 0;
      growthRate = 0;
    } else if (rawIncomeItem) {
      baseSalaryMonthly = rawIncomeItem.frequency === 'monthly' ? Math.round(Number(rawIncomeItem.amount)) : Math.round(Number(rawIncomeItem.amount) / 12);
      growthRate = Number(rawIncomeItem.growthRate) || 0.03;
    } else {
      baseSalaryMonthly = Math.round(profile.simpleIncome / 12);
      growthRate = 0.03;
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
      childBoost = activeBoostMonthly;
    }

    // Add Social Security monthly benefit if receiving SS
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

    const defaultIncome = baseSalaryMonthly + childBoost + ssMonthlyIncome;

    // User monthly expenses
    const rawSpendingItem = enabledEvents.find(sp => sp.type === 'spendingItem' && start >= sp.startAge && start < sp.endAge);
    let baseExpensesMonthly = 0;
    if (start >= targetRetirementAge) {
      baseExpensesMonthly = 0;
    } else if (rawSpendingItem) {
      baseExpensesMonthly = rawSpendingItem.frequency === 'monthly' ? Math.round(Number(rawSpendingItem.amount)) : Math.round(Number(rawSpendingItem.amount) / 12);
    } else {
      baseExpensesMonthly = Math.round(profile.simpleExpenses / 12);
    }

    const isMarried = marriageEvent && start >= Number(marriageEvent.age);
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
        spouseIncome = spouseMember ? Math.round((Number(spouseMember.income) || 0) / 12) : Math.round(Number(marriageEvent.spouseIncome || 0) / 12);
        spouseIncomeGrowthRate = spouseMember
          ? (Number(spouseMember.incomeGrowthRate !== undefined ? spouseMember.incomeGrowthRate : spouseMember.growthRate) || 0)
          : (Number(marriageEvent.incomeGrowthRate !== undefined ? marriageEvent.incomeGrowthRate : marriageEvent.growthRate) || 0);
        if (spouseIncomeGrowthRate > 0.5) spouseIncomeGrowthRate /= 100;

        spouseSavingsRate = spouseMember ? (Number(spouseMember.savingsRate) || 0) : (Number(marriageEvent.savingsRate) || 0);
        spouseCash = spouseMember?.assets ? (Number(spouseMember.assets.cash) || 0) : (Number(marriageEvent.cash) || 0);
        spouseInvestments = spouseMember?.assets ? (Number(spouseMember.assets.investments) || 0) : (Number(marriageEvent.investments) || 0);
        spouseRetirement = spouseMember?.assets ? (Number(spouseMember.assets.retirement) || 0) : (Number(marriageEvent.retirement) || 0);

        if (marriageEvent.combinedSpendingAfterMarriage) {
          baseExpensesMonthly = Math.round(Number(marriageEvent.combinedSpendingAfterMarriage) / 12);
        } else {
          const spousePersonal = Math.round(spouseIncome * (1 - spouseSavingsRate / 100));
          const lifestyle = Number(marriageEvent.lifestyleAdjustment || 0);
          const housing = Number(marriageEvent.housingSavings || 0);
          baseExpensesMonthly = baseExpensesMonthly + spousePersonal + lifestyle + housing;
        }
      } else {
        spouseIncome = partnerSSMonthlyIncome;
      }
    }

    let defaultExpenses = {
      housing: Math.round(baseExpensesMonthly * 0.4),
      utilities: Math.round(baseExpensesMonthly * 0.1),
      food: Math.round(baseExpensesMonthly * 0.1),
      diningOut: Math.round(baseExpensesMonthly * 0.05),
      transportation: Math.round(baseExpensesMonthly * 0.1),
      healthcare: Math.round(baseExpensesMonthly * 0.08),
      leisure: Math.round(baseExpensesMonthly * 0.08),
      misc: Math.round(baseExpensesMonthly * 0.09)
    };
    const sumVal = Object.values(defaultExpenses).reduce((a, b) => a + b, 0);
    const diff = Math.round(baseExpensesMonthly) - sumVal;
    defaultExpenses.misc += diff;

    if (start < targetRetirementAge) {
      if (childCount > 0) {
        if (profile.budgetDetails?.childcareBudgets?.[childCount]?.expenses) {
          defaultExpenses = { ...profile.budgetDetails.childcareBudgets[childCount].expenses };
        } else if (profile.budgetDetails?.childcareExpenses) {
          defaultExpenses = { ...profile.budgetDetails.childcareExpenses };
        } else if (profile.budgetDetails?.expenses) {
          defaultExpenses = { ...profile.budgetDetails.expenses };
        }
      } else {
        if (profile.budgetDetails?.expenses) {
          defaultExpenses = { ...profile.budgetDetails.expenses };
        }
      }
    } else {
      let sourcePhase = [...phases].reverse().find(p => p.startAge < targetRetirementAge && p.childCount === childCount);
      if (!sourcePhase) {
        sourcePhase = [...phases].reverse().find(p => p.startAge < targetRetirementAge);
      }
      const sourceExpenses = sourcePhase ? sourcePhase.expenses : defaultExpenses;
      const retireEvent = enabledEvents.find(e => e.type === 'retire');
      const spendingPercent = retireEvent && retireEvent.spendingPercent !== undefined ? Number(retireEvent.spendingPercent) : 70;
      const scale = spendingPercent / 100;
      let retirementExpenses = {};
      Object.keys(sourceExpenses).forEach(key => {
        retirementExpenses[key] = Math.round((sourceExpenses[key] || 0) * scale);
      });
      defaultExpenses = retirementExpenses;
    }

    let defaultSavingsMonthly = 0;
    if (start < targetRetirementAge) {
      if (profile.preTaxSavingsRate) {
        defaultSavingsMonthly = Math.round(((defaultIncome * 12) * (Number(profile.preTaxSavingsRate) / 100)) / 12);
      } else {
        defaultSavingsMonthly = Math.max(0, Math.round(defaultIncome - baseExpensesMonthly));
      }
    }

    let defaultSavings = {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: defaultSavingsMonthly, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
    };
    if (start < targetRetirementAge) {
      if (childCount > 0) {
        if (profile.budgetDetails?.childcareBudgets?.[childCount]?.savings) {
          defaultSavings = { ...profile.budgetDetails.childcareBudgets[childCount].savings };
        } else if (profile.budgetDetails?.childcareSavings) {
          defaultSavings = { ...profile.budgetDetails.childcareSavings };
        } else if (profile.budgetDetails?.savings) {
          defaultSavings = { ...profile.budgetDetails.savings };
        }
      } else {
        if (profile.budgetDetails?.savings) {
          defaultSavings = { ...profile.budgetDetails.savings };
        }
      }
    }

    let defaultPartnerSavings = {
      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
    };
    if (isMarried && start < targetRetirementAge && !isPartnerRetiredInPhase) {
      const partnerPreTax = Math.round((spouseIncome * 12 * (spouseSavingsRate / 100)) / 12);
      const userTotalSavings = Object.values(defaultSavings).reduce((sum, v) => sum + (Number(v) || 0), 0);
      if (userTotalSavings > 0) {
        Object.keys(defaultSavings).forEach(key => {
          defaultPartnerSavings[key] = Math.round(partnerPreTax * ((Number(defaultSavings[key]) || 0) / userTotalSavings));
        });
        const partnerTotalSavings = Object.values(defaultPartnerSavings).reduce((sum, v) => sum + v, 0);
        const diff = partnerPreTax - partnerTotalSavings;
        if (diff !== 0) {
          let maxKey = 'brokerage';
          Object.keys(defaultPartnerSavings).forEach(key => {
            if (defaultPartnerSavings[key] > (defaultPartnerSavings[maxKey] || 0)) {
              maxKey = key;
            }
          });
          defaultPartnerSavings[maxKey] = Math.max(0, defaultPartnerSavings[maxKey] + diff);
        }
      } else {
        defaultPartnerSavings.brokerage = partnerPreTax;
      }
    }

    const savedPhase = budgetOverrides.find(p => p.id === id || (Number(p.startAge) === start && p.type === type));

    let resolvedIncome = defaultIncome;
    if (savedPhase && savedPhase.income !== undefined) {
      resolvedIncome = Number(savedPhase.income);
      if (childCount > 0 && childBoost > 0) {
        const standardBase = (start >= targetRetirementAge) ? ssMonthlyIncome : baseSalaryMonthly;
        if (resolvedIncome <= standardBase) {
          resolvedIncome += childBoost;
        }
      }
    }

    phases.push({
      id,
      name,
      icon,
      type,
      startAge: start,
      endAge: end,
      childCount,
      income: resolvedIncome,
      incomeGrowthRate: growthRate,
      ssMonthlyIncome,
      savingsAllocMode: savedPhase?.savingsAllocMode || profile.budgetDetails?.savingsAllocMode || 'fixed',
      savings: savedPhase?.savings ? { ...savedPhase.savings } : defaultSavings,
      partnerSavings: savedPhase?.partnerSavings ? { ...savedPhase.partnerSavings } : defaultPartnerSavings,
      expenses: savedPhase?.expenses ? { ...savedPhase.expenses } : defaultExpenses,
      isMarried,
      spouseIncome,
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
