export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export interface TemplateFolder {
  name: string;
  folders?: TemplateFolder[];
  files?: TemplateFile[];
}

export interface TemplateFile {
  name: string;
  contents?: string;
  tokenized?: boolean;
}

export interface ProjectTemplate {
  id: string;
  label: string;
  description?: string;
  rootFolderName: string;
  structure: TemplateFolder[];
  tokens?: TemplateToken[];
}

export interface TemplateToken {
  key: string;
  label: string;
  description?: string;
  defaultValue?: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  templateId: string;
  createdAt: string;
  location: string;
  notes?: string;
}

export interface WorkspaceProject {
  id: string;
  workspaceId: string;
  name: string;
  relativePath: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyTemplateRequest {
  templateId: string;
  projectName: string;
  tokens?: Record<string, string>;
}

export interface FilePreviewResponse {
  path: string;
  mimeType: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  enforceNamingRules: boolean;
  namingRules: NamingRule[];
}

export interface NamingRule {
  id: string;
  label: string;
  appliesTo: 'folder' | 'file';
  pattern: string;
  description?: string;
  sample?: string;
}

export type WorkspaceStatus = 'healthy' | 'degraded' | 'offline';

export interface WorkspaceSummary {
  id: string;
  name: string;
  status: WorkspaceStatus;
  projectCount: number;
  templateCount: number;
  lastIndexedAt: string;
  rootPath: string;
}

export interface WorkspaceStatistics {
  totalFolders: number;
  totalFiles: number;
  storageBytes: number;
  lastScanAt: string;
}

export type WorkspaceActivityType =
  | 'templateApplied'
  | 'fileCreated'
  | 'fileRenamed'
  | 'fileDeleted'
  | 'ruleViolation'
  | 'custom';

export interface WorkspaceActivityItem {
  id: string;
  type: WorkspaceActivityType;
  occurredAt: string;
  actor: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface TemplateReference {
  id: string;
  label: string;
  lastAppliedAt?: string;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  rootPath: string;
  description?: string;
  settings: WorkspaceSettings;
  statistics: WorkspaceStatistics;
  recentActivity: WorkspaceActivityItem[];
  templates: TemplateReference[];
}

export type WorkspaceListResponse = PaginatedData<WorkspaceSummary>;

export interface WorkspaceDetailResponse {
  workspace: WorkspaceDetail;
}

export interface WorkspaceProjectListResponse {
  projects: WorkspaceProject[];
}

export interface WorkspaceProjectResponse {
  project: WorkspaceProject;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobSummary {
  id: string;
  type: string;
  status: JobStatus;
  workspaceId?: string;
  submittedAt: string;
  completedAt?: string;
  progressPercent?: number;
  message?: string;
}

export interface JobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface JobDetail extends JobSummary {
  logs: JobLogEntry[];
  metadata?: Record<string, unknown>;
}

export interface TemplateRun {
  id: string;
  jobId: string;
  templateId: string;
  workspaceId: string;
  initiatedBy: string;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  tokenValues?: Record<string, string>;
  outputPath?: string;
}

export type TemplateTokenMap = Record<string, string>;

// Template manifest types for ZIP + manifest format
export interface TemplateFileEntry {
  path: string; // relative path inside template
  content?: string; // textual content (tokenized)
  binary?: boolean; // whether this is binary data
  executable?: boolean; // hint (use with caution on Windows)
}

export interface TemplateFolderEntry {
  path: string; // relative path
}

export interface TemplateManifest {
  id: string;
  name: string;
  description?: string;
  version?: string;
  createdAt?: string;
  folders?: TemplateFolderEntry[];
  files?: TemplateFileEntry[];
  tokens?: { key: string; label?: string; default?: string }[];
}

export interface ProjectTemplateSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  folderCount?: number;
  fileCount?: number;
}

// Batch Script Tracking Types
export type ScriptType = 'batch' | 'powershell' | 'shell' | 'other';

export interface BatchScript {
  id: string;
  name: string;
  description?: string;
  filePath: string;
  content: string;
  type: ScriptType;
  isActive: boolean;
  hasCredentials: boolean;
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveMapping {
  id: string;
  scriptId: string;
  driveLetter: string;
  networkPath: string;
  serverName?: string;
  shareName?: string;
  hasCredentials: boolean;
  username?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptTag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptDependency {
  dependentScriptId: string;
  dependencyScriptId: string;
  createdAt: string;
}

export interface ScriptCreateRequest {
  name: string;
  description?: string;
  filePath: string;
  content: string;
  type?: ScriptType;
  isActive?: boolean;
  tagIds?: string[];
}

export interface ScriptUpdateRequest {
  name?: string;
  description?: string;
  content?: string;
  type?: ScriptType;
  isActive?: boolean;
  tagIds?: string[];
}

export interface ScriptScanRequest {
  directoryPath: string;
  recursive?: boolean;
  filePattern?: string;
  replaceExisting?: boolean;
}

export interface DriveConflict {
  driveLetter: string;
  scripts: Array<{
    scriptId: string;
    scriptName: string;
    networkPath: string;
  }>;
}

export interface DriveAnalysis {
  totalScripts: number;
  totalMappings: number;
  usedDrives: string[];
  availableDrives: string[];
  conflicts: DriveConflict[];
  /** All drive usage details (including single-script drives) */
  driveUsage: DriveConflict[];
}

export interface ScriptStats {
  totalScripts: number;
  activeScripts: number;
  scriptsWithCredentials: number;
  totalExecutions: number;
  scriptsByType: Record<ScriptType, number>;
  recentlyUpdated: BatchScript[];
}

export interface BatchScriptDetail extends BatchScript {
  driveMappings: DriveMapping[];
  tags: ScriptTag[];
  dependencies: BatchScript[];
  dependents: BatchScript[];
  linkedJobs?: Array<{
    id: string;
    jobId: number;
    jobName: string;
    application: string;
    nodeId: string;
  }>;
}

export type ScriptListResponse = PaginatedData<BatchScript>;

export interface ScriptDetailResponse {
  script: BatchScriptDetail;
}

export interface ScriptStatsResponse {
  stats: ScriptStats;
}

export interface DriveAnalysisResponse {
  analysis: DriveAnalysis;
}

// Control-M Job Types (for job dependency visualization)
export type ControlMTaskType = 'Job' | 'Dummy' | 'Command' | 'FileWatcher';

export interface ControlMJob {
  id: string;
  jobId: number; // Original JOB_ID from Control-M
  application: string;
  groupName: string;
  memName: string; // Script/file name
  jobName: string;
  description: string;
  nodeId: string; // Server node
  owner: string;
  taskType: ControlMTaskType;
  isCyclic: boolean;
  priority: string;
  isCritical: boolean;
  // Schedule info
  daysCalendar?: string;
  weeksCalendar?: string;
  fromTime?: string;
  toTime?: string;
  interval?: string;
  // Paths
  memLib?: string; // Script library path
  // Metadata
  author?: string;
  creationUser?: string;
  creationDate?: string;
  changeUserId?: string;
  changeDate?: string;
  isActive: boolean;
  // Linked script reference
  linkedScriptId?: string;
  // Parsed from job relations
  createdAt: string;
  updatedAt: string;
}

export interface ControlMJobDependency {
  id: string;
  predecessorJobId: string;
  successorJobId: string;
  conditionType: 'OC' | 'NOTOK' | 'ANY'; // OK Completion, Not OK, Any completion
  createdAt: string;
}

export interface ControlMJobCondition {
  id: string;
  jobId: string;
  conditionName: string;
  conditionType: 'IN' | 'OUT'; // Input (requires) or Output (produces)
  odate?: string;
  createdAt: string;
}

export interface ControlMJobStats {
  totalJobs: number;
  activeJobs: number;
  cyclicJobs: number;
  jobsByServer: Record<string, number>;
  jobsByApplication: Record<string, number>;
  jobsByTaskType: Record<string, number>;
}

export interface ControlMJobDetail extends ControlMJob {
  predecessors: ControlMJob[];
  successors: ControlMJob[];
  conditions: ControlMJobCondition[];
  linkedScript?: BatchScript; // If linked to a local script
}

export interface ControlMImportRequest {
  csvContent: string;
  replaceExisting?: boolean;
}

export interface ControlMImportResult {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

export type ControlMJobListResponse = PaginatedData<ControlMJob>;

export interface ControlMJobDetailResponse {
  job: ControlMJobDetail;
}

export interface ControlMJobStatsResponse {
  stats: ControlMJobStats;
}

// Job Dependency Graph Types (for visualization)
export interface JobGraphNode {
  id: string;
  jobName: string;
  nodeId: string;
  taskType: ControlMTaskType;
  isActive: boolean;
  isCyclic: boolean;
  x?: number;
  y?: number;
}

export interface JobGraphEdge {
  id: string;
  source: string;
  target: string;
  conditionType: string;
}

export interface JobDependencyGraph {
  nodes: JobGraphNode[];
  edges: JobGraphEdge[];
}

// Template Management Types
export interface TemplateSummaryV2 {
  id: string;
  name: string;
  description: string | null;
  folderCount: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFolderV2 {
  relativePath: string;
}

export interface TemplateFileV2 {
  relativePath: string;
  content: string;
}

export interface TemplateTokenV2 {
  key: string;
  label: string;
  defaultValue?: string;
}

export interface TemplateManifestV2 {
  id: string;
  name: string;
  description: string | null;
  folders: TemplateFolderV2[];
  files: TemplateFileV2[];
  tokens: TemplateTokenV2[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  folders: TemplateFolderV2[];
  files: TemplateFileV2[];
  tokens: TemplateTokenV2[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  folders?: TemplateFolderV2[];
  files?: TemplateFileV2[];
  tokens?: TemplateTokenV2[];
}

export type TemplateListResponse = PaginatedData<TemplateSummaryV2>;

export interface TemplateDetailResponse {
  template: TemplateManifestV2;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithRoles extends User {
  roles: Role[];
}

export interface UserCredentials {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse {
  user: UserWithRoles;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mode: AppMode;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  roleIds?: string[];
}

export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  isActive?: boolean;
  roleIds?: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type UserListResponse = PaginatedData<User>;

export interface UserDetailResponse {
  user: UserWithRoles;
}

// ============================================================================
// Team Types
// ============================================================================

/**
 * Team entity stored in shared PostgreSQL database.
 */
export interface Team {
  id: string;
  name: string;
  description?: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Team role hierarchy: owner > admin > member
 * - owner: Full control, can delete team, manage all members
 * - admin: Can manage members (except owner), full CRUD on resources
 * - member: Can CRUD their own resources, read all team resources
 */
export type TeamRole = 'owner' | 'admin' | 'member';

/**
 * Team member entity - links local users to teams via email.
 * This is the core of RBAC in the team-centric model.
 */
export interface TeamMember {
  id: string;
  teamId: string;
  email: string;
  displayName?: string;
  role: TeamRole;
  joinedAt: string;
  updatedAt: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  memberCount: number;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
}

export interface UpdateMemberRoleRequest {
  role: TeamRole;
}

export interface TeamListResponse {
  teams: Team[];
}

export interface TeamDetailResponse {
  team: TeamWithMembers;
}

export interface TeamMemberListResponse {
  members: TeamMember[];
}

// ============================================================================
// Team-Based RBAC (Role-Based Access Control) Types
// ============================================================================

/**
 * Resources that can be accessed in a team context.
 */
export type TeamResource = 'teams' | 'team_members' | 'scripts' | 'controlm_jobs' | 'audit';

/**
 * Actions that can be performed on team resources.
 */
export type TeamAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

/**
 * Role permission matrix - defines what each role can do.
 * Used by rbacService to check permissions.
 */
export const TEAM_ROLE_PERMISSIONS: Record<TeamRole, Record<TeamResource, TeamAction[]>> = {
  owner: {
    teams: ['read', 'update', 'delete', 'manage'],
    team_members: ['create', 'read', 'update', 'delete', 'manage'],
    scripts: ['create', 'read', 'update', 'delete'],
    controlm_jobs: ['create', 'read', 'update', 'delete'],
    audit: ['read']
  },
  admin: {
    teams: ['read'],
    team_members: ['create', 'read', 'update', 'delete'],
    scripts: ['create', 'read', 'update', 'delete'],
    controlm_jobs: ['create', 'read', 'update', 'delete'],
    audit: ['read']
  },
  member: {
    teams: ['read'],
    team_members: ['read'],
    scripts: ['create', 'read', 'update', 'delete'], // Own items only (enforced at service level)
    controlm_jobs: ['create', 'read', 'update', 'delete'], // Own items only
    audit: ['read'] // Own actions only
  }
};

/**
 * Role hierarchy for comparison (higher index = more permissions)
 */
export const TEAM_ROLE_HIERARCHY: TeamRole[] = ['member', 'admin', 'owner'];

/**
 * Check if a role has at least the minimum required role level.
 */
export const hasMinimumRole = (userRole: TeamRole, requiredRole: TeamRole): boolean => {
  return TEAM_ROLE_HIERARCHY.indexOf(userRole) >= TEAM_ROLE_HIERARCHY.indexOf(requiredRole);
};

/**
 * Check if a role has permission for an action on a resource.
 */
export const roleHasPermission = (
  role: TeamRole,
  resource: TeamResource,
  action: TeamAction
): boolean => {
  const permissions = TEAM_ROLE_PERMISSIONS[role]?.[resource] ?? [];
  return permissions.includes(action);
};

// Legacy RBAC types (kept for backward compatibility, will be deprecated)
export type ResourceType = 'scripts' | 'controlm_jobs' | 'users' | 'roles' | 'audit';

export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';

export interface Permission {
  id: string;
  resource: ResourceType;
  action: ActionType;
  description?: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export interface AssignRoleRequest {
  userId: string;
  roleId: string;
}

export type RoleListResponse = PaginatedData<Role>;

export interface RoleDetailResponse {
  role: RoleWithPermissions;
}

export interface PermissionListResponse {
  permissions: Permission[];
}

// ============================================================================
// Audit Log Types
// ============================================================================

/**
 * Audit actions for team-based tracking.
 * Tracks both resource operations and team membership changes.
 */
export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REVOKED'
  | 'JOIN_TEAM'
  | 'LEAVE_TEAM'
  | 'ROLE_CHANGE'
  | 'TEAM_CREATED'
  | 'TEAM_DELETED'
  | 'SCRIPT_CREATE'
  | 'SCRIPT_UPDATE'
  | 'SCRIPT_DELETE'
  | 'JOB_LINK'
  | 'JOB_UNLINK'
  | 'JOB_DELETE'
  | 'JOB_IMPORT';

/**
 * Audit log entry stored in shared PostgreSQL.
 * Uses member_email as actor identifier (not user_id).
 */
export interface AuditLogEntry {
  id: string;
  teamId?: string;
  memberEmail?: string;
  memberDisplayName?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AuditLogFilters {
  teamId?: string;
  memberEmail?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  fromDate?: string;
  toDate?: string;
}

export type AuditLogListResponse = PaginatedData<AuditLogEntry>;

// ============================================================================
// Installation Types
// ============================================================================

export interface InstallationStatus {
  isConfigured: boolean;
  sharedDbConnected: boolean;
  adminUserCreated: boolean;
  migrationsRun: boolean;
  pendingMigrations: string[];
}

export interface TestConnectionRequest {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  version?: string;
}

export interface ConfigureInstallationRequest {
  database: TestConnectionRequest;
  adminUser: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  };
}

export interface ConfigureInstallationResponse {
  success: boolean;
  message: string;
  migrationsRun: string[];
  /** @deprecated Auth is now local-only. This field may be undefined. */
  adminUserId?: string;
}

// ============================================================================
// Mode & Authentication Types (Dual-Mode Architecture)
// ============================================================================

export type AppMode = 'solo' | 'shared';

export interface ModeConfig {
  mode: AppMode;
  sharedEnabled: boolean;
  sharedDbConnected: boolean;
  localUserExists: boolean;
}

export interface ModeStatus {
  mode: AppMode;
  sharedEnabled: boolean;
  sharedDbConnected: boolean;
}

// Local User (Solo Mode)
export interface LocalUser {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mode-Aware User (extends existing User interface)
export interface AuthenticatedUser extends User {
  mode: AppMode;
  roles: string[];
  permissions: string[];
}

// Setup Types
export interface SetupStatus {
  needsSetup: boolean;
  hasSharedDb: boolean;
  sharedDbConnected: boolean;
  sharedEnabled: boolean;
}

export interface CreateAccountRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Response from account creation, includes a one-time recovery key.
 */
export interface CreateAccountResponse {
  user: LocalUser;
  recoveryKey: string;
}

/**
 * Request to reset password using recovery key.
 */
export interface ResetPasswordWithKeyRequest {
  username: string;
  recoveryKey: string;
  newPassword: string;
}


// Migration Types
export interface MigrationMapping {
  localId: string;
  sharedId: string;
  tableName: string;
  migratedAt: string;
}

export interface MigrationResult {
  success: boolean;
  itemsMigrated: number;
  errors: string[];
  dryRun: boolean;
}

export interface MigrationOptions {
  migrateScripts?: boolean;
  migrateJobs?: boolean;
  dryRun?: boolean;
}

// Team Configuration Types
export interface TeamConfigStatus {
  isConfigured: boolean;
  connectionString?: string;
  lastTestSuccessful: boolean;
  pendingMigration: boolean;
}

// ============================================================================
// Session Management Types
// ============================================================================

export interface SessionConfig {
  accessTokenExpiryMinutes: number;
  refreshTokenExpiryDays: number;
  inactivityTimeoutMinutes: number;
  maxConcurrentSessions: number;
  heartbeatIntervalSeconds: number;
}

export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface SessionHeartbeatResponse {
  valid: boolean;
  expiresAt: string;
  shouldRefresh: boolean;
}

// ============================================================================
// Team Attestation Types (Security)
// ============================================================================

/**
 * App Info stored in shared PostgreSQL database.
 * Contains server identity and public key for attestation.
 */
export interface AppInfo {
  serverId: string;
  teamId: string;
  teamName: string;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Attestation payload signed by the server.
 * Used to verify that the app is connected to the correct team database.
 */
export interface AttestationPayload {
  serverId: string;
  teamId: string;
  userId: string;
  timestamp: string;
  nonce: string;
}

/**
 * Signed attestation response from /auth/team-attest endpoint.
 */
export interface AttestationResponse {
  payload: AttestationPayload;
  signature: string;
  tlsFingerprint?: string;
}

/**
 * Local binding stored in SQLite settings.
 * Used to verify reconnections to the same team.
 */
export interface TeamBinding {
  serverId: string;
  teamId: string;
  teamName: string;
  publicKey: string;
  tlsFingerprint?: string;
  boundAt: string;
}

/**
 * Team join/create request
 */
export interface TeamJoinRequest {
  connectionString: string;
  createNew?: boolean;
  teamName?: string;
}

export interface TeamJoinResponse {
  success: boolean;
  teamId: string;
  teamName: string;
  attestation: AttestationResponse;
}

// ============================================================================
// Device Security Types
// ============================================================================

export interface DeviceInfo {
  deviceId: string;
  userId: string;
  deviceName: string;
  lastSeenAt: string;
  isCurrentDevice: boolean;
}

export interface LocalUserResetRequest {
  confirmPhrase: string; // Must type "RESET ALL DATA" to confirm
}

// ============================================================================
// Tools - Overtime Calculator Types
// ============================================================================

/**
 * Type of day for overtime calculation.
 * - workday: First hour 1.5x, remaining hours 2x
 * - holiday_weekend: First 7h at 2x, 8th at 3x, 9th+ at 4x
 */
export type OvertimeDayType = 'workday' | 'holiday_weekend';

/**
 * Settings for Tools features, stored under "tools.general" key.
 * baseSalary is the monthly salary used to calculate overtime pay.
 */
export interface ToolsGeneralSettings {
  baseSalary: number | null;
}

/**
 * Overtime entry stored in local SQLite database.
 */
export interface OvertimeEntry {
  id: string;
  date: string; // YYYY-MM-DD
  dayType: OvertimeDayType;
  startTime: string; // HH:MM format (24-hour)
  endTime: string; // HH:MM format (24-hour)
  totalHours: number; // Calculated from start/end time
  payAmount: number; // Calculated and rounded to 2 decimals
  baseSalary: number; // Effective salary used for this entry
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new overtime entry.
 */
export interface CreateOvertimeEntryRequest {
  date: string; // YYYY-MM-DD
  dayType: OvertimeDayType;
  startTime: string; // HH:MM format (24-hour)
  endTime: string; // HH:MM format (24-hour)
  baseSalaryOverride?: number | null; // Use this instead of settings.baseSalary
  note?: string;
}

/**
 * Response containing a list of overtime entries.
 */
export interface OvertimeEntryListResponse {
  items: OvertimeEntry[];
}

/**
 * Response containing a single overtime entry.
 */
export interface OvertimeEntryResponse {
  entry: OvertimeEntry;
}

// ============================================================================
// Work Journal (Daily Log) Types
// ============================================================================

/**
 * Status of a work log entry.
 */
export type WorkLogStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

/**
 * Priority level for work log entries.
 */
export type WorkLogPriority = 'low' | 'medium' | 'high';

/**
 * Global tag entity - reusable across multiple features (work logs, projects, etc.)
 */
export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Work log entry stored in local SQLite database.
 */
export interface WorkLogEntry {
  id: string;
  date: string; // YYYY-MM-DD (Journal Entry Date / Board Column)
  content: string; // Markdown supported description
  status: WorkLogStatus;
  priority?: WorkLogPriority;

  // Task Planning Fields
  startDate?: string; // ISO8601 (Planned Start)
  dueDate?: string; // ISO8601 (Deadline)
  actualEndDate?: string; // ISO8601 (Completion Date)

  // Relations
  projectId?: string;
  project?: PersonalProjectSummary; // Resolved project info

  // Resolved tags via polymorphic taggings
  tags: Tag[];

  createdAt: string;
  updatedAt: string;
}

/**
 * Minimal project info for embedding in work log entries.
 */
export interface PersonalProjectSummary {
  id: string;
  title: string;
  status: PersonalProjectStatus;
}

/**
 * Request to create a new work log entry.
 */
export interface CreateWorkLogRequest {
  date: string; // YYYY-MM-DD
  content: string;
  status?: WorkLogStatus;
  priority?: WorkLogPriority;
  startDate?: string;
  dueDate?: string;
  projectId?: string;
  tagIds?: string[];
}

/**
 * Request to update an existing work log entry.
 */
export interface UpdateWorkLogRequest {
  date?: string;
  content?: string;
  status?: WorkLogStatus;
  priority?: WorkLogPriority;
  startDate?: string;
  dueDate?: string;
  actualEndDate?: string;
  projectId?: string;
  tagIds?: string[];
}

/**
 * Request to rollover unfinished work logs to a new date.
 */
export interface RolloverWorkLogsRequest {
  fromDate: string; // YYYY-MM-DD - source date to rollover from
  toDate?: string; // YYYY-MM-DD - target date (defaults to today)
  mode: 'move' | 'copy';
}

/**
 * Response for rollover operation.
 */
export interface RolloverWorkLogsResponse {
  rolledOverCount: number;
  items: WorkLogEntry[];
}

/**
 * Response containing a list of work log entries.
 */
export interface WorkLogListResponse {
  items: WorkLogEntry[];
}

/**
 * Response containing a single work log entry.
 */
export interface WorkLogResponse {
  entry: WorkLogEntry;
}

/**
 * Request to create a new tag.
 */
export interface CreateTagRequest {
  name: string;
  color?: string;
}

/**
 * Request to update an existing tag.
 */
export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

/**
 * Response containing a list of tags.
 */
export interface TagListResponse {
  items: Tag[];
}

/**
 * Response containing a single tag.
 */
export interface TagResponse {
  tag: Tag;
}

/**
 * Tagging entity - links a tag to any taggable resource.
 */
export interface Tagging {
  id: string;
  tagId: string;
  taggableType: string; // e.g., 'work_logs', 'personal_projects'
  taggableId: string;
  createdAt: string;
}

// ============================================================================
// Personal Projects Types
// ============================================================================

/**
 * Status of a personal project.
 */
export type PersonalProjectStatus = 'active' | 'completed' | 'on_hold' | 'archived';

/**
 * Personal project entity - represents logical undertakings (initiatives, tasks).
 */
export interface PersonalProject {
  id: string;
  title: string;
  description?: string;

  status: PersonalProjectStatus;

  // Planning Data
  startDate?: string;
  dueDate?: string;
  actualEndDate?: string;

  // Business Metadata
  businessProposalId?: string;
  changeId?: string;

  // Content
  notes?: string;

  // Relations
  workspaceId?: string;
  tags: Tag[];

  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new personal project.
 */
export interface CreatePersonalProjectRequest {
  title: string;
  description?: string;
  status?: PersonalProjectStatus;
  startDate?: string;
  dueDate?: string;
  businessProposalId?: string;
  changeId?: string;
  notes?: string;
  workspaceId?: string;
  tagIds?: string[];
}

/**
 * Request to update an existing personal project.
 */
export interface UpdatePersonalProjectRequest {
  title?: string;
  description?: string;
  status?: PersonalProjectStatus;
  startDate?: string;
  dueDate?: string;
  actualEndDate?: string;
  businessProposalId?: string;
  changeId?: string;
  notes?: string;
  workspaceId?: string;
  tagIds?: string[];
}

/**
 * Response containing a list of personal projects.
 */
export interface PersonalProjectListResponse {
  items: PersonalProject[];
}

/**
 * Response containing a single personal project.
 */
export interface PersonalProjectResponse {
  project: PersonalProject;
}

/**
 * Extended project detail including linked work logs (tasks).
 * Used by the Project Detail page to show comprehensive project information.
 */
export interface PersonalProjectDetail extends PersonalProject {
  /** Linked work log entries (tasks) for this project */
  linkedTasks: WorkLogEntry[];
  /** Summary statistics for the project */
  taskStats: PersonalProjectTaskStats;
  /** Linked workspace information (if any) */
  linkedWorkspace?: WorkspaceSummary;
}

/**
 * Task statistics for a project.
 */
export interface PersonalProjectTaskStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
}

/**
 * Response containing detailed project information.
 */
export interface PersonalProjectDetailResponse {
  project: PersonalProjectDetail;
}

// ============================================================================
// Notes & Credentials Vault Types
// ============================================================================

/**
 * A note entry for storing markdown/text content.
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  projectId?: string;
  project?: PersonalProject;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new note.
 */
export interface CreateNoteRequest {
  title: string;
  content?: string;
  isPinned?: boolean;
  projectId?: string;
}

/**
 * Request to update an existing note.
 */
export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  isPinned?: boolean;
  projectId?: string;
}

/**
 * Response containing a single note.
 */
export interface NoteResponse {
  note: Note;
}

/**
 * Response containing a list of notes.
 */
export interface NoteListResponse {
  items: Note[];
}

/**
 * Credential type for vault entries.
 */
export type CredentialType = 'password' | 'api_key' | 'ssh' | 'database' | 'generic';

/**
 * A credential entry (metadata only, no decrypted data).
 */
export interface Credential {
  id: string;
  title: string;
  type: CredentialType;
  projectId?: string;
  project?: PersonalProject;
  createdAt: string;
  updatedAt: string;
}

/**
 * Decrypted credential data structure.
 */
export interface CredentialData {
  username?: string;
  password?: string;
  apiKey?: string;
  host?: string;
  port?: number;
  database?: string;
  privateKey?: string;
  notes?: string;
  customFields?: Record<string, string>;
}

/**
 * A credential entry with decrypted data.
 */
export interface CredentialWithData extends Credential {
  data: CredentialData;
}

/**
 * Request to create a new credential.
 */
export interface CreateCredentialRequest {
  title: string;
  type?: CredentialType;
  projectId?: string;
  data: CredentialData;
}

/**
 * Request to update an existing credential.
 */
export interface UpdateCredentialRequest {
  title?: string;
  type?: CredentialType;
  projectId?: string;
  data?: CredentialData;
}

/**
 * Response containing a single credential (metadata only).
 */
export interface CredentialResponse {
  credential: Credential;
}

/**
 * Response containing a credential with decrypted data.
 */
export interface CredentialRevealResponse {
  credential: CredentialWithData;
}

/**
 * Response containing a list of credentials (metadata only).
 */
export interface CredentialListResponse {
  items: Credential[];
}

/**
 * Request to unlock the vault with master password.
 */
export interface VaultUnlockRequest {
  masterPassword: string;
}

/**
 * Response after vault unlock.
 */
export interface VaultUnlockResponse {
  success: boolean;
  message?: string;
}

/**
 * Request to setup the vault with initial master password.
 */
export interface VaultSetupRequest {
  masterPassword: string;
}

/**
 * Response after vault setup.
 */
export interface VaultSetupResponse {
  success: boolean;
  message?: string;
}

/**
 * Vault status information.
 */
export interface VaultStatusResponse {
  isSetup: boolean;
  isUnlocked: boolean;
}

// IPC Types for Electron bridge
export * from './ipc.types.js';
