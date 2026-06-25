import { describe, test, expect } from 'vitest';
import { buildEffectiveSimulationInputs } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('buildEffectiveSimulationInputs runtime derivation', () => {
  test('maps liquid starting assets to simpleInvestments and assets object', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        assets: {
          cash: 10000,
          brokerage: 20000,
          trad401k: 30000,
          tradIra: 5000,
          rothIra: 15000,
          hsa: 4000,
          crypto: 2000,
          businessEquity: 10000
        }
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    // simpleInvestments should be sum of all liquid assets:
    // 10k + 20k + 30k + 5k + 15k + 4k + 2k + 10k = 96,000
    expect(effective.simpleInvestments).toBe(96000);
    expect(effective.assets.cash).toBe(10000);
    expect(effective.assets.brokerage).toBe(20000);
    expect(effective.assets.trad401k).toBe(30000);
    expect(effective.assets.tradIra).toBe(5000);
    expect(effective.assets.rothIra).toBe(15000);
    expect(effective.assets.hsa).toBe(4000);
    expect(effective.assets.other).toBe(12000); // crypto (2k) + businessEquity (10k)
  });

  test('maps Married relationship status to MFJ and adds spouse household member + derived marriage event', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        household: {
          status: 'married',
          partnerIncome: 75000,
          partnerSavings: 15000,
          partnerRetirement: 25000,
          partnerDebts: 5000
        }
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    expect(effective.filingStatus).toBe('married');
    
    // Spouse member added to householdMembers
    const spouse = effective.householdMembers.find(m => m.id === 'spouse');
    expect(spouse).toBeDefined();
    expect(spouse.income).toBe(75000);
    expect(spouse.assets.investments).toBe(15000);
    expect(spouse.assets.retirement).toBe(25000);
    expect(spouse.debts.other).toBe(5000);

    // Derived marriage event added to lifeEvents today
    const marriageEvent = effective.lifeEvents.find(e => e.type === 'marriage');
    expect(marriageEvent).toBeDefined();
    expect(marriageEvent.id).toBe('derived-marriage');
    expect(marriageEvent.age).toBe(35);
    expect(marriageEvent.spouseIncome).toBe(75000);
    expect(marriageEvent.isDerived).toBe(true);
  });

  test('maps spouse demographics (age, life expectancy) from lifeProfile.household to derived events and householdMembers', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        household: {
          status: 'married',
          partnerIncome: 75000,
          partnerSavings: 15000,
          partnerRetirement: 25000,
          partnerDebts: 5000,
          partnerAge: 38,
          partnerLifeExpectancy: 88
        }
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    const spouse = effective.householdMembers.find(m => m.id === 'spouse');
    expect(spouse).toBeDefined();
    expect(spouse.currentAge).toBe(38);
    expect(spouse.lifeExpectancy).toBe(88);

    const marriageEvent = effective.lifeEvents.find(e => e.type === 'marriage');
    expect(marriageEvent).toBeDefined();
    expect(marriageEvent.spouseCurrentAge).toBe(38);
    expect(marriageEvent.spouseLifeExpectancy).toBe(88);
  });

  test('roundtrips spouse demographics through lifePlan serialization and derivation', () => {
    const { deriveLegacyInputsFromLifePlan } = require('./src/models/lifePlan/lifePlanNormalization.js');
    const lifePlan = {
      currentAge: 35,
      lifeExpectancy: 85,
      objects: [
        {
          id: 'self-person',
          type: 'person',
          name: 'You',
          startAge: 35,
          endAge: 85,
          properties: { role: 'self' }
        },
        {
          id: 'spouse-partner',
          type: 'person',
          name: 'Partner',
          startAge: 35,
          endAge: 85,
          properties: {
            role: 'partner',
            spouseCurrentAge: 38,
            spouseLifeExpectancy: 88,
            partnerIncome: 75000,
            status: 'married'
          }
        }
      ],
      events: []
    };

    const derived = deriveLegacyInputsFromLifePlan(lifePlan);
    expect(derived.lifeProfile.household.partnerAge).toBe(38);
    expect(derived.lifeProfile.household.partnerLifeExpectancy).toBe(88);

    const marriageEvent = derived.lifeEvents.find(e => e.type === 'marriage');
    expect(marriageEvent).toBeDefined();
    expect(marriageEvent.spouseCurrentAge).toBe(38);
    expect(marriageEvent.spouseLifeExpectancy).toBe(88);
  });

  test('maps Home Owning status: updates realEstate asset, adds mortgage debt, and sets non-mortgage housing budget expenses', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        home: {
          status: 'own',
          homeValue: 400000,
          mortgageBalance: 300000,
          monthlyPayment: 1800,
          propertyTaxes: 4800, // 400/mo
          insurance: 1200,      // 100/mo
          hoa: 150             // 150/mo
        }
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    // realEstate asset updated to home value
    expect(effective.assets.realEstate).toBe(400000);

    // Mortgage added to debtList
    const mortgage = effective.debtList.find(d => d.id === 'derived-mortgage');
    expect(mortgage).toBeDefined();
    expect(mortgage.balance).toBe(300000);
    expect(mortgage.payment).toBe(1800);
    expect(mortgage.isDerived).toBe(true);

    // non-mortgage housing cost set to budget: 400 (tax) + 100 (ins) + 150 (hoa) = 650/mo
    expect(effective.budgetDetails.expenses.housing).toBe(650);
  });

  test('maps Renting status: sets rent as budget housing expense and does not add mortgage debt', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        home: {
          status: 'rent',
          monthlyRent: 1650
        }
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    expect(effective.debtList.some(d => d.id === 'derived-mortgage')).toBe(false);
    expect(effective.budgetDetails.expenses.housing).toBe(1650);
  });

  test('maps active children to virtual derived haveChild events', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        children: [
          { id: 'child-1', name: 'Alice', age: 4, includeCollege: true },
          { id: 'child-2', name: 'Bob', age: 10, includeCollege: false }
        ]
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    const child1Event = effective.lifeEvents.find(e => e.id === 'child-1');
    expect(child1Event).toBeDefined();
    expect(child1Event.type).toBe('haveChild');
    expect(child1Event.birthAge).toBe(31); // 35 today - 4 yrs old
    expect(child1Event.includeCollege).toBe(true);
    expect(child1Event.isDerived).toBe(true);

    const child2Event = effective.lifeEvents.find(e => e.id === 'child-2');
    expect(child2Event).toBeDefined();
    expect(child2Event.type).toBe('haveChild');
    expect(child2Event.birthAge).toBe(25); // 35 today - 10 yrs old
    expect(child2Event.includeCollege).toBe(false);
    expect(child2Event.isDerived).toBe(true);
  });

  test('maps debts to virtual derived debtList items', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        debts: [
          { id: 'debt-1', name: 'Student Loan', balance: 25000, interestRate: 4.5, monthlyPayment: 300 }
        ]
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    const studentLoan = effective.debtList.find(d => d.id === 'debt-1');
    expect(studentLoan).toBeDefined();
    expect(studentLoan.name).toBe('Student Loan');
    expect(studentLoan.balance).toBe(25000);
    expect(studentLoan.interestRate).toBe(4.5);
    expect(studentLoan.payment).toBe(300);
    expect(studentLoan.isDerived).toBe(true);
  });

  test('maps income sources to virtual derived incomeList items', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        incomeSources: [
          { id: 'derived-inc-1', name: 'Rental Property', amount: 12000, growthRate: 2, startAge: 35, endAge: 65, isTaxable: true }
        ]
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    const rentalIncome = effective.incomeList.find(i => i.id === 'derived-inc-1');
    expect(rentalIncome).toBeDefined();
    expect(rentalIncome.name).toBe('Rental Property');
    expect(rentalIncome.amount).toBe(12000);
    expect(rentalIncome.growthRate).toBe(0.02);
    expect(rentalIncome.startAge).toBe(35);
    expect(rentalIncome.endAge).toBe(65);
    expect(rentalIncome.isTaxable).toBe(true);
    expect(rentalIncome.isDerived).toBe(true);
  });

  test('returns unmodified inputs when useLifeProfile is false or undefined', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        assets: {
          cash: 10000,
          brokerage: 20000
        }
      }
    };

    const effective = buildEffectiveSimulationInputs(inputs);

    // Should NOT be overridden/mapped, so simpleInvestments matches original (5000 in DEFAULT_FIRE_INPUTS)
    expect(effective.simpleInvestments).toBe(DEFAULT_FIRE_INPUTS.simpleInvestments);
  });
});
