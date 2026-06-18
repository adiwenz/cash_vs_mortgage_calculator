// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { getNormalizedPhases } from './src/calculators/fire/phases.js';
import { getActiveDebtsForAge } from './src/calculators/fire/debts.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Debt & Budget Integration', () => {
  let baseInputs;

  beforeEach(() => {
    baseInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    delete baseInputs.hasCustomizedSavingsAllocation;
    baseInputs.lifeEvents = baseInputs.lifeEvents || [];
    baseInputs.houseAssets = baseInputs.houseAssets || [];
    baseInputs.debtList = baseInputs.debtList || [];
    baseInputs.currentConditions = baseInputs.currentConditions || [];
  });

  test('Adding debt creates a Needs budget item', () => {
    // 1. Initially no debts active at current age
    const activeDebtsBefore = getActiveDebtsForAge(baseInputs, baseInputs.currentAge);
    expect(activeDebtsBefore.length).toBe(0);

    // 2. Add a student loan
    const loanEvent = {
      id: 'borrow-student',
      type: 'borrowing',
      borrowingType: 'studentLoan',
      name: 'Student Loan',
      balance: 20000,
      interestRate: 5.0,
      minPayment: 212.13,
      startAge: baseInputs.currentAge,
      isExisting: true,
      enabled: true
    };
    baseInputs.lifeEvents.push(loanEvent);

    // 3. Verify it shows up as an active debt
    const activeDebtsAfter = getActiveDebtsForAge(baseInputs, baseInputs.currentAge);
    expect(activeDebtsAfter.length).toBe(1);
    expect(activeDebtsAfter[0].name).toBe('Student Loan');
    expect(activeDebtsAfter[0].monthlyPayment).toBe(212);
    expect(activeDebtsAfter[0].icon).toBe('🎓');

    // 4. Verify derivePhasesFromEvents inserts it into expenses with a debt_ prefix
    const phases = getNormalizedPhases(baseInputs);
    const currentPhase = phases.find(p => baseInputs.currentAge >= p.startAge && baseInputs.currentAge < p.endAge);
    expect(currentPhase).toBeDefined();
    expect(currentPhase.expenses['debt_borrow-student']).toBe(212);
  });

  test('Debt payments reduce available savings in simulation', () => {
    // Run simulation baseline (no debts)
    const baselineResults = runFireSimulation(baseInputs);
    const baselineYear0 = baselineResults.nominalData[0];

    // Add a personal loan
    const loanEvent = {
      id: 'borrow-personal',
      type: 'borrowing',
      borrowingType: 'personalLoan',
      name: 'Personal Loan',
      balance: 10000,
      interestRate: 6.0,
      minPayment: 300,
      startAge: baseInputs.currentAge,
      isExisting: true,
      enabled: true
    };
    baseInputs.lifeEvents.push(loanEvent);

    // Run simulation with debt
    const debtResults = runFireSimulation(baseInputs);
    const debtYear0 = debtResults.nominalData[0];

    // Verify simulation minimum debt payment was logged
    expect(debtYear0.minDebtPayment).toBeCloseTo(300 * 12, 0);

    // Verify liquid worth / portfolio value is lower in the debt simulation
    // since some cash flow was diverted to pay the debt
    const baselineLiquid = baselineYear0.portfolio;
    const debtLiquid = debtYear0.portfolio;
    expect(debtLiquid).toBeLessThan(baselineLiquid);
  });

  test('Debt payoff removes the payment from Needs and updates projections', () => {
    // Add a car loan with a 1-year term (amortized standard payment)
    const carLoan = {
      id: 'borrow-car',
      type: 'borrowing',
      borrowingType: 'carLoan',
      name: 'Car Loan',
      balance: 3000,
      interestRate: 0,
      minPayment: 250, // 3000 / 12 = 250
      startAge: 35,
      isExisting: true,
      enabled: true
    };
    baseInputs.currentAge = 35;
    baseInputs.lifeExpectancy = 40;
    baseInputs.targetRetirementAge = 38;
    baseInputs.lifeEvents.push(carLoan);

    // Verify active at age 35
    const activeAt35 = getActiveDebtsForAge(baseInputs, 35);
    expect(activeAt35.length).toBe(1);

    // Verify paid off and inactive at age 36
    const activeAt36 = getActiveDebtsForAge(baseInputs, 36);
    expect(activeAt36.length).toBe(0);

    // Verify simulation logs debt payoff milestone and debt free age
    const result = runFireSimulation(baseInputs);
    const milestone = result.dynamicMilestones.find(m => m.type === 'debtPayoff');
    expect(milestone).toBeDefined();
    expect(milestone.age).toBe(35); // paid off during age 35
  });

  test('Existing budgets Wants and Savings allocations are not silently modified when debt is added', () => {
    baseInputs.hasCustomizedSavingsAllocation = true;
    // Add default budget details
    baseInputs.budgetDetails = {
      savings: {
        trad401k: 200,
        rothIra: 100,
        brokerage: 300
      },
      expenses: {
        housing: 1500,
        leisure: 300,
        diningOut: 200
      }
    };

    // Keep track of original allocations
    const origWantsLeisure = baseInputs.budgetDetails.expenses.leisure;
    const origWantsDiningOut = baseInputs.budgetDetails.expenses.diningOut;
    const origSavings401k = baseInputs.budgetDetails.savings.trad401k;
    const origSavingsRoth = baseInputs.budgetDetails.savings.rothIra;

    // Add a CC debt
    const ccDebt = {
      id: 'borrow-cc',
      type: 'borrowing',
      borrowingType: 'creditCard',
      name: 'Credit Card',
      balance: 5000,
      interestRate: 18.0,
      minPayment: 150,
      startAge: baseInputs.currentAge,
      isExisting: true,
      enabled: true
    };
    baseInputs.lifeEvents.push(ccDebt);

    // Verify phases are normalized and the wants/savings are untouched
    const phases = getNormalizedPhases(baseInputs);
    const currentPhase = phases.find(p => baseInputs.currentAge >= p.startAge && baseInputs.currentAge < p.endAge);
    
    // Check wants are preserved
    expect(currentPhase.expenses.leisure).toBe(origWantsLeisure);
    expect(currentPhase.expenses.diningOut).toBe(origWantsDiningOut);

    // Check savings are preserved
    expect(currentPhase.savings.trad401k).toBe(origSavings401k);
    expect(currentPhase.savings.rothIra).toBe(origSavingsRoth);

    // Check new debt item is present in Needs
    expect(currentPhase.expenses['debt_borrow-cc']).toBe(150);
  });
});
