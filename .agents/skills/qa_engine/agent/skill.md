---
name: qa_engine
description: Skill for running the QA check on code changes using vitest related.
---

# QA Engine Skill

This skill defines the `/qa-check` command used by the **@QA** agent to run tests and output reports.

## Command: /qa-check

### Description
Runs the configured test command, captures output, and generates reports.

### Hardcoded Test Command
- `npx vitest related $(git diff --name-only) --run`

### Execution Details
1. Execute the command: `npx vitest related $(git diff --name-only) --run` (or run verification against changed files).
2. Capture both `stdout` and `stderr` outputs.
3. Determine if the tests passed or failed.
4. Generate the appropriate report:
   - **On Pass**: Write a success report to `.agents/artifacts/qa_pass_report.md`.
   - **On Fail**: Write a detailed failure context and logs to `.agents/artifacts/bug_trace.md`.

### Rules for the QA Agent
- **No Source Code Modification**: The QA agent must never modify source code in the main application directories (e.g., `src/`).
- **Test Suitability**: The QA agent is allowed to add or update tests *only* when a failure indicates missing coverage or an incorrect test expectation. If this is done, the agent must write a clear explanation of why the test was added/updated.
