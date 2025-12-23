"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { MapPin, Pencil, UserX, Check, X } from "lucide-react";

type CentroTipo = "geriatrico" | "escuela" | "centro medico" | "otro";

type Centro = {
  id: string;
  nombre: string;
  tipo: CentroTipo;
  direccion_completa: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  radio_metros: number;
  activo: boolean | null;
  ubicacion?: any;
};

const TIPO_LABEL: Record<CentroTipo, string> = {
  geriatrico: "Geriátrico",
  escuela: "Escuela",
  "centro medico": "Centro médico",
  otro: "Otro",
};

export default function CentrosTable({ data }: { data: Centro[] }) {
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows = useMemo(() => data || [], [data]);

  const toggleActivo = async (centroId: string, activo: boolean) => {
    setPendingId(centroId);
    try {
      const res = await fetch(`/api/centros/${centroId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "No se pudo actualizar");
      }
      toast({ title: "Actualizado", description: "Estado del centro actualizado" });
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No se pudo actualizar", variant: "destructive" });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Dirección</th>
            <th className="px-4 py-3 font-medium">Radio</th>
            <th className="px-4 py-3 font-medium">Ubicación</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const isBusy = pendingId === c.id;
            const tieneUbic = !!c.ubicacion;
            return (
              <tr key={c.id} className="border-t border-border/60 bg-card hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{c.nombre}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{TIPO_LABEL[c.tipo] || c.tipo}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.direccion_completa}</td>
                <td className="px-4 py-3">{c.radio_metros} m</td>
                <td className="px-4 py-3">
                  {tieneUbic ? (
                    <span className="inline-flex items-center gap-2 text-green-700">
                      <MapPin className="h-4 w-4" />
                      OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-red-700">
                      <MapPin className="h-4 w-4" />
                      Falta
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.activo ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <X className="w-3 h-3 mr-1" />
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/protected/centros/editar/${c.id}`}>
                      <Button size="sm" variant="outline">
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant={c.activo ? "destructive" : "default"}
                      disabled={isBusy}
                      onClick={() => toggleActivo(c.id, !c.activo)}
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      {c.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                No hay centros cargados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
