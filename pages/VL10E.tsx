import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EditableCell } from "@/components/EditableCell";
import { Upload, Plus, Trash2, Search, Download, RefreshCw } from "lucide-react";
import { useEffect } from "react";

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

export default function VL10E() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newFilial, setNewFilial] = useState({ codigo: "", gerente: "", col383: "", colCD02: "" });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef383 = useRef<HTMLInputElement>(null);
  const fileInputRefCD = useRef<HTMLInputElement>(null);

  // Busca dados VL10E com filiais do módulo Dados
  const { data: vl10eData, isLoading } = trpc.vl10e.list.useQuery();
  
  // Cleanup de filiais inválidas ao carregar o módulo
  const cleanupMut = trpc.vl10e.cleanupInvalidFiliais.useMutation({
    onSuccess: (result) => {
      if (result.deletedCount > 0) {
        invalidateAll();
        toast.info(`${result.deletedCount} registros com filiais não cadastradas foram removidos`);
      }
    },
    onError: (e) => console.error("Erro ao limpar filiais inválidas:", e),
  });
  
  // Executar cleanup ao montar o componente
  useEffect(() => {
    cleanupMut.mutate();
  }, []);

  const invalidateAll = () => {
    utils.vl10e.list.invalidate();
  };

  const createMut = trpc.vl10e.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Filial adicionada!");
      setShowAdd(false);
      setNewFilial({ codigo: "", gerente: "", col383: "", colCD02: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.vl10e.update.useMutation({
    onMutate: async (input) => {
      await utils.vl10e.list.cancel();
      const previousData = utils.vl10e.list.getData();
      if (previousData) {
        utils.vl10e.list.setData(undefined, (old) => {
          if (!old) return old;
          return old.map((item: any) => {
            if (item.id === input.id) {
              return {
                ...item,
                ...(input.codigo !== undefined && { codigo: input.codigo }),
                ...(input.gerente !== undefined && { gerente: input.gerente }),
                ...(input.total !== undefined && { total: input.total }),
                ...(input.col383 !== undefined && { col383: input.col383 }),
                ...(input.colCD02 !== undefined && { colCD02: input.colCD02 }),
              };
            }
            return item;
          });
        });
      }
      return { previousData };
    },
    onSuccess: () => { 
      utils.fechamentos.list.invalidate();
      toast.success("Atualizado!"); 
    },
    onError: (err, input, context: any) => {
      if (context?.previousData) {
        utils.vl10e.list.setData(undefined, context.previousData);
      }
      toast.error(err.message);
    },
  });

  const deleteMut = trpc.vl10e.delete.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Filial removida!"); setDeletingId(null); },
    onError: (e) => toast.error(e.message),
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    const toastId = toast.loading("Importando arquivo VL10E...");
    try {
      const res = await fetch("/api/import/vl10e", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao importar");
      }
      
      const result = await res.json();
      console.log("[VL10E Import Response]", result);
      
      // Check if the response has updated or ok count
      if (result.updated > 0 || result.ok > 0) {
        invalidateAll();
        const total = (result.ok || 0) + (result.updated || 0);
        toast.success(`Importação concluída! ${total} registros processados.`, { id: toastId });
      } else if (result.ignored > 0) {
        invalidateAll();
        toast.warning(`Importação concluída! ${result.ignored} filiais ignoradas.`, { id: toastId });
      } else {
        toast.warning("Nenhum registro foi processado.", { id: toastId });
      }
    } catch (err) {
      toast.error("Erro ao importar: " + String(err), { id: toastId });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImportVL10E383 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    const toastId = toast.loading("Importando VL10E383...");
    try {
      const res = await fetch("/api/import/vl10e-383", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao importar");
      }
      
      const result = await res.json();

      if (result.updated > 0) {
        invalidateAll();
        let msg = `${result.updated} registros atualizados`;
        if (result.ignored && result.ignored > 0) {
          msg += ` | ${result.ignored} filiais ignoradas`;
        }
        toast.success(msg, { id: toastId });
      } else {
        toast.warning("Nenhum registro foi processado", { id: toastId });
      }
    } catch (err) {
      toast.error("Erro ao importar: " + String(err), { id: toastId });
    } finally {
      setImporting(false);
      if (fileInputRef383.current) fileInputRef383.current.value = "";
    }
  };

  const handleImportVL10ECD = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    const toastId = toast.loading("Importando VL10ECD...");
    try {
      const res = await fetch("/api/import/vl10e-cd", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao importar");
      }
      
      const result = await res.json();

      if (result.updated > 0) {
        invalidateAll();
        let msg = `${result.updated} registros atualizados`;
        if (result.ignored && result.ignored > 0) {
          msg += ` | ${result.ignored} filiais ignoradas`;
        }
        toast.success(msg, { id: toastId });
      } else {
        toast.warning("Nenhum registro foi processado", { id: toastId });
      }
    } catch (err) {
      toast.error("Erro ao importar: " + String(err), { id: toastId });
    } finally {
      setImporting(false);
      if (fileInputRefCD.current) fileInputRefCD.current.value = "";
    }
  };

  const handleExport = async () => {
    if (!vl10eData) return;
    const toastId = toast.loading("Exportando para Excel...");
    try {
      // Importar XLSX dinamicamente
      const XLSX = await import('xlsx');
      
      const rows = [["Código Filial", "Gerente", "Total", "Coluna 383", "CD02", "Soma"]];
      vl10eData.forEach((row: any) => {
        const soma = (row.total || 0) + (row.col383 || 0) + (row.colCD02 || 0);
        rows.push([
          String(row.codigo),
          row.gerente || "",
          Number(row.total || 0),
          Number(row.col383 || 0),
          Number(row.colCD02 || 0),
          Number(soma),
        ]);
      });

      // Criar workbook e adicionar worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      
      // Formatar colunas
      const colWidths = [15, 20, 15, 15, 15, 15];
      worksheet['!cols'] = colWidths.map(w => ({ wch: w }));
      
      XLSX.utils.book_append_sheet(workbook, worksheet, "VL10E");
      XLSX.writeFile(workbook, "VL10E.xlsx");
      
      toast.success("Arquivo Excel exportado com sucesso!", { id: toastId });
    } catch (err) {
      toast.error("Erro ao exportar para Excel: " + String(err), { id: toastId });
    }
  };

  const filtered = (vl10eData || []).filter((row: any) =>
    search === "" || 
    String(row.codigo).includes(search) || 
    (row.gerente || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">VL10E</h1>
        <p className="text-muted-foreground">Gestão de dados VL10E com colunas 383 e CD02</p>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Importar VL10E
        </Button>
        <Button
          onClick={() => fileInputRef383.current?.click()}
          disabled={importing}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Importar VL10E383
        </Button>
        <Button
          onClick={() => fileInputRefCD.current?.click()}
          disabled={importing}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Importar VL10ECD
        </Button>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar Excel
        </Button>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        className="hidden"
      />
      <input
        ref={fileInputRef383}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportVL10E383}
        className="hidden"
      />
      <input
        ref={fileInputRefCD}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportVL10ECD}
        className="hidden"
      />

      {/* Info Badge */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
        <span className="inline-block bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2">Dados</span>
        Filiais com este badge vêm do módulo Dados e têm Código e Gerente sincronizados automaticamente.
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Dados ({filtered.length} registros)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-semibold">Código Filial</th>
                    <th className="text-left py-2 px-4 font-semibold">Gerente</th>
                    <th className="text-left py-2 px-4 font-semibold">Total</th>
                    <th className="text-left py-2 px-4 font-semibold">Coluna 383</th>
                    <th className="text-left py-2 px-4 font-semibold">CD02</th>
                    <th className="text-left py-2 px-4 font-semibold">Soma</th>
                    <th className="text-center py-2 px-4 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row: any) => {
                    const isFromDados = row.id === 0;
                    return (
                    <tr key={`${row.codigo}-${row.id}`} className={`border-b hover:bg-muted/50 ${isFromDados ? 'bg-blue-500/5' : ''}`}>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{row.codigo}</span>
                          {isFromDados && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Dados</span>}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <span>{row.gerente || "—"}</span>
                      </td>
                      <td className="py-2 px-4">
                        <EditableCell
                          value={fmtBRL(row.total)}
                          onSave={(val: string) => {
                            const num = parseNum(val);
                            if (num !== null) {
                              updateMut.mutate({
                                id: row.id,
                                codigo: row.codigo,
                                gerente: row.gerente,
                                total: num,
                              });
                            }
                          }}
                        />
                      </td>
                      <td className="py-2 px-4">
                        <EditableCell
                          value={fmtBRL(row.col383)}
                          onSave={(val: string) => {
                            const num = parseNum(val);
                            if (num !== null) {
                              updateMut.mutate({
                                id: row.id,
                                codigo: row.codigo,
                                gerente: row.gerente,
                                col383: num,
                              });
                            }
                          }}
                        />
                      </td>
                      <td className="py-2 px-4">
                        <EditableCell
                          value={fmtBRL(row.colCD02)}
                          onSave={(val: string) => {
                            const num = parseNum(val);
                            if (num !== null) {
                              updateMut.mutate({
                                id: row.id,
                                codigo: row.codigo,
                                gerente: row.gerente,
                                colCD02: num,
                              });
                            }
                          }}
                        />
                      </td>
                      <td className="py-2 px-4">
                        <span className="font-semibold text-blue-400">{fmtBRL((row.total || 0) + (row.col383 || 0) + (row.colCD02 || 0))}</span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        {!isFromDados && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingId(row.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja remover esta linha?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingId !== null) {
                  deleteMut.mutate({ id: deletingId });
                }
              }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Filial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="codigo">Código Filial</Label>
              <Input
                id="codigo"
                type="number"
                value={newFilial.codigo}
                onChange={(e) => setNewFilial({ ...newFilial, codigo: e.target.value })}
                placeholder="Ex: 123"
              />
            </div>
            <div>
              <Label htmlFor="gerente">Gerente</Label>
              <Input
                id="gerente"
                value={newFilial.gerente}
                onChange={(e) => setNewFilial({ ...newFilial, gerente: e.target.value })}
                placeholder="Nome do gerente"
              />
            </div>
            <div>
              <Label htmlFor="col383">Coluna 383</Label>
              <Input
                id="col383"
                type="number"
                step="0.01"
                value={newFilial.col383}
                onChange={(e) => setNewFilial({ ...newFilial, col383: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="colCD02">CD02</Label>
              <Input
                id="colCD02"
                type="number"
                step="0.01"
                value={newFilial.colCD02}
                onChange={(e) => setNewFilial({ ...newFilial, colCD02: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!newFilial.codigo) {
                  toast.error("Código é obrigatório");
                  return;
                }
                createMut.mutate({
                  codigo: parseInt(newFilial.codigo),
                  gerente: newFilial.gerente,
                  col383: newFilial.col383 ? parseFloat(newFilial.col383) : 0,
                  colCD02: newFilial.colCD02 ? parseFloat(newFilial.colCD02) : 0,
                });
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
