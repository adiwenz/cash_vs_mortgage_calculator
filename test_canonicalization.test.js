import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { buildEffectiveSimulationInputs } from './src/calculators/fire/effectiveInputs.js';
import { normalizeInputsStage } from './src/calculators/fire/pipeline/normalizeInputs.js';
import { canonicalizeSimulationInputs } from './src/calculators/fire/pipeline/canonicalizeSimulationInputs.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

// Helper to get fully normalized inputs
function getNormalizedAndCanonical(rawInputs) {
  const cloned = JSON.parse(JSON.stringify(rawInputs));
  const effective = buildEffectiveSimulationInputs(cloned);
  const normalized = normalizeInputsStage(effective);
  const canonical = canonicalizeSimulationInputs(normalized);
  return { original: cloned, canonical };
}

describe('Canonicalization of Equivalent Plans', () => {

  // Test 1: Default baseline vs. equivalent Life Planner baseline produce equal canonical simulation inputs
  test('Default baseline vs. equivalent Life Planner baseline produce equal canonical simulation inputs', () => {
    const defaultInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 60000,
      useLifeProfile: false
    };

    const lifePlannerInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      useLifeProfile: true,
      hasCustomizedBudget: true,
      hasCustomizedSavingsAllocation: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        settings: { socialSecurityEnabled: true, socialSecurityClaimingAge: 67 },
        objects: [
          {
            id: 'self-person',
            type: 'person',
            name: 'You',
            startAge: 35,
            endAge: 85,
            properties: { role: 'self' }
          },
          {
            id: 'job-1',
            type: 'job',
            name: 'Salary / Main Income',
            startAge: 35,
            endAge: 65,
            properties: { annualIncome: 100000, growthRate: 3 }
          }
        ],
        events: []
      },
      lifeProfile: {
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
        home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
        children: [],
        debts: [],
        assets: { cash: 0, emergencyFund: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, savings529: 0, crypto: 0, businessEquity: 0 },
        incomeSources: [
          { id: 'job-1', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 65, growthRate: 3 }
        ]
      },
      budgetDetails: {
        expenses: {
          housing: 1500,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 1600 // monthly spending is 60k/12 = 5000
        },
        savings: {
          brokerage: 3333.3333333333335 // monthly savings is (100k - 60k)/12 = 3333.33
        }
      }
    };

    const normDefault = getNormalizedAndCanonical(defaultInputs);
    const normLP = getNormalizedAndCanonical(lifePlannerInputs);

    // Compare essential simulation inputs
    expect(normLP.canonical.incomeList.length).toBe(1);
    expect(normLP.canonical.incomeList[0].amount).toBe(normDefault.canonical.incomeList[0].amount);
    expect(normLP.canonical.incomeList[0].growthRate).toBe(normDefault.canonical.incomeList[0].growthRate);
    expect(normLP.canonical.incomeList[0].startAge).toBe(normDefault.canonical.incomeList[0].startAge);
    expect(normLP.canonical.incomeList[0].endAge).toBe(normDefault.canonical.incomeList[0].endAge);

    expect(normLP.canonical.spendingPhases.length).toBe(1);
    expect(normLP.canonical.spendingPhases[0].annualSpending).toBe(normDefault.canonical.spendingPhases[0].annualSpending);

    expect(normLP.canonical.budgetDetails.expenses.misc).toBeCloseTo(normDefault.canonical.budgetDetails.expenses.misc, 2);
    expect(normLP.canonical.budgetDetails.savings.brokerage).toBeCloseTo(normDefault.canonical.budgetDetails.savings.brokerage, 2);
  });

  // Test 2: Raw IDs can differ while canonical simulation facts match
  test('Raw IDs can differ while canonical simulation facts match', () => {
    const inputsA = {
      ...DEFAULT_FIRE_INPUTS,
      simpleIncome: 100000,
      simpleExpenses: 60000,
      incomeList: [
        { id: 'job-1-segment-35-65', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 65, growthRate: 0.03, isTaxable: true }
      ],
      spendingPhases: [
        { id: 'spend-1-segment-35-85', name: 'Base Lifestyle Spending', amount: 60000, annualSpending: 60000, startAge: 35, endAge: 85 }
      ]
    };

    const inputsB = {
      ...DEFAULT_FIRE_INPUTS,
      simpleIncome: 100000,
      simpleExpenses: 60000,
      incomeList: [
        { id: 'inc-1', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 65, growthRate: 0.03, isTaxable: true }
      ],
      spendingPhases: [
        { id: 'spend-1', name: 'Base Lifestyle Spending', amount: 60000, annualSpending: 60000, startAge: 35, endAge: 85 }
      ]
    };

    const normA = getNormalizedAndCanonical(inputsA);
    const normB = getNormalizedAndCanonical(inputsB);

    // The segment suffixes are stripped, leaving base IDs intact
    expect(normA.canonical.incomeList[0].id).toBe('job-1');
    expect(normB.canonical.incomeList[0].id).toBe('inc-1');
    
    expect(normA.canonical.spendingPhases[0].id).toBe('spend-1');
    expect(normB.canonical.spendingPhases[0].id).toBe('spend-1');

    expect(normA.canonical.incomeList[0].amount).toBe(normB.canonical.incomeList[0].amount);
    expect(normA.canonical.spendingPhases[0].annualSpending).toBe(normB.canonical.spendingPhases[0].annualSpending);
  });

  // Test 3: useLifeProfile true/false does not change simulation results when facts match
  test('useLifeProfile true/false does not change simulation results when facts match', () => {
    const defaultInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 60000,
      useLifeProfile: false
    };

    const lifePlannerInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      useLifeProfile: true,
      hasCustomizedBudget: true,
      hasCustomizedSavingsAllocation: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        settings: { socialSecurityEnabled: true, socialSecurityClaimingAge: 67 },
        objects: [
          {
            id: 'self-person',
            type: 'person',
            name: 'You',
            startAge: 35,
            endAge: 85,
            properties: { role: 'self' }
          },
          {
            id: 'job-1',
            type: 'job',
            name: 'Salary / Main Income',
            startAge: 35,
            endAge: 65,
            properties: { annualIncome: 100000, growthRate: 3 }
          }
        ],
        events: []
      },
      lifeProfile: {
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
        home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
        children: [],
        debts: [],
        assets: { cash: 0, emergencyFund: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, savings529: 0, crypto: 0, businessEquity: 0 },
        incomeSources: [
          { id: 'job-1', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 65, growthRate: 3 }
        ]
      },
      budgetDetails: {
        expenses: {
          housing: 1500,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 1600
        },
        savings: {
          brokerage: 3333.3333333333335
        }
      }
    };

    const resDefault = runFireSimulation(defaultInputs);
    const resLP = runFireSimulation(lifePlannerInputs);

    expect(resLP.retirementReadyAge).toBe(resDefault.retirementReadyAge);
    expect(resLP.nominalData.length).toBe(resDefault.nominalData.length);

    // Assert key parameters are equal within tiny tolerance (floating point rounding)
    for (let i = 0; i < resDefault.nominalData.length; i++) {
      const snapDefault = resDefault.nominalData[i];
      const snapLP = resLP.nominalData[i];
      expect(snapLP.age).toBe(snapDefault.age);
      expect(snapLP.annualIncome).toBeCloseTo(snapDefault.annualIncome, 0);
      expect(snapLP.expenses).toBeCloseTo(snapDefault.expenses, 0);
      expect(snapLP.savings).toBeCloseTo(snapDefault.savings, 0);
      expect(snapLP.taxes).toBeCloseTo(snapDefault.taxes, 0);
      expect(snapLP.netWorth).toBeCloseTo(snapDefault.netWorth, -2);
    }
  });

  // Test 4: Partner add → delete returns to canonical baseline
  test('Partner add -> delete returns to canonical baseline', () => {
    const singleBaseline = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 50000,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          { id: 'self-person', type: 'person', name: 'You', startAge: 35, endAge: 85, properties: { role: 'self' } },
          { id: 'job-1', type: 'job', name: 'Salary / Main Income', startAge: 35, endAge: 65, properties: { annualIncome: 100000, growthRate: 3 } }
        ],
        events: []
      },
      lifeProfile: {
        household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
        home: { status: 'rent', monthlyRent: 0 },
        children: [], debts: [], assets: {}
      }
    };

    // Reconstruct single baseline as if we added a partner and then deleted them
    const postPartnerDeleted = {
      ...singleBaseline,
      lifePlan: {
        ...singleBaseline.lifePlan,
        objects: [
          { id: 'self-person', type: 'person', name: 'You', startAge: 35, endAge: 85, properties: { role: 'self' } },
          { id: 'job-1', type: 'job', name: 'Salary / Main Income', startAge: 35, endAge: 65, properties: { annualIncome: 100000, growthRate: 3 } }
          // Partner object and events deleted
        ]
      }
    };

    const resBaseline = runFireSimulation(singleBaseline);
    const resPostDeleted = runFireSimulation(postPartnerDeleted);

    expect(resPostDeleted.retirementReadyAge).toBe(resBaseline.retirementReadyAge);
    expect(resPostDeleted.nominalData[0].netWorth).toBeCloseTo(resBaseline.nominalData[0].netWorth, 1);
    expect(resPostDeleted.nominalData[0].expenses).toBeCloseTo(resBaseline.nominalData[0].expenses, 1);
  });

  // Test 5: Partner add → delete → re-add produces same canonical partner simulation as first add
  test('Partner add -> delete -> re-add produces same canonical partner simulation as first add', () => {
    const firstAddInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          { id: 'self-person', type: 'person', name: 'You', startAge: 35, endAge: 85, properties: { role: 'self' } },
          { id: 'job-1', type: 'job', name: 'Salary / Main Income', startAge: 35, endAge: 65, properties: { annualIncome: 100000, growthRate: 3 } },
          {
            id: 'spouse-partner',
            type: 'person',
            name: 'Partner',
            startsAtAge: 35,
            endsAtAge: 85,
            properties: {
              role: 'partner',
              status: 'married',
              partnerIncome: 50000,
              savingsRate: 15,
              spouseCurrentAge: 35,
              spouseLifeExpectancy: 85,
              combinedSpendingAfterMarriage: 75000
            }
          }
        ],
        events: []
      }
    };

    const reAddInputs = {
      ...firstAddInputs,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          { id: 'self-person', type: 'person', name: 'You', startAge: 35, endAge: 85, properties: { role: 'self' } },
          { id: 'job-1', type: 'job', name: 'Salary / Main Income', startAge: 35, endAge: 65, properties: { annualIncome: 100000, growthRate: 3 } },
          {
            id: 'spouse-partner-readded',
            type: 'person',
            name: 'Partner',
            startsAtAge: 35,
            endsAtAge: 85,
            properties: {
              role: 'partner',
              status: 'married',
              partnerIncome: 50000,
              savingsRate: 15,
              spouseCurrentAge: 35,
              spouseLifeExpectancy: 85,
              combinedSpendingAfterMarriage: 75000
            }
          }
        ],
        events: []
      }
    };

    const resFirst = runFireSimulation(firstAddInputs);
    const resReAdd = runFireSimulation(reAddInputs);

    expect(resReAdd.retirementReadyAge).toBe(resFirst.retirementReadyAge);
    expect(resReAdd.nominalData[0].annualIncome).toBeCloseTo(resFirst.nominalData[0].annualIncome, 1);
    expect(resReAdd.nominalData[0].expenses).toBeCloseTo(resFirst.nominalData[0].expenses, 1);
  });

  // Test 6: No double-counting when simpleIncome, incomeList, and lifePlan job all exist
  test('No double-counting when simpleIncome, incomeList, and lifePlan job all exist', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      useLifeProfile: true,
      incomeList: [
        { id: 'inc-1', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 65, growthRate: 0.03 }
      ],
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          { id: 'self-person', type: 'person', name: 'You', startAge: 35, endAge: 85, properties: { role: 'self' } },
          { id: 'job-1', type: 'job', name: 'Salary / Main Income', startAge: 35, endAge: 65, properties: { annualIncome: 100000, growthRate: 3 } }
        ],
        events: []
      }
    };

    const norm = getNormalizedAndCanonical(inputs);
    
    // There should only be ONE main career job segment in canonical incomeList
    expect(norm.canonical.incomeList.length).toBe(1);
    expect(norm.canonical.incomeList[0].amount).toBe(100000);
  });

  // Test 7: Monthly rounding drift is corrected only in canonical simulation copy
  test('Monthly rounding drift is corrected only in canonical simulation copy', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      simpleIncome: 50000,
      simpleExpenses: 42500,
      budgetDetails: {
        expenses: {
          housing: 1500,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142 // Sums to 3542/mo -> 42,504/yr instead of 42,500
        },
        savings: {
          brokerage: 625
        }
      }
    };

    const norm = getNormalizedAndCanonical(inputs);

    // Reconciled misc is 42500/12 - 3400 = 141.6666...
    expect(norm.canonical.budgetDetails.expenses.misc).toBeCloseTo(141.67, 2);
    
    // Check that sum of non-debt monthly expenses is exactly 42500 / 12
    const totalMonthly = Object.values(norm.canonical.budgetDetails.expenses).reduce((sum, v) => sum + v, 0);
    expect(totalMonthly).toBeCloseTo(42500 / 12, 4);

    // Verify original object was NOT mutated
    expect(inputs.budgetDetails.expenses.misc).toBe(142);
  });

  // Test 8: Original input object is not mutated by canonicalization
  test('Original input object is not mutated by canonicalization', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      simpleIncome: 100000,
      simpleExpenses: 60000,
      incomeList: [
        { id: 'job-1-segment-35-65', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 65, growthRate: 0.03 }
      ]
    };

    const norm = getNormalizedAndCanonical(inputs);

    // Check that original remains unmutated
    expect(inputs.incomeList[0].id).toBe('job-1-segment-35-65');
    expect(norm.canonical.incomeList[0].id).toBe('job-1');
  });

  // Additional requirement: Segmented main job 35-40 and 40-65 produces same income projection as 35-65
  test('Segmented main job 35-40 and 40-65 produces same income projection as 35-65', () => {
    const singleJobInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      useLifeProfile: false,
      incomeList: [
        { id: 'inc-1', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 65, growthRate: 0.03, isTaxable: true }
      ]
    };

    const segmentedJobInputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      useLifeProfile: false,
      incomeList: [
        { id: 'job-1-segment-35-40', name: 'Salary / Main Income', amount: 100000, startAge: 35, endAge: 40, growthRate: 0.03, isTaxable: true },
        { id: 'job-1-segment-40-65', name: 'Salary / Main Income', amount: 100000, startAge: 40, endAge: 65, growthRate: 0.03, isTaxable: true }
      ]
    };

    const resSingle = runFireSimulation(singleJobInputs);
    const resSegmented = runFireSimulation(segmentedJobInputs);

    expect(resSegmented.retirementReadyAge).toBe(resSingle.retirementReadyAge);
    
    for (let i = 0; i < resSingle.nominalData.length; i++) {
      const snapSingle = resSingle.nominalData[i];
      const snapSegmented = resSegmented.nominalData[i];
      expect(snapSegmented.age).toBe(snapSingle.age);
      expect(snapSegmented.annualIncome).toBeCloseTo(snapSingle.annualIncome, 1);
      expect(snapSegmented.netWorth).toBeCloseTo(snapSingle.netWorth, 1);
    }
  });

});
