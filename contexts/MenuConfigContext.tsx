import { createContext, useContext, useMemo, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Building2,
  Package,
  TrendingUp,
  AlertTriangle,
  CalendarDays,
  FileText,
  Upload,
  PlusSquare,
  Settings,
  Download,
  BarChart3,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface NavItem {
  id: string;
  href: string;
  label: string;
  iconName: string;
  visible: boolean;
  order: number;
  fixed?: boolean; // itens fixos não podem ser removidos (ex: Configurações)
}

export interface ColConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  custom?: boolean; // colunas personalizadas criadas pelo usuário
}

export interface MenuConfig {
  principal: NavItem[];
  ferramentas: NavItem[];
  colunas: Record<string, ColConfig[]>; // keyed by module id
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  Package,
  TrendingUp,
  AlertTriangle,
  CalendarDays,
  FileText,
  Upload,
  PlusSquare,
  Settings,
  Download: Download,
  BarChart3,
};

export const DEFAULT_PRINCIPAL: NavItem[] = [
  { id: "dashboard",   href: "/",            label: "Dashboard",       iconName: "LayoutDashboard", visible: true,  order: 0 },
  { id: "dados",       href: "/dados",        label: "Dados",           iconName: "Building2",       visible: true,  order: 1 },
  { id: "inventarios", href: "/inventarios",  label: "Inventários",     iconName: "Package",         visible: true,  order: 2 },
  { id: "faturamentos",href: "/faturamentos", label: "Faturamentos",    iconName: "TrendingUp",      visible: true,  order: 3 },
  { id: "perdas",      href: "/perdas",       label: "Perdas",          iconName: "AlertTriangle",   visible: true,  order: 4 },
  { id: "contagem",    href: "/contagem",     label: "Contagem Semanal",iconName: "CalendarDays",    visible: true,  order: 5 },
  { id: "fechamentos", href: "/fechamentos",  label: "Fechamentos",     iconName: "FileText",        visible: true,  order: 6 },
  { id: "vl10e",       href: "/vl10e",        label: "VL10E",           iconName: "BarChart3",       visible: true,  order: 7 },
  { id: "cookit-antigo", href: "/cookit-antigo", label: "Cookit Antigo",  iconName: "BarChart3",       visible: true,  order: 8 },
];

export const DEFAULT_FERRAMENTAS: NavItem[] = [
  { id: "importar",      href: "/importar",      label: "Importar Excel",  iconName: "Upload",     visible: true, order: 0 },
  { id: "menus",         href: "/menus",          label: "Criar Menus",     iconName: "PlusSquare", visible: true, order: 1 },
  { id: "configuracoes", href: "/configuracoes",  label: "Configurações",   iconName: "Settings",   visible: true, order: 2, fixed: true },
];

