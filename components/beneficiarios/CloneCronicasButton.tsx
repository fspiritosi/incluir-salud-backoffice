"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface CloneCronicasButtonProps {
  pacienteId: string;
  eligibleCount: number;
}

export function CloneCronicasButton({ pacienteId, eligibleCount }: CloneCronicasButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleClone = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/clonar-cronicas`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "No se pudieron clonar las prestaciones");
      }
      toast({
        title: "Prestaciones clonadas",
        description: `Se crearon ${payload?.created ?? 0} y se omitieron ${payload?.skipped ?? 0}.`,
      });
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudieron clonar las prestaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => !loading && setOpen(value)}>
      <DialogTrigger asChild>
        <Button>
          <Copy className="mr-2 h-4 w-4" />
          Clonar crónicas al próximo mes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clonar prestaciones crónicas</DialogTitle>
          <DialogDescription>
            {eligibleCount > 0
              ? `Se van a copiar ${eligibleCount} prestaciones crónicas del mes en curso hacia el próximo mes.`
              : "No hay prestaciones crónicas elegibles este mes, pero podés ejecutar la acción igualmente."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleClone} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
