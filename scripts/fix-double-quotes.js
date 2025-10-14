/**
 * Quick fix script to remove double quotes caused by migration script bug
 * Usage: node scripts/fix-double-quotes.js
 */

const fs = require('fs');
const path = require('path');

const dirsToProcess = ['utils', 'contexts', 'components', 'hooks'];
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix double single quotes at end of strings
  content = content.replace(/(['"​])([^'"​]*?)''([,);])/g, "$1$2'$3");
  
  // Remove any remaining emojis (Unicode emoji range and common ones)
  const emojiPattern = /[\u{1F300}-\u{1F9FF}🔄📤📥✅❌⚠️📝🔍🗑️📡🌐🔔🔀⏭️📊🔧📱📍🛑🗺️⏳🌍➕🔒📋🎯ℹ️]/gu;
  content = content.replace(emojiPattern, '');
  
  // Clean up extra spaces after emoji removal
  content = content.replace(/(['"`])\s+/g, '$1');
  content = content.replace(/\(\s+(['"`])/g, '($1');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed: ${filePath.replace(process.cwd(), '')}`);
    return 1;
  }
  
  return 0;
}

function processDirectory(dirPath) {
  let filesFixed = 0;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      filesFixed += processDirectory(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (fileExtensions.includes(ext)) {
        filesFixed += fixFile(fullPath);
      }
    }
  }
  
  return filesFixed;
}

function main() {
  console.log('Fixing double quotes and removing emojis...\n');
  
  let totalFiles = 0;
  const rootDir = process.cwd();
  
  for (const dir of dirsToProcess) {
    const dirPath = path.join(rootDir, dir);
    if (fs.existsSync(dirPath)) {
      totalFiles += processDirectory(dirPath);
    }
  }
  
  console.log(`\n✓ Fix complete! ${totalFiles} file(s) updated.`);
}

main();
