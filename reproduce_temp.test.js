import { test } from 'vitest';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { marriageEventHandler } from './src/features/fire/events/handlers/marriageEventHandler.js';
import { initializeLifePlanIfMissing, deriveLegacyInputsFromLifePlan } from './src/models/lifePlan/lifePlanNormalization.js';
import { getSaveUpdates } from './src/components/fire-simulator/life-profile/lifeProfileSaveAdapter.js';

test('reproduce ages', () => {
  const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  inputs.currentAge = 35;
  inputs.lifeExpectancy = 85;
  inputs.targetRetirementAge = 65;
  inputs.simpleIncome = 50000;
  inputs.simpleExpenses = 42500;
  inputs.useLifeProfile = true;

  const resDefault = runFireSimulation(inputs);
  console.log(`[Default] Retirement Ready Age: ${resDefault.retirementReadyAge}`);

  const marriageEvent = {
    id: 'marriage-1',
    type: 'marriage',
    enabled: true,
    name: 'Marriage Event',
    age: 35,
    spouseCurrentAge: 35,
    spouseLifeExpectancy: 85,
    spouseIncome: 50000,
    savingsRate: 15,
    combinedSpendingAfterMarriage: 73540,
    livingTogether: true,
    combineFinances: true
  };

  const firstSave = marriageEventHandler.save(marriageEvent, inputs);
  let inputsWithPartner1 = firstSave.updatedInputs;
  let lifePlan1 = initializeLifePlanIfMissing(inputsWithPartner1);
  inputsWithPartner1.lifePlan = lifePlan1;

  let derivedWithPartner1 = deriveLegacyInputsFromLifePlan(lifePlan1, inputsWithPartner1);
  let finalInputs1 = { ...inputsWithPartner1, ...derivedWithPartner1 };
  const resFirstMarriage = runFireSimulation(finalInputs1);
  console.log(`[First Marriage] Retirement Ready Age: ${resFirstMarriage.retirementReadyAge}`);

  // Delete Marriage
  const cleanObjects = lifePlan1.objects.filter(o => o.id !== 'spouse-partner' && o.type !== 'relationship');
  const updatedPlan = { ...lifePlan1, objects: cleanObjects, events: [] };
  const deleteUpdates = getSaveUpdates({
    lifePlan: updatedPlan,
    lifeEvents: [],
    householdMembers: []
  }, inputsWithPartner1, 15);
  const finalDeleteInputs = { ...inputsWithPartner1, ...deleteUpdates };
  const resDelete = runFireSimulation(finalDeleteInputs);
  console.log(`[After Delete] Retirement Ready Age: ${resDelete.retirementReadyAge}`);

  // Re-add Marriage
  const secondSave = marriageEventHandler.save(marriageEvent, finalDeleteInputs);
  let inputsWithPartner2 = secondSave.updatedInputs;
  let lifePlan2 = initializeLifePlanIfMissing(inputsWithPartner2);
  inputsWithPartner2.lifePlan = lifePlan2;

  let derivedWithPartner2 = deriveLegacyInputsFromLifePlan(lifePlan2, inputsWithPartner2);
  let finalInputs2 = { ...inputsWithPartner2, ...derivedWithPartner2 };
  const resSecondMarriage = runFireSimulation(finalInputs2);
  console.log(`[Second Marriage] Retirement Ready Age: ${resSecondMarriage.retirementReadyAge}`);

  // Deep compare lifePlan
  console.log("LIFEPLAN 1 OBJECTS:", JSON.stringify(finalInputs1.lifePlan.objects, null, 2));
  console.log("LIFEPLAN 2 OBJECTS:", JSON.stringify(finalInputs2.lifePlan.objects, null, 2));
});
