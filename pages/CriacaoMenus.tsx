import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  PlusSquare, Trash2, Edit, Eye, LayoutGrid, BarChart3,
  Table, Plus, Download, Upload, Copy
} from "lucide-react";
import { FileUploadAnalyzer } from "@/components/FileUploadAnalyzer";
import { MenuPreviewFromFile } from "@/components/MenuPreviewFromFile";
import { AnalyzedFile } from "@/hooks/useFileAnalyzer";

const ICON_OPTIONS = [
  "LayoutGrid", "BarChart3", "Table", "TrendingUp", "Package",
  "Building2", "AlertTriangle", "DollarSign", "Users", "Settings",
];

const TEMPLATE_EXAMPLES = [
  {
    nome: "Relatório Mensal",
    icone: "BarChart3",
    descricao: "Template com gráfico de barras e tabela mensal",
    estrutura: {
      tipo: "misto",
      colunas: [
        { chave: "filial", label: "Filial", tipo: "texto" },
        { chave: "gerente", label: "Gerente", tipo: "texto" },
        { chave: "janeiro", label: "Janeiro", tipo: "numero" },
        { chave: "fevereiro", label: "Fevereiro", tipo: "numero" },
        { chave: "total", label: "Total", tipo: "numero" },
      ],
      graficos: [
        { tipo: "barras", titulo: "Comparativo Mensal", eixoX: "filial", eixoY: ["janeiro", "fevereiro"] },
      ],
    },
    dados: [],
  },
  {
    nome: "Ranking de Filiais",
    icone: "TrendingUp",
    descricao: "Template com ranking e gráfico de pizza",
    estrutura: {
      tipo: "misto",
      colunas: [
        { chave: "posicao", label: "#", tipo: "numero" },
        { chave: "filial", label: "Filial", tipo: "texto" },
        { chave: "valor", label: "Valor", tipo: "moeda" },
        { chave: "percentual", label: "%", tipo: "percentual" },
      ],
      graficos: [
        { tipo: "pizza", titulo: "Distribuição", eixoX: "filial", eixoY: ["valor"] },
      ],
    },
    dados: [],
  },
  {
    nome: "Tabela Simples",
    icone: "Table",
    descricao: "Template de tabela editável básica",
    estrutura: {
      tipo: "tabela",
      colunas: [
        { chave: "col1", label: "Coluna 1", tipo: "texto" },
        { chave: "col2", label: "Coluna 2", tipo: "texto" },
        { chave: "col3", label: "Coluna 3", tipo: "numero" },
      ],
      graficos: [],
    },
    dados: [],
  },
];

interface Coluna {
  chave: string;
  label: string;
  tipo: "texto" | "numero" | "moeda" | "percentual";
}

interface Grafico {
  tipo: "barras" | "linhas" | "pizza";
  titulo: string;
  eixoX: string;
  eixoY: string[];
}

interface Estrutura {
  tipo: "tabela" | "grafico" | "misto";
  colunas: Coluna[];
  graficos: Grafico[];
}

