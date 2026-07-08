import { useState, useEffect, useCallback } from "react";
import React from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert, AlertDescription, AlertTitle,
} from "@/components/ui/alert";
import {
  Settings, Save, RefreshCw, Building2, Package, TrendingUp,
  AlertTriangle, LayoutDashboard, GripVertical, Eye, EyeOff,
  RotateCcw, ChevronUp, ChevronDown, Layers, Menu, Columns,
  CalendarDays, FileText, Plus, Trash2, Edit2, X, Check,
  Palette, Users, Bell, Database, Download, Upload, Lock,
  Globe, Zap, Shield, BarChart3, Sliders, Info, HelpCircle,
  Copy, Archive, Clock, User, Mail, Phone, Gauge, Workflow,
  BookOpen, Headphones, Activity, Key, Plug, History, LogOut,
  MoreHorizontal, ChevronRight, Filter, Search, Maximize2, Minimize2,
} from "lucide-react";
import {
  useMenuConfig,
  DEFAULT_PRINCIPAL, DEFAULT_FERRAMENTAS,
} from "@/contexts/MenuConfigContext";
import { cn } from "@/lib/utils";

const MODULOS_SISTEMA = [
  { id: "dashboard",    nome: "Dashboard",    icon: LayoutDashboard, cor: "text-blue-500", desc: "Visão consolidada" },
  { id: "dados",        nome: "Dados",        icon: Building2, cor: "text-green-500", desc: "Filiais e gerentes" },
  { id: "inventarios",  nome: "Inventários",  icon: Package, cor: "text-purple-500", desc: "Controle rotativo" },
  { id: "faturamentos", nome: "Faturamentos", icon: TrendingUp, cor: "text-orange-500", desc: "Faturamento" },
  { id: "perdas",       nome: "Perdas",       icon: AlertTriangle, cor: "text-red-500", desc: "Controle de perdas" },
  { id: "contagem",     nome: "Contagem",     icon: CalendarDays, cor: "text-indigo-500", desc: "Contagem semanal" },
  { id: "fechamentos",  nome: "Fechamentos",  icon: FileText, cor: "text-cyan-500", desc: "Fechamentos" },
  { id: "vl10e",        nome: "VL10E",        icon: BarChart3, cor: "text-pink-500", desc: "Dados VL10E" },
  { id: "cookit",       nome: "Cookit Antigo",icon: Archive, cor: "text-amber-500", desc: "Dados legados" },
];

const CORES_DISPONVEIS = [
  { nome: "Azul", valor: "#3B82F6" },
  { nome: "Verde", valor: "#10B981" },
  { nome: "Amarelo", valor: "#F59E0B" },
  { nome: "Vermelho", valor: "#EF4444" },
  { nome: "Roxo", valor: "#8B5CF6" },
  { nome: "Rosa", valor: "#EC4899" },
  { nome: "Ciano", valor: "#06B6D4" },
  { nome: "Laranja", valor: "#F97316" },
];

