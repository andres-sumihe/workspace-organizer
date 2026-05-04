import type { PoolClient } from 'pg';

export const id = '0017-create-team-calendar-wfh';

export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_public_holidays (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      holiday_date DATE NOT NULL,
      source_range_id UUID,
      reduces_annual_leave BOOLEAN NOT NULL DEFAULT FALSE,
      created_by_email VARCHAR(255) NOT NULL,
      updated_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT team_public_holidays_unique_name_date UNIQUE (team_id, name, holiday_date)
    )
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_public_holidays_team_date ON team_public_holidays (team_id, holiday_date)',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_public_holidays_source_range ON team_public_holidays (source_range_id)',
  );

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_public_holidays_updated_at ON team_public_holidays;
    CREATE TRIGGER trg_team_public_holidays_updated_at
    BEFORE UPDATE ON team_public_holidays
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS team_wfh_group_members (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      member_email VARCHAR(255) NOT NULL,
      group_code CHAR(1) NOT NULL CHECK (group_code IN ('A', 'B', 'C', 'D')),
      updated_by_email VARCHAR(255),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT team_wfh_group_members_unique UNIQUE (team_id, member_email),
      CONSTRAINT team_wfh_group_members_member_fk FOREIGN KEY (team_id, member_email)
        REFERENCES team_members(team_id, email) ON DELETE CASCADE
    )
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_group_members_team ON team_wfh_group_members (team_id)',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_group_members_group ON team_wfh_group_members (team_id, group_code)',
  );

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_wfh_group_members_updated_at ON team_wfh_group_members;
    CREATE TRIGGER trg_team_wfh_group_members_updated_at
    BEFORE UPDATE ON team_wfh_group_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS team_wfh_schedules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      group_code CHAR(1) NOT NULL CHECK (group_code IN ('A', 'B', 'C', 'D')),
      original_date DATE NOT NULL,
      schedule_date DATE NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
      conflict_holiday_id UUID REFERENCES team_public_holidays(id) ON DELETE SET NULL,
      generation_year INTEGER NOT NULL,
      generated_by_email VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT team_wfh_schedules_unique_original UNIQUE (team_id, generation_year, group_code, original_date)
    )
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_schedules_team_date ON team_wfh_schedules (team_id, schedule_date)',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_schedules_team_year ON team_wfh_schedules (team_id, generation_year)',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_schedules_team_status ON team_wfh_schedules (team_id, status)',
  );

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_wfh_schedules_updated_at ON team_wfh_schedules;
    CREATE TRIGGER trg_team_wfh_schedules_updated_at
    BEFORE UPDATE ON team_wfh_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS team_wfh_change_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      schedule_id UUID REFERENCES team_wfh_schedules(id) ON DELETE SET NULL,
      requester_email VARCHAR(255) NOT NULL,
      group_code CHAR(1) NOT NULL CHECK (group_code IN ('A', 'B', 'C', 'D')),
      original_date DATE NOT NULL,
      requested_date DATE NOT NULL,
      reason TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      approver_email VARCHAR(255),
      decision_note TEXT,
      decided_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT team_wfh_change_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
      CONSTRAINT team_wfh_change_requests_member_fk FOREIGN KEY (team_id, requester_email)
        REFERENCES team_members(team_id, email) ON DELETE CASCADE
    )
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_change_requests_team_status ON team_wfh_change_requests (team_id, status)',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_change_requests_requester ON team_wfh_change_requests (team_id, requester_email)',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_change_requests_schedule ON team_wfh_change_requests (schedule_id)',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_team_wfh_change_requests_requested_date ON team_wfh_change_requests (team_id, requested_date)',
  );

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_wfh_change_requests_updated_at ON team_wfh_change_requests;
    CREATE TRIGGER trg_team_wfh_change_requests_updated_at
    BEFORE UPDATE ON team_wfh_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_info (
      id SERIAL PRIMARY KEY,
      version INTEGER NOT NULL,
      app_version VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_by VARCHAR(255)
    )
  `);

  await client.query(`
    INSERT INTO schema_info (id, version, app_version, updated_by)
    VALUES (1, 2, 'manual', current_user)
    ON CONFLICT (id) DO UPDATE SET
      version = GREATEST(schema_info.version, EXCLUDED.version),
      updated_at = NOW(),
      updated_by = current_user
  `);
};
