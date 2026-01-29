import { Database, Loader2, Save, Settings as SettingsIcon, Server, Link2, Unlink, RefreshCw, CheckCircle2, XCircle, AlertCircle, AlertTriangle, Wrench, Copy, ChevronDown, ChevronRight, Shield, FileKey, Trash2, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent } from '@radix-ui/react-collapsible';

import { schemaValidationApi, type ValidationResponse, type ExportScriptsResponse } from '@/api/schema-validation';
import { settingsApi } from '@/api/settings';
import { toolsApi } from '@/api/tools';
import { AppPage, AppPageContent, AppPageTabs } from '@/components/layout/app-page';
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

// Helper to keep previous value during exit animations
function useLastDefined<T>(value: T | null | undefined): T | null | undefined {
  const ref = useRef(value);
  useEffect(() => {
    if (value !== null && value !== undefined) {
      ref.current = value;
    }
  }, [value]);
  // Return current value if defined, otherwise last known defined value
  return (value !== null && value !== undefined) ? value : ref.current;
}

// Wrapper for smooth alert animations
const SmoothAlert = ({ 
  open, 
  variant = 'default', 
  children,
  className = '' 
}: { 
  open: boolean; 
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'; 
  children: React.ReactNode; 
  className?: string;
}) => {
  return (
    <Collapsible open={open}>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className={`py-1 ${className}`}>
          <Alert variant={variant}>
            {children}
          </Alert>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SettingsPage = () => {
  const { status: installationStatus, isLoading: installLoading, checkStatus } = useInstallation();
  const { isSoloMode, isSharedMode, refreshAuth, sessionConfig, refreshSessionConfig, isLoading: authLoading } = useAuth();
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
  const [teamActionMessage, setTeamActionMessage] = useState<{ success: boolean; message: string } | null>(null);

  // Schema validation state
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [showMigrationInfo, setShowMigrationInfo] = useState(false);
  const [migrationData, setMigrationData] = useState<ExportScriptsResponse | null>(null);
  const [isLoadingMigrationInfo, setIsLoadingMigrationInfo] = useState(false);
  const [expandedMigration, setExpandedMigration] = useState<string | null>(null);

  // Tools settings state
  const [baseSalary, setBaseSalary] = useState<string>('');
  const [baseSalaryFormatted, setBaseSalaryFormatted] = useState<string>('');
  const [isLoadingToolsSettings, setIsLoadingToolsSettings] = useState(true);
  const [isSavingToolsSettings, setIsSavingToolsSettings] = useState(false);

  // Security settings state
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  const navigate = useNavigate();

  const lastSaveMessage = useLastDefined(saveMessage);
  const lastErrorMessage = useLastDefined(errorMessage);
  const lastConnectionResult = useLastDefined(connectionTestResult);
  const lastTeamMessage = useLastDefined(teamActionMessage);

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

  // Load tools general settings
  useEffect(() => {
    const loadToolsSettings = async () => {
      try {
        const settings = await toolsApi.getGeneralSettings();
        setBaseSalary(settings.baseSalary ? String(settings.baseSalary) : '');
        setBaseSalaryFormatted(settings.baseSalary ? formatNumberWithSeparator(String(settings.baseSalary)) : '');
      } catch {
        // Silent fail - not critical
      } finally {
        setIsLoadingToolsSettings(false);
      }
    };
    loadToolsSettings();
  }, []);

  const formatNumberWithSeparator = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    return new Intl.NumberFormat('id-ID').format(parseInt(numericValue, 10));
  };

  const parseFormattedNumber = (value: string): number => {
    const cleaned = value.replace(/\./g, '').replace(/,/g, '');
    return parseInt(cleaned, 10) || 0;
  };

  const handleSaveToolsSettings = async () => {
    setIsSavingToolsSettings(true);
    setErrorMessage(null);

    try {
      const salary = baseSalary.trim() === '' ? null : parseFormattedNumber(baseSalary);
      
      if (salary !== null && (isNaN(salary) || salary <= 0)) {
        setErrorMessage('Base salary must be a positive number or empty');
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      await toolsApi.updateGeneralSettings({ baseSalary: salary });
      setSaveMessage('Tools settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save tools settings');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSavingToolsSettings(false);
    }
  };

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

  const handleGenerateRecoveryKey = async () => {
    setIsGeneratingKey(true);
    setErrorMessage(null);
    setRecoveryKey(null);
    
    try {
      // In a real app we might ask for password confirmation here too
      const response = await fetch(`${API_URL}/api/v1/auth/generate-recovery-key`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setRecoveryKey(data.recoveryKey);
        setSaveMessage('New recovery key generated successfully!');
      } else {
        setErrorMessage(data.message || 'Failed to generate key');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate key');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (recoveryKey) {
      await navigator.clipboard.writeText(recoveryKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleToggleSessionLock = async (checked: boolean) => {
    setIsUpdatingSession(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/session-config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
        },
        body: JSON.stringify({ enableSessionLock: checked })
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        await refreshSessionConfig();
        setSaveMessage('Session settings updated successfully');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setErrorMessage(data.message || 'Failed to update session settings');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update session settings');
    } finally {
      setIsUpdatingSession(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setErrorMessage('All password fields are required');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSaveMessage('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setErrorMessage(data.message || 'Failed to change password');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setErrorMessage('Please enter your password to confirm deletion');
      return;
    }

    if (!confirm('Are you absolutely sure? This will permanently delete your account and all local data. This action cannot be undone.')) {
      return;
    }

    setIsDeletingAccount(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/delete-account`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
        },
        body: JSON.stringify({ password: deletePassword })
      });

      if (response.ok) {
        // Clear local tokens
        localStorage.removeItem('auth_access_token');
        localStorage.removeItem('auth_refresh_token');
        // Redirect to setup
        navigate('/setup');
      } else {
        const data = await response.json();
        setErrorMessage(data.message || 'Failed to delete account');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
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

  const handleViewMigrationInfo = async () => {
    setIsLoadingMigrationInfo(true);
    setShowMigrationInfo(true);
    setTeamActionMessage(null);

    try {
      const data = await schemaValidationApi.exportScripts();
      if (data.success) {
        setMigrationData(data);
      }
    } catch (err) {
      setTeamActionMessage({ success: false, message: err instanceof Error ? err.message : 'Failed to load migration info' });
      setTimeout(() => setTeamActionMessage(null), 5000);
    } finally {
      setIsLoadingMigrationInfo(false);
    }
  };

  const handleCopySQL = async (sql: string, migrationId?: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      setTeamActionMessage({ success: true, message: migrationId ? `Copied ${migrationId} SQL to clipboard` : 'Copied SQL to clipboard' });
      setTimeout(() => setTeamActionMessage(null), 3000);
    } catch {
      setTeamActionMessage({ success: false, message: 'Failed to copy to clipboard' });
      setTimeout(() => setTeamActionMessage(null), 3000);
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



  if (contextLoading) {
    return (
      <AppPage
        title="Settings"
        description="Configure application settings and validation criteria"
      >
        <AppPageContent className="flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading settings...</span>
        </AppPageContent>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="Settings"
      description="Configure application settings and validation criteria"
      actions={
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Application Configuration</span>
          <Badge variant={isSoloMode ? 'secondary' : 'default'} className="ml-2">
            {isSoloMode ? 'Solo Mode' : 'Shared Mode'}
          </Badge>
        </div>
      }
    >
      <Tabs defaultValue="general" className="flex-1 flex flex-col">
        <AppPageTabs
          tabs={
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="team">Team Features</TabsTrigger>
            </TabsList>
          }
        >
          {/* General Settings Tab */}
          <TabsContent value="general" className="outline-none p-6">
            <div className="max-w-3xl space-y-6 animate-in fade-in-0 duration-300">

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
            </div>
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="security" className="outline-none p-6">
            <div className="max-w-3xl space-y-6 animate-in fade-in-0 duration-300">
              
              <SmoothAlert open={!!saveMessage} variant="success">
                <AlertDescription>{lastSaveMessage}</AlertDescription>
              </SmoothAlert>

              <SmoothAlert open={!!errorMessage} variant="destructive">
                <AlertDescription>{lastErrorMessage}</AlertDescription>
              </SmoothAlert>

              {/* Session Security Section */}
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Lock className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-1">Session Security</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure how the application handles your session inactivity.
                    </p>

                    <div className="flex items-center gap-3">
                      <Switch
                        id="session-lock"
                        checked={sessionConfig?.enableSessionLock !== false}
                        onCheckedChange={handleToggleSessionLock}
                        disabled={isUpdatingSession || authLoading || !sessionConfig}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="session-lock" className="font-medium cursor-pointer">
                          Enable Auto-Lock
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          When enabled, the application will lock automatically after 30 minutes of inactivity.
                          You will need to enter your password to resume. When disabled, your session stays 
                          active indefinitely after login (until you manually log out).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Recovery Key Section */}
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <KeyRound className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-1">Recovery Key</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your recovery key allows you to reset your password if you forget it.
                      Generating a new key will invalidate any previous keys.
                    </p>

                    {!recoveryKey ? (
                      <Button
                        onClick={handleGenerateRecoveryKey}
                        disabled={isGeneratingKey}
                        variant="outline"
                        className="flex items-center gap-2 transition-all duration-300"
                      >
                        {isGeneratingKey ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileKey className="size-4" />
                        )}
                        Generate New Recovery Key
                      </Button>
                    ) : (
                      <div className="space-y-4 animate-in fade-in-0 duration-300">
                        <Alert variant="warning">
                          <AlertTriangle className="size-4" />
                          <AlertDescription>
                            <strong>Save this key immediately!</strong> It will not be shown again.
                            Store it in a safe place like a password manager.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                            {recoveryKey}
                          </code>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={handleCopyKey}
                            title="Copy to clipboard"
                          >
                            {copiedKey ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          onClick={() => setRecoveryKey(null)}
                          className="text-sm text-muted-foreground"
                        >
                          Close (I have saved my key)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Change Password Section */}
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Lock className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-1">Change Password</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Update your account password.
                    </p>

                    <div className="space-y-4 max-w-md">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                        <div className="relative">
                          <Input
                            id="confirm-new-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="flex items-center gap-2"
                      >
                        {isChangingPassword ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        Update Password
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Account Deletion Section */}
              <Card className="p-6 border-destructive/20">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-destructive/10 p-3">
                    <Shield className="size-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-1 text-destructive">Danger Zone</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Permanently delete your account and all local data. This action is irreversible.
                    </p>

                    <div className="space-y-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                      <div className="space-y-2">
                        <Label htmlFor="delete-password">Confirm Password</Label>
                        <div className="relative">
                          <Input
                            id="delete-password"
                            type={showDeletePassword ? 'text' : 'password'}
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder="Enter your password to confirm"
                            className="max-w-md bg-background pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowDeletePassword(!showDeletePassword)}
                          >
                            {showDeletePassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount || !deletePassword}
                        className="flex items-center gap-2"
                      >
                        {isDeletingAccount ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        Delete Account Permanently
                      </Button>
                      
                      <p className="text-xs text-muted-foreground">
                        Note: This will delete your local user record, personal settings, and clear your session.
                        It will not affect shared database records if you are in team mode.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Tools Settings Tab */}
          <TabsContent value="tools" className="outline-none p-6">
            <div className="max-w-3xl space-y-6 animate-in fade-in-0 duration-300">
              
              <SmoothAlert open={!!saveMessage} variant="success">
                <AlertDescription>{lastSaveMessage}</AlertDescription>
              </SmoothAlert>

              <SmoothAlert open={!!errorMessage} variant="destructive">
                <AlertDescription>{lastErrorMessage}</AlertDescription>
              </SmoothAlert>

              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Wrench className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-1">Tools — General Settings</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure settings used by the Tools features such as the Overtime Calculator.
                    </p>

                    {isLoadingToolsSettings ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading settings...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="baseSalary">Base Salary (Monthly)</Label>
                          <Input
                            id="baseSalary"
                            type="text"
                            inputMode="numeric"
                            value={baseSalaryFormatted}
                            onChange={(e) => {
                              const formatted = formatNumberWithSeparator(e.target.value);
                              const rawValue = parseFormattedNumber(e.target.value);
                              setBaseSalary(String(rawValue));
                              setBaseSalaryFormatted(formatted);
                            }}
                            placeholder="e.g., 10.000.000"
                            className="max-w-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            Monthly salary used for overtime calculations. The hourly rate is calculated as salary ÷ 173.
                          </p>
                        </div>

                        <Button
                          onClick={handleSaveToolsSettings}
                          disabled={isSavingToolsSettings}
                          className="flex items-center gap-2"
                        >
                          {isSavingToolsSettings ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Save className="size-4" />
                          )}
                          Save Settings
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Alert variant="info">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <h3 className="font-medium mb-2">About Tools Settings</h3>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Base Salary is used as the default value in the Overtime Calculator</li>
                    <li>You can override this value for individual overtime entries</li>
                    <li>Leave empty if you want to enter the salary manually each time</li>
                    <li>Tools data (like overtime entries) is stored locally and remains private</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          {/* Validation Settings Tab */}
          <TabsContent value="validation" className="outline-none p-6">
            <div className="max-w-3xl space-y-6 animate-in fade-in-0 duration-300">
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
            </div>
          </TabsContent>

          {/* Team Features Tab */}
          <TabsContent value="team" className="outline-none p-6">
            <div className="max-w-3xl space-y-6 animate-in fade-in-0 duration-300">
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

                        <SmoothAlert open={!!connectionTestResult} variant={connectionTestResult?.success ? 'success' : 'destructive'}>
                          <AlertDescription>{lastConnectionResult?.message}</AlertDescription>
                        </SmoothAlert>

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

                        <SmoothAlert open={!!teamActionMessage} variant={teamActionMessage?.success ? 'success' : 'destructive'}>
                          <AlertDescription>{lastTeamMessage?.message}</AlertDescription>
                        </SmoothAlert>

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
                                variant="outline"
                                onClick={handleViewMigrationInfo}
                                disabled={isLoadingMigrationInfo}
                                className="flex items-center gap-2"
                              >
                                {isLoadingMigrationInfo ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Database className="size-4" />
                                )}
                                Migration Status
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
                          <div className="space-y-3 pt-4 border-t animate-in fade-in-0 duration-300">
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
                              <div className="space-y-2 max-h-96 overflow-y-auto animate-in fade-in-0 duration-300">
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

                        {showMigrationInfo && (
                          <div className="space-y-3 pt-4 border-t animate-in fade-in-0 duration-300">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium">Database Migration Scripts</h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowMigrationInfo(false)}
                              >
                                Hide
                              </Button>
                            </div>

                            <Alert variant="info" className="text-sm">
                              <AlertCircle className="size-4" />
                              <AlertDescription>
                                <strong>DBA Required:</strong> Copy the SQL scripts below and execute them on your PostgreSQL database.
                                Each script must be run in order. Click on a migration to expand and copy its SQL.
                              </AlertDescription>
                            </Alert>

                            {isLoadingMigrationInfo ? (
                              <div className="flex items-center gap-2 py-4">
                                <Loader2 className="size-4 animate-spin" />
                                <span className="text-sm text-muted-foreground">Loading migration scripts...</span>
                              </div>
                            ) : migrationData ? (
                              <div className="space-y-3">
                                {/* Schema Setup */}
                                <div className="border rounded-md">
                                  <button
                                    type="button"
                                    className="w-full p-3 flex items-center justify-between hover:bg-muted/50"
                                    onClick={() => setExpandedMigration(expandedMigration === 'setup' ? null : 'setup')}
                                  >
                                    <div className="flex items-center gap-2">
                                      {expandedMigration === 'setup' ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                      <Database className="size-4 text-primary" />
                                      <span className="font-mono text-sm font-medium">Schema Setup</span>
                                    </div>
                                    <Badge variant="secondary">Run First</Badge>
                                  </button>
                                  {expandedMigration === 'setup' && (
                                    <div className="border-t p-3 space-y-2 animate-in fade-in-0 duration-300">
                                      <div className="flex justify-end">
                                        <Button size="sm" variant="outline" onClick={() => handleCopySQL(migrationData.schemaSetup, 'Schema Setup')}>
                                          <Copy className="size-3 mr-1" /> Copy SQL
                                        </Button>
                                      </div>
                                      <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap wrap-break-words max-h-48 overflow-y-auto w-full">
                                        {migrationData.schemaSetup}
                                      </pre>
                                    </div>
                                  )}
                                </div>

                                {/* Migration Scripts */}
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                  {migrationData.migrations.map((migration) => (
                                    <div
                                      key={migration.id}
                                      className={`border rounded-md ${
                                        migration.status === 'pending'
                                          ? 'border-warning/50'
                                          : 'border-success/50'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        className={`w-full p-3 flex items-center justify-between hover:bg-muted/50 ${
                                          migration.status === 'pending' ? 'bg-warning-muted/50' : 'bg-success-muted/50'
                                        }`}
                                        onClick={() => setExpandedMigration(expandedMigration === migration.id ? null : migration.id)}
                                      >
                                        <div className="flex items-center gap-2">
                                          {expandedMigration === migration.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                          {migration.status === 'pending' ? (
                                            <AlertCircle className="size-4 text-warning" />
                                          ) : (
                                            <CheckCircle2 className="size-4 text-success" />
                                          )}
                                          <span className="font-mono text-sm">{migration.id}</span>
                                          <span className="text-xs text-muted-foreground hidden sm:inline">- {migration.description}</span>
                                        </div>
                                        <Badge variant={migration.status === 'pending' ? 'warning' : 'success'}>
                                          {migration.status === 'pending' ? 'Pending' : 'Executed'}
                                        </Badge>
                                      </button>
                                      {expandedMigration === migration.id && (
                                        <div className="border-t p-3 space-y-2 animate-in fade-in-0 duration-300">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">{migration.description}</span>
                                            <Button size="sm" variant="outline" onClick={() => handleCopySQL(migration.sql, migration.id)}>
                                              <Copy className="size-3 mr-1" /> Copy SQL
                                            </Button>
                                          </div>
                                          <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap wrap-break-words max-h-64 overflow-y-auto w-full">
                                            {migration.sql}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Summary */}
                                <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                                  <span>{migrationData.pendingCount} pending of {migrationData.totalCount} total migrations</span>
                                  {!migrationData.dbConnected && (
                                    <Badge variant="warning">Database not connected</Badge>
                                  )}
                                </div>
                              </div>
                            ) : null}
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
            </div>
          </TabsContent>
        </AppPageTabs>
      </Tabs>
    </AppPage>
  );
};
