---
name: run-verification-tests
description: Automatically run changed verification tests after making code changes to prevent regressions.
---
# Run Verification Tests on Change

This skill ensures that whenever you modify, create, or delete any source code, component, calculation module, or test in this repository, you must execute targeted verification tests before presenting results to the user.

## Instructions

### 1. Batch Edits Before Testing
Do **not** run tests after every individual file edit. Instead, structure your workflow to group related changes:
- Make one or more logically related code changes.
- Finish the current implementation batch.
- Then execute the appropriate targeted verification once.

*Examples of a single implementation batch:*
- Fixing one bug across several files.
- Completing one refactor.
- Implementing one feature.
- Updating both implementation and its associated test.

Avoid interrupting active coding solely to run tests after each saved file.

### 2. Targeted Unit Testing
After completing an implementation batch:
- **If only test files changed:**
  - Run the modified test file directly:
    ```bash
    npm run test -- <test-file>
    ```
- **If source files changed:**
  - Run Vitest targeting only the related tests:
    ```bash
    npm run test:related -- <modified-source-files>
    ```
- Do **not** use watch mode.
- Ignore non-testable files when building the file list:
  - markdown
  - documentation
  - snapshots
  - lockfiles
  - CSS
  - generated files

### 3. Fallback Behavior
If `npm run test:related` reports no related tests, follow this strict fallback order:
1. Run the nearest targeted test file by path/name if one exists.
2. Otherwise, run the nearest package/module test suite.
3. If neither exists, explain to the user why broader validation is necessary and run the smallest reasonable verification command.
- **Never** treat "no related tests found" as a passing/successful test result.

### 4. Playwright Policy
Do **not** run Playwright automatically for every implementation batch. Only run Playwright when:
- User-visible behavior changed
- Navigation changed
- Interaction flows changed
- Routing changed
- Pages/components covered by E2E tests changed
- The user explicitly requests it

When Playwright is appropriate, use only:
```bash
npm run test:e2e:changed
```
Never run the full Playwright suite during normal iterative development.

### 5. Full Test Suite
Never run the following commands during normal iterative development:
```bash
npm run test
npm run test:unit
npm run test:e2e
```
Unless:
- The user explicitly requests it.
- Preparing a release.
- Preparing to merge.
- The `git-commit-and-merge` skill invokes it.

### 6. Definition of Done
A coding task is complete only after the appropriate targeted verification has passed. However, verification should happen **once per coherent implementation batch**, not after every file edit.

The preferred workflow is:
```
Understand task
      ↓
Plan implementation
      ↓
Edit multiple related files
      ↓
Run one targeted verification
      ↓
Fix failures (if any)
      ↓
Repeat if necessary
      ↓
Report completion
```
instead of:
```
Edit file → Run tests → Edit next file → Run tests → Edit next file → Run tests
```
