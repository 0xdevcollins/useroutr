"use client";

import { useState } from 'react';
import { Button } from '@useroutr/ui';
import { MoreHorizontal, Trash2, Edit3 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  Badge,
  ShadTable as Table, TableBody, TableCell, TableHead, ShadTableHeader as TableHeader, TableRow,
} from '@useroutr/ui';
import { Recipient } from '@useroutr/types';
import { EditRecipientDialog } from './EditRecipientDialog';
import { DeleteRecipientDialog } from './DeleteRecipientDialog';

function truncateMiddle(s: string, n = 6): string {
  return s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-4)}` : s;
}

/** Render a recipient's destination from its `details`, masked where sensitive. */
function formatDestination(r: Recipient): string {
  const d = r.details ?? {};
  switch (r.type) {
    case 'BANK_ACCOUNT': {
      const prefix = d.bankName ? `${d.bankName} ` : '';
      if (d.accountNumber) return `${prefix}····${String(d.accountNumber).slice(-4)}`;
      if (d.iban) return `${prefix}····${String(d.iban).slice(-4)}`;
      return '—';
    }
    case 'MOBILE_MONEY':
      return d.phoneNumber ? `${d.provider ? `${d.provider} · ` : ''}${d.phoneNumber}` : '—';
    case 'CRYPTO_WALLET':
      return d.address ? `${truncateMiddle(String(d.address))}${d.asset ? ` · ${d.asset}` : ''}` : '—';
    case 'STELLAR':
      return d.address ? truncateMiddle(String(d.address)) : '—';
    default:
      return '—';
  }
}

interface RecipientsTableProps {
  data: Recipient[];
  total: number;
  isLoading: boolean;
}

export function RecipientsTable({ data, total, isLoading }: RecipientsTableProps) {
  const [editRecipient, setEditRecipient] = useState<Recipient | null>(null);
  const [deleteRecipient, setDeleteRecipient] = useState<Recipient | null>(null);
  const [selected, setSelected] = useState<Recipient[]>([]);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-8 text-center">
          <div className="h-8 w-64 mx-auto skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8">
            Bulk actions
            <span className="ml-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium">
              {selected.length}
            </span>
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {total} recipients
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((recipient) => (
              <TableRow key={recipient.id} className="border-b hover:bg-accent/50">
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.some((s) => s.id === recipient.id)}
                    onChange={() => setSelected((prev) =>
                      prev.some((s) => s.id === recipient.id)
                        ? prev.filter((s) => s.id !== recipient.id)
                        : [...prev, recipient]
                    )}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{recipient.name}</TableCell>
                <TableCell>
                  <Badge variant="default">
                    {recipient.type.replace('_', ' ').toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                  {formatDestination(recipient)}
                </TableCell>
                <TableCell>
                  {recipient.isDefault && <Badge variant="active">Default</Badge>}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {new Date(recipient.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditRecipient(recipient)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDeleteRecipient(recipient)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No recipients. <Button variant="link" size="sm" className="h-6 p-0">
                    Create one
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editRecipient && (
        <EditRecipientDialog
          recipient={editRecipient}
          open
          onOpenChange={(o) => { if (!o) setEditRecipient(null); }}
        />
      )}
      {deleteRecipient && (
        <DeleteRecipientDialog
          recipient={deleteRecipient}
          open
          onOpenChange={(o) => { if (!o) setDeleteRecipient(null); }}
        />
      )}
    </div>
  );
}

