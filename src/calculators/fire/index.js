import {
  U_S_TAX_DATA,
  calculateUSTax,
  getActiveChildrenCountAtAge
} from '../../simulatorMathUtils.js';

import {
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit,
  buildSocialSecurityEarningsRecord,
  calculateAIME,
  calculatePIA,
  calculateClaimingAgeMultiplier,
  calculateTop35AverageIncome,
  validateSocialSecurityClaimAge
} from './socialSecurity.js';

import {
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs
} from './normalizeInputs.js';

import {
  getPartitionedPhases,
  derivePhasesFromEvents,
  getNormalizedPhases
} from './phases.js';

import {
  projectYearlyBalances
} from './yearlySimulation.js';

import {
  calculateMinimumPortfolioForRetirement,
  computeRetirementResult
} from './retirementReadiness.js';

import {
  buildSimulationDebugSnapshot
} from './debug.js';

export {
  getActiveChildrenCountAtAge,
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit,
  buildSocialSecurityEarningsRecord,
  calculateAIME,
  calculatePIA,
  calculateClaimingAgeMultiplier,
  calculateTop35AverageIncome,
  validateSocialSecurityClaimAge,
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs,
  getPartitionedPhases,
  derivePhasesFromEvents,
  getNormalizedPhases,
  projectYearlyBalances,
  calculateMinimumPortfolioForRetirement,
  computeRetirementResult,
  buildSimulationDebugSnapshot
};

export function getSavingsPriority(key) {
  const priorities = {
    hsa: 1,
    trad401k: 2,
    tradIra: 3,
    rothIra: 4,
    brokerage: 5,
    checking: 6,
    hysa: 7,
    emergency: 8,
    debt: 9,
    other: 10
  };
  return priorities[key] || 99;
}

