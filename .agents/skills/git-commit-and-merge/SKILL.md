---
name: git-commit-and-merge
description: Git commit, merge to main, push, and delete the active branch/worktree.
---
# Git Commit and Merge Skill

> [!IMPORTANT]
> **CRITICAL RULE**: Do NOT run this skill automatically on your own initiative. You MUST ONLY run this skill when the USER explicitly requests it (e.g. "please run the git-commit-and-merge skill" or similar). NEVER run this automatically after completing features or tests without direct, explicit confirmation from the user in the current turn.

This skill automates the cleanup of a finished worktree. When you have completed all implementations, verified tests, and the USER has explicitly instructed you to run this skill to merge into `main` and clean up, run this skill.

## Setup & Execution

From within the active feature worktree (or from the main repository), run:

```bash
node .agents/skills/git-commit-and-merge/commit_and_merge.js "[Commit Message]"
```

*Note: If no commit message is provided, the script will auto-generate one based on the current branch name.*

## Automation Workflow

The script performs the following actions:

1. **Verify Context**: Confirms it is running in a Git repository and checks the current branch. It will abort if run directly on `main` to prevent accidental deletion.
2. **Commit Changes**: Stagers all uncommitted/untracked files (`git add -A`) and commits them (`git commit -m "[message]"`).
3. **Pull Latest Main**: Switches working directory to the primary repository and pulls the latest changes from `origin/main` to avoid out-of-sync merges.
4. **Merge Feature Branch**: Merges the feature branch into `main`. If merge conflicts occur, it aborts so the user can resolve them manually.
5. **Push Main**: Pushes the merged `main` branch to the remote repository (`git push origin main`).
6. **Remove Worktree**: Deletes the feature worktree folder (`git worktree remove --force <path>`).
7. **Delete Branch**: Deletes the local feature branch (`git branch -D <branch-name>`).

## Options

- **Message**: Provide a commit message as the first argument:
  ```bash
  node .agents/skills/git-commit-and-merge/commit_and_merge.js "feat: add user auth"
  ```
