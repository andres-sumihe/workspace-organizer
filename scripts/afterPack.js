/**
 * electron-builder afterPack hook
 * This script runs after the app has been packed but before final packaging.
 * Used to perform any post-pack cleanup or modifications.
 */

const fs = require("fs");
const path = require("path");

exports.default = async function (context) {
  const appDir = context.appOutDir;
  console.log(`afterPack: Processing ${appDir}`);

  // Log the packed files for debugging
  const resourcesDir = path.join(appDir, "resources");
  if (fs.existsSync(resourcesDir)) {
    console.log("afterPack: Resources directory exists");
  }

  // Ensure data directory exists for SQLite database
  const dataDir = path.join(resourcesDir, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("afterPack: Created data directory");
  }

  console.log("afterPack: Complete");
};
