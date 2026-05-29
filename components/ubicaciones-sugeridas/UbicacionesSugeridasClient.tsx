"use client";

import { useMemo, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  CentroUbicacionSugeridaRow,
  PacienteUbicacionSugeridaRow,
  UbicacionCoords,
} from "@/app/protected/ubicaciones-sugeridas/actions";
import {
  aprobarUbicacionSugeridaCentro,
  aprobarUbicacionSugeridaPaciente,
  rechazarUbicacionSugeridaCentro,
  rechazarUbicacionSugeridaPaciente,
} from "@/app/protected/ubicaciones-sugeridas/actions";

function formatCoords(coords: UbicacionCoords | null) {
  if (!coords) return "—";
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "—";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function nombreCompleto(row: { nombre: string | null; apellido?: string | null }) {
  const parts = [row.apellido, row.nombre].filter(Boolean);
  if (parts.length === 0) return "Sin nombre";
  return parts.join(", ");
}

export default function UbicacionesSugeridasClient({
  pacientes,
  centros,
}: {
  pacientes: PacienteUbicacionSugeridaRow[];
  centros: CentroUbicacionSugeridaRow[];
}) {
  const [pending, startTransition] = useTransition();

  const pacientesSorted = useMemo(() => {
    return [...pacientes].sort((a, b) => {
      const left = a.ubicacion_sugerida_at || "";
      const right = b.ubicacion_sugerida_at || "";
      return left.localeCompare(right);
    });
  }, [pacientes]);

  const centrosSorted = useMemo(() => {
    return [...centros].sort((a, b) => {
      const left = a.ubicacion_sugerida_at || "";
      const right = b.ubicacion_sugerida_at || "";
      return left.localeCompare(right);
    });
  }, [centros]);

  return (
    <Tabs defaultValue="pacientes" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pacientes">
          Beneficiarios
          <span className="ml-2 rounded-full bg-black/10 px-2 text-xs">{pacientesSorted.length}</span>
        </TabsTrigger>
        <TabsTrigger value="centros">
          Centros
          <span className="ml-2 rounded-full bg-black/10 px-2 text-xs">{centrosSorted.length}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pacientes" className="space-y-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Beneficiario</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Sugerida por</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Ubicación sugerida</TableHead>
              <TableHead>Ubicación actual</TableHead>
              <TableHead>Precisión (m)</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pacientesSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground">
                  No hay ubicaciones sugeridas pendientes.
                </TableCell>
              </TableRow>
            ) : (
              pacientesSorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{nombreCompleto(row)}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.direccion_completa, row.ciudad, row.provincia].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell>{row.documento || "—"}</TableCell>
                  <TableCell>
                    <div className="text-sm">{row.ubicacion_sugerida_por_nombre || "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.ubicacion_sugerida_por_email || ""}</div>
                  </TableCell>
                  <TableCell>{formatFecha(row.ubicacion_sugerida_at)}</TableCell>
                  <TableCell>{formatCoords(row.ubicacion_sugerida)}</TableCell>
                  <TableCell>{formatCoords(row.ubicacion)}</TableCell>
                  <TableCell>{row.ubicacion_sugerida_precision_m ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <form
                        action={(fd) => {
                          startTransition(() => {
                            aprobarUbicacionSugeridaPaciente(fd);
                          });
                        }}
                      >
                        <input type="hidden" name="paciente_id" value={row.id} />
                        <Button type="submit" size="sm" disabled={pending}>
                          Aprobar
                        </Button>
                      </form>
                      <form
                        action={(fd) => {
                          startTransition(() => {
                            rechazarUbicacionSugeridaPaciente(fd);
                          });
                        }}
                      >
                        <input type="hidden" name="paciente_id" value={row.id} />
                        <Button type="submit" size="sm" variant="destructive" disabled={pending}>
                          Rechazar
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="centros" className="space-y-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Sugerida por</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Ubicación sugerida</TableHead>
              <TableHead>Ubicación actual</TableHead>
              <TableHead>Precisión (m)</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {centrosSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground">
                  No hay ubicaciones sugeridas pendientes.
                </TableCell>
              </TableRow>
            ) : (
              centrosSorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.nombre || "Sin nombre"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.direccion_completa, row.ciudad, row.provincia].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell>{row.tipo || "—"}</TableCell>
                  <TableCell>
                    <div className="text-sm">{row.ubicacion_sugerida_por_nombre || "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.ubicacion_sugerida_por_email || ""}</div>
                  </TableCell>
                  <TableCell>{formatFecha(row.ubicacion_sugerida_at)}</TableCell>
                  <TableCell>{formatCoords(row.ubicacion_sugerida)}</TableCell>
                  <TableCell>{formatCoords(row.ubicacion)}</TableCell>
                  <TableCell>{row.ubicacion_sugerida_precision_m ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <form
                        action={(fd) => {
                          startTransition(() => {
                            aprobarUbicacionSugeridaCentro(fd);
                          });
                        }}
                      >
                        <input type="hidden" name="centro_id" value={row.id} />
                        <Button type="submit" size="sm" disabled={pending}>
                          Aprobar
                        </Button>
                      </form>
                      <form
                        action={(fd) => {
                          startTransition(() => {
                            rechazarUbicacionSugeridaCentro(fd);
                          });
                        }}
                      >
                        <input type="hidden" name="centro_id" value={row.id} />
                        <Button type="submit" size="sm" variant="destructive" disabled={pending}>
                          Rechazar
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}
