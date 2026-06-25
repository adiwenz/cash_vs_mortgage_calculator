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
  const partnerObj = lifePlan?.objects?.find(o => o.type === 'person' && o.properties?.role === 'partner');
  if (partnerObj && targetAge >= Number(partnerObj.startAge || currentAge)) {
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
      ...mutatedSpouse.properties
    };
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

  let nominalPoint = null;
  let deflatedPoint = null;
  const displayMode = options.displayMode || originalInputs?.displayMode;
  const isNominal = displayMode !== 'today';

  if (originalInputs) {
    const sim = runFireSimulation(originalInputs);
    deflatedPoint = sim?.data?.find(d => Number(d.age) === targetAge);
    nominalPoint = sim?.nominalData?.find(d => Number(d.age) === targetAge);
    
    const point = isNominal ? nominalPoint : deflatedPoint;
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

  // 5. Formulate Legacy-Compatible fields derived from the object graph
  const relationshipStatus = relationship;
  const housingStatus = properties.length > 0 ? 'own' : 'rent';
  
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

  const activeDebts = debts.map(d => ({
    id: d.id,
    name: d.name,
    type: d.properties?.debtType || 'debt',
    monthlyPayment: Math.round(Number(d.properties?.monthlyPayment || 0)),
    interestRate: Number(d.properties?.interestRate || 0),
    balance: Number(d.properties?.balance || 0),
    payoffAge: d.properties?.payoffAge
  }));

  const investedAssets = accounts.reduce((sum, a) => sum + Number(a.properties?.currentBalance || 0), 0);

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
    accounts,
    properties,
    goals,
    assumptions: lifePlan?.assumptions || {},
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
