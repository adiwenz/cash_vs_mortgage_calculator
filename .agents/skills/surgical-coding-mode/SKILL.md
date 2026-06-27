---
name: surgical-coding-mode
description: Make coding tasks faster and safer by avoiding broad refactors, unnecessary full test runs, dependency churn, and repeated failure loops.
---
# Surgical Coding Mode

## Purpose
Make coding tasks faster and safer by avoiding broad refactors, unnecessary full test runs, dependency churn, and repeated failure loops.

## Behavior
When this skill is active, or when performing coding tasks under Surgical Coding Mode, adhere strictly to the following rules:

1. **Scope First**
   - Identify the smallest likely set of files needed.
   - Modify only those files unless clearly impossible.
   - Do not refactor unrelated code.
   - Do not rename public APIs unless explicitly requested.
   - Preserve backwards compatibility with existing legacy inputs and tests.

2. **Test Efficiently**
   - Do not run the full test suite after every edit.
   - Do not use `vitest --changed` or `npm run test:changed` as the default iteration command.
   - During active development edit/test/fix loops, identify the modified files:
     - **If the modified file is a test file**, run that test file directly:
       ```bash
       npm run test -- <test-file>
       ```
     - **If the modified files are source files**, run the tests related to them:
       ```bash
       npm run test:related -- <modified-source-files>
       ```
       (Ignore non-testable files like markdown, docs, snapshots, lockfiles, pure CSS, and generated outputs when building the file list).
   
   - **Strict Fallback Workflow** (if `npm run test:related` finds no related tests):
     1. Run the nearest targeted test file by name/path if one exists.
     2. Run the relevant package/module test suite if a nearby test file cannot be identified.
     3. If no targeted test is discoverable, explicitly report:
        - which modified files had no related tests,
        - why no targeted fallback was available,
        - what broader verification command will cover the change.
        Only after reporting this may you proceed. Do NOT silently proceed.
     - **Never** treat "no related tests found" as a green/successful test result.

   - Run broader tests (e.g., Playwright E2E changes, full suite verification) only after the targeted/related tests pass.
   - Run the full suite only at the very end of the task, or when explicitly requested.

   **Preferred test order**:
   1. Related test run (`npm run test:related -- <modified-source-files>`) or targeted test run (`npm run test -- <test-file>`)
   2. Fallback targeted/module test run (if no related tests found)
   3. Broader verification tests
   4. Full suite last

3. **Avoid Slow Churn**
   - Do not add dependencies unless absolutely necessary.
   - Do not edit `package.json` or lockfiles unless required.
   - Do not reformat unrelated files.
   - Do not rebuild the entire app unless the task requires it.
   - Avoid snapshot rewrites unless the UI intentionally changed.

4. **Failure Loop Control**
   - If the same test fails twice, stop patching blindly.
   - Summarize:
     - What failed
     - What was tried
     - Likely root cause
     - Recommended next step
   - Do not keep making speculative edits.

5. **Report Clearly**
   - At the end of the task, provide:
     - Files changed
     - Behavior changed
     - Tests run
     - Tests not run
     - Any known risks or follow-up needed

## Default Instruction
Make the smallest correct change. Prefer surgical fixes over rewrites. Verify narrowly first, broadly last.
