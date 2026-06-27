import { initializeLifePlanIfMissing, buildSimulationInputsFromLifePlan } from '../../models/lifePlan/lifePlanNormalization.js';

export function buildEffectiveSimulationInputs(inputs) {
  if (!inputs) return inputs;

  let cloned = JSON.parse(JSON.stringify(inputs));
  cloned.lifePlan = initializeLifePlanIfMissing(cloned);
  if (cloned.lifePlan) {
    cloned = buildSimulationInputsFromLifePlan(cloned.lifePlan, cloned);
  }

  return cloned;
}

export function buildBaselineCurrentInputs(inputs) {
  if (!inputs) return inputs;

  // 1. Clone inputs
  let baselineInputs = JSON.parse(JSON.stringify(inputs));

  // 2. Strip out all timeline event assumptions from inputs first
  if (baselineInputs.lifeEvents) {
    baselineInputs.lifeEvents = baselineInputs.lifeEvents.filter(e => e.isDerived);
  }

  // 3. Clear lifePlan so it is forced to re-initialize from the filtered baseline profile/events.
  if (baselineInputs.lifePlan) {
    delete baselineInputs.lifePlan;
  }

  // 4. Build effective simulation inputs which maps lifeProfile -> effective lists.
  const effective = buildEffectiveSimulationInputs(baselineInputs);

  // 5. Now, strip out all timeline event assumptions.
  // We keep only the derived events/debts/incomes/members which represent the manual baseline situation.
  return {
    ...effective,
    lifeEvents: (effective.lifeEvents || []).filter(e => e.isDerived),
    debtList: (effective.debtList || []).filter(d => d.isDerived),
    incomeList: (effective.incomeList || []).filter(i => i.isDerived),
    householdMembers: (effective.householdMembers || []).filter(m => m.id === 'spouse' || m.isDerived)
  };
}

