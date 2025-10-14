/**
 * Script to replace console.log/error/warn with logger calls
 * Does NOT remove emojis, does NOT touch logger.ts
 * Usage: node scripts/switch-to-logger.js
 */

const fs = require('fs');
const path = require('path');

// Files and directories to process
const dirsToProcess = ['utils', 'contexts', 'components', 'hooks'];
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

// Files to exclude
const excludeFiles = ['logger.ts', 'logger.js'];

// Logger mappings based on file/directory
const loggerMappings = {
  'utils/sync': 'syncLogger',
  'utils/database': 'dbLogger',
  'contexts/': 'uiLogger',
  'components/': 'uiLogger',
  'hooks/': 'uiLogger',
  'default': 'logger'
};

// Get the appropriate logger for a file
function getLoggerForFile(filePath) {
  const relativePath = filePath.replace(process.cwd(), '').replace(/^\//, '');
  
  for (const [pattern, logger] of Object.entries(loggerMappings)) {
    if (relativePath.includes(pattern)) {
      return logger;
    }
  }
  
  return loggerMappings.default;
}

// Check if logger import already exists
function hasLoggerImport(content) {
  return content.includes("from '@/utils/logger'") || content.includes('from "@/utils/logger"');
}

// Get imported loggers from existing import
function getImportedLoggers(content) {
  const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@\/utils\/logger['"]/;
  const match = content.match(importRegex);
  if (match) {
    return match[1].split(',').map(s => s.trim());
  }
  return [];
}

// Add logger to import statement
function addLoggerImport(content, loggerName) {
  const importPath = '@/utils/logger';
  
  if (hasLoggerImport(content)) {
    // Update existing import
    const existingLoggers = getImportedLoggers(content);
    if (!existingLoggers.includes(loggerName)) {
      const newLoggers = [...existingLoggers, loggerName].join(', ');
      content = content.replace(
        /import\s*{\s*[^}]+\s*}\s*from\s*['"]@\/utils\/logger['"]/,
        `import { ${newLoggers} } from '${importPath}'`
      );
    }
  } else {
    // Add new import after other imports
    const importMatches = content.match(/import\s+.*?from\s+['"].*?['"];?\n/g);
    if (importMatches && importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const insertPosition = content.lastIndexOf(lastImport) + lastImport.length;
      content = content.slice(0, insertPosition) + 
                `import { ${loggerName} } from '${importPath}';\n` + 
                content.slice(insertPosition);
    } else {
      // No imports found, add at beginning
      content = `import { ${loggerName} } from '${importPath}';\n\n` + content;
    }
  }
  
  return content;
}

// Process a single file
function processFile(filePath) {
  // Skip excluded files
  const fileName = path.basename(filePath);
  if (excludeFiles.includes(fileName)) {
    return 0;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let hasChanges = false;
  
  const loggerName = getLoggerForFile(filePath);
  
  // Replace console.error -> logger.error
  if (newContent.includes('console.error(')) {
    newContent = newContent.replace(/console\.error\(/g, `${loggerName}.error(`);
    hasChanges = true;
  }
  
  // Replace console.warn -> logger.warn
  if (newContent.includes('console.warn(')) {
    newContent = newContent.replace(/console\.warn\(/g, `${loggerName}.warn(`);
    hasChanges = true;
  }
  
  // Replace console.log -> logger.info
  if (newContent.includes('console.log(')) {
    newContent = newContent.replace(/console\.log\(/g, `${loggerName}.info(`);
    hasChanges = true;
  }
  
  // If changes were made, add import and write file
  if (hasChanges) {
    newContent = addLoggerImport(newContent, loggerName);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Migrated: ${filePath.replace(process.cwd(), '')}`);
    return 1;
  }
  
  return 0;
}

// Recursively process directory
function processDirectory(dirPath) {
  let filesProcessed = 0;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      filesProcessed += processDirectory(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (fileExtensions.includes(ext)) {
        filesProcessed += processFile(fullPath);
      }
    }
  }
  
  return filesProcessed;
}

// Main execution
function main() {
  console.log('Switching console.log to logger calls...\n');
  
  let totalFiles = 0;
  const rootDir = process.cwd();
  
  for (const dir of dirsToProcess) {
    const dirPath = path.join(rootDir, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`Processing ${dir}/...`);
      totalFiles += processDirectory(dirPath);
    }
  }
  
  console.log(`\n✓ Migration complete! ${totalFiles} file(s) updated.`);
  console.log('\nNext steps:');
  console.log('1. Review changes: git diff');
  console.log('2. Test the app');
  console.log('3. Set DEBUG_ENABLED=false in utils/logger.ts to disable logs');
}

main();
