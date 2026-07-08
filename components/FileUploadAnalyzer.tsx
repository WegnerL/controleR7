import { useState, useRef } from "react";
import { useFileAnalyzer, AnalyzedFile } from "@/hooks/useFileAnalyzer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, AlertCircle, CheckCircle2, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadAnalyzerProps {
  onAnalyzed: (file: AnalyzedFile, menuName: string, menuDescription: string) => void;
}

export function FileUploadAnalyzer({ onAnalyzed }: FileUploadAnalyzerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { analyzeFile, analyzing, error } = useFileAnalyzer();
  const [analyzed, setAnalyzed] = useState<AnalyzedFile | null>(null);
  const [menuName, setMenuName] = useState("");
  const [menuDescription, setMenuDescription] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|csv|xls)$/i)) {
      alert("Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV");
      return;
    }

    const result = await analyzeFile(file);
    if (result) {
      setAnalyzed(result);
      // Sugerir nome baseado no arquivo
      const suggestedName = file.name.replace(/\.[^/.]+$/, "");
      setMenuName(suggestedName);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!analyzed || !menuName.trim()) {
      alert("Por favor, preencha o nome do menu");
      return;
    }
    onAnalyzed(analyzed, menuName, menuDescription);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm">Importar Arquivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleChange}
              className="hidden"
            />
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste um arquivo aqui ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">Formatos suportados: Excel (.xlsx, .xls) ou CSV</p>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {analyzing && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader className="w-4 h-4 animate-spin" />
              Analisando arquivo...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Preview */}
      {analyzed && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Análise do Arquivo
              </CardTitle>
              <Badge variant="secondary">{analyzed.rowCount} linhas</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Informações do arquivo */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground font-medium">Arquivo</p>
                <p className="text-foreground">{analyzed.fileName}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Aba</p>
                <p className="text-foreground">{analyzed.sheetName}</p>
              </div>
            </div>

            {/* Colunas detectadas */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Colunas Detectadas</p>
              <div className="flex flex-wrap gap-2">
                {analyzed.columns.map((col) => (
                  <Badge key={col.name} variant="outline" className="text-xs">
                    {col.name}
                    <span className="ml-1 text-muted-foreground">({col.type})</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Amostra de dados */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Amostra de Dados</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {analyzed.columns.map((col) => (
                        <th key={col.name} className="text-left px-2 py-1 text-muted-foreground font-medium">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analyzed.sampleData.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        {analyzed.columns.map((col) => (
                          <td key={`${idx}-${col.name}`} className="px-2 py-1 text-foreground">
                            {String(row[col.name] || "-")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Configuração do menu */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div>
                <Label className="text-xs font-semibold">Nome do Menu</Label>
                <Input
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder="Ex: Relatório Mensal"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Descrição (opcional)</Label>
                <Textarea
                  value={menuDescription}
                  onChange={(e) => setMenuDescription(e.target.value)}
                  placeholder="Descreva o propósito deste menu..."
                  className="mt-1 h-16 text-xs resize-none"
                />
              </div>
              <Button
                onClick={handleSubmit}
                className="w-full h-8 text-xs"
              >
                Criar Menu com estes Dados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
