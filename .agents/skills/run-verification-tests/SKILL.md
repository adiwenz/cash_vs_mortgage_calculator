---
name: run-verification-tests
description: Automatically run all verification tests after making any code changes to prevent regressions.
---
# Run Verification Tests on Change

This skill ensures that whenever you modify, create, or delete any source code, component, calculation module, or test in this repository, you must execute the verification test suite before ending your turn or presenting results to the user.

## Instructions

1. **Active Development Mode (Continuous Watch)**:
   - During active development, keep Vitest running persistently in changed watch mode:
     ```bash
     npx vitest --changed
     ```
     (or `npm run test:watch`).
   - After each code edit, inspect the existing Vitest watch output instead of launching a new full unit test run. Vitest will detect changed files automatically and rerun only affected tests.

2. **One-Time Related Unit Validation**:
   - If a persistent terminal session is not available, run Vitest targeting only the modified files:
     ```bash
     npx vitest related <changed files>
     ```
     (or `npm run test:unit:related <changed files>`). Avoid running the full suite `npm run test:unit` during development iterations.

3. **E2E Changed Validation (Playwright)**:
   - For Playwright end-to-end tests, default to running only changed tests relative to the main branch:
     ```bash
     npx playwright test --only-changed=main
     ```
     (or `npm run test:e2e:changed`).

4. **Broader/Full-Suite Validation**:
   - Only run the full E2E suite (`npm run test:e2e:full` / `npx playwright test`) or full unit test suite (`npm run test:unit`) when:
     - Explicitly requested by the user.
     - Preparing a final release/build verification.
     - The branch is about to be merged into `main`.
     - The changed-test command indicates broader validation is required.
