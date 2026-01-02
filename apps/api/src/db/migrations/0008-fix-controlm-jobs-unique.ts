import type Database from 'better-sqlite3';

export const id = '0008-fix-controlm-jobs-unique';

export const up = async (db: Database.Database) => {
  // Drop ALL unique constraints on job_id
  // In Control-M CSV exports, JOB_ID is NOT unique - it's just a sequence number
  // that can repeat across different jobs. Only the UUID 'id' column is unique.
  db.exec(`DROP INDEX IF EXISTS ux_controlm_jobs_unique;`);
  db.exec(`DROP INDEX IF EXISTS ux_controlm_jobs_job_id;`);
};

export const down = async (db: Database.Database) => {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_controlm_jobs_unique ON controlm_jobs(job_id, application);`);
};



