import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, MONTHS_FULL } from "@/lib/excel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Building2, Package, AlertTriangle, DollarSign,
  Filter, X, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#ec4899","#84cc16","#f97316","#6366f1",
  "#14b8a6","#a855f7","#eab308","#22c55e","#0ea5e9",
];

const ANOS = [2026];

function MultiSelect({ label, options, selected, onChange, icon: Icon }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  icon?: React.ElementType;
}) {
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(s => s !== v));
    else onChange([...selected, v]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs border-border bg-card hover:bg-accent">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          <span>{label}</span>
          {selected.length > 0 && selected.length < options.length && (
            <Badge variant="secondary" className="text-xs px-1 py-0 h-4">{selected.length}</Badge>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52 bg-popover border-border" align="start">
        <div className="px-2 py-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
          <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => onChange([])}>
            Todos
          </Button>
        </div>
        <Separator className="mb-1" />
        <div className="max-h-56 overflow-y-auto">
          {options.map(opt => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={selected.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              className="text-xs"
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatCard({ title, value, sub, icon: Icon, trend, color }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  return (
    <Card className="bg-card border-border stat-card-gradient">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <p className="text-xl font-bold text-foreground truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color || "bg-primary/15")}>
            <Icon className={cn("w-5 h-5", color ? "text-white" : "text-primary")} />
          </div>
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 mt-3 text-xs font-medium",
            trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"
          )}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            {typeof p.value === "number" ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground mt-1">
        Perdas: <span className="text-red-400 font-medium">{formatCurrency(item.value)}</span>
      </p>
      {item.payload.pct !== undefined && (
        <p className="text-muted-foreground">
          Participação: <span className="font-medium text-foreground">{item.payload.pct.toFixed(1)}%</span>
        </p>
      )}
    </div>
  );
};

export default function Dashboard() {
  const [selectedFiliais, setSelectedFiliais] = useState<string[]>([]);
  const [selectedMeses, setSelectedMeses] = useState<string[]>([]);
  const [selectedAnos, setSelectedAnos] = useState<string[]>(["2026"]);
  // Seletor de filial para o gráfico Faturamento Mensal
  const [filialGrafico, setFilialGrafico] = useState<string>("todas");

  // Atualização automática a cada 30 segundos
  const refetchOpts = { refetchInterval: 30_000 };
  const { data: faturamentosData } = trpc.faturamentos.list.useQuery({}, refetchOpts);
  const { data: perdasData } = trpc.perdas.list.useQuery({}, refetchOpts);
  const { data: filiaisData } = trpc.filiais.list.useQuery(undefined, refetchOpts);
  const { data: inventariosData } = trpc.inventarios.list.useQuery({}, refetchOpts);

  const filialOptions = useMemo(() =>
    (filiaisData || []).map(f => ({ value: String(f.codigo), label: `${f.codigo} - ${f.gerente}` })),
    [filiaisData]
  );

  const mesOptions = MONTHS_FULL.map(m => ({ value: m.key, label: m.label }));
  const anoOptions = ANOS.map(a => ({ value: String(a), label: String(a) }));

  const activeMeses = selectedMeses.length > 0 ? selectedMeses : MONTHS_FULL.map(m => m.key);
  const activeFiliais = selectedFiliais.length > 0 ? selectedFiliais : filialOptions.map(f => f.value);

  // Filter data
  const filteredFat = useMemo(() => {
    return (faturamentosData || []).filter((f: any) =>
      activeFiliais.includes(String(f.filial)) &&
      (selectedAnos.length === 0 || selectedAnos.includes(String(f.ano)))
    );
  }, [faturamentosData, activeFiliais, selectedAnos]);

  const filteredPerdas = useMemo(() => {
    return (perdasData || []).filter(p =>
      activeFiliais.includes(String(p.filial)) &&
      (selectedAnos.length === 0 || selectedAnos.includes(String(p.ano)))
    );
  }, [perdasData, activeFiliais, selectedAnos]);

  // KPIs
  const totalFaturamento = useMemo(() =>
    filteredFat.reduce((sum: any, f: any) => {
      const v = activeMeses.reduce((s: any, m: any) => s + ((f as any)[m] || 0), 0);
      return sum + v;
    }, 0), [filteredFat, activeMeses]);

  const totalPerdas = useMemo(() =>
    filteredPerdas.reduce((sum, p) => {
      const v = activeMeses.reduce((s, m) => s + ((p as any)[m] || 0), 0);
      return sum + v;
    }, 0), [filteredPerdas, activeMeses]);

  const totalFiliais = filiaisData?.length || 0;
  const totalInventarios = inventariosData?.length || 0;

  // ─── Gráfico: Faturamento Mensal com seletor de filial + perdas ───────────────
  const faturamentoMensalData = useMemo(() => {
    // Determinar quais registros de faturamento e perdas usar
    const fatRows = filialGrafico === "todas"
      ? filteredFat
      : filteredFat.filter((f: any) => String(f.filial) === filialGrafico);
    const perdasRows = filialGrafico === "todas"
      ? filteredPerdas
      : filteredPerdas.filter(p => String(p.filial) === filialGrafico);

    return activeMeses.map(m => {
      const mes = MONTHS_FULL.find(x => x.key === m);
      const faturamento = fatRows.reduce((s: any, f: any) => s + ((f as any)[m] || 0), 0);
      const perdaTotal = Math.abs(perdasRows.reduce((s: any, p: any) => s + ((p as any)[m] || 0), 0));

      // Perda aceitável = (Meta% / 100) × Faturamento do mês (por filial selecionada ou consolidado)
      let perdaAceitavel = 0;
      if (filialGrafico === "todas") {
        perdaAceitavel = perdasRows.reduce((s: any, p: any) => {
          const fatFilial = fatRows.find((f: any) => f.filial === p.filial);
          const fatMes = fatFilial ? ((fatFilial as any)[m] || 0) : 0;
          const meta = p.metaPerdaPct ? Math.abs(p.metaPerdaPct) / 100 : 0;
          return s + meta * fatMes;
        }, 0);
      } else {
        const perdaRow = perdasRows[0];
        const fatRow = fatRows[0];
        if (perdaRow && fatRow && perdaRow.metaPerdaPct) {
          perdaAceitavel = (Math.abs(perdaRow.metaPerdaPct) / 100) * ((fatRow as any)[m] || 0);
        }
      }

      return {
        mes: mes?.label.slice(0, 3) || m,
        faturamento,
        perdaTotal,
        perdaAceitavel,
      };
    });
  }, [filteredFat, filteredPerdas, activeMeses, filialGrafico]);

  // ─── Gráfico: Evolução de Perdas — sempre consolidado (todos os filtros globais, ignora seletor de filial) ───
  const evolucaoPerdasData = useMemo(() => {
    return activeMeses.map(m => {
      const mes = MONTHS_FULL.find(x => x.key === m);
      const perdaTotal = Math.abs(filteredPerdas.reduce((s: any, p: any) => s + ((p as any)[m] || 0), 0));
      // Perda aceitável consolidada = soma de ((Meta% / 100) × Faturamento do mês) por filial
      const perdaAceitavel = filteredPerdas.reduce((s: any, p: any) => {
        const fatFilial = filteredFat.find((f: any) => f.filial === p.filial);
        const fatMes = fatFilial ? ((fatFilial as any)[m] || 0) : 0;
        const meta = p.metaPerdaPct ? Math.abs(p.metaPerdaPct) / 100 : 0;
        return s + meta * fatMes;
      }, 0);
      return { mes: mes?.label.slice(0, 3) || m, perdaTotal, perdaAceitavel };
    });
  }, [filteredFat, filteredPerdas, activeMeses]);

  // ─── Gráfico: Pizza - participação de cada filial no total de perdas ──────────
  const perdasPorFilialPizza = useMemo(() => {
    const totalAbs = filteredPerdas.reduce((s, p) => {
      return s + Math.abs(activeMeses.reduce((ms, m) => ms + ((p as any)[m] || 0), 0));
    }, 0);

    return filteredPerdas
      .map(p => {
        const valor = Math.abs(activeMeses.reduce((s, m) => s + ((p as any)[m] || 0), 0));
        const pct = totalAbs > 0 ? (valor / totalAbs) * 100 : 0;
        return { name: `F${p.filial}`, value: valor, pct };
      })
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredPerdas, activeMeses]);

  const hasFilters = selectedFiliais.length > 0 || selectedMeses.length > 0 || selectedAnos.length > 0;

  const clearFilters = () => {
    setSelectedFiliais([]);
    setSelectedMeses([]);
    setSelectedAnos(["2026"]);
  };

  // Renderizar label customizado na pizza
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }: any) => {
    if (pct < 3) return null; // Não mostrar label para fatias muito pequenas
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="600">
        {pct.toFixed(1)}%
      </text>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada de todas as filiais</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <MultiSelect label="Filiais" options={filialOptions} selected={selectedFiliais} onChange={setSelectedFiliais} icon={Building2} />
          <MultiSelect label="Meses" options={mesOptions} selected={selectedMeses} onChange={setSelectedMeses} />
          <MultiSelect label="Anos" options={anoOptions} selected={selectedAnos} onChange={setSelectedAnos} />
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento Total"
          value={formatCurrency(totalFaturamento)}
          sub={`${activeFiliais.length} filiais`}
          icon={DollarSign}
          trend="up"
          color="bg-blue-500/20"
        />
        <StatCard
          title="Total de Perdas"
          value={formatCurrency(Math.abs(totalPerdas))}
          sub={`${((Math.abs(totalPerdas) / (totalFaturamento || 1)) * 100).toFixed(2)}% do fat.`}
          icon={AlertTriangle}
          trend="down"
          color="bg-red-500/20"
        />
        <StatCard
          title="Filiais Ativas"
          value={String(totalFiliais)}
          sub="cadastradas no sistema"
          icon={Building2}
          color="bg-emerald-500/20"
        />
        <StatCard
          title="Inventários"
          value={String(totalInventarios)}
          sub="registros no sistema"
          icon={Package}
          color="bg-purple-500/20"
        />
      </div>

      {/* Charts Row 1: Faturamento Mensal (com seletor de filial + perdas) + Pizza de perdas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Faturamento Mensal com seletor de filial */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-sm font-semibold">Perdas por Mês</CardTitle>
                <CardDescription className="text-xs">Perda Total e Perda Aceitável por mês</CardDescription>
              </div>
              {/* Seletor de filial */}
              <Select value={filialGrafico} onValueChange={setFilialGrafico}>
                <SelectTrigger className="w-44 h-8 text-xs bg-card border-border">
                  <SelectValue placeholder="Todas as filiais" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-60">
                  <SelectItem value="todas" className="text-xs">Todas as filiais</SelectItem>
                  {filialOptions.map(f => (
                    <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={faturamentoMensalData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 240)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "oklch(0.58 0.015 240)" }} />
                <Bar dataKey="perdaTotal" name="Perda Total" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="perdaAceitavel" name="Perda Aceitável" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pizza: Participação nas perdas por filial */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Participação nas Perdas</CardTitle>
            <CardDescription className="text-xs">% de cada filial no total de perdas</CardDescription>
          </CardHeader>
          <CardContent>
            {perdasPorFilialPizza.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">
                Sem dados de perdas
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={perdasPorFilialPizza}
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={1}
                      labelLine={false}
                      label={renderPieLabel}
                    >
                      {perdasPorFilialPizza.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legenda com valores */}
                <div className="space-y-1 mt-2 max-h-36 overflow-y-auto pr-1">
                  {perdasPorFilialPizza.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-red-400 font-medium">{formatCurrency(p.value)}</span>
                        <span className="text-muted-foreground w-10 text-right">{p.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Evolução de Perdas */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução de Perdas</CardTitle>
            <CardDescription className="text-xs">Perdas acumuladas por mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={evolucaoPerdasData}
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 240)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.58 0.015 240)" }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "oklch(0.58 0.015 240)" }} />
                <Line type="monotone" dataKey="perdaTotal" name="Perda Total" stroke={CHART_COLORS[3]} strokeWidth={2}
                  dot={{ fill: CHART_COLORS[3], r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="perdaAceitavel" name="Perda Aceitável" stroke="#f59e0b" strokeWidth={2}
                  strokeDasharray="5 3" dot={{ fill: "#f59e0b", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
