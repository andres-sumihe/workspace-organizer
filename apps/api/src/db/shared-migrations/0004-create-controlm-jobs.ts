import type { PoolClient } from 'pg';

export const id = '0004-create-controlm-jobs';

/**
 * Migration: Control-M Jobs Table
 * 
 * Stores Control-M job definitions shared across the team.
 * Jobs can be linked to scripts for automation tracking.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create controlm_jobs table with correct schema
  await client.query(`
    CREATE TABLE IF NOT EXISTS controlm_jobs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      job_id INTEGER NOT NULL,
      application VARCHAR(255) NOT NULL,
      group_name VARCHAR(255) NOT NULL,
      mem_name VARCHAR(255),
      job_name VARCHAR(255) NOT NULL,
      description TEXT,
      node_id VARCHAR(255) NOT NULL,
      owner VARCHAR(255),
      task_type VARCHAR(50) DEFAULT 'Job',
      is_cyclic BOOLEAN DEFAULT false,
      priority VARCHAR(50),
      is_critical BOOLEAN DEFAULT false,
      days_calendar VARCHAR(255),
      weeks_calendar VARCHAR(255),
      from_time VARCHAR(10),
      to_time VARCHAR(10),
      interval_value VARCHAR(50),
      mem_lib VARCHAR(255),
      author VARCHAR(255),
      creation_user VARCHAR(255),
      creation_date VARCHAR(50),
      change_user_id VARCHAR(255),
      change_date VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      linked_script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create trigger for updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_controlm_jobs_updated_at ON controlm_jobs;
    CREATE TRIGGER trg_controlm_jobs_updated_at
    BEFORE UPDATE ON controlm_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create indexes
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_job_id ON controlm_jobs (job_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_application ON controlm_jobs (application)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_group ON controlm_jobs (group_name)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_name ON controlm_jobs (job_name)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_active ON controlm_jobs (is_active)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_script ON controlm_jobs (linked_script_id)');

  // Create job_dependencies table
  await client.query(`
    CREATE TABLE IF NOT EXISTS job_dependencies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      predecessor_job_id VARCHAR(255) NOT NULL,
      successor_job_id VARCHAR(255) NOT NULL,
      condition_type VARCHAR(50) DEFAULT 'OK',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create job_conditions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS job_conditions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      job_id VARCHAR(255) NOT NULL,
      condition_name VARCHAR(255) NOT NULL,
      condition_type VARCHAR(50) NOT NULL,
      odate VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes for dependencies and conditions
  await client.query('CREATE INDEX IF NOT EXISTS idx_job_dependencies_predecessor ON job_dependencies (predecessor_job_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_job_dependencies_successor ON job_dependencies (successor_job_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_job_conditions_job ON job_conditions (job_id)');
};
