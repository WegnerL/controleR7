import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, ChevronRight, Layers,
  BarChart2, Package, TrendingDown, Database, Info,
  Calendar, BarChart3
} from "lucide-react";

interface SheetPreview {
  sheetName: string;
  type: "filiais" | "inventarios" | "faturamentos" | "perdas" | "contagem_semanal" | "fechamentos" | "vl10e" | "unknown";
  count: number;
  detectedYear?: number | null;
  preview: Record<string, unknown>[];
  headers?: string[];
}

interface PreviewResponse {
  fileName: string;
  globalYear: number;
  sheets: SheetPreview[];
}

// Legacy compat
type PreviewResult = PreviewResponse;

interface ImportResult {
  success: boolean;
  totalOk: number;
  totalErrors: number;
  totalSkipped?: number;
  ano?: number;
  results: Record<string, { ok: number; skipped?: number; errors: string[]; type: string }>;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  filiais:          { label: "Dados das Filiais",  icon: Database,    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30" },
  inventarios:      { label: "Inventários",        icon: Package,     color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  faturamentos:     { label: "Faturamentos",       icon: BarChart2,   color: "text-green-400",   bg: "bg-green-500/10 border-green-500/30" },
  perdas:           { label: "Perdas",             icon: TrendingDown,color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
  contagem_semanal: { label: "Contagem Semanal",   icon: Calendar,    color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30" },
  fechamentos:      { label: "Fechamentos",        icon: BarChart3,   color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/30" },
  vl10e:            { label: "VL10E",              icon: BarChart2,   color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30" },
  unknown:          { label: "Não identificada",   icon: AlertCircle, color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/30" },
};

export default function Importar() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/import/preview", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao processar arquivo");
      }
      const data: PreviewResult = await res.json();
      setPreview(data);
    } catch (e) {
      toast.error("Erro ao ler arquivo: " + String(e));
      setFile(null);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoadingImport(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("ano", String(ano));
      const res = await fetch("/api/import/execute", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao importar");
      }
      const data: ImportResult = await res.json();
      setResult(data);
      // Invalidate all queries so all modules refresh automatically
      await utils.filiais.list.invalidate();
      await utils.inventarios.list.invalidate();
      await utils.faturamentos.list.invalidate();
      await utils.perdas.list.invalidate();
      try { await utils.contagemSemanal.list.invalidate(); } catch {}
      try { await utils.fechamentos.list.invalidate(); } catch {}
      try { await (utils as any).filiais.listWithPerdas.invalidate(); } catch {}
      if (data.totalOk > 0) {
        toast.success(`Importação concluída! ${data.totalOk} registros atualizados.`);
      }
      if (data.totalErrors > 0) {
        toast.warning(`${data.totalErrors} erros durante a importação.`);
      }
    } catch (e) {
      toast.error("Erro na importação: " + String(e));
    } finally {
      setLoadingImport(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validSheets = preview?.sheets.filter(s => s.type !== "unknown" && s.count > 0) ?? [];
  const unknownSheets = preview?.sheets.filter(s => s.type === "unknown" || s.count === 0) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Importar Planilha</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Importe um arquivo Excel (.xlsx) para atualizar automaticamente todos os módulos do sistema
            </p>
          </div>
          {file && (
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Nova importação
            </Button>
          )}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <p className="text-sm text-cyan-300/80 leading-relaxed">
            O sistema detecta automaticamente as abas da planilha e identifica os módulos correspondentes
            (Filiais, Inventários, Faturamentos e Perdas). Os dados existentes serão <strong>atualizados</strong> — nenhum registro será excluído.
          </p>
        </div>

        {/* Drop zone */}
        {!file && (
          <div
            className={`relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-16 cursor-pointer transition-all duration-200
              ${dragging
                ? "border-cyan-400 bg-cyan-500/10 scale-[1.01]"
                : "border-border hover:border-cyan-500/50 hover:bg-white/[0.02]"
              }`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`p-5 rounded-2xl transition-colors ${dragging ? "bg-cyan-500/20" : "bg-white/5"}`}>
              <Upload className={`w-10 h-10 transition-colors ${dragging ? "text-cyan-400" : "text-muted-foreground"}`} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                {dragging ? "Solte o arquivo aqui" : "Arraste e solte seu arquivo Excel"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground/60 mt-2">Suporta .xlsx e .xls — até 20MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        )}

        {/* Loading preview */}
        {loadingPreview && (
          <div className="flex items-center justify-center gap-3 py-12 rounded-xl border border-border bg-card">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-sm text-muted-foreground">Analisando arquivo...</span>
          </div>
        )}

        {/* File selected + preview */}
        {file && preview && !loadingPreview && (
          <div className="flex flex-col gap-4">
            {/* File info */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{preview.fileName}</p>
                <p className="text-xs text-muted-foreground">{preview.sheets.length} aba(s) detectada(s)</p>
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">
                Pronto
              </Badge>
            </div>

            {/* Ano selector */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Ano de referência dos dados:</span>
              <select
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
                className="ml-auto bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {[2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Detected sheets */}
            {validSheets.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Abas identificadas para importação</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{validSheets.length} aba(s) serão importadas</p>
                </div>
                <div className="divide-y divide-border">
                  {validSheets.map(sheet => {
                    const cfg = TYPE_CONFIG[sheet.type];
                    const Icon = cfg.icon;
                    return (
                      <div key={sheet.sheetName} className="flex items-center gap-4 px-4 py-3">
                        <div className={`p-2 rounded-lg border ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{sheet.sheetName}</p>
                          <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-foreground">{sheet.count}</span>
                          <span className="text-xs text-muted-foreground ml-1">registros</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unknown sheets */}
            {unknownSheets.length > 0 && (
              <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-700/40">
                  <h3 className="text-sm font-medium text-zinc-400">Abas não identificadas (serão ignoradas)</h3>
                </div>
                <div className="divide-y divide-zinc-700/30">
                  {unknownSheets.map(sheet => (
                    <div key={sheet.sheetName} className="flex items-center gap-3 px-4 py-2.5">
                      <AlertCircle className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-500">{sheet.sheetName}</span>
                      <span className="text-xs text-zinc-600 ml-auto">{sheet.count} linhas</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action button */}
            {validSheets.length > 0 && !result && (
              <Button
                onClick={handleImport}
                disabled={loadingImport}
                className="w-full h-12 text-base font-semibold bg-cyan-600 hover:bg-cyan-500 text-white gap-2"
              >
                {loadingImport ? (
                  <><RefreshCw className="w-5 h-5 animate-spin" /> Importando...</>
                ) : (
                  <><Upload className="w-5 h-5" /> Importar e Atualizar Sistema</>
                )}
              </Button>
            )}

            {validSheets.length === 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-sm text-yellow-300/80">
                  Nenhuma aba reconhecida foi encontrada. Verifique se o arquivo contém abas com nomes como
                  <strong> Dados, Inventários, Faturamento</strong> ou <strong>Perdas</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Import result */}
        {result && (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className={`flex items-center gap-4 rounded-xl border p-5 ${
              result.totalErrors === 0
                ? "border-green-500/30 bg-green-500/5"
                : "border-yellow-500/30 bg-yellow-500/5"
            }`}>
              {result.totalErrors === 0 ? (
                <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0" />
              ) : (
                <AlertCircle className="w-8 h-8 text-yellow-400 shrink-0" />
              )}
              <div>
                <p className="text-base font-semibold text-foreground">
                  {result.totalErrors === 0 ? "Importação concluída com sucesso!" : "Importação concluída com avisos"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <span className="text-green-400 font-medium">{result.totalOk} registros</span> atualizados
                  {result.totalErrors > 0 && (
                    <>, <span className="text-red-400 font-medium">{result.totalErrors} erros</span></>
                  )}
                </p>
              </div>
            </div>

            {/* Per-sheet results */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Resultado por módulo</h3>
              </div>
              <div className="divide-y divide-border">
                {Object.entries(result.results).map(([sheetName, r]) => {
                  const cfg = TYPE_CONFIG[r.type] ?? TYPE_CONFIG.unknown;
                  const Icon = cfg.icon;
                  return (
                    <div key={sheetName} className="flex items-center gap-4 px-4 py-3">
                      <div className={`p-2 rounded-lg border ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{sheetName}</p>
                        <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.ok > 0 && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {r.ok} ok
                          </span>
                        )}
                        {r.errors.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <XCircle className="w-3.5 h-3.5" /> {r.errors.length} erros
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All modules updated notice */}
            <div className="flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-sm text-cyan-300/80">
                Todos os módulos foram atualizados automaticamente: <strong>Dashboard, Dados, Inventários, Faturamentos, Perdas, Contagem Semanal e Fechamentos</strong>.
                Acesse qualquer módulo para ver os dados atualizados.
              </p>
            </div>

            <Button variant="outline" onClick={handleReset} className="gap-2">
              <Upload className="w-4 h-4" /> Importar outro arquivo
            </Button>
          </div>
        )}
    </div>
  );
}
