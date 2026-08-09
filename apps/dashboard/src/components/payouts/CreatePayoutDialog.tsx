"use client";

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ShadSelect as Select,
  ShadSelectContent as SelectContent,
  ShadSelectItem as SelectItem,
  ShadSelectTrigger as SelectTrigger,
  ShadSelectValue as SelectValue,
  useToast,
} from '@useroutr/ui';
import { RecipientSelect } from '@/components/recipients/RecipientSelect';
import { api } from '@/lib/api';

export function CreatePayoutDialog() {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      await api.post('/payouts', { recipientId, amount, currency });
    } catch (error) {
      // Keep the dialog open so the entered values survive a failed submit.
      toast(
        error instanceof Error ? error.message : 'Failed to create payout',
        'error',
      );
      return;
    }

    setOpen(false);
    // Refetch payouts
    window.dispatchEvent(new CustomEvent('payouts:refetch'));
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        New payout
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Payout</DialogTitle>
            <DialogDescription>
              Send money to a recipient
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipient</Label>
              <RecipientSelect 
                value={recipientId}
                onValueChange={setRecipientId}
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input 
                id="amount"
                type="number"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={!recipientId || !amount}>
              Send Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

