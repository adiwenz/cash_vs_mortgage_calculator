/**
 * Normalization and Derivation layer for Life Plan object graph model.
 */

export function initializeLifePlanIfMissing(inputs) {
  if (!inputs) return null;
  if (inputs.lifePlan) {
    return inputs.lifePlan;
  }

  const currentAge = Math.max(0, Number(inputs.currentAge) || 35);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const targetRetirementAge = Math.max(currentAge, Number(inputs.targetRetirementAge) || 65);
  const simpleIncome = Number(inputs.simpleIncome) || 50000;

  const objects = [];
  const events = [];

  // 1. Add Self Person object
  objects.push({
    id: 'self-person',
    type: 'person',
    name: 'You',
    startAge: currentAge,
    endAge: lifeExpectancy,
    properties: { role: 'self' }
  });

  const profile = inputs.lifeProfile || {};

  // 2. Add Partner if married/partnered
  const household = profile.household || {};
  if (household.status === 'married' || household.status === 'partnered') {
    objects.push({
      id: 'spouse-partner',
      type: 'person',
      name: 'Partner',
      startAge: currentAge,
      endAge: lifeExpectancy,
      properties: {
        role: 'partner',
        partnerIncome: Number(household.partnerIncome || 0),
        partnerSavings: Number(household.partnerSavings || 0),
        partnerRetirement: Number(household.partnerRetirement || 0),
        partnerDebts: Number(household.partnerDebts || 0),
        status: household.status
      }
    });
  }

  // 3. Add Jobs (Income Sources)
  const incomeSources = profile.incomeSources || [];
  if (incomeSources.length > 0) {
    incomeSources.forEach((inc, idx) => {
      objects.push({
        id: inc.id || `job-${Date.now()}-${idx}`,
        type: 'job',
        name: inc.name || `Job ${idx + 1}`,
        startAge: Number(inc.startAge !== undefined ? inc.startAge : currentAge),
        endAge: Number(inc.endAge !== undefined ? inc.endAge : targetRetirementAge),
        properties: {
          annualIncome: Number(inc.amount || 0),
          growthRate: Number(inc.growthRate !== undefined ? inc.growthRate : 3)
        }
      });
    });
  } else if (simpleIncome > 0) {
    objects.push({
      id: 'job-main',
      type: 'job',
      name: 'Main Salary',
      startAge: currentAge,
      endAge: targetRetirementAge,
      properties: {
        annualIncome: simpleIncome,
        growthRate: 3
      }
    });
  }

  // 4. Add Accounts (Assets)
  const profileAssets = profile.assets || {};
  const assetKeys = ['cash', 'brokerage', 'trad401k', 'tradIra', 'rothIra', 'hsa', 'crypto', 'businessEquity'];
  
  assetKeys.forEach(key => {
    const val = Number(profileAssets[key] || inputs.assets?.[key] || 0);
    const contrib = Number(inputs.budgetDetails?.savings?.[key] || 0);
    if (val > 0 || contrib > 0 || (key === 'brokerage' && val === 0 && inputs.assets?.brokerage > 0)) {
      objects.push({
        id: `account-${key}`,
        type: 'account',
        name: key === 'trad401k' ? 'Traditional 401(k)' : key === 'rothIra' ? 'Roth IRA' : key === 'tradIra' ? 'Traditional IRA' : key.charAt(0).toUpperCase() + key.slice(1),
        startAge: currentAge,
        endAge: lifeExpectancy,
        properties: {
          accountType: key,
          currentBalance: val,
          contributionAmount: contrib,
          allocation: '80/20'
        }
      });
    }
  });

  // Ensure we always have cash and brokerage accounts by default
  const hasCash = objects.some(o => o.type === 'account' && o.properties?.accountType === 'cash');
  if (!hasCash) {
    objects.push({
      id: 'account-cash',
      type: 'account',
      name: 'Cash',
      startAge: currentAge,
      endAge: lifeExpectancy,
      properties: {
        accountType: 'cash',
        currentBalance: Number(profileAssets.cash || inputs.assets?.cash || 0),
        contributionAmount: Number(inputs.budgetDetails?.savings?.cash || 0),
        allocation: '100/0'
      }
    });
  }

  const hasBrokerage = objects.some(o => o.type === 'account' && o.properties?.accountType === 'brokerage');
  if (!hasBrokerage) {
    objects.push({
      id: 'account-brokerage',
      type: 'account',
      name: 'Brokerage',
      startAge: currentAge,
      endAge: lifeExpectancy,
      properties: {
        accountType: 'brokerage',
        currentBalance: Number(profileAssets.brokerage || inputs.assets?.brokerage || 5000),
        contributionAmount: Number(inputs.budgetDetails?.savings?.brokerage || 625),
        allocation: '80/20'
      }
    });
  }

  // 5. Add Home / Property and mortgage
  const home = profile.home || {};
  const hasExistingHome = home.status === 'own' && Number(home.homeValue || 0) > 0;
  
  if (hasExistingHome) {
    objects.push({
      id: 'home-property',
      type: 'property',
      name: 'Primary Residence',
      startAge: currentAge,
      endAge: lifeExpectancy,
      properties: {
        homeValue: Number(home.homeValue || 300000),
        monthlyHousingCosts: 0,
        hoa: Number(home.hoa || 0),
        propertyTaxes: Number(home.propertyTaxes || 0),
        insurance: Number(home.insurance || 0)
      }
    });

    if (Number(home.mortgageBalance || 0) > 0) {
      objects.push({
        id: 'mortgage-debt',
        type: 'debt',
        name: 'Home Mortgage',
        startAge: currentAge,
        properties: {
          debtType: 'mortgage',
          balance: Number(home.mortgageBalance || 0),
          interestRate: 6.5,
          monthlyPayment: Number(home.monthlyPayment || 0),
          payoffPlan: 'standard'
        }
      });
    }
  }

  // Future buy house event mapping
  const buyHouseEv = (inputs.lifeEvents || []).find(e => e.type === 'buyHouse' && e.enabled);
  if (buyHouseEv) {
    const purchaseAge = Number(buyHouseEv.purchaseAge || buyHouseEv.age || 40);
    const homePrice = Number(buyHouseEv.homePrice || 300000);
    const mortgageAmount = Number(buyHouseEv.mortgageAmount || (homePrice * 0.8));
    const monthlyHousingCosts = Number(buyHouseEv.monthlyHousingCosts || 0);

    objects.push({
      id: 'future-home-property',
      type: 'property',
      name: 'Future Home',
      startAge: purchaseAge,
      endAge: lifeExpectancy,
      properties: {
        homeValue: homePrice,
        monthlyHousingCosts: monthlyHousingCosts,
        hoa: Number(buyHouseEv.hoa || 0),
        propertyTaxes: Number(buyHouseEv.propertyTaxes || 0),
        insurance: Number(buyHouseEv.insurance || 0)
      }
    });

    if (mortgageAmount > 0) {
      objects.push({
        id: 'future-mortgage-debt',
        type: 'debt',
        name: 'Future Mortgage',
        startAge: purchaseAge,
        properties: {
          debtType: 'mortgage',
          balance: mortgageAmount,
          interestRate: Number(buyHouseEv.mortgageRate || 6.5),
          monthlyPayment: Number(buyHouseEv.monthlyPayment || 0),
          payoffPlan: 'standard'
        }
      });
    }
  }

  // 6. Add Debts
  const debts = profile.debts || [];
  debts.forEach((debt, idx) => {
    objects.push({
      id: debt.id || `debt-${Date.now()}-${idx}`,
      type: 'debt',
      name: debt.name || `Debt ${idx + 1}`,
      startAge: currentAge,
      properties: {
        debtType: 'other',
        balance: Number(debt.balance || 0),
        interestRate: Number(debt.interestRate || 0),
        monthlyPayment: Number(debt.monthlyPayment || 0),
        payoffPlan: 'standard'
      }
    });
  });

  // 7. Add Children
  const children = profile.children || [];
  children.forEach((c, idx) => {
    const childAge = Number(c.age || 0);
    objects.push({
      id: c.id || `child-${Date.now()}-${idx}`,
      type: 'child',
      name: c.name || `Child ${idx + 1}`,
      startAge: currentAge - childAge,
      properties: {
        arrivalAge: currentAge - childAge,
        childcareCost: 15000,
        dependencyEndAge: 18,
        collegeCost: 25000,
        includeCollege: !!c.includeCollege
      }
    });
  });

  // 8. Add Retirement Goal
  objects.push({
    id: 'goal-retirement',
    type: 'goal',
    name: 'Retirement',
    startAge: targetRetirementAge,
    endAge: lifeExpectancy,
    properties: {
      targetAge: targetRetirementAge,
      spendingPercent: 70
    }
  });

  // 9. Add Social Security event
  const ssEv = (inputs.lifeEvents || []).find(e => e.type === 'socialSecurity');
  events.push({
    id: ssEv?.id || 'event-social-security',
    type: 'socialSecurity',
    age: ssEv ? ssEv.claimingAge || 67 : 67,
    objectId: 'self-person',
    mutation: {
      claimingAge: ssEv ? ssEv.claimingAge || 67 : 67,
      monthlyBenefit: ssEv ? ssEv.monthlyBenefit || 2000 : 2000
    }
  });

  return {
    currentAge,
    lifeExpectancy,
    objects,
    events,
    assumptions: {
      expectedReturn: Number(inputs.expectedReturn || 7.0),
      postRetirementReturn: Number(inputs.postRetirementReturn || 5.0),
      inflationRate: Number(inputs.inflationRate || 3.0),
      cashReturnRate: Number(inputs.cashReturnRate || 2.0),
      lifestyleUpgrades: Number(inputs.lifestyleUpgrades || 0.0),
      swr: Number(inputs.swr || 4.0),
      includeTaxes: !!inputs.includeTaxes,
      preMedicarePremium: Number(inputs.preMedicarePremium || 10000),
      medicarePremium: Number(inputs.medicarePremium || 4000)
    }
  };
}

