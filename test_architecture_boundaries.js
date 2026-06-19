import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, 'src');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = getFiles(SRC_DIR);
let errors = [];

files.forEach(file => {
  const relativePath = path.relative(__dirname, file);
  const content = fs.readFileSync(file, 'utf8');
  
  // Extract imports
  const importLines = content.split('\n').filter(line => {
    return line.trim().startsWith('import ') || line.trim().includes('import(');
  });
  
  importLines.forEach(line => {
    // Basic regex to find import sources
    const match = line.match(/from\s+['"]([^'"]+)['"]/) || line.match(/import\(['"]([^'"]+)['"]\)/) || line.match(/import\s+['"]([^'"]+)['"]/);
    if (!match) return;
    const importSource = match[1];
    
    // Rule 1: src/domain/ does not import React/Components
    if (relativePath.startsWith('src/domain/')) {
      if (importSource === 'react' || importSource.startsWith('react/')) {
        errors.push(`[React in Domain] ${relativePath} imports React: "${line.trim()}"`);
      }
      if (importSource.includes('/components/') || importSource.includes('../components')) {
        errors.push(`[Components in Domain] ${relativePath} imports components: "${line.trim()}"`);
      }
    }
    
    // Rule 2: src/calculators/ does not import React
    if (relativePath.startsWith('src/calculators/')) {
      if (importSource === 'react' || importSource.startsWith('react/')) {
        errors.push(`[React in Calculators] ${relativePath} imports React: "${line.trim()}"`);
      }
    }
    
    // Rule 3: Event handlers do not import React
    if (relativePath.startsWith('src/features/fire/events/handlers/')) {
      if (importSource === 'react' || importSource.startsWith('react/')) {
        errors.push(`[React in Event Handlers] ${relativePath} imports React: "${line.trim()}"`);
      }
    }
    
    // Rule 4: Recommendation handlers do not import React
    if (relativePath.startsWith('src/features/fire/recommendations/handlers/')) {
      if (importSource === 'react' || importSource.startsWith('react/')) {
        errors.push(`[React in Recommendation Handlers] ${relativePath} imports React: "${line.trim()}"`);
      }
    }
    
    // Rule 5: UI components do not import from deep calculator internals
    if (relativePath.startsWith('src/components/')) {
      const deepInternalsPattern = /\/calculators\/fire\/(yearlySimulation|phases|socialSecurity|retirementReadiness|normalizeInputs|debug|children|marriage|assetsAndWithdrawals)\.js/;
      if (deepInternalsPattern.test(importSource)) {
        errors.push(`[Deep Calculator Import] UI Component ${relativePath} imports deep calculator internals: "${line.trim()}" (Use fireCalculations.js or rebalance.js instead)`);
      }
    }
  });
});

if (errors.length > 0) {
  console.error('❌ Architecture boundary violations found:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('✅ Architecture boundary check passed successfully!');
  process.exit(0);
}
