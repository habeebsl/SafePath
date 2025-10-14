/**
 * Simple script to ONLY remove emojis from log messages
 * Does NOT change console.log to logger calls
 * Usage: node scripts/remove-emojis.js
 */

const fs = require('fs');
const path = require('path');

const dirsToProcess = ['utils', 'contexts', 'components', 'hooks'];
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

// Map of emojis to remove (replace with nothing)
const emojisToRemove = [
  '🔄', '📤', '📥', '✅', '❌', '⚠️', '📝', '🔍', '🗑️', '📡', 
  '🌐', '🔔', '🔀', '⏭️', '📊', '🔧', '📱', '📍', '🛑', '🗺️', 
  '⏳', '🌍', '➕', '🔒', '📋', '🎯', 'ℹ️', '♻️', '🎨', '🚀',
  '🔓', '💾', '🔥', '⚡', '🎬'
];

function removeEmojis(content) {
  let result = content;
  
  // Remove each emoji
  for (const emoji of emojisToRemove) {
    result = result.split(emoji).join('');
  }
  
  // Remove any remaining emoji using Unicode ranges
  result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  
  // Clean up double spaces that might result from emoji removal
  result = result.replace(/  +/g, ' ');
  
  // Clean up space at start of strings: 'console.log(' text' -> 'console.log('text'
  result = result.replace(/(['"`])\s+/g, '$1');
  
  return result;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = removeEmojis(content);
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Cleaned: ${filePath.replace(process.cwd(), '')}`);
    return 1;
  }
  
  return 0;
}

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

function main() {
  console.log('Removing emojis from source files...\n');
  
  let totalFiles = 0;
  const rootDir = process.cwd();
  
  for (const dir of dirsToProcess) {
    const dirPath = path.join(rootDir, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`Processing ${dir}/...`);
      totalFiles += processDirectory(dirPath);
    }
  }
  
  console.log(`\n✓ Complete! ${totalFiles} file(s) cleaned.`);
  console.log('\nEmojis removed. console.log calls unchanged.');
  console.log('You can now manually replace console.log with logger calls if needed.');
}

main();
