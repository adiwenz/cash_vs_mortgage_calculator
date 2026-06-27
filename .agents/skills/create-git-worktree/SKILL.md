---
name: create-git-worktree
description: Automatically create an isolated git worktree for each new feature conversation.
---
# Create Git Worktree Skill

This skill ensures that whenever a new implementation task starts, an isolated git worktree and branch are created. This prevents multiple agents from modifying the same working directory and enables parallel development.

## Setup & Execution

At the start of a new coding conversation or implementation task:

1. **Verify Configuration**:
   Read `.agents/config.json` and check if `AUTO_CREATE_WORKTREE` is set to `true`.

2. **Run the Script**:
   If `AUTO_CREATE_WORKTREE` is enabled (or if requested by the user), execute the worktree creation script:
   ```bash
   node .agents/skills/create-git-worktree/create_worktree.js "<Task Title>"
   ```
   *Note: The script automatically runs `npm install` inside the newly created worktree directory.*

3. **Verify Git Status**:
   The script checks if the repository has uncommitted changes. If it is dirty:
   - Warn the user.
   - Do not automatically stash or discard changes.
   - Abort worktree creation.

4. **Change Working Context**:
   Upon successful creation, the script outputs the new branch name and absolute worktree path.
   - **Important**: You must change your working directory for all subsequent tools. Set the `Cwd` parameter of any `run_command` tool calls to the new worktree path.
   - Perform all file operations (reads, writes) relative to the new worktree path.

## Helper Commands

- **List Worktrees**:
  ```bash
  git worktree list
  ```

- **Remove Worktree**:
  ```bash
  git worktree remove <path>
  ```
  *(Note: Run `git branch -d <branch-name>` from the primary repository afterward to delete the feature branch if it is no longer needed).*

## Parallel Agent Workflow

For every major feature:

1. **Create Worktree**: Generate a dedicated branch and folder from `main`.
2. **Implement Feature**: Perform all coding and modification within the worktree.
3. **Commit Changes**: Stage and commit your modifications inside the worktree repository.
4. **Run Verification**:
   During active development, run verification targeting the tests related to modified source files (or run the test file directly if modified) to stay fast and iterative:
   ```bash
   npm run test:related -- <modified-source-files>
   npm run test:e2e:changed
   ```
5. **Commit & Merge**: When implementation is complete, run the `git-commit-and-merge` skill. The script will automatically run the full test suite (`npm run test:unit` and optionally `npm run test:e2e`) to ensure no regressions are merged into `main`.