export function runFireSimulation(inputs) {
  const currentAge = Math.max(0, Number(inputs.currentAge) || 30);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const lifeEvents = inputs.lifeEvents || [];
  const enabledEvents = lifeEvents.filter(e => e.enabled);
  const retireEvent = enabledEvents.find(e => e.type === 'retire');
  const targetRetirementAge = retireEvent 
    ? Math.max(currentAge, Number(retireEvent.age) || 65) 
    : lifeExpectancy;
    
  const expectedReturn = (Number(inputs.expectedReturn) || 7) / 100;
  const postRetirementReturn = inputs.postRetirementReturn !== undefined
    ? (Number(inputs.postRetirementReturn) || 0) / 100
    : expectedReturn;
  const inflationRate = (Number(inputs.inflationRate) || 3) / 100;
  const swr = (Number(inputs.swr) || 4) / 100;

  const includeTaxes = !!inputs.includeTaxes;
  let filingStatus = inputs.filingStatus || 'single';
  if (filingStatus === 'jointly' || filingStatus === 'marriedJointly') {
    filingStatus = 'married';
  }

  const ssEvent = enabledEvents.find(e => e.type === 'socialSecurity');
  let socialSecurityDetails = {
    claimAge: 67,
    workingYears: 0,
    isEligible: false,
    indexedEarningsHistory: [],
    top35AnnualEarnings: 0,
    averageTop35AnnualIncome: 0,
    aimeMonthly: 0,
    piaMonthly: 0,
    claimingAgeMultiplier: 0,
    monthlyBenefit: 0,
    annualBenefit: 0,
    adjustmentType: 'Not eligible'
  };

  if (ssEvent) {
    const claimAge = Number(ssEvent.claimingAge !== undefined ? ssEvent.claimingAge : (ssEvent.startAge !== undefined ? ssEvent.startAge : ssEvent.age)) || 67;
    if (claimAge < 62) {
      socialSecurityDetails = {
        claimAge,
        workingYears: (getIncomeHistory(inputs, ssEvent) || []).filter(v => Number(v) > 0).length,
        isEligible: false,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: 0,
        claimingAgeMultiplier: 0,
        monthlyBenefit: 0,
        annualBenefit: 0,
        adjustmentType: 'Not eligible'
      };
    } else if (ssEvent.useEarnings) {
      const incomeHistory = getIncomeHistory(inputs, ssEvent);
      socialSecurityDetails = calculateSocialSecurityBenefit({
        incomeHistory,
        claimAge,
        fullRetirementAge: 67,
        firstBendPoint: ssEvent.firstBendPoint !== undefined ? Number(ssEvent.firstBendPoint) : 1286,
        secondBendPoint: ssEvent.secondBendPoint !== undefined ? Number(ssEvent.secondBendPoint) : 7749
      });
    } else {
      const monthlyBenefitBase = Number(ssEvent.monthlyBenefit) || 0;
      const multRes = calculateClaimingAgeMultiplier({
        claimAge,
        fullRetirementAge: 67
      });
      const monthlyBenefit = monthlyBenefitBase * multRes.multiplier;
      socialSecurityDetails = {
        claimAge,
        workingYears: (getIncomeHistory(inputs, ssEvent) || []).filter(v => Number(v) > 0).length,
        isEligible: true,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: monthlyBenefitBase,
        claimingAgeMultiplier: multRes.multiplier,
        monthlyBenefit,
        annualBenefit: monthlyBenefit * 12,
        adjustmentType: multRes.adjustmentType
      };
    }
  }

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

  const marriageEvent = enabledEvents.find(e => e.type === 'marriage');
  const spouseMember = (inputs.householdMembers || []).find(m => m.id === 'spouse');
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
  
  let spouseSocialSecurityDetails = null;
  const isSpouseEnabled = hasMarriage;
  if (isSpouseEnabled && spouseMember) {
    const spouseClaimAge = Number(spouseMember.spouseSocialSecurityAge !== undefined ? spouseMember.spouseSocialSecurityAge : 67);
    if (spouseMember.spouseEstimatedSocialSecurityBenefit !== undefined && spouseMember.spouseEstimatedSocialSecurityBenefit !== null && spouseMember.spouseEstimatedSocialSecurityBenefit !== '' && Number(spouseMember.spouseEstimatedSocialSecurityBenefit) > 0) {
      const baseBenefit = Number(spouseMember.spouseEstimatedSocialSecurityBenefit);
      const factor = getSocialSecurityFactor(spouseClaimAge);
      spouseSocialSecurityDetails = {
        claimAge: spouseClaimAge,
        annualBenefit: baseBenefit * factor * 12,
        monthlyBenefit: baseBenefit * factor
      };
    } else if (spouseMember.income > 0) {
      const spouseRetAge = spouseMember.desiredRetirementAge !== undefined && spouseMember.desiredRetirementAge !== null && spouseMember.desiredRetirementAge !== ''
        ? Number(spouseMember.desiredRetirementAge)
        : (targetRetirementAge + (spouseMember.currentAge !== undefined ? spouseMember.currentAge : spouseCurrentAge) - currentAge);
      const spouseWorkYears = Math.max(0, spouseRetAge - 22);
      const spouseIncomeHistory = new Array(spouseWorkYears).fill(Number(spouseMember.income) || 0);
      spouseSocialSecurityDetails = calculateSocialSecurityBenefit({
        incomeHistory: spouseIncomeHistory,
        claimAge: spouseClaimAge
      });
    }
  }

  const maxLifeExpectancy = hasMarriage ? Math.max(lifeExpectancy, userAgeWhenSpouseDies) : lifeExpectancy;

  const hasActiveChild = enabledEvents.some(e => e.type === 'haveChild');
  let incomeList = inputs.incomeList || [];
  let spendingPhases = inputs.spendingPhases || [];

  if (hasActiveChild) {
    const incomeSegments = getPartitionedPhases(currentAge, targetRetirementAge, enabledEvents);
    const spendingSegments = getPartitionedPhases(currentAge, maxLifeExpectancy, enabledEvents);

    const hasChildcarePhase = incomeSegments.some(seg => seg.type === 'childcare') || spendingSegments.some(seg => seg.type === 'childcare');

    if (hasChildcarePhase) {
      const existingAutoIncomes = incomeList.filter(inc => 
        inc.id.startsWith('simple-inc-prechild') ||
        inc.id.startsWith('simple-inc-childcare') ||
        inc.id.startsWith('simple-inc-worksave')
      );
      const needsIncomeRegen = existingAutoIncomes.length !== incomeSegments.length ||
        incomeSegments.some(seg => {
          const expectedId = seg.type === 'childcare' 
            ? `simple-inc-childcare-${seg.startAge}-${seg.endAge}`
            : (seg.startAge === currentAge ? `simple-inc-prechild-${seg.startAge}-${seg.endAge}` : `simple-inc-worksave-${seg.startAge}-${seg.endAge}`);
          const match = existingAutoIncomes.find(inc => inc.id === expectedId);
          return !match || match.startAge !== seg.startAge || match.endAge !== seg.endAge;
        });

      const existingAutoSpending = spendingPhases.filter(p => 
        p.id.startsWith('simple-spend-prechild') ||
        p.id.startsWith('simple-spend-childcare') ||
        p.id.startsWith('simple-spend-worksave')
      );
      const needsSpendingRegen = existingAutoSpending.length !== spendingSegments.length ||
        spendingSegments.some(seg => {
          const expectedId = seg.type === 'childcare'
            ? `simple-spend-childcare-${seg.startAge}-${seg.endAge}`
            : (seg.startAge === currentAge ? `simple-spend-prechild-${seg.startAge}-${seg.endAge}` : `simple-spend-worksave-${seg.startAge}-${seg.endAge}`);
          const match = existingAutoSpending.find(p => p.id === expectedId);
          return !match || match.startAge !== seg.startAge || match.endAge !== seg.endAge;
        });

      const needsRegen = needsIncomeRegen || needsSpendingRegen;

      if (needsRegen) {
        const cleanIncomeList = incomeList.filter(inc => 
          inc.id !== 'inc-1' && 
          inc.id !== 'simple-inc' && 
          !inc.id.startsWith('simple-inc-prechild') &&
          !inc.id.startsWith('simple-inc-childcare') && 
          !inc.id.startsWith('simple-inc-worksave')
        );
        const wsIncomeAnnual = (Number(inputs.budgetDetails?.income) || (Number(inputs.simpleIncome) / 12) || 4167) * 12;
        const finalChildcareBudgets = inputs.budgetDetails?.childcareBudgets || {};
        
        incomeSegments.forEach(seg => {
          if (seg.type === 'childcare') {
            const C = getActiveChildrenCountAtAge(seg.startAge, enabledEvents);
            let childcareIncome = inputs.budgetDetails?.childcareIncome;
            if (finalChildcareBudgets[C]) {
              childcareIncome = finalChildcareBudgets[C].income;
            } else if (Object.keys(finalChildcareBudgets).length > 0) {
              const minC = Math.min(...Object.keys(finalChildcareBudgets).map(Number));
              childcareIncome = finalChildcareBudgets[minC].income;
            }
            const ccIncomeAnnual = (Number(childcareIncome) || (wsIncomeAnnual / 12)) * 12;

            const existingChildcareInc = incomeList.find(inc => 
              inc.id === 'simple-inc-childcare' || inc.id.startsWith('simple-inc-childcare-')
            );
            const growthRate = existingChildcareInc && existingChildcareInc.growthRate !== undefined 
              ? existingChildcareInc.growthRate 
              : 0.03;

            cleanIncomeList.push({
              id: `simple-inc-childcare-${seg.startAge}-${seg.endAge}`,
              name: 'Salary / Main Income (Childcare Phase)',
              amount: ccIncomeAnnual,
              frequency: 'yearly',
              startAge: seg.startAge,
              endAge: seg.endAge,
              growthRate: growthRate,
              isTaxable: true
            });
          } else {
            const expectedId = seg.startAge === currentAge
              ? `simple-inc-prechild-${seg.startAge}-${seg.endAge}`
              : `simple-inc-worksave-${seg.startAge}-${seg.endAge}`;

            const existingStandardInc = incomeList.find(inc => 
              inc.id === 'simple-inc-worksave' || inc.id.startsWith('simple-inc-worksave-') ||
              inc.id === 'simple-inc-prechild' || inc.id.startsWith('simple-inc-prechild-') ||
              inc.id === 'simple-inc' || inc.id === 'inc-1'
            );
            const growthRate = existingStandardInc && existingStandardInc.growthRate !== undefined
              ? existingStandardInc.growthRate
              : 0.03;

            cleanIncomeList.push({
              id: expectedId,
              name: 'Salary / Main Income (Standard Work Phase)',
              amount: wsIncomeAnnual,
              frequency: 'yearly',
              startAge: seg.startAge,
              endAge: seg.endAge,
              growthRate: growthRate,
              isTaxable: true
            });
          }
        });
        incomeList = cleanIncomeList;

        const cleanSpendingPhases = spendingPhases.filter(p => 
          p.id !== 'spend-1' && 
          p.id !== 'simple-spend' && 
          !p.id.startsWith('simple-spend-prechild') &&
          !p.id.startsWith('simple-spend-childcare') && 
          !p.id.startsWith('simple-spend-worksave')
        );
        const wsExpensesAnnual = (Number(inputs.budgetDetails?.expenses ? Object.values(inputs.budgetDetails.expenses).reduce((sum, val) => sum + val, 0) : 0) || (Number(inputs.simpleExpenses) / 12) || 3542) * 12;

        spendingSegments.forEach(seg => {
          if (seg.type === 'childcare') {
            const C = getActiveChildrenCountAtAge(seg.startAge, enabledEvents);
            let childcareExpensesVal = inputs.budgetDetails?.childcareExpenses;
            if (finalChildcareBudgets[C]) {
              childcareExpensesVal = finalChildcareBudgets[C].expenses;
            } else if (Object.keys(finalChildcareBudgets).length > 0) {
              const minC = Math.min(...Object.keys(finalChildcareBudgets).map(Number));
              childcareExpensesVal = finalChildcareBudgets[minC].expenses;
            }
            const ccExpensesAnnual = childcareExpensesVal
              ? Object.values(childcareExpensesVal).reduce((sum, val) => sum + val, 0) * 12
              : wsExpensesAnnual;

            cleanSpendingPhases.push({
              id: `simple-spend-childcare-${seg.startAge}-${seg.endAge}`,
              name: 'Lifestyle Spending (Childcare Phase)',
              amount: ccExpensesAnnual,
              frequency: 'yearly',
              startAge: seg.startAge,
              endAge: seg.endAge,
              annualSpending: ccExpensesAnnual
            });
          } else {
            const expectedId = seg.startAge === currentAge
              ? `simple-spend-prechild-${seg.startAge}-${seg.endAge}`
              : `simple-spend-worksave-${seg.startAge}-${seg.endAge}`;
            cleanSpendingPhases.push({
              id: expectedId,
              name: 'Lifestyle Spending (Standard Work Phase)',
              amount: wsExpensesAnnual,
              frequency: 'yearly',
              startAge: seg.startAge,
              endAge: seg.endAge,
              annualSpending: wsExpensesAnnual
            });
          }
        });
        spendingPhases = cleanSpendingPhases;
      }
    }
  }

  const isAdvanced = inputs.isAdvancedMode === true || (inputs.allocationRules && inputs.allocationRules.length > 1);
  if (!isAdvanced) {
    const incomeSegments = hasActiveChild ? getPartitionedPhases(currentAge, targetRetirementAge, enabledEvents) : [];
    incomeList = incomeList.map(inc => {
      if (inc.id === 'inc-1' || inc.id.startsWith('simple-inc-worksave') || inc.id.startsWith('simple-inc-prechild') || inc.name.toLowerCase().includes('salary') || inc.name.toLowerCase().includes('main')) {
        if (!inc.id.includes('childcare') && !inc.name.toLowerCase().includes('childcare')) {
          const isGapPhase = inc.id.startsWith('simple-inc-worksave') && 
            incomeSegments.some(seg => seg.type === 'standard' && seg.endAge < targetRetirementAge && inc.id === `simple-inc-worksave-${seg.startAge}-${seg.endAge}`);
          const end = (inc.id.startsWith('simple-inc-prechild') || isGapPhase) ? inc.endAge : targetRetirementAge;
          return { ...inc, amount: Number(inputs.simpleIncome) || inc.amount, endAge: end };
        }
      }
      return inc;
    });
  }
  if (!hasActiveChild) {
    incomeList = incomeList
      .filter(inc => !inc.id.startsWith('simple-inc-childcare') && !inc.id.startsWith('simple-inc-prechild'))
      .map(inc => {
        if (inc.id.startsWith('simple-inc-worksave')) {
          return { ...inc, startAge: currentAge };
        }
        return inc;
      });
  }
  if (!isAdvanced) {
    spendingPhases = spendingPhases.map(p => {
      if (p.id === 'spend-1' || p.id.startsWith('simple-spend-worksave') || p.id.startsWith('simple-spend-prechild') || p.name.toLowerCase().includes('spending') || p.name.toLowerCase().includes('lifestyle')) {
        if (!p.id.includes('childcare') && !p.name.toLowerCase().includes('childcare')) {
          const amt = Number(inputs.simpleExpenses) || p.amount;
          return { ...p, amount: amt, annualSpending: amt };
        }
      }
      return p;
    });
  }
  if (!hasActiveChild) {
    spendingPhases = spendingPhases
      .filter(p => !p.id.startsWith('simple-spend-childcare') && !p.id.startsWith('simple-spend-prechild'))
      .map(p => {
        if (p.id.startsWith('simple-spend-worksave')) {
          return { ...p, startAge: currentAge };
        }
        return p;
      });
  }

  const events = getEventsFromInputs(inputs);
  const profile = getProfileFromInputs({
    ...inputs,
    incomeList,
    spendingPhases
  });

  profile.socialSecurityDetails = socialSecurityDetails;
  profile.spouseSocialSecurityDetails = spouseSocialSecurityDetails;
  profile.year0Taxes = year0Taxes;
  profile.spendingPhases = spendingPhases;
  profile.incomeList = incomeList;

  const phases = derivePhasesFromEvents(profile, events, inputs.budgetDetails?.phases || []);

  const plannedProjection = projectYearlyBalances(profile, phases, events, targetRetirementAge);

  // Temporary console assertion block comparing budget vs simulation allocations
  const currentAgeVal = Math.max(0, Number(inputs.currentAge) || 30);
  const activePhase = phases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge);
  if (activePhase && activePhase.savings) {
    const firstYearLog = plannedProjection.logs[0] || {};
    const actualContribs = firstYearLog.actualContributions || {};
    const budgetAllocKeys = ['trad401k', 'tradIra', 'rothIra', 'hsa', 'brokerage', 'checking', 'hysa', 'emergency', 'other', 'debt'];
    
    let budgetTotal = 0;
    let simTotal = 0;
    
    const budgetMap = {};
    const simMap = {};
    
    budgetAllocKeys.forEach(k => {
      const bVal = ((Number(activePhase.savings[k]) || 0) + (Number(activePhase.partnerSavings?.[k]) || 0)) * 12;
      const sVal = Number(actualContribs[k]) || 0;
      budgetTotal += bVal;
      simTotal += sVal;
      budgetMap[k] = bVal;
      simMap[k] = sVal;
    });

    console.table({
      budget: budgetMap,
      simulation: simMap
    });

    // Check for mismatch (allowing leftover surplus in brokerage and debt paydown caps)
    let mismatch = false;
    const activeDebtBalanceEnd = firstYearLog.debtBalance ?? 0;
    budgetAllocKeys.forEach(k => {
      const bVal = budgetMap[k];
      const sVal = simMap[k];
      if (k === 'brokerage') {
        if (sVal < bVal - 0.01) {
          mismatch = true;
        }
      } else if (k === 'debt') {
        if (Math.abs(bVal - sVal) > 0.01) {
          if (sVal > bVal + 0.01 || activeDebtBalanceEnd > 0) {
            mismatch = true;
          }
        }
      } else {
        if (Math.abs(bVal - sVal) > 0.01) {
          mismatch = true;
        }
      }
    });

    // Only throw if there was enough surplus (no constraints forced actual to be lower)
    const annualIncomeVal = firstYearLog.income || 0;
    const taxesVal = firstYearLog.taxes || 0;
    const expensesVal = firstYearLog.expenses || 0;
    const budgetTotalPreTax = ['trad401k', 'tradIra', 'hsa'].reduce((sum, k) => sum + ((Number(activePhase.savings[k]) || 0) + (Number(activePhase.partnerSavings?.[k]) || 0)) * 12, 0);
    const budgetTotalPostTax = ['rothIra', 'brokerage', 'checking', 'hysa', 'emergency', 'other', 'debt'].reduce((sum, k) => sum + ((Number(activePhase.savings[k]) || 0) + (Number(activePhase.partnerSavings?.[k]) || 0)) * 12, 0);
    const grossSurplusVal = annualIncomeVal - expensesVal;
    const netSurplusVal = grossSurplusVal - taxesVal - budgetTotalPreTax;

    if (mismatch && grossSurplusVal >= budgetTotalPreTax && netSurplusVal >= budgetTotalPostTax) {
      throw new Error("Budget allocations do not match simulation allocations!");
    }
  }

  const result = computeRetirementResult(profile, phases, events, plannedProjection);

  result.incomeList = incomeList;
  result.spendingPhases = spendingPhases;

  return result;
}
