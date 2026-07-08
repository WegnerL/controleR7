import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useOfflineSyncContext } from "@/contexts/OfflineSyncContext";
import { useMenuConfig, ICON_MAP } from "@/contexts/MenuConfigContext";
import {
  LayoutDashboard,
  Building2,
  Package,
  TrendingUp,
  AlertTriangle,
  Settings,
  PlusSquare,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Menu,
  Upload,
  CalendarDays,
  FileText,
  Download,
  Wifi,
  WifiOff,
  X,
  Smartphone,
  RefreshCw,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Itens padrão (fallback quando MenuConfigContext ainda não carregou)
const STATIC_NAV_DEFAULT = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dados", label: "Dados", icon: Building2 },
  { href: "/inventarios", label: "Inventários", icon: Package },
  { href: "/faturamentos", label: "Faturamentos", icon: TrendingUp },
  { href: "/perdas", label: "Perdas", icon: AlertTriangle },
  { href: "/contagem", label: "Contagem Semanal", icon: CalendarDays },
  { href: "/fechamentos", label: "Fechamentos", icon: FileText },
  { href: "/vl10e", label: "VL10E", icon: BarChart3 },
];

const TOOLS_NAV_DEFAULT = [
  { href: "/importar", label: "Importar Excel", icon: Upload },
  { href: "/menus", label: "Criar Menus", icon: PlusSquare },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Tipo para o evento beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detectar se é iOS (Safari) — não suporta beforeinstallprompt
function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Detectar se já está instalado como PWA (standalone)
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

// Acesso seguro ao localStorage
function safeLocalStorage(key: string, value?: string): string | null {
  try {
    if (value !== undefined) {
      localStorage.setItem(key, value);
      return value;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  // Estado de sincronização offline do contexto global
  const { isOnline, pendingCount, isSyncing, lastSyncResult, syncNow } = useOfflineSyncContext();

  // Estado do banner de instalação PWA
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [bannerDismissed] = useState(() => {
    return safeLocalStorage("pwa-banner-dismissed") === "true";
  });

  useEffect(() => {
    // Não mostrar banner se já está instalado
    if (isStandalone()) return;

    // iOS: mostrar instruções manuais se não dispensou
    if (isIOS() && !bannerDismissed) {
      setShowInstallBanner(true);
    }

    // Android/Desktop: capturar evento de instalação PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      if (!bannerDismissed) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setShowInstallBanner(false);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [bannerDismissed]);

  // Notificar quando sincronização concluir
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.synced > 0) {
      toast.success(
        `${lastSyncResult.synced} alteração${lastSyncResult.synced > 1 ? "ões" : ""} sincronizada${lastSyncResult.synced > 1 ? "s" : ""} com o servidor!`,
        { duration: 4000 }
      );
    }
    if (lastSyncResult && lastSyncResult.failed > 0) {
      toast.error(
        `${lastSyncResult.failed} operação${lastSyncResult.failed > 1 ? "ões" : ""} falhou na sincronização.`,
        { duration: 6000 }
      );
    }
  }, [lastSyncResult]);

  const handleInstall = async () => {
    if (isIOS()) {
      setShowIOSInstructions(true);
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
    setShowIOSInstructions(false);
    safeLocalStorage("pwa-banner-dismissed", "true");
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error("Sem conexão. Conecte-se à internet para sincronizar.");
      return;
    }
    const result = await syncNow();
    if (result.synced === 0 && result.failed === 0) {
      toast.info("Nenhuma alteração pendente para sincronizar.");
    }
  };

  const { data: customMenus } = trpc.menus.list.useQuery();

  // Menus dinâmicos do contexto de configuração
  const { config: menuConfig } = useMenuConfig();
  const dynamicNav = menuConfig.principal
    .filter(i => i.visible)
    .map(i => ({ href: i.href, label: i.label, icon: ICON_MAP[i.iconName] ?? LayoutDashboard }));
  const dynamicTools = menuConfig.ferramentas
    .filter(i => i.visible)
    .map(i => ({ href: i.href, label: i.label, icon: ICON_MAP[i.iconName] ?? Settings }));

  const activeNav = dynamicNav.length > 0 ? dynamicNav : STATIC_NAV_DEFAULT;
  const activeTools = dynamicTools.length > 0 ? dynamicTools : TOOLS_NAV_DEFAULT;

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const NavItem = ({ href, label, icon: Icon, badge }: {
    href: string; label: string; icon: React.ElementType; badge?: string;
  }) => {
    const isInstall = href === "#instalar";
    const content = (
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group relative",
        isActive(href)
          ? "bg-primary/15 text-primary border-l-2 border-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}>
        <Icon className={cn("shrink-0 transition-colors", collapsed ? "w-5 h-5" : "w-4 h-4")} />
        {!collapsed && (
          <>
            <span className="text-sm font-medium truncate flex-1">{label}</span>
            {badge && <Badge variant="secondary" className="text-xs px-1.5 py-0">{badge}</Badge>}
          </>
        )}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
            {label}
          </div>
        )}
      </div>
    );
    
    if (isInstall) {
      return (
        <button onClick={() => { handleInstall(); setMobileOpen(false); }} className="w-full text-left">
          {content}
        </button>
      );
    }
    
    return (
      <Link href={href} onClick={() => setMobileOpen(false)}>
        {content}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-sidebar-border", collapsed && "justify-center px-2")}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 glow-primary">
          <BarChart3 className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-sidebar-foreground leading-tight">Controle R7</p>
            <p className="text-xs text-muted-foreground">Gestão Corporativa</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <div className="px-2 space-y-0.5">
          {!collapsed && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Principal</p>
          )}
          {activeNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          {customMenus && customMenus.length > 0 && (
            <>
              <Separator className="my-3 bg-sidebar-border" />
              {!collapsed && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Menus Personalizados</p>
              )}
              {customMenus.map((menu) => (
                <NavItem
                  key={menu.id}
                  href={`/menus/${menu.id}`}
                  label={menu.nome}
                  icon={BarChart3}
                />
              ))}
            </>
          )}

          <Separator className="my-3 bg-sidebar-border" />
          {!collapsed && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Ferramentas</p>
          )}
          {activeTools.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
      </ScrollArea>

      {/* Bottom section */}
      <div className="px-2 pb-3 border-t border-sidebar-border pt-3 space-y-1">
        {/* bottom nav vazio — itens gerenciados pelo MenuConfigContext */}

        {/* Indicador online/offline + pendências */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          collapsed && "justify-center px-2"
        )}>
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!collapsed && (
                <span className="text-emerald-400 font-medium flex-1">Online</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!collapsed && (
                <span className="text-amber-400 font-medium flex-1">Offline</span>
              )}
            </>
          )}
          {/* Badge de pendências */}
          {pendingCount > 0 && !collapsed && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {pendingCount}
            </span>
          )}
          {pendingCount > 0 && collapsed && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full" />
          )}
        </div>

        {/* Botão sincronizar manualmente (quando há pendências e está online) */}
        {pendingCount > 0 && isOnline && (
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer",
              collapsed && "justify-center px-2",
              isSyncing
                ? "text-cyan-400/50 cursor-not-allowed"
                : "text-cyan-400 hover:bg-cyan-400/10"
            )}
            title="Sincronizar agora"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 shrink-0", isSyncing && "animate-spin")} />
            {!collapsed && (
              <span className="font-medium">
                {isSyncing ? "Sincronizando..." : `Sincronizar (${pendingCount})`}
              </span>
            )}
          </button>
        )}

        {/* PWA install button removed - using standard browser download instead */}
      </div>

      {/* Collapse button */}
      <div className="px-2 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("w-full text-muted-foreground hover:text-foreground", collapsed && "justify-center")}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <><ChevronLeft className="w-4 h-4 mr-2" /><span className="text-xs">Recolher</span></>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <BarChart3 className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">Controle R7</span>
          </div>
          {/* Status + pendências no mobile header */}
          <div className="flex items-center gap-2">
            {pendingCount > 0 && isOnline && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-1 text-amber-400 text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                <span>{pendingCount}</span>
              </button>
            )}
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-400" />
            )}
          </div>
        </header>

        {/* Banner de instalação PWA (Android/Desktop) */}
        {showInstallBanner && !isIOS() && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-cyan-950/80 border-b border-cyan-800/50 text-sm">
            <Download className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-cyan-100 flex-1">
              Instale o <strong>Controle R7</strong> no seu dispositivo para acesso rápido e uso offline.
            </span>
            <Button
              size="sm"
              onClick={handleInstall}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1 h-auto shrink-0"
            >
              Instalar
            </Button>
            <button onClick={handleDismissBanner} className="text-cyan-400/60 hover:text-cyan-400 transition-colors shrink-0" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Banner de instalação iOS */}
        {showInstallBanner && isIOS() && !showIOSInstructions && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-cyan-950/80 border-b border-cyan-800/50 text-sm">
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-cyan-100 flex-1">
              Instale o <strong>Controle R7</strong> no seu iPhone/iPad para acesso offline.
            </span>
            <Button size="sm" onClick={() => setShowIOSInstructions(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1 h-auto shrink-0">
              Como instalar
            </Button>
            <button onClick={handleDismissBanner} className="text-cyan-400/60 hover:text-cyan-400 transition-colors shrink-0" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Instruções de instalação iOS */}
        {showIOSInstructions && (
          <div className="px-4 py-3 bg-cyan-950/90 border-b border-cyan-800/50 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-cyan-100 font-semibold mb-1">Como instalar no iPhone/iPad:</p>
                <ol className="text-cyan-200/80 text-xs space-y-1 list-decimal list-inside">
                  <li>Toque no ícone de <strong>Compartilhar</strong> (□↑) na barra do Safari</li>
                  <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                  <li>Confirme tocando em <strong>"Adicionar"</strong></li>
                </ol>
              </div>
              <button onClick={handleDismissBanner} className="text-cyan-400/60 hover:text-cyan-400 transition-colors shrink-0 mt-0.5" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Banner offline com pendências */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/80 border-b border-amber-800/50 text-xs text-amber-200">
            <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="flex-1">
              Você está <strong>offline</strong>. Suas edições serão salvas localmente e sincronizadas ao reconectar.
              {pendingCount > 0 && <span className="ml-1 text-amber-300">({pendingCount} pendente{pendingCount > 1 ? "s" : ""})</span>}
            </span>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
