"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, UserX, RotateCcw } from "lucide-react";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canCreateOrEditPaciente, canToggleBeneficiario } from "@/utils/permissions";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  direccion_completa: string;
  ciudad: string | null;
  provincia: string | null;
  activo: boolean | null;
};

interface BeneficiariosTableProps {
  data: Paciente[];
}

export function BeneficiariosTable({ data }: BeneficiariosTableProps) {
  const router = useRouter();
  const { roles, loading } = useBackofficeRoles();
  const canEdit = canCreateOrEditPaciente(roles);
  const canToggle = canToggleBeneficiario(roles);
  const [fNombre, setFNombre] = useState("");
  const [fApellido, setFApellido] = useState("");
  const [fDocumento, setFDocumento] = useState("");
  const [fCiudad, setFCiudad] = useState("");
  const [fProvincia, setFProvincia] = useState("");
  const [fActivo, setFActivo] = useState<"todos" | "si" | "no">("todos");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState<Paciente | null>(null);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const byNombre = row.nombre.toLowerCase().includes(fNombre.toLowerCase());
      const byApellido = row.apellido.toLowerCase().includes(fApellido.toLowerCase());
      const byDocumento = row.documento.toLowerCase().includes(fDocumento.toLowerCase());
      const byCiudad = (row.ciudad || "").toLowerCase().includes(fCiudad.toLowerCase());
      const byProvincia = (row.provincia || "").toLowerCase().includes(fProvincia.toLowerCase());
      const byActivo =
        fActivo === "todos" ? true : fActivo === "si" ? !!row.activo : !row.activo;
      return byNombre && byApellido && byDocumento && byCiudad && byProvincia && byActivo;
    });
  }, [data, fNombre, fApellido, fDocumento, fCiudad, fProvincia, fActivo]);

  const toggleActivo = async (row: Paciente) => {
    try {
      setBusyId(row.id);
      const res = await fetch(`/api/beneficiarios/${row.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !row.activo }),
      });
      if (!res.ok) {
        // Opcional: mostrar toast si existe en este ámbito
        console.error("No se pudo cambiar el estado");
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <Input placeholder="Filtrar nombre" value={fNombre} onChange={(e) => setFNombre(e.target.value)} />
        <Input placeholder="Filtrar apellido" value={fApellido} onChange={(e) => setFApellido(e.target.value)} />
        <Input placeholder="Filtrar documento" value={fDocumento} onChange={(e) => setFDocumento(e.target.value)} />
        <Input placeholder="Filtrar ciudad" value={fCiudad} onChange={(e) => setFCiudad(e.target.value)} />
        <Input placeholder="Filtrar provincia" value={fProvincia} onChange={(e) => setFProvincia(e.target.value)} />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={fActivo}
          onChange={(e) => setFActivo(e.target.value as any)}
        >
          <option value="todos">Activo (todos)</option>
          <option value="si">Sólo activos</option>
          <option value="no">Sólo inactivos</option>
        </select>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Apellido</th>
              <th className="text-left p-3">Documento</th>
              <th className="text-left p-3">Dirección</th>
              <th className="text-left p-3">Ciudad</th>
              <th className="text-left p-3">Provincia</th>
              <th className="text-left p-3">Activo</th>
              <th className="text-left p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.nombre}</td>
                <td className="p-3">{row.apellido}</td>
                <td className="p-3">{row.documento}</td>
                <td className="p-3">{row.direccion_completa}</td>
                <td className="p-3">{row.ciudad}</td>
                <td className="p-3">{row.provincia}</td>
                <td className="p-3">{row.activo ? "Sí" : "No"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {canEdit && !loading ? (
                      <Link href={`/protected/beneficiarios/editar/${row.id}`} aria-label="Editar">
                        <Button size="icon" variant="outline">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button size="icon" variant="outline" disabled title="No tenés permiso para editar beneficiarios" aria-disabled>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {row.activo ? (
                      <Button
                        size="icon"
                        variant="destructive"
                        aria-label="Baja"
                        disabled={busyId === row.id || !canToggle || loading}
                        title={!canToggle && !loading ? "No tenés permiso para dar de baja beneficiarios" : undefined}
                        onClick={() => { setTargetRow(row); setConfirmOpen(true); }}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="default"
                        aria-label="Re-activar"
                        disabled={busyId === row.id || !canToggle || loading}
                        title={!canToggle && !loading ? "No tenés permiso para re-activar beneficiarios" : undefined}
                        onClick={() => toggleActivo(row)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar baja</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Realmente desea dar de baja este beneficiario?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (targetRow) {
                  await toggleActivo(targetRow);
                }
                setConfirmOpen(false);
                setTargetRow(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
