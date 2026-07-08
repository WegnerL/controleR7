import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { SEED_DATA } from "@/lib/seedData";

export default function SeedPage() {
  const { data: seedStatus, isLoading: checkingStatus } = trpc.seed.isSeeded.useQuery();
  const utils = trpc.useUtils();

  const seedMut = trpc.seed.seedData.useMutation({
    onSuccess: () => {
      utils.seed.isSeeded.invalidate();
      utils.filiais.list.invalidate();
      utils.faturamentos.list.invalidate();
      utils.perdas.list.invalidate();
      utils.inventarios.list.invalidate();
      toast.success("Dados importados com sucesso! 23 filiais, inventários, faturamentos e perdas carregados.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Importação de Dados</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Importar dados iniciais da planilha ControleR7.xlsx</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Status do Banco de Dados</CardTitle>
          </div>
          <CardDescription>
            Verifique se os dados já foram importados antes de executar novamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {checkingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Verificando status...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
              {seedStatus?.seeded ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Dados já importados</p>
                    <p className="text-xs text-muted-foreground">O banco de dados já contém os dados da planilha.</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">Concluído</Badge>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Banco de dados vazio</p>
                    <p className="text-xs text-muted-foreground">Clique em "Importar Dados" para carregar os dados da planilha.</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-amber-400 border-amber-400/30">Pendente</Badge>
                </>
              )}
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground text-xs uppercase tracking-wider">O que será importado:</p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> 23 filiais com gerentes e coordenadores</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Dados de inventários rotativos por mês</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Dados de faturamento mensal por filial</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Dados de perdas e percentuais por filial</li>
            </ul>
          </div>

          <Button
            onClick={() => seedMut.mutate(SEED_DATA)}
            disabled={seedMut.isPending || seedStatus?.seeded}
            className="w-full gap-2"
          >
            {seedMut.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Importando dados...</>
            ) : seedStatus?.seeded ? (
              <><CheckCircle className="w-4 h-4" /> Dados já importados</>
            ) : (
              <><Database className="w-4 h-4" /> Importar Dados da Planilha</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
