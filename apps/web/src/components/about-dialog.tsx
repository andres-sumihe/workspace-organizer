import { Info, Github, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const version = '0.1.0';
  const electronVersion = 'Electron 33.2.0';
  const nodeVersion = (window.navigator as any).userAgentData?.brands?.find((b: any) => b.brand === 'Node.js')?.version || 'Unknown';
  const chromeVersion = (window.navigator as any).userAgentData?.brands?.find((b: any) => b.brand === 'Chromium')?.version || 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About Workspace Organizer
          </DialogTitle>
          <DialogDescription>
            Desktop application for workspace and file management
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Version Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Version Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Application:</div>
              <div className="font-mono">{version}</div>
              <div className="text-muted-foreground">Electron:</div>
              <div className="font-mono">{electronVersion}</div>
              <div className="text-muted-foreground">Node.js:</div>
              <div className="font-mono">v{nodeVersion}</div>
              <div className="text-muted-foreground">Chromium:</div>
              <div className="font-mono">{chromeVersion}</div>
            </div>
          </div>

          <Separator />

          {/* Author Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Author</h4>
            <div className="text-sm text-muted-foreground">
              <p>Andres Sumihe</p>
            </div>
          </div>

          <Separator />

          {/* Links */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Resources</h4>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => {
                  if (window.api?.openPath) {
                    window.api.openPath('https://github.com/andres-sumihe/workspace-organizer');
                  }
                }}
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub Repository
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => {
                  if (window.api?.openPath) {
                    window.api.openPath('mailto:support@workspaceorganizer.dev');
                  }
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </div>
          </div>

          <Separator />

          {/* License */}
          <div className="text-xs text-muted-foreground text-center">
            Licensed under MIT License
            <br />
            © 2026 Andres Sumihe. All rights reserved.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
