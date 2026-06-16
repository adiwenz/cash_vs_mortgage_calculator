---
name: run-verification-tests
description: Automatically run changed verification tests after making code changes to prevent regressions.
---
# Run Verification Tests on Change

This skill ensures that whenever you modify, create, or delete any source code, component, calculation module, or test in this repository, you must execute the changed verification tests (only targeting the changed files and changed E2E tests, i.e., `npx playwright test --only-changed=main` for Playwright, not the whole Playwright test suite) before ending your turn or presenting results to the user.

## Instructions

1. **Active Development Unit Validation**:
   - After each code edit, run a one-time execution of Vitest targeting only the changed files:
     ```bash
     npm run test:changed
     ```
     Inspect the output to ensure the affected tests pass. Do not run Vitest in watch mode.

2. **One-Time Related Unit Validation**:
   - If git changes are not staged/committed, run Vitest targeting only the modified files:
     ```bash
     npx vitest related <changed files>
     ```
     Avoid running the full suite `npm run test:unit` during development iterations.

3. **E2E Changed Validation (Playwright)**:
   - For Playwright end-to-end tests, only run changed tests relative to the main branch when code is changed:
     ```bash
     npm run test:e2e:changed
     ```
   - Do NOT run the whole Playwright test suite (`npm run test:e2e`) when code is changed during development.

4. **Broader/Full-Suite Validation**:
   - Only run the full E2E suite (`npm run test:e2e`) or full unit test suite (`npm run test:unit`) when:
     - Explicitly requested by the user.
     - Preparing a final release/build verification.
     - The branch is about to be merged into `main`.
     - The changed-test command indicates broader validation is required.
