/**
 * Convert logo.jpg to multiple icon formats for electron-builder
 * Requires sharp and png-to-ico packages
 */

const fs = require("fs");
const path = require("path");

async function convertIcons() {
  const sharp = require("sharp");
  const pngToIco = require("png-to-ico");

  const buildAssetsDir = path.join(__dirname, "..", "build-assets");
  const logoPath = path.join(buildAssetsDir, "logo.jpg");

  if (!fs.existsSync(logoPath)) {
    console.error("logo.jpg not found in build-assets directory");
    process.exit(1);
  }

  console.log("Converting logo.jpg to icon formats...\n");

  // Generate PNG icons at various sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

  for (const size of sizes) {
    const outputPath = path.join(
      buildAssetsDir,
      size === 256 ? "icon.png" : `icon-${size}.png`
    );
    await sharp(logoPath).resize(size, size).png().toFile(outputPath);
    console.log(`✓ Generated ${path.basename(outputPath)}`);
  }

  // Also save icon-256.png explicitly
  await sharp(logoPath)
    .resize(256, 256)
    .png()
    .toFile(path.join(buildAssetsDir, "icon-256.png"));
  console.log("✓ Generated icon-256.png");

  // Generate ICO for Windows (using 256px PNG)
  const icon256Path = path.join(buildAssetsDir, "icon-256.png");
  const icoBuffer = await pngToIco([icon256Path]);
  fs.writeFileSync(path.join(buildAssetsDir, "icon.ico"), icoBuffer);
  console.log("✓ Generated icon.ico");

  console.log("\nIcon conversion complete!");
}

convertIcons().catch((err) => {
  console.error("Error converting icons:", err);
  process.exit(1);
});
