import { useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let showPending: ((pending: Pending) => void) | null = null;

export const confirmDialog = (options: ConfirmOptions) =>
  new Promise<boolean>((resolve) => {
    if (!showPending) {
      resolve(window.confirm(options.title));
      return;
    }
    showPending({ ...options, resolve });
  });

export const ConfirmDialogHost = () => {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    showPending = setPending;
    return () => {
      showPending = null;
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          {pending?.description ? <AlertDialogDescription>{pending.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{pending?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(pending?.destructive && buttonVariants({ variant: 'destructive' }))}
            onClick={() => close(true)}
          >
            {pending?.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
