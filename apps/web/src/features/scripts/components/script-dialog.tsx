import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

interface ScriptDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  scriptId?: string;
}

export const ScriptDialog = ({ open, onClose, mode }: ScriptDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Script' : 'Edit Script'}</DialogTitle>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Script creation/editing form will be implemented here with React Hook Form + Zod validation.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
