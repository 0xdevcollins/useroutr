"use client";

import { Button } from '@useroutr/ui';

interface EditRecipientDialogProps {
  id: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditRecipientDialog({ id, ...props }: EditRecipientDialogProps) {
  return (
    <div>Edit dialog for {id} (TODO: implement form)</div>
  );
}

