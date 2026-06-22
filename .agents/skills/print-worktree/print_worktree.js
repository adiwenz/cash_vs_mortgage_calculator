import { execSync } from 'child_process';

try {
  const currentWorktreePath = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  
  console.log('==================================================');
  console.log('🌲 WORKTREE INFO FOR COMPLETED CHANGES');
  console.log('==================================================');
  console.log(`Worktree Path:   ${currentWorktreePath}`);
  console.log(`Branch Name:     ${currentBranch}`);
  console.log('==================================================\n');
} catch (error) {
  console.error('❌ Failed to retrieve worktree info:', error.message);
}
