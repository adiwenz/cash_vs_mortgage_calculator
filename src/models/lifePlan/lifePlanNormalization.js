/**
 * Normalization and Derivation layer for Life Plan object graph model.
 */

import { calculateAmortizedLoanPayoffAge } from '../../calculators/fire/debts.js';
import { syncBudgetDetails } from '../../calculators/fire/phases.js';

export function syncLifePlanWithInputs(lifePlan, inputs) {
  if (!lifePlan || !inputs) return lifePlan;

  const currentAge = Math.max(0,
    Number(inputs.currentAge) ||
    Number(inputs.age) ||
    Number(inputs.householdModel?.people?.self?.demographics?.currentAge) ||
    Number(inputs.householdModel?.people?.self?.age) ||
    35
  );
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const targetRetirementAge = Math.max(currentAge, Number(inputs.targetRetirementAge) || 65);

  lifePlan.currentAge = currentAge;
  lifePlan.lifeExpectancy = lifeExpectancy;

  lifePlan.objects = lifePlan.objects || [];
  lifePlan.events = lifePlan.events || [];

  const isProfileMode = inputs.useLifeProfile === true || (inputs.useLifeProfile !== false && inputs.lifeProfile && Object.keys(inputs.lifeProfile).length > 0);
  const profile = isProfileMode ? (inputs.lifeProfile || {}) : {};

  // 1. Sync self-person
  let selfPerson = lifePlan.objects.find(o => o.id === 'self-person');
  if (!selfPerson) {
    selfPerson = {
      id: 'self-person',
      type: 'person',
      name: 'You',
      startAge: currentAge,
      endAge: lifeExpectancy,
      properties: { role: 'self' }
    };
    lifePlan.objects.push(selfPerson);
  } else {
    selfPerson.startAge = currentAge;
    selfPerson.endAge = lifeExpectancy;
  }

  // 2. Sync partner/spouse person object
  const household = profile.household || {};
  const marriageEvents = (inputs.lifeEvents || []).filter(e => e.type === 'marriage' && e.enabled);
  const ssEv = (inputs.lifeEvents || []).find(e => e.type === 'socialSecurity');
  const ssAge = ssEv ? ssEv.claimingAge || 67 : 67;
  const ssBenefit = ssEv ? ssEv.monthlyBenefit || 2000 : 2000;

  const isMarried = household.status === 'married' || 
                    household.status === 'partnered' || 
                    (!isProfileMode && (inputs.filingStatus === 'married' || inputs.filingStatus === 'marriedFilingJointly')) ||
                    !!inputs.householdModel?.people?.partner;
  const hasPartner = isMarried || marriageEvents.length > 0;
  let partnerObj = lifePlan.objects.find(o => o.id === 'spouse-partner');
  if (hasPartner) {
    const partnerInfo = inputs.householdModel?.people?.partner || {};
    const partnerName = partnerInfo.displayName || 'Partner';
    const partnerAge = Number(partnerInfo.currentAge) || Number(household.partnerAge) || currentAge;
    const partnerIncome = Number(household.partnerIncome || partnerInfo.partnerIncome || (marriageEvents[0]?.spouseIncome) || 0);
    const marriageAge = marriageEvents.length > 0 ? Number(marriageEvents[0].age || 38) : currentAge;

    if (!partnerObj) {
      partnerObj = {
        id: 'spouse-partner',
        type: 'person',
        name: partnerName,
        startAge: marriageAge,
        endAge: lifeExpectancy,
        properties: {
          role: 'partner',
          spouseCurrentAge: partnerAge,
          partnerIncome: partnerIncome,
          partnerSavings: Number(household.partnerSavings || 0),
          partnerRetirement: Number(household.partnerRetirement || 0),
          partnerDebts: Number(household.partnerDebts || 0),
          status: household.status || inputs.filingStatus || 'married'
        }
      };
      lifePlan.objects.push(partnerObj);
    } else {
      partnerObj.name = partnerName;
      partnerObj.startAge = marriageAge;
      partnerObj.endAge = lifeExpectancy;
      partnerObj.properties = {
        ...partnerObj.properties,
        spouseCurrentAge: partnerAge,
        partnerIncome: partnerIncome,
        status: household.status || inputs.filingStatus || partnerObj.properties.status || 'married'
      };
    }
  } else if (partnerObj) {
    lifePlan.objects = lifePlan.objects.filter(o => o.id !== 'spouse-partner');
  }

  // 3. Sync Children
  const inputsChildren = profile.children || inputs.children || [];
  const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
  const validChildIds = new Set();

  inputsChildren.forEach((c, idx) => {
    const id = c.id || `child-${idx}`;
    validChildIds.add(id);
    
    let obj = lifePlan.objects.find(o => o.id === id);
    const childAge = Number(c.age || 0);
    const birthAge = currentAge - childAge;

    if (!obj) {
      obj = {
        id,
        type: 'child',
        name: c.name || `Child ${idx + 1}`,
        startAge: birthAge,
        properties: {
          arrivalAge: birthAge,
          childcareCost: 15000,
          dependencyEndAge: 18,
          collegeCost: 25000,
          includeCollege: !!c.includeCollege
        }
      };
      lifePlan.objects.push(obj);
    } else {
      obj.name = c.name || obj.name;
      obj.startAge = birthAge;
      obj.properties = {
        ...obj.properties,
        arrivalAge: birthAge,
        includeCollege: !!c.includeCollege
      };
    }
  });

  childEvents.forEach((ev, idx) => {
    const id = ev.id || `child-event-${idx}`;
    validChildIds.add(id);

    let obj = lifePlan.objects.find(o => o.id === id);
    const birthAge = Number(ev.birthAge || ev.age || currentAge);
    const childName = ev.name ? ev.name.replace('Child: ', '') : `Child ${idx + 1}`;

    if (!obj) {
      obj = {
        id,
        type: 'child',
        name: childName,
        startAge: birthAge,
        properties: {
          arrivalAge: birthAge,
          childcareCost: Number(ev.childcareCost || 15000),
          dependencyEndAge: Number(ev.dependencyEndAge || 18),
          collegeCost: Number(ev.collegeCost || 25000),
          includeCollege: !!ev.includeCollege
        }
      };
      lifePlan.objects.push(obj);
    } else {
      obj.name = childName;
      obj.startAge = birthAge;
      obj.properties = {
        ...obj.properties,
        arrivalAge: birthAge,
        childcareCost: Number(ev.childcareCost || obj.properties.childcareCost || 15000),
        dependencyEndAge: Number(ev.dependencyEndAge || obj.properties.dependencyEndAge || 18),
        collegeCost: Number(ev.collegeCost || obj.properties.collegeCost || 25000),
        includeCollege: !!ev.includeCollege
      };
    }
  });

  lifePlan.objects = lifePlan.objects.filter(obj => {
    if (obj.type === 'child') {
      const isDerivedFromEvent = obj.id.startsWith('child-event-') || (inputs.lifeEvents || []).some(e => e.id === obj.id);
      const isDerivedFromProfile = obj.id.startsWith('child-input-') || (inputsChildren || []).some(c => c.id === obj.id);
      if (isDerivedFromEvent || isDerivedFromProfile) {
        return validChildIds.has(obj.id);
      }
    }
    return true;
  });

  // 4. Sync future home properties and mortgages from buyHouse events
  const buyHouseEvents = (inputs.lifeEvents || []).filter(e => e.type === 'buyHouse' && e.enabled);
  const validHouseIds = new Set();
  
  buyHouseEvents.forEach((buyHouseEv, bhIdx) => {
    const purchaseAge = Number(buyHouseEv.purchaseAge || buyHouseEv.age || 40);
    let homePrice = Number(buyHouseEv.homePrice || 300000);
    if (buyHouseEv.houseId) {
      const houseAsset = (inputs.houseAssets || []).find(h => h.id === buyHouseEv.houseId);
      if (houseAsset && houseAsset.purchasePrice) {
        homePrice = Number(houseAsset.purchasePrice);
      }
    }
    const mortgageAmount = Number(buyHouseEv.mortgageAmount || (homePrice * 0.8));
    const monthlyHousingCosts = Number(buyHouseEv.monthlyHousingCosts || 0);
    const houseId = buyHouseEv.houseId || `future-home-property-${bhIdx}`;
    
    validHouseIds.add(houseId);

    let propObj = lifePlan.objects.find(o => o.id === houseId);
    if (!propObj) {
      propObj = {
        id: houseId,
        type: 'property',
        name: buyHouseEv.name || 'Future Home',
        startAge: purchaseAge,
        endAge: lifeExpectancy,
        properties: {
          homeValue: homePrice,
          monthlyHousingCosts: monthlyHousingCosts,
          hoa: Number(buyHouseEv.hoa || 0),
          propertyTaxes: Number(buyHouseEv.propertyTaxes || 0),
          insurance: Number(buyHouseEv.insurance || 0)
        }
      };
      lifePlan.objects.push(propObj);
    } else {
      propObj.startAge = purchaseAge;
      propObj.endAge = lifeExpectancy;
      propObj.properties = {
        ...propObj.properties,
        homeValue: homePrice,
        monthlyHousingCosts: monthlyHousingCosts,
        hoa: Number(buyHouseEv.hoa || propObj.properties.hoa || 0),
        propertyTaxes: Number(buyHouseEv.propertyTaxes || propObj.properties.propertyTaxes || 0),
        insurance: Number(buyHouseEv.insurance || propObj.properties.insurance || 0)
      };
    }

    if (mortgageAmount > 0) {
      const mortgageId = `mortgage-${houseId}`;
      let mortObj = lifePlan.objects.find(o => o.id === mortgageId);
      if (!mortObj) {
        mortObj = {
          id: mortgageId,
          type: 'debt',
          name: `${propObj.name} Mortgage`,
          startAge: purchaseAge,
          properties: {
            debtType: 'mortgage',
            balance: mortgageAmount,
            interestRate: Number(buyHouseEv.mortgageRate || 6.5),
            monthlyPayment: Number(buyHouseEv.monthlyPayment || 0),
            payoffPlan: 'standard'
          }
        };
        lifePlan.objects.push(mortObj);
      } else {
        mortObj.startAge = purchaseAge;
        mortObj.properties = {
          ...mortObj.properties,
          balance: mortgageAmount,
          interestRate: Number(buyHouseEv.mortgageRate || mortObj.properties.interestRate || 6.5),
          monthlyPayment: Number(buyHouseEv.monthlyPayment || mortObj.properties.monthlyPayment || 0)
        };
      }
    }
  });

  // Sync sell house events
  const sellHouseEvents = (inputs.lifeEvents || []).filter(e => e.type === 'sellHouse' && e.enabled);
  lifePlan.events = (lifePlan.events || []).filter(e => e.type !== 'property.sell');
  sellHouseEvents.forEach(sellEv => {
    lifePlan.events.push({
      id: sellEv.id || `event-sell-${sellEv.houseId}`,
      type: 'property.sell',
      age: Number(sellEv.age),
      objectId: sellEv.houseId || 'future-home-property'
    });
  });

  lifePlan.objects = lifePlan.objects.filter(obj => {
    if (obj.type === 'property' && obj.id !== 'home-property' && obj.startAge > currentAge) {
      return validHouseIds.has(obj.id);
    }
    if (obj.type === 'debt' && obj.id.startsWith('mortgage-') && obj.id !== 'mortgage-debt' && obj.startAge > currentAge) {
      const houseId = obj.id.replace('mortgage-', '');
      return validHouseIds.has(houseId);
    }
    return true;
  });

  // 5. Sync career change job objects
  const careerChangeEvents = (inputs.lifeEvents || []).filter(e => e.type === 'careerChange' && e.enabled);
  const validJobIds = new Set();
  careerChangeEvents.forEach((ccEv, ccIdx) => {
    const startAge = Number(ccEv.startAge || ccEv.age || 45);
    const endAge = Number(ccEv.endAge || targetRetirementAge);
    const jobId = ccEv.id || ccEv.jobId || `job-career-change-${ccIdx}`;
    validJobIds.add(jobId);

    let jobObj = lifePlan.objects.find(o => o.id === jobId);
    if (!jobObj) {
      jobObj = {
        id: jobId,
        type: 'job',
        name: ccEv.name || 'New Job',
        startAge,
        endAge,
        properties: {
          annualIncome: Number(ccEv.amount || 0),
          growthRate: Number(ccEv.growthRate !== undefined ? ccEv.growthRate * 100 : 3)
        }
      };
      lifePlan.objects.push(jobObj);
    } else {
      jobObj.startAge = startAge;
      jobObj.endAge = endAge;
      jobObj.name = ccEv.name || jobObj.name;
      jobObj.properties = {
        ...jobObj.properties,
        annualIncome: Number(ccEv.amount || jobObj.properties.annualIncome || 0),
        growthRate: Number(ccEv.growthRate !== undefined ? ccEv.growthRate * 100 : jobObj.properties.growthRate || 3)
      };
    }
  });

  lifePlan.objects = lifePlan.objects.filter(obj => {
    if (obj.type === 'job' && obj.id.startsWith('job-career-change-')) {
      return validJobIds.has(obj.id);
    }
    return true;
  });

  // 6. Sync retirement goals
  let retireGoal = lifePlan.objects.find(o => o.id === 'goal-retirement');
  if (!retireGoal) {
    retireGoal = {
      id: 'goal-retirement',
      type: 'goal',
      name: 'Retirement',
      startAge: targetRetirementAge,
      endAge: lifeExpectancy,
      properties: {
        targetAge: targetRetirementAge,
        spendingPercent: 70
      }
    };
    lifePlan.objects.push(retireGoal);
  } else {
    retireGoal.startAge = targetRetirementAge;
    retireGoal.endAge = lifeExpectancy;
    retireGoal.properties = {
      ...retireGoal.properties,
      targetAge: targetRetirementAge
    };
  }

  // 7. Sync Social Security claiming events
  let planSsEvent = lifePlan.events.find(e => e.type === 'socialSecurity');
  if (!planSsEvent) {
    lifePlan.events.push({
      id: ssEv?.id || 'event-social-security',
      type: 'socialSecurity',
      age: ssAge,
      objectId: 'self-person',
      mutation: {
        claimingAge: ssAge,
        monthlyBenefit: ssBenefit
      }
    });
  } else {
    planSsEvent.age = ssAge;
    planSsEvent.mutation = {
      ...planSsEvent.mutation,
      claimingAge: ssAge,
      monthlyBenefit: ssBenefit
    };
  }

  const profileAssets = isProfileMode ? (profile.assets || {}) : (inputs.assets || {});
  const useDefaultBrokerageBal = !!(inputs.assets || inputs.lifeProfile || inputs.simpleInvestments);
  ensureDefaultAccounts(lifePlan.objects, currentAge, lifeExpectancy, profileAssets, useDefaultBrokerageBal);

  return lifePlan;
}

