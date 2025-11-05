"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canCreateOrEditPrestacion } from "@/utils/permissions";

export type PrestacionRow = {
  id: string;
  tipo_prestacion: string;
  fecha: string;
  estado: string | null;
  monto: number | null;
  user_id?: string | null;
  prestador?: {
    id: string;
    nombre: string;
    apellido: string;
    documento?: string;
  } | null;
  paciente?: {
    id: string;
    nombre: string;
    apellido: string;
    documento: string;
  } | null;
};

export function PrestacionesTable({ data }: { data: PrestacionRow[] }) {
  const [fTipo, setFTipo] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fPaciente, setFPaciente] = useState("");
  const [fDni, setFDni] = useState("");
  const [fFechaDesde, setFFechaDesde] = useState("");
  const [fFechaHasta, setFFechaHasta] = useState("");
  const { roles, loading } = useBackofficeRoles();
  const canWritePrestaciones = canCreateOrEditPrestacion(roles);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const byTipo = (row.tipo_prestacion || "").toLowerCase().includes(fTipo.toLowerCase());
      const byEstado = fEstado ? (row.estado || "") === fEstado : true;
      const fullName = row.paciente ? `${row.paciente.apellido} ${row.paciente.nombre}`.toLowerCase() : "";
      const byPaciente = fullName.includes(fPaciente.toLowerCase());
      const byDni = (row.paciente?.documento || "").toLowerCase().includes(fDni.toLowerCase());
      
      // Filter by date range
      let byFecha = true;
      if (fFechaDesde || fFechaHasta) {
        const rowDate = new Date(row.fecha);
        rowDate.setHours(0, 0, 0, 0); // Reset time to compare only dates
        
        if (fFechaDesde) {
          const desde = new Date(fFechaDesde);
          desde.setHours(0, 0, 0, 0);
          byFecha = byFecha && rowDate >= desde;
        }
        
        if (fFechaHasta) {
          const hasta = new Date(fFechaHasta);
          hasta.setHours(23, 59, 59, 999); // End of day
          byFecha = byFecha && rowDate <= hasta;
        }
      }
      
      return byTipo && byEstado && byPaciente && byDni && byFecha;
    });
  }, [data, fTipo, fEstado, fPaciente, fDni, fFechaDesde, fFechaHasta]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Prestaciones</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input placeholder="Filtrar tipo de prestación" value={fTipo} onChange={(e) => setFTipo(e.target.value)} />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={fEstado}
          onChange={(e) => setFEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">pendiente</option>
          <option value="completada">completada</option>
          <option value="cancelada">cancelada</option>
        </select>
        <Input placeholder="Filtrar paciente (Apellido Nombre)" value={fPaciente} onChange={(e) => setFPaciente(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input placeholder="Filtrar DNI" value={fDni} onChange={(e) => setFDni(e.target.value)} />
        <Input 
          type="date" 
          placeholder="Fecha desde" 
          value={fFechaDesde} 
          onChange={(e) => setFFechaDesde(e.target.value)}
          className="text-sm"
        />
        <Input 
          type="date" 
          placeholder="Fecha hasta" 
          value={fFechaHasta} 
          onChange={(e) => setFFechaHasta(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Monto</th>
              <th className="text-left p-3">Prestador</th>
              <th className="text-left p-3">Paciente</th>
              <th className="text-left p-3">DNI</th>
              <th className="text-left p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.tipo_prestacion}</td>
                <td className="p-3">{new Date(row.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                <td className="p-3">{row.estado || "-"}</td>
                <td className="p-3">{row.monto != null ? `$${row.monto.toFixed(2)}` : "-"}</td>
                <td className="p-3">{row.prestador ? `${row.prestador.nombre} ${row.prestador.apellido}` : '-'}</td>
                <td className="p-3">{row.paciente ? `${row.paciente.apellido}, ${row.paciente.nombre}` : '-'}</td>
                <td className="p-3">{row.paciente?.documento || '-'}</td>
                <td className="p-3">
                  {canWritePrestaciones && !loading ? (
                    <Link href={`/protected/prestaciones/editar/${row.id}`} aria-label="Editar">
                      <Button size="icon" variant="outline">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="icon"
                      variant="outline"
                      disabled
                      title="No tenés permiso para editar prestaciones"
                      aria-disabled
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
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
    </div>
  );
}
