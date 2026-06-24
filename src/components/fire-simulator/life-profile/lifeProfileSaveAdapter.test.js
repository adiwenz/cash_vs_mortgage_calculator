import { describe, it, expect } from 'vitest';
import { getSaveUpdates } from './lifeProfileSaveAdapter';

describe('lifeProfileSaveAdapter', () => {
  const sampleProfile = {
    household: { status: 'married', partnerIncome: 60000, partnerSavings: 10000, partnerRetirement: 20000, partnerDebts: 5000 },
    home: { status: 'own', monthlyRent: 0, homeValue: 350000, mortgageBalance: 200000, monthlyPayment: 1500, propertyTaxes: 3000, insurance: 800, hoa: 100 },
    children: [{ id: 'child-1', name: 'Alice', age: 5, includeCollege: true }],
    debts: [{ id: 'debt-1', name: 'Car Loan', balance: 15000, interestRate: 4.5, monthlyPayment: 350 }],
    assets: { cash: 10000, brokerage: 50000, trad401k: 30000, tradIra: 0, rothIra: 15000, hsa: 5000, crypto: 2000, businessEquity: 0 },
    incomeSources: []
  };

  const sampleInputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    simpleIncome: 80000,
    targetRetirementAge: 65,
    lifeEvents: [
      { id: 'ss-ev', type: 'socialSecurity', claimingAge: 67 },
      { id: 'bh-ev', type: 'buyHouse', enabled: false }
    ],
    assets: {}
  };

  it('saves current age correctly', () => {
    const updates = getSaveUpdates({
      profile: sampleProfile,
      age: 38,
      lifeExp: 85,
      salary: 80000,
      retireAge: 65,
      ssAge: 67,
      bhEnabled: false,
      bhAge: 40,
      bhPrice: 300000
    }, sampleInputs);

    expect(updates.currentAge).toBe(38);
  });

  it('saves relationship status correctly', () => {
    const updates = getSaveUpdates({
      profile: sampleProfile,
      age: 35,
      lifeExp: 85,
      salary: 80000,
      retireAge: 65,
      ssAge: 67,
      bhEnabled: false,
      bhAge: 40,
      bhPrice: 300000
    }, sampleInputs);

    expect(updates.lifeProfile.household.status).toBe('married');
  });

  it('saves housing status correctly', () => {
    const updates = getSaveUpdates({
      profile: sampleProfile,
      age: 35,
      lifeExp: 85,
      salary: 80000,
      retireAge: 65,
      ssAge: 67,
      bhEnabled: false,
      bhAge: 40,
      bhPrice: 300000
    }, sampleInputs);

    expect(updates.lifeProfile.home.status).toBe('own');
    expect(updates.lifeProfile.home.homeValue).toBe(350000);
  });

  it('saves house assets correctly', () => {
    const updates = getSaveUpdates({
      profile: sampleProfile,
      age: 35,
      lifeExp: 85,
      salary: 80000,
      retireAge: 65,
      ssAge: 67,
      bhEnabled: true,
      bhAge: 42,
      bhPrice: 400000
    }, sampleInputs);

    // Should update buyHouse event
    const buyHouseEvent = updates.lifeEvents.find(e => e.type === 'buyHouse');
    expect(buyHouseEvent).toBeDefined();
    expect(buyHouseEvent.enabled).toBe(true);
    expect(buyHouseEvent.purchaseAge).toBe(42);
    expect(buyHouseEvent.homePrice).toBe(400000);
  });

  it('does not mutate original inputs', () => {
    const inputsCopy = JSON.parse(JSON.stringify(sampleInputs));
    getSaveUpdates({
      profile: sampleProfile,
      age: 38,
      lifeExp: 90,
      salary: 95000,
      retireAge: 62,
      ssAge: 70,
      bhEnabled: true,
      bhAge: 45,
      bhPrice: 500000
    }, sampleInputs);

    expect(sampleInputs).toEqual(inputsCopy);
  });
});
