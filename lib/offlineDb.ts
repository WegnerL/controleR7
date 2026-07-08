/**
 * offlineDb.ts
 * Banco de dados local (IndexedDB via Dexie) para funcionamento offline.
 * Espelha as principais tabelas do servidor e mantém uma fila de sincronização.
 */

import Dexie, { type Table } from "dexie";

// ─── Tipos espelhados do servidor ─────────────────────────────────────────────

export interface OfflineFilial {
  id: number;
  codigo: number;
  gerente: string | null;
  coordenador: string | null;
  status: string;
  ativo?: boolean;
  updatedAt?: number; // timestamp local
}

export interface OfflineInventario {
  id: number;
  filialId: number;
  filial: string;
  gerente: string | null;
  ano: number;
  jan: string | null; fev: string | null; mar: string | null; abr: string | null;
  mai: string | null; jun: string | null; jul: string | null; ago: string | null;
  set: string | null; out: string | null; nov: string | null; dez: string | null;
  updatedAt?: number;
}

export interface OfflineFaturamento {
  id: number;
  filialId: number;
  filial: string;
  gerente: string | null;
  ano: number;
  jan: number | null; fev: number | null; mar: number | null; abr: number | null;
  mai: number | null; jun: number | null; jul: number | null; ago: number | null;
  set: number | null; out: number | null; nov: number | null; dez: number | null;
  total: number | null;
  desafio: number | null;
  updatedAt?: number;
}

export interface OfflinePerda {
  id: number;
  filialId: number;
  filial: string;
  gerente: string | null;
  ano: number;
  jan: number | null; fev: number | null; mar: number | null; abr: number | null;
  mai: number | null; jun: number | null; jul: number | null; ago: number | null;
  set: number | null; out: number | null; nov: number | null; dez: number | null;
  total: number | null;
  metaPercent: number | null;
  perdaPercent: number | null;
  updatedAt?: number;
}

export interface OfflineContagem {
  id: number;
  filialId: number;
  filial: string;
  gerente: string | null;
  coordenador: string | null;
  ano: number;
  mes: number;
  semana1: string | null; semana2: string | null; semana3: string | null;
  semana4: string | null; semana5: string | null;
  total: number | null;
  updatedAt?: number;
}

export interface OfflineFechamento {
  id: number;
  filialId: number;
  filial: string;
  gerente: string | null;
  coordenador: string | null;
  ano: number;
  mes: number;
  dia20: number | null; dia21: number | null; dia22: number | null; dia23: number | null;
  dia24: number | null; dia25: number | null; dia26: number | null; dia27: number | null;
  dia28: number | null; dia29: number | null; dia30: number | null; dia31: number | null;
  total: number | null;
  desafio: number | null;
  updatedAt?: number;
}

// ─── Fila de sincronização ────────────────────────────────────────────────────

export type SyncOperation = "create" | "update" | "delete";
export type SyncModule =
  | "filiais"
  | "inventarios"
  | "faturamentos"
  | "perdas"
  | "contagem"
  | "fechamentos";

export interface SyncQueueItem {
  id?: number;           // auto-increment
  module: SyncModule;
  operation: SyncOperation;
  recordId: number | null;  // null para creates
  payload: string;          // JSON serializado
  createdAt: number;        // timestamp
  attempts: number;
  lastError: string | null;
  status: "pending" | "syncing" | "failed";
}

// ─── Classe do banco offline ──────────────────────────────────────────────────

class OfflineDatabase extends Dexie {
  filiais!: Table<OfflineFilial, number>;
  inventarios!: Table<OfflineInventario, number>;
  faturamentos!: Table<OfflineFaturamento, number>;
  perdas!: Table<OfflinePerda, number>;
  contagem!: Table<OfflineContagem, number>;
  fechamentos!: Table<OfflineFechamento, number>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super("ControleR7Offline");

    this.version(1).stores({
      filiais:      "id, codigo, status",
      inventarios:  "id, filialId, ano",
      faturamentos: "id, filialId, ano",
      perdas:       "id, filialId, ano",
      contagem:     "id, filialId, ano, mes",
      fechamentos:  "id, filialId, ano, mes",
      syncQueue:    "++id, module, status, createdAt",
    });
  }
}

export const offlineDb = new OfflineDatabase();

// ─── Helpers de fila ─────────────────────────────────────────────────────────

export async function enqueueSync(
  module: SyncModule,
  operation: SyncOperation,
  recordId: number | null,
  payload: object
): Promise<void> {
  await offlineDb.syncQueue.add({
    module,
    operation,
    recordId,
    payload: JSON.stringify(payload),
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
    status: "pending",
  });
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.syncQueue.where("status").anyOf(["pending", "failed"]).count();
}

export async function clearSyncedItems(): Promise<void> {
  // Remove itens com mais de 7 dias que já foram sincronizados (limpeza)
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await offlineDb.syncQueue
    .where("createdAt")
    .below(cutoff)
    .delete();
}
