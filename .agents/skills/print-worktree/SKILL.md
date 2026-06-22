---
name: print-worktree
description: Prints the git worktree path and branch name where changes were made. Runs automatically after writing or updating the walkthrough.md.
---
# Print Worktree Skill

This skill prints out the git worktree details where changes were made. It must be run after the walkthrough is rendered (created or updated).

## Setup & Execution

After you have created or updated the `walkthrough.md` artifact:

1. **Run the Script**:
   Execute the print worktree script from the active worktree directory:
   ```bash
   node .agents/skills/print-worktree/print_worktree.js
   ```

2. **Display Output**:
   Make sure the output of the script is shown/printed in your final response to the user.
