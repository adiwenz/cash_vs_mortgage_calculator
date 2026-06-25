import { applyObjectMutations } from './lifeObjectMutationEngine.js';
import { calculateAmortizedLoanPayoffAge } from '../../calculators/fire/debts.js';

export function getActiveObjectsAtAge(lifePlan, age) {
  if (!lifePlan) return [];
  const targetAge = Number(age);
  const objects = lifePlan.objects || [];
  const events = lifePlan.events || [];
  const lifeExpectancy = Number(lifePlan.lifeExpectancy || 85);

  const activeObjects = [];

  objects.forEach(obj => {
    const mutated = applyObjectMutations(obj, events, targetAge);
    if (!mutated) return;

    const startAge = mutated.startsAtAge !== undefined
      ? Number(mutated.startsAtAge)
      : (mutated.startAge !== undefined ? Number(mutated.startAge) : Number(lifePlan.currentAge || 35));
    let endAge = lifeExpectancy;

    if (mutated.endsAtAge !== undefined) {
      endAge = mutated.endsAtAge === null ? lifeExpectancy : Number(mutated.endsAtAge);
    } else if (mutated.effectiveEndAge !== undefined) {
      endAge = mutated.effectiveEndAge;
    } else if (mutated.endAge !== null && mutated.endAge !== undefined) {
      endAge = Number(mutated.endAge);
    }

    if (mutated.type === 'job') {
      const endEv = events.find(e => e.objectId === mutated.id && e.type === 'job.end');
      if (endEv && Number(endEv.age) <= targetAge) {
        return;
      }
      if (endEv) {
        endAge = Math.min(endAge, Number(endEv.age));
      }
    }

    if (mutated.type === 'property') {
      const sellEv = events.find(e => e.objectId === mutated.id && e.type === 'property.sell');
      if (sellEv && Number(sellEv.age) <= targetAge) {
        return;
      }
      if (sellEv) {
        endAge = Math.min(endAge, Number(sellEv.age));
      }
    }

    if (mutated.type === 'debt') {
      const payoffEv = events.find(e => e.objectId === mutated.id && e.type === 'debt.payoff');
      if (payoffEv && Number(payoffEv.age) <= targetAge) {
        return;
      }
      if (payoffEv) {
        endAge = Math.min(endAge, Number(payoffEv.age));
      } else {
        const p = mutated.properties || {};
        endAge = calculateAmortizedLoanPayoffAge(
          Number(p.balance || 0),
          Number(p.interestRate || 0),
          Number(p.monthlyPayment || 0),
          startAge
        );
      }
      if (mutated.effectivePayoffAge !== undefined) {
        endAge = Math.min(endAge, mutated.effectivePayoffAge);
      }
    }

    if (mutated.type === 'child') {
      const depEndEv = events.find(e => e.objectId === mutated.id && e.type === 'child.dependencyEnds');
      const depEndAge = depEndEv ? Number(depEndEv.mutation?.dependencyEndAge || depEndEv.age || 18) : Number(mutated.properties?.dependencyEndAge || 18);
      const includeCollege = !!mutated.properties?.includeCollege;
      const childEndAgeLimit = includeCollege ? 22 : depEndAge;
      endAge = startAge + childEndAgeLimit;
    }

    if (targetAge >= startAge && targetAge < endAge) {
      activeObjects.push(mutated);
    }
  });

  return activeObjects;
}

export function normalizeJobIncome(job) {
  if (!job || !job.properties) return job;
  const incomeVal = job.properties.annualIncome ?? job.properties.salary ?? job.properties.currentSalary ?? job.properties.income ?? job.properties.amount;
  if (incomeVal !== undefined && incomeVal !== null) {
    job.properties.annualIncome = Number(incomeVal);
  }
  return job;
}

export function getActiveJobs(lifePlan, age) {
  return getActiveObjectsAtAge(lifePlan, age)
    .filter(o => o.type === 'job')
    .map(normalizeJobIncome);
}

export function getActiveAccounts(lifePlan, age) {
  return getActiveObjectsAtAge(lifePlan, age).filter(o => o.type === 'account');
}

export function getActiveProperties(lifePlan, age) {
  return getActiveObjectsAtAge(lifePlan, age).filter(o => o.type === 'property');
}

export function getActiveDebts(lifePlan, age) {
  return getActiveObjectsAtAge(lifePlan, age).filter(o => o.type === 'debt');
}

export function getActiveChildren(lifePlan, age) {
  return getActiveObjectsAtAge(lifePlan, age).filter(o => o.type === 'child');
}

export function getActiveGoals(lifePlan, age) {
  return getActiveObjectsAtAge(lifePlan, age).filter(o => o.type === 'goal');
}

export function getRelationshipAtAge(lifePlan, age) {
  if (!lifePlan) return 'single';
  const targetAge = Number(age);
  const spouse = lifePlan.objects?.find(o => o.type === 'person' && (o.role === 'partner' || o.properties?.role === 'partner'));
  if (!spouse) return 'single';

  const startAge = spouse.startsAtAge !== undefined ? Number(spouse.startsAtAge) : (spouse.startAge !== undefined ? Number(spouse.startAge) : Number(lifePlan.currentAge || 35));
  if (targetAge < startAge) return 'single';

  const mutatedSpouse = applyObjectMutations(spouse, lifePlan.events, targetAge);
  return mutatedSpouse?.status || mutatedSpouse?.properties?.status || 'married';
}
