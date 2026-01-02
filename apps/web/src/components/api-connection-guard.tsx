import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useApiHealth } from '@/hooks/use-api-health';

interface ApiConnectionGuardProps {
  children: ReactNode;
}

const MAX_RETRIES = 10;

export function ApiConnectionGuard({ children }: ApiConnectionGuardProps) {
  const { isConnected, isChecking, error, retryCount, retryConnection } = useApiHealth();

  // Connected - render children
  if (isConnected) {
    return <>{children}</>;
  }

  // Checking connection
  if (isChecking) {
    const progress = (retryCount / MAX_RETRIES) * 100;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <CardTitle>Starting Up</CardTitle>
            <CardDescription>
              Please wait while the application initializes...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              This may take a few seconds
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connection failed - show user-friendly error
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Unable to Start</CardTitle>
          <CardDescription>
            The application couldn't start properly. This is usually a temporary issue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Please try restarting the application. If the problem continues, try restarting your computer.
          </p>
          
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} variant="default" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Restart Application
            </Button>
            <Button onClick={retryConnection} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
          
          {/* Only show if there's a specific error for support purposes */}
          {error && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              If you need support, please mention: Connection timeout
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
