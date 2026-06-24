import formatCompactCurrency from './src/utils/formatCompactCurrency.js';

console.log('--- Running formatCompactCurrency Unit Tests ---');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

try {
  // Test Cases
  const cases = [
    { input: 543, expected: '$543' },
    { input: 5432, expected: '$5.4K' },
    { input: 54321, expected: '$54K' },
    { input: 543216, expected: '$543K' },
    { input: 5432168, expected: '$5.4M' },
    { input: 54321678, expected: '$54M' },
    { input: 543216789, expected: '$543M' },
    { input: 5432167890, expected: '$5.4B' },
    { input: 5000000, expected: '$5M' },
    { input: 510000, expected: '$510K' },
    { input: -54321678, expected: '-$54M' },
    { input: -543, expected: '-$543' },
    { input: 54000000, expected: '$54M' },
    { input: 950, expected: '$950' },
    { input: 1200, expected: '$1.2K' },
    { input: 1500000, expected: '$1.5M' },
    { input: -4200, expected: '-$4.2K' },
    { input: 0, expected: '$0' },
    { input: null, expected: '$0' },
    { input: undefined, expected: '$0' },
    { input: 1e15, expected: '$1Q' },
    { input: 1.2e15, expected: '$1.2Q' },
    { input: 1e18, expected: '$1Qi' },
    { input: 1.5e18, expected: '$1.5Qi' },
    { input: 1e21, expected: '$1Sx' },
    { input: 1.2e24, expected: '$1.2e+24' },
    { input: -1.2e24, expected: '-$1.2e+24' },
    { input: Infinity, expected: '$—' },
    { input: -Infinity, expected: '$—' },
    { input: NaN, expected: '$—' }
  ];

  cases.forEach(({ input, expected }, idx) => {
    const result = formatCompactCurrency(input);
    console.log(`Case ${idx + 1}: input=${input} -> got="${result}", expected="${expected}"`);
    assert(result === expected, `Expected "${expected}" but got "${result}" for input ${input}`);
  });

  console.log('✅ ALL formatCompactCurrency UNIT TESTS PASSED!');
  process.exit(0);
} catch (error) {
  console.error('❌ formatCompactCurrency tests failed:', error.message);
  process.exit(1);
}
