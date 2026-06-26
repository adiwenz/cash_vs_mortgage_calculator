// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { runFireSimulation } from './src/fireCalculations.js';
import { initializeLifePlanIfMissing, deriveLegacyInputsFromLifePlan } from './src/models/lifePlan/lifePlanNormalization.js';
import { marriageEventHandler } from './src/features/fire/events/handlers/marriageEventHandler.js';
import { getSaveUpdates } from './src/components/fire-simulator/life-profile/lifeProfileSaveAdapter.js';
import { restoreSinglePersonBudgetAfterPartnerRemoval } from './src/models/lifePlan/restoreSinglePersonBudget.js';
import useLifeProfileDraft from './src/components/fire-simulator/life-profile/useLifeProfileDraft.js';

describe('Partner Delete Budget Regression Tests', () => {
  const getBaseInputs = () => {
    return {
      currentAge: 35,
      lifeExpectancy: 85,
      targetRetirementAge: 65,
      simpleIncome: 50000,
      simpleExpenses: 42500,
      simpleInvestments: 10000,
      savingsRate: 15,
      displayedSavingsRate: 15,
      useLifeProfile: true,
      hasCustomizedBudget: false,
      hasCustomizedSavingsAllocation: false,
      lifeProfile: {
        household: { status: 'single', partnerIncome: 0 },
        assets: { brokerage: 10000 },
        children: [],
        debts: [],
        incomeSources: []
      },
      budgetDetails: {
        savings: {
          brokerage: 625,
          trad401k: 0,
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 1500,
          utilities: 300,
          food: 400,
          transportation: 400,
          diningOut: 200,
          leisure: 300,
          misc: 441
        },
        savingsAllocMode: 'fixed'
      },
      lifeEvents: []
    };
  };

  it('restores the single baseline budget correctly after adding and deleting a partner', () => {
    // 1. Start baseline
    const inputs = getBaseInputs();

    // Run baseline simulation
    const baselineSim = runFireSimulation(inputs);
    const baselineAge = baselineSim.workOptionalAge;
    
    // Store baseline values
    const baselineIncome = inputs.simpleIncome;
    const baselineSavingsRate = inputs.savingsRate;
    const baselineAnnualSavings = Object.values(inputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0) * 12;
    const baselineAnnualSpending = inputs.simpleExpenses;

    // 2. Add partner
    const marriageEvent = {
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      name: 'Marriage Event',
      age: 40,
      spouseCurrentAge: 35,
      spouseLifeExpectancy: 80,
      spouseIncome: 60000,
      filingStatus: 'jointly',
      savingsRate: 15,
      livingTogether: true,
      combineFinances: true
    };

    // Save marriage event using marriageEventHandler
    const saveResult = marriageEventHandler.save(marriageEvent, inputs);
    let inputsWithPartner = saveResult.updatedInputs;

    // Initialize lifePlan with partner
    let lifePlan = initializeLifePlanIfMissing(inputsWithPartner);
    inputsWithPartner.lifePlan = lifePlan;

    // Run derive legacy inputs from lifePlan
    const derivedWithPartner = deriveLegacyInputsFromLifePlan(lifePlan, inputsWithPartner);
    inputsWithPartner = {
      ...inputsWithPartner,
      ...derivedWithPartner
    };

    // Simulate the budget corruption that happens during partner lifecycle
    inputsWithPartner.hasCustomizedSavingsAllocation = true;
    inputsWithPartner.hasCustomizedBudget = true;
    inputsWithPartner.simpleExpenses = 50000;
    inputsWithPartner.budgetDetails.savings = {
      brokerage: 0,
      trad401k: 0,
      rothIra: 0,
      tradIra: 0,
      hsa: 0,
      checking: 0,
      hysa: 0,
      emergency: 0,
      debt: 0,
      other: 0
    };

    // 3. Delete partner through cascade delete (using marriageEventHandler.delete)
    const marriageEventInInputs = inputsWithPartner.lifeEvents.find(e => e.id === 'marriage-1');
    const deleteResult = marriageEventHandler.delete(marriageEventInInputs, inputsWithPartner);
    let afterDeleteInputs = deleteResult.updatedInputs;

    // Assert immediately on saved inputs, before simulation:
    expect(afterDeleteInputs.displayedSavingsRate).toBe(15);
    expect(afterDeleteInputs.savingsRate).toBe(15);
    expect(afterDeleteInputs.simpleExpenses).toBe(42500);
    const sumSavings = Object.values(afterDeleteInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
    expect(sumSavings).toBeGreaterThan(0);

    // Derive legacy inputs after deletion to trigger budget reconciliation
    const derivedAfterDelete = deriveLegacyInputsFromLifePlan(afterDeleteInputs.lifePlan, afterDeleteInputs);
    const finalInputs = {
      ...afterDeleteInputs,
      ...derivedAfterDelete
    };

    // Run simulation again
    const afterDeleteSim = runFireSimulation(finalInputs);

    // Assert:
    expect(finalInputs.simpleIncome).toBe(baselineIncome);
    expect(finalInputs.savingsRate).toBe(baselineSavingsRate);
    
    const afterDeleteAnnualSavings = Object.values(finalInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0) * 12;
    expect(afterDeleteAnnualSavings).toBe(baselineAnnualSavings);
    expect(finalInputs.simpleExpenses).toBe(baselineAnnualSpending);
    expect(afterDeleteSim.workOptionalAge).toBe(baselineAge);

    // Also assert first year snapshots:
    const firstYear = afterDeleteSim.nominalData[0];
    expect(Math.round(firstYear.income)).toBe(50000);
    expect(Math.round(firstYear.expenses)).toBe(42500);
    expect(Math.round(firstYear.savings)).toBe(7500);
  });

  it('does not invent savings rate or repair budget if the user intentionally had a 0% savings rate', () => {
    // Start baseline with 0% savings rate
    const inputs = getBaseInputs();
    inputs.simpleExpenses = 50000;
    inputs.savingsRate = 0;
    inputs.displayedSavingsRate = 0;
    inputs.budgetDetails.savings = {
      brokerage: 0,
      trad401k: 0,
      rothIra: 0,
      tradIra: 0,
      hsa: 0,
      checking: 0,
      hysa: 0,
      emergency: 0,
      debt: 0,
      other: 0
    };
    inputs.budgetDetails.expenses = {
      housing: 1500,
      utilities: 300,
      food: 400,
      transportation: 400,
      diningOut: 200,
      leisure: 300,
      misc: 1067
    };

    // Add partner
    const marriageEvent = {
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      name: 'Marriage Event',
      age: 40,
      spouseCurrentAge: 35,
      spouseLifeExpectancy: 80,
      spouseIncome: 60000,
      filingStatus: 'jointly',
      savingsRate: 15,
      livingTogether: true,
      combineFinances: true
    };

    const saveResult = marriageEventHandler.save(marriageEvent, inputs);
    let inputsWithPartner = saveResult.updatedInputs;

    let lifePlan = initializeLifePlanIfMissing(inputsWithPartner);
    inputsWithPartner.lifePlan = lifePlan;

    const derivedWithPartner = deriveLegacyInputsFromLifePlan(lifePlan, inputsWithPartner);
    inputsWithPartner = {
      ...inputsWithPartner,
      ...derivedWithPartner
    };

    // Simulate budget corruption with 0% savings rate
    inputsWithPartner.hasCustomizedSavingsAllocation = true;
    inputsWithPartner.hasCustomizedBudget = true;
    inputsWithPartner.simpleExpenses = 50000;
    inputsWithPartner.budgetDetails.savings = {
      brokerage: 0,
      trad401k: 0,
      rothIra: 0,
      tradIra: 0,
      hsa: 0,
      checking: 0,
      hysa: 0,
      emergency: 0,
      debt: 0,
      other: 0
    };

    // Delete partner
    const marriageEventInInputs = inputsWithPartner.lifeEvents.find(e => e.id === 'marriage-1');
    const deleteResult = marriageEventHandler.delete(marriageEventInInputs, inputsWithPartner);
    let afterDeleteInputs = deleteResult.updatedInputs;

    const derivedAfterDelete = deriveLegacyInputsFromLifePlan(afterDeleteInputs.lifePlan, afterDeleteInputs);
    afterDeleteInputs = {
      ...afterDeleteInputs,
      ...derivedAfterDelete
    };

    // Assert that the 0% savings rate is preserved and NOT repaired/invented to 15%
    const totalSavings = Object.values(afterDeleteInputs.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
    expect(totalSavings).toBe(0);
    expect(afterDeleteInputs.savingsRate).toBe(0);
    expect(afterDeleteInputs.simpleExpenses).toBe(50000);
  });

  it('getSaveUpdates preserves the pre-delete savings rate as a protected value when cascade deleting a partner', () => {
    // 1. Start baseline
    const inputs = getBaseInputs();

    // 2. Add partner
    const marriageEvent = {
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      name: 'Marriage Event',
      age: 40,
      spouseCurrentAge: 35,
      spouseLifeExpectancy: 80,
      spouseIncome: 60000,
      filingStatus: 'jointly',
      savingsRate: 15,
      livingTogether: true,
      combineFinances: true
    };

    const saveResult = marriageEventHandler.save(marriageEvent, inputs);
    let inputsWithPartner = saveResult.updatedInputs;

    let lifePlan = initializeLifePlanIfMissing(inputsWithPartner);
    inputsWithPartner.lifePlan = lifePlan;

    const derivedWithPartner = deriveLegacyInputsFromLifePlan(lifePlan, inputsWithPartner);
    inputsWithPartner = {
      ...inputsWithPartner,
      ...derivedWithPartner
    };

    // Simulate budget corruption with partner
    inputsWithPartner.hasCustomizedBudget = true;
    inputsWithPartner.simpleExpenses = 50000;
    inputsWithPartner.budgetDetails.savings = {
      brokerage: 0,
      trad401k: 0,
      rothIra: 0,
      tradIra: 0,
      hsa: 0,
      checking: 0,
      hysa: 0,
      emergency: 0,
      debt: 0,
      other: 0
    };

    // 3. Capture baseline savings rate right before deletion flow
    const protectedPreDeleteSavingsRate =
      inputsWithPartner.displayedSavingsRate && inputsWithPartner.displayedSavingsRate > 0
        ? inputsWithPartner.displayedSavingsRate
        : inputsWithPartner.savingsRate && inputsWithPartner.savingsRate > 0
          ? inputsWithPartner.savingsRate
          : inputsWithPartner.derivedSavingsRate && inputsWithPartner.derivedSavingsRate > 0
            ? inputsWithPartner.derivedSavingsRate
            : null;

    // Simulate the deletion payload updates
    const marriageEventInInputs = inputsWithPartner.lifeEvents.find(e => e.id === 'marriage-1');
    const deleteResult = marriageEventHandler.delete(marriageEventInInputs, inputsWithPartner, protectedPreDeleteSavingsRate);
    const updates = {
      lifePlan: deleteResult.updatedInputs.lifePlan,
      lifeEvents: deleteResult.updatedInputs.lifeEvents,
      householdMembers: deleteResult.updatedInputs.householdMembers,
      displayedSavingsRate: deleteResult.updatedInputs.displayedSavingsRate,
      savingsRate: deleteResult.updatedInputs.savingsRate,
      simpleExpenses: deleteResult.updatedInputs.simpleExpenses,
      budgetDetails: deleteResult.updatedInputs.budgetDetails,
      allocationRules: deleteResult.updatedInputs.allocationRules,
      hasCustomizedSavingsAllocation: deleteResult.updatedInputs.hasCustomizedSavingsAllocation,
      hasCustomizedBudget: deleteResult.updatedInputs.hasCustomizedBudget
    };

    // Call getSaveUpdates with protectedPreDeleteSavingsRate
    const finalPayload = getSaveUpdates(updates, inputsWithPartner, protectedPreDeleteSavingsRate);

    // Assert that the final object passed to updateInput contains the expected restored budget values:
    expect(finalPayload.displayedSavingsRate).toBe(15);
    expect(finalPayload.savingsRate).toBe(15);
    expect(finalPayload.simpleExpenses).toBe(42500);
  });

  it('focused unit test for restoreSinglePersonBudgetAfterPartnerRemoval with corrupted conflicting state', () => {
    const inputs = {
      simpleIncome: 50000,
      simpleExpenses: 50000,
      savingsRate: 0,
      displayedSavingsRate: 0,
      spendingPhases: [{ id: "spend-1", annualSpending: 42500 }],
      budgetDetails: {
        savings: {
          brokerage: 0,
          trad401k: 0,
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 1500,
          utilities: 300,
          food: 400,
          transportation: 400,
          diningOut: 200,
          leisure: 300,
          misc: 1067
        },
        savingsAllocMode: 'fixed'
      },
      lifePlan: {
        objects: [], // no partner
        events: []
      },
      householdMembers: [] // no partner
    };

    const restored = restoreSinglePersonBudgetAfterPartnerRemoval(inputs, {
      protectedPreDeleteSavingsRate: 15
    });

    expect(restored.simpleExpenses).toBe(42500);
    expect(restored.savingsRate).toBe(15);
    expect(restored.displayedSavingsRate).toBe(15);
    const sumSavings = Object.values(restored.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
    expect(sumSavings).toBeGreaterThan(0);
  });

  it('integration test: useLifeProfileDraft hook save path triggers restoreSinglePersonBudgetAfterPartnerRemoval on partner delete', () => {
    const inputs = getBaseInputs();
    
    // Setup inputs with marriage event & spouse objects
    const marriageEvent = {
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      name: 'Marriage Event',
      age: 40,
      spouseCurrentAge: 35,
      spouseLifeExpectancy: 80,
      spouseIncome: 60000,
      filingStatus: 'jointly',
      savingsRate: 15,
      livingTogether: true,
      combineFinances: true
    };
    
    const saveResult = marriageEventHandler.save(marriageEvent, inputs);
    let inputsWithPartner = saveResult.updatedInputs;
    let lifePlan = initializeLifePlanIfMissing(inputsWithPartner);
    inputsWithPartner.lifePlan = lifePlan;
    
    // Simulate budget corruption with partner
    inputsWithPartner.displayedSavingsRate = 0;
    inputsWithPartner.savingsRate = 0;
    inputsWithPartner.simpleExpenses = 50000;
    inputsWithPartner.budgetDetails.savings = {
      brokerage: 0,
      trad401k: 0,
      rothIra: 0,
      tradIra: 0,
      hsa: 0,
      checking: 0,
      hysa: 0,
      emergency: 0,
      debt: 0,
      other: 0
    };
    inputsWithPartner.spendingPhases = [{ id: "spend-1", annualSpending: 42500 }];

    const updateInputMock = vi.fn();

    // Render the hook
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        onClose: () => {},
        inputs: inputsWithPartner,
        updateInput: updateInputMock,
        initialTab: 'lifeItems',
        isMobile: false
      })
    );

    // Prepare deletion updates (remove spouse from householdMembers, update lifePlan to remove spouse)
    const updatedEventsList = [];
    const cleanObjects = inputsWithPartner.lifePlan.objects.filter(o => o.id !== 'spouse-partner' && o.type !== 'relationship');
    const updatedPlan = {
      ...inputsWithPartner.lifePlan,
      objects: cleanObjects,
      events: []
    };
    const updatedHouseholdMembers = [];

    // Trigger save using hook's triggerSave (as is done in LifeItemsWorkspace deletion path)
    const rateToUse = 15; // protectedPreDeleteSavingsRate
    
    act(() => {
      result.current.triggerSave({
        lifePlan: updatedPlan,
        lifeEvents: updatedEventsList,
        householdMembers: updatedHouseholdMembers
      }, rateToUse);
    });

    expect(updateInputMock).toHaveBeenCalled();
    const finalPayload = updateInputMock.mock.calls[0][0];

    // Assert that the final object passed to updateInput contains the expected restored budget values:
    expect(finalPayload.displayedSavingsRate).toBe(15);
    expect(finalPayload.savingsRate).toBe(15);
    expect(finalPayload.simpleExpenses).toBe(42500);
    const sumSavings = Object.values(finalPayload.budgetDetails.savings).reduce((sum, v) => sum + v, 0);
    expect(sumSavings).toBeGreaterThan(0);
  });

  it('correctly runs the full idempotent cycle of single -> add -> delete -> re-add partner', () => {
    // 1. Start single baseline
    const inputs = getBaseInputs();
    inputs.currentAge = 35;
    inputs.simpleIncome = 50000;
    inputs.simpleExpenses = 42500;
    inputs.savingsRate = 15;
    inputs.displayedSavingsRate = 15;
    inputs.budgetDetails.savings.brokerage = 625;

    const singleResult = runFireSimulation(inputs);

    // 2. Add partner
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
    const firstPartnerResult = runFireSimulation(derivedWithPartner1);

    // 3. Delete partner
    const cleanObjects = lifePlan1.objects.filter(o => o.id !== 'spouse-partner' && o.type !== 'relationship');
    const updatedPlan = {
      ...lifePlan1,
      objects: cleanObjects,
      events: []
    };

    const deleteUpdates = getSaveUpdates({
      lifePlan: updatedPlan,
      lifeEvents: [],
      householdMembers: []
    }, inputsWithPartner1, 15);

    // Verify single baseline restored
    expect(deleteUpdates.simpleExpenses).toBe(42500);
    expect(deleteUpdates.savingsRate).toBe(15);
    const singleResult2 = runFireSimulation(deleteUpdates);
    expect(singleResult2.workOptionalAge).toBe(singleResult.workOptionalAge);

    // 4. Add equivalent partner again
    const secondSave = marriageEventHandler.save(marriageEvent, deleteUpdates);
    let inputsWithPartner2 = secondSave.updatedInputs;
    let lifePlan2 = initializeLifePlanIfMissing(inputsWithPartner2);
    inputsWithPartner2.lifePlan = lifePlan2;

    let derivedWithPartner2 = deriveLegacyInputsFromLifePlan(lifePlan2, inputsWithPartner2);
    const secondPartnerResult = runFireSimulation(derivedWithPartner2);

    // 5. Assert regression requirements
    expect(secondPartnerResult.workOptionalAge).toBe(firstPartnerResult.workOptionalAge);

    const firstYear = secondPartnerResult.nominalData[0];
    expect(firstYear.income).toBeCloseTo(100000, -3);
    expect(firstYear.expenses).toBeCloseTo(73540, -2);
    expect(firstYear.savings).toBeCloseTo(firstPartnerResult.nominalData[0].savings, -2);
    expect(firstYear.expenses).not.toBe(42500);
  });

  it('repairs stale 0% rate to 15% when simpleExpenses: 42500 is inconsistent', () => {
    const inputs = {
      simpleIncome: 50000,
      simpleExpenses: 42500,
      savingsRate: 0,
      displayedSavingsRate: 0,
      spendingPhases: [{ id: 'spend-1', annualSpending: 42500 }],
      budgetDetails: {
        savings: { brokerage: 0 },
        expenses: { housing: 1500, utilities: 300, food: 400, transportation: 400, diningOut: 200, leisure: 300, misc: 142 }
      },
      lifePlan: {
        objects: [],
        events: []
      }
    };
    const derived = deriveLegacyInputsFromLifePlan(inputs.lifePlan, inputs);
    expect(derived.savingsRate).toBe(15);
    expect(derived.displayedSavingsRate).toBe(15);
  });

  it('preserves intentional 0% rate when simpleExpenses: 50000', () => {
    const inputs = {
      simpleIncome: 50000,
      simpleExpenses: 50000,
      savingsRate: 0,
      displayedSavingsRate: 0,
      spendingPhases: [{ id: 'spend-1', annualSpending: 50000 }],
      budgetDetails: {
        savings: { brokerage: 0 },
        expenses: { housing: 1500, utilities: 300, food: 400, transportation: 400, diningOut: 200, leisure: 300, misc: 767 }
      },
      lifePlan: {
        objects: [],
        events: []
      }
    };
    const derived = deriveLegacyInputsFromLifePlan(inputs.lifePlan, inputs);
    expect(derived.savingsRate).toBe(0);
    expect(derived.displayedSavingsRate).toBe(0);
  });
});
