import { Lock, AlertCircle } from 'lucide-react';
import { useState } from 'react';


import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';

/**
 * Lock Screen Component
 * 
 * Displayed when the session is locked due to inactivity.
 * User must re-enter their password to unlock.
 */
export function LockScreen() {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await unlock(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock. Please check your password.');
    } finally {
      setIsLoading(false);
      setPassword('');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-muted">
            <Lock className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-xl">Session Locked</CardTitle>
          <CardDescription>
            Your session has been locked due to inactivity.
            {user && (
              <span className="block mt-2 font-medium text-foreground">
                Welcome back, {user.displayName || user.username}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={isLoading || !password}>
                {isLoading ? 'Unlocking...' : 'Unlock'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleLogout}
                disabled={isLoading}
              >
                Sign out instead
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
