"use client";

import { PrestacionParaReasignar, reasignarPrestacionesMasivasDesdePool } from "@/app/protected/prestaciones/actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { descartarPrestacionDePool, reasignarPrestacionDesdePool } from "@/app/protected/prestaciones/actions";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { CheckedState } from "@radix-ui/react-checkbox";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPersona(persona?: { apellido?: string | null; nombre?: string | null; documento?: string | null } | null) {
  if (!persona) return "Sin datos";
  const parts = [persona.apellido, persona.nombre].filter(Boolean).join(", ");
  if (persona.documento) return `${parts} · DNI ${persona.documento}`;
  return parts || persona.documento || "Sin datos";
}

type PrestadorOption = { id: string; apellido: string; nombre: string; documento?: string };

type PrestadoresPorTipo = Record<string, PrestadorOption[]>;

export default function PrestacionesReassignTable({ data, prestadoresPorTipo }: { data: PrestacionParaReasignar[]; prestadoresPorTipo: PrestadoresPorTipo }) {
  const { toast } = useToast();
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [timeSelection, setTimeSelection] = useState<Record<string, string>>({});
  const [pendingPoolId, setPendingPoolId] = useState<string | null>(null);
  const [cancellingPoolId, setCancellingPoolId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());
  const [bulkPrestadorId, setBulkPrestadorId] = useState<string>("");
  const [isBulkPending, startBulkTransition] = useTransition();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
      return (error as any).message as string;
    }
    return fallback;
  };

  const getTimeForRow = (row: PrestacionParaReasignar) => {
    if (timeSelection[row.pool_id]) return timeSelection[row.pool_id];
    if (!row.prestacion?.fecha) return "";
    const date = new Date(row.prestacion.fecha);
    if (Number.isNaN(date.getTime())) return "";
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleReassign = (row: PrestacionParaReasignar) => {
    const poolId = row.pool_id;
    const nuevoPrestadorId = selection[poolId];
    if (!nuevoPrestadorId) {
      toast({
        title: "Seleccioná un prestador",
        description: "Debés elegir a quién reasignar la prestación",
        variant: "destructive",
      });
      return;
    }

    const nuevoHorario = getTimeForRow(row);

    setPendingPoolId(poolId);
    startTransition(async () => {
      const { error } = await reasignarPrestacionDesdePool(poolId, nuevoPrestadorId, nuevoHorario || undefined);
      if (error) {
        toast({
          title: "No se pudo reasignar",
          description: getErrorMessage(error, "Intentá nuevamente"),
          variant: "destructive",
        });
        setPendingPoolId(null);
        return;
      }

      toast({
        title: "Prestación reasignada",
        description: "La prestación vuelve a estado pendiente con el nuevo prestador",
      });
      setSelection((prev) => {
        const next = { ...prev };
        delete next[poolId];
        return next;
      });
      setTimeSelection((prev) => {
        const next = { ...prev };
        delete next[poolId];
        return next;
      });
      setPendingPoolId(null);
    });
  };

  const [isCancelling, startCancelTransition] = useTransition();

  const handleDiscard = (poolId: string) => {
    setCancellingPoolId(poolId);
    startCancelTransition(async () => {
      const { error } = await descartarPrestacionDePool(poolId);
      if (error) {
        toast({
          title: "No se pudo cancelar",
          description: getErrorMessage(error, "Intentá nuevamente"),
          variant: "destructive",
        });
        setCancellingPoolId(null);
        return;
      }

      toast({
        title: "Prestación cancelada",
        description: "La prestación quedó descartada del pool",
      });
      setSelection((prev) => {
        const next = { ...prev };
        delete next[poolId];
        return next;
      });
      setTimeSelection((prev) => {
        const next = { ...prev };
        delete next[poolId];
        return next;
      });
      setCancellingPoolId(null);
    });
  };

  const toggleRowSelected = (poolId: string, checked: boolean) => {
    setBulkSelection(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(poolId);
      } else {
        next.delete(poolId);
      }
      return next;
    });
  };

  const toggleAllRows = (checked: boolean) => {
    if (checked) {
      setBulkSelection(new Set(data.map(row => row.pool_id)));
    } else {
      setBulkSelection(new Set());
    }
  };

  const selectedRows = data.filter(row => bulkSelection.has(row.pool_id));
  const uniqueTipos = new Set(selectedRows.map(row => row.prestacion?.tipo_prestacion).filter(Boolean) as string[]);
  const bulkTipo = uniqueTipos.size === 1 ? Array.from(uniqueTipos)[0] : null;
  const bulkPrestadores = bulkTipo ? prestadoresPorTipo[bulkTipo] ?? [] : [];
  const bulkDisabledReason = (() => {
    if (!selectedRows.length) return "Seleccioná al menos una prestación";
    if (!bulkTipo) return "Las prestaciones seleccionadas deben ser del mismo tipo";
    if (!bulkPrestadorId) return "Elegí el nuevo prestador";
    return null;
  })();

  const clearBulkState = () => {
    setBulkSelection(new Set());
    setBulkPrestadorId("");
  };

  const allSelected = bulkSelection.size > 0 && bulkSelection.size === data.length;
  const partiallySelected = bulkSelection.size > 0 && bulkSelection.size < data.length;
  const selectAllState: CheckedState = allSelected ? true : partiallySelected ? "indeterminate" : false;

  const handleBulkReassign = () => {
    if (bulkDisabledReason) {
      toast({
        title: "No se puede reasignar",
        description: bulkDisabledReason,
        variant: "destructive",
      });
      return;
    }

    startBulkTransition(async () => {
      const payload = selectedRows.map(row => ({
        poolId: row.pool_id,
        nuevoPrestadorId: bulkPrestadorId,
        nuevaHora: getTimeForRow(row) || undefined,
      }));

      const { data: result, error } = await reasignarPrestacionesMasivasDesdePool(payload);
      if (error) {
        toast({
          title: "No se pudieron reasignar",
          description: getErrorMessage(error, "Intentá nuevamente"),
          variant: "destructive",
        });
        return;
      }

      const successCount = result?.successIds.length ?? 0;
      const errorCount = result?.errors.length ?? 0;

      if (successCount) {
        toast({
          title: "Reasignación masiva completada",
          description: `${successCount} prestación${successCount === 1 ? "" : "es"} reasignada${successCount === 1 ? "" : "s"}.`,
        });
      }

      if (errorCount) {
        toast({
          title: "Prestaciones con errores",
          description: `${errorCount} prestación${errorCount === 1 ? "" : "es"} no se pudo reasignar. Revisá el detalle en la consola.`,
          variant: "destructive",
        });
        console.error("Errores en reasignación masiva", result?.errors);
      }

      clearBulkState();
    });
  };

  if (!data.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No hay prestaciones pendientes de reasignar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-md border px-4 py-3",
          selectedRows.length ? "border-primary/40 bg-primary/5" : "border-dashed border-muted"
        )}
      >
        <div className="text-sm">
          <p className="font-medium">Reasignación masiva</p>
          <p className="text-muted-foreground">
            {selectedRows.length
              ? `${selectedRows.length} prestación${selectedRows.length === 1 ? "" : "es"} seleccionada${selectedRows.length === 1 ? "" : "s"}`
              : "Seleccioná las prestaciones que quieras reasignar"}
          </p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            value={bulkPrestadorId}
            onValueChange={setBulkPrestadorId}
            disabled={!bulkTipo || bulkPrestadores.length === 0 || isBulkPending}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue
                placeholder={
                  !selectedRows.length
                    ? "Seleccioná prestaciones"
                    : !bulkTipo
                      ? "Tipos mixtos"
                      : bulkPrestadores.length
                        ? "Elegí prestador"
                        : "Sin prestadores disponibles"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {bulkPrestadores.map(prestador => (
                <SelectItem key={prestador.id} value={prestador.id}>
                  {prestador.apellido}, {prestador.nombre}
                  {prestador.documento ? ` · DNI ${prestador.documento}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            disabled={!selectedRows.length || isBulkPending}
            onClick={() => toggleAllRows(false)}
          >
            Limpiar selección
          </Button>
          <Button
            variant="default"
            disabled={Boolean(bulkDisabledReason) || isBulkPending}
            onClick={handleBulkReassign}
          >
            {isBulkPending ? "Reasignando..." : "Reasignar seleccionadas"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  aria-label="Seleccionar todas"
                  checked={selectAllState}
                  onCheckedChange={checked => toggleAllRows(checked === true)}
                />
              </TableHead>
              <TableHead>Prestación</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Prestador anterior</TableHead>
              <TableHead>Cancelada</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Nuevo horario</TableHead>
              <TableHead>Nuevo prestador</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const tipo = row.prestacion?.tipo_prestacion ?? "";
              const opciones = tipo ? prestadoresPorTipo[tipo] ?? [] : [];
              return (
                <TableRow key={row.pool_id}>
                  <TableCell>
                    <Checkbox
                      aria-label="Seleccionar prestación"
                      checked={bulkSelection.has(row.pool_id)}
                      onCheckedChange={checked => toggleRowSelected(row.pool_id, Boolean(checked))}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{row.prestacion?.tipo_prestacion ?? "Sin tipo"}</span>
                      <span className="text-sm text-muted-foreground">
                        {row.prestacion ? dateFormatter.format(new Date(row.prestacion.fecha)) : "-"}
                      </span>
                      {row.prestacion?.cronico && (
                        <Badge variant="outline" className="mt-2 w-fit">
                          Crónica
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{formatPersona(row.paciente)}</span>
                  </TableCell>
                  <TableCell>{formatPersona(row.prestadorAnterior)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {dateFormatter.format(new Date(row.cancelled_at))}
                    </span>
                  </TableCell>
                  <TableCell>{row.reason}</TableCell>
                  <TableCell>
                    <input
                      type="time"
                      className="w-[140px] rounded border border-input bg-background px-3 py-1 text-sm"
                      value={timeSelection[row.pool_id] ?? getTimeForRow(row)}
                      onChange={(event) =>
                        setTimeSelection((prev) => ({ ...prev, [row.pool_id]: event.target.value }))
                      }
                      disabled={isPending && pendingPoolId === row.pool_id}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={selection[row.pool_id] ?? ""}
                      onValueChange={(value) => setSelection((prev) => ({ ...prev, [row.pool_id]: value }))}
                      disabled={(isPending && pendingPoolId === row.pool_id) || opciones.length === 0}
                    >
                      <SelectTrigger className="w-[240px] truncate">
                        <SelectValue
                          placeholder={opciones.length ? "Elegí prestador" : "Sin prestadores disponibles"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {opciones.map((prestador) => (
                          <SelectItem key={prestador.id} value={prestador.id}>
                            <span className="flex-1 truncate">
                              {prestador.apellido}, {prestador.nombre}
                              {prestador.documento ? ` · DNI ${prestador.documento}` : ""}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={(isPending && pendingPoolId === row.pool_id) || opciones.length === 0}
                      onClick={() => handleReassign(row)}
                    >
                      {isPending && pendingPoolId === row.pool_id ? "Reasignando..." : "Reasignar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isCancelling && cancellingPoolId === row.pool_id}
                      onClick={() => handleDiscard(row.pool_id)}
                    >
                      {isCancelling && cancellingPoolId === row.pool_id ? "Cancelando..." : "Cancelar"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
