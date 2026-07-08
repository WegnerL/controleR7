import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Edit2, Save, X } from "lucide-react";

export default function ModuleSettings() {
  const utils = trpc.useUtils();
  const { data: modules, isLoading } = trpc.modules.list.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const updateMut = trpc.modules.update.useMutation({
    onSuccess: async () => {
      await utils.modules.list.invalidate();
      toast.success("Configuração atualizada!");
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleEdit = (module: any) => {
    setEditingId(module.moduleId);
    setEditData({
      displayName: module.displayName,
      color: module.color,
      icon: module.icon,
      description: module.description,
    });
  };

  const handleSave = () => {
    if (!editingId) return;
    updateMut.mutate({
      moduleId: editingId,
      ...editData,
    });
  };

  if (isLoading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Configuração de Módulos</h1>
        <p className="text-muted-foreground">Edite nomes, cores e ícones dos módulos</p>
      </div>

      <div className="grid gap-4">
        {modules?.map((module) => (
          <Card key={module.moduleId} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {/* Color Preview */}
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-border"
                    style={{ backgroundColor: module.color }}
                  />

                  {/* Module Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{module.displayName}</h3>
                    <p className="text-sm text-muted-foreground">{module.moduleId}</p>
                    {module.description && (
                      <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                    )}
                  </div>
                </div>

                {/* Edit Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(module)}
                  className="gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Módulo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Display Name */}
            <div>
              <Label htmlFor="displayName">Nome do Módulo</Label>
              <Input
                id="displayName"
                value={editData.displayName || ""}
                onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                placeholder="Ex: VL10E, Vendas L10E"
              />
            </div>

            {/* Color */}
            <div>
              <Label htmlFor="color">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={editData.color || "#3b82f6"}
                  onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={editData.color || "#3b82f6"}
                  onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Icon */}
            <div>
              <Label htmlFor="icon">Ícone (Lucide)</Label>
              <Input
                id="icon"
                value={editData.icon || ""}
                onChange={(e) => setEditData({ ...editData, icon: e.target.value })}
                placeholder="Ex: BarChart3, Database, AlertTriangle"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nomes de ícones do Lucide Icons (ex: BarChart3, Database, AlertTriangle)
              </p>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={editData.description || ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                placeholder="Descrição do módulo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMut.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
