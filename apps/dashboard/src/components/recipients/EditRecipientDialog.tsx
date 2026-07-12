"use client";

import { useState, useTransition } from 'react';
import {
  Button,
  ShadDialog as Dialog, ShadDialogContent as DialogContent, ShadDialogDescription as DialogDescription,
  ShadDialogFooter as DialogFooter, ShadDialogHeader as DialogHeader, ShadDialogTitle as DialogTitle,
  ShadInput as Input,
  ShadLabel as Label,
  ShadSelect as Select, ShadSelectContent as SelectContent, ShadSelectItem as SelectItem,
  ShadSelectTrigger as SelectTrigger, ShadSelectValue as SelectValue,
  useToast,
} from '@useroutr/ui';
import { DestType, Recipient } from '@useroutr/types';
import { api } from '@/lib/api';
import { RecipientDetailsFields, isRecipientDetailsComplete } from './RecipientDetailsFields';

interface EditRecipientDialogProps {
  recipient: Recipient;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditRecipientDialog({ recipient, open = true, onOpenChange }: EditRecipientDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(recipient.name);
  const [type, setType] = useState<DestType>(recipient.type);
  const [details, setDetails] = useState<Record<string, string | undefined>>({
    ...(recipient.details ?? {}),
    type: recipient.type,
  });

  const handleTypeChange = (value: DestType) => {
    setType(value);
    setDetails({ type: value });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        await api.patch(`/recipients/${recipient.id}`, { name, type, details });
        toast({ title: "Recipient updated", message: `${name} has been saved.` }, "success");
        onOpenChange?.(false);
        window.dispatchEvent(new CustomEvent('recipients:refetch'));
      } catch (err) {
        toast({
          title: "Error",
          message: err instanceof Error ? err.message : "Failed to update recipient",
        }, "error");
      }
    });
  };

  const canSubmit = name.trim().length > 0 && isRecipientDetailsComplete(type, details);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Recipient</DialogTitle>
          <DialogDescription>
            Update this recipient&rsquo;s details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Destination Type</Label>
            <Select value={type} onValueChange={(v) => handleTypeChange(v as DestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK_ACCOUNT">Bank Account</SelectItem>
                <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                <SelectItem value="CRYPTO_WALLET">Crypto Wallet</SelectItem>
                <SelectItem value="STELLAR">Stellar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <RecipientDetailsFields type={type} value={details} onChange={setDetails} />
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
