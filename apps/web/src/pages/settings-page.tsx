import { Save, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';

import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useValidationSettings } from '@/contexts/validation-settings-context';

export const SettingsPage = () => {
  const { criteria, updateCriteria, isEnabled, setIsEnabled } = useValidationSettings();

  const [formData, setFormData] = useState(criteria);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = () => {
    updateCriteria(formData);
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleReset = () => {
    const defaults = {
      senderDN: 'ou=xxx,o=cenaidja,o=swift',
      senderFullName: 'CENAIDJAXXX',
      receiverDN: 'ou=xxx,o=cenaidja,o=swift',
      receiverFullName: 'CENAIDJAXXX'
    };
    setFormData(defaults);
    updateCriteria(defaults);
    setSaveMessage('Reset to default values');
    setTimeout(() => setSaveMessage(null), 3000);
  };

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
                  onCheckedChange={setIsEnabled}
                  id="validation-enabled"
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
              <Button onClick={handleSave} className="flex items-center gap-2">
                <Save className="size-4" />
                Save Settings
              </Button>
              <Button onClick={handleReset} variant="outline">
                Reset to Defaults
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-medium mb-2 text-blue-900">How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>When you open an XML file in the File Manager, it will be automatically checked</li>
            <li>If it's an ISO20022 message, validation runs against your configured criteria</li>
            <li>Validation results appear in the preview panel with detailed error messages</li>
            <li>Supported message types: pacs, camt, pain, acmt, admi, auth, and more</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
};
