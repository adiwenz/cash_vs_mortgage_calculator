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
   - First run the most relevant targeted test file.
   - If there is no obvious test, run the narrowest related test command.
   - Run broader tests only after the targeted test passes.
   - Run the full suite only at the end, or when explicitly requested.

   **Preferred test order**:
   1. Targeted unit/component test
   2. Related feature test
   3. Lint/typecheck only if relevant
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
