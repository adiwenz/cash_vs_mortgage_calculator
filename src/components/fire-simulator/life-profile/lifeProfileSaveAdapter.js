import { clampAgeValue } from '../helpers';

/**
 * Pure adapter mapping the local life profile draft state back to
 * scenario fields. Does not mutate any arguments.
 */
export function getSaveUpdates({
  profile,
  age,
  lifeExp,
  salary,
  retireAge,
  ssAge,
  bhEnabled,
  bhAge,
  bhPrice
}, inputs = {}) {
  // Safe deep clone of profile so we do not mutate inputs
  const profileData = JSON.parse(JSON.stringify(profile));

  const totalAssets = Object.values(profileData.assets).reduce((sum, v) => sum + (Number(v) || 0), 0);
  
  const clampedAge = clampAgeValue(age);
  const resolvedAge = clampedAge !== null ? clampedAge : 35;

  const originalEvents = inputs.lifeEvents || [];
  const updatedEvents = originalEvents.map(e => {
    if (e.type === 'socialSecurity') {
      return { ...e, claimingAge: Number(ssAge) };
    }
    if (e.type === 'buyHouse') {
      return { 
        ...e, 
        enabled: bhEnabled, 
        purchaseAge: Number(bhAge), 
        age: Number(bhAge), 
        homePrice: Number(bhPrice) 
      };
    }
    return e;
  });

  const hasBuyHouse = updatedEvents.some(e => e.type === 'buyHouse');
  if (!hasBuyHouse && bhEnabled) {
    updatedEvents.push({
      id: 'derived-buy-house',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy House',
      purchaseAge: Number(bhAge),
      age: Number(bhAge),
      homePrice: Number(bhPrice),
      downPayment: Math.round(Number(bhPrice) * 0.2),
      purchaseType: 'mortgage',
      mortgageRate: 6.5,
      loanTerm: 30,
      isDerived: true
    });
  }

  const legacyAssets = {
    cash: Number(profileData.assets.cash || 0),
    brokerage: Number(profileData.assets.brokerage || 0),
    trad401k: Number(profileData.assets.trad401k || 0),
    tradIra: Number(profileData.assets.tradIra || 0),
    rothIra: Number(profileData.assets.rothIra || 0),
    hsa: Number(profileData.assets.hsa || 0),
    other: Number(profileData.assets.crypto || 0) + Number(profileData.assets.businessEquity || 0)
  };

  return {
    lifeProfile: profileData,
    simpleInvestments: totalAssets,
    currentAge: resolvedAge,
    lifeExpectancy: Number(lifeExp) || 85,
    simpleIncome: Number(salary) || 50000,
    targetRetirementAge: Number(retireAge) || 65,
    lifeEvents: updatedEvents,
    assets: legacyAssets,
    useLifeProfile: true
  };
}
