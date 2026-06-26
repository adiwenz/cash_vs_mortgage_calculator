import { getActiveChildrenCountAtAge } from '../../../simulatorMathUtils.js';
import { getPartitionedPhases } from '../phases.js';
import { normalizeSocialSecurityEvent } from '../socialSecurity.js';
import { normalizeHouseholdModel } from '../../../models/household/index.js';
import { hasExplicitAllocationRules } from '../simulation/resolveSavingsRoutingSource.js';

function translateSavingsKeys(savingsObj) {
  if (!savingsObj) return savingsObj;
  const translated = { ...savingsObj };
  if (translated.cash !== undefined) {
    translated.checking = (translated.checking || 0) + translated.cash;
    delete translated.cash;
  }
  if (translated.emergencyFund !== undefined) {
    translated.emergency = (translated.emergency || 0) + translated.emergencyFund;
    delete translated.emergencyFund;
  }
  return translated;
}

function translateBudgetSavingsKeys(budgetDetails) {
  if (!budgetDetails) return budgetDetails;
  const cloned = { ...budgetDetails };
  if (cloned.savings) {
    cloned.savings = translateSavingsKeys(cloned.savings);
  }
  if (cloned.partnerSavings) {
    cloned.partnerSavings = translateSavingsKeys(cloned.partnerSavings);
  }
  if (Array.isArray(cloned.phases)) {
    cloned.phases = cloned.phases.map(phase => {
      const clonedPhase = { ...phase };
      if (clonedPhase.savings) {
        clonedPhase.savings = translateSavingsKeys(clonedPhase.savings);
      }
      if (clonedPhase.partnerSavings) {
        clonedPhase.partnerSavings = translateSavingsKeys(clonedPhase.partnerSavings);
      }
      return clonedPhase;
    });
  }
  return cloned;
}

export function normalizeInputsStage(rawInputs) {
  const translatedBudgetDetails = translateBudgetSavingsKeys(rawInputs.budgetDetails);
  const inputs = {
    ...rawInputs,
    budgetDetails: translatedBudgetDetails
  };
  const currentAge = Math.max(0, Number(inputs.currentAge) || 30);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const lifeEvents = inputs.lifeEvents ? inputs.lifeEvents.map(e => {
    const cloned = e.type === 'socialSecurity' ? normalizeSocialSecurityEvent(e, inputs) : { ...e };
    if (cloned.growthRate !== undefined) {
      cloned.growthRate = Math.min(0.25, Math.max(0, Number(cloned.growthRate) || 0));
    }
    return cloned;
  }) : [];
  const enabledEvents = lifeEvents.filter(e => e.enabled);
  const retireEvent = enabledEvents.find(e => e.type === 'retire');
  const targetRetirementAge = retireEvent 
    ? Math.max(currentAge, Number(retireEvent.age) || 65) 
    : lifeExpectancy;
    
  const includeTaxes = !!inputs.includeTaxes;
  let filingStatus = inputs.filingStatus || 'single';
  if (filingStatus === 'jointly' || filingStatus === 'marriedJointly') {
    filingStatus = 'married';
  }

  // Derive spouse death/life ages to calculate maxLifeExpectancy for childcare phase spending
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
  const maxLifeExpectancy = hasMarriage ? Math.max(lifeExpectancy, userAgeWhenSpouseDies) : lifeExpectancy;

  const hasActiveChild = enabledEvents.some(e => e.type === 'haveChild');
  let incomeList = inputs.incomeList ? inputs.incomeList.map(inc => {
    const cloned = { ...inc };
    if (cloned.growthRate !== undefined) {
      cloned.growthRate = Math.min(0.25, Math.max(0, Number(cloned.growthRate) || 0));
    }
    return cloned;
  }) : [];
  let spendingPhases = inputs.spendingPhases ? inputs.spendingPhases.map(p => ({ ...p })) : [];

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

  const isAdvanced = inputs.isAdvancedMode === true || inputs.useLifeProfile === true || hasExplicitAllocationRules(inputs);
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
        if (!isAdvanced && (inc.id.startsWith('simple-inc-worksave') || inc.id === 'inc-1')) {
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
        if (!isAdvanced && (p.id.startsWith('simple-spend-worksave') || p.id === 'spend-1')) {
          return { ...p, startAge: currentAge };
        }
        return p;
      });
  }

  const socialSecurity = inputs.socialSecurity ? {
    ...inputs.socialSecurity,
    ageStartedWorking: Number(inputs.socialSecurity.ageStartedWorking ?? 22),
    claimingAge: Number(inputs.socialSecurity.claimingAge ?? inputs.socialSecurity.claimAge ?? 67)
  } : {
    claimingAge: 67,
    monthlyBenefit: 2000,
    inflationAdjusted: true,
    name: 'Social Security',
    ageStartedWorking: 22,
    enabled: true
  };

  const normalized = {
    ...inputs,
    currentAge,
    lifeExpectancy,
    includeTaxes,
    filingStatus,
    targetRetirementAge,
    maxLifeExpectancy,
    incomeList,
    spendingPhases,
    lifeEvents,
    socialSecurity
  };

  normalized.householdModel = normalizeHouseholdModel(normalized);

  return normalized;
}
