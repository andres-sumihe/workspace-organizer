#!/usr/bin/env node
/**
 * Create rounded corner version of logo for web app
 */

const sharp = require('sharp');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'build-assets', 'logo.jpg');
const OUTPUT = path.join(__dirname, '..', 'apps', 'web', 'src', 'assets', 'logo-rounded.png');

async function createRoundedLogo() {
  try {
    console.log('🎨 Creating rounded corner logo...');
    
    const size = 256; // Good size for web app logo
    const cornerRadius = 32; // About 12.5% rounded corners
    
    // Create rounded corner mask
    const roundedCorners = Buffer.from(
      `<svg width="${size}" height="${size}">
        <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
      </svg>`
    );

    await sharp(SOURCE)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toFile(OUTPUT);

    console.log(`✓ Created: ${OUTPUT}`);
    console.log(`  Size: ${size}x${size}px with ${cornerRadius}px corner radius`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createRoundedLogo();