export default function CriacaoMenus() {
  const utils = trpc.useUtils();
  const { data: menus, isLoading } = trpc.menus.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [importedFile, setImportedFile] = useState<AnalyzedFile | null>(null);
  const [importMenuName, setImportMenuName] = useState("");
  const [importMenuDesc, setImportMenuDesc] = useState("");

  const [form, setForm] = useState({
    nome: "",
    icone: "LayoutGrid",
    descricao: "",
    estrutura: {
      tipo: "misto" as "tabela" | "grafico" | "misto",
      colunas: [
        { chave: "filial", label: "Filial", tipo: "texto" as const },
        { chave: "valor", label: "Valor", tipo: "numero" as const },
      ] as Coluna[],
      graficos: [] as Grafico[],
    } as Estrutura,
  });

  const createMut = trpc.menus.create.useMutation({
    onSuccess: () => {
      utils.menus.list.invalidate();
      toast.success("Menu criado com sucesso!");
      setShowCreate(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.menus.delete.useMutation({
    onSuccess: () => {
      utils.menus.list.invalidate();
      toast.success("Menu removido!");
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({
      nome: "",
      icone: "LayoutGrid",
      descricao: "",
      estrutura: {
        tipo: "misto",
        colunas: [
          { chave: "filial", label: "Filial", tipo: "texto" },
          { chave: "valor", label: "Valor", tipo: "numero" },
        ],
        graficos: [],
      },
    });
  }

  function addColuna() {
    setForm(p => ({
      ...p,
      estrutura: {
        ...p.estrutura,
        colunas: [...p.estrutura.colunas, { chave: `col${p.estrutura.colunas.length + 1}`, label: `Coluna ${p.estrutura.colunas.length + 1}`, tipo: "texto" }],
      },
    }));
  }

  function removeColuna(i: number) {
    setForm(p => ({
      ...p,
      estrutura: { ...p.estrutura, colunas: p.estrutura.colunas.filter((_, idx) => idx !== i) },
    }));
  }

  function updateColuna(i: number, field: keyof Coluna, value: string) {
    setForm(p => ({
      ...p,
      estrutura: {
        ...p.estrutura,
        colunas: p.estrutura.colunas.map((c, idx) => idx === i ? { ...c, [field]: value } : c),
      },
    }));
  }

  function addGrafico() {
    setForm(p => ({
      ...p,
      estrutura: {
        ...p.estrutura,
        graficos: [...p.estrutura.graficos, { tipo: "barras", titulo: "Novo Gráfico", eixoX: "filial", eixoY: ["valor"] }],
      },
    }));
  }

  function removeGrafico(i: number) {
    setForm(p => ({
      ...p,
      estrutura: { ...p.estrutura, graficos: p.estrutura.graficos.filter((_, idx) => idx !== i) },
    }));
  }

  function applyTemplate(t: typeof TEMPLATE_EXAMPLES[0]) {
    setForm(p => ({
      ...p,
      nome: p.nome || t.nome,
      icone: t.icone,
      descricao: p.descricao || t.descricao,
      estrutura: t.estrutura as Estrutura,
    }));
    setShowTemplate(false);
    toast.success("Template aplicado!");
  }

  function handleCreate() {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    createMut.mutate({
      nome: form.nome,
      icone: form.icone,
      descricao: form.descricao,
      estrutura: form.estrutura,
      dados: [],
    });
  }

  function handleFileAnalyzed(analyzed: AnalyzedFile, menuName: string, menuDesc: string) {
    setImportedFile(analyzed);
    setImportMenuName(menuName);
    setImportMenuDesc(menuDesc);
  }

  function handleCreateFromFile() {
    if (!importedFile || !importMenuName.trim()) {
      toast.error("Preencha o nome do menu");
      return;
    }

    const colunas = importedFile.columns.map((col) => ({
      chave: col.name.toLowerCase().replace(/\s+/g, "_"),
      label: col.name,
      tipo: col.type as "texto" | "numero" | "moeda" | "percentual",
    }));

    const numericCols = importedFile.columns
      .filter(c => c.type === "numero" || c.type === "moeda")
      .map(c => c.name.toLowerCase().replace(/\s+/g, "_"));

    const textCols = importedFile.columns
      .filter(c => c.type === "texto")
      .map(c => c.name.toLowerCase().replace(/\s+/g, "_"));

    const graficos = numericCols.length > 0 && textCols.length > 0 ? [
      {
        tipo: "barras" as const,
        titulo: `Comparativo por ${importedFile.columns[0].name}`,
        eixoX: textCols[0],
        eixoY: numericCols.slice(0, 2),
      },
    ] : [];

    createMut.mutate({
      nome: importMenuName,
      icone: "BarChart3",
      descricao: importMenuDesc,
      estrutura: {
        tipo: graficos.length > 0 ? "misto" : "tabela",
        colunas,
        graficos,
      },
      dados: importedFile.allData,
    });

    setShowImport(false);
    setImportedFile(null);
    setImportMenuName("");
    setImportMenuDesc("");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Criação de Menus</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Crie menus personalizados com tabelas e gráficos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2 h-8 text-xs border-border">
            <Download className="w-3.5 h-3.5" /> Importar Arquivo
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowTemplate(true); setShowCreate(true); }} className="gap-2 h-8 text-xs border-border">
            <Upload className="w-3.5 h-3.5" /> Usar Template
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Novo Menu
          </Button>
        </div>
      </div>

      {/* Menus list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground">Carregando menus...</div>
        ) : !menus || menus.length === 0 ? (
          <div className="col-span-3">
            <Card className="bg-card border-border border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <PlusSquare className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Nenhum menu criado</p>
                  <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro menu personalizado</p>
                </div>
                <Button onClick={() => setShowCreate(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Criar Menu
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : menus.map(menu => {
          const estrutura = menu.estrutura as Estrutura;
          return (
            <Card key={menu.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{menu.nome}</CardTitle>
                      {menu.descricao && <CardDescription className="text-xs mt-0.5">{menu.descricao}</CardDescription>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingId(menu.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Table className="w-3 h-3" /> {estrutura?.colunas?.length || 0} colunas
                  </Badge>
                  {estrutura?.graficos?.length > 0 && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <BarChart3 className="w-3 h-3" /> {estrutura.graficos.length} gráfico{estrutura.graficos.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs capitalize">{estrutura?.tipo || "misto"}</Badge>
                </div>
                <Link href={`/menus/${menu.id}`}>
                  <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs border-border">
                    <Eye className="w-3.5 h-3.5" /> Abrir Menu
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Template selector dialog */}
      <Dialog open={showTemplate} onOpenChange={setShowTemplate}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar Template</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            {TEMPLATE_EXAMPLES.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/20 transition-colors cursor-pointer"
                onClick={() => applyTemplate(t)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">{t.descricao}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-xs">{t.estrutura.colunas.length} colunas</Badge>
                  {t.estrutura.graficos.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{t.estrutura.graficos.length} gráfico</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplate(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create menu dialog */}
      <Dialog open={showCreate && !showTemplate} onOpenChange={v => { setShowCreate(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Nome do Menu *</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Relatório Semanal" className="mt-1 bg-input border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ícone</Label>
                <Select value={form.icone} onValueChange={v => setForm(p => ({ ...p, icone: v }))}>
                  <SelectTrigger className="mt-1 bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic} className="text-xs">{ic}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Descrição do menu..." className="mt-1 bg-input border-border resize-none" rows={2} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de Visualização</Label>
              <Select value={form.estrutura.tipo} onValueChange={v => setForm(p => ({ ...p, estrutura: { ...p.estrutura, tipo: v as any } }))}>
                <SelectTrigger className="mt-1 bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="tabela">Apenas Tabela</SelectItem>
                  <SelectItem value="grafico">Apenas Gráfico</SelectItem>
                  <SelectItem value="misto">Tabela + Gráfico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Colunas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold text-foreground">Colunas da Tabela</Label>
                <Button variant="outline" size="sm" onClick={addColuna} className="gap-1.5 h-7 text-xs border-border">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.estrutura.colunas.map((col, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/50">
                    <Input value={col.chave} onChange={e => updateColuna(i, "chave", e.target.value)}
                      placeholder="chave" className="h-7 text-xs bg-input border-border font-mono w-28" />
                    <Input value={col.label} onChange={e => updateColuna(i, "label", e.target.value)}
                      placeholder="Rótulo" className="h-7 text-xs bg-input border-border flex-1" />
                    <Select value={col.tipo} onValueChange={v => updateColuna(i, "tipo", v)}>
                      <SelectTrigger className="h-7 text-xs bg-input border-border w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="texto" className="text-xs">Texto</SelectItem>
                        <SelectItem value="numero" className="text-xs">Número</SelectItem>
                        <SelectItem value="moeda" className="text-xs">Moeda</SelectItem>
                        <SelectItem value="percentual" className="text-xs">Percentual</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10"
                      onClick={() => removeColuna(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráficos */}
            {(form.estrutura.tipo === "grafico" || form.estrutura.tipo === "misto") && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold text-foreground">Gráficos</Label>
                    <Button variant="outline" size="sm" onClick={addGrafico} className="gap-1.5 h-7 text-xs border-border">
                      <Plus className="w-3 h-3" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.estrutura.graficos.map((g, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <Select value={g.tipo} onValueChange={v => {
                            const graficos = [...form.estrutura.graficos];
                            graficos[i] = { ...graficos[i], tipo: v as any };
                            setForm(p => ({ ...p, estrutura: { ...p.estrutura, graficos } }));
                          }}>
                            <SelectTrigger className="h-7 text-xs bg-input border-border w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              <SelectItem value="barras" className="text-xs">Barras</SelectItem>
                              <SelectItem value="linhas" className="text-xs">Linhas</SelectItem>
                              <SelectItem value="pizza" className="text-xs">Pizza</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input value={g.titulo} onChange={e => {
                            const graficos = [...form.estrutura.graficos];
                            graficos[i] = { ...graficos[i], titulo: e.target.value };
                            setForm(p => ({ ...p, estrutura: { ...p.estrutura, graficos } }));
                          }} placeholder="Título do gráfico" className="h-7 text-xs bg-input border-border flex-1" />
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10"
                            onClick={() => removeGrafico(i)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Eixo X (chave da coluna)</p>
                            <Input value={g.eixoX} onChange={e => {
                              const graficos = [...form.estrutura.graficos];
                              graficos[i] = { ...graficos[i], eixoX: e.target.value };
                              setForm(p => ({ ...p, estrutura: { ...p.estrutura, graficos } }));
                            }} placeholder="filial" className="h-7 text-xs bg-input border-border" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Eixo Y (chaves separadas por vírgula)</p>
                            <Input value={g.eixoY.join(",")} onChange={e => {
                              const graficos = [...form.estrutura.graficos];
                              graficos[i] = { ...graficos[i], eixoY: e.target.value.split(",").map(s => s.trim()) };
                              setForm(p => ({ ...p, estrutura: { ...p.estrutura, graficos } }));
                            }} placeholder="valor,total" className="h-7 text-xs bg-input border-border" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplate(true)} className="gap-2 text-xs">
              <Copy className="w-3.5 h-3.5" /> Usar Template
            </Button>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Criando..." : "Criar Menu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import file dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Arquivo para Criar Menu</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {!importedFile ? (
              <FileUploadAnalyzer onAnalyzed={handleFileAnalyzed} />
            ) : (
              <div className="space-y-4">
                <MenuPreviewFromFile
                  analyzed={importedFile}
                  menuName={importMenuName}
                  menuDescription={importMenuDesc}
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportedFile(null);
                      setImportMenuName("");
                      setImportMenuDesc("");
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={handleCreateFromFile}
                    disabled={createMut.isPending}
                    className="gap-2"
                  >
                    {createMut.isPending ? "Criando..." : "Criar Menu com estes Dados"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja remover este menu personalizado?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletingId && deleteMut.mutate({ id: deletingId })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