export const DEFAULT_COLUNAS: Record<string, ColConfig[]> = {
  dados: [
    { id: "codigo",      label: "Código",       visible: true, order: 0 },
    { id: "gerente",     label: "Gerente",      visible: true, order: 1 },
    { id: "coordenador", label: "Coordenador",  visible: true, order: 2 },
    { id: "status",      label: "Status",       visible: true, order: 3 },
    { id: "metaPct",     label: "Meta %",       visible: true, order: 4 },
    { id: "perdaPct",    label: "% Perda",      visible: true, order: 5 },
    { id: "perdaReais",  label: "Perda (R$)",   visible: true, order: 6 },
  ],
  inventarios: [
    { id: "filial",  label: "Filial",  visible: true, order: 0 },
    { id: "gerente", label: "Gerente", visible: true, order: 1 },
    { id: "jan",     label: "Jan",     visible: true, order: 2 },
    { id: "fev",     label: "Fev",     visible: true, order: 3 },
    { id: "mar",     label: "Mar",     visible: true, order: 4 },
    { id: "abr",     label: "Abr",     visible: true, order: 5 },
    { id: "mai",     label: "Mai",     visible: true, order: 6 },
    { id: "jun",     label: "Jun",     visible: true, order: 7 },
    { id: "jul",     label: "Jul",     visible: true, order: 8 },
    { id: "ago",     label: "Ago",     visible: true, order: 9 },
    { id: "set",     label: "Set",     visible: true, order: 10 },
    { id: "out",     label: "Out",     visible: true, order: 11 },
    { id: "nov",     label: "Nov",     visible: true, order: 12 },
    { id: "dez",     label: "Dez",     visible: true, order: 13 },
    { id: "total",   label: "Total",   visible: true, order: 14 },
  ],
  faturamentos: [
    { id: "filial",   label: "Filial",   visible: true, order: 0 },
    { id: "gerente",  label: "Gerente",  visible: true, order: 1 },
    { id: "jan",      label: "Jan",      visible: true, order: 2 },
    { id: "fev",      label: "Fev",      visible: true, order: 3 },
    { id: "mar",      label: "Mar",      visible: true, order: 4 },
    { id: "abr",      label: "Abr",      visible: true, order: 5 },
    { id: "mai",      label: "Mai",      visible: true, order: 6 },
    { id: "jun",      label: "Jun",      visible: true, order: 7 },
    { id: "jul",      label: "Jul",      visible: true, order: 8 },
    { id: "ago",      label: "Ago",      visible: true, order: 9 },
    { id: "set",      label: "Set",      visible: true, order: 10 },
    { id: "out",      label: "Out",      visible: true, order: 11 },
    { id: "nov",      label: "Nov",      visible: true, order: 12 },
    { id: "dez",      label: "Dez",      visible: true, order: 13 },
    { id: "total",    label: "Total",    visible: true, order: 14 },
    { id: "desafio",  label: "Desafio",  visible: true, order: 15 },
  ],
  perdas: [
    { id: "filial",        label: "Filial",          visible: true, order: 0 },
    { id: "gerente",       label: "Gerente",         visible: true, order: 1 },
    { id: "jan",           label: "Jan",             visible: true, order: 2 },
    { id: "fev",           label: "Fev",             visible: true, order: 3 },
    { id: "mar",           label: "Mar",             visible: true, order: 4 },
    { id: "abr",           label: "Abr",             visible: true, order: 5 },
    { id: "mai",           label: "Mai",             visible: true, order: 6 },
    { id: "jun",           label: "Jun",             visible: true, order: 7 },
    { id: "jul",           label: "Jul",             visible: true, order: 8 },
    { id: "ago",           label: "Ago",             visible: true, order: 9 },
    { id: "set",           label: "Set",             visible: true, order: 10 },
    { id: "out",           label: "Out",             visible: true, order: 11 },
    { id: "nov",           label: "Nov",             visible: true, order: 12 },
    { id: "dez",           label: "Dez",             visible: true, order: 13 },
    { id: "total",         label: "Total",           visible: true, order: 14 },
    { id: "perdaPct",      label: "Perda %",         visible: true, order: 15 },
    { id: "metaPerdaPct",  label: "Meta %",          visible: true, order: 16 },
    { id: "perdaAceitavel",label: "Perda Aceit.",    visible: true, order: 17 },
  ],
  contagem: [
    { id: "filial",      label: "Filial",    visible: true, order: 0 },
    { id: "gerente",     label: "Gerente",   visible: true, order: 1 },
    { id: "coordenador", label: "Coord.",    visible: true, order: 2 },
    { id: "semana1",     label: "Sem. 1",    visible: true, order: 3 },
    { id: "semana2",     label: "Sem. 2",    visible: true, order: 4 },
    { id: "semana3",     label: "Sem. 3",    visible: true, order: 5 },
    { id: "semana4",     label: "Sem. 4",    visible: true, order: 6 },
    { id: "semana5",     label: "Sem. 5",    visible: true, order: 7 },
    { id: "total",       label: "Total",     visible: true, order: 8 },
  ],
  fechamentos: [
    { id: "filial",  label: "Filial",  visible: true, order: 0 },
    { id: "gerente", label: "Gerente", visible: true, order: 1 },
    { id: "dia20",   label: "Dia 20",  visible: true, order: 2 },
    { id: "dia21",   label: "Dia 21",  visible: true, order: 3 },
    { id: "dia22",   label: "Dia 22",  visible: true, order: 4 },
    { id: "dia23",   label: "Dia 23",  visible: true, order: 5 },
    { id: "dia24",   label: "Dia 24",  visible: true, order: 6 },
    { id: "dia25",   label: "Dia 25",  visible: true, order: 7 },
    { id: "dia26",   label: "Dia 26",  visible: true, order: 8 },
    { id: "dia27",   label: "Dia 27",  visible: true, order: 9 },
    { id: "dia28",   label: "Dia 28",  visible: true, order: 10 },
    { id: "dia29",   label: "Dia 29",  visible: true, order: 11 },
    { id: "dia30",   label: "Dia 30",  visible: true, order: 12 },
    { id: "dia31",   label: "Dia 31",  visible: true, order: 13 },
    { id: "total",   label: "Total",   visible: true, order: 14 },
  ],
  vl10e: [
    { id: "codigo",  label: "Codigo Filial", visible: true, order: 0 },
    { id: "gerente", label: "Gerente",       visible: true, order: 1 },
    { id: "total",   label: "Total",         visible: true, order: 2 },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mergeWithDefaults<T extends { id: string; order: number }>(
  saved: T[] | null | undefined,
  defaults: T[]
): T[] {
  if (!saved || saved.length === 0) return defaults;
  // Merge: saved items override defaults; new defaults are appended
  const savedMap = new Map(saved.map(i => [i.id, i]));
  const merged: T[] = defaults.map(d => savedMap.get(d.id) ?? d);
  return merged.sort((a, b) => a.order - b.order);
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface MenuConfigContextValue {
  config: MenuConfig;
  isLoading: boolean;
  refetch: () => void;
}

const MenuConfigContext = createContext<MenuConfigContextValue>({
  config: { principal: DEFAULT_PRINCIPAL, ferramentas: DEFAULT_FERRAMENTAS, colunas: DEFAULT_COLUNAS },
  isLoading: false,
  refetch: () => {},
});

export function MenuConfigProvider({ children }: { children: ReactNode }) {
  const { data: allConfigs, isLoading, refetch } = trpc.configuracoes.list.useQuery(undefined, {
    refetchInterval: 15_000, // sincroniza a cada 15s
  });

  const config = useMemo<MenuConfig>(() => {
    if (!allConfigs) {
      return { principal: DEFAULT_PRINCIPAL, ferramentas: DEFAULT_FERRAMENTAS, colunas: DEFAULT_COLUNAS };
    }

    const get = (chave: string) => allConfigs.find(c => c.chave === chave)?.valor ?? null;

    const parseSafe = <T,>(raw: string | null): T | undefined => {
      if (!raw) return undefined;
      try { return JSON.parse(raw) as T; } catch { return undefined; }
    };

    const principal = mergeWithDefaults(
      parseSafe<NavItem[]>(get("menu.principal")),
      DEFAULT_PRINCIPAL
    );
    const ferramentas = mergeWithDefaults(
      parseSafe<NavItem[]>(get("menu.ferramentas")),
      DEFAULT_FERRAMENTAS
    );

    const colunas: Record<string, ColConfig[]> = {};
    for (const mod of Object.keys(DEFAULT_COLUNAS)) {
      colunas[mod] = mergeWithDefaults(
        parseSafe<ColConfig[]>(get(`menu.colunas.${mod}`)),
        DEFAULT_COLUNAS[mod]
      );
    }

    return { principal, ferramentas, colunas };
  }, [allConfigs]);

  return (
    <MenuConfigContext.Provider value={{ config, isLoading, refetch }}>
      {children}
    </MenuConfigContext.Provider>
  );
}

export function useMenuConfig() {
  return useContext(MenuConfigContext);
}
