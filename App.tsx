import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OfflineSyncProvider } from "./contexts/OfflineSyncContext";
import { MenuConfigProvider } from "./contexts/MenuConfigContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Dados from "./pages/Dados";
import Inventarios from "./pages/Inventarios";
import Faturamentos from "./pages/Faturamentos";
import Perdas from "./pages/Perdas";
import Configuracoes from "./pages/Configuracoes";
import CriacaoMenus from "./pages/CriacaoMenus";
import Importar from "./pages/Importar";
import MenuDinamico from "./pages/MenuDinamico";
import SeedPage from "./pages/SeedPage";
import ContagemSemanal from "./pages/ContagemSemanal";
import Fechamentos from "./pages/Fechamentos";
import VL10E from "./pages/VL10E";
import CookitAntigo from "./pages/CookitAntigo";
import ModuleSettings from "./pages/ModuleSettings";
import { InstallPrompt } from "./components/InstallPrompt";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dados" component={Dados} />
      <Route path="/inventarios" component={Inventarios} />
      <Route path="/faturamentos" component={Faturamentos} />
      <Route path="/perdas" component={Perdas} />
      <Route path="/configuracoes" component={Configuracoes} />
      <Route path="/importar" component={Importar} />
      <Route path="/menus" component={CriacaoMenus} />
      <Route path="/menus/:id" component={MenuDinamico} />
      <Route path="/contagem" component={ContagemSemanal} />
      <Route path="/fechamentos" component={Fechamentos} />
      <Route path="/vl10e" component={VL10E} />
      <Route path="/cookit-antigo" component={CookitAntigo} />
      <Route path="/modulos" component={ModuleSettings} />
      <Route path="/seed" component={SeedPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <InstallPrompt />
          <MenuConfigProvider>
            <OfflineSyncProvider>
              <DashboardLayout>
                <Router />
              </DashboardLayout>
            </OfflineSyncProvider>
          </MenuConfigProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
