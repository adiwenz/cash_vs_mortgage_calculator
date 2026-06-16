import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Helper to run commands
function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...options }).trim();
  } catch (error) {
    console.error(`\n❌ Error running command: ${cmd}`);
    if (error.message) console.error(error.message);
    if (error.stdout) console.error(`Stdout:\n${error.stdout}`);
    if (error.stderr) console.error(`Stderr:\n${error.stderr}`);
    process.exit(1);
  }
}

// 1. Gather git info and paths
let gitCommonDir;
try {
  gitCommonDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim();
} catch (error) {
  console.error('❌ Error: Failed to find git repository. Are you in a git repository?', error.message);
  process.exit(1);
}

const absGitCommonDir = path.resolve(gitCommonDir);
const mainRepoPath = path.dirname(absGitCommonDir);
const currentBranch = runCmd('git rev-parse --abbrev-ref HEAD');
const currentWorktreePath = runCmd('git rev-parse --show-toplevel');

console.log('==================================================');
console.log('🧹 GIT COMMIT, MERGE, PUSH, AND CLEANUP START');
console.log('==================================================');
console.log(`Current Branch:    ${currentBranch}`);
console.log(`Current Worktree:  ${currentWorktreePath}`);
console.log(`Main Repository:   ${mainRepoPath}`);
console.log('--------------------------------------------------');

// 2. Safety check: DO NOT delete main repo or main branch
if (
  currentBranch === 'main' || 
  currentBranch === 'master' || 
  path.resolve(currentWorktreePath) === path.resolve(mainRepoPath)
) {
  console.error('❌ ERROR: You are running this command in the main repository / on the main branch.');
  console.error('This script is intended to complete work on a feature worktree and merge it.');
  console.error('To protect the main repository, execution has been aborted.');
  process.exit(1);
}

// 3. Commit changes in the active feature worktree
console.log(`🔍 Checking for uncommitted changes in '${currentBranch}'...`);
const statusOutput = runCmd('git status --porcelain');
if (statusOutput) {
  console.log('📝 Found uncommitted or untracked changes. Staging and committing...');
  
  // Get commit message from args
  let commitMessage = process.argv.slice(2).join(' ').trim();
  if (!commitMessage) {
    commitMessage = `completed tasks on branch ${currentBranch}`;
    console.log(`ℹ️  No commit message provided. Using default: "${commitMessage}"`);
  }
  
  runCmd('git add -A');
  // Escape quotes in commit message
  const escapedMessage = commitMessage.replace(/"/g, '\\"');
  runCmd(`git commit -m "${escapedMessage}"`);
  console.log('✅ Changes staged and committed successfully.');
} else {
  console.log('✨ No uncommitted changes found in the worktree.');
}

// 4. Verify main repository state
console.log(`\n🔄 Switching context to main repository: ${mainRepoPath}`);
const mainBranchName = runCmd('git rev-parse --abbrev-ref HEAD', { cwd: mainRepoPath });
if (mainBranchName !== 'main' && mainBranchName !== 'master') {
  console.error(`❌ ERROR: The main repository is currently checked out to branch '${mainBranchName}', not 'main' or 'master'.`);
  console.error('Please checkout main branch in the main repository before running this script.');
  process.exit(1);
}

const mainStatus = runCmd('git status --porcelain', { cwd: mainRepoPath });
if (mainStatus) {
  console.error('❌ ERROR: The main repository has uncommitted changes:');
  console.error(mainStatus);
  console.error('Please commit, stash, or discard changes in the main repository first.');
  process.exit(1);
}

// 5. Merge feature branch into main
console.log(`\n🔀 Merging branch '${currentBranch}' into '${mainBranchName}'...`);
try {
  runCmd(`git merge "${currentBranch}" --no-edit`, { cwd: mainRepoPath });
  console.log(`✅ Merged '${currentBranch}' into '${mainBranchName}' successfully.`);
} catch (error) {
  console.error(`\n❌ MERGE CONFLICT: Failed to merge '${currentBranch}' into '${mainBranchName}'.`);
  console.error('Please resolve the conflicts manually in the main repository directory:');
  console.error(`Cwd: ${mainRepoPath}`);
  process.exit(1);
}

// 7. Push main to remote
console.log(`\n📤 Pushing merged '${mainBranchName}' to origin...`);
try {
  execSync(`git push origin ${mainBranchName}`, { cwd: mainRepoPath, stdio: 'pipe' });
  console.log('✅ Pushed changes to origin successfully.');
} catch (error) {
  console.error('\n❌ ERROR: Failed to push changes to origin.');
  console.error('The merge was successful locally, but pushing to the remote failed.');
  console.error('Please resolve any remote conflicts/push issues manually in the main repository.');
  console.error('Worktree and branch deletion have been skipped to prevent data loss.');
  process.exit(1);
}

// 8. Delete feature worktree
console.log(`\n🧹 Removing feature worktree: ${currentWorktreePath}`);
try {
  runCmd(`git worktree remove --force "${currentWorktreePath}"`, { cwd: mainRepoPath });
  console.log('✅ Worktree folder removed successfully.');
} catch (error) {
  console.error(`⚠️  WARNING: Failed to remove worktree folder via git worktree remove:`, error.message);
  console.error('Attempting manual cleanup of worktree directory...');
  try {
    if (fs.existsSync(currentWorktreePath)) {
      fs.rmSync(currentWorktreePath, { recursive: true, force: true });
      console.log('✅ Worktree folder deleted manually.');
    }
  } catch (fsError) {
    console.error(`❌ ERROR: Failed to delete worktree folder manually:`, fsError.message);
  }
}

// 9. Delete feature branch
console.log(`\n🗑️  Deleting feature branch: ${currentBranch}`);
try {
  runCmd(`git branch -D "${currentBranch}"`, { cwd: mainRepoPath });
  console.log(`✅ Branch '${currentBranch}' deleted successfully.`);
} catch (error) {
  console.error(`⚠️  WARNING: Failed to delete branch '${currentBranch}':`, error.message);
}

console.log('\n==================================================');
console.log('🎉 COMMIT, MERGE, PUSH, AND CLEANUP COMPLETE!');
console.log('==================================================');
console.log(`Merged branch: ${currentBranch}`);
console.log(`Worktree path: ${currentWorktreePath}`);
console.log('Status:        SUCCESS');
console.log('==================================================\n');
