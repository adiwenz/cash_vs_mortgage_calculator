/**
 * Normalization and Derivation layer for Life Plan object graph model.
 */

import { calculateAmortizedLoanPayoffAge } from '../../calculators/fire/debts.js';
import { syncBudgetDetails } from '../../calculators/fire/phases.js';

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
  
  // Clean budgetDetails overrides/phases so we don't carry over stale legacy phases
  budgetDetails.phases = [];

  const origEvents = originalEventsWithoutDerived(originalInputs.lifeEvents || []);

  const objects = lifePlan.objects || [];
  const events = lifePlan.events || [];

  // 1. Process Retirement Goal & Determine targetRetirementAge
  const retirementGoal = objects.find(o => o.type === 'goal' && (o.name?.toLowerCase().includes('retire') || o.properties?.targetAge));
  let targetRetirementAge = 65;
  if (retirementGoal) {
    targetRetirementAge = Number(retirementGoal.properties?.targetAge || 65);
    const targetAgeEvent = events.find(e => e.objectId === retirementGoal.id && (e.type === 'goal.complete' || e.type === 'goal.changeTargetAge'));
    if (targetAgeEvent) {
      targetRetirementAge = Number(targetAgeEvent.age);
    }
  }

  // Helper to resolve event age fields
  function getEvAge(ev) {
    return Number(ev.age);
  }

  // 2. Process People (Self and Partner)
  const spouse = objects.find(o => o.type === 'person' && o.properties?.role === 'partner');
  if (spouse) {
    const p = spouse.properties || {};
    const statusChangeEvents = events.filter(e => e.objectId === spouse.id && e.type === 'relationship.statusChange');
    let spouseStatus = p.status || 'married';
    
    lifeProfile.household = {
      status: spouseStatus,
      partnerIncome: Number(p.partnerIncome || 0),
      partnerSavings: Number(p.partnerSavings || 0),
      partnerRetirement: Number(p.partnerRetirement || 0),
      partnerDebts: Number(p.partnerDebts || 0)
    };

    if (spouseStatus === 'married' || spouseStatus === 'partnered') {
      lifeEvents.push({
        id: spouse.id === 'spouse-partner' ? 'derived-marriage' : `derived-marriage-${spouse.id}`,
        type: 'marriage',
        enabled: true,
        name: 'Marriage',
        age: Number(spouse.startAge),
        spouseIncome: Number(p.partnerIncome || 0),
        incomeGrowthRate: 3,
        spouseCurrentAge: Number(spouse.startAge),
        spouseLifeExpectancy: lifeExpectancy,
        isDerived: true
      });
    }

    statusChangeEvents.forEach(ev => {
      const newStatus = ev.mutation?.status || 'married';
      lifeEvents.push({
        id: ev.id,
        type: 'marriage',
        enabled: true,
        name: ev.label || 'Marriage Change',
        age: getEvAge(ev),
        spouseIncome: Number(ev.mutation?.partnerIncome || p.partnerIncome || 0),
        incomeGrowthRate: 3,
        spouseCurrentAge: getEvAge(ev),
        spouseLifeExpectancy: lifeExpectancy,
        isDerived: true
      });
    });
  }

  // 3. Process Properties
  const properties = objects.filter(o => o.type === 'property');
  properties.forEach(prop => {
    const p = prop.properties || {};
    const propEvents = events.filter(e => e.objectId === prop.id);
    const sellEv = propEvents.find(e => e.type === 'property.sell');
    const saleAge = sellEv ? getEvAge(sellEv) : lifeExpectancy;

    const startAge = Number(prop.startAge);

    if (startAge <= currentAge && currentAge < saleAge) {
      lifeProfile.home = {
        status: 'own',
        monthlyRent: 0,
        homeValue: Number(p.homeValue || 0),
        mortgageBalance: 0, // derived from mortgage debt object below
        monthlyPayment: 0,
        propertyTaxes: Number(p.propertyTaxes || 0),
        insurance: Number(p.insurance || 0),
        hoa: Number(p.hoa || 0)
      };
    }

    // Mortgage lookup
    const linkedMortgage = objects.find(o => o.type === 'debt' && o.properties?.debtType === 'mortgage' && (o.id === `mortgage-${prop.id}` || o.startAge === prop.startAge));

    if (startAge > currentAge) {
      lifeEvents.push({
        id: `buy-${prop.id}`,
        type: 'buyHouse',
        enabled: true,
        name: `Buy ${prop.name}`,
        purchaseAge: startAge,
        age: startAge,
        homePrice: Number(p.homeValue || 0),
        downPayment: Number(p.downPayment || 0),
        mortgageAmount: linkedMortgage ? Number(linkedMortgage.properties?.balance || 0) : 0,
        mortgageRate: linkedMortgage ? Number(linkedMortgage.properties?.interestRate || 6.5) : 6.5,
        monthlyPayment: linkedMortgage ? Number(linkedMortgage.properties?.monthlyPayment || 0) : 0,
        hoa: Number(p.hoa || 0),
        propertyTaxes: Number(p.propertyTaxes || 0),
        insurance: Number(p.insurance || 0),
        purchaseType: linkedMortgage ? 'mortgage' : 'cash',
        loanTerm: 30,
        isDerived: true
      });
    }

    if (sellEv && saleAge < lifeExpectancy) {
      lifeEvents.push({
        id: sellEv.id,
        type: 'sellHouse',
        enabled: true,
        name: sellEv.label || `Sell ${prop.name}`,
        age: saleAge,
        houseId: prop.id,
        isDerived: true
      });
    }
  });

  // 4. Process Debts
  const debts = objects.filter(o => o.type === 'debt');
  debts.forEach(debt => {
    const p = debt.properties || {};
    const isMortgage = p.debtType === 'mortgage';
    const payoffEv = events.find(e => e.objectId === debt.id && e.type === 'debt.payoff');
    
    const balance = Number(p.balance || 0);
    const apr = Number(p.interestRate || 0);
    const monthlyPayment = Number(p.monthlyPayment || 0);
    const startAge = Number(debt.startAge);

    let payoffAge = payoffEv ? getEvAge(payoffEv) : calculateAmortizedLoanPayoffAge(balance, apr, monthlyPayment, startAge);

    debtList.push({
      id: debt.id,
      name: debt.name,
      balance,
      interestRate: apr,
      payment: monthlyPayment,
      frequency: 'monthly',
      paydownPlanEnabled: false,
      startAge,
      payoffAge, // overridden payoff age
      isDerived: true
    });

    if (startAge <= currentAge && currentAge < payoffAge) {
      if (isMortgage) {
        if (lifeProfile.home.status === 'own') {
          lifeProfile.home.mortgageBalance = balance;
          lifeProfile.home.monthlyPayment = monthlyPayment;
        }
      } else {
        lifeProfile.debts.push({
          id: debt.id,
          name: debt.name,
          balance,
          interestRate: apr,
          monthlyPayment
        });
      }
    }
  });

  // 5. Process Children
  const children = objects.filter(o => o.type === 'child');
  children.forEach(child => {
    const p = child.properties || {};
    const childEvents = events.filter(e => e.objectId === child.id);
    const depEndEv = childEvents.find(e => e.type === 'child.dependencyEnds');
    
    const childcareCost = Number(p.childcareCost || 15000);
    let dependencyEndAge = depEndEv ? Number(depEndEv.mutation?.dependencyEndAge || depEndEv.age || 18) : Number(p.dependencyEndAge || 18);
    const collegeCost = Number(p.collegeCost || 25000);
    const includeCollege = !!p.includeCollege;
    const childAge = currentAge - child.startAge;

    lifeProfile.children.push({
      id: child.id,
      name: child.name,
      age: childAge,
      includeCollege
    });

    lifeEvents.push({
      id: child.id,
      type: 'haveChild',
      enabled: true,
      name: `Child: ${child.name}`,
      birthAge: Number(child.startAge),
      age: Number(child.startAge),
      childStartAge: childAge,
      includeCollege,
      childcareCost,
      dependencyEndAge,
      collegeCost,
      isDerived: true
    });
  });

  // 6. Process Goals (Retirement goal is already handled in targetRetirementAge derivation, but let's push the retire event)
  if (retirementGoal) {
    lifeEvents.push({
      id: retirementGoal.id,
      type: 'retire',
      enabled: true,
      name: retirementGoal.name || 'Retirement',
      age: targetRetirementAge,
      spendingPercent: Number(retirementGoal.properties?.spendingPercent || 70),
      isDerived: true
    });
  }

  // 7. Process Jobs (Segmentation)
  const jobs = objects.filter(o => o.type === 'job');
  jobs.forEach(job => {
    const p = job.properties || {};
    const jobEvents = events.filter(e => e.objectId === job.id);
    
    const baseSalary = Number(p.annualIncome || 0);
    const growthRate = Number(p.growthRate || 3);
    const jobStart = Number(job.startAge);
    const jobEnd = job.endAge ? Number(job.endAge) : lifeExpectancy;

    const boundaries = new Set([jobStart, jobEnd]);
    jobEvents.forEach(e => {
      if (getEvAge(e) >= jobStart && getEvAge(e) <= jobEnd) {
        boundaries.add(getEvAge(e));
      }
    });

    const sortedAges = Array.from(boundaries).sort((a, b) => a - b);

    for (let i = 0; i < sortedAges.length - 1; i++) {
      const sAge = sortedAges[i];
      const eAge = sortedAges[i+1];

      // Calculate effective salary at sAge
      let salary = baseSalary;
      let isEnded = false;

      // Apply events in chronological order up to sAge
      const appliedEvents = jobEvents
        .filter(e => getEvAge(e) <= sAge)
        .sort((a, b) => getEvAge(a) - getEvAge(b));

      appliedEvents.forEach(e => {
        if (e.type === 'job.raise') {
          if (e.mutation?.annualIncome !== undefined) {
            salary = Number(e.mutation.annualIncome);
          } else if (e.mutation?.raiseAmount !== undefined) {
            salary += Number(e.mutation.raiseAmount);
          }
        } else if (e.type === 'job.end') {
          isEnded = true;
        }
      });

      if (!isEnded && salary > 0) {
        incomeList.push({
          id: `${job.id}-segment-${sAge}-${eAge}`,
          name: job.name,
          amount: salary,
          frequency: 'yearly',
          startAge: sAge,
          endAge: eAge,
          growthRate: growthRate / 100,
          isTaxable: true,
          isDerived: true
        });

        if (sAge <= currentAge && currentAge < eAge) {
          lifeProfile.incomeSources.push({
            id: job.id,
            name: job.name,
            amount: salary,
            growthRate,
            startAge: jobStart,
            endAge: jobEnd
          });
        }
      }
    }
  });

  // 8. Process Accounts & Contribution Change Boundaries (Phases)
  const accounts = objects.filter(o => o.type === 'account');
  accounts.forEach(acc => {
    const p = acc.properties || {};
    const type = p.accountType || 'brokerage';
    if (acc.startAge <= currentAge) {
      lifeProfile.assets[type] = Number(p.currentBalance || 0);
      assets[type] = Number(p.currentBalance || 0);
    }
  });

  // Collect all boundary ages for budget phases
  const budgetBoundaries = new Set([currentAge, lifeExpectancy, targetRetirementAge]);

  // Child boundaries
  lifeEvents.filter(e => e.type === 'haveChild').forEach(e => {
    const birth = Number(e.birthAge);
    const depEnd = Number(e.dependencyEndAge || 18);
    if (birth >= currentAge && birth <= lifeExpectancy) budgetBoundaries.add(birth);
    if (birth + depEnd >= currentAge && birth + depEnd <= lifeExpectancy) budgetBoundaries.add(birth + depEnd);
  });

  // Property boundaries
  properties.forEach(prop => {
    const start = Number(prop.startAge);
    const sellEv = events.find(e => e.objectId === prop.id && e.type === 'property.sell');
    const end = sellEv ? getEvAge(sellEv) : lifeExpectancy;
    if (start >= currentAge && start <= lifeExpectancy) budgetBoundaries.add(start);
    if (end >= currentAge && end <= lifeExpectancy) budgetBoundaries.add(end);
  });

  // Job segment boundaries
  incomeList.forEach(inc => {
    if (inc.startAge >= currentAge && inc.startAge <= lifeExpectancy) budgetBoundaries.add(inc.startAge);
    if (inc.endAge >= currentAge && inc.endAge <= lifeExpectancy) budgetBoundaries.add(inc.endAge);
  });

  // Debt boundaries
  debtList.forEach(d => {
    if (d.startAge >= currentAge && d.startAge <= lifeExpectancy) budgetBoundaries.add(d.startAge);
    if (d.payoffAge >= currentAge && d.payoffAge <= lifeExpectancy) budgetBoundaries.add(d.payoffAge);
  });

  // Account contribution changes
  const accContributionEvents = events.filter(e => e.type === 'account.contributionChange');
  accContributionEvents.forEach(e => {
    const age = getEvAge(e);
    if (age >= currentAge && age <= lifeExpectancy) {
      budgetBoundaries.add(age);
    }
  });

  const sortedBudgetAges = Array.from(budgetBoundaries).sort((a, b) => a - b);

  for (let i = 0; i < sortedBudgetAges.length - 1; i++) {
    const sAge = sortedBudgetAges[i];
    const eAge = sortedBudgetAges[i+1];

    // Compute effective contributions at sAge
    const contributions = {};
    accounts.forEach(acc => {
      const p = acc.properties || {};
      const type = p.accountType || 'brokerage';
      let contrib = Number(p.contributionAmount || 0);

      // Find contribution changes up to sAge
      const appliedChanges = events
        .filter(e => e.objectId === acc.id && e.type === 'account.contributionChange' && getEvAge(e) <= sAge)
        .sort((a, b) => getEvAge(a) - getEvAge(b));

      appliedChanges.forEach(e => {
        contrib = Number(e.mutation?.contributionAmount !== undefined ? e.mutation.contributionAmount : contrib);
      });

      contributions[type] = contrib;
    });

    let phaseExpenses = originalInputs.budgetDetails?.expenses ? { ...originalInputs.budgetDetails.expenses } : {};
    if (originalInputs.hasCustomizedBudget && originalInputs.budgetDetails?.phases) {
      const matchingPhase = originalInputs.budgetDetails.phases.find(p => sAge >= p.startAge && sAge < p.endAge);
      if (matchingPhase && matchingPhase.expenses) {
        phaseExpenses = { ...matchingPhase.expenses };
      }
    }
    if (originalInputs.hasCustomizedBudget === false) {
      const activeIncomes = incomeList.filter(inc => inc.startAge <= sAge && inc.endAge > sAge);
      const phaseIncome = activeIncomes.reduce((sum, inc) => sum + Number(inc.amount || 0), 0) || Number(originalInputs.simpleIncome || 50000);
      const savingsRate = Number(originalInputs.savingsRate || 0);
      const phaseExpensesAmt = phaseIncome * (1 - savingsRate / 100);

      const tempBudgetDetails = JSON.parse(JSON.stringify(originalInputs.budgetDetails || { expenses: {} }));
      tempBudgetDetails.expenses = tempBudgetDetails.expenses || {};

      const activeProperty = objects.find(o => o.type === 'property' && Number(o.startAge) <= sAge && (o.endAge ? Number(o.endAge) > sAge : true));
      if (!activeProperty) {
        const rentVal = Number(originalInputs.lifeProfile?.home?.monthlyRent || originalInputs.budgetDetails?.expenses?.housing || 1500);
        tempBudgetDetails.expenses.housing = rentVal;
      } else {
        const p = activeProperty.properties || {};
        const monthlyPropTax = Number(p.propertyTaxes || 0) / 12;
        const monthlyIns = Number(p.insurance || 0) / 12;
        const monthlyHoa = Number(p.hoa || 0);
        tempBudgetDetails.expenses.housing = Math.round(monthlyPropTax + monthlyIns + monthlyHoa);
      }

      const syncRes = syncBudgetDetails(phaseIncome, phaseExpensesAmt, tempBudgetDetails);
      phaseExpenses = syncRes.budgetDetails.expenses;
    }

    budgetDetails.phases.push({
      id: `phase-${sAge}-${eAge}`,
      startAge: sAge,
      endAge: eAge,
      savings: { ...contributions },
      partnerSavings: originalInputs.budgetDetails?.partnerSavings ? { ...originalInputs.budgetDetails.partnerSavings } : {},
      expenses: phaseExpenses,
      savingsAllocMode: 'fixed'
    });

    if (sAge === currentAge) {
      budgetDetails.savings = { ...contributions };
    }
  }

  // 9. Process Other Events (Windfalls, Social Security)
  events.forEach(ev => {
    if (ev.type === 'windfall' || ev.type === 'windfall.received') {
      lifeEvents.push({
        id: ev.id,
        type: 'windfall',
        enabled: true,
        name: ev.label || 'Windfall',
        age: getEvAge(ev),
        amount: Number(ev.mutation?.amount || 0),
        isDerived: true
      });
    } else if (ev.type === 'socialSecurity') {
      lifeEvents.push({
        id: ev.id,
        type: 'socialSecurity',
        enabled: true,
        name: 'Social Security',
        claimingAge: getEvAge(ev),
        age: getEvAge(ev),
        monthlyBenefit: Number(ev.mutation?.monthlyBenefit || 2000),
        inflationAdjusted: true,
        ageStartedWorking: 22,
        isDerived: true
      });
    }
  });

  // Default rent fallback if housing status is rent
  if (lifeProfile.home.status === 'rent') {
    const rentVal = Number(originalInputs.lifeProfile?.home?.monthlyRent || originalInputs.budgetDetails?.expenses?.housing || 1500);
    lifeProfile.home.monthlyRent = rentVal;
  }

  // Calculate simpleIncome active today
  const mainActiveJobs = incomeList.filter(i => i.startAge <= currentAge && i.endAge > currentAge && !i.id.includes('spouse') && !i.id.includes('partner'));
  const simpleIncome = mainActiveJobs.reduce((sum, j) => sum + Number(j.amount || 0), 0) || Number(originalInputs.simpleIncome || 50000);

  // Sum up assets for simpleInvestments
  const totalAssets = Object.values(lifeProfile.assets).reduce((sum, val) => sum + (Number(val) || 0), 0);

  // Merge back original non-derived events
  origEvents.forEach(e => {
    if (!lifeEvents.some(le => le.type === e.type && le.id === e.id)) {
      lifeEvents.push(e);
    }
  });

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
