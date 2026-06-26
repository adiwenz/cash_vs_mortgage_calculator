import { runFireSimulation } from './src/calculators/fire/index.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { marriageEventHandler } from './src/features/fire/events/handlers/marriageEventHandler.js';
import { initializeLifePlanIfMissing, deriveLegacyInputsFromLifePlan } from './src/models/lifePlan/lifePlanNormalization.js';
import { getSaveUpdates } from './src/components/fire-simulator/life-profile/lifeProfileSaveAdapter.js';

const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
inputs.currentAge = 35;
inputs.lifeExpectancy = 85;
inputs.targetRetirementAge = 65;
inputs.simpleIncome = 50000;
inputs.simpleExpenses = 42500;
inputs.useLifeProfile = true;

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

// 1. First Marriage
const firstSave = marriageEventHandler.save(marriageEvent, inputs);
let inputsWithPartner1 = firstSave.updatedInputs;
let lifePlan1 = initializeLifePlanIfMissing(inputsWithPartner1);
inputsWithPartner1.lifePlan = lifePlan1;
let derivedWithPartner1 = deriveLegacyInputsFromLifePlan(lifePlan1, inputsWithPartner1);
let finalInputs1 = { ...inputsWithPartner1, ...derivedWithPartner1 };
const resFirst = runFireSimulation(finalInputs1);

// 2. Delete Marriage
const cleanObjects = lifePlan1.objects.filter(o => o.id !== 'spouse-partner' && o.type !== 'relationship');
const updatedPlan = { ...lifePlan1, objects: cleanObjects, events: [] };
const deleteUpdates = getSaveUpdates({
  lifePlan: updatedPlan,
  lifeEvents: [],
  householdMembers: []
}, inputsWithPartner1, 15);
const finalDeleteInputs = { ...inputsWithPartner1, ...deleteUpdates };

// 3. Second Marriage
const secondSave = marriageEventHandler.save(marriageEvent, finalDeleteInputs);
let inputsWithPartner2 = secondSave.updatedInputs;
let lifePlan2 = initializeLifePlanIfMissing(inputsWithPartner2);
inputsWithPartner2.lifePlan = lifePlan2;
let derivedWithPartner2 = deriveLegacyInputsFromLifePlan(lifePlan2, inputsWithPartner2);
let finalInputs2 = { ...inputsWithPartner2, ...derivedWithPartner2 };
const resSecond = runFireSimulation(finalInputs2);

console.log("FIRST MARRIAGE READY AGE:", resFirst.retirementReadyAge);
console.log("SECOND MARRIAGE READY AGE:", resSecond.retirementReadyAge);

console.log("\n=== YEAR-BY-YEAR COMPARE (Ages 35 to 65) ===");
for (let age = 35; age <= 65; age++) {
  const d1 = resFirst.nominalData.find(d => d.age === age);
  const d2 = resSecond.nominalData.find(d => d.age === age);
  if (!d1 || !d2) continue;
  if (
    Math.round(d1.income) !== Math.round(d2.income) ||
    Math.round(d1.expenses) !== Math.round(d2.expenses) ||
    Math.round(d1.savings) !== Math.round(d2.savings) ||
    Math.round(d1.portfolio) !== Math.round(d2.portfolio) ||
    d1.isFI !== d2.isFI
  ) {
    console.log(`Age ${age}:`);
    console.log(`  First: Income=${d1.income.toFixed(0)}, Exp=${d1.expenses.toFixed(0)}, Sav=${d1.savings.toFixed(0)}, Port=${d1.portfolio.toFixed(0)}, isFI=${d1.isFI}`);
    console.log(`  Second: Income=${d2.income.toFixed(0)}, Exp=${d2.expenses.toFixed(0)}, Sav=${d2.savings.toFixed(0)}, Port=${d2.portfolio.toFixed(0)}, isFI=${d2.isFI}`);
  }
}
