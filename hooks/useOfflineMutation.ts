/**
 * useOfflineMutation.ts
 * Hook que envolve mutations tRPC para suporte offline.
 * - Quando ONLINE: executa a mutation normalmente no servidor
 * - Quando OFFLINE: salva no IndexedDB local e enfileira para sincronização posterior
 */

import { useCallback } from "react";
import { useOfflineSyncContext } from "@/contexts/OfflineSyncContext";
import { offlineDb, type SyncModule } from "@/lib/offlineDb";
import { toast } from "sonner";

interface UseOfflineMutationOptions<TInput> {
  module: SyncModule;
  // Função que executa a mutation online (retorna Promise)
  onlineMutate: (input: TInput) => Promise<unknown>;
  // Função que aplica a mudança localmente no IndexedDB (para uso offline)
  offlineApply: (input: TInput) => Promise<void>;
  // Mensagem de sucesso (opcional)
  successMessage?: string;
}

export function useOfflineMutation<TInput extends { id?: number }>({
  module,
  onlineMutate,
  offlineApply,
  successMessage,
}: UseOfflineMutationOptions<TInput>) {
  const { isOnline, enqueue, refreshPendingCount } = useOfflineSyncContext();

  const mutate = useCallback(async (input: TInput): Promise<void> => {
    if (isOnline) {
      // Online: executa normalmente no servidor
      await onlineMutate(input);
      if (successMessage) {
        toast.success(successMessage);
      }
    } else {
      // Offline: salva localmente e enfileira
      await offlineApply(input);
      const operation = input.id ? "update" : "create";
      await enqueue(module, operation, input.id ?? null, input);
      await refreshPendingCount();
      toast.info("Salvo localmente. Será sincronizado ao reconectar.", {
        duration: 3000,
        icon: "💾",
      });
    }
  }, [isOnline, onlineMutate, offlineApply, enqueue, module, refreshPendingCount, successMessage]);

  return { mutate, isOnline };
}

// ─── Helper: atualiza um registro no IndexedDB local ─────────────────────────

export async function updateLocalInventario(id: number, fields: Record<string, unknown>) {
  await offlineDb.inventarios.update(id, { ...fields, updatedAt: Date.now() });
}

export async function updateLocalFaturamento(id: number, fields: Record<string, unknown>) {
  await offlineDb.faturamentos.update(id, { ...fields, updatedAt: Date.now() });
}

export async function updateLocalPerda(id: number, fields: Record<string, unknown>) {
  await offlineDb.perdas.update(id, { ...fields, updatedAt: Date.now() });
}

export async function updateLocalContagem(id: number, fields: Record<string, unknown>) {
  await offlineDb.contagem.update(id, { ...fields, updatedAt: Date.now() });
}

export async function updateLocalFechamento(id: number, fields: Record<string, unknown>) {
  await offlineDb.fechamentos.update(id, { ...fields, updatedAt: Date.now() });
}
