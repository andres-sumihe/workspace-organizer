#!/usr/bin/env node
/**
 * Pre-build validation script
 * Checks if all requirements are met before building the desktop app
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_ICONS = {
  win: 'build-assets/icon.ico',
  mac: ['build-assets/icon.icns', 'build-assets/icon-1024.png'], // ICNS or high-res PNG
  linux: 'build-assets/icon.png'
};

const REQUIRED_DIRS = [
  'apps/api/dist',
  'apps/web/dist',
  'electron',
  'lib'
];

let hasErrors = false;
let hasWarnings = false;

console.log('🔍 Desktop Build Pre-flight Checks\n');

// Check if electron-builder is installed
try {
  require.resolve('electron-builder');
  console.log('✓ electron-builder installed');
} catch (e) {
  console.error('✗ electron-builder not found - run: npm install');
  hasErrors = true;
}

// Check if Electron is available
try {
  require.resolve('electron');
  console.log('✓ electron installed');
} catch (e) {
  console.error('✗ electron not found - run: npm install');
  hasErrors = true;
}

// Check build directories
console.log('\n📁 Build Output Directories:');
REQUIRED_DIRS.forEach(dir => {
  const exists = fs.existsSync(dir);
  if (!exists && dir.includes('dist')) {
    console.warn(`⚠ ${dir} not found - run: npm run build`);
    hasWarnings = true;
  } else if (exists) {
    console.log(`✓ ${dir}`);
  } else {
    console.error(`✗ ${dir} missing`);
    hasErrors = true;
  }
});

// Check icon files
console.log('\n🎨 Application Icons:');
let hasAnyIcon = false;
Object.entries(REQUIRED_ICONS).forEach(([platform, iconPath]) => {
  const paths = Array.isArray(iconPath) ? iconPath : [iconPath];
  const found = paths.find(p => fs.existsSync(p));
  
  if (found) {
    console.log(`✓ ${platform}: ${found}`);
    hasAnyIcon = true;
  } else {
    console.warn(`⚠ ${platform}: ${paths.join(' or ')} not found`);
  }
});

if (!hasAnyIcon) {
  console.warn('\n⚠ WARNING: No application icons found!');
  console.warn('  Add icons to build-assets/ directory before production builds.');
  console.warn('  See build-assets/README.md for details.');
  hasWarnings = true;
}

// Check package.json build config
console.log('\n⚙️  Build Configuration:');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.build) {
    console.log('✓ electron-builder config found');
    console.log(`  App ID: ${pkg.build.appId}`);
    console.log(`  Product: ${pkg.build.productName}`);
  } else {
    console.error('✗ Build configuration missing in package.json');
    hasErrors = true;
  }
} catch (e) {
  console.error('✗ Cannot read package.json:', e.message);
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('\n❌ Build requirements not met. Fix errors above.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  Build can proceed with warnings.');
  console.log('   For production builds, resolve warnings first.\n');
  process.exit(0);
} else {
  console.log('\n✅ All checks passed! Ready to build.\n');
  console.log('Run: npm run build:desktop');
  process.exit(0);
}
