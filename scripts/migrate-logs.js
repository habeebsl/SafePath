/**
 * Script to migrate all console.log/console.error calls to use the new logger
 * Usage: node scripts/migrate-logs.js
 */

const fs = require('fs');
const path = require('path');

// Files and directories to process
const dirsToProcess = ['utils', 'contexts', 'components', 'hooks'];
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

// Logger mappings based on file/directory
const loggerMappings = {
  'utils/sync': 'syncLogger',
  'utils/database': 'dbLogger',
  'contexts/': 'uiLogger',
  'components/': 'uiLogger',
  'hooks/': 'uiLogger',
  'default': 'logger'
};

// Common emojis used in the codebase
const emojiMap = {
  '🔄': '',
  '📤': '',
  '📥': '',
  '✅': '',
  '❌': '',
  '⚠️': '',
  '📝': '',
  '🔍': '',
  '🗑️': '',
  '📡': '',
  '🌐': '',
  '🔔': '',
  '🔀': '',
  '⏭️': '',
  '📊': '',
  '🔧': '',
  '📱': '',
  '📍': '',
  '🛑': '',
  '🗺️': '',
  '⏳': '',
  '🌍': '',
  '➕': '',
  '🔒': '',
  '📋': '',
  '🎯': ''
};

// Remove emojis from string
function removeEmojis(str) {
  let result = str;
  for (const [emoji, replacement] of Object.entries(emojiMap)) {
    result = result.replace(new RegExp(emoji, 'g'), replacement);
  }
  // Remove any remaining emojis (Unicode emoji range)
  result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  // Clean up extra spaces
  result = result.replace(/^\s+/, '').replace(/\s+$/, '');
  return result;
}

// Patterns to replace
const patterns = [
  // console.error
  { 
    regex: /console\.error\(/g,
    getReplacement: (match, logger) => `${logger}.error(`
  },
  // console.warn
  { 
    regex: /console\.warn\(/g,
    getReplacement: (match, logger) => `${logger}.warn(`
  },
  // console.log
  { 
    regex: /console\.log\(/g,
    getReplacement: (match, logger) => `${logger}.info(`
  }
];

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

// Add import statement if not present
function addLoggerImport(content, loggerName) {
  const importPath = '@/utils/logger';
  
  // Check if logger is already imported
  if (content.includes(`from '${importPath}'`) || content.includes(`from "${importPath}"`)) {
    // Check if the specific logger is already imported
    const importRegex = new RegExp(`import\\s*{([^}]*)}\\s*from\\s*['"]${importPath}['"]`);
    const match = content.match(importRegex);
    
    if (match) {
      const imports = match[1].split(',').map(s => s.trim());
      if (!imports.includes(loggerName)) {
        // Add logger to existing import
        const newImports = [...imports, loggerName].join(', ');
        content = content.replace(importRegex, `import { ${newImports} } from '${importPath}'`);
      }
    }
  } else {
    // Add new import statement after other imports
    const lastImportMatch = content.match(/(import\s+.*?from\s+['"].*?['"];?\n)/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const insertPosition = content.lastIndexOf(lastImport) + lastImport.length;
      content = content.slice(0, insertPosition) + 
                `import { ${loggerName} } from '${importPath}';\n` + 
                content.slice(insertPosition);
    } else {
      // No imports found, add at the beginning
      content = `import { ${loggerName} } from '${importPath}';\n\n` + content;
    }
  }
  
  return content;
}

// Process a single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let hasChanges = false;
  
  const loggerName = getLoggerForFile(filePath);
  
  // First, remove emojis from log strings
  // Match logger.info/error/warn/debug calls and string literals with emojis
  const logCallRegex = /(logger|syncLogger|dbLogger|uiLogger)\.(info|error|warn|debug)\(((['"`])[^'"`]*[\u{1F300}-\u{1F9FF}🔄📤📥✅❌⚠️📝🔍🗑️📡🌐🔔🔀⏭️📊🔧📱📍🛑🗺️⏳🌍➕🔒📋🎯][^'"`]*\3)/gu;
  newContent = newContent.replace(logCallRegex, (match, loggerVar, level, stringPart, quote) => {
    const cleanedString = removeEmojis(stringPart.slice(1)); // Remove quote and emojis
    return `${loggerVar}.${level}(${quote}${cleanedString}${quote}`;
  });
  
  // Also clean console.log/error/warn strings before replacement
  const consoleRegex = /console\.(log|error|warn)\(((['"`])[^'"`]*[\u{1F300}-\u{1F9FF}🔄📤📥✅❌⚠️📝🔍🗑️📡🌐🔔🔀⏭️📊🔧📱📍🛑🗺️⏳🌍➕🔒📋🎯][^'"`]*\3)/gu;
  newContent = newContent.replace(consoleRegex, (match, level, stringPart, quote) => {
    const cleanedString = removeEmojis(stringPart.slice(1)); // Remove quote and emojis
    return `console.${level}(${quote}${cleanedString}${quote}`;
  });
  
  // Apply all pattern replacements (console.log -> logger.info, etc)
  for (const pattern of patterns) {
    const beforeReplace = newContent;
    newContent = newContent.replace(pattern.regex, pattern.getReplacement('', loggerName));
    if (beforeReplace !== newContent) {
      hasChanges = true;
    }
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
  console.log('Starting log migration...\n');
  
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
  console.log('1. Review the changes with: git diff');
  console.log('2. Test the app to ensure everything works');
  console.log('3. Adjust DEBUG_ENABLED in utils/logger.ts as needed');
}

main();
