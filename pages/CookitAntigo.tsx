import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exportToExcel, formatCurrency } from "@/lib/excel";
import { exportCookitAntiqoToPDF } from "@/lib/pdf-export";
import { FileText, Upload, Download, Plus, Trash2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { EditableCell } from "@/components/EditableCell";
import { CookitAntigoPreviewModal } from "@/components/CookitAntigoPreviewModal";


const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

export default function CookitAntigo() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({ codigo: "", gerente: "" });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = (trpc as any).cookitAntigo.list.useQuery();
  const updateMut = (trpc as any).cookitAntigo.update.useMutation({
    onSuccess: () => {
      (utils as any).cookitAntigo.list.invalidate();
      toast.success("Atualizado!");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const deleteMut = (trpc as any).cookitAntigo.delete.useMutation({
    onSuccess: () => {
      (utils as any).cookitAntigo.list.invalidate();
      setDeletingId(null);
      toast.success("Deletado!");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter((item: any) =>
      String(item.codigo).includes(search) || 
      (item.gerente?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [items, search]);

  const handleCellSave = (id: number, field: string, value: string) => {
    const numValue = field !== "gerente" ? parseFloat(value) || 0 : value;
    updateMut.mutate({
      id,
      [field]: numValue,
    });
  };

  const handleAddRow = () => {
    if (!newRow.codigo) {
      toast.error("Código é obrigatório");
      return;
    }
    const codigo = parseInt(newRow.codigo);
    if (isNaN(codigo)) {
      toast.error("Código deve ser numérico");
      return;
    }
    const yearData: Record<string, number> = {};
    YEARS.forEach(year => {
      yearData[`ano${year}`] = parseFloat(newRow[`ano${year}`]) || 0;
    });
    updateMut.mutate({
      id: 0,
      codigo,
      gerente: newRow.gerente || "",
      ...yearData,
    });
    setNewRow({ codigo: "", gerente: "" });
    setShowAdd(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setIsImporting(true);
    setImportProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "preview");
      console.log("[CookitAntigo] Sending preview request");

      const response = await fetch("/api/import/cookit-antigo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao processar arquivo");
      }

      const result = await response.json();
      const preview = {
        yearsDetected: result.metadata?.yearsDetected || [],
        totalRows: result.metadata?.rowsProcessed || 0,
        filialData: result.data || {},
        totalValue: Object.values(result.data || {}).reduce((sum: number, filialData: any) => {
          return sum + Object.values(filialData).reduce((s: number, v: any) => s + v, 0);
        }, 0),
      };
      setPreviewData(preview);
      setShowPreview(true);
      setIsImporting(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao processar arquivo");
      setIsImporting(false);
      setPendingFile(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    console.log("[CookitAntigo] Starting import confirmation");
    setIsImporting(true);
    setImportProgress(0);
    
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("mode", "execute");
      console.log("[CookitAntigo] FormData prepared, sending execute request to /api/import/cookit-antigo");
      
      // Simulate progress based on typical processing time
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          // Gradually increase progress, but never reach 100% until done
          if (prev < 90) {
            return prev + Math.random() * 20;
          }
          return prev;
        });
      }, 300);
      
      const response = await fetch("/api/import/cookit-antigo", {
        method: "POST",
        body: formData,
      });
      
      clearInterval(progressInterval);
      setImportProgress(100);
      console.log("[CookitAntigo] Response received:", response.status, response.ok);
      
      if (!response.ok) throw new Error("Erro na importação");
      const result = await response.json();
      console.log("[CookitAntigo] Import result:", result);
      (utils as any).cookitAntigo.list.invalidate();
      toast.success(`Importação concluída! ${result.updated || 0} registros atualizados.`);
      
      // Delay closing modal to show 100%
      setTimeout(() => {
        setShowPreview(false);
        setPreviewData(null);
        setPendingFile(null);
        setIsImporting(false);
        setImportProgress(0);
      }, 500);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao confirmar importação");
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleCancelImport = () => {
    setShowPreview(false);
    setPreviewData(null);
    setPendingFile(null);
    setIsImporting(false);
    setImportProgress(0);
  };

  const handleExport = () => {
    const data = filtered.map((item: any) => ({
      "Código": item.codigo,
      "Gerente": item.gerente || "",
      "VL10E": item.vl10eTotal || 0,
      ...YEARS.reduce((acc, year) => ({
        ...acc,
        [year]: item[`ano${year}` as keyof typeof item] || 0,
      }), {}),
    }));

    exportToExcel(data, "Cookit_Antigo");
  };

  const handleExportPDF = async () => {
    try {
      await exportCookitAntiqoToPDF(filtered, `Cookit_Antigo_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cookit Antigo</CardTitle>
              <CardDescription>Saldo de Grupo 1 - Valores Brutos por Filial e Ano</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" disabled={isImporting} className="gap-2">
                <Upload className="w-4 h-4" />
                {isImporting ? "Importando..." : "Importar"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImport}
                className="hidden"
              />
              <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar Excel
              </Button>
              <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-2">
                <FileText className="w-4 h-4" />
                Exportar PDF
              </Button>
              <Button onClick={() => setShowAdd(true)} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Linha
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar por código ou gerente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Código</th>
                  <th className="px-4 py-2 text-left font-medium">Gerente</th>
                  <th className="px-4 py-2 text-right font-medium">VL10E</th>
                  {YEARS.map(year => (
                    <th key={year} className="px-4 py-2 text-right font-medium">{year}</th>
                  ))}
                  <th className="px-4 py-2 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => (
                  <tr key={item.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-2">{item.codigo}</td>
                    <td className="px-4 py-2">
                      <EditableCell
                        value={item.gerente || ""}
                        onSave={(value: string) => handleCellSave(item.id, "gerente", value)}
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-400">
                      {formatCurrency(item.vl10eTotal || 0)}
                    </td>
                    {YEARS.map(year => (
                      <td key={year} className="px-4 py-2 text-right">
                        <EditableCell
                          value={formatCurrency(item[`ano${year}` as keyof typeof item] as number || 0)}
                          onSave={(value: string) => handleCellSave(item.id, `ano${year}`, value)}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Row Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Linha - Cookit Antigo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código *</Label>
              <Input
                type="number"
                value={newRow.codigo}
                onChange={(e) => setNewRow({ ...newRow, codigo: e.target.value })}
                placeholder="Ex: 99"
              />
            </div>
            <div>
              <Label>Gerente</Label>
              <Input
                value={newRow.gerente}
                onChange={(e) => setNewRow({ ...newRow, gerente: e.target.value })}
                placeholder="Nome do gerente"
              />
            </div>
            {YEARS.map(year => (
              <div key={year}>
                <Label>{year}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newRow[`ano${year}`] || ""}
                  onChange={(e) => setNewRow({ ...newRow, [`ano${year}`]: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleAddRow}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja deletar este registro?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingId) deleteMut.mutate({ id: deletingId });
              }}
            >
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <CookitAntigoPreviewModal
        open={showPreview}
        data={previewData}
        isLoading={isImporting}
        progress={importProgress}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
      />
    </div>
  );
}
