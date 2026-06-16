import { execSync } from 'child_process';

try {
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  const currentCwd = process.cwd();
  const gitStatus = execSync('git status', { encoding: 'utf8' }).trim();
  const worktrees = execSync('git worktree list', { encoding: 'utf8' }).trim();

  console.log('==================================================');
  console.log('📊 GIT STATUS & WORKTREE INFO');
  console.log('==================================================');
  console.log(`Working Directory: ${currentCwd}`);
  console.log(`Current Branch:    ${currentBranch}`);
  console.log('--------------------------------------------------');
  console.log('Git Status:');
  console.log(gitStatus);
  console.log('--------------------------------------------------');
  console.log('Active Worktrees:');
  console.log(worktrees);
  console.log('==================================================');
} catch (error) {
  console.error('Failed to retrieve git status:', error.message);
}
