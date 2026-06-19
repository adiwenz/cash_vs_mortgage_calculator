import { U_S_TAX_DATA, calculateUSTax } from '../../../simulatorMathUtils.js';
import {
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit,
  calculateClaimingAgeMultiplier
} from '../socialSecurity.js';

export function deriveTimelineStage(normalizedInputs) {
  const currentAge = normalizedInputs.currentAge;
  const lifeEvents = normalizedInputs.lifeEvents || [];
  const enabledEvents = lifeEvents.filter(e => e.enabled);
  const targetRetirementAge = normalizedInputs.targetRetirementAge;

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
        workingYears: (getIncomeHistory(normalizedInputs, ssEvent) || []).filter(v => Number(v) > 0).length,
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
      const incomeHistory = getIncomeHistory(normalizedInputs, ssEvent);
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
        workingYears: (getIncomeHistory(normalizedInputs, ssEvent) || []).filter(v => Number(v) > 0).length,
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

  // Calculate year0Taxes
  let year0Taxes = 0;
  if (normalizedInputs.includeTaxes) {
    const simpleIncome = Number(normalizedInputs.simpleIncome) || 50000;
    const simpleExpenses = Number(normalizedInputs.simpleExpenses) || 42500;
    const rate = simpleIncome > 0 ? ((simpleIncome - simpleExpenses) / simpleIncome) : 0.15;
    const preTaxSavings = simpleIncome * rate;
    const taxableIncome0 = Math.max(0, simpleIncome - preTaxSavings);
    
    const taxConfig = U_S_TAX_DATA[normalizedInputs.filingStatus] || U_S_TAX_DATA.single;
    const stdDeduction0 = taxConfig.standardDeduction;
    const brackets0 = taxConfig.brackets;
    year0Taxes = calculateUSTax(taxableIncome0, stdDeduction0, brackets0);
  }

  // Calculate spouseSocialSecurityDetails
  const marriageEvent = enabledEvents.find(e => e.type === 'marriage');
  const spouseMember = (normalizedInputs.householdMembers || []).find(m => m.id === 'spouse');
  const hasMarriage = !!marriageEvent;

  const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
    ? Number(spouseMember.currentAge)
    : (marriageEvent && marriageEvent.spouseCurrentAge !== undefined ? Number(marriageEvent.spouseCurrentAge) : currentAge);

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

  return {
    socialSecurityDetails,
    spouseSocialSecurityDetails,
    year0Taxes,
    maxLifeExpectancy: normalizedInputs.maxLifeExpectancy
  };
}
