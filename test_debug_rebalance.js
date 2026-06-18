import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getRebalanceStrategies } from './src/calculators/fire/rebalance.js';

describe('Debug Rebalance', () => {
  test('Runs debug', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));

    // Enable a buyHouse event like the one in the user scenario/screenshot:
    const buyHouseEvent = {
      id: 'buy-house-event',
      type: 'buyHouse',
      enabled: true,
      name: 'Buy a House',
      purchaseAge: 40,
      homePrice: 500000,
      downPayment: 100000, // 20%
      purchaseType: 'mortgage',
      mortgageRate: 6.5,
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
    inputs.targetRetirementAge = 65;
    inputs.lifeExpectancy = 75;
    inputs.includeTaxes = false; // Simple tax mode for clean math
    inputs.isAdvancedMode = false;

    const baselineInputs = JSON.parse(JSON.stringify(inputs));
    baselineInputs.lifeEvents = baselineInputs.lifeEvents.map(e => e.type === 'buyHouse' ? { ...e, enabled: false } : e);
    const baselineResults = runFireSimulation(baselineInputs);

    console.log('Baseline retirementReadyAge:', baselineResults.retirementReadyAge);
    console.log('Baseline moneyLasts:', baselineResults.moneyLasts);

    const rebalanceData = getRebalanceStrategies(inputs, buyHouseEvent, baselineResults.retirementReadyAge);
    console.log('Rebalance output:', {
      affordablePriceConservative: rebalanceData.affordablePriceConservative,
      isConservativeSustainable: rebalanceData.isConservativeSustainable,
      conservativeRetirementAge: rebalanceData.conservativeRetirementAge,
      liquidFundsAvailable: rebalanceData.liquidFundsAvailable,
      totalCashNeededConservative: rebalanceData.totalCashNeededConservative,
      deficit: rebalanceData.deficit
    });
    
    expect(rebalanceData).toBeDefined();
  });
});
