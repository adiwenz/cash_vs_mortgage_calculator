import { runFireSimulation } from './src/fireCalculations.js';
import { getProfileFromInputs, getEventsFromInputs } from './src/calculators/fire/normalizeInputs.js';
import { useTimelineEvents } from './src/hooks/useTimelineEvents.js';
import { test, expect } from 'vitest';
import fs from 'fs';

test('debug timeline events', () => {
  const inputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    expectedReturn: 7,
    inflationRate: 3,
    simpleIncome: 100000,
    simpleExpenses: 50000,
    readinessCriteria: 'lastsComfortable',
    lifeEvents: [
      {
        id: 'buy-house',
        type: 'buyHouse',
        enabled: true,
        purchaseAge: 40,
        homePrice: 500000,
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 6.5,
        loanTerm: 30,
        houseId: 'house-1'
      }
    ],
    houseAssets: [
      {
        id: 'house-1',
        homePrice: 500000,
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 6.5,
        loanTerm: 30
      }
    ]
  };

  const results = runFireSimulation(inputs);
  const output = `
RETIREMENT READY AGE COMFORTABLE: ${results.retirementReadyAgeComfortable}
RETIREMENT READY AGE: ${results.retirementReadyAge}
RUN OUT AGE: ${results.runOutAge}
`;
  fs.writeFileSync('test_debug_output.txt', output);
});
