import { test } from 'vitest';

// Register a dummy test so Vitest recognizes these self-executing files as valid test suites
test('Self-executing test script runs successfully', () => {
  // The actual assertions run during module import.
  // If they fail, they throw an exception which fails the suite.
  // If they pass, this dummy test passes.
});

// Mock process.exit so Vitest doesn't abort during watch mode or execution.
// process.exit(0) is allowed to exit cleanly, and non-zero exit codes throw to report test failure.
process.exit = (code) => {
  if (code !== 0) {
    throw new Error(`process.exit called with non-zero code: ${code}`);
  }
};
