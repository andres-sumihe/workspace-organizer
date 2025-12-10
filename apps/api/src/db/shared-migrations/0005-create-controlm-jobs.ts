import type { PoolClient } from 'pg';

export const id = '0005-create-controlm-jobs';

/**
 * Create Control-M job tables in the shared PostgreSQL database.
 *
 * Tables:
 * - controlm_jobs: Control-M job definitions
 * - controlm_job_dependencies: Job dependency relationships
 * - controlm_job_conditions: Job conditions (IN/OUT)
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create controlm_jobs table
  await client.query(`
    CREATE TABLE IF NOT EXISTS controlm_jobs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      job_id INTEGER NOT NULL,
      application VARCHAR(255) NOT NULL,
      group_name VARCHAR(255) NOT NULL,
      mem_name VARCHAR(255),
      job_name VARCHAR(255) NOT NULL,
      description TEXT,
      node_id VARCHAR(100) NOT NULL,
      owner VARCHAR(100),
      task_type VARCHAR(50) NOT NULL DEFAULT 'Job',
      is_cyclic BOOLEAN NOT NULL DEFAULT false,
      priority VARCHAR(20),
      is_critical BOOLEAN NOT NULL DEFAULT false,
      days_calendar VARCHAR(255),
      weeks_calendar VARCHAR(255),
      from_time VARCHAR(20),
      to_time VARCHAR(20),
      interval_value VARCHAR(50),
      mem_lib VARCHAR(1000),
      author VARCHAR(100),
      creation_user VARCHAR(100),
      creation_date VARCHAR(50),
      change_user_id VARCHAR(100),
      change_date VARCHAR(50),
      is_active BOOLEAN NOT NULL DEFAULT true,
      linked_script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT controlm_jobs_job_id_app_unique UNIQUE (job_id, application)
    )
  `);

  // Create indexes for controlm_jobs
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_job_id ON controlm_jobs (job_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_application ON controlm_jobs (application)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_node_id ON controlm_jobs (node_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_job_name ON controlm_jobs (job_name)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_task_type ON controlm_jobs (task_type)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_is_active ON controlm_jobs (is_active)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_jobs_linked_script ON controlm_jobs (linked_script_id)');

  // Create trigger for controlm_jobs updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_controlm_jobs_updated_at ON controlm_jobs;
    CREATE TRIGGER trg_controlm_jobs_updated_at
    BEFORE UPDATE ON controlm_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create controlm_job_dependencies table
  await client.query(`
    CREATE TABLE IF NOT EXISTS controlm_job_dependencies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      predecessor_job_id UUID NOT NULL REFERENCES controlm_jobs(id) ON DELETE CASCADE,
      successor_job_id UUID NOT NULL REFERENCES controlm_jobs(id) ON DELETE CASCADE,
      condition_type VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT controlm_deps_unique UNIQUE (predecessor_job_id, successor_job_id),
      CONSTRAINT no_self_dependency CHECK (predecessor_job_id != successor_job_id)
    )
  `);

  // Create indexes for controlm_job_dependencies
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_controlm_deps_predecessor ON controlm_job_dependencies (predecessor_job_id)'
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_controlm_deps_successor ON controlm_job_dependencies (successor_job_id)'
  );

  // Create controlm_job_conditions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS controlm_job_conditions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      job_id UUID NOT NULL REFERENCES controlm_jobs(id) ON DELETE CASCADE,
      condition_name VARCHAR(255) NOT NULL,
      condition_type VARCHAR(20) NOT NULL,
      odate VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT controlm_conditions_unique UNIQUE (job_id, condition_name, condition_type)
    )
  `);

  // Create indexes for controlm_job_conditions
  await client.query('CREATE INDEX IF NOT EXISTS idx_controlm_conditions_job ON controlm_job_conditions (job_id)');
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_controlm_conditions_name ON controlm_job_conditions (condition_name)'
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_controlm_conditions_type ON controlm_job_conditions (condition_type)'
  );
};
