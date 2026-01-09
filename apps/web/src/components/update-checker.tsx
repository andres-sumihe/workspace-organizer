import { Download, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

interface UpdateCheckerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerCheck?: boolean;
}

type UpdateState = 
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'downloading'; progress: number }
  | { status: 'ready'; info: UpdateInfo }
  | { status: 'up-to-date' }
  | { status: 'error'; message: string };

export function UpdateChecker({ open, onOpenChange, triggerCheck }: UpdateCheckerProps) {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });

  const checkForUpdates = async () => {
    setState({ status: 'checking' });
    
    try {
      // In development or when autoUpdater is not available, simulate check
      if (!window.api) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setState({ status: 'up-to-date' });
        return;
      }

      // Wait for update events from Electron
      // The actual check is triggered in the Electron main process
      const timeout = setTimeout(() => {
        setState({ status: 'up-to-date' });
      }, 5000);

      return () => clearTimeout(timeout);
    } catch (error) {
      setState({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to check for updates' 
      });
    }
  };

  const installUpdate = () => {
    if (window.api?.restartAndInstall) {
      window.api.restartAndInstall();
    }
  };

  // Listen for update events from Electron
  useEffect(() => {
    if (!window.api) return;

    const unsubAvailable = window.api.onUpdateAvailable?.((info: unknown) => {
      setState({ status: 'available', info: info as UpdateInfo });
    });

    const unsubDownloaded = window.api.onUpdateDownloaded?.((info: unknown) => {
      setState({ status: 'ready', info: info as UpdateInfo });
    });

    return () => {
      unsubAvailable?.();
      unsubDownloaded?.();
    };
  }, []);

  // Auto-check when dialog opens or triggerCheck changes
  useEffect(() => {
    if (open || triggerCheck) {
      checkForUpdates();
    }
  }, [open, triggerCheck]);

  const renderContent = () => {
    switch (state.status) {
      case 'checking':
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking for updates...</p>
          </div>
        );

      case 'up-to-date':
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="font-medium">You're up to date!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Version 0.1.0 is the latest version
              </p>
            </div>
          </div>
        );

      case 'available':
        return (
          <div className="space-y-4 py-4">
            <Alert>
              <Download className="h-4 w-4" />
              <AlertDescription>
                A new version <strong>{state.info.version}</strong> is available for download.
              </AlertDescription>
            </Alert>
            {state.info.releaseNotes && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Release Notes</h4>
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md max-h-50 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans">{state.info.releaseNotes}</pre>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              The update will download in the background. You'll be notified when it's ready to install.
            </p>
          </div>
        );

      case 'downloading':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm font-medium">Downloading update...</p>
            </div>
            <Progress value={state.progress} />
            <p className="text-xs text-muted-foreground text-center">
              {state.progress}% complete
            </p>
          </div>
        );

      case 'ready':
        return (
          <div className="space-y-4 py-4">
            <Alert className="border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription>
                Version <strong>{state.info.version}</strong> has been downloaded and is ready to install.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              The application will restart to complete the installation.
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={checkForUpdates} className="w-full">
              Try Again
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (state.status === 'ready') {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Later
          </Button>
          <Button onClick={installUpdate}>
            <Download className="mr-2 h-4 w-4" />
            Install and Restart
          </Button>
        </DialogFooter>
      );
    }

    if (state.status === 'up-to-date' || state.status === 'error') {
      return (
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Software Updates
          </DialogTitle>
          <DialogDescription>
            Check for the latest version of Workspace Organizer
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