export function deriveLegacyInputsFromLifePlan(lifePlan, originalInputs = {}) {
  if (!lifePlan) return {};

  const currentAge = Number(lifePlan.currentAge) || 35;
  const lifeExpectancy = Number(lifePlan.lifeExpectancy) || 85;

  // Initialize flat structures
  const lifeProfile = {
    household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
    home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
    children: [],
    debts: [],
    assets: { cash: 0, brokerage: 0, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, crypto: 0, businessEquity: 0 },
    incomeSources: []
  };

  const lifeEvents = [];
  const incomeList = [];
  const debtList = [];
  const assets = {};
  const budgetDetails = JSON.parse(JSON.stringify(originalInputs.budgetDetails || { savings: {}, expenses: {} }));

  // Keep other original events that are not managed by lifePlan objects
  const origEvents = originalEventsWithoutDerived(originalInputs.lifeEvents || []);

  let targetRetirementAge = 65;

  // 1. Process Objects
  lifePlan.objects.forEach(obj => {
    if (obj.type === 'person' && obj.properties?.role === 'partner') {
      const p = obj.properties;
      lifeProfile.household = {
        status: p.status || 'married',
        partnerIncome: Number(p.partnerIncome || 0),
        partnerSavings: Number(p.partnerSavings || 0),
        partnerRetirement: Number(p.partnerRetirement || 0),
        partnerDebts: Number(p.partnerDebts || 0)
      };
    }

    else if (obj.type === 'job') {
      const p = obj.properties || {};
      lifeProfile.incomeSources.push({
        id: obj.id,
        name: obj.name,
        amount: Number(p.annualIncome || 0),
        growthRate: Number(p.growthRate || 3),
        startAge: Number(obj.startAge),
        endAge: Number(obj.endAge)
      });

      incomeList.push({
        id: obj.id,
        name: obj.name,
        amount: Number(p.annualIncome || 0),
        frequency: 'yearly',
        startAge: Number(obj.startAge),
        endAge: Number(obj.endAge),
        growthRate: Number(p.growthRate || 3) / 100,
        isTaxable: true,
        isDerived: true
      });
    }

    else if (obj.type === 'account') {
      const p = obj.properties || {};
      const type = p.accountType || 'brokerage';
      if (obj.startAge <= currentAge) {
        lifeProfile.assets[type] = Number(p.currentBalance || 0);
        assets[type] = Number(p.currentBalance || 0);
      }
      budgetDetails.savings = budgetDetails.savings || {};
      budgetDetails.savings[type] = Number(p.contributionAmount || 0);
    }

    else if (obj.type === 'property') {
      const p = obj.properties || {};
      const isActiveToday = obj.startAge <= currentAge && (obj.endAge === null || obj.endAge === undefined || obj.endAge > currentAge);
      
      if (isActiveToday) {
        lifeProfile.home = {
          status: 'own',
          monthlyRent: 0,
          homeValue: Number(p.homeValue || 0),
          mortgageBalance: 0, // derived from mortgage debt object
          monthlyPayment: 0,
          propertyTaxes: Number(p.propertyTaxes || 0),
          insurance: Number(p.insurance || 0),
          hoa: Number(p.hoa || 0)
        };
      }

      // If bought in the future, add buyHouse event
      if (obj.startAge > currentAge) {
        // Find linked mortgage if any
        const linkedMortgage = lifePlan.objects.find(o => o.type === 'debt' && o.properties?.debtType === 'mortgage' && o.startAge === obj.startAge);
        lifeEvents.push({
          id: `buy-${obj.id}`,
          type: 'buyHouse',
          enabled: true,
          name: `Buy ${obj.name}`,
          purchaseAge: Number(obj.startAge),
          age: Number(obj.startAge),
          homePrice: Number(p.homeValue || 0),
          downPayment: Number(p.downPayment || 0),
          mortgageAmount: Number(linkedMortgage?.properties?.balance || 0),
          mortgageRate: Number(linkedMortgage?.properties?.interestRate || 6.5),
          monthlyPayment: Number(linkedMortgage?.properties?.monthlyPayment || 0),
          hoa: Number(p.hoa || 0),
          propertyTaxes: Number(p.propertyTaxes || 0),
          insurance: Number(p.insurance || 0),
          purchaseType: 'mortgage',
          loanTerm: 30,
          isDerived: true
        });
      }

      // If sold in future, add sellHouse event
      if (obj.endAge && obj.endAge < lifeExpectancy) {
        lifeEvents.push({
          id: `sell-${obj.id}`,
          type: 'sellHouse',
          enabled: true,
          name: `Sell ${obj.name}`,
          age: Number(obj.endAge),
          houseId: obj.id,
          isDerived: true
        });
      }
    }

    else if (obj.type === 'debt') {
      const p = obj.properties || {};
      const isMortgage = p.debtType === 'mortgage';
      
      if (obj.startAge <= currentAge) {
        if (isMortgage) {
          lifeProfile.home.mortgageBalance = Number(p.balance || 0);
          lifeProfile.home.monthlyPayment = Number(p.monthlyPayment || 0);
        } else {
          lifeProfile.debts.push({
            id: obj.id,
            name: obj.name,
            balance: Number(p.balance || 0),
            interestRate: Number(p.interestRate || 0),
            monthlyPayment: Number(p.monthlyPayment || 0)
          });
        }

        debtList.push({
          id: obj.id,
          name: obj.name,
          balance: Number(p.balance || 0),
          interestRate: Number(p.interestRate || 0),
          payment: Number(p.monthlyPayment || 0),
          frequency: 'monthly',
          paydownPlanEnabled: false,
          startAge: Number(obj.startAge),
          isDerived: true
        });
      }
    }

    else if (obj.type === 'child') {
      const p = obj.properties || {};
      const childAge = currentAge - obj.startAge;
      
      lifeProfile.children.push({
        id: obj.id,
        name: obj.name,
        age: childAge,
        includeCollege: !!p.includeCollege
      });

      lifeEvents.push({
        id: obj.id,
        type: 'haveChild',
        enabled: true,
        name: `Child: ${obj.name}`,
        birthAge: Number(obj.startAge),
        age: Number(obj.startAge),
        childStartAge: childAge,
        includeCollege: !!p.includeCollege,
        childcareCost: Number(p.childcareCost || 15000),
        dependencyEndAge: Number(p.dependencyEndAge || 18),
        collegeCost: Number(p.collegeCost || 25000),
        isDerived: true
      });
    }

    else if (obj.type === 'goal') {
      const p = obj.properties || {};
      if (obj.name?.toLowerCase().includes('retire') || p.targetAge) {
        targetRetirementAge = Number(p.targetAge || 65);
        lifeEvents.push({
          id: obj.id,
          type: 'retire',
          enabled: true,
          name: obj.name || 'Retirement',
          age: targetRetirementAge,
          spendingPercent: Number(p.spendingPercent || 70),
          isDerived: true
        });
      }
    }
  });

  // Rent fallback: if home status is still rent, set default rent
  if (lifeProfile.home.status === 'rent') {
    const rentVal = Number(originalInputs.lifeProfile?.home?.monthlyRent || originalInputs.budgetDetails?.expenses?.housing || 1500);
    lifeProfile.home.monthlyRent = rentVal;
  }

  // 2. Process Events
  lifePlan.events.forEach(ev => {
    if (ev.type === 'socialSecurity') {
      lifeEvents.push({
        id: ev.id || 'event-social-security',
        type: 'socialSecurity',
        enabled: true,
        name: 'Social Security',
        claimingAge: Number(ev.age || 67),
        age: Number(ev.age || 67),
        monthlyBenefit: Number(ev.mutation?.monthlyBenefit || 2000),
        inflationAdjusted: true,
        ageStartedWorking: 22,
        isDerived: true
      });
    } else if (ev.type === 'windfall') {
      lifeEvents.push({
        id: ev.id,
        type: 'windfall',
        enabled: true,
        name: ev.name || 'Windfall',
        age: Number(ev.age),
        amount: Number(ev.mutation?.amount || 0),
        isDerived: true
      });
    }
  });

  // Calculate simpleIncome: sum of Self active jobs today
  const mainActiveJobs = lifePlan.objects.filter(o => o.type === 'job' && o.startAge <= currentAge && o.endAge > currentAge && !o.id.includes('spouse'));
  const simpleIncome = mainActiveJobs.reduce((sum, j) => sum + Number(j.properties?.annualIncome || 0), 0) || Number(originalInputs.simpleIncome || 50000);

  // Sum up assets for simpleInvestments
  const totalAssets = Object.values(lifeProfile.assets).reduce((sum, val) => sum + (Number(val) || 0), 0);

  // Merge back original non-derived events
  origEvents.forEach(e => {
    if (!lifeEvents.some(le => le.type === e.type && le.id === e.id)) {
      lifeEvents.push(e);
    }
  });

  // Assemble updates
  return {
    currentAge,
    lifeExpectancy,
    targetRetirementAge,
    simpleIncome,
    simpleInvestments: totalAssets,
    lifeProfile,
    lifeEvents,
    incomeList,
    debtList,
    assets: {
      ...originalInputs.assets,
      ...assets,
      cash: Number(lifeProfile.assets.cash || 0),
      brokerage: Number(lifeProfile.assets.brokerage || 0),
      trad401k: Number(lifeProfile.assets.trad401k || 0),
      tradIra: Number(lifeProfile.assets.tradIra || 0),
      rothIra: Number(lifeProfile.assets.rothIra || 0),
      hsa: Number(lifeProfile.assets.hsa || 0),
      other: Number(lifeProfile.assets.crypto || 0) + Number(lifeProfile.assets.businessEquity || 0)
    },
    budgetDetails,
    useLifeProfile: true
  };
}

function originalEventsWithoutDerived(events) {
  return events.filter(e => !e.isDerived);
}
