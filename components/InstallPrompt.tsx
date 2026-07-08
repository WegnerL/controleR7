import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verificar se já foi descartado nesta sessão
    const wasDismissed = sessionStorage.getItem("installPromptDismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt?.();
      const { outcome } = await deferredPrompt.userChoice || { outcome: "dismissed" };
      
      if (outcome === "accepted") {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error("Erro ao instalar:", error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("installPromptDismissed", "true");
    setDismissed(true);
  };

  if (dismissed || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            Instalar Controle R7
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Instale o Controle R7 no seu dispositivo para acesso rápido e funcionalidade offline. 
            O aplicativo funcionará como um app nativo no seu PC ou celular.
          </p>

          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg space-y-2">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Benefícios:</p>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>✓ Acesso rápido na tela inicial</li>
              <li>✓ Funciona offline</li>
              <li>✓ Sincronização automática</li>
              <li>✓ Experiência de app nativo</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Agora não
          </Button>
          <Button
            onClick={handleInstall}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Instalar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
