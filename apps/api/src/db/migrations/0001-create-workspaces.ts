import type { Database } from 'sqlite';

export const id = '0001-create-workspaces';

export const up = async (db: Database) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      application TEXT NOT NULL,
      team TEXT NOT NULL,
      status TEXT NOT NULL,
      project_count INTEGER NOT NULL DEFAULT 0,
      template_count INTEGER NOT NULL DEFAULT 0,
      last_indexed_at TEXT NOT NULL,
      root_path TEXT NOT NULL,
      description TEXT,
      settings_json TEXT NOT NULL,
      statistics_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const existing = await db.get<{ count: number }>('SELECT COUNT(1) as count FROM workspaces');

  if (existing?.count === 0) {
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO workspaces (
          id,
          name,
          application,
          team,
          status,
          project_count,
          template_count,
          last_indexed_at,
          root_path,
          description,
          settings_json,
          statistics_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
                 (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
                 (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        'ws_finance_ops',
        'Finance Operations',
        'claris',
        'Finance',
        'healthy',
        24,
        6,
        now,
        'C:/workspaces/finance',
        'Shared workspace for finance automation.',
        JSON.stringify({
          enforceNamingRules: true,
          namingRules: [
            {
              id: 'rule_finance_docs',
              label: 'Finance documents prefix',
              appliesTo: 'file',
              pattern: '^FIN-[A-Z]{2}-\\d{4}$',
              description: 'Ensure finance documents include department code and year prefix.'
            }
          ]
        }),
        JSON.stringify({
          totalFolders: 120,
          totalFiles: 860,
          storageBytes: 512000000,
          lastScanAt: now
        }),
        now,
        now,

        'ws_hr_core',
        'HR Core Services',
        'claris',
        'Human Resources',
        'degraded',
        15,
        3,
        now,
        'C:/workspaces/hr',
        'Workspace containing HR onboarding and compliance materials.',
        JSON.stringify({
          enforceNamingRules: false,
          namingRules: []
        }),
        JSON.stringify({
          totalFolders: 80,
          totalFiles: 420,
          storageBytes: 268000000,
          lastScanAt: now
        }),
        now,
        now,

        'ws_it_infra',
        'IT Infrastructure',
        'claris',
        'IT',
        'healthy',
        38,
        10,
        now,
        'C:/workspaces/it-infra',
        'Infrastructure provisioning templates and runbooks.',
        JSON.stringify({
          enforceNamingRules: true,
          namingRules: [
            {
              id: 'rule_runbook_prefix',
              label: 'Runbook prefix',
              appliesTo: 'file',
              pattern: '^RB-[0-9]{3}$',
              description: 'Runbooks should follow RB-### pattern.'
            }
          ]
        }),
        JSON.stringify({
          totalFolders: 210,
          totalFiles: 1320,
          storageBytes: 894000000,
          lastScanAt: now
        }),
        now,
        now
      ]
    );
  }
};
