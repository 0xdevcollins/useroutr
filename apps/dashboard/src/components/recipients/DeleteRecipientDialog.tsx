"use client";

import { Button } from '@useroutr/ui';

interface DeleteRecipientDialogProps {
  id: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteRecipientDialog({ id, ...props }: DeleteRecipientDialogProps) {
  return (
    <div>Delete dialog for {id} (TODO: implement)</div>
  );
}

