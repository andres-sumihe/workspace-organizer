const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { parseManifest, generateDryRun } = require('../lib/template-engine');
const { applyDryRunOpsTransactional } = require('../lib/fs-executor');

async function run() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wo-smoke-'));
  console.log('Using tmp workspace:', tmp);

  // create existing file that will be overwritten
  const existingFile = path.join(tmp, 'ProjectName', 'Output', 'Report.pdf');
  await fs.mkdirp(path.dirname(existingFile));
  await fs.writeFile(existingFile, 'OLD REPORT');

  const manifest = {
    id: 'test-template-1',
    name: 'Test Template',
    folders: [
      { path: 'ProjectName/Input' },
      { path: 'ProjectName/Output' }
    ],
    files: [
      { path: 'ProjectName/Input/TestingFile.xml', content: '<root>{{projectName}}</root>' },
      { path: 'ProjectName/Output/Report.pdf', content: 'PDF_PLACEHOLDER', binary: false }
    ]
  };

  const tokens = { projectName: 'MyProject' };

  const ops = generateDryRun(manifest, tmp, tokens);
  console.log('Dry-run ops:', ops.map((o) => ({ type: o.type, path: o.path })));

  const result = await applyDryRunOpsTransactional(ops, tmp, { policy: 'overwrite' });
  console.log('Apply result:', result.ok ? 'ok' : 'failed', result.error || '');

  // Verify
  const newFile = path.join(tmp, 'ProjectName', 'Input', 'TestingFile.xml');
  const report = path.join(tmp, 'ProjectName', 'Output', 'Report.pdf');

  const existsNew = await fs.pathExists(newFile);
  const existsReport = await fs.pathExists(report);

  console.log('New file exists:', existsNew);
  console.log('Report exists:', existsReport);

  // Check backup
  const historyDir = path.join(tmp, '.workspace-organizer', 'history');
  const historyExists = await fs.pathExists(historyDir);
  console.log('History dir exists:', historyExists);

  if (!result.ok || !existsNew || !existsReport) {
    console.error('Smoke test failed');
    process.exit(2);
  }

  console.log('Smoke test passed');
  // cleanup
  await fs.remove(tmp);
}

run().catch((err) => {
  console.error('Smoke test error', err);
  process.exit(1);
});
