import { Database, Loader2, Save, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { settingsApi } from '@/api/settings';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useInstallation } from '@/contexts/installation-context';
import { useValidationSettings } from '@/contexts/validation-settings-context';
import { extractBICFromLT } from '@/utils/swift-mt-validator';

export const SettingsPage = () => {
  const { status: installationStatus, isLoading: installLoading } = useInstallation();
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
        </div>
      }
    >
      <div className="max-w-3xl space-y-6">
        {saveMessage && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            {saveMessage}
          </div>
        )}

        {(errorMessage || contextError) && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {errorMessage || contextError}
          </div>
        )}

        {/* Shared Database Status */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Database className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">Shared Database</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Connection status for the shared PostgreSQL database used for team collaboration features.
              </p>
              {installLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Checking connection...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Status:</span>
                    {installationStatus?.sharedDbConnected ? (
                      <Badge variant="default" className="bg-emerald-500">Connected</Badge>
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
                        <Badge variant="default" className="bg-emerald-500">Up to date</Badge>
                      )
                    ) : (
                      <Badge variant="secondary">Not run</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Admin User:</span>
                    {installationStatus?.adminUserCreated ? (
                      <Badge variant="default" className="bg-emerald-500">Created</Badge>
                    ) : (
                      <Badge variant="secondary">Not created</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

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

        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-medium mb-2 text-blue-900">How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>When you open an XML file in the File Manager, it will be automatically checked for ISO20022 format</li>
            <li>When you open any text file, it will be checked for SWIFT MT format if MT validation is enabled</li>
            <li>ISO20022 validation checks Sender/Receiver DN and Full Names in MX messages</li>
            <li>SWIFT MT validation checks Sender/Receiver BIC codes in FIN messages</li>
            <li>Validation results appear in the preview panel with detailed error messages</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
};
