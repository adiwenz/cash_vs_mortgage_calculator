import { 
  calculateRetireAt65Recommendation, 
  calculateSaveMoreRecommendation, 
  calculateEarnMoreRecommendation 
} from './src/recommendations.js';

console.log('--- Running Retirement Recommendations Helper Tests ---');

// helper assertion function
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

// ----------------------------------------------------
// 1. Test calculateSaveMoreRecommendation
// ----------------------------------------------------
console.log('Testing calculateSaveMoreRecommendation...');

// Case A: Standard case 50% (shortfall = 100,000, rate = 0.07, years = 10, targetPercentage = 0.5)
// Target = 50,000
// fvFactor = ((1.07)^10 - 1) / 0.07 = 13.81644796
// Expected savings = 50,000 / 13.81644796 = 3618.87486
const resA_50 = calculateSaveMoreRecommendation(100000, 0.07, 10, 0.5);
console.log(`- Standard 50% case: shortfall 100k, 7% return, 10 years: ${resA_50.toFixed(2)} (expected ~3618.87)`);
assert(Math.abs(resA_50 - 3618.87486) < 0.01, '50% savings calculation is incorrect');

// Case B: Standard case 100% (shortfall = 100,000, rate = 0.07, years = 10, targetPercentage = 1.0)
// Target = 100,000
// Expected savings = 100,000 / 13.81644796 = 7237.74972
const resB_100 = calculateSaveMoreRecommendation(100000, 0.07, 10, 1.0);
const resB_default = calculateSaveMoreRecommendation(100000, 0.07, 10); // defaults to 1.0
console.log(`- Standard 100% case: ${resB_100.toFixed(2)} (expected ~7237.75)`);
assert(Math.abs(resB_100 - 7237.74972) < 0.01, '100% savings calculation is incorrect');
assert(resB_100 === resB_default, 'Default percentage should be 1.0');

// Case C: Zero interest rate case (100% target)
const resC = calculateSaveMoreRecommendation(100000, 0, 10, 1.0);
console.log(`- Zero interest case: ${resC} (expected 10000)`);
assert(resC === 10000, 'Zero rate 100% savings calculation is incorrect');

// Case D: Shortfall <= 0 case
const resD = calculateSaveMoreRecommendation(0, 0.07, 10);
assert(resD === 0, 'Should return 0 savings if shortfall <= 0');

console.log('✅ Save More Recommendation tests passed.');

// ----------------------------------------------------
// 2. Test calculateEarnMoreRecommendation
// ----------------------------------------------------
console.log('Testing calculateEarnMoreRecommendation...');

// Case A: Standard case 50% (shortfall = 100,000, rate = 0.07, years = 10, tax = 0.25, percentage = 0.5)
const earnA_50 = calculateEarnMoreRecommendation(100000, 0.07, 10, 0.25, 0.5);
console.log(`- Standard 50% case: shortfall 100k, 25% tax: ${earnA_50.toFixed(2)} (expected ~4825.17)`);
assert(Math.abs(earnA_50 - 4825.16648) < 0.01, '50% gross earnings calculation is incorrect');

// Case B: Standard case 100% (shortfall = 100,000, rate = 0.07, years = 10, tax = 0.25, percentage = 1.0)
const earnB_100 = calculateEarnMoreRecommendation(100000, 0.07, 10, 0.25, 1.0);
console.log(`- Standard 100% case: shortfall 100k, 25% tax: ${earnB_100.toFixed(2)} (expected ~9650.33)`);
assert(Math.abs(earnB_100 - 9650.33296) < 0.01, '100% gross earnings calculation is incorrect');

console.log('✅ Earn More Recommendation tests passed.');

// ----------------------------------------------------
// 3. Test calculateRetireAt65Recommendation
// ----------------------------------------------------
console.log('Testing calculateRetireAt65Recommendation...');

const r65A = calculateRetireAt65Recommendation(35, 65, 100000, 15000, 0.07, 0.04, 40000);
assert(r65A.applicable === false, 'Should be not applicable if target retirement age is already 65');

const r65B = calculateRetireAt65Recommendation(35, 50, 100000, 15000, 0.07, 0.04, 40000);
assert(r65B.applicable === true, 'Should be applicable');
assert(r65B.resolvesShortfall === true, 'Should resolve shortfall');

console.log('✅ Retire at 65 Recommendation tests passed.');

console.log('--- ALL RETIREMENT RECOMMENDATIONS HELPER TESTS PASSED ---');
process.exit(0);
