#!/usr/bin/env node
'use strict';

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const target = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 60000);
const intervalMs = Number(process.argv[4] ?? 500);

if (!target) {
  console.error('Usage: node wait-for-http.js <url> [timeoutMs] [intervalMs]');
  process.exit(1);
}

const fetchOnce = () => {
  const url = new URL(target);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        res.resume(); // discard body
        resolve(res.statusCode ?? 0);
      }
    );

    req.on('error', reject);
    req.end();
  });
};

const start = Date.now();

const poll = async () => {
  try {
    const status = await fetchOnce();
    if (status >= 200 && status < 400) {
      console.log(`wait-for-http: ${target} is ready (status ${status}).`);
      process.exit(0);
    }
    console.log(`wait-for-http: ${target} responded with ${status}, retrying...`);
  } catch (err) {
    console.log(`wait-for-http: request failed (${err?.message ?? err}), retrying...`);
  }

  if (Date.now() - start > timeoutMs) {
    console.error(`wait-for-http: timed out after ${timeoutMs}ms waiting for ${target}`);
    process.exit(1);
  }

  setTimeout(poll, intervalMs);
};

poll().catch((err) => {
  console.error('wait-for-http: unexpected error', err);
  process.exit(1);
});
