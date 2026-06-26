"use client";

import { useState, useTransition } from "react";
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
import { programarPrestacionesCronicasManual } from "@/app/protected/prestaciones/actions";

export function CloneCronicasGlobalButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await programarPrestacionesCronicasManual();
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Prestaciones generadas",
          description: "Se crearon las prestaciones crónicas para el próximo mes.",
        });
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Copy className="mr-2 h-4 w-4" />
          Generar próximo mes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar prestaciones crónicas</DialogTitle>
          <DialogDescription>
            Esta acción copiará todas las prestaciones con <b>crónico = sí</b> del mes actual al próximo mes, respetando el día y horario de cada una. Las que ya existan serán omitidas automáticamente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
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
