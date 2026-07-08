/**
 * OfflineSyncContext.tsx
 * Contexto global que expõe o estado de sincronização offline para toda a aplicação.
 * Inclui: status online/offline, contagem de pendências, sincronização automática.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useOfflineSync, useSeedOfflineCache, type OfflineSyncState, type OfflineSyncActions } from "@/hooks/useOfflineSync";

type OfflineSyncContextType = OfflineSyncState & OfflineSyncActions;

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const sync = useOfflineSync();

  // Popula o IndexedDB com dados do servidor sempre que estiver online
  useSeedOfflineCache();

  return (
    <OfflineSyncContext.Provider value={sync}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext(): OfflineSyncContextType {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSyncContext must be used within OfflineSyncProvider");
  }
  return ctx;
}
