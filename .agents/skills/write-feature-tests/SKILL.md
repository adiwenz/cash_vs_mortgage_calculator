---
name: write-feature-tests
description: Automatically design and write automated tests for every newly implemented feature, component, or calculation module.
---
# Write Feature Tests

This skill ensures that whenever you implement a new feature, add a new calculation module, or introduce new logic, you must write a comprehensive test suite (or add cases to an existing test suite) to verify its behavior and correctness.

## Instructions

1. **Identify the Need for a Test**:
   - Every new feature, logic function, or calculation module must have corresponding automated tests.
   - Any significant changes to existing features should have updated or new test cases covering edge cases, standard behavior, and error conditions.

2. **Test File Conventions**:
   - Write tests in standard ES modules format, matching the pattern of existing tests (e.g., [test_recommendations.js](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/test_recommendations.js)).
   - Name new test files with the prefix `test_`, e.g., `test_<feature_name>.js`.
   - Include a simple assertion mechanism (such as an `assert(condition, message)` function) and run via standard `node <test_file>.js`. If a test fails, log the failure and exit with `process.exit(1)`. On success, exit with `process.exit(0)`.

3. **Integrate into Verification Suite**:
   - When a new test file is created, append it to the `test` script in [package.json](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/package.json) using `&& node test_<feature_name>.js`.
   - Update the command description in the `run-verification-tests` skill to include the new test.

4. **Verify Locally**:
   - Run the new test individually first to ensure its correct execution:
     ```bash
     node test_<feature_name>.js
     ```
   - Run the full verification suite via:
     ```bash
     npm test
     ```
   - Ensure all tests pass before finishing your task or presenting results to the user.
