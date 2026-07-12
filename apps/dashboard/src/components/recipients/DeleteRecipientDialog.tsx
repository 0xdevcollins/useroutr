"use client";

import { useTransition } from 'react';
import {
  Button,
  ShadDialog as Dialog, ShadDialogContent as DialogContent, ShadDialogDescription as DialogDescription,
  ShadDialogFooter as DialogFooter, ShadDialogHeader as DialogHeader, ShadDialogTitle as DialogTitle,
  useToast,
} from '@useroutr/ui';
import { Recipient } from '@useroutr/types';
import { api } from '@/lib/api';

interface DeleteRecipientDialogProps {
  recipient: Recipient;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteRecipientDialog({ recipient, open = true, onOpenChange }: DeleteRecipientDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await api.delete(`/recipients/${recipient.id}`);
        toast({ title: "Recipient deleted", message: `${recipient.name} was removed.` }, "success");
        onOpenChange?.(false);
        window.dispatchEvent(new CustomEvent('recipients:refetch'));
      } catch (err) {
        toast({
          title: "Error",
          message: err instanceof Error ? err.message : "Failed to delete recipient",
        }, "error");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete recipient?</DialogTitle>
          <DialogDescription>
            {recipient.name} will be permanently removed. Recipients used in
            existing payouts cannot be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
