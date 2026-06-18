import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getRebalanceStrategies } from './src/calculators/fire/rebalance.js';

describe('User Scenarios', () => {
  test('Outputs solved house prices and retirement sustainability', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    inputs.currentAge = 35;
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 85;
    inputs.includeTaxes = false; // Simple tax mode for clean math
    inputs.isAdvancedMode = true;
    inputs.spendingPhases = [];
    inputs.simpleIncome = 0;
    inputs.simpleExpenses = 0;
    inputs.simpleInvestments = 0;

    // Starting assets: 5000 in brokerage
    inputs.assets = {
      cash: 0,
      emergencyFund: 0,
      brokerage: 5000,
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      realEstate: 0,
      other: 0,
      debts: 0
    };

    // Income: 50000/yr (4167/mo)
    // Savings: 15% (625/mo)
    // Rent: 1200/mo
    // Basic Needs (food, etc.): 1500/mo
    // Wants: 842/mo (leisure = 281, diningOut = 281, misc = 280)
    inputs.budgetDetails = {
      phases: [
        {
          id: 'phase-ws-1',
          type: 'workSave',
          name: 'Before Purchase',
          startAge: 35,
          endAge: 40,
          savingsAllocMode: 'fixed',
          savings: {
            brokerage: 625
          },
          expenses: {
            housing: 1200,
            food: 1500,
            leisure: 281,
            diningOut: 281,
            misc: 280
          },
          income: 4167
        },
        {
          id: 'phase-ws-2',
          type: 'workSave',
          name: 'After Purchase',
          startAge: 40,
          endAge: 65,
          savingsAllocMode: 'fixed',
          savings: {
            brokerage: 625
          },
          expenses: {
            housing: 0, // Replaced by mortgage
            food: 1500,
            leisure: 281,
            diningOut: 281,
            misc: 280
          },
          income: 4167
        }
      ]
    };

    inputs.incomeList = [
      {
        id: 'inc-1',
        name: 'Salary',
        amount: 50000,
        frequency: 'yearly',
        startAge: 35,
        endAge: 65,
        growthRate: 0.03,
        isTaxable: true
      }
    ];

    // Buy a 500,000 house at age 40 with 100,000 down payment
    const buyHouseEvent = {
      id: 'buy-house-event',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000,
      purchaseType: 'mortgage',
      mortgageRate: 6.0,
      loanTerm: 30,
      propertyTax: 1.1,
      insurance: 0.35,
      maintenance: 1.0,
      utilitiesIncrease: 0,
      hoa: 0,
      pmi: 0,
      keepRent: false
    };

    inputs.lifeEvents = [buyHouseEvent];

    const beforeResults = runFireSimulation(inputs);
    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEvent, beforeResults.retirementReadyAge);

    console.log('\n==================================================');
    console.log('👤 USER SCENARIO SOLVER RESULTS');
    console.log('==================================================');
    console.log(`Original Proposed House Price: $500,000 (with $100,000 down)`);
    console.log(`Original Retirement Plan Achievable: ${beforeResults.moneyLasts && beforeResults.retirementReadyAge !== null ? 'Yes' : 'No'}`);
    console.log(`Original Retirement Age: ${beforeResults.retirementReadyAge !== null ? beforeResults.retirementReadyAge : 'N/A'}`);
    console.log('--------------------------------------------------');
    console.log('🛡️ COMFORTABLE (CONSERVATIVE) STRATEGY:');
    console.log(`  Solved House Price:         $${rebalanceData.affordablePriceConservative.toLocaleString()}`);
    console.log(`  Sustainable for Retirement: ${rebalanceData.isConservativeSustainable ? 'Yes' : 'No'}`);
    console.log(`  Retirement Age:             ${rebalanceData.conservativeRetirementAge !== null ? rebalanceData.conservativeRetirementAge : 'Not achievable'}`);
    console.log('--------------------------------------------------');
    console.log('⚖️ BALANCED STRATEGY:');
    console.log(`  Solved House Price:         $${rebalanceData.affordablePriceBalanced.toLocaleString()}`);
    console.log(`  Sustainable for Retirement: ${rebalanceData.isBalancedSustainable ? 'Yes' : 'No'}`);
    console.log(`  Retirement Age:             ${rebalanceData.balancedRetirementAge !== null ? rebalanceData.balancedRetirementAge : 'Not achievable'}`);
    console.log('--------------------------------------------------');
    console.log('🔥 STRETCH (AGGRESSIVE) STRATEGY:');
    console.log(`  Solved House Price:         $${rebalanceData.affordablePriceAggressive.toLocaleString()}`);
    console.log(`  Sustainable for Retirement: ${rebalanceData.isAggressiveSustainable ? 'Yes' : 'No'}`);
    console.log(`  Retirement Age:             ${rebalanceData.aggressiveRetirementAge !== null ? rebalanceData.aggressiveRetirementAge : 'Not achievable'}`);
    console.log('==================================================\n');

    expect(rebalanceData).toBeDefined();
  });
});
