// Default lifeProfile structure
export const defaultProfile = {
  household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
  home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
  children: [],
  debts: [],
  assets: { cash: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, crypto: 0, businessEquity: 0 },
  incomeSources: []
};

/**
 * Calculates sum of assets, debts, and debt payments for a profile
 */
export function getProfileTotals(profile) {
  const assets = profile?.assets || {};
  const debts = profile?.debts || [];
  const home = profile?.home || {};

  const totalAssetsSum = Object.values(assets).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const totalDebtsSum = debts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0) + 
                        (home.status === 'own' ? Number(home.mortgageBalance || 0) : 0);
  const totalDebtsMonthlyPayments = debts.reduce((sum, d) => sum + (Number(d.monthlyPayment) || 0), 0) + 
                                   (home.status === 'own' ? Number(home.monthlyPayment || 0) : 0);

  return {
    totalAssetsSum,
    totalDebtsSum,
    totalDebtsMonthlyPayments
  };
}

/**
 * Derives completion statuses for the life profile
 */
export function getProfileCompletion({
  profile,
  age,
  simpleIncome,
  targetRetirementAge,
  ssClaimingAge
}) {
  const household = profile?.household || {};
  const home = profile?.home || {};
  const { totalAssetsSum, totalDebtsSum } = getProfileTotals(profile);

  const isHouseholdCompleted = !!age && (household.status === 'single' || (Number(household.partnerIncome) > 0 || Number(household.partnerSavings) > 0));
  
  const isHomeCompleted = home.status === 'rent'
    ? Number(home.monthlyRent) > 0
    : Number(home.homeValue) > 0;

  const isFinancesCompleted = Number(simpleIncome) > 0 || totalAssetsSum > 0 || totalDebtsSum > 0;

  const isWorkCompleted = Number(targetRetirementAge) > 0 && Number(ssClaimingAge) > 0;

  return {
    isHouseholdCompleted,
    isHomeCompleted,
    isFinancesCompleted,
    isWorkCompleted
  };
}
