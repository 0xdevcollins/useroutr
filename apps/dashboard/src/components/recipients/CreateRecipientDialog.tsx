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
import { DestType } from '@useroutr/types';
import { api } from '@/lib/api';
import { RecipientDetailsFields, isRecipientDetailsComplete } from './RecipientDetailsFields';

interface CreateRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRecipientDialog({ open, onOpenChange }: CreateRecipientDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [type, setType] = useState<DestType>('BANK_ACCOUNT');
  const [details, setDetails] = useState<Record<string, string | undefined>>({ type: 'BANK_ACCOUNT' });

  const handleTypeChange = (value: DestType) => {
    setType(value);
    setDetails({ type: value });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        await api.post('/recipients', { name, type, details });
        toast({ title: "Recipient created", message: `${name} has been saved.` }, "success");
        onOpenChange(false);
        setName('');
        setType('BANK_ACCOUNT');
        setDetails({ type: 'BANK_ACCOUNT' });
        window.dispatchEvent(new CustomEvent('recipients:refetch'));
      } catch (err) {
        toast({
          title: "Error",
          message: err instanceof Error ? err.message : "Failed to create recipient",
        }, "error");
      }
    });
  };

  const canSubmit = name.trim().length > 0 && isRecipientDetailsComplete(type, details);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Recipient</DialogTitle>
          <DialogDescription>
            Add a recipient to save for future payouts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Adaeze's GTBank account"
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
            {isPending ? 'Creating…' : 'Create Recipient'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
