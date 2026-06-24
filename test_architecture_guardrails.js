import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_DIR = __dirname;
const FIRE_SIMULATOR_DIR = path.join(WORKSPACE_DIR, 'src', 'components', 'fire-simulator');

let warnings = [];

// Helper to get files recursively
function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getFiles(filePath, fileList);
      }
    } else {
      if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

// 1. Search for direct mutation patterns in src/components/fire-simulator
const fireSimulatorFiles = getFiles(FIRE_SIMULATOR_DIR);
fireSimulatorFiles.forEach(file => {
  const relativePath = path.relative(WORKSPACE_DIR, file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    
    // Catch patterns like inputs.name = val, scenario.inputs.name = val, editingEvent.name = val
    // Negative lookahead prevents matching comparison operators (==, ===, !=, !==, <=, >=)
    const mutationMatch = trimmed.match(/(?:inputs|scenario\.inputs|editingEvent)\.[a-zA-Z_0-9]+\s*=\s*(?![=\s])/);
    if (mutationMatch) {
      warnings.push(`[Direct Mutation] ${relativePath}:${idx + 1}: possible direct state mutation: "${trimmed}"`);
    }
  });
});

// 2. Search for large files over 1,000 lines
const allFiles = getFiles(WORKSPACE_DIR);
allFiles.forEach(file => {
  const relativePath = path.relative(WORKSPACE_DIR, file);
  const content = fs.readFileSync(file, 'utf8');
  const linesCount = content.split('\n').length;
  if (linesCount > 1000) {
    warnings.push(`[Large File Warning] ${relativePath} has ${linesCount} lines (exceeds 1,000 lines limit).`);
  }
});

// 3. Search for forbidden timeline labels "Homeowner" and "Renting" inside timeline row generation tests
const timelineTestFiles = [
  path.join(WORKSPACE_DIR, 'test_expandable_swimlanes.test.js'),
  path.join(WORKSPACE_DIR, 'src', 'features/fire/scenario/scenario.test.js')
];

timelineTestFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const relativePath = path.relative(WORKSPACE_DIR, file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    
    // Match string literals or assertions checking for the words "Homeowner" or "Renting"
    const containsForbidden = /["'](?:Homeowner|Renting)["']/i.test(trimmed);
    if (containsForbidden) {
      warnings.push(`[Forbidden Label Assert] ${relativePath}:${idx + 1}: contains reference to forbidden timeline label: "${trimmed}"`);
    }
  });
});

// Print warnings
if (warnings.length > 0) {
  console.warn('⚠️  Architecture Guardrails Warnings found:');
  warnings.forEach(w => console.warn(`  - ${w}`));
} else {
  console.log('✅ All architecture guardrail checks passed!');
}

// Exit with 0 as requested ("warnings only, do not block builds yet")
process.exit(0);
