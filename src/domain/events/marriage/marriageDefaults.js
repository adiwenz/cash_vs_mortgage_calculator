export function generateDefaultPartnerProfile(inputs, isMobile = false) {
  const curAge = inputs.currentAge || 35;
  const userIncome = Number(inputs.simpleIncome) || 50000;
  const userSavingsRate = Number(inputs.preTaxSavingsRate) || 15;
  
  const userAssets = (Number(inputs.assets?.cash) || 0) +
                     (Number(inputs.assets?.brokerage) || 0) +
                     (Number(inputs.assets?.trad401k) || 0) +
                     (Number(inputs.assets?.tradIra) || 0) +
                     (Number(inputs.assets?.rothIra) || 0) +
                     (Number(inputs.assets?.hsa) || 0) +
                     (Number(inputs.assets?.other) || 0);

  const userDebt = (Number(inputs.assets?.debts) || 0) +
                   (inputs.debtList || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);

  return {
    spouseIncome: userIncome,
    incomeGrowthRate: 3,
    cash: 0,
    investments: isMobile ? 0 : userAssets,
    retirement: 0,
    debtStudent: 0,
    debtCredit: 0,
    debtOther: isMobile ? 0 : userDebt,
    savingsRate: userSavingsRate,
    spouseCurrentAge: curAge,
    spouseLifeExpectancy: inputs.lifeExpectancy || 85,
    spouseSocialSecurityAge: 67,
    spouseEstimatedSocialSecurityBenefit: 0,
    spouseDesiredRetirementAge: '',
    retirementSpendingNeed: '',
    partnerRetiresWithUser: true
  };
}
