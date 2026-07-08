import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exportToExcel, formatCurrency, formatPercent, formatNumber } from "@/lib/excel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EditableCell } from "@/components/EditableCell";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Download, Plus, Trash2, Search, ArrowLeft, BarChart3, Upload } from "lucide-react";

const CHART_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#ec4899","#84cc16","#f97316","#6366f1",
];

interface Coluna {
  chave: string;
  label: string;
  tipo: "texto" | "numero" | "moeda" | "percentual";
}

interface Grafico {
  tipo: "barras" | "linhas" | "pizza";
  titulo: string;
  eixoX: string;
  eixoY: string[];
}

interface Estrutura {
  tipo: "tabela" | "grafico" | "misto";
  colunas: Coluna[];
  graficos: Grafico[];
}

function formatValue(value: unknown, tipo: string): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (tipo === "moeda") return formatCurrency(num);
  if (tipo === "percentual") return formatPercent(num);
  if (tipo === "numero") return formatNumber(num);
  return String(value);
}

export default function MenuDinamico() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const utils = trpc.useUtils();

  const { data: menu, isLoading } = trpc.menus.get.useQuery({ id });
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const updateMut = trpc.menus.update.useMutation({
    onSuccess: () => { utils.menus.get.invalidate({ id }); toast.success("Atualizado!"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Carregando menu...</div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Menu não encontrado.</p>
        <Link href="/menus"><Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</Button></Link>
      </div>
    );
  }

  const estrutura = menu.estrutura as Estrutura;
  const dados = (menu.dados as Record<string, unknown>[]) || [];
  const colunas = estrutura?.colunas || [];
  const graficos = estrutura?.graficos || [];

  const filtered = dados.filter(row =>
    colunas.some(c => String(row[c.chave] ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  function handleCellSave(rowIdx: number, chave: string, value: string) {
    const updated = [...dados];
    updated[rowIdx] = { ...updated[rowIdx], [chave]: value };
    updateMut.mutate({ id, dados: updated });
  }

  function handleAddRow() {
    const updated = [...dados, { ...newRow }];
    updateMut.mutate({ id, dados: updated });
    setShowAdd(false);
    setNewRow({});
    toast.success("Linha adicionada!");
  }

  function handleDeleteRow(idx: number) {
    const updated = dados.filter((_, i) => i !== idx);
    updateMut.mutate({ id, dados: updated });
    setDeletingIdx(null);
    toast.success("Linha removida!");
  }

  function handleExport() {
    const rows = filtered.map(row => {
      const obj: Record<string, unknown> = {};
      colunas.forEach(c => { obj[c.label] = row[c.chave]; });
      return obj;
    });
    exportToExcel(rows, menu?.nome ?? "export", menu?.nome ?? "Dados");
    toast.success("Arquivo exportado!");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/execute", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao importar arquivo");
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Importação concluída! ${result.totalOk} registros atualizados.`);
        utils.menus.get.invalidate({ id });
      } else {
        toast.error("Erro na importação");
      }
    } catch (error) {
      toast.error("Erro ao importar arquivo");
      console.error(error);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/menus">
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{menu.nome}</h1>
            {menu.descricao && <p className="text-sm text-muted-foreground mt-0.5">{menu.descricao}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
            />
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs border-border cursor-pointer" disabled={isImporting} asChild>
              <span>
                <Upload className="w-3.5 h-3.5" /> {isImporting ? "Importando..." : "Importar"}
              </span>
            </Button>
          </label>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 h-8 text-xs border-border">
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Nova Linha
          </Button>
        </div>
      </div>

      {/* Gráficos */}
      {graficos.length > 0 && (
        <div className={`grid gap-4 ${graficos.length > 1 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {graficos.map((g, gi) => (
            <Card key={gi} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">{g.titulo}</CardTitle>
                  <Badge variant="secondary" className="text-xs capitalize">{g.tipo}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  {g.tipo === "pizza" ? (
                    <PieChart>
                      <Pie data={filtered} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        dataKey={g.eixoY[0]} nameKey={g.eixoX} paddingAngle={2}>
                        {filtered.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  ) : g.tipo === "linhas" ? (
                    <LineChart data={filtered} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 240)" vertical={false} />
                      <XAxis dataKey={g.eixoX} tick={{ fontSize: 11, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      {g.eixoY.map((y, yi) => (
                        <Line key={y} type="monotone" dataKey={y} stroke={CHART_COLORS[yi]} strokeWidth={2} dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={filtered} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 240)" vertical={false} />
                      <XAxis dataKey={g.eixoX} tick={{ fontSize: 11, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      {g.eixoY.map((y, yi) => (
                        <Bar key={y} dataKey={y} fill={CHART_COLORS[yi]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabela */}
      {(estrutura?.tipo === "tabela" || estrutura?.tipo === "misto") && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">Dados</CardTitle>
                <Badge variant="secondary">{filtered.length} registros</Badge>
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
                    {colunas.map(c => (
                      <th key={c.chave} className="text-left px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider">
                        {c.label}
                      </th>
                    ))}
                    <th className="text-right px-3 py-3 font-semibold text-muted-foreground uppercase tracking-wider w-16">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={colunas.length + 1} className="text-center py-12 text-muted-foreground">
                      Nenhum dado. Clique em "Nova Linha" para adicionar.
                    </td></tr>
                  ) : filtered.map((row, ri) => (
                    <tr key={ri} className={`border-b border-border/50 hover:bg-accent/20 transition-colors ${ri % 2 === 0 ? "" : "bg-muted/5"}`}>
                      {colunas.map(c => (
                        <td key={c.chave} className="px-3 py-2">
                          <EditableCell
                            value={row[c.chave] as string | number | null}
                            onSave={v => handleCellSave(ri, c.chave, v)}
                            type={c.tipo !== "texto" ? "number" : "text"}
                            formatter={v => formatValue(v, c.tipo)}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingIdx(ri)}>
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
      )}

      {/* Add row dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Linha</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {colunas.map(c => (
              <div key={c.chave}>
                <Label className="text-xs text-muted-foreground">{c.label}</Label>
                <Input
                  type={c.tipo !== "texto" ? "number" : "text"}
                  value={newRow[c.chave] || ""}
                  onChange={e => setNewRow(p => ({ ...p, [c.chave]: e.target.value }))}
                  placeholder={c.tipo === "moeda" ? "0.00" : c.tipo === "percentual" ? "0.0000" : ""}
                  className="mt-1 bg-input border-border"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleAddRow} disabled={updateMut.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deletingIdx !== null} onOpenChange={() => setDeletingIdx(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja remover esta linha?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingIdx(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletingIdx !== null && handleDeleteRow(deletingIdx)}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
