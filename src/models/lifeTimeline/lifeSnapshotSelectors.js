import { initializeLifePlanIfMissing } from '../lifePlan/lifePlanNormalization.js';
import { applyObjectMutations } from '../lifePlan/lifeObjectMutationEngine.js';
import { 
  getActiveJobs,
  getActiveAccounts,
  getActiveProperties,
  getActiveDebts,
  getActiveChildren,
  getActiveGoals,
  getRelationshipAtAge
} from '../lifePlan/lifePlanSelectors.js';
import { runFireSimulation } from '../../calculators/fire/index.js';

export function getLifeSnapshotFromLifePlan(lifePlan, age, originalInputs, options = {}) {
  const targetAge = Number(age);
  const currentAge = Number(lifePlan?.currentAge || 35);
  const lifeExpectancy = Number(lifePlan?.lifeExpectancy || 85);

  // 1. Relationship
  const relationship = getRelationshipAtAge(lifePlan, targetAge);

  // 2. People
  const self = {
    role: 'self',
    displayName: 'You',
    currentAge: targetAge
  };

  let partner = null;
  const partnerObj = lifePlan?.objects?.find(o => o.type === 'person' && (o.role === 'partner' || o.properties?.role === 'partner'));
  if (partnerObj) {
    const spouseStartAge = partnerObj.startsAtAge !== undefined ? Number(partnerObj.startsAtAge) : Number(partnerObj.startAge || currentAge);
    const spouseEndAge = partnerObj.endsAtAge !== undefined && partnerObj.endsAtAge !== null ? Number(partnerObj.endsAtAge) : (partnerObj.endAge !== undefined ? Number(partnerObj.endAge) : lifeExpectancy);
    
    if (targetAge >= spouseStartAge && targetAge < spouseEndAge) {
      const yearsElapsed = targetAge - currentAge;
      let partnerAgeAtTarget = targetAge;
      if (partnerObj.properties?.spouseCurrentAge !== undefined && partnerObj.properties?.spouseCurrentAge !== null) {
        partnerAgeAtTarget = Number(partnerObj.properties.spouseCurrentAge) + yearsElapsed;
      }
      
      // Apply spouse mutations at target age
      const mutatedSpouse = applyObjectMutations(partnerObj, lifePlan.events, targetAge);
      partner = {
        role: 'partner',
        displayName: partnerObj.name || 'Partner',
        currentAge: partnerAgeAtTarget,
        startsAtAge: spouseStartAge,
        endsAtAge: spouseEndAge,
        status: mutatedSpouse.status || mutatedSpouse.properties?.status || 'married',
        ...mutatedSpouse.properties
      };
    }
  }

  const people = { self, partner };

  // 3. Active objects
  const jobs = getActiveJobs(lifePlan, targetAge);
  const accounts = getActiveAccounts(lifePlan, targetAge);
  const properties = getActiveProperties(lifePlan, targetAge);
  const debts = getActiveDebts(lifePlan, targetAge);
  const children = getActiveChildren(lifePlan, targetAge);
  const goals = getActiveGoals(lifePlan, targetAge);

  // 4. Financial Summary
  let netWorth = 0;
  let portfolio = 0;
  let cashFlow = 0;
  let savings = 0;
  let point = null;

  let nominalPoint = null;
  let deflatedPoint = null;
  const displayMode = options.displayMode || originalInputs?.displayMode;
  const isNominal = displayMode !== 'today';

  if (originalInputs && Object.keys(originalInputs).length > 0) {
    const simInputs = {
      ...originalInputs,
      useLifeProfile: originalInputs?.useLifeProfile,
      lifePlan: lifePlan
    };
    const sim = runFireSimulation(simInputs);
    deflatedPoint = sim?.data?.find(d => Number(d.age) === targetAge);
    nominalPoint = sim?.nominalData?.find(d => Number(d.age) === targetAge);
    
    point = isNominal ? nominalPoint : deflatedPoint;
    if (point) {
      netWorth = point.netWorth;
      portfolio = point.portfolio;
      cashFlow = point.income - point.expenses;
      savings = point.savings;
    }
  }

  const financialSummary = {
    netWorth,
    portfolio,
    cashFlow,
    savings
  };

  const relationshipStatus = relationship;
  let housingStatus = null;
  if (properties.length > 0) {
    housingStatus = 'own';
  } else if (originalInputs?.lifeProfile?.home?.status) {
    housingStatus = originalInputs.lifeProfile.home.status;
  } else if (originalInputs?.housingStatus) {
    housingStatus = originalInputs.housingStatus;
  }

  
  const legacyChildren = children.map((ch, idx) => {
    const childAge = targetAge - ch.startAge;
    return {
      id: ch.id || `child-${idx}`,
      name: ch.name ? ch.name.replace('Child: ', '') : `Child ${idx + 1}`,
      age: childAge,
      isDependent: childAge < 18,
      childcareCost: Number(ch.properties?.childcareCost || 0),
      dependencyEndAge: Number(ch.properties?.dependencyEndAge || 18),
      collegeCost: Number(ch.properties?.collegeCost || 0),
      includeCollege: !!ch.properties?.includeCollege
    };
  });

  const hasIncomeSpecified = !!(
    originalInputs?.simpleIncome !== undefined ||
    (originalInputs?.incomeList && originalInputs.incomeList.length > 0) ||
    (originalInputs?.lifePlan && originalInputs.lifePlan.objects && originalInputs.lifePlan.objects.some(o => o.type === 'job'))
  );
  const activePoint = hasIncomeSpecified ? (isNominal ? nominalPoint : deflatedPoint) : null;

  let annualIncome = 0;
  let activeIncomeItems = [];

  if (activePoint) {
    annualIncome = activePoint.annualIncome ?? 0;
    activeIncomeItems = (activePoint.activeIncomeItems ?? []).map(aii => ({
      id: aii.id && aii.id.includes('-segment-') ? aii.id.split('-segment-')[0] : aii.id,
      label: aii.name,
      metadata: { amount: aii.annualAmount }
    }));
  } else {
    if (originalInputs?.lifePlan) {
      annualIncome = jobs.reduce((sum, j) => sum + Number(j.properties?.annualIncome || 0), 0);
    } else {
      annualIncome = jobs.reduce((sum, j) => sum + Number(j.properties?.annualIncome || 0), 0);
      if (jobs.length === 0) {
        const allJobs = lifePlan?.objects?.filter(o => o.type === 'job') || [];
        annualIncome = allJobs.reduce((sum, j) => sum + Number(j.properties?.annualIncome || 0), 0);
      }
    }
    if (partner) {
      annualIncome += Number(partner.partnerIncome || 0);
    }
    activeIncomeItems = jobs.map(j => ({
      id: j.id,
      label: j.name,
      metadata: { amount: j.properties?.annualIncome }
    }));
  }

  const activeDebts = debts.map(d => {
    let balance = Number(d.properties?.balance || 0);
    if (point) {
      if (point.debtBalances && point.debtBalances[d.id] !== undefined) {
        balance = point.debtBalances[d.id];
      } else if (point.mortgageBalances && point.mortgageBalances[d.id] !== undefined) {
        balance = point.mortgageBalances[d.id];
      } else if (d.properties?.debtType === 'mortgage') {
        balance = point.mortgageBalance;
      }
    }
    return {
      id: d.id,
      name: d.name,
      type: d.properties?.debtType || 'debt',
      monthlyPayment: Math.round(Number(d.properties?.monthlyPayment || 0)),
      interestRate: Number(d.properties?.interestRate || 0),
      balance: Math.round(balance),
      payoffAge: d.properties?.payoffAge
    };
  });

  let investedAssets = 0;
  if (point) {
    investedAssets = (point.brokerageBalance || 0) + (point.trad401kBalance || 0) + (point.tradIraBalance || 0) + (point.rothIraBalance || 0) + (point.hsaBalance || 0) + (point.otherBalance || 0) + (point.cashBalance || 0) + (point.emergencyFundBalance || 0);
  } else {
    investedAssets = accounts.reduce((sum, a) => sum + Number(a.properties?.currentBalance || 0), 0);
  }

  const projectedAccounts = accounts.map(a => {
    const type = a.properties?.accountType || 'brokerage';
    let balance = Number(a.properties?.currentBalance || 0);
    if (point) {
      if (type === 'cash') balance = point.cashBalance;
      else if (type === 'emergencyFund') balance = point.emergencyFundBalance;
      else if (type === 'brokerage') balance = point.brokerageBalance;
      else if (type === 'trad401k') balance = point.trad401kBalance;
      else if (type === 'tradIra') balance = point.tradIraBalance;
      else if (type === 'rothIra') balance = point.rothIraBalance;
      else if (type === 'hsa') balance = point.hsaBalance;
      else balance = point.otherBalance;
    }
    return {
      ...a,
      properties: {
        ...a.properties,
        currentBalance: Math.round(balance)
      }
    };
  });

  const projectedProperties = properties.map(p => {
    let homeValue = Number(p.properties?.homeValue || 0);
    let mortgageBalance = 0;
    if (point) {
      if (point.homeValues && point.homeValues[p.id] !== undefined) {
        homeValue = point.homeValues[p.id];
      } else if (p.id === 'home-property') {
        homeValue = point.homeValue;
      }
      
      const mortgageId = `mortgage-${p.id}`;
      if (point.mortgageBalances && point.mortgageBalances[mortgageId] !== undefined) {
        mortgageBalance = point.mortgageBalances[mortgageId];
      } else if (p.id === 'home-property' && point.mortgageBalances && point.mortgageBalances['mortgage-debt'] !== undefined) {
        mortgageBalance = point.mortgageBalances['mortgage-debt'];
      }
    }
    return {
      ...p,
      properties: {
        ...p.properties,
        homeValue: Math.round(homeValue),
        mortgageBalance: Math.round(mortgageBalance),
        homeEquity: Math.round(Math.max(0, homeValue - mortgageBalance))
      }
    };
  });

  return {
    age: targetAge,
    currentAge,
    relationshipStatus,
    housingStatus,
    people,
    children: legacyChildren,
    income: {
      annualIncome,
      activeIncomeItems
    },
    debts: {
      activeDebts
    },
    assets: {
      investedAssets
    },
    jobs,
    accounts: projectedAccounts,
    properties: projectedProperties,
    goals,
    settings: lifePlan?.settings || lifePlan?.assumptions || {},
    financialSummary,
    activeEvents: [],
    activePeriods: []
  };
}

export function getLifeSnapshotAtAge(inputs, age, options = {}) {
  if (!inputs) return {};
  const lifePlan = initializeLifePlanIfMissing(inputs);
  return getLifeSnapshotFromLifePlan(lifePlan, age, inputs, options);
}
