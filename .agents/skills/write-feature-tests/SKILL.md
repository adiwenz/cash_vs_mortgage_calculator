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
   - Include a simple assertion mechanism (such as an `assert(condition, message)` function) and run via standard `node <test_file>.js` or `npx vitest run test_<feature_name>.js`.

3. **Integrate into Verification Suite**:
   - When a new test file is created, append it to the legacy `test` script in [package.json](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/package.json) using `&& node test_<feature_name>.js`.
   - Ensure it is matched by the Vitest configuration (`test_*.js`).

4. **Verify Locally**:
   - Run Vitest targeting only the related tests for the modified source files:
     ```bash
     npm run test:related -- <modified-source-files>
     ```
     Or, if the modified file is a test file, run it directly:
     ```bash
     npm run test -- <test-file>
     ```
   - Avoid executing full suites (`npm run test:unit`, `npm run test:e2e`) manually during development.
   - For Playwright E2E tests, only run changed tests relative to the main branch when code is changed: `npm run test:e2e:changed`. Do NOT run the whole Playwright test suite (`npm run test:e2e`) during development.
