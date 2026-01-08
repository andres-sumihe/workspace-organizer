/**
 * Utility script to wait for an HTTP server to be ready
 * Usage: node wait-for-http.js <url> [timeout_ms]
 */

const http = require("http");
const https = require("https");

const url = process.argv[2];
const timeout = parseInt(process.argv[3], 10) || 30000;

if (!url) {
  console.error("Usage: node wait-for-http.js <url> [timeout_ms]");
  process.exit(1);
}

const startTime = Date.now();
const pollInterval = 500;

function checkServer() {
  const client = url.startsWith("https") ? https : http;

  const req = client.get(url, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 500) {
      console.log(`Server ready at ${url}`);
      process.exit(0);
    }
    retry();
  });

  req.on("error", () => {
    retry();
  });

  req.setTimeout(1000, () => {
    req.destroy();
    retry();
  });
}

function retry() {
  if (Date.now() - startTime >= timeout) {
    console.error(`Timeout waiting for ${url}`);
    process.exit(1);
  }
  setTimeout(checkServer, pollInterval);
}

console.log(`Waiting for ${url}...`);
checkServer();
