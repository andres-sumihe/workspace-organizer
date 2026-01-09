import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function UpdateNotifier() {
  const [updateDownloaded, setUpdateDownloaded] = useState<unknown>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    if (!window.api) return;

    const cleanupAvailable = window.api.onUpdateAvailable((info) => {
      console.log('Update available:', info);
    });

    const cleanupDownloaded = window.api.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info);
      setUpdateDownloaded(info);
    });

    return () => {
      cleanupAvailable();
      cleanupDownloaded();
    };
  }, []);

  const handleRestart = async () => {
    if (!window.api) return;
    setIsRestarting(true);
    await window.api.restartAndInstall();
  };

  if (updateDownloaded) {
    return (
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Update Ready
            </AlertDialogTitle>
            <AlertDialogDescription>
              A new version of Workspace Organizer has been downloaded. Restart the application to apply the update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleRestart} disabled={isRestarting}>
              {isRestarting ? 'Restarting...' : 'Restart Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Optional: We could show a smaller toast/banner for "Downloading update..."
  // if (updateAvailable) { ... }

  return null;
}
