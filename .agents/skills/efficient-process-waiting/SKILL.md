---
name: efficient-process-waiting
description: Avoid unnecessary delays when running tests, builds, scripts, or long-running commands. The agent should wait on process completion when possible instead of using arbitrary fixed sleep timers.
---
# Efficient Process Waiting

## Goal
Avoid unnecessary delays when running tests, builds, scripts, or long-running commands. The agent should wait on process completion when possible instead of using arbitrary fixed sleep timers.

## Rules

### 1. Prefer process completion over timers
- When running tests, builds, lint, typecheck, or scripts, wait for the process to complete naturally if the environment supports it.
- Do not use arbitrary fixed timers like “wait 30 seconds” as the default way to check whether a command finished.

### 2. Avoid unnecessary polling latency
- Do not repeatedly sleep and check if the command has completed when a blocking wait or completion signal is available.
- If polling is required by the environment, use short/adaptive intervals instead of a fixed long interval.
- Example adaptive polling:
  - first check after 2 seconds
  - then 5 seconds
  - then 10 seconds
  - only use longer intervals for genuinely long-running commands

### 3. Do useful independent work while commands run
- If a command is running asynchronously, use the waiting time for independent work only when safe:
  - reading relevant docs
  - reviewing nearby code
  - preparing the final summary
  - checking changed files
- Do not edit files that could invalidate the running command’s result.

### 4. Do not restart or duplicate commands
- Before starting another test/build/lint process, check whether one is already running.
- Do not launch duplicate full test runs.
- Do not restart a long-running command unless it is clearly hung or the previous run is obsolete.

### 5. Detect likely hangs
- If a command exceeds the expected duration, report that it is still running.
- If there is no output for an unusually long time, inspect whether the process is stuck, waiting for input, or running in watch mode.
- Do not keep extending timers forever without explanation.

### 6. Prefer non-watch commands
- For automated verification, use one-shot commands rather than watch mode.
- Prefer commands like:
  - npm test -- --run
  - npx vitest path/to/test --run
- Avoid commands that stay open unless explicitly requested.

### 7. End-of-task report
At the end, include:
- commands run
- whether each command completed, failed, or was still running
- if polling was used, why it was necessary
- whether any command appeared hung or watch-mode related
