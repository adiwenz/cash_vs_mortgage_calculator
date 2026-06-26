# Agent Rules

## Verification & Walkthrough
- After creating or updating the `walkthrough.md` artifact (rendering the walkthrough), you MUST run the `print-worktree` skill by executing:
  ```bash
  node .agents/skills/print-worktree/print_worktree.js
  ```
  and include its output in your response to the user.

## Surgical Coding Default Instruction
- **Default Instruction for Coding Tasks**: Make the smallest correct change. Prefer surgical fixes over rewrites. Verify narrowly first, broadly last.
- **Surgical Coding Mode**: For all coding tasks in this repository, you MUST read and strictly follow the [Surgical Coding Mode](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/.agents/skills/surgical-coding-mode/SKILL.md) skill.

## Single-Pass File Editing Default Instruction
- Prefer single-pass file editing: read each relevant file once, collect all edit points, and apply related changes in one patch instead of repeatedly searching for nearby symbols.

## No Legacy Modes Default Instruction
- **Prefer replacement over compatibility. This project has no production users, so do not introduce feature flags, legacy code paths, migration layers, or compatibility wrappers unless explicitly requested. Maintain a single canonical implementation and remove obsolete code whenever practical.**

