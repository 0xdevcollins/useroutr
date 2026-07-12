"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@useroutr/ui";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Recipient } from "@useroutr/types";
import { RecipientsTable } from "@/components/recipients/RecipientsTable";
import { CreateRecipientDialog } from "@/components/recipients/CreateRecipientDialog";

interface RecipientsListResponse {
  data: Recipient[];
  total: number;
}

export default function RecipientsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const recipientsQuery = useQuery({
    queryKey: ["recipients"],
    queryFn: () => api.get<RecipientsListResponse>("/recipients"),
  });

  // Dialogs dispatch this after create/edit/delete so the list stays fresh.
  useEffect(() => {
    const refetch = () =>
      queryClient.invalidateQueries({ queryKey: ["recipients"] });
    window.addEventListener("recipients:refetch", refetch);
    return () => window.removeEventListener("recipients:refetch", refetch);
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Recipients
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add recipient
          </Button>
          <CreateRecipientDialog open={createOpen} onOpenChange={setCreateOpen} />
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <RecipientsTable
        data={recipientsQuery.data?.data || []}
        total={recipientsQuery.data?.total || 0}
        isLoading={recipientsQuery.isLoading}
      />
    </div>
  );
}
