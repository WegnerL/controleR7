import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exportToExcel, formatCurrency, MONTHS } from "@/lib/excel";
import { useOfflineSyncContext } from "@/contexts/OfflineSyncContext";
import { offlineDb } from "@/lib/offlineDb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditableCell } from "@/components/EditableCell";
import { FileText, Download, Plus, Search, Trash2, TrendingUp, Building2, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const ANOS = [2026];

const DIAS = [
  { key: "dia20", label: "20" },
  { key: "dia21", label: "21" },
  { key: "dia22", label: "22" },
  { key: "dia23", label: "23" },
  { key: "dia24", label: "24" },
  { key: "dia25", label: "25" },
  { key: "dia26", label: "26" },
  { key: "dia27", label: "27" },
  { key: "dia28", label: "28" },
  { key: "dia29", label: "29" },
  { key: "dia30", label: "30" },
  { key: "dia31", label: "31" },
] as const;

const DIA_KEYS_FE = DIAS.map(d => d.key) as string[];

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(1) + "%";
}

function cellColor(val: number | null | undefined) {
  if (val == null) return "";
  if (val > 0) return "text-emerald-400";
  if (val < 0) return "text-red-400";
  return "";
}

function pctColor(val: number | null | undefined) {
  if (val == null || !isFinite(val)) return "text-muted-foreground";
  if (val >= 100) return "text-emerald-400";
  if (val >= 80) return "text-amber-400";
  return "text-red-400";
}

