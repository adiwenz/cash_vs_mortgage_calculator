import { describe, test, expect } from 'vitest';
import {
  calculateTotalCashRequired,
  calculateLiquidAssetsAtPurchaseAge,
  calculateCashShortfall
} from './src/components/fire-simulator/houseAffordabilityUtils';

describe('House Cash Affordability Utilities', () => {
  test('calculateTotalCashRequired: calculates down payment, closing costs, points, renovation, and moving costs', () => {
    const event = {
      homePrice: 500000,
      downPayment: 100000,
      closingCosts: 3, // 3% of 500000 = 15000
      points: 2000,
      renovationCost: 25000,
      movingCost: 5000
    };
    // Expected: 100000 + 15000 + 2000 + 25000 + 5000 = 147000
    expect(calculateTotalCashRequired(event)).toBe(147000);
  });

  test('calculateTotalCashRequired: handles missing values with defaults', () => {
    const event = {
      homePrice: 300000,
      downPayment: 60000
      // closingCosts defaults to 3% = 9000
      // points, renovation, moving default to 0
    };
    expect(calculateTotalCashRequired(event)).toBe(69000);
  });

  test('calculateTotalCashRequired: supports renovationCosts and movingCosts aliases', () => {
    const event = {
      homePrice: 200000,
      downPayment: 40000,
      closingCosts: 2.5, // 2.5% of 200000 = 5000
      renovationCosts: 10000,
      movingCosts: 3000
    };
    // Expected: 40000 + 5000 + 10000 + 3000 = 58000
    expect(calculateTotalCashRequired(event)).toBe(58000);
  });

  test('calculateLiquidAssetsAtPurchaseAge: extracts projected liquid assets at purchase age', () => {
    const inputs = {
      currentAge: 35,
      assets: {
        cash: 10000,
        brokerage: 20000
      }
    };
    const simulationResults = {
      nominalData: [
        { age: 35, cashBalance: 11000, brokerageBalance: 21000 },
        { age: 37, cashBalance: 15000, brokerageBalance: 25000 },
        { age: 39, cashBalance: 20000, brokerageBalance: 30000 }
      ]
    };

    // Age 40 targets age 39: 20000 + 30000 = 50000
    expect(calculateLiquidAssetsAtPurchaseAge(inputs, 40, simulationResults)).toBe(50000);
    // Age 38 targets age 37: 15000 + 25000 = 40000
    expect(calculateLiquidAssetsAtPurchaseAge(inputs, 38, simulationResults)).toBe(40000);
  });

  test('calculateLiquidAssetsAtPurchaseAge: falls back to current assets if simulation results or nominalData are missing', () => {
    const inputs = {
      currentAge: 35,
      assets: {
        cash: 10000,
        brokerage: 20000
      }
    };

    expect(calculateLiquidAssetsAtPurchaseAge(inputs, 40, null)).toBe(30000);
    expect(calculateLiquidAssetsAtPurchaseAge(inputs, 40, {})).toBe(30000);
  });

  test('calculateCashShortfall: calculates shortfall correctly', () => {
    expect(calculateCashShortfall(150000, 100000)).toBe(50000);
    expect(calculateCashShortfall(80000, 100000)).toBe(0);
    expect(calculateCashShortfall(100000, 100000)).toBe(0);
  });
});
