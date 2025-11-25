#!/usr/bin/env node
/**
 * Icon Conversion Script
 * Converts logo.jpg to all required desktop icon formats
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Dynamic import for ESM module
let pngToIco;

const SOURCE_IMAGE = path.join(__dirname, '..', 'build-assets', 'logo.jpg');
const OUTPUT_DIR = path.join(__dirname, '..', 'build-assets');

// Icon sizes for different platforms
const SIZES = {
  ico: [256, 128, 64, 48, 32, 24, 16], // Windows multi-resolution
  png: [512, 256, 128, 64, 48, 32, 16], // Linux + base for macOS
  icns: [1024, 512, 256, 128, 64, 32, 16] // macOS icon set
};

async function convertIcon() {
  console.log('🎨 Converting logo.jpg to desktop icons...\n');

  try {
    // Load ESM module dynamically
    pngToIco = (await import('png-to-ico')).default;

    // Verify source exists
    if (!fs.existsSync(SOURCE_IMAGE)) {
      console.error(`❌ Source image not found: ${SOURCE_IMAGE}`);
      process.exit(1);
    }

    // Get source image info
    const metadata = await sharp(SOURCE_IMAGE).metadata();
    console.log(`📸 Source: ${metadata.width}x${metadata.height} (${metadata.format})`);

    // 1. Generate PNG files for all sizes
    console.log('\n📦 Generating PNG files...');
    const pngBuffers = {};
    
    for (const size of SIZES.png) {
      const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      // Store buffer for ICO generation
      pngBuffers[size] = await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      console.log(`  ✓ icon-${size}.png`);
    }

    // 2. Generate main Linux icon (512x512)
    console.log('\n🐧 Generating Linux icon...');
    await sharp(SOURCE_IMAGE)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(OUTPUT_DIR, 'icon.png'));
    console.log('  ✓ icon.png (512x512)');

    // 3. Generate Windows ICO (multi-resolution)
    console.log('\n🪟 Generating Windows icon...');
    const icoSizes = [256, 128, 64, 48, 32, 24, 16];
    const icoBuffers = [];
    for (const size of icoSizes) {
      if (pngBuffers[size]) {
        icoBuffers.push(pngBuffers[size]);
      }
    }
    const icoBuffer = await pngToIco(icoBuffers);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'icon.ico'), icoBuffer);
    console.log('  ✓ icon.ico (multi-res: 256,128,64,48,32,24,16)');

    // 4. Generate macOS ICNS
    // Note: Creating proper ICNS requires macOS-specific tools or iconutil
    // We'll create a high-res PNG that electron-builder can convert
    console.log('\n🍎 Generating macOS base icon...');
    await sharp(SOURCE_IMAGE)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(OUTPUT_DIR, 'icon-1024.png'));
    console.log('  ✓ icon-1024.png (will be converted to ICNS by electron-builder)');

    // 5. Copy for web app favicon
    console.log('\n🌐 Generating web favicon...');
    const webPublicDir = path.join(__dirname, '..', 'apps', 'web', 'public');
    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }
    
    // favicon.ico (32x32 for web)
    const faviconBuffers = [pngBuffers[32], pngBuffers[16]].filter(Boolean);
    const faviconBuffer = await pngToIco(faviconBuffers);
    fs.writeFileSync(path.join(webPublicDir, 'favicon.ico'), faviconBuffer);
    console.log('  ✓ favicon.ico (32x32, 16x16)');

    // favicon.png (for modern browsers)
    await sharp(SOURCE_IMAGE)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(webPublicDir, 'favicon.png'));
    console.log('  ✓ favicon.png (192x192)');

    // apple-touch-icon
    await sharp(SOURCE_IMAGE)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(webPublicDir, 'apple-touch-icon.png'));
    console.log('  ✓ apple-touch-icon.png (180x180)');

    // 6. Create rounded logo for web app UI
    console.log('\n🎨 Generating rounded logo for app UI...');
    const webAssetsDir = path.join(__dirname, '..', 'apps', 'web', 'src', 'assets');
    if (!fs.existsSync(webAssetsDir)) {
      fs.mkdirSync(webAssetsDir, { recursive: true });
    }

    const logoSize = 256;
    const cornerRadius = 32;
    
    // Create rounded corner mask
    const roundedCorners = Buffer.from(
      `<svg width="${logoSize}" height="${logoSize}">
        <rect x="0" y="0" width="${logoSize}" height="${logoSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
      </svg>`
    );

    await sharp(SOURCE_IMAGE)
      .resize(logoSize, logoSize, {
        fit: 'cover',
        position: 'center'
      })
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toFile(path.join(webAssetsDir, 'logo-rounded.png'));
    console.log(`  ✓ logo-rounded.png (${logoSize}x${logoSize} with ${cornerRadius}px rounded corners)`);

    // Also copy original logo
    await sharp(SOURCE_IMAGE)
      .resize(256, 256, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toFile(path.join(webAssetsDir, 'logo.jpg'));
    console.log('  ✓ logo.jpg (256x256 original)');

    console.log('\n✅ Icon conversion complete!\n');
    console.log('📁 Output locations:');
    console.log(`  • Desktop icons: ${OUTPUT_DIR}/`);
    console.log(`  • Web favicons: ${webPublicDir}/`);
    console.log(`  • App UI logo: ${path.join(__dirname, '..', 'apps', 'web', 'src', 'assets')}/`);
    console.log('\n💡 Note: macOS ICNS will be generated by electron-builder during build.');
    console.log('   If you need a standalone .icns file, use: png2icons or iconutil on macOS.\n');

  } catch (error) {
    console.error('\n❌ Error converting icon:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

convertIcon();