export default function Fechamentos() {
  const utils = trpc.useUtils();
  const [ano, setAno] = useState(2026);
  const [mes, setMes] = useState(1);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newRow, setNewRow] = useState({ filial: "", gerente: "", desafio: "" });

  const { data, isLoading } = trpc.fechamentos.list.useQuery({ ano, mes });
  const { data: vl10eData } = trpc.vl10e.list.useQuery();

  // Sincronizar Fechamentos quando VL10E muda
  useEffect(() => {
    if (vl10eData && vl10eData.length > 0) {
      utils.fechamentos.list.invalidate();
    }
  }, [vl10eData, utils]);

  const updateMut = trpc.fechamentos.update.useMutation({
    onMutate: async (vars) => {
      await utils.fechamentos.list.cancel();
      const prev = utils.fechamentos.list.getData({ ano, mes });
      const hasDia = DIA_KEYS_FE.some(k => k in vars);
      if (prev && hasDia) {
        utils.fechamentos.list.setData({ ano, mes }, prev.map(row => {
          if (row.id !== vars.id) return row;
          const updated = { ...row, ...vars };
          const newTotal = DIA_KEYS_FE.reduce((s, k) => s + (Number((updated as any)[k]) || 0), 0);
          return { ...updated, total: newTotal };
        }));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.fechamentos.list.setData({ ano, mes }, ctx.prev);
      toast.error("Erro ao atualizar");
    },
    onSuccess: () => {
      utils.fechamentos.list.invalidate();
      utils.faturamentos.list.invalidate();
      utils.perdas.list.invalidate();
      utils.vl10e.list.invalidate();
      toast.success("Atualizado!");
    },
  });

  const upsertMut = trpc.fechamentos.upsert.useMutation({
    onSuccess: () => {
      utils.fechamentos.list.invalidate();
      toast.success("Filial adicionada!");
      setShowAdd(false);
      setNewRow({ filial: "", gerente: "", desafio: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.fechamentos.delete.useMutation({
    onSuccess: () => {
      utils.fechamentos.list.invalidate();
      toast.success("Removido!");
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => (data || []).filter(r =>
    String(r.filial).includes(search) ||
    r.gerente.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    DIAS.forEach(d => {
      totals[d.key] = filtered.reduce((sum, r) => sum + ((r as any)[d.key] || 0), 0);
    });
    totals.total = filtered.reduce((sum, r) => sum + (r.total || 0), 0);
    totals.desafio = filtered.reduce((sum, r) => sum + ((r as any).desafio || 0), 0);
    return totals;
  }, [filtered]);

  const kpis = useMemo(() => {
    const totalGeral = filtered.reduce((s, r) => s + (r.total || 0), 0);
    const totalDesafio = filtered.reduce((s, r) => s + ((r as any).desafio || 0), 0);
    const pctRealizado = totalDesafio > 0 ? (totalGeral / totalDesafio) * 100 : null;
    const mediaFilial = filtered.length > 0 ? totalGeral / filtered.length : 0;
    const melhorDia = DIAS.reduce((best, d) => {
      const val = columnTotals[d.key] || 0;
      return val > (columnTotals[best.key] || 0) ? d : best;
    }, DIAS[0]);
    const positivas = filtered.filter(r => (r.total || 0) > 0).length;
    return { totalGeral, totalDesafio, pctRealizado, mediaFilial, melhorDia, positivas };
  }, [filtered, columnTotals]);

  function handleExport() {
    const rows = filtered.map(r => {
      const desafio = (r as any).desafio as number | null;
      const pct = desafio && desafio > 0 ? ((r.total || 0) / desafio) * 100 : null;
      const obj: Record<string, any> = {
        Filial: r.filial,
        Gerente: r.gerente,
        "Desafio R$": desafio,
        Ano: r.ano,
        Mês: MONTHS[r.mes - 1]?.label ?? r.mes,
      };
      DIAS.forEach(d => { obj[`Dia ${d.label}`] = (r as any)[d.key]; });
      obj["Total"] = r.total;
      obj["VL10E"] = (r as any).vl10e || 0;
      obj["% Realizado"] = pct != null ? pct.toFixed(1) + "%" : "—";
      return obj;
    });
    exportToExcel(rows, `Fechamentos_${ano}_M${String(mes).padStart(2, "0")}`, "Fechamentos");
    toast.success("Arquivo exportado!");
  }

  const { isOnline, enqueue } = useOfflineSyncContext();

  async function updateCell(id: number, field: string, value: string) {
    const numVal = value === "" ? null : Number(value);
    const payload = { id, [field]: numVal };
    if (isOnline) {
      updateMut.mutate(payload as any);
    } else {
      await offlineDb.fechamentos.update(id, { [field]: numVal, updatedAt: Date.now() });
      await enqueue("fechamentos", "update", id, payload);
      toast.info("Salvo localmente. Será sincronizado ao reconectar.", { duration: 2500, icon: "💾" });
    }
  }

  const mesAtual = MONTHS[mes - 1];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fechamentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controle de fechamento mensal — dias 20 a 31</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
            <SelectTrigger className="w-36 h-8 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {MONTHS.map((m, i) => (
                <SelectItem key={m.key} value={String(i + 1)} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {ANOS.map(a => <SelectItem key={a} value={String(a)} className="text-xs">{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 h-8 text-xs border-border">
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Nova Filial
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Período</p>
            </div>
            <p className={cn("text-xl font-bold", kpis.totalGeral >= 0 ? "text-emerald-400" : "text-red-400")}>
              {fmtBRL(kpis.totalGeral)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Desafio Total</p>
            </div>
            <p className="text-xl font-bold text-amber-400">{fmtBRL(kpis.totalDesafio || null)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">% Realizado</p>
            </div>
            <p className={cn("text-xl font-bold", pctColor(kpis.pctRealizado))}>
              {fmtPct(kpis.pctRealizado)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Filiais Positivas</p>
            </div>
            <p className="text-xl font-bold text-emerald-400">{kpis.positivas} / {filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Fechamento — {mesAtual?.label ?? mes}/{ano} (dias 20–31)
              </CardTitle>
              <Badge variant="secondary">{filtered.length} filiais</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar filial, gerente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-52 bg-input border-border"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16 sticky left-0 bg-muted/30">Filial</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-28">Gerente</th>
                  <th className="text-right px-3 py-3 font-semibold text-amber-400 uppercase tracking-wider w-28">Desafio R$</th>
                  <th className="text-right px-3 py-3 font-semibold text-orange-400 uppercase tracking-wider w-28">VL10E</th>
                  {DIAS.map(d => (
                    <th key={d.key} className="text-right px-2 py-3 font-semibold text-muted-foreground uppercase tracking-wider min-w-[72px]">
                      Dia {d.label}
                    </th>
                  ))}
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-28">Total</th>
                  <th className="text-right px-3 py-3 font-semibold text-blue-400 uppercase tracking-wider w-24">% Real.</th>
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={19} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="w-8 h-8 opacity-30" />
                        <p className="text-sm">Nenhum fechamento para {mesAtual?.label} / {ano}</p>
                        <p className="text-xs">Clique em "Nova Filial" para adicionar</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((r, i) => {
                  const desafio = (r as any).desafio as number | null;
                  const pct = desafio && desafio > 0 ? ((r.total || 0) / desafio) * 100 : null;
                  return (
                    <tr key={r.id} className={`border-b border-border/50 hover:bg-accent/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                      <td className="px-3 py-2 sticky left-0 bg-card">
                        <span className="font-mono font-bold text-primary">{r.filial}</span>
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell value={r.gerente} onSave={v => updateMut.mutate({ id: r.id, gerente: v })} />
                      </td>
                      {/* Desafio R$ — editável */}
                      <td className="px-3 py-2 text-right">
                        <EditableCell
                          value={desafio}
                          onSave={v => updateCell(r.id, "desafio", v)}
                          type="number"
                          formatter={v => v !== null && v !== undefined && v !== "" ? fmtBRL(Number(v)) : "—"}
                          className="text-right text-amber-400 font-semibold"
                        />
                      </td>
                      {/* VL10E — sincronizado com coluna Soma do VL10E (read-only) */}
                      <td className="px-3 py-2 text-right font-semibold text-orange-400">
                        <span className="text-right font-semibold text-orange-400">
                          {(r as any).vl10e !== null && (r as any).vl10e !== undefined && Number((r as any).vl10e) !== 0 ? fmtBRL(Number((r as any).vl10e)) : "—"}
                        </span>
                      </td>
                      {DIAS.map(d => {
                        const val = (r as any)[d.key] as number | null;
                        return (
                          <td key={d.key} className="px-2 py-2 text-right">
                            <EditableCell
                              value={val}
                              onSave={v => updateCell(r.id, d.key, v)}
                              type="number"
                              formatter={v => v !== null && v !== undefined && v !== "" ? fmtBRL(Number(v)) : "—"}
                              className={cn("text-right", cellColor(val))}
                            />
                          </td>
                        );
                      })}
                      {/* Total */}
                      <td className={cn("px-3 py-2 text-right font-semibold", cellColor(r.total))}>
                        <EditableCell
                          value={r.total}
                          onSave={v => updateMut.mutate({ id: r.id, total: v === "" ? null : Number(v) })}
                          type="number"
                          formatter={v => v !== null && v !== undefined && v !== "" ? fmtBRL(Number(v)) : "—"}
                          className={cn("text-right font-semibold", cellColor(r.total))}
                        />
                      </td>
                      {/* % Realizado — calculado automaticamente, somente leitura */}
                      <td className={cn("px-3 py-2 text-right font-semibold", pctColor(pct))}>
                        {fmtPct(pct)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingId(r.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-primary/30 bg-primary/5">
                    <td className="px-3 py-3 font-bold text-primary text-xs sticky left-0 bg-primary/5" colSpan={2}>TOTAL</td>
                    {/* Desafio total */}
                    <td className="px-3 py-3 text-right font-bold text-xs text-amber-400">
                      {fmtBRL(columnTotals.desafio || 0)}
                    </td>
                    {/* VL10E total */}
                    <td className="px-3 py-3 text-right font-bold text-xs text-orange-400">
                      {fmtBRL((filtered || []).reduce((s, r) => s + ((r as any).vl10e || 0), 0))}
                    </td>
                    {DIAS.map(d => (
                      <td key={d.key} className={cn("px-2 py-3 text-right font-semibold text-xs", cellColor(columnTotals[d.key]))}>
                        {fmtBRL(columnTotals[d.key] || 0)}
                      </td>
                    ))}
                    <td className={cn("px-3 py-3 text-right font-bold text-xs", cellColor(columnTotals.total))}>
                      {fmtBRL(columnTotals.total || 0)}
                    </td>
                    {/* % Realizado total */}
                    <td className={cn("px-3 py-3 text-right font-bold text-xs",
                      pctColor(columnTotals.desafio > 0 ? (columnTotals.total / columnTotals.desafio) * 100 : null))}>
                      {columnTotals.desafio > 0
                        ? fmtPct((columnTotals.total / columnTotals.desafio) * 100)
                        : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Nova Filial */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Nova Filial — Fechamento {mesAtual?.label}/{ano}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Código da Filial</Label>
              <Input type="number" placeholder="Ex: 200" value={newRow.filial}
                onChange={e => setNewRow(p => ({ ...p, filial: e.target.value }))}
                className="mt-1 bg-input border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Gerente</Label>
              <Input placeholder="Nome do gerente" value={newRow.gerente}
                onChange={e => setNewRow(p => ({ ...p, gerente: e.target.value }))}
                className="mt-1 bg-input border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Desafio R$ (opcional)</Label>
              <Input type="number" placeholder="Ex: 50000" value={newRow.desafio}
                onChange={e => setNewRow(p => ({ ...p, desafio: e.target.value }))}
                className="mt-1 bg-input border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!newRow.filial) { toast.error("Informe o código da filial"); return; }
              upsertMut.mutate({
                filial: Number(newRow.filial),
                gerente: newRow.gerente,
                coordenador: "",
                desafio: newRow.desafio ? Number(newRow.desafio) : undefined,
                ano,
                mes,
              });
            }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar exclusão */}
      <Dialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja remover este registro? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletingId && deleteMut.mutate({ id: deletingId })}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
