import { AlertTriangle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemCount: number;
  itemNames?: string[];
}

export const DeleteConfirmDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  itemCount,
  itemNames = []
}: DeleteConfirmDialogProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg overflow-hidden">
        <AlertDialogHeader className="min-w-0 overflow-hidden">
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
            Confirm deletion
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {itemCount} {itemCount === 1 ? 'item' : 'items'}?
          </AlertDialogDescription>
          {itemNames.length > 0 && (
            <div className="rounded border border-border bg-muted p-2 text-xs min-w-0 overflow-hidden">
              <p className="font-semibold mb-1">Items to delete:</p>
              <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                {itemNames.slice(0, 10).map((name, idx) => (
                  <li key={idx} className="overflow-hidden text-ellipsis whitespace-nowrap" title={name}>{name}</li>
                ))}
                {itemNames.length > 10 && (
                  <li className="text-muted-foreground">...and {itemNames.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
          <p className="text-sm text-destructive font-medium">
            This action cannot be undone.
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-destructive hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};