/**
 * Pre-build validation script for desktop builds
 * Ensures all required files and configurations are in place
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const requiredPaths = [
  "electron/main.js",
  "electron/preload.js",
  "package.json",
  "build-assets/icon.ico",
  "build-assets/icon.png",
];

const errors = [];

console.log("Validating desktop build prerequisites...\n");

for (const reqPath of requiredPaths) {
  const fullPath = path.join(rootDir, reqPath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing required file: ${reqPath}`);
  } else {
    console.log(`✓ ${reqPath}`);
  }
}

// Check package.json has required build configuration
const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

if (!pkg.build) {
  errors.push("Missing 'build' configuration in package.json");
} else {
  console.log("✓ build configuration exists");
}

if (!pkg.main) {
  errors.push("Missing 'main' entry in package.json");
} else {
  console.log(`✓ main entry: ${pkg.main}`);
}

console.log("");

if (errors.length > 0) {
  console.error("Validation failed:");
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log("All validations passed!\n");
}
