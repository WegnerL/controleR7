import { AnalyzedFile } from "@/hooks/useFileAnalyzer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface MenuPreviewFromFileProps {
  analyzed: AnalyzedFile;
  menuName: string;
  menuDescription: string;
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export function MenuPreviewFromFile({ analyzed, menuName, menuDescription }: MenuPreviewFromFileProps) {
  // Detectar colunas numéricas para gráficos
  const numericCols = analyzed.columns.filter(c => c.type === "numero" || c.type === "moeda").map(c => c.name);
  const textCols = analyzed.columns.filter(c => c.type === "texto").map(c => c.name);
  const firstTextCol = textCols[0];

  // Preparar dados para gráficos
  const chartData = analyzed.sampleData.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-lg">{menuName}</CardTitle>
            {menuDescription && (
              <p className="text-sm text-muted-foreground">{menuDescription}</p>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-medium">Total de Registros</p>
            <p className="text-2xl font-bold text-primary mt-1">{analyzed.rowCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-medium">Colunas</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{analyzed.columns.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-medium">Numéricos</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{numericCols.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-medium">Texto</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{textCols.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm">Visualização dos Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {analyzed.columns.map((col) => (
                    <th
                      key={col.name}
                      className="text-left px-3 py-2 text-muted-foreground font-semibold"
                    >
                      {col.name}
                      <Badge variant="outline" className="ml-2 text-xs">{col.type}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analyzed.sampleData.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-primary/5">
                    {analyzed.columns.map((col) => (
                      <td key={`${idx}-${col.name}`} className="px-3 py-2 text-foreground">
                        {col.type === "moeda" ? `R$ ${Number(row[col.name]).toFixed(2)}` : String(row[col.name] || "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      {numericCols.length > 0 && firstTextCol && chartData.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Gráfico de Barras */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Comparativo por {firstTextCol}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey={firstTextCol} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }} />
                  <Legend />
                  {numericCols.slice(0, 2).map((col, idx) => (
                    <Bar key={col} dataKey={col} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          {numericCols.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-sm">Distribuição - {numericCols[0]}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey={numericCols[0]}
                      nameKey={firstTextCol}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Informações de Estrutura */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm">Estrutura Detectada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground mb-2">Colunas por Tipo:</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Texto:</p>
                  <p className="text-foreground">{textCols.join(", ") || "Nenhuma"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Numérico:</p>
                  <p className="text-foreground">{numericCols.join(", ") || "Nenhuma"}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
