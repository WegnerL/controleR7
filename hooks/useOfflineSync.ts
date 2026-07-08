/**
 * useOfflineSync.ts
 * Hook central de sincronização offline.
 * - Monitora status online/offline
 * - Conta operações pendentes na fila
 * - Dispara sincronização automática ao reconectar
 * - Expõe função para enfileirar operações manuais
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { offlineDb, enqueueSync, getPendingCount, type SyncModule, type SyncOperation } from "@/lib/offlineDb";
import { processSyncQueue, type SyncResult } from "@/lib/syncService";
import { trpc } from "@/lib/trpc";

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  lastSyncAt: Date | null;
}

export interface OfflineSyncActions {
  enqueue: (module: SyncModule, operation: SyncOperation, recordId: number | null, payload: object) => Promise<void>;
  syncNow: () => Promise<SyncResult>;
  refreshPendingCount: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState & OfflineSyncActions {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const utils = trpc.useUtils();
  const syncingRef = useRef(false);

  // Atualiza o contador de pendências
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Sincroniza tudo e invalida caches do React Query
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (syncingRef.current) {
      return { synced: 0, failed: 0, errors: ["Sincronização já em andamento"] };
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const result = await processSyncQueue();
      setLastSyncResult(result);
      setLastSyncAt(new Date());

      if (result.synced > 0) {
        // Invalidar todos os caches para forçar re-fetch do servidor
        await Promise.allSettled([
          utils.filiais.list.invalidate(),
          utils.filiais.listWithPerdas.invalidate(),
          utils.inventarios.list.invalidate(),
          utils.faturamentos.list.invalidate(),
          utils.perdas.list.invalidate(),
          utils.contagemSemanal.list.invalidate(),
          utils.fechamentos.list.invalidate(),
        ]);
      }

      await refreshPendingCount();
      return result;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [utils, refreshPendingCount]);

  // Enfileira uma operação offline
  const enqueue = useCallback(async (
    module: SyncModule,
    operation: SyncOperation,
    recordId: number | null,
    payload: object
  ) => {
    await enqueueSync(module, operation, recordId, payload);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    // Carregar contagem inicial
    refreshPendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      // Aguardar um momento para a conexão estabilizar
      await new Promise(r => setTimeout(r, 1500));
      const count = await getPendingCount();
      if (count > 0) {
        await syncNow();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Atualizar contagem quando o IndexedDB mudar (outras abas)
    const interval = setInterval(refreshPendingCount, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [syncNow, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    lastSyncAt,
    enqueue,
    syncNow,
    refreshPendingCount,
  };
}

// ─── Hook para popular o IndexedDB com dados do servidor ─────────────────────

export function useSeedOfflineCache() {
  const { data: filiais } = trpc.filiais.list.useQuery();
  const { data: inventarios } = trpc.inventarios.list.useQuery({ ano: 2026 });
  const { data: faturamentos } = trpc.faturamentos.list.useQuery({ ano: 2026 });
  const { data: perdas } = trpc.perdas.list.useQuery({ ano: 2026 });
  const { data: contagem } = trpc.contagemSemanal.list.useQuery({ ano: 2026 });
  const { data: fechamentos } = trpc.fechamentos.list.useQuery({ ano: 2026 });

  useEffect(() => {
    if (filiais && filiais.length > 0) {
      offlineDb.filiais.bulkPut(
        filiais.map(f => ({
          id: f.id,
          codigo: f.codigo,
          gerente: f.gerente ?? null,
          coordenador: f.coordenador ?? null,
          status: f.ativo ? "ativo" : "inativo",
          ativo: f.ativo ?? true,
          updatedAt: Date.now(),
        }))
      ).catch(() => {});
    }
  }, [filiais]);

  useEffect(() => {
    if (inventarios && inventarios.length > 0) {
      offlineDb.inventarios.bulkPut(
        inventarios.map(inv => ({
          id: inv.id,
          filialId: inv.filial,
          filial: String(inv.filial),
          gerente: inv.gerente ?? null,
          ano: inv.ano ?? 2026,
          jan: inv.janeiro ?? null, fev: inv.fevereiro ?? null, mar: inv.marco ?? null,
          abr: inv.abril ?? null, mai: inv.maio ?? null, jun: inv.junho ?? null,
          jul: inv.julho ?? null, ago: inv.agosto ?? null, set: inv.setembro ?? null,
          out: inv.outubro ?? null, nov: inv.novembro ?? null, dez: inv.dezembro ?? null,
          updatedAt: Date.now(),
        }))
      ).catch(() => {});
    }
  }, [inventarios]);

  useEffect(() => {
    if (faturamentos && faturamentos.length > 0) {
      offlineDb.faturamentos.bulkPut(
        faturamentos.map((fat: any) => ({
          id: fat.id,
          filialId: fat.filial,
          filial: String(fat.filial),
          gerente: fat.gerente ?? null,
          ano: fat.ano ?? 2026,
          jan: fat.janeiro ?? null, fev: fat.fevereiro ?? null, mar: fat.marco ?? null,
          abr: fat.abril ?? null, mai: fat.maio ?? null, jun: fat.junho ?? null,
          jul: fat.julho ?? null, ago: fat.agosto ?? null, set: fat.setembro ?? null,
          out: fat.outubro ?? null, nov: fat.novembro ?? null, dez: fat.dezembro ?? null,
          total: fat.total ?? null,
          desafio: fat.desafio ?? null,
          updatedAt: Date.now(),
        }))
      ).catch(() => {});
    }
  }, [faturamentos]);

  useEffect(() => {
    if (perdas && perdas.length > 0) {
      offlineDb.perdas.bulkPut(
        perdas.map(p => ({
          id: p.id,
          filialId: p.filial,
          filial: String(p.filial),
          gerente: p.gerente ?? null,
          ano: p.ano ?? 2026,
          jan: p.janeiro ?? null, fev: p.fevereiro ?? null, mar: p.marco ?? null,
          abr: p.abril ?? null, mai: p.maio ?? null, jun: p.junho ?? null,
          jul: p.julho ?? null, ago: p.agosto ?? null, set: p.setembro ?? null,
          out: p.outubro ?? null, nov: p.novembro ?? null, dez: p.dezembro ?? null,
          total: p.total ?? null,
          metaPercent: p.metaPerdaPct ?? null,
          perdaPercent: p.perdaPct ?? null,
          updatedAt: Date.now(),
        }))
      ).catch(() => {});
    }
  }, [perdas]);

  useEffect(() => {
    if (contagem && contagem.length > 0) {
      offlineDb.contagem.bulkPut(
        contagem.map((c: any) => ({
          id: c.id,
          filialId: c.filial,
          filial: String(c.filial),
          gerente: c.gerente ?? null,
          coordenador: c.coordenador ?? null,
          ano: c.ano ?? 2026,
          mes: c.mes ?? 1,
          semana1: c.semana1 ?? null, semana2: c.semana2 ?? null,
          semana3: c.semana3 ?? null, semana4: c.semana4 ?? null,
          semana5: c.semana5 ?? null,
          total: c.total ?? null,
          updatedAt: Date.now(),
        }))
      ).catch(() => {});
    }
  }, [contagem]);

  useEffect(() => {
    if (fechamentos && fechamentos.length > 0) {
      offlineDb.fechamentos.bulkPut(
        fechamentos.map(f => ({
          id: f.id,
          filialId: f.filial,
          filial: String(f.filial),
          gerente: f.gerente ?? null,
          coordenador: f.coordenador ?? null,
          ano: f.ano ?? 2026,
          mes: f.mes ?? 1,
          dia20: f.dia20 ?? null, dia21: f.dia21 ?? null, dia22: f.dia22 ?? null,
          dia23: f.dia23 ?? null, dia24: f.dia24 ?? null, dia25: f.dia25 ?? null,
          dia26: f.dia26 ?? null, dia27: f.dia27 ?? null, dia28: f.dia28 ?? null,
          dia29: f.dia29 ?? null, dia30: f.dia30 ?? null, dia31: f.dia31 ?? null,
          total: f.total ?? null,
          desafio: f.desafio ?? null,
          updatedAt: Date.now(),
        }))
      ).catch(() => {});
    }
  }, [fechamentos]);
}
