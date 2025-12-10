import type { PoolClient } from 'pg';

export const id = '0002-create-rbac';

/**
 * Create RBAC (Role-Based Access Control) tables.
 *
 * Tables:
 * - roles: Role definitions (admin, developer, viewer, etc.)
 * - permissions: Permission definitions (resource:action)
 * - role_permissions: Many-to-many relationship between roles and permissions
 * - user_roles: Many-to-many relationship between users and roles
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create roles table
  await client.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT roles_name_unique UNIQUE (name)
    )
  `);

  // Create trigger for roles updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
    CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create permissions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      resource VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT permissions_resource_action_unique UNIQUE (resource, action)
    )
  `);

  // Create indexes for permissions
  await client.query('CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions (resource)');

  // Create role_permissions junction table
  await client.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role_id, permission_id)
    )
  `);

  // Create user_roles junction table
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, role_id)
    )
  `);

  // Create indexes for junction tables
  await client.query('CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions (permission_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id)');

  // Seed default permissions
  const permissions = [
    // Scripts permissions
    { resource: 'scripts', action: 'create', description: 'Create new scripts' },
    { resource: 'scripts', action: 'read', description: 'View scripts' },
    { resource: 'scripts', action: 'update', description: 'Edit scripts' },
    { resource: 'scripts', action: 'delete', description: 'Delete scripts' },
    { resource: 'scripts', action: 'execute', description: 'Execute scripts' },
    // Control-M Jobs permissions
    { resource: 'controlm_jobs', action: 'create', description: 'Create Control-M jobs' },
    { resource: 'controlm_jobs', action: 'read', description: 'View Control-M jobs' },
    { resource: 'controlm_jobs', action: 'update', description: 'Edit Control-M jobs' },
    { resource: 'controlm_jobs', action: 'delete', description: 'Delete Control-M jobs' },
    // Users permissions
    { resource: 'users', action: 'create', description: 'Create user accounts' },
    { resource: 'users', action: 'read', description: 'View user accounts' },
    { resource: 'users', action: 'update', description: 'Edit user accounts' },
    { resource: 'users', action: 'delete', description: 'Delete user accounts' },
    { resource: 'users', action: 'manage', description: 'Full user management' },
    // Roles permissions
    { resource: 'roles', action: 'create', description: 'Create roles' },
    { resource: 'roles', action: 'read', description: 'View roles' },
    { resource: 'roles', action: 'update', description: 'Edit roles' },
    { resource: 'roles', action: 'delete', description: 'Delete roles' },
    { resource: 'roles', action: 'manage', description: 'Full role management' },
    // Audit log permissions
    { resource: 'audit', action: 'read', description: 'View audit logs' }
  ];

  for (const perm of permissions) {
    await client.query(
      `INSERT INTO permissions (resource, action, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (resource, action) DO NOTHING`,
      [perm.resource, perm.action, perm.description]
    );
  }

  // Seed default roles
  const roles = [
    {
      name: 'admin',
      description: 'Full system access - can manage all resources',
      isSystem: true
    },
    {
      name: 'developer',
      description: 'Can manage scripts and view Control-M jobs',
      isSystem: true
    },
    {
      name: 'viewer',
      description: 'Read-only access to all shared resources',
      isSystem: true
    }
  ];

  for (const role of roles) {
    await client.query(
      `INSERT INTO roles (name, description, is_system)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING`,
      [role.name, role.description, role.isSystem]
    );
  }

  // Assign permissions to admin role (all permissions)
  await client.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'admin'
    ON CONFLICT DO NOTHING
  `);

  // Assign permissions to developer role
  await client.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'developer'
      AND (
        (p.resource = 'scripts')
        OR (p.resource = 'controlm_jobs' AND p.action = 'read')
      )
    ON CONFLICT DO NOTHING
  `);

  // Assign permissions to viewer role (read-only)
  await client.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'viewer'
      AND p.action = 'read'
    ON CONFLICT DO NOTHING
  `);
};
