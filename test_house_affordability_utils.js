/* global process */
import { expect } from './test_helper.js';
import { 
  getAvailableLiquidAssetsAtPurchaseAge, 
  calculateAffordableHomePrice 
} from './src/components/fire-simulator/houseAffordabilityUtils.js';

console.log('--- Running test_house_affordability_utils ---');

try {
  // 1. Correct liquid asset calculation from simulation results
  const mockSimulationResults = {
    nominalData: [
      { age: 39, cashBalance: 50000, brokerageBalance: 150000 },
      { age: 40, cashBalance: 60000, brokerageBalance: 200000 }
    ]
  };

  const mockInputs = {
    currentAge: 35,
    assets: {
      cash: 10000,
      brokerage: 30000
    }
  };

  const liquidAssetsAt40 = getAvailableLiquidAssetsAtPurchaseAge(mockInputs, 40, mockSimulationResults);
  // Should look at age 39 log: 50000 + 150000 = 200000
  expect(liquidAssetsAt40).toBe(200000);

  // 2. Correct fallback behavior when simulationResults is missing or entry is not found
  const fallbackAssets = getAvailableLiquidAssetsAtPurchaseAge(mockInputs, 35, null);
  // Should use mockInputs.assets: 10000 + 30000 = 40000
  expect(fallbackAssets).toBe(40000);

  // Fallback when log entry is missing
  const fallbackAssetsMissingEntry = getAvailableLiquidAssetsAtPurchaseAge(mockInputs, 50, mockSimulationResults);
  expect(fallbackAssetsMissingEntry).toBe(40000);

  // Fallback when inputs.assets has missing values (defaults to 0)
  const emptyInputs = { currentAge: 35 };
  const fallbackEmpty = getAvailableLiquidAssetsAtPurchaseAge(emptyInputs, 35, null);
  expect(fallbackEmpty).toBe(0);

  // 3. Correct affordable home price calculation
  // E.g. $100,000 liquid assets, 20% down payment
  const price1 = calculateAffordableHomePrice({ liquidAssets: 100000, downPaymentPercent: 20 });
  expect(price1).toBe(500000);

  // 4. Zero-percent handling
  const priceZeroPct = calculateAffordableHomePrice({ liquidAssets: 100000, downPaymentPercent: 0 });
  expect(priceZeroPct).toBe(0);

  // Negative down payment percent
  const priceNegPct = calculateAffordableHomePrice({ liquidAssets: 100000, downPaymentPercent: -5 });
  expect(priceNegPct).toBe(0);

  // 5. Zero-assets handling
  const priceZeroAssets = calculateAffordableHomePrice({ liquidAssets: 0, downPaymentPercent: 20 });
  expect(priceZeroAssets).toBe(0);

  // Negative liquid assets
  const priceNegAssets = calculateAffordableHomePrice({ liquidAssets: -1000, downPaymentPercent: 20 });
  expect(priceNegAssets).toBe(0);

  // 6. Rounding safety: newDownPayment <= liquidAssets must always be true
  // Let's test with tricky percentage (e.g. 15%)
  const priceTricky = calculateAffordableHomePrice({ liquidAssets: 80000, downPaymentPercent: 15 });
  // Mathematically, 80000 / 0.15 = 533333.33
  // If we floor to 533333:
  // Down payment = Math.round(533333 * 0.15) = Math.round(79999.95) = 80000.
  // 80000 <= 80000 is true.
  const dpTricky = Math.round(priceTricky * 0.15);
  expect(dpTricky <= 80000).toBe(true);

  // Test with down payment percentage = 3% and liquidAssets = 10000
  const priceTricky2 = calculateAffordableHomePrice({ liquidAssets: 10000, downPaymentPercent: 3 });
  // 10000 / 0.03 = 333333.33
  // Down payment = Math.round(333333 * 0.03) = 10000.
  const dpTricky2 = Math.round(priceTricky2 * 0.03);
  expect(dpTricky2 <= 10000).toBe(true);

  console.log('✅ test_house_affordability_utils passed.');
  process.exit(0);
} catch (error) {
  console.error('❌ test_house_affordability_utils failed:', error.stack);
  process.exit(1);
}