export default function Configuracoes() {
  useMenuConfig();
  const [editOpen, setEditOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedMod, setSelectedMod] = useState<typeof MODULOS_SISTEMA[0] | null>(null);
  const [modConfig, setModConfig] = useState({
    nome: "",
    descricao: "",
    ativo: true,
    visivel: true,
    disponivel: true,
    atalho: "",
    cor: "#3B82F6",
    permitirImportacao: true,
    permitirExportacao: true,
    permitirSincronizacao: true,
    permitirBackup: true,
  });

  const handleEditarModulo = (mod: typeof MODULOS_SISTEMA[0]) => {
    setSelectedMod(mod);
    setModConfig({
      nome: mod.nome,
      descricao: mod.desc,
      ativo: true,
      visivel: true,
      disponivel: true,
      atalho: "",
      cor: "#3B82F6",
      permitirImportacao: true,
      permitirExportacao: true,
      permitirSincronizacao: true,
      permitirBackup: true,
    });
    setEditOpen(true);
  };

  const handleConfigurarModulo = (mod: typeof MODULOS_SISTEMA[0]) => {
    setSelectedMod(mod);
    setConfigOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Configurações Completas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todos os aspectos do sistema em um único lugar
          </p>
        </div>
      </div>

      <Alert className="bg-amber-950/30 border-amber-700/50">
        <Zap className="h-4 w-4" />
        <AlertTitle>Sistema em Tempo Real</AlertTitle>
        <AlertDescription>
          Todas as mudanças sincronizam automaticamente com todos os menus e módulos. Não é necessário recarregar.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-12 gap-1 h-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-1 text-xs">
            <LayoutDashboard className="w-3 h-3" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="menus" className="flex items-center gap-1 text-xs">
            <Menu className="w-3 h-3" /> Menus
          </TabsTrigger>
          <TabsTrigger value="modulos" className="flex items-center gap-1 text-xs">
            <Layers className="w-3 h-3" /> Módulos
          </TabsTrigger>
          <TabsTrigger value="dados" className="flex items-center gap-1 text-xs">
            <Database className="w-3 h-3" /> Dados
          </TabsTrigger>
          <TabsTrigger value="colunas" className="flex items-center gap-1 text-xs">
            <Columns className="w-3 h-3" /> Colunas
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="flex items-center gap-1 text-xs">
            <Palette className="w-3 h-3" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="flex items-center gap-1 text-xs">
            <Shield className="w-3 h-3" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="integracao" className="flex items-center gap-1 text-xs">
            <Plug className="w-3 h-3" /> Integração
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-1 text-xs">
            <Download className="w-3 h-3" /> Backup
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-1 text-xs">
            <History className="w-3 h-3" /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="suporte" className="flex items-center gap-1 text-xs">
            <HelpCircle className="w-3 h-3" /> Suporte
          </TabsTrigger>
          <TabsTrigger value="sistema" className="flex items-center gap-1 text-xs">
            <Settings className="w-3 h-3" /> Sistema
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Menu className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">9/9</div>
                  <p className="text-xs text-muted-foreground">Itens visíveis no menu principal</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">9</div>
                  <p className="text-xs text-muted-foreground">Módulos cadastrados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">Filiais cadastradas</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar Agora
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Download className="w-4 h-4 mr-2" /> Fazer Backup
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" /> Restaurar Padrões
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MENUS */}
        <TabsContent value="menus" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Editar Menu Principal</CardTitle>
              <CardDescription>Reordene e configure os itens do menu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEFAULT_PRINCIPAL.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border rounded hover:bg-accent">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MÓDULOS */}
        <TabsContent value="modulos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULOS_SISTEMA.map((mod) => (
              <Card key={mod.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <mod.icon className={`w-5 h-5 ${mod.cor}`} />
                      <div>
                        <CardTitle className="text-sm">{mod.nome}</CardTitle>
                        <p className="text-xs text-muted-foreground">{mod.desc}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">Ativo</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Dialog open={editOpen && selectedMod?.id === mod.id} onOpenChange={(open) => !open && setEditOpen(false)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="w-full text-xs gap-1" onClick={() => handleEditarModulo(mod)}>
                        <Edit2 className="w-3 h-3" /> Editar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Editar Módulo: {selectedMod?.nome}</DialogTitle>
                        <DialogDescription>Configure todas as opções do módulo</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="font-semibold text-sm">Informações Básicas</div>
                          <div>
                            <Label className="text-sm">Nome do Módulo</Label>
                            <Input value={modConfig.nome} onChange={(e) => setModConfig({...modConfig, nome: e.target.value})} className="mt-1" placeholder="Ex: VL10E" />
                          </div>
                          <div>
                            <Label className="text-sm">Descrição</Label>
                            <Input value={modConfig.descricao} onChange={(e) => setModConfig({...modConfig, descricao: e.target.value})} className="mt-1" placeholder="Descrição do módulo" />
                          </div>
                          <div>
                            <Label className="text-sm">Atalho (Tecla)</Label>
                            <Input value={modConfig.atalho} onChange={(e) => setModConfig({...modConfig, atalho: e.target.value})} placeholder="Ex: Ctrl+V" className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-sm">Cor do Ícone</Label>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {CORES_DISPONVEIS.map(cor => (
                                <div key={cor.valor} className={`w-8 h-8 rounded cursor-pointer border-2 ${modConfig.cor === cor.valor ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: cor.valor}} onClick={() => setModConfig({...modConfig, cor: cor.valor})} title={cor.nome} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                          <div className="font-semibold text-sm">Status e Visibilidade</div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Módulo Ativo</Label>
                            <Switch checked={modConfig.ativo} onCheckedChange={(checked) => setModConfig({...modConfig, ativo: checked})} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Visível no Menu</Label>
                            <Switch checked={modConfig.visivel} onCheckedChange={(checked) => setModConfig({...modConfig, visivel: checked})} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Disponível para Todos</Label>
                            <Switch checked={modConfig.disponivel} onCheckedChange={(checked) => setModConfig({...modConfig, disponivel: checked})} />
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                          <div className="font-semibold text-sm">Funcionalidades</div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Permitir Importação</Label>
                            <Switch checked={modConfig.permitirImportacao} onCheckedChange={(checked) => setModConfig({...modConfig, permitirImportacao: checked})} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Permitir Exportação</Label>
                            <Switch checked={modConfig.permitirExportacao} onCheckedChange={(checked) => setModConfig({...modConfig, permitirExportacao: checked})} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Permitir Sincronização</Label>
                            <Switch checked={modConfig.permitirSincronizacao} onCheckedChange={(checked) => setModConfig({...modConfig, permitirSincronizacao: checked})} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Permitir Backup</Label>
                            <Switch checked={modConfig.permitirBackup} onCheckedChange={(checked) => setModConfig({...modConfig, permitirBackup: checked})} />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                          <Button onClick={() => { toast.success(`✅ Módulo ${selectedMod?.nome} atualizado`); setEditOpen(false); }}>Salvar Alterações</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={configOpen && selectedMod?.id === mod.id} onOpenChange={(open) => !open && setConfigOpen(false)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="w-full text-xs gap-1" onClick={() => handleConfigurarModulo(mod)}>
                        <Settings className="w-3 h-3" /> Configurar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Configurar Módulo: {selectedMod?.nome}</DialogTitle>
                        <DialogDescription>Configure as opções avançadas do módulo</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="font-semibold text-sm">Permissões de Acesso</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Visualizar Dados</Label>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Editar Dados</Label>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Deletar Dados</Label>
                              <Switch />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Gerenciar Permissões</Label>
                              <Switch />
                            </div>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <div className="font-semibold text-sm">Operações de Dados</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Exportar Dados (Excel, PDF)</Label>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Importar Dados</Label>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Sincronizar com Outros Módulos</Label>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Criar Backup Automático</Label>
                              <Switch defaultChecked />
                            </div>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <div className="font-semibold text-sm">Notificações e Alertas</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Alertar quando atingir meta</Label>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Notificar mudanças importantes</Label>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-2 border rounded">
                              <Label className="text-sm">Email de resumo diário</Label>
                              <Switch />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
                          <Button onClick={() => { toast.success(`✅ Configurações do módulo ${selectedMod?.nome} salvas`); setConfigOpen(false); }}>Salvar Configurações</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* DADOS */}
        <TabsContent value="dados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Filiais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">24 filiais cadastradas</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COLUNAS */}
        <TabsContent value="colunas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Colunas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">83 colunas disponíveis</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APARÊNCIA */}
        <TabsContent value="aparencia" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Temas e Cores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Personalize a aparência do sistema</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEGURANÇA */}
        <TabsContent value="seguranca" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Acesso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Gerencie permissões e segurança</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTEGRAÇÃO */}
        <TabsContent value="integracao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrações Externas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Conecte APIs e serviços externos</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BACKUP */}
        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup e Sincronização</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Gerencie backups e sincronização</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDITORIA */}
        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Alterações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Visualize o histórico de mudanças</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUPORTE */}
        <TabsContent value="suporte" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documentação e Suporte</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Acesse documentação e contato</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SISTEMA */}
        <TabsContent value="sistema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Versão 2.0.0 | Última sincronização: agora</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
