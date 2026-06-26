import { test } from 'vitest';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { marriageEventHandler } from './src/features/fire/events/handlers/marriageEventHandler.js';
import { initializeLifePlanIfMissing, deriveLegacyInputsFromLifePlan } from './src/models/lifePlan/lifePlanNormalization.js';

test('compare lifeProfile true vs false', () => {
  const inputsBase = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  inputsBase.currentAge = 35;
  inputsBase.lifeExpectancy = 85;
  inputsBase.targetRetirementAge = 65;
  inputsBase.simpleIncome = 50000;
  inputsBase.simpleExpenses = 42500;

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

  // 1. Run with useLifeProfile = false
  const inputsFalse = { ...inputsBase, useLifeProfile: false };
  const saveFalse = marriageEventHandler.save(marriageEvent, inputsFalse);
  const resFalse = runFireSimulation(saveFalse.updatedInputs);

  // 2. Run with useLifeProfile = true
  const inputsTrue = { ...inputsBase, useLifeProfile: true };
  const saveTrue = marriageEventHandler.save(marriageEvent, inputsTrue);
  let inputsWithPartner1 = saveTrue.updatedInputs;
  let lifePlan1 = initializeLifePlanIfMissing(inputsWithPartner1);
  inputsWithPartner1.lifePlan = lifePlan1;
  let derivedWithPartner1 = deriveLegacyInputsFromLifePlan(lifePlan1, inputsWithPartner1);
  let finalInputsTrue = { ...inputsWithPartner1, ...derivedWithPartner1 };
  const resTrue = runFireSimulation(finalInputsTrue);

  console.log("FALSE MODE READY AGE:", resFalse.retirementReadyAge);
  console.log("TRUE MODE READY AGE:", resTrue.retirementReadyAge);

  console.log("\n=== COMPARE FALSE VS TRUE MODE ===");
  for (let age = 35; age <= 65; age++) {
    const dF = resFalse.nominalData.find(d => d.age === age);
    const dT = resTrue.nominalData.find(d => d.age === age);
    if (!dF || !dT) continue;
    console.log(`Age ${age}:`);
    console.log(`  False (58): Income=${dF.income.toFixed(0)}, Exp=${dF.expenses.toFixed(0)}, Sav=${dF.savings.toFixed(0)}, Port=${dF.portfolio.toFixed(0)}`);
    console.log(`  True (55):  Income=${dT.income.toFixed(0)}, Exp=${dT.expenses.toFixed(0)}, Sav=${dT.savings.toFixed(0)}, Port=${dT.portfolio.toFixed(0)}`);
  }
});
