import { useMemo } from "react";
import { useMenuConfig, DEFAULT_COLUNAS } from "@/contexts/MenuConfigContext";

/**
 * Retorna a lista de IDs de colunas visíveis para um módulo, na ordem configurada.
 * Uso: const visibleCols = useColConfig("perdas");
 *      if (!visibleCols.has("perdaPct")) return null; // ocultar coluna
 */
export function useColConfig(modulo: keyof typeof DEFAULT_COLUNAS): Set<string> {
  const { config } = useMenuConfig();
  return useMemo(() => {
    const cols = config.colunas[modulo] ?? DEFAULT_COLUNAS[modulo];
    return new Set(
      cols
        .filter(c => c.visible)
        .sort((a, b) => a.order - b.order)
        .map(c => c.id)
    );
  }, [config.colunas, modulo]);
}

/**
 * Retorna a lista ordenada de colunas visíveis (com label) para um módulo.
 * Útil para renderizar cabeçalhos de tabela dinamicamente.
 */
export function useColConfigOrdered(modulo: keyof typeof DEFAULT_COLUNAS) {
  const { config } = useMenuConfig();
  return useMemo(() => {
    const cols = config.colunas[modulo] ?? DEFAULT_COLUNAS[modulo];
    return cols
      .filter(c => c.visible)
      .sort((a, b) => a.order - b.order);
  }, [config.colunas, modulo]);
}
