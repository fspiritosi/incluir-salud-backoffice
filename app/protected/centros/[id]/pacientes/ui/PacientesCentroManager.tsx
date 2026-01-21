"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, UserMinus, Search, Check, X } from "lucide-react";
import {
  type PacienteCentro,
  type PacienteDisponible,
  listPacientesDisponibles,
  asignarPacienteACentro,
  desasignarPacienteDeCentro,
} from "../actions";

type Props = {
  centroId: string;
  initialPacientes: PacienteCentro[];
};

export default function PacientesCentroManager({ centroId, initialPacientes }: Props) {
  const { toast } = useToast();
  const [pacientesAsignados, setPacientesAsignados] = useState<PacienteCentro[]>(initialPacientes);
  const [pacientesDisponibles, setPacientesDisponibles] = useState<PacienteDisponible[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.length < 2) {
        setPacientesDisponibles([]);
        return;
      }
      setSearchLoading(true);
      try {
        const { data } = await listPacientesDisponibles(centroId, search);
        setPacientesDisponibles(data || []);
      } catch {
        setPacientesDisponibles([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, centroId]);

  const handleAsignar = async (paciente: PacienteDisponible) => {
    setLoading(true);
    try {
      const { error } = await asignarPacienteACentro(centroId, paciente.id);
      if (error) throw new Error(error.message);

      toast({ title: "Paciente asignado", description: `${paciente.apellido}, ${paciente.nombre} fue asignado al centro` });

      // Actualizar listas
      setPacientesDisponibles((prev) => prev.filter((p) => p.id !== paciente.id));
      setPacientesAsignados((prev) => [
        {
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          paciente_id: paciente.id,
          centro_id: centroId,
          desde: new Date().toISOString().split("T")[0],
          hasta: null,
          activo: true,
          paciente_nombre: paciente.nombre,
          paciente_apellido: paciente.apellido,
          paciente_documento: paciente.documento,
        },
        ...prev,
      ]);
      setSearch("");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No se pudo asignar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDesasignar = async (pc: PacienteCentro) => {
    setLoading(true);
    try {
      const { error } = await desasignarPacienteDeCentro(pc.id);
      if (error) throw new Error(error.message);

      toast({ title: "Paciente desasignado", description: `${pc.paciente_apellido}, ${pc.paciente_nombre} fue desasignado del centro` });

      setPacientesAsignados((prev) =>
        prev.map((p) => (p.id === pc.id ? { ...p, activo: false, hasta: new Date().toISOString().split("T")[0] } : p))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No se pudo desasignar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const activos = pacientesAsignados.filter((p) => p.activo);
  const inactivos = pacientesAsignados.filter((p) => !p.activo);

  return (
    <div className="space-y-6">
      {/* Buscador para agregar pacientes */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Agregar paciente al centro</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente por nombre, apellido o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            disabled={loading}
          />
        </div>

        {searchLoading && <p className="text-sm text-muted-foreground mt-2">Buscando...</p>}

        {pacientesDisponibles.length > 0 && (
          <div className="mt-3 border rounded-lg divide-y max-h-60 overflow-auto">
            {pacientesDisponibles.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40">
                <div>
                  <span className="font-medium">{p.apellido}, {p.nombre}</span>
                  <span className="text-muted-foreground ml-2 text-sm">DNI {p.documento}</span>
                </div>
                <Button size="sm" onClick={() => handleAsignar(p)} disabled={loading}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Asignar
                </Button>
              </div>
            ))}
          </div>
        )}

        {search.length >= 2 && !searchLoading && pacientesDisponibles.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">No se encontraron pacientes disponibles</p>
        )}
      </div>

      {/* Lista de pacientes asignados */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="px-4 py-3 border-b border-border/60">
          <h2 className="text-lg font-semibold">Pacientes asignados ({activos.length})</h2>
        </div>

        {activos.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted-foreground">
            No hay pacientes asignados a este centro
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">DNI</th>
                <th className="px-4 py-3 font-medium">Desde</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {activos.map((pc) => (
                <tr key={pc.id} className="border-t border-border/60 bg-card hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{pc.paciente_apellido}, {pc.paciente_nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{pc.paciente_documento}</td>
                  <td className="px-4 py-3">{pc.desde}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Activo
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDesasignar(pc)}
                      disabled={loading}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Desasignar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historial de pacientes inactivos */}
      {inactivos.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="px-4 py-3 border-b border-border/60">
            <h2 className="text-lg font-semibold text-muted-foreground">Historial ({inactivos.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">DNI</th>
                <th className="px-4 py-3 font-medium">Desde</th>
                <th className="px-4 py-3 font-medium">Hasta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {inactivos.map((pc) => (
                <tr key={pc.id} className="border-t border-border/60 bg-card/50">
                  <td className="px-4 py-3 text-muted-foreground">{pc.paciente_apellido}, {pc.paciente_nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{pc.paciente_documento}</td>
                  <td className="px-4 py-3 text-muted-foreground">{pc.desde}</td>
                  <td className="px-4 py-3 text-muted-foreground">{pc.hasta || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      <X className="w-3 h-3 mr-1" />
                      Inactivo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
