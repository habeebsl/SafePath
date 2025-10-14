#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'components/sos/SOSButton.tsx',
  'components/sos/SOSDetailsModal.tsx',
  'components/sos/SOSNotificationBanner.tsx',
  'components/map.web.tsx',
  'components/map/MapOverlays.tsx',
  'components/map/MapOverlays.web.tsx',
  'components/Alert/Alert.web.tsx',
  'components/trail/TrailBottomBar.web.tsx',
  'components/trail/TrailBottomBar.tsx',
  'components/markers/AddMarkerModal.tsx',
  'components/markers/MarkerDetailsModal.tsx',
];

function convertShadowToBoxShadow(content) {
  // Match the shadow properties block
  const shadowPattern = /shadowColor:\s*'([^']+)',\s*shadowOffset:\s*\{\s*width:\s*(-?\d+),\s*height:\s*(-?\d+)\s*\},\s*shadowOpacity:\s*([\d.]+),\s*shadowRadius:\s*(\d+),?/g;
  
  return content.replace(shadowPattern, (match, color, offsetX, offsetY, opacity, radius) => {
    // Convert to boxShadow format
    // boxShadow: "offsetX offsetY blurRadius spreadRadius color"
    // Note: shadowRadius maps to blur-radius, we'll use 0 for spread
    const hex = color.trim();
    const alpha = parseFloat(opacity);
    
    // Convert hex to rgba if needed
    let shadowColor = color;
    if (hex.startsWith('#')) {
      // Parse hex color
      let r, g, b;
      if (hex.length === 4) {
        // Short form like #000
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
      } else {
        // Long form like #000000
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      }
      shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    return `boxShadow: '${offsetX}px ${offsetY}px ${radius}px 0px ${shadowColor}',`;
  });
}

console.log('🔧 Converting deprecated shadow* props to boxShadow...\n');

let totalFixed = 0;

filesToFix.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped ${file} (not found)`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = convertShadowToBoxShadow(content);
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    const matches = (content.match(/shadowColor:/g) || []).length;
    console.log(`✅ Fixed ${file} (${matches} shadow blocks converted)`);
    totalFixed += matches;
  } else {
    console.log(`⏭️  Skipped ${file} (no shadow props found)`);
  }
});

console.log(`\n✨ Done! Converted ${totalFixed} shadow blocks to boxShadow`);
