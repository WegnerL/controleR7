import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EditableCell } from "@/components/EditableCell";
import {
  Building2, Plus, Trash2, Search, Users, Info,
  Target, TrendingDown, DollarSign, RefreshCw, Upload
} from "lucide-react";

const ANOS = [2026];

function fmt(v: number | null | undefined, decimals = 2) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  // Exibe o valor exatamente como armazenado, incluindo sinal negativo
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  return `R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseNum(s: string): number | null {
  const cleaned = s.replace(/[R$\s%]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

const META_STORAGE_KEY = "dados_meta_pct_media";

function loadMetaMedia(): string {
  try { return localStorage.getItem(META_STORAGE_KEY) ?? ""; } catch { return ""; }
}

export default function Dados() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newFilial, setNewFilial] = useState({ codigo: "", gerente: "", coordenador: "" });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [ano, setAno] = useState(2026);
  const [metaMediaCustom, setMetaMediaCustom] = useState<string>(loadMetaMedia);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function saveMetaMedia(val: string) {
    const trimmed = val.trim();
    setMetaMediaCustom(trimmed);
    try { localStorage.setItem(META_STORAGE_KEY, trimmed); } catch {}
    setEditingMeta(false);
  }

  // Busca filiais com dados de perda integrados (fonte única: tabela perdas)
  const { data: filiaisComPerdas = [], isLoading: filiaisLoading } = trpc.filiais.listWithPerdas.useQuery({ ano });
  const { data: faturamentos = [], isLoading: fatLoading } = trpc.faturamentos.list.useQuery({ ano });
  const isLoading = filiaisLoading || fatLoading;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Erro ao processar arquivo");
      const preview = await response.json();

      const executeResponse = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "dados", data: preview.data }),
      });
      if (!executeResponse.ok) throw new Error("Erro ao importar");

      toast.success("Dados importados com sucesso!");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na importação");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const invalidateAll = () => {
    utils.filiais.list.invalidate();
    utils.filiais.listWithPerdas.invalidate();
    utils.perdas.list.invalidate();
  };

  const createMut = trpc.filiais.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Filial adicionada!");
      setShowAdd(false);
      setNewFilial({ codigo: "", gerente: "", coordenador: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateFilialMut = trpc.filiais.update.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  // Mutation que grava na tabela perdas e invalida perdas + filiais
  const updatePerdaMut = trpc.filiais.updatePerdaFilial.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Dados de perda atualizados!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.filiais.delete.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Filial removida!"); setDeletingId(null); },
    onError: (e) => toast.error(e.message),
  });

  // Calcula perdaPct no frontend (Total Perdas / Total Faturamento * 100)
  const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const faturamentoMap = new Map<number, number>();
  (faturamentos || []).forEach((f: any) => {
    const total = MONTHS.reduce((s, m) => s + (Number((f as any)[m]) || 0), 0);
    if (total > 0) faturamentoMap.set(f.filial, total);
  });
  
  const filiaisComPerdasCalculado = useMemo(() => (filiaisComPerdas || []).map((f: any) => {
    const perda = f.perda;
    if (!perda) return f;
    
    const fatTotal = faturamentoMap.get(f.codigo);
    const totalPerdas = (perda as any).total || 0;
    const calculatedPerdaPct = fatTotal && fatTotal > 0 ? (totalPerdas / fatTotal) * 100 : 0;
    
    return {
      ...f,
      perda: {
        ...perda,
        perdaPct: calculatedPerdaPct,
      },
    };
  }), [filiaisComPerdas, faturamentoMap]);

  const filtered = useMemo(() =>
    (filiaisComPerdasCalculado || []).filter(f =>
      String(f.codigo).includes(search) ||
      f.gerente.toLowerCase().includes(search.toLowerCase()) ||
      f.coordenador.toLowerCase().includes(search.toLowerCase())
    ), [filiaisComPerdasCalculado, search]);

  // KPIs de resumo
  const kpis = useMemo(() => {
    const rows = filiaisComPerdasCalculado || [];
    const comPerda = rows.filter(f => f.perda?.perdaPct != null);
    const avgPerdaPct = comPerda.length > 0
      ? comPerda.reduce((s, f) => s + Math.abs(f.perda!.perdaPct ?? 0), 0) / comPerda.length
      : null;
    const totalPerdaNo = rows.reduce((s, f) => s + Math.abs(f.perda?.perdaNo ?? 0), 0);
    const avgMetaPct = comPerda.length > 0
      ? comPerda.reduce((s, f) => s + Math.abs(f.perda!.metaPerdaPct ?? 0), 0) / comPerda.length
      : null;
    // Nota: valores são armazenados como digitados (ex: 0.50 = 0,50%)
    return { avgPerdaPct, totalPerdaNo, avgMetaPct, total: rows.length };
  }, [filiaisComPerdasCalculado]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dados das Filiais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerentes, coordenadores e indicadores de perda por filial
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {ANOS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={() => setShowAdd(true)} size="sm" className="gap-2 bg-cyan-600 hover:bg-cyan-500">
            <Plus className="w-4 h-4" /> Nova Filial
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Filiais</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border cursor-pointer group" onClick={() => { if (!editingMeta) { setMetaInput(metaMediaCustom || (kpis.avgMetaPct != null ? kpis.avgMetaPct.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "")); setEditingMeta(true); } }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Meta % Média</span>
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity ml-auto">✏️</span>
            </div>
            {editingMeta ? (
              <input
                autoFocus
                type="text"
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onBlur={() => saveMetaMedia(metaInput)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveMetaMedia(metaInput);
                  if (e.key === "Escape") setEditingMeta(false);
                }}
                onClick={e => e.stopPropagation()}
                className="w-full bg-transparent border-b border-green-400 text-2xl font-bold text-green-400 outline-none pb-0.5"
                placeholder="0,00"
              />
            ) : (
              <p className="text-2xl font-bold text-green-400">
                {metaMediaCustom ? `${metaMediaCustom}%` : (kpis.avgMetaPct != null ? `${kpis.avgMetaPct.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%` : '—')}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">% Perda Média</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{kpis.avgPerdaPct != null ? `${kpis.avgPerdaPct.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%` : '—'}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Perda</span>
            </div>
            <p className="text-xl font-bold text-orange-400">{fmtBRL(kpis.totalPerdaNo)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Filiais Cadastradas</CardTitle>
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar filial, gerente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-56 bg-input border-border"
              />
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImport}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {importing ? "Importando..." : "Importar"}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAdd(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Nova Filial
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Cód.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gerente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coordenador</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-green-400 uppercase tracking-wider w-28">
                    <div className="flex items-center justify-center gap-1">
                      <Target className="w-3 h-3" /> Meta %
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-red-400 uppercase tracking-wider w-28">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingDown className="w-3 h-3" /> % Perda
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-orange-400 uppercase tracking-wider w-36">
                    <div className="flex items-center justify-center gap-1">
                      <DollarSign className="w-3 h-3" /> Perda (R$)
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                      Nenhuma filial encontrada
                    </td>
                  </tr>
                ) : filtered.map((f, i) => {
                  const perda = f.perda;
                  // Perda acima da meta = abs(perdaPct) > abs(metaPerdaPct)
                  const abaixoMeta = perda?.perdaPct != null && perda?.metaPerdaPct != null
                    ? Math.abs(perda.perdaPct) > Math.abs(perda.metaPerdaPct)
                    : null;

                  return (
                    <tr
                      key={f.id}
                      className={`border-b border-border/50 hover:bg-accent/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      {/* Código — edita tabela filiais */}
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={String(f.codigo)}
                          onSave={v => {
                            const newCodigo = parseInt(v, 10);
                            if (isNaN(newCodigo)) {
                              toast.error("Código deve ser numérico");
                              return;
                            }
                            updateFilialMut.mutate({ id: f.id, codigo: newCodigo });
                          }}
                          className="font-mono font-bold text-cyan-400 text-sm"
                        />
                      </td>

                      {/* Gerente — edita tabela filiais */}
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={f.gerente}
                          onSave={v => updateFilialMut.mutate({ id: f.id, gerente: v })}
                          className="font-medium"
                        />
                      </td>

                      {/* Coordenador — edita tabela filiais */}
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={f.coordenador}
                          onSave={v => updateFilialMut.mutate({ id: f.id, coordenador: v })}
                        />
                      </td>

                      {/* Meta % — edita tabela perdas */}
                      <td className="px-4 py-2.5 text-center">
                        <EditableCell
                          value={perda?.metaPerdaPct != null ? String(perda.metaPerdaPct) : ""}
                          placeholder="0,00"
                          onSave={v => {
                            // Grava exatamente o número digitado (ex: 0.50 = 0,50%)
                            const n = parseNum(v);
                            updatePerdaMut.mutate({
                              filialCodigo: f.codigo,
                              gerente: f.gerente,
                              coordenador: f.coordenador,
                              ano,
                              metaPerdaPct: n,
                              perdaPct: perda?.perdaPct ?? null,
                              perdaNo: perda?.perdaNo ?? null,
                            });
                          }}
                          className={`font-semibold text-center ${
                            perda?.metaPerdaPct != null && perda.metaPerdaPct < 0 ? "text-red-400" : "text-green-400"
                          }`}
                          displayValue={fmtPct(perda?.metaPerdaPct)}
                        />
                      </td>

                      {/* % Perda Real — read-only, sincronizado com Perdas */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={`flex items-center justify-center gap-1 font-semibold ${
                          perda?.perdaPct != null && perda.perdaPct < 0 ? "text-red-400" :
                          abaixoMeta === true ? "text-red-400" :
                          abaixoMeta === false ? "text-green-400" :
                          "text-foreground"
                        }`}
                        title="Calculado automaticamente em Perdas: Total Perdas ÷ Total Faturamento">
                          {fmtPct(perda?.perdaPct)}
                          {abaixoMeta === true && <span className="text-xs">▲</span>}
                          {abaixoMeta === false && <span className="text-xs">▼</span>}
                        </span>
                      </td>

                      {/* Perda R$ — edita tabela perdas */}
                      <td className="px-4 py-2.5 text-center">
                        <EditableCell
                          value={perda?.perdaNo != null ? String(perda.perdaNo) : ""}
                          placeholder="0,00"
                          onSave={v => {
                            const n = parseNum(v);
                            updatePerdaMut.mutate({
                              filialCodigo: f.codigo,
                              gerente: f.gerente,
                              coordenador: f.coordenador,
                              ano,
                              metaPerdaPct: perda?.metaPerdaPct ?? null,
                              perdaPct: perda?.perdaPct ?? null,
                              perdaNo: n,
                            });
                          }}
                          className="text-orange-400 font-semibold text-center"
                          displayValue={fmtBRL(perda?.perdaNo)}
                        />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5 text-center">
                        <Badge
                          variant={f.ativo ? "default" : "secondary"}
                          className={`text-xs ${f.ativo ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}`}
                        >
                          {f.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost" size="icon"
                          className="w-7 h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingId(f.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <span>
              Clique em qualquer célula para editar diretamente. As colunas{" "}
              <strong className="text-green-400">Meta %</strong>,{" "}
              <strong className="text-red-400">% Perda</strong> e{" "}
              <strong className="text-orange-400">Perda (R$)</strong>{" "}
              são sincronizadas automaticamente com o módulo de <strong className="text-foreground">Perdas</strong> e o <strong className="text-foreground">Dashboard</strong>.
              Qualquer alteração aqui reflete imediatamente nos outros módulos.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Nova Filial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Código da Filial</Label>
              <Input
                type="number"
                placeholder="Ex: 200"
                value={newFilial.codigo}
                onChange={e => setNewFilial(p => ({ ...p, codigo: e.target.value }))}
                className="mt-1 bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Gerente</Label>
              <Input
                placeholder="Nome do gerente"
                value={newFilial.gerente}
                onChange={e => setNewFilial(p => ({ ...p, gerente: e.target.value }))}
                className="mt-1 bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Coordenador</Label>
              <Input
                placeholder="Nome do coordenador"
                value={newFilial.coordenador}
                onChange={e => setNewFilial(p => ({ ...p, coordenador: e.target.value }))}
                className="mt-1 bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button
              onClick={() => createMut.mutate({
                codigo: Number(newFilial.codigo),
                gerente: newFilial.gerente,
                coordenador: newFilial.coordenador,
              })}
              disabled={!newFilial.codigo || createMut.isPending}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              {createMut.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover esta filial? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMut.mutate({ id: deletingId })}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
