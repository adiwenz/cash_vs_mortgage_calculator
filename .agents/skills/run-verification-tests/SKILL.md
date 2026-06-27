---
name: run-verification-tests
description: Automatically run changed verification tests after making code changes to prevent regressions.
---
# Run Verification Tests on Change

This skill ensures that whenever you modify, create, or delete any source code, component, calculation module, or test in this repository, you must execute the changed verification tests (only targeting the changed files and changed E2E tests, i.e., `npx playwright test --only-changed=main` for Playwright, not the whole Playwright test suite) before ending your turn or presenting results to the user.

## Instructions

1. **Active Development Unit Validation**:
   - If the modified file is a test file, run it directly:
     ```bash
     npm run test -- <test-file>
     ```
   - If the modified files are source files, run Vitest targeting only the related tests:
     ```bash
     npm run test:related -- <modified-source-files>
     ```
     Inspect the output to ensure the affected tests pass. Do not run Vitest in watch mode.
     *Note: Ignore non-testable files like markdown, docs, snapshots, lockfiles, CSS, and generated output.*

2. **Fallback Workflow for Unit Tests**:
   - If `npm run test:related` finds no related tests, follow this strict fallback order:
     1. Run the nearest targeted test file by path/name if one exists.
     2. Run the relevant package/module test suite if a nearby test file cannot be identified.
     3. If no targeted test is discoverable, explicitly report:
        - which modified files had no related tests,
        - why no targeted fallback was available,
        - what broader verification command will cover the change.
        Only then proceed.
     - **Never** treat "no related tests found" as a green/successful test result.

3. **E2E Changed Validation (Playwright)**:
   - For Playwright end-to-end tests, only run changed tests relative to the main branch when code is changed:
     ```bash
     npm run test:e2e:changed
     ```
   - Do NOT run the whole Playwright test suite (`npm run test:e2e`) when code is changed during development.

4. **Broader/Full-Suite Validation**:
   - The full test suite (`npm run test:unit` and optionally `npm run test:e2e`) is automatically executed by the `git-commit-and-merge` skill during checkout cleanup.
   - Avoid running the full suite manually during development iterations unless:
     - Explicitly requested by the user.
     - Preparing a final release/build verification.
     - A broader validation command is required due to no targeted tests being found.
