# Agent Rules & Registrations

This file defines the registered agents, their access permissions, and behavioral rules within the multi-agent system.

## Registered Agents

### @Developer
- **Role**: Primary implementation agent.
- **Responsibilities**: Proposes or implements codebase changes, fixes issues identified by the QA agent, and manages the main application features.
- **Permissions**:
  - Read/Write access to all source directories.
  - Allowed to modify application code.

### @QA
- **Role**: Independent judge agent.
- **Responsibilities**: Runs verification tests, checks logic, and reports test results. The @QA agent must not modify the source code under `src/` (or other source directories).
- **Permissions**:
  - Read-only access to source directories (`src/`, etc.).
  - Read/Write access to test suites (e.g., `__tests__/`, test files).
  - Read/Write access to `.agents/artifacts/`.

---

## Agent Rules

### Verification & Walkthrough
- After creating or updating the `walkthrough.md` artifact (rendering the walkthrough), you MUST run the `print-worktree` skill by executing:
  ```bash
  node .agents/skills/print-worktree/print_worktree.js
  ```
  and include its output in your response to the user.

### Surgical Coding Default Instruction
- **Default Instruction for Coding Tasks**: Make the smallest correct change. Prefer surgical fixes over rewrites. Verify narrowly first, broadly last.
- **Surgical Coding Mode**: For all coding tasks in this repository, you MUST read and strictly follow the [Surgical Coding Mode](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/.agents/skills/surgical-coding-mode/SKILL.md) skill.

### Single-Pass File Editing Default Instruction
- Prefer single-pass file editing: read each relevant file once, collect all edit points, and apply related changes in one patch instead of repeatedly searching for nearby symbols.

### No Legacy Modes Default Instruction
- **Prefer replacement over compatibility. This project has no production users, so do not introduce feature flags, legacy code paths, migration layers, or compatibility wrappers unless explicitly requested. Maintain a single canonical implementation and remove obsolete code whenever practical.**

### Efficient Process Waiting Default Instruction
- **Prefer waiting on command completion over arbitrary timers. Do not use fixed sleep intervals as the default test/build waiting strategy; use completion signals or adaptive polling, and avoid duplicate long-running commands.**

### Search Memory & Result Reuse Default Instruction
- **Treat search results as cached knowledge for the duration of a task. Prefer reusing previously discovered files, symbols, and locations instead of issuing duplicate searches. Search to discover information, not to repeatedly rediscover it.**

### Efficient Code Navigation Default Instruction
- **Navigate by meaning, not by line number. Search first, read complete logical units, and avoid repeated small adjacent file reads.**
- **Efficient Code Navigation**: For all coding tasks in this repository, you MUST read and strictly follow the [Efficient Code Navigation](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/.agents/skills/efficient-code-navigation/SKILL.md) skill.
