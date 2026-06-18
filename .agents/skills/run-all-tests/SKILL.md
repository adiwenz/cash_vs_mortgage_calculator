---
name: run-all-tests
description: Run the complete test suite (all unit, component, and E2E tests) to fully verify all changes.
---
# Run All Tests

This skill outlines how to run the full test suite in the repository to thoroughly verify all changes. It should be used before merging to main, before final releases, or upon user request.

## Instructions

1. **Run All Unit & Component Tests**:
   - Execute the full Vitest suite to verify all component and calculation tests:
     ```bash
     npm run test
     ```
     (or `npm run test:unit`)

2. **Run All E2E Tests**:
   - Execute all Playwright end-to-end tests:
     ```bash
     npm run test:e2e
     ```

3. **When to Execute**:
   - When preparing a final release or build verification.
   - When explicitly requested by the user.
   - *Note: The `git-commit-and-merge` skill automatically runs the full test suite before committing/merging, so manual execution of this skill is not required immediately before merging.*
