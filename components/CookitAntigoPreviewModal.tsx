import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface PreviewData {
  yearsDetected: number[];
  totalRows: number;
  filialData: Record<number, Record<number, number>>;
  totalValue: number;
}

interface CookitAntigoPreviewModalProps {
  open: boolean;
  data: PreviewData | null;
  isLoading: boolean;
  progress?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CookitAntigoPreviewModal({
  open,
  data,
  isLoading,
  progress = 0,
  onConfirm,
  onCancel,
}: CookitAntigoPreviewModalProps) {
  if (!data) return null;

  const filialData = data.filialData || {};
  const filialCount = Object.keys(filialData).length || 0;
  const totalByYear: Record<number, number> = {};

  // Calculate totals by year
  Object.entries(filialData).forEach(([_, yearData]) => {
    if (yearData && typeof yearData === 'object') {
      Object.entries(yearData).forEach(([year, value]) => {
        const yearNum = parseInt(year, 10);
        if (!isNaN(yearNum) && typeof value === 'number') {
          totalByYear[yearNum] = (totalByYear[yearNum] || 0) + value;
        }
      });
    }
  });

  const sortedYears = Object.keys(totalByYear)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Pré-visualização de Importação - Cookit Antigo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="text-sm text-gray-600">Filiais Detectadas</div>
              <div className="text-2xl font-bold text-blue-600">{filialCount}</div>
            </Card>
            <Card className="p-4 bg-purple-50 border-purple-200">
              <div className="text-sm text-gray-600">Anos Detectados</div>
              <div className="text-2xl font-bold text-purple-600">{sortedYears.length}</div>
            </Card>
            <Card className="p-4 bg-green-50 border-green-200">
              <div className="text-sm text-gray-600">Total de Linhas</div>
              <div className="text-2xl font-bold text-green-600">{data.totalRows}</div>
            </Card>
          </div>

          {/* Years and Values */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Resumo por Ano</h3>
            <div className="space-y-2">
              {sortedYears.map((year) => (
                <div
                  key={year}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{year}</Badge>
                    <span className="text-sm text-gray-600">
                      {Object.values(data.filialData).filter((yd) => year in yd).length} filiais
                    </span>
                  </div>
                  <div className="font-semibold text-green-600">
                    R$ {(totalByYear[year] || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Value */}
          <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Valor Total a Importar</span>
              <span className="text-2xl font-bold text-green-600">
                R$ {data.totalValue.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Info Message */}
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              Verifique os dados acima antes de confirmar. Os valores serão distribuídos pelos anos detectados nas datas de remessa.
            </div>
          </div>

          {/* Progress Bar - shown during import */}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Importando...</span>
                <span className="text-sm font-semibold text-blue-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
            {isLoading ? "Importando..." : "Confirmar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
