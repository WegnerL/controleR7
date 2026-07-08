import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exportToExcel, MONTHS } from "@/lib/excel";
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
import {AlertCircle, Download, Plus, Search, Trash2, BarChart3, CalendarDays, CheckCircle2, XCircle, Upload} from "lucide-react";
import { cn } from "@/lib/utils";

const ANOS = [2026];
const SEMANAS_DEFAULT = [
  { key: "semana1", label: "Semana 1" },
  { key: "semana2", label: "Semana 2" },
  { key: "semana3", label: "Semana 3" },
  { key: "semana4", label: "Semana 4" },
  { key: "semana5", label: "Sem. 5" },
] as const;

const SEMANAS_STORAGE_KEY = "contagem_semana_labels";

function loadSemanaLabels(): string[] {
  try {
    const saved = localStorage.getItem(SEMANAS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 5) return parsed;
    }
  } catch {}
  return SEMANAS_DEFAULT.map(s => s.label);
}

type SemanaKey = "semana1" | "semana2" | "semana3" | "semana4" | "semana5";

// Componente para cabeçalho de semana editável
function SemanaHeader({ label, onSave }: { label: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        defaultValue={label}
        className="w-24 h-7 text-center text-xs bg-input border border-primary rounded px-1 outline-none font-semibold uppercase tracking-wider"
        onBlur={e => { onSave(e.target.value); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") { onSave((e.target as HTMLInputElement).value); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className="cursor-pointer hover:text-primary transition-colors select-none"
      title="Duplo clique para renomear"
    >
      {label}
    </span>
  );
}

// Converte valor string para boolean: "1"/"✅" = presente, resto = ausente
function toBool(v: string | null | undefined): boolean {
  if (!v) return false;
  const n = v.trim();
  return n === "1" || n === "✅" || n.toLowerCase() === "sim" || n.toLowerCase() === "ok" || n.toLowerCase() === "true";
}

// Retorna o display do valor: se for "1" mostra ✅, se for "0" mostra ❌, senão mostra o texto
function displaySemana(v: string | null | undefined): { icon: boolean; text: string; isPresente: boolean } {
  if (!v || v.trim() === "" || v.trim() === "0") return { icon: true, text: "❌", isPresente: false };
  if (v.trim() === "1" || v.trim() === "✅") return { icon: true, text: "✅", isPresente: true };
  return { icon: false, text: v, isPresente: false };
}

// Componente unificado para células de semana: clique simples = toggle ✅/❌, duplo clique = editar texto livre
function SemanaCell({
  value, displayVal, isPresente, onToggle, onSave
}: {
  value: string | null;
  displayVal: string;
  isPresente: boolean;
  onToggle: () => void;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useState<HTMLInputElement | null>(null);

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        defaultValue={value ?? ""}
        className="w-20 h-8 text-center text-xs bg-input border border-primary rounded px-1 outline-none"
        onBlur={e => { onSave(e.target.value); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") { onSave((e.target as HTMLInputElement).value); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      onClick={onToggle}
      onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}
      className={cn(
        "inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150",
        "hover:scale-110 active:scale-95 cursor-pointer select-none",
        displayVal === "✅"
          ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
          : displayVal === "❌"
          ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
          : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold"
      )}
      title="Clique: alterna ✅/❌ — Duplo clique: digitar texto ou número"
    >
      {displayVal === "✅" ? (
        <CheckCircle2 className="w-5 h-5" />
      ) : displayVal === "❌" ? (
        <XCircle className="w-5 h-5" />
      ) : (
        <span className="text-xs font-bold leading-none">{displayVal}</span>
      )}
    </button>
  );
}

export default function ContagemSemanal() {
  const utils = trpc.useUtils();
  const [ano, setAno] = useState(2026);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [mes, setMes] = useState(1);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newRow, setNewRow] = useState({ filial: "", gerente: "", coordenador: "" });
  const [semanaLabels, setSemanaLabels] = useState<string[]>(loadSemanaLabels);

  const SEMANAS = SEMANAS_DEFAULT.map((s, i) => ({ key: s.key, label: semanaLabels[i] ?? s.label }));

  function updateSemanaLabel(index: number, newLabel: string) {
    const updated = semanaLabels.map((l, i) => i === index ? (newLabel.trim() || SEMANAS_DEFAULT[i].label) : l);
    setSemanaLabels(updated);
    try { localStorage.setItem(SEMANAS_STORAGE_KEY, JSON.stringify(updated)); } catch {}
  }

  const { data, isLoading } = trpc.contagemSemanal.list.useQuery({ ano, mes });

  const SEMANA_KEYS: SemanaKey[] = ["semana1", "semana2", "semana3", "semana4", "semana5"];

  const updateMut = trpc.contagemSemanal.update.useMutation({
    onMutate: async (vars) => {
      await utils.contagemSemanal.list.cancel();
      const prev = utils.contagemSemanal.list.getData({ ano, mes });
      const hasSemana = SEMANA_KEYS.some(k => k in vars);
      if (prev && hasSemana) {
        utils.contagemSemanal.list.setData({ ano, mes }, prev.map((row: any) => {
          if (row.id !== vars.id) return row;
          const updated = { ...row, ...vars };
          // Total = contagem de semanas com valor 1 (✅)
          const newTotal = SEMANA_KEYS.reduce((s, k) => s + (Number(updated[k]) === 1 ? 1 : 0), 0);
          return { ...updated, total: newTotal };
        }));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.contagemSemanal.list.setData({ ano, mes }, ctx.prev);
      toast.error("Erro ao atualizar");
    },
    onSuccess: () => {
      utils.contagemSemanal.list.invalidate();
    },
  });

  const upsertMut = trpc.contagemSemanal.upsert.useMutation({
    onSuccess: () => {
      utils.contagemSemanal.list.invalidate();
      toast.success("Filial adicionada!");
      setShowAdd(false);
      setNewRow({ filial: "", gerente: "", coordenador: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.contagemSemanal.delete.useMutation({
    onSuccess: () => {
      utils.contagemSemanal.list.invalidate();
      toast.success("Removido!");
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const { isOnline, enqueue } = useOfflineSyncContext();

  // Toggle ✅/❌: inverte o valor da semana ("0"→"1", "1"→"0")
  async function toggleSemana(id: number, semanaKey: SemanaKey, currentVal: string | null | undefined) {
    const newVal = toBool(currentVal) ? "0" : "1";
    const payload = { id, [semanaKey]: newVal };
    if (isOnline) {
      updateMut.mutate(payload as any);
    } else {
      await offlineDb.contagem.update(id, { [semanaKey]: newVal, updatedAt: Date.now() });
      await enqueue("contagem", "update", id, payload);
      toast.info("Salvo localmente. Será sincronizado ao reconectar.", { duration: 2500, icon: "💾" });
    }
  }


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
      toast.success(`Importação concluída! ${result.contagem?.upserted || 0} registros atualizados`);
      utils.contagemSemanal.list.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = useMemo(() => (data || []).filter((r: any) =>
    String(r.filial).includes(search) ||
    r.gerente.toLowerCase().includes(search.toLowerCase()) ||
    r.coordenador.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  // Totais por coluna: conta quantas filiais têm ✅ em cada semana
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    SEMANAS.forEach(s => {
      totals[s.key] = filtered.filter((r: any) => toBool((r as any)[s.key] as string)).length;
    });
    totals.total = filtered.reduce((sum: any, r: any) => sum + (r.total || 0), 0);
    return totals;
  }, [filtered]);

  const kpis = useMemo(() => {
    const totalPresencas = filtered.reduce((s: any, r: any) => s + (r.total || 0), 0);
    const totalPossivel = filtered.length * SEMANAS.length;
    const pctPresenca = totalPossivel > 0 ? (totalPresencas / totalPossivel) * 100 : 0;
    const melhorFilial = filtered.reduce((best: any, r: any) => (!best || (r.total || 0) > (best.total || 0)) ? r : best, filtered[0]);
    return { totalPresencas, pctPresenca, melhorFilial };
  }, [filtered]);

  function handleExport() {
    const rows = filtered.map((r: any) => ({
      Filial: r.filial,
      Gerente: r.gerente,
      Coordenador: r.coordenador,
      Ano: r.ano,
      Mês: MONTHS[r.mes - 1]?.label ?? r.mes,
      "Semana 1": r.semana1 ?? "",
      "Semana 2": r.semana2 ?? "",
      "Semana 3": r.semana3 ?? "",
      "Semana 4": r.semana4 ?? "",
      "Semana 5": r.semana5 ?? "",
      "Total Presenças": r.total,
    }));
    exportToExcel(rows, `ContagemSemanal_${ano}_M${String(mes).padStart(2, "0")}`, "Contagem Semanal");
    toast.success("Arquivo exportado!");
  }

  const mesAtual = MONTHS[mes - 1];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contagem Semanal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Acompanhamento semanal por filial — clique em ✅/❌ para alternar</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Presenças</p>
            </div>
            <p className="text-xl font-bold text-primary">{kpis.totalPresencas}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Filiais</p>
            </div>
            <p className="text-xl font-bold text-blue-400">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">% Presença</p>
            </div>
            <p className="text-xl font-bold text-emerald-400">{kpis.pctPresenca.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Melhor Filial</p>
            <p className="text-xl font-bold text-amber-400">{kpis.melhorFilial?.total ?? 0} sem.</p>
            {kpis.melhorFilial && (
              <p className="text-xs text-muted-foreground mt-0.5">Filial {kpis.melhorFilial.filial}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Contagem — {mesAtual?.label ?? mes}/{ano}
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
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-28">Coordenador</th>
                  {SEMANAS.map((s, i) => (
                    <th key={s.key} className="text-center px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-24">
                      <SemanaHeader label={s.label} onSave={v => updateSemanaLabel(i, v)} />
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-20">Total</th>
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <CalendarDays className="w-8 h-8 opacity-30" />
                        <p className="text-sm">Nenhum registro para {mesAtual?.label} / {ano}</p>
                        <p className="text-xs">Clique em "Nova Filial" para adicionar</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((r: any, i: number) => (
                  <tr key={r.id} className={cn(
                    "border-b border-border/50 hover:bg-accent/20 transition-colors",
                    i % 2 === 0 ? "" : "bg-muted/5"
                  )}>
                    <td className="px-3 py-2 sticky left-0 bg-card">
                      <span className="font-mono font-bold text-primary">{r.filial}</span>
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell value={r.gerente} onSave={v => updateMut.mutate({ id: r.id, gerente: v })} />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell value={r.coordenador} onSave={v => updateMut.mutate({ id: r.id, coordenador: v })} />
                    </td>
                    {SEMANAS.map(s => {
                      const val = (r as any)[s.key] as string | null;
                      const { isPresente } = displaySemana(val);
                      // Exibe o valor real: "1"→✅, "0"/null→❌, outros→texto
                      const displayVal = !val || val === "0" ? "❌" : val === "1" ? "✅" : val;
                      return (
                        <td key={s.key} className="px-3 py-2 text-center">
                          <SemanaCell
                            value={val}
                            displayVal={displayVal}
                            isPresente={isPresente}
                            onToggle={() => toggleSemana(r.id, s.key, val)}
                            onSave={v => updateMut.mutate({ id: r.id, [s.key]: v || null } as any)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold",
                        (r.total || 0) === SEMANAS.length
                          ? "bg-emerald-500/20 text-emerald-400"
                          : (r.total || 0) === 0
                          ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400"
                      )}>
                        {r.total ?? 0}
                      </span>
                    </td>
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
                    <td className="px-3 py-3 font-bold text-primary text-xs sticky left-0 bg-primary/5" colSpan={2}>TOTAL</td>
                    {SEMANAS.map(s => (
                      <td key={s.key} className="px-3 py-3 text-center font-semibold text-xs text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {columnTotals[s.key] || 0}
                        </span>
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center font-bold text-primary text-xs">
                      {columnTotals.total || 0}
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
            <DialogTitle>Nova Filial — Contagem Semanal</DialogTitle>
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
              <Label className="text-xs text-muted-foreground">Coordenador</Label>
              <Input placeholder="Nome do coordenador" value={newRow.coordenador}
                onChange={e => setNewRow(p => ({ ...p, coordenador: e.target.value }))}
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
                coordenador: newRow.coordenador,
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
