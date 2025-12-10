import { AlertCircle, CheckCircle, Database, Loader2, Server, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import type { InstallationStatus } from '@workspace/shared';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

type Step = 'check' | 'connection' | 'admin' | 'complete';

export const InstallationPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('check');
  const [_status, setStatus] = useState<InstallationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connection form state
  const [connectionForm, setConnectionForm] = useState({
    host: 'localhost',
    port: '5432',
    database: 'workspace_organizer',
    username: 'postgres',
    password: ''
  });
  const [connectionTested, setConnectionTested] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  // Admin user form state
  const [adminForm, setAdminForm] = useState({
    username: 'admin',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: 'Administrator'
  });

  // Check installation status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/v1/installation/status`);
      const data = await response.json();
      setStatus(data);

      // Determine which step to show
      if (data.isConfigured && data.sharedDbConnected && data.adminUserCreated) {
        setCurrentStep('complete');
      } else if (data.isConfigured && data.sharedDbConnected) {
        setCurrentStep('admin');
      } else if (data.isConfigured) {
        setConnectionSuccess(true);
        setConnectionTested(true);
        setCurrentStep('connection');
      } else {
        setCurrentStep('connection');
      }
    } catch (_err) {
      setError('Failed to check installation status');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setConnectionTested(false);
    try {
      const response = await fetch(`${API_URL}/v1/installation/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: connectionForm.host,
          port: parseInt(connectionForm.port, 10),
          database: connectionForm.database,
          user: connectionForm.username,
          password: connectionForm.password
        })
      });
      
      const result: TestConnectionResult = await response.json();
      setConnectionTested(true);
      setConnectionSuccess(result.success);
      
      if (!result.success) {
        setError(result.error || result.message || 'Connection failed');
      }
    } catch (_err) {
      setConnectionTested(true);
      setConnectionSuccess(false);
      setError('Failed to test connection');
    } finally {
      setLoading(false);
    }
  };

  const configureDatabase = async () => {
    setLoading(true);
    setError(null);
    
    // Validate admin form before sending
    if (!adminForm.username || !adminForm.email || !adminForm.password) {
      setError('Please fill in all admin user fields first');
      setLoading(false);
      return;
    }

    if (adminForm.password !== adminForm.confirmPassword) {
      setError('Admin passwords do not match');
      setLoading(false);
      return;
    }

    if (adminForm.password.length < 8) {
      setError('Admin password must be at least 8 characters');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminForm.email)) {
      setError('Invalid email format');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/v1/installation/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: {
            host: connectionForm.host,
            port: parseInt(connectionForm.port, 10),
            database: connectionForm.database,
            user: connectionForm.username,
            password: connectionForm.password
          },
          adminUser: {
            username: adminForm.username,
            email: adminForm.email,
            password: adminForm.password,
            displayName: adminForm.displayName
          }
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Configuration failed');
      }

      setCurrentStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration failed');
    } finally {
      setLoading(false);
    }
  };

  const createAdminUser = async () => {
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (adminForm.password !== adminForm.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (adminForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminForm.email)) {
      setError('Invalid email format');
      setLoading(false);
      return;
    }

    // All admin form data collected - now call configureDatabase with the data
    await configureDatabase();
  };

  const goToDashboard = () => {
    // Navigate to login page - user will be redirected to dashboard after login
    navigate('/login');
  };

  // Render loading state
  if (loading && currentStep === 'check') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking installation status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Workspace Organizer Setup</CardTitle>
          <CardDescription>
            {currentStep === 'connection' && 'Configure your shared PostgreSQL database connection'}
            {currentStep === 'admin' && 'Create your initial administrator account (one-time setup)'}
            {currentStep === 'complete' && 'Setup complete!'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Steps */}
          <div className="flex justify-center gap-2">
            <StepIndicator number={1} label="Database" active={currentStep === 'connection'} complete={currentStep === 'admin' || currentStep === 'complete'} />
            <div className="flex items-center">
              <div className="h-px w-8 bg-border" />
            </div>
            <StepIndicator number={2} label="Admin" active={currentStep === 'admin'} complete={currentStep === 'complete'} />
            <div className="flex items-center">
              <div className="h-px w-8 bg-border" />
            </div>
            <StepIndicator number={3} label="Complete" active={currentStep === 'complete'} complete={false} />
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Connection Step */}
          {currentStep === 'connection' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={connectionForm.host}
                    onChange={(e) => setConnectionForm({ ...connectionForm, host: e.target.value })}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    value={connectionForm.port}
                    onChange={(e) => setConnectionForm({ ...connectionForm, port: e.target.value })}
                    placeholder="5432"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="database">Database Name</Label>
                <Input
                  id="database"
                  value={connectionForm.database}
                  onChange={(e) => setConnectionForm({ ...connectionForm, database: e.target.value })}
                  placeholder="workspace_organizer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={connectionForm.username}
                  onChange={(e) => setConnectionForm({ ...connectionForm, username: e.target.value })}
                  placeholder="postgres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={connectionForm.password}
                  onChange={(e) => setConnectionForm({ ...connectionForm, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              {connectionTested && (
                <Alert variant={connectionSuccess ? 'default' : 'destructive'}>
                  {connectionSuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertTitle>Connection Successful</AlertTitle>
                      <AlertDescription>Successfully connected to the PostgreSQL database.</AlertDescription>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Connection Failed</AlertTitle>
                      <AlertDescription>Please check your connection settings and try again.</AlertDescription>
                    </>
                  )}
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={testConnection} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
                  Test Connection
                </Button>
                <Button onClick={() => setCurrentStep('admin')} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Next: Create Admin User
                </Button>
              </div>
            </div>
          )}

          {/* Admin User Step */}
          {currentStep === 'admin' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                This account will be created with administrator privileges during the initial setup. 
                Additional users can be created later by administrators with restricted roles.
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="adminUsername">Username</Label>
                <Input
                  id="adminUsername"
                  value={adminForm.username}
                  onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                  placeholder="admin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail">Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={adminForm.displayName}
                  onChange={(e) => setAdminForm({ ...adminForm, displayName: e.target.value })}
                  placeholder="Administrator"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPassword">Password</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={adminForm.confirmPassword}
                  onChange={(e) => setAdminForm({ ...adminForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={createAdminUser} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                  Create Admin User
                </Button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Setup Complete!</h3>
                <p className="text-muted-foreground">
                  Your Workspace Organizer is now configured and ready to use.
                </p>
              </div>
              <Button onClick={goToDashboard} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Step indicator component
const StepIndicator = ({ number, label, active, complete }: { number: number; label: string; active: boolean; complete: boolean }) => (
  <div className="flex flex-col items-center gap-1">
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
        complete
          ? 'bg-primary text-primary-foreground'
          : active
          ? 'border-2 border-primary text-primary'
          : 'border-2 border-muted text-muted-foreground'
      }`}
    >
      {complete ? <CheckCircle className="h-4 w-4" /> : number}
    </div>
    <span className={`text-xs ${active || complete ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
  </div>
);
