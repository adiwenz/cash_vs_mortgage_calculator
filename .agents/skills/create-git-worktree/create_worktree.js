import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Get task title from command line arguments
const taskTitle = process.argv.slice(2).join(' ').trim();

if (!taskTitle) {
  console.error('Error: Please provide a task title.');
  console.error('Usage: node create_worktree.js "<task-title>"');
  process.exit(1);
}

// 1. Detect git repository root
let gitRoot;
try {
  gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch (error) {
  console.error('Error: Failed to find git repository root. Are you in a git repository?', error.message);
  process.exit(1);
}

// 2. Verify repository is clean before creating a worktree
let statusOutput;
try {
  statusOutput = execSync('git status --porcelain', { cwd: gitRoot, encoding: 'utf8' }).trim();
} catch (error) {
  console.error('Error: Failed to check git status:', error.message);
  process.exit(1);
}

if (statusOutput) {
  console.warn('\n⚠️  WARNING: Repository has uncommitted or untracked changes:');
  console.warn(statusOutput);
  console.warn('\nAbort: Please commit, stash, or discard your changes before creating a worktree.');
  process.exit(1);
}

// Helper to check if a branch exists
function branchExists(branchName) {
  try {
    execSync(`git show-ref --verify refs/heads/${branchName}`, { cwd: gitRoot, stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// 3. Sanitize branch name
function sanitizeBranchName(title) {
  let cleaned = title.toLowerCase();
  
  // Remove starting "agent/" prefix if it's already there
  if (cleaned.startsWith('agent/')) {
    cleaned = cleaned.substring(6);
  }
  
  // Replace spaces and underscores with hyphens
  cleaned = cleaned.replace(/[\s_]+/g, '-');
  
  // Remove special characters (keep lowercase letters, numbers, hyphens, and slashes)
  cleaned = cleaned.replace(/[^a-z0-9-/]/g, '');
  
  // Remove duplicate/consecutive hyphens
  cleaned = cleaned.replace(/-+/g, '-');
  
  // Strip leading and trailing hyphens
  cleaned = cleaned.replace(/^-+|-+$/g, '');
  
  return `agent/${cleaned}`;
}

const baseBranchName = sanitizeBranchName(taskTitle);
const baseSuffix = baseBranchName.replace(/^agent\//, '');

// 4. Handle collisions
let finalBranchName = baseBranchName;
let finalSuffix = baseSuffix;
let finalWorktreePath = path.resolve(gitRoot, '..', `finley-agent-${finalSuffix}`);
let counter = 2;

while (branchExists(finalBranchName) || fs.existsSync(finalWorktreePath)) {
  finalBranchName = `${baseBranchName}-${counter}`;
  finalSuffix = `${baseSuffix}-${counter}`;
  finalWorktreePath = path.resolve(gitRoot, '..', `finley-agent-${finalSuffix}`);
  counter++;
}

// 5. Create new git worktree from main
console.log(`Creating new git worktree at: ${finalWorktreePath}`);
console.log(`Branch name: ${finalBranchName}`);
console.log(`Running: git worktree add "${finalWorktreePath}" -b "${finalBranchName}" main`);

try {
  execSync(`git worktree add "${finalWorktreePath}" -b "${finalBranchName}" main`, {
    cwd: gitRoot,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('\nError: Failed to create git worktree:', error.message);
  process.exit(1);
}

// 6. Display results
console.log(`\n==================================================`);
console.log(`🎉 Git Worktree successfully created!`);
console.log(`==================================================`);
console.log(`Branch Name:   ${finalBranchName}`);
console.log(`Worktree Path: ${finalWorktreePath}`);
console.log(`==================================================\n`);
console.log(`Current Git Worktrees:`);
try {
  const listOutput = execSync('git worktree list', { cwd: gitRoot, encoding: 'utf8' });
  console.log(listOutput);
} catch (error) {
  console.error('Failed to list git worktrees:', error.message);
}

console.log(`\n👉 INSTRUCTION FOR AGENT:`);
console.log(`Please switch your work directory to the path above.`);
console.log(`Use Cwd: "${finalWorktreePath}" for all terminal command runs.`);
console.log(`Read/write code files relative to "${finalWorktreePath}".\n`);