export function initializeLifePlanIfMissing(inputs) {
  if (!inputs) return null;
  if (inputs.lifePlan) {
    const cloned = JSON.parse(JSON.stringify(inputs.lifePlan));
    return syncLifePlanWithInputs(cloned, inputs);
  }

  const currentAge = Math.max(0,
    Number(inputs.currentAge) ||
    Number(inputs.age) ||
    Number(inputs.householdModel?.people?.self?.demographics?.currentAge) ||
    Number(inputs.householdModel?.people?.self?.age) ||
    35
  );
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const targetRetirementAge = Math.max(currentAge, Number(inputs.targetRetirementAge) || 65);
  const simpleIncome = Number(inputs.simpleIncome) || 0;

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

  const isProfileMode = inputs.useLifeProfile === true || (inputs.useLifeProfile !== false && inputs.lifeProfile && Object.keys(inputs.lifeProfile).length > 0);
  const profile = isProfileMode ? (inputs.lifeProfile || {}) : {};

  // 2. Add Partner if married/partnered
  const household = profile.household || {};
  const isMarried = household.status === 'married' || 
                    household.status === 'partnered' || 
                    (!isProfileMode && (inputs.filingStatus === 'married' || inputs.filingStatus === 'marriedFilingJointly')) ||
                    !!inputs.householdModel?.people?.partner;

  if (isMarried) {
    const partnerInfo = inputs.householdModel?.people?.partner || {};
    const partnerName = partnerInfo.displayName || 'Partner';
    const partnerAge = Number(partnerInfo.currentAge) || Number(household.partnerAge) || currentAge;
    objects.push({
      id: 'spouse-partner',
      type: 'person',
      name: partnerName,
      startAge: currentAge,
      endAge: lifeExpectancy,
      properties: {
        role: 'partner',
        spouseCurrentAge: partnerAge,
        partnerIncome: Number(household.partnerIncome || partnerInfo.partnerIncome || 0),
        partnerSavings: Number(household.partnerSavings || 0),
        partnerRetirement: Number(household.partnerRetirement || 0),
        partnerDebts: Number(household.partnerDebts || 0),
        status: household.status || inputs.filingStatus || 'married'
      }
    });
  }

  // 3. Add Jobs (Income Sources)
  const incomeSources = isProfileMode ? (profile.incomeSources || []) : (inputs.incomeList || []);

  if (incomeSources.length > 0) {
    incomeSources.forEach((inc, idx) => {
      objects.push({
        id: inc.id || `job-${Date.now()}-${idx}`,
        type: 'job',
        name: inc.name || inc.label || `Job ${idx + 1}`,
        startAge: Number(inc.startAge !== undefined ? inc.startAge : currentAge),
        endAge: Number(inc.endAge !== undefined ? inc.endAge : targetRetirementAge),
        properties: {
          annualIncome: Number(inc.annualIncome ?? inc.salary ?? inc.currentSalary ?? inc.income ?? inc.amount ?? 0),
          growthRate: Number(inc.growthRate !== undefined ? (inc.growthRate * (isProfileMode ? 1 : 100)) : 3)
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

  // Add careerChange events as jobs
  const careerChangeEvents = (inputs.lifeEvents || []).filter(e => e.type === 'careerChange' && e.enabled);
  careerChangeEvents.forEach((ccEv, ccIdx) => {
    const startAge = Number(ccEv.startAge || ccEv.age || 45);
    const endAge = Number(ccEv.endAge || targetRetirementAge);
    objects.push({
      id: ccEv.id || ccEv.jobId || `job-career-change-${ccIdx}`,
      type: 'job',
      name: ccEv.name || 'New Job',
      startAge,
      endAge,
      properties: {
        annualIncome: Number(ccEv.amount || 0),
        growthRate: Number(ccEv.growthRate !== undefined ? ccEv.growthRate * 100 : 3)
      }
    });
  });

  // 4. Add Accounts (Assets)
  const profileAssets = isProfileMode ? (profile.assets || {}) : (inputs.assets || {});
  const useDefaultBrokerageBal = !!(inputs.assets || inputs.lifeProfile || inputs.simpleInvestments);
  ensureDefaultAccounts(objects, currentAge, lifeExpectancy, profileAssets, useDefaultBrokerageBal);

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
  const buyHouseEvents = (inputs.lifeEvents || []).filter(e => e.type === 'buyHouse' && e.enabled);
  buyHouseEvents.forEach((buyHouseEv, bhIdx) => {
    const purchaseAge = Number(buyHouseEv.purchaseAge || buyHouseEv.age || 40);
    let homePrice = Number(buyHouseEv.homePrice || 300000);
    if (buyHouseEv.houseId) {
      const houseAsset = (inputs.houseAssets || []).find(h => h.id === buyHouseEv.houseId);
      if (houseAsset && houseAsset.purchasePrice) {
        homePrice = Number(houseAsset.purchasePrice);
      }
    }
    const mortgageAmount = Number(buyHouseEv.mortgageAmount || (homePrice * 0.8));
    const monthlyHousingCosts = Number(buyHouseEv.monthlyHousingCosts || 0);

    const houseId = buyHouseEv.houseId || `future-home-property-${bhIdx}`;
    objects.push({
      id: houseId,
      type: 'property',
      name: buyHouseEv.name || 'Future Home',
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
        id: `mortgage-${houseId}`,
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
  });

  // Future sell house event mapping to lifePlan.events
  const sellHouseEvents = (inputs.lifeEvents || []).filter(e => e.type === 'sellHouse' && e.enabled);
  sellHouseEvents.forEach(sellEv => {
    events.push({
      id: sellEv.id || `event-sell-${sellEv.houseId}`,
      type: 'property.sell',
      age: Number(sellEv.age),
      objectId: sellEv.houseId || 'future-home-property'
    });
  });

  // Future marriage event mapping to partner start age
  const marriageEvents = (inputs.lifeEvents || []).filter(e => e.type === 'marriage' && e.enabled);
  marriageEvents.forEach((marriageEv, mIdx) => {
    const marriageAge = Number(marriageEv.age || 38);
    // Only push if spouse-partner doesn't exist
    if (!objects.some(o => o.id === 'spouse-partner')) {
      objects.push({
        id: 'spouse-partner',
        type: 'person',
        name: 'Partner',
        startAge: marriageAge,
        endAge: lifeExpectancy,
        properties: {
          role: 'partner',
          partnerIncome: Number(marriageEv.spouseIncome || 0),
          status: 'married'
        }
      });
    }
  });

  // 6. Add Debts
  const debts = isProfileMode ? (profile.debts || []) : (inputs.debtList || []);

  debts.forEach((debt, idx) => {
    const balance = Number(debt.balance || 0);
    const apr = Number(debt.interestRate || 0);
    const payment = Number(debt.payment || debt.monthlyPayment || 0);
    const startAge = Number(debt.startAge !== undefined ? debt.startAge : currentAge);

    objects.push({
      id: debt.id || `debt-${Date.now()}-${idx}`,
      type: 'debt',
      name: debt.name || `Debt ${idx + 1}`,
      startAge,
      properties: {
        debtType: debt.type || 'other',
        balance,
        interestRate: apr,
        monthlyPayment: payment,
        payoffPlan: 'standard'
      }
    });
  });

  // 7. Add Children
  const children = isProfileMode ? (profile.children || []) : [];
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

  // Future child event mapping (haveChild)
  const haveChildEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
  haveChildEvents.forEach((childEv, cIdx) => {
    const birthAge = Number(childEv.birthAge || childEv.age || currentAge);
    const childName = childEv.name ? childEv.name.replace('Child: ', '') : `Child ${cIdx + 1}`;
    objects.push({
      id: childEv.id || `child-event-${cIdx}`,
      type: 'child',
      name: childName,
      startAge: birthAge,
      properties: {
        arrivalAge: birthAge,
        childcareCost: Number(childEv.childcareCost || 15000),
        dependencyEndAge: Number(childEv.dependencyEndAge || 18),
        collegeCost: Number(childEv.collegeCost || 25000),
        includeCollege: !!childEv.includeCollege
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
    assets: { cash: 0, emergencyFund: 0, brokerage: 0, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, savings529: 0, crypto: 0, businessEquity: 0 },
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
    const incomeVal = p.annualIncome ?? p.salary ?? p.currentSalary ?? p.income ?? p.amount;
    if (incomeVal !== undefined && incomeVal !== null) {
      p.annualIncome = Number(incomeVal);
    }
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

  // Preserve non-registry assets (like crypto and businessEquity) from original inputs
  if (originalInputs.lifeProfile?.assets) {
    const registryTypes = ['brokerage', 'tradIra', 'rothIra', 'trad401k', 'hsa', 'cash', 'emergencyFund', 'savings529'];
    Object.entries(originalInputs.lifeProfile.assets).forEach(([key, val]) => {
      if (!registryTypes.includes(key)) {
        lifeProfile.assets[key] = Number(val || 0);
      }
    });
  }

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
      emergencyFund: Number(lifeProfile.assets.emergencyFund || 0),
      brokerage: Number(lifeProfile.assets.brokerage || 0),
      trad401k: Number(lifeProfile.assets.trad401k || 0),
      tradIra: Number(lifeProfile.assets.tradIra || 0),
      rothIra: Number(lifeProfile.assets.rothIra || 0),
      hsa: Number(lifeProfile.assets.hsa || 0),
      savings529: Number(lifeProfile.assets.savings529 || 0),
      other: Number(lifeProfile.assets.crypto || 0) + Number(lifeProfile.assets.businessEquity || 0) + Number(lifeProfile.assets.savings529 || 0)
    },
    budgetDetails,
    useLifeProfile: true
  };
}

function originalEventsWithoutDerived(events) {
  return events.filter(e => !e.isDerived);
}

export function ensureDefaultAccounts(objects, currentAge, lifeExpectancy, profileAssets, useDefaultBrokerageBal = true) {
  const DEFAULT_REGISTRY = [
    { id: 'account-brokerage', name: 'Taxable Brokerage', type: 'brokerage', defaultAllocation: '80/20', defaultBalance: useDefaultBrokerageBal ? 5000 : 0 },
    { id: 'account-tradIra', name: 'Traditional IRA', type: 'tradIra', defaultAllocation: '100/0', defaultBalance: 0 },
    { id: 'account-rothIra', name: 'Roth IRA', type: 'rothIra', defaultAllocation: '100/0', defaultBalance: 0 },
    { id: 'account-trad401k', name: '401(k)', type: 'trad401k', defaultAllocation: 'Target Date', defaultBalance: 0 },
    { id: 'account-hsa', name: 'HSA', type: 'hsa', defaultAllocation: '100/0', defaultBalance: 0 },
    { id: 'account-cash', name: 'Cash', type: 'cash', defaultAllocation: '100/0', defaultBalance: 0 },
    { id: 'account-emergencyFund', name: 'Emergency Fund', type: 'emergencyFund', defaultAllocation: '100/0', defaultBalance: 0 },
    { id: 'account-savings529', name: '529 College Savings', type: 'savings529', defaultAllocation: '100/0', defaultBalance: 0 }
  ];

  DEFAULT_REGISTRY.forEach(reg => {
    let existing = objects.find(o => o.id === reg.id || (o.type === 'account' && o.properties?.accountType === reg.type));
    if (!existing) {
      const balance = (profileAssets && profileAssets[reg.type] !== undefined)
        ? Number(profileAssets[reg.type])
        : reg.defaultBalance;
      objects.push({
        id: reg.id,
        type: 'account',
        name: reg.name,
        startAge: currentAge,
        endAge: lifeExpectancy,
        properties: {
          accountType: reg.type,
          currentBalance: balance,
          allocation: reg.defaultAllocation
        }
      });
    } else {
      existing.id = reg.id;
      existing.name = reg.name;
      existing.type = 'account';
      existing.startAge = currentAge;
      existing.endAge = lifeExpectancy;
      if (!existing.properties) existing.properties = {};
      existing.properties.accountType = reg.type;
      if (existing.properties.currentBalance === undefined) {
        existing.properties.currentBalance = (profileAssets && profileAssets[reg.type] !== undefined)
          ? Number(profileAssets[reg.type])
          : reg.defaultBalance;
      }
      if (existing.properties.allocation === undefined) {
        existing.properties.allocation = reg.defaultAllocation;
      }
    }
  });
}
