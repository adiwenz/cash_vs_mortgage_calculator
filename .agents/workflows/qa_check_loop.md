# QA Check Loop Workflow

This document outlines the interaction cycle between `@Developer` and `@QA` in the multi-agent system.

## Workflow Sequence

1. **Propose/Implement**: `@Developer` proposes or implements a change in the application source code.
2. **QA Trigger**: `@QA` automatically triggers the `/qa-check` command (defined in the `qa-check` skill).
3. **Execution & Report**:
   - If all tests pass, `@QA` writes `.agents/artifacts/qa_pass_report.md` indicating a clean status.
   - If tests fail, `@QA` writes `.agents/artifacts/bug_trace.md` capturing the error logs, stack trace, and failing test context, and returns this context to `@Developer`.
4. **Iterative Fix**: `@Developer` uses the context from `bug_trace.md` to fix the issue.
5. **Repeat**: Steps 2–4 are repeated until all tests pass successfully or the workflow hits a clearly documented blocker.

## Important Loop Rules

- **No Legacy Modes**: Do not introduce feature flags, legacy compatibility paths, or compatibility wrappers unless explicitly requested.
- **Targeted Iteration**: Prefer running targeted tests (such as `vitest related`) during active development and iteration.
- **No Repeated Full Runs**: Do not run long full-suite tests repeatedly during active editing unless explicitly requested.
- **Test Command**: The workflow uses the hardcoded test command: `npx vitest related $(git diff --name-only) --run`.
