import { Database, Loader2, Save, Settings as SettingsIcon, Server, Link2, Unlink, AlertTriangle, RefreshCw, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { schemaValidationApi, type ValidationResponse } from '@/api/schema-validation';
import { settingsApi } from '@/api/settings';
import { PageShell } from '@/components/layout/page-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { useInstallation } from '@/contexts/installation-context';
import { useMode } from '@/contexts/mode-context';
import { useValidationSettings } from '@/contexts/validation-settings-context';
import { extractBICFromLT } from '@/utils/swift-mt-validator';

type ConnectionFormState = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

const defaultConnectionForm: ConnectionFormState = {
  host: '',
  port: '5432',
  database: '',
  user: '',
  password: '',
  ssl: false
};

const buildConnectionStringFromForm = (form: ConnectionFormState): string => {
  const host = form.host.trim();
  const port = form.port.trim() || '5432';
  const database = form.database.trim();
  const user = form.user.trim();
  const password = form.password;

  if (!host || !database || !user) {
    return '';
  }

  const encodedUser = encodeURIComponent(user);
  const authSegment = password ? `${encodedUser}:${encodeURIComponent(password)}` : encodedUser;
  const portSegment = port ? `:${port}` : '';
  const sslSegment = form.ssl ? '?ssl=true' : '';

  return `postgresql://${authSegment}@${host}${portSegment}/${database}${sslSegment}`;
};

const hasConnectionRequiredFields = (form: ConnectionFormState): boolean => {
  return Boolean(
    form.host.trim() &&
    form.port.trim() &&
    form.database.trim() &&
    form.user.trim() &&
    form.password.trim()
  );
};

export const SettingsPage = () => {
  const { status: installationStatus, isLoading: installLoading, checkStatus } = useInstallation();
  const { isSoloMode, isSharedMode, refreshAuth } = useAuth();
  const { refreshStatus } = useMode();
  const {
    criteria,
    updateCriteria,
    isEnabled,
    setIsEnabled,
    mtCriteria,
    updateMTCriteria,
    isMTEnabled,
    setIsMTEnabled,
    isLoading: contextLoading,
    error: contextError,
    refresh
  } = useValidationSettings();

  const [formData, setFormData] = useState(criteria);
  const [mtFormData, setMTFormData] = useState(mtCriteria);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Team config state
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>(defaultConnectionForm);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isConfiguringTeam, setIsConfiguringTeam] = useState(false);
  const [isDisablingTeam, setIsDisablingTeam] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isRunningMigrations, setIsRunningMigrations] = useState(false);
  const [teamActionMessage, setTeamActionMessage] = useState<{ success: boolean; message: string } | null>(null);

  // Schema validation state
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const connectionString = useMemo(() => buildConnectionStringFromForm(connectionForm), [connectionForm]);
  const isConnectionFormValid = useMemo(() => hasConnectionRequiredFields(connectionForm), [connectionForm]);

  const updateConnectionForm = (field: keyof ConnectionFormState, value: string | boolean) => {
    setConnectionForm((prev) => ({ ...prev, [field]: value }));
    setConnectionTestResult(null);
  };

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Sync form data when context data changes (e.g., after loading from API)
  useEffect(() => {
    setFormData(criteria);
  }, [criteria]);

  useEffect(() => {
    setMTFormData(mtCriteria);
  }, [mtCriteria]);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    
    try {
      // Auto-extract BIC from Logical Terminal if 12 characters entered
      const processedMTFormData = {
        ...mtFormData,
        senderBIC: mtFormData.senderBIC.length === 12 
          ? extractBICFromLT(mtFormData.senderBIC) || mtFormData.senderBIC 
          : mtFormData.senderBIC,
        receiverBIC: mtFormData.receiverBIC.length === 12 
          ? extractBICFromLT(mtFormData.receiverBIC) || mtFormData.receiverBIC 
          : mtFormData.receiverBIC
      };
      
      await updateCriteria(formData);
      await updateMTCriteria(processedMTFormData);
      setMTFormData(processedMTFormData);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save settings');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    
    try {
      await settingsApi.resetValidationSettings();
      await refresh();
      setSaveMessage('Reset to default values');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reset settings');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await setIsEnabled(checked);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update setting');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleToggleMTEnabled = async (checked: boolean) => {
    try {
      await setIsMTEnabled(checked);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update setting');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Team config handlers
  const handleTestConnection = async () => {
    if (!isConnectionFormValid || !connectionString) {
      setConnectionTestResult({ success: false, message: 'All connection fields are required' });
      return;
    }

    setIsTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/team-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: connectionString.trim() }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setConnectionTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setConnectionTestResult({ success: false, message: data.message || 'Connection failed' });
      }
    } catch (err) {
      setConnectionTestResult({ success: false, message: err instanceof Error ? err.message : 'Connection test failed' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleConfigureTeam = async () => {
    if (!isConnectionFormValid || !connectionString) {
      setErrorMessage('Please complete all connection fields');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    setIsConfiguringTeam(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/team-config/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: connectionString.trim() }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSaveMessage('Shared mode enabled successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
        setConnectionForm(defaultConnectionForm);
        setConnectionTestResult(null);
        await Promise.all([refreshStatus(), refreshAuth(), checkStatus()]);
      } else {
        setErrorMessage(data.message || 'Failed to configure shared mode');
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to configure shared mode');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsConfiguringTeam(false);
    }
  };

  const handleDisableSharedMode = async () => {
    if (!confirm('Are you sure you want to disable shared mode? You will return to Solo mode with local-only authentication.')) {
      return;
    }

    setIsDisablingTeam(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/team-config/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSaveMessage('Shared mode disabled. Returning to Solo mode.');
        setTimeout(() => setSaveMessage(null), 3000);
        await Promise.all([refreshStatus(), refreshAuth(), checkStatus()]);
      } else {
        setErrorMessage(data.message || 'Failed to disable shared mode');
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to disable shared mode');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsDisablingTeam(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setTeamActionMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/team-config/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTeamActionMessage({ success: true, message: data.message || 'Reconnected successfully' });
        await Promise.all([refreshStatus(), refreshAuth(), checkStatus()]);
        setTimeout(() => setTeamActionMessage(null), 5000);
      } else {
        setTeamActionMessage({ success: false, message: data.message || 'Failed to reconnect' });
        setTimeout(() => setTeamActionMessage(null), 5000);
      }
    } catch (err) {
      setTeamActionMessage({ success: false, message: err instanceof Error ? err.message : 'Failed to reconnect' });
      setTimeout(() => setTeamActionMessage(null), 5000);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleRunMigrations = async () => {
    setIsRunningMigrations(true);
    setTeamActionMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/team-config/run-migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTeamActionMessage({ success: true, message: data.message || 'Migrations completed' });
        await Promise.all([refreshStatus(), refreshAuth(), checkStatus()]);
        setTimeout(() => setTeamActionMessage(null), 5000);
      } else {
        setTeamActionMessage({ success: false, message: data.message || 'Failed to run migrations' });
        setTimeout(() => setTeamActionMessage(null), 5000);
      }
    } catch (err) {
      setTeamActionMessage({ success: false, message: err instanceof Error ? err.message : 'Failed to run migrations' });
      setTimeout(() => setTeamActionMessage(null), 5000);
    } finally {
      setIsRunningMigrations(false);
    }
  };

  const handleValidateSchema = async () => {
    setIsValidating(true);
    setTeamActionMessage(null);

    try {
      const result = await schemaValidationApi.validate();
      setValidationResult(result);
      
      if (result.valid) {
        setTeamActionMessage({ success: true, message: '✓ All schemas valid!' });
      } else {
        setTeamActionMessage({ 
          success: false, 
          message: `⚠ Schema validation failed: ${result.summary.invalid} invalid, ${result.summary.missing} missing` 
        });
      }
      
      setTimeout(() => setTeamActionMessage(null), 5000);
    } catch (err) {
      setTeamActionMessage({ success: false, message: err instanceof Error ? err.message : 'Schema validation failed' });
      setTimeout(() => setTeamActionMessage(null), 5000);
    } finally {
      setIsValidating(false);
    }
  };

  const handleResetAndMigrate = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: This will DELETE ALL team data (scripts, jobs, audit logs) and re-create tables from scratch.\n\n' +
      'This operation is IRREVERSIBLE.\n\n' +
      'Are you absolutely sure you want to continue?'
    );

    if (!confirmed) return;

    setIsResettingDb(true);
    setTeamActionMessage(null);

    try {
      const result = await schemaValidationApi.resetAndMigrate();
      
      if (result.success) {
        setValidationResult(result.validation);
        setTeamActionMessage({ 
          success: true, 
          message: `✓ Reset complete: Dropped ${result.reset.tablesDropped.length} tables, ran ${result.migrations.count} migrations` 
        });
        await Promise.all([refreshStatus(), refreshAuth(), checkStatus()]);
      } else {
        setTeamActionMessage({ success: false, message: result.message || 'Reset and migrate failed' });
      }
      
      setTimeout(() => setTeamActionMessage(null), 8000);
    } catch (err) {
      setTeamActionMessage({ success: false, message: err instanceof Error ? err.message : 'Reset and migrate failed' });
      setTimeout(() => setTeamActionMessage(null), 5000);
    } finally {
      setIsResettingDb(false);
    }
  };

  if (contextLoading) {
    return (
      <PageShell
        title="Settings"
        description="Configure application settings and validation criteria"
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading settings...</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Settings"
      description="Configure application settings and validation criteria"
      toolbar={
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Application Configuration</span>
          <Badge variant={isSoloMode ? 'secondary' : 'default'} className="ml-2">
            {isSoloMode ? 'Solo Mode' : 'Shared Mode'}
          </Badge>
        </div>
      }
    >
      <div className="max-w-3xl space-y-6">
        {saveMessage && (
          <Alert variant="success">
            <AlertDescription>{saveMessage}</AlertDescription>
          </Alert>
        )}

        {(errorMessage || contextError) && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage || contextError}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="team">Team Features</TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6 mt-6">
            {/* Shared Database Status */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Database className="size-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-1">Database Status</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Current mode and database connection status.
                  </p>
                  {installLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Checking connection...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Mode:</span>
                        <Badge variant={isSoloMode ? 'secondary' : 'default'}>
                          {isSoloMode ? 'Solo (Local)' : 'Shared (Team)'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Local Database:</span>
                        <Badge variant="success">Connected</Badge>
                      </div>
                      {isSharedMode && (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">Shared Database:</span>
                            {installationStatus?.sharedDbConnected ? (
                              <Badge variant="success">Connected</Badge>
                            ) : (
                              <Badge variant="destructive">Disconnected</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">Migrations:</span>
                            {installationStatus?.migrationsRun ? (
                              installationStatus.pendingMigrations.length > 0 ? (
                                <Badge variant="secondary">{installationStatus.pendingMigrations.length} pending</Badge>
                              ) : (
                                <Badge variant="success">Up to date</Badge>
                              )
                            ) : (
                              <Badge variant="secondary">Not run</Badge>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Validation Settings Tab */}
          <TabsContent value="validation" className="space-y-6 mt-6">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">ISO20022 Validation</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure validation criteria for ISO20022 XML files (pacs, camt, pain, etc.) in the testing environment.
                  </p>

                  <div className="flex items-center gap-3 mb-6">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={handleToggleEnabled}
                      id="validation-enabled"
                      disabled={isSaving}
                    />
                    <Label htmlFor="validation-enabled" className="cursor-pointer">
                      Enable automatic validation for ISO20022 files
                    </Label>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium">Sender Criteria</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sender-dn">Sender DN</Label>
                    <Input
                      id="sender-dn"
                      value={formData.senderDN}
                      onChange={(e) => setFormData({ ...formData, senderDN: e.target.value })}
                      placeholder="ou=xxx,o=cenaidja,o=swift"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expected value for Sender/DN element in ISO20022 messages
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sender-fullname">Sender Full Name</Label>
                    <Input
                      id="sender-fullname"
                      value={formData.senderFullName}
                      onChange={(e) => setFormData({ ...formData, senderFullName: e.target.value })}
                      placeholder="CENAIDJAXXX"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expected value for Sender/FullName/X1 element
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium">Receiver Criteria</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="receiver-dn">Receiver DN</Label>
                    <Input
                      id="receiver-dn"
                      value={formData.receiverDN}
                      onChange={(e) => setFormData({ ...formData, receiverDN: e.target.value })}
                      placeholder="ou=xxx,o=cenaidja,o=swift"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expected value for Receiver/DN element in ISO20022 messages
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receiver-fullname">Receiver Full Name</Label>
                    <Input
                      id="receiver-fullname"
                      value={formData.receiverFullName}
                      onChange={(e) => setFormData({ ...formData, receiverFullName: e.target.value })}
                      placeholder="CENAIDJAXXX"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expected value for Receiver/FullName/X1 element
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleSave} className="flex items-center gap-2" disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save Settings
                  </Button>
                  <Button onClick={handleReset} variant="outline" disabled={isSaving}>
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">SWIFT MT Validation (ISO 15022)</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure validation criteria for SWIFT FIN MT messages (MT103, MT202, etc.).
                    Detection is automatic for all text-based files.
                  </p>

                  <div className="flex items-center gap-3 mb-6">
                    <Switch
                      checked={isMTEnabled}
                      onCheckedChange={handleToggleMTEnabled}
                      id="mt-validation-enabled"
                      disabled={isSaving}
                    />
                    <Label htmlFor="mt-validation-enabled" className="cursor-pointer">
                      Enable automatic validation for SWIFT MT files
                    </Label>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium">BIC Criteria</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sender-bic">Sender BIC</Label>
                    <Input
                      id="sender-bic"
                      value={mtFormData.senderBIC}
                      onChange={(e) => setMTFormData({ ...mtFormData, senderBIC: e.target.value.toUpperCase() })}
                      placeholder="CENAIDJ0XXX"
                      className="font-mono text-sm uppercase"
                      maxLength={12}
                      disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter BIC8, BIC11, or Logical Terminal (12 chars). BIC will be auto-extracted. Leave empty to skip.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receiver-bic">Receiver BIC</Label>
                    <Input
                      id="receiver-bic"
                      value={mtFormData.receiverBIC}
                      onChange={(e) => setMTFormData({ ...mtFormData, receiverBIC: e.target.value.toUpperCase() })}
                      placeholder="CENAIDJ0AXXX"
                      className="font-mono text-sm uppercase"
                      maxLength={12}
                      disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter BIC8, BIC11, or Logical Terminal (12 chars). BIC will be auto-extracted. Leave empty to skip.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleSave} className="flex items-center gap-2" disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save Settings
                  </Button>
                  <Button onClick={handleReset} variant="outline" disabled={isSaving}>
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </Card>

            <Alert variant="info">
              <AlertCircle className="size-4" />
              <AlertDescription>
                <h3 className="font-medium mb-2">How it works</h3>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>When you open an XML file in the File Manager, it will be automatically checked for ISO20022 format</li>
                  <li>When you open any text file, it will be checked for SWIFT MT format if MT validation is enabled</li>
                  <li>ISO20022 validation checks Sender/Receiver DN and Full Names in MX messages</li>
                  <li>SWIFT MT validation checks Sender/Receiver BIC codes in FIN messages</li>
                  <li>Validation results appear in the preview panel with detailed error messages</li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Team Features Tab */}
          <TabsContent value="team" className="space-y-6 mt-6">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Server className="size-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-1">Team Features</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enable shared mode to connect to a PostgreSQL database for team collaboration features including 
                    shared scripts, user management, and audit logging.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Current Mode:</span>
                      <Badge variant={isSoloMode ? 'secondary' : 'default'}>
                        {isSoloMode ? 'Solo (Local Only)' : 'Shared (Team)'}
                      </Badge>
                    </div>

                    {isSoloMode ? (
                      <div className="space-y-4 pt-4 border-t">
                        <Alert variant="warning">
                          <AlertTriangle className="size-4" />
                          <AlertDescription>
                            <p className="font-medium mb-1">Solo Mode Active</p>
                            <p>You are currently running in solo mode with local authentication. 
                               To enable team features, configure a PostgreSQL connection below.</p>
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="db-host">Host</Label>
                              <Input
                                id="db-host"
                                value={connectionForm.host}
                                onChange={(e) => updateConnectionForm('host', e.target.value)}
                                placeholder="db.company.com"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="db-port">Port</Label>
                              <Input
                                id="db-port"
                                type="number"
                                min="1"
                                value={connectionForm.port}
                                onChange={(e) => updateConnectionForm('port', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="db-name">Database</Label>
                              <Input
                                id="db-name"
                                value={connectionForm.database}
                                onChange={(e) => updateConnectionForm('database', e.target.value)}
                                placeholder="workspace_organizer"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="db-user">Username</Label>
                              <Input
                                id="db-user"
                                value={connectionForm.user}
                                onChange={(e) => updateConnectionForm('user', e.target.value)}
                                placeholder="workspace_admin"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="db-password">Password</Label>
                            <Input
                              id="db-password"
                              type="password"
                              value={connectionForm.password}
                              onChange={(e) => updateConnectionForm('password', e.target.value)}
                              placeholder="••••••••"
                            />
                          </div>

                          <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                              <Label htmlFor="db-ssl" className="text-sm font-medium">Require SSL</Label>
                              <p className="text-xs text-muted-foreground">Enable if your database requires SSL/TLS connections.</p>
                            </div>
                            <Switch
                              id="db-ssl"
                              checked={connectionForm.ssl}
                              onCheckedChange={(checked) => updateConnectionForm('ssl', checked)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="connection-string-preview">Connection String Preview</Label>
                            <Input
                              id="connection-string-preview"
                              type="text"
                              value={connectionString}
                              readOnly
                              placeholder="Complete all fields to generate connection string"
                              className="font-mono text-xs"
                            />
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Enter the connection details for your shared PostgreSQL database. Credentials are only used to configure the connection.
                          </p>
                        </div>

                        {connectionTestResult && (
                          <Alert variant={connectionTestResult.success ? 'success' : 'destructive'}>
                            <AlertDescription>{connectionTestResult.message}</AlertDescription>
                          </Alert>
                        )}

                        <div className="flex gap-3">
                          <Button 
                            variant="outline" 
                            onClick={handleTestConnection}
                            disabled={isTestingConnection || !isConnectionFormValid}
                            className="flex items-center gap-2"
                          >
                            {isTestingConnection ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Link2 className="size-4" />
                            )}
                            Test Connection
                          </Button>
                          <Button 
                            onClick={handleConfigureTeam}
                            disabled={isConfiguringTeam || !isConnectionFormValid || !connectionTestResult?.success}
                            className="flex items-center gap-2"
                          >
                            {isConfiguringTeam ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Server className="size-4" />
                            )}
                            Enable Shared Mode
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-4 border-t">
                        <Alert variant="success">
                          <Server className="size-4" />
                          <AlertDescription>
                            <p className="font-medium mb-1">Shared Mode Active</p>
                            <p>You are connected to a shared PostgreSQL database. Team features including 
                               scripts management, Control-M jobs, and audit logging are enabled.</p>
                          </AlertDescription>
                        </Alert>

                        {teamActionMessage && (
                          <Alert variant={teamActionMessage.success ? 'success' : 'destructive'}>
                            <AlertDescription>{teamActionMessage.message}</AlertDescription>
                          </Alert>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">Shared Database:</span>
                            {installationStatus?.sharedDbConnected ? (
                              <Badge variant="success">Connected</Badge>
                            ) : (
                              <Badge variant="destructive">Disconnected</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">Migrations:</span>
                            {installationStatus?.migrationsRun ? (
                              installationStatus.pendingMigrations.length > 0 ? (
                                <Badge variant="secondary">{installationStatus.pendingMigrations.length} pending</Badge>
                              ) : (
                                <Badge variant="success">Up to date</Badge>
                              )
                            ) : (
                              <Badge variant="secondary">Not run</Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {!installationStatus?.sharedDbConnected && (
                            <Button 
                              variant="outline"
                              onClick={handleReconnect}
                              disabled={isReconnecting}
                              className="flex items-center gap-2"
                            >
                              {isReconnecting ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <RefreshCw className="size-4" />
                              )}
                              Reconnect
                            </Button>
                          )}
                          
                          {installationStatus?.sharedDbConnected && (!installationStatus?.migrationsRun || installationStatus?.pendingMigrations?.length > 0) && (
                            <Button 
                              variant="outline"
                              onClick={handleRunMigrations}
                              disabled={isRunningMigrations}
                              className="flex items-center gap-2"
                            >
                              {isRunningMigrations ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Play className="size-4" />
                              )}
                              Run Migrations
                            </Button>
                          )}

                          {installationStatus?.sharedDbConnected && (
                            <>
                              <Button 
                                variant="outline"
                                onClick={handleValidateSchema}
                                disabled={isValidating}
                                className="flex items-center gap-2"
                              >
                                {isValidating ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-4" />
                                )}
                                Validate Schema
                              </Button>

                              <Button 
                                variant="destructive"
                                onClick={handleResetAndMigrate}
                                disabled={isResettingDb}
                                className="flex items-center gap-2"
                              >
                                {isResettingDb ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <AlertTriangle className="size-4" />
                                )}
                                Reset & Re-migrate
                              </Button>
                            </>
                          )}

                          <Button 
                            variant="destructive"
                            onClick={handleDisableSharedMode}
                            disabled={isDisablingTeam}
                            className="flex items-center gap-2"
                          >
                            {isDisablingTeam ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Unlink className="size-4" />
                            )}
                            Disable Shared Mode
                          </Button>
                        </div>

                        {validationResult && (
                          <div className="space-y-3 pt-4 border-t">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium">Schema Validation Results</h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowValidationDetails(!showValidationDetails)}
                              >
                                {showValidationDetails ? 'Hide Details' : 'Show Details'}
                              </Button>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-sm">
                              <div className="p-2 border rounded-md">
                                <div className="text-xs text-muted-foreground">Total Tables</div>
                                <div className="text-lg font-semibold">{validationResult.summary.total}</div>
                              </div>
                              <div className="p-2 border rounded-md bg-success-muted">
                                <div className="text-xs text-success">Valid</div>
                                <div className="text-lg font-semibold text-success">{validationResult.summary.valid}</div>
                              </div>
                              <div className="p-2 border rounded-md bg-warning-muted">
                                <div className="text-xs text-warning-foreground">Invalid</div>
                                <div className="text-lg font-semibold text-warning-foreground">{validationResult.summary.invalid}</div>
                              </div>
                              <div className="p-2 border rounded-md bg-destructive/10">
                                <div className="text-xs text-destructive">Missing</div>
                                <div className="text-lg font-semibold text-destructive">{validationResult.summary.missing}</div>
                              </div>
                            </div>

                            {showValidationDetails && (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {Object.entries(validationResult.tables).map(([tableName, result]) => (
                                  <div
                                    key={tableName}
                                    className={`p-3 border rounded-md ${
                                      !result.exists
                                        ? 'bg-destructive/10 border-destructive/30'
                                        : result.valid
                                        ? 'bg-success-muted border-success/30'
                                        : 'bg-warning-muted border-warning/30'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      {!result.exists ? (
                                        <XCircle className="size-4 text-destructive" />
                                      ) : result.valid ? (
                                        <CheckCircle2 className="size-4 text-success" />
                                      ) : (
                                        <AlertCircle className="size-4 text-warning" />
                                      )}
                                      <span className="font-mono text-sm font-medium">{tableName}</span>
                                      <Badge variant={!result.exists ? 'destructive' : result.valid ? 'success' : 'warning'} className="ml-auto">
                                        {!result.exists ? 'Missing' : result.valid ? 'Valid' : 'Invalid'}
                                      </Badge>
                                    </div>
                                    
                                    {result.errors.length > 0 && (
                                      <div className="mt-2 text-xs">
                                        {result.errors.map((error, idx) => (
                                          <div key={idx} className="text-destructive">{error}</div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {result.missingColumns && result.missingColumns.length > 0 && (
                                      <div className="mt-2 text-xs">
                                        <span className="font-medium">Missing columns:</span> {result.missingColumns.join(', ')}
                                      </div>
                                    )}
                                    
                                    {result.extraColumns && result.extraColumns.length > 0 && (
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        <span className="font-medium">Extra columns:</span> {result.extraColumns.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Alert variant="info">
              <AlertCircle className="size-4" />
              <AlertDescription>
                <h3 className="font-medium mb-2">About Team Features</h3>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li><strong>Solo Mode:</strong> All data stored locally in SQLite, single user, no network required</li>
                  <li><strong>Shared Mode:</strong> Team data stored in PostgreSQL, multi-user with RBAC</li>
                  <li>Scripts can be migrated from local to shared when switching modes</li>
                  <li>Audit logs track all changes in shared mode for compliance</li>
                  <li>User roles determine access to different features and resources</li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
};
