import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exportToExcel, MONTHS, formatCurrency, formatPercent } from "@/lib/excel";
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
import {AlertTriangle, Download, Plus, Search, Trash2, TrendingDown, Upload} from "lucide-react";
import { cn } from "@/lib/utils";
import { useColConfig } from "@/hooks/useColConfig";

const ANOS = [2026];

export default function Perdas() {
  const utils = trpc.useUtils();
  const { isOnline, enqueue } = useOfflineSyncContext();
  const [ano, setAno] = useState(2026);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ filial: "", gerente: "", coordenador: "" });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set(MONTHS.map(m => m.key)));
  const [showMonthFilter, setShowMonthFilter] = useState(false);

  const visibleCols = useColConfig("perdas");
  const allMonthsSelected = selectedMonths.size === MONTHS.length;
  const someMonthsSelected = selectedMonths.size > 0 && selectedMonths.size < MONTHS.length;
  const { data, isLoading } = trpc.perdas.list.useQuery({ ano });
  // Busca faturamentos do mesmo ano para calcular perdaPct em tempo real
  const { data: faturamentosData } = trpc.faturamentos.list.useQuery({ ano });

  // Mapa filial -> total de faturamento para lookup rápido
  // Calcula o total somando todos os meses (igual ao Faturamentos)
  const faturamentoMap = useMemo(() => {
    const map: Record<number, number> = {};
    (faturamentosData || []).forEach((f: any) => {
      const monthTotal = MONTHS.reduce((s, m) => s + ((f as any)[m.key] || 0), 0);
      if (monthTotal > 0) map[f.filial] = monthTotal;
    });
    return map;
  }, [faturamentosData]);

  // Mapeamento: MONTHS usa chaves longas (janeiro, fevereiro, etc), mas as colunas usam IDs curtos (jan, fev, etc)
  const MONTH_KEYS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

  const updateMut = trpc.perdas.update.useMutation({
    onMutate: async (vars) => {
      // Atualização otimista: recalcula o total e perdaPct localmente antes da resposta do servidor
      await utils.perdas.list.cancel();
      const prev = utils.perdas.list.getData({ ano });
      const hasMonth = MONTHS.some(m => m.key in vars);
      if (prev && hasMonth) {
        utils.perdas.list.setData({ ano }, prev.map(row => {
          if (row.id !== vars.id) return row;
          const updated = { ...row, ...vars };
          const newTotal = MONTHS.reduce((s, m) => s + (Number(updated[m.key]) || 0), 0);
          // Recalcular perdaPct com base no faturamento da filial
          const fatTotal = faturamentoMap[row.filial];
          const newPerdaPct = fatTotal && fatTotal > 0 ? newTotal / fatTotal : row.perdaPct;
          return { ...updated, total: newTotal, perdaNo: newTotal, perdaPct: newPerdaPct };
        }));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.perdas.list.setData({ ano }, ctx.prev);
      toast.error("Erro ao atualizar");
    },
    onSuccess: () => {
      utils.perdas.list.invalidate();
      utils.filiais.listWithPerdas.invalidate();
      utils.filiais.list.invalidate();
      toast.success("Atualizado!");
    },
  });

  const upsertMut = trpc.perdas.upsert.useMutation({
    onSuccess: () => { utils.perdas.list.invalidate(); toast.success("Filial adicionada!"); setShowAdd(false); setNewRow({ filial: "", gerente: "", coordenador: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.perdas.delete.useMutation({
    onSuccess: () => { utils.perdas.list.invalidate(); toast.success("Removido!"); setDeletingId(null); },
    onError: (e) => toast.error(e.message),
  });


  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/execute", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Erro na importação");

      const result = await response.json();
      toast.success(`Importação concluída! ${result.perdas?.upserted || 0} registros atualizados`);
      utils.perdas.list.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = useMemo(() => (data || []).filter(r =>
    String(r.filial).includes(search) ||
    r.gerente.toLowerCase().includes(search.toLowerCase()) ||
    r.coordenador.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    MONTHS.forEach(m => {
      totals[m.key] = filtered.reduce((s, r) => s + ((r as any)[m.key] || 0), 0);
    });
    totals.total = filtered.reduce((s, r) => s + (r.total || 0), 0);
    return totals;
  }, [filtered]);

  // Calcula Perda Aceitável = Meta % × Total Faturamento da filial
  function calcPerdaAceitavel(filial: number, metaPerdaPct: number | null | undefined): number | null {
    const fatTotal = faturamentoMap[filial];
    // Retorna null apenas quando não há faturamento cadastrado ou meta não definida
    if (fatTotal === undefined || metaPerdaPct === null || metaPerdaPct === undefined) return null;
    // metaPerdaPct é um valor como -0,94 ou -1,31, precisa dividir por 100 para converter a percentual
    return (Math.abs(metaPerdaPct) / 100) * fatTotal;
  }

  // Total de Perda Aceitável consolidado
  const totalPerdaAceitavel = useMemo(() =>
    filtered.reduce((s, r) => s + (calcPerdaAceitavel(r.filial, r.metaPerdaPct) || 0), 0)
  , [filtered, faturamentoMap]);

  function handleExport() {
    const rows = filtered.map(r => ({
      Filial: r.filial, Gerente: r.gerente, Coordenador: r.coordenador,
      Janeiro: r.janeiro, Fevereiro: r.fevereiro, Março: r.marco,
      Abril: r.abril, Maio: r.maio, Junho: r.junho,
      Julho: r.julho, Agosto: r.agosto, Setembro: r.setembro,
      Outubro: r.outubro, Novembro: r.novembro, Dezembro: r.dezembro,
      Total: r.total, "Perda %": r.perdaPct ? `${(r.perdaPct * 100).toFixed(2)}%` : "",
      "Meta %": r.metaPerdaPct ? `${(r.metaPerdaPct * 100).toFixed(2)}%` : "",
      "Perda Aceitável": calcPerdaAceitavel(r.filial, r.metaPerdaPct) ?? "",
    }));
    exportToExcel(rows, `Perdas_${ano}`, "Perdas");
    toast.success("Arquivo exportado!");
  }

  async function updateCell(id: number, field: string, value: string) {
    const numVal = value === "" ? null : Number(value);
    const payload = { id, [field]: numVal };
    if (isOnline) {
      updateMut.mutate(payload as any);
    } else {
      await offlineDb.perdas.update(id, { [field]: numVal, updatedAt: Date.now() });
      await enqueue("perdas", "update", id, payload);
      toast.info("Salvo localmente. Será sincronizado ao reconectar.", { duration: 2500, icon: "💾" });
    }
  }

  function cellColor(val: number | null | undefined) {
    if (val === null || val === undefined) return "";
    if (val > 0) return "text-emerald-400";
    if (val < 0) return "text-red-400";
    return "";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Perdas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitoramento de perdas por filial</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {ANOS.map(a => <SelectItem key={a} value={String(a)} className="text-xs">{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-2 h-8 text-xs border-border">
            <Upload className="w-3.5 h-3.5" /> {importing ? "Importando..." : "Importar"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 h-8 text-xs border-border">
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Nova Filial
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total de Perdas</p>
            <p className={cn("text-lg font-bold mt-1", columnTotals.total < 0 ? "text-red-400" : "text-emerald-400")}>
              {formatCurrency(columnTotals.total || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Filiais com Perda</p>
            <p className="text-lg font-bold mt-1 text-red-400">
              {filtered.filter(r => (r.total || 0) < 0).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Filiais Positivas</p>
            <p className="text-lg font-bold mt-1 text-emerald-400">
              {filtered.filter(r => (r.total || 0) >= 0).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Perda % Total</p>
            <p className="text-lg font-bold mt-1 text-amber-400">
              {(() => {
                const totalFat = filtered.reduce((s, r) => s + (faturamentoMap[r.filial] || 0), 0);
                const totalPerdas = columnTotals.total || 0;
                if (!totalFat) return "-";
                return `${(Math.abs(totalPerdas / totalFat) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
              })()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Perdas {ano}</CardTitle>
              <Badge variant="secondary">{filtered.length} filiais</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-48 bg-input border-border" />
              </div>
              <div className="relative">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowMonthFilter(!showMonthFilter)}>
                  {selectedMonths.size === MONTHS.length ? "Todos os Meses" : `${selectedMonths.size}/${MONTHS.length} meses`}
                </Button>
                {showMonthFilter && (
                  <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg p-3 z-50 w-64">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <Label className="text-xs font-semibold">Filtrar Meses</Label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                          if (allMonthsSelected) {
                            setSelectedMonths(new Set());
                          } else {
                            setSelectedMonths(new Set(MONTHS.map(m => m.key)));
                          }
                        }}>
                          {allMonthsSelected ? "Limpar" : "Todos"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {MONTHS.map(m => (
                          <label key={m.key} className="flex items-center gap-2 cursor-pointer text-xs">
                            <input type="checkbox" checked={selectedMonths.has(m.key)} onChange={e => {
                              const newSet = new Set(selectedMonths);
                              if (e.target.checked) {
                                newSet.add(m.key);
                              } else {
                                newSet.delete(m.key);
                              }
                              setSelectedMonths(newSet);
                            }} className="w-3 h-3" />
                            {m.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {visibleCols.has("filial") && <th className="text-left px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16 sticky left-0 bg-muted/30">Filial</th>}
                  {visibleCols.has("gerente") && <th className="text-left px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-24">Gerente</th>}
                  {MONTHS.map((m, idx) => {
                    const shortKey = MONTH_KEYS_SHORT[idx];
                    return visibleCols.has(shortKey) && selectedMonths.has(m.key) && (
                      <th key={m.key} className="text-right px-2 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-18">{m.label}</th>
                    );
                  })}
                  {visibleCols.has("total") && <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-24">Total</th>}
                  {visibleCols.has("perdaPct") && <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-18" title="Calculado automaticamente: Total Perdas ÷ Total Faturamento">Perda % ℹ️</th>}
                  {visibleCols.has("metaPerdaPct") && <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-18">Meta %</th>}
                  {visibleCols.has("perdaAceitavel") && <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-24" title="Meta % × Total Faturamento da filial">Perda Aceit. ℹ️</th>}
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={r.id} className={`border-b border-border/50 hover:bg-accent/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                    {visibleCols.has("filial") && <td className="px-3 py-2 sticky left-0 bg-card"><span className="font-mono font-bold text-primary">{r.filial}</span></td>}
                    {visibleCols.has("gerente") && <td className="px-3 py-2"><EditableCell value={r.gerente} onSave={v => updateMut.mutate({ id: r.id, gerente: v })} /></td>}
                    {MONTHS.map((m, idx) => {
                      const shortKey = MONTH_KEYS_SHORT[idx];
                      if (!visibleCols.has(shortKey) || !selectedMonths.has(m.key)) return null;
                      const val = (r as any)[m.key] as number | null;
                      return (
                        <td key={m.key} className="px-2 py-2 text-right">
                          <EditableCell value={val} onSave={v => updateCell(r.id, m.key, v)} type="number" formatter={v => v !== null && v !== undefined && v !== "" ? formatCurrency(Number(v)) : "-"} className={cn("text-right", cellColor(val))} />
                        </td>
                      );
                    })}
                    {visibleCols.has("total") && (
                      <td className={cn("px-3 py-2 text-right font-semibold", cellColor(r.total))}>
                        <EditableCell value={r.total} onSave={v => updateMut.mutate({ id: r.id, total: v === "" ? null : Number(v) })} type="number" formatter={v => v !== null && v !== undefined && v !== "" ? formatCurrency(Number(v)) : "-"} className={cn("text-right font-semibold", cellColor(r.total))} />
                      </td>
                    )}
                    {visibleCols.has("perdaPct") && (
                      <td className={cn("px-3 py-2 text-right font-semibold", cellColor(r.perdaPct))}>
                        {(() => {
                          const fatTotal = faturamentoMap[r.filial];
                          if (!fatTotal || fatTotal <= 0) return <span className="text-muted-foreground">-</span>;
                          const totalPerdas = r.total || 0;
                          const computedPct = (totalPerdas / fatTotal) * 100;
                          const isNegative = computedPct < 0;
                          return <span className={isNegative ? "text-red-400" : "text-green-400"} title={`${totalPerdas.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})} / ${fatTotal.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}`}>{computedPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>;
                        })()}
                      </td>
                    )}
                    {visibleCols.has("metaPerdaPct") && (
                      <td className="px-3 py-2 text-right">
                        <EditableCell value={r.metaPerdaPct !== null && r.metaPerdaPct !== undefined ? String(r.metaPerdaPct) : null} onSave={v => updateMut.mutate({ id: r.id, metaPerdaPct: v === "" ? null : Number(v) })} type="number" formatter={v => {
                          if (v === null || v === undefined || v === "") return "-";
                          const num = Number(v);
                          const sign = num < 0 ? "-" : "";
                          const abs = Math.abs(num);
                          return `${sign}${abs.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
                        }} className={`text-right ${
                          r.metaPerdaPct !== null && r.metaPerdaPct !== undefined && r.metaPerdaPct < 0 ? "text-red-400" : "text-green-400"
                        }`} />
                      </td>
                    )}
                    {visibleCols.has("perdaAceitavel") && (
                      <td className="px-3 py-2 text-right font-semibold text-amber-400/90">
                        {(() => {
                          const aceit = calcPerdaAceitavel(r.filial, r.metaPerdaPct);
                          if (aceit === null) return <span className="text-muted-foreground font-normal">-</span>;
                          return <span title={`Meta ${r.metaPerdaPct !== null && r.metaPerdaPct !== undefined ? (Math.abs(r.metaPerdaPct)*100).toFixed(2) : '?'}% × Fat. ${faturamentoMap[r.filial]?.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) ?? '?'}`}>{formatCurrency(aceit)}</span>;
                        })()}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingId(r.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-primary/30 bg-primary/5">
                    <td className="px-3 py-3 font-bold text-primary text-xs sticky left-0 bg-primary/5" colSpan={3}>TOTAL</td>
                    {MONTHS.map(m => selectedMonths.has(m.key) && (
                      <td key={m.key} className={cn("px-2 py-3 text-right font-semibold text-xs", cellColor(columnTotals[m.key]))}>
                        {formatCurrency(columnTotals[m.key] || 0)}
                      </td>
                    ))}
                    <td className={cn("px-3 py-3 text-right font-bold text-xs", cellColor(columnTotals.total))}>
                      {formatCurrency(columnTotals.total || 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground" />
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground" />
                    <td className="px-3 py-3 text-right font-bold text-xs text-amber-400/90">
                      {totalPerdaAceitavel > 0 ? formatCurrency(totalPerdaAceitavel) : "-"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Filial - Perdas {ano}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs text-muted-foreground">Código da Filial</Label>
              <Input type="number" placeholder="Ex: 200" value={newRow.filial}
                onChange={e => setNewRow(p => ({ ...p, filial: e.target.value }))}
                className="mt-1 bg-input border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">Gerente</Label>
              <Input placeholder="Nome do gerente" value={newRow.gerente}
                onChange={e => setNewRow(p => ({ ...p, gerente: e.target.value }))}
                className="mt-1 bg-input border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">Coordenador</Label>
              <Input placeholder="Nome do coordenador" value={newRow.coordenador}
                onChange={e => setNewRow(p => ({ ...p, coordenador: e.target.value }))}
                className="mt-1 bg-input border-border" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={() => upsertMut.mutate({ filial: Number(newRow.filial), gerente: newRow.gerente, coordenador: newRow.coordenador, ano })}
              disabled={!newRow.filial || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja remover este registro de perdas?</p>
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
