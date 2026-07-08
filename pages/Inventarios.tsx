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
import { Package, Download, Plus, Search, Trash2, Upload } from "lucide-react";

const ANOS = [2026];

export default function Inventarios() {
  const utils = trpc.useUtils();
  const { isOnline, enqueue } = useOfflineSyncContext();
  const [ano, setAno] = useState(2026);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ filial: "", gerente: "", coordenador: "" });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading } = trpc.inventarios.list.useQuery({ ano });

  const updateMut = trpc.inventarios.update.useMutation({
    onSuccess: () => { utils.inventarios.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const upsertMut = trpc.inventarios.upsert.useMutation({
    onSuccess: () => { utils.inventarios.list.invalidate(); toast.success("Filial adicionada!"); setShowAdd(false); setNewRow({ filial: "", gerente: "", coordenador: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.inventarios.delete.useMutation({
    onSuccess: () => { utils.inventarios.list.invalidate(); toast.success("Removido!"); setDeletingId(null); },
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
      toast.success(`Importação concluída! ${result.inventarios?.upserted || 0} registros atualizados`);
      utils.inventarios.list.invalidate();
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

  function handleExport() {
    const rows = filtered.map(r => ({
      Filial: r.filial, Gerente: r.gerente, Coordenador: r.coordenador,
      Janeiro: r.janeiro, Fevereiro: r.fevereiro, Março: r.marco,
      Abril: r.abril, Maio: r.maio, Junho: r.junho,
      Julho: r.julho, Agosto: r.agosto, Setembro: r.setembro,
      Outubro: r.outubro, Novembro: r.novembro, Dezembro: r.dezembro,
    }));
    exportToExcel(rows, `Inventarios_${ano}`, "Inventários");
    toast.success("Arquivo exportado!");
  }

  async function updateCell(id: number, field: string, value: string) {
    const payload = { id, [field]: value };
    if (isOnline) {
      updateMut.mutate(payload as any);
    } else {
      // Salvar localmente no IndexedDB
      await offlineDb.inventarios.update(id, { [field]: value, updatedAt: Date.now() });
      await enqueue("inventarios", "update", id, payload);
      toast.info("Salvo localmente. Será sincronizado ao reconectar.", { duration: 2500, icon: "💾" });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventários Rotativos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controle de inventários por filial</p>
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

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Inventários {ano}</CardTitle>
              <Badge variant="secondary">{filtered.length} filiais</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-48 bg-input border-border" />
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
                  {MONTHS.map(m => (
                    <th key={m.key} className="text-center px-2 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16">{m.label}</th>
                  ))}
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={16} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={16} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={r.id} className={`border-b border-border/50 hover:bg-accent/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="px-3 py-2 sticky left-0 bg-card">
                      <span className="font-mono font-bold text-primary">{r.filial}</span>
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell value={r.gerente} onSave={v => updateCell(r.id, "gerente", v)} />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell value={r.coordenador} onSave={v => updateCell(r.id, "coordenador", v)} />
                    </td>
                    {MONTHS.map(m => (
                      <td key={m.key} className="px-2 py-2 text-center">
                        <EditableCell
                          value={(r as any)[m.key]}
                          onSave={v => updateCell(r.id, m.key, v)}
                          className="text-center"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingId(r.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Filial - Inventário {ano}</DialogTitle></DialogHeader>
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

      {/* Delete confirm */}
      <Dialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja remover este registro de inventário?</p>
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
