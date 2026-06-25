/**
 * Engine to apply chronological event mutations to Life Items.
 */

export function normalizeJobIncome(properties) {
  if (!properties) return;
  const incomeVal = properties.annualIncome ?? properties.salary ?? properties.currentSalary ?? properties.income ?? properties.amount;
  if (incomeVal !== undefined && incomeVal !== null) {
    properties.annualIncome = Number(incomeVal);
  }
}

export function applyObjectMutations(object, events, selectedAge) {
  if (!object) return null;
  const cloned = JSON.parse(JSON.stringify(object));
  const age = Number(selectedAge);

  // Filter events chronological up to selectedAge
  const appliedEvents = (events || [])
    .filter(e => e.objectId === object.id && Number(e.age) <= age)
    .sort((a, b) => Number(a.age) - Number(b.age));

  cloned.properties = cloned.properties || {};

  if (cloned.type === 'job') {
    normalizeJobIncome(cloned.properties);
  }

  appliedEvents.forEach(ev => {
    switch (ev.type) {
      case 'job.raise':
        const raiseVal = ev.mutation?.annualIncome ?? ev.mutation?.salary ?? ev.mutation?.currentSalary ?? ev.mutation?.income ?? ev.mutation?.amount;
        if (raiseVal !== undefined && raiseVal !== null) {
          cloned.properties.annualIncome = Number(raiseVal);
        } else if (ev.mutation?.raiseAmount !== undefined) {
          cloned.properties.annualIncome = (cloned.properties.annualIncome || 0) + Number(ev.mutation.raiseAmount);
        }
        break;

      case 'job.end':
        cloned.effectiveEndAge = Number(ev.age);
        cloned.isEnded = true;
        break;

      case 'account.contributionChange':
        if (ev.mutation?.contributionAmount !== undefined) {
          cloned.properties.contributionAmount = Number(ev.mutation.contributionAmount);
        }
        break;

      case 'account.allocationChange':
        if (ev.mutation?.allocation !== undefined) {
          cloned.properties.allocation = ev.mutation.allocation;
        }
        break;

      case 'debt.payoff':
        cloned.effectivePayoffAge = Number(ev.age);
        cloned.properties.payoffAge = Number(ev.age);
        cloned.isPaidOff = true;
        break;

      case 'property.sell':
        cloned.effectiveEndAge = Number(ev.age);
        cloned.isSold = true;
        break;

      case 'child.dependencyEnds':
        if (ev.mutation?.dependencyEndAge !== undefined) {
          cloned.properties.dependencyEndAge = Number(ev.mutation.dependencyEndAge);
        }
        break;

      case 'goal.complete':
      case 'goal.changeTargetAge':
        if (ev.mutation?.targetAge !== undefined) {
          cloned.properties.targetAge = Number(ev.mutation.targetAge);
        } else {
          cloned.properties.targetAge = Number(ev.age);
        }
        break;
      
      case 'relationship.statusChange':
        if (ev.mutation?.status !== undefined) {
          cloned.properties.status = ev.mutation.status;
        }
        if (ev.mutation?.partnerIncome !== undefined) {
          cloned.properties.partnerIncome = Number(ev.mutation.partnerIncome);
        }
        break;

      default:
        break;
    }
  });

  return cloned;
}
