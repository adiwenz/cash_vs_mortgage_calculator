import { test, expect } from 'vitest';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { createMarriageEventObject, createSpouseRecord } from './src/domain/events/marriage/marriageEventFactory.js';

test('compare preview ages', () => {
  const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  inputs.currentAge = 35;
  inputs.lifeExpectancy = 85;
  inputs.targetRetirementAge = 65;
  inputs.simpleIncome = 50000;
  inputs.simpleExpenses = 42500;
  inputs.useLifeProfile = false; // Start in legacy mode

  const editingEvent = {
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

  // --- SIMULATE PREVIEW MODE 1: useLifeProfile remains false ---
  const afterInputs1 = {
    ...inputs,
    lifeEvents: [
      ...(inputs.lifeEvents || []).filter(e => e.type !== 'marriage'),
      {
        ...createMarriageEventObject(editingEvent, inputs),
        enabled: true
      }
    ],
    householdMembers: [
      ...(inputs.householdMembers || []).filter(m => m.id !== 'spouse'),
      {
        ...createSpouseRecord(editingEvent, inputs),
        desiredRetirementAge: null
      }
    ]
  };

  const res1 = runFireSimulation(afterInputs1);
  console.log("Preview Age 1 (useLifeProfile = false):", res1.retirementReadyAge);

  // --- SIMULATE PREVIEW MODE 2: useLifeProfile forced to true ---
  const afterInputs2 = {
    ...inputs,
    useLifeProfile: true, // Force true to run the profile normalizer
    lifeEvents: [
      ...(inputs.lifeEvents || []).filter(e => e.type !== 'marriage'),
      {
        ...createMarriageEventObject(editingEvent, inputs),
        enabled: true
      }
    ],
    householdMembers: [
      ...(inputs.householdMembers || []).filter(m => m.id !== 'spouse'),
      {
        ...createSpouseRecord(editingEvent, inputs),
        desiredRetirementAge: null
      }
    ]
  };

  const res2 = runFireSimulation(afterInputs2);
  console.log("Preview Age 2 (useLifeProfile = true):", res2.retirementReadyAge);

  expect(res2.retirementReadyAge).toBe(55);
});
