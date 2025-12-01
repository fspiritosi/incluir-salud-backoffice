"use client";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const toDateOnlyString = (date: Date) => date.toISOString().slice(0, 10);

const parseDateOrFallback = (value?: string | null, fallback?: Date) => {
  if (!value) return fallback ?? new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback ?? new Date();
  }
  return parsed;
};

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PatientHistoryRow = {
  id: string;
  tipo_prestacion: string;
  fecha: string;
  estado: string | null;
  monto: number | null;
  cronico: boolean | null;
  prestador: { id: string; nombre?: string | null; apellido?: string | null } | null;
};

type PatientHistoryTableProps = {
  pacienteId: string;
  data: PatientHistoryRow[];
  defaultRange: { startDate: string; endDate: string };
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function formatTipoLabel(tipo: string) {
  return tipo
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, match => match.toUpperCase());
}

function formatPrestador(row: PatientHistoryRow) {
  if (!row.prestador) return "Sin asignar";
  const { apellido, nombre } = row.prestador;
  return [apellido, nombre].filter(Boolean).join(", ");
}

const estadoBadgeClasses = (estado?: string | null) => {
  const value = (estado || "").toLowerCase();
  if (value === "completada") return "bg-green-100 text-green-800 border-green-200";
  if (value === "pendiente" || value === "") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (value === "cancelada") return "bg-red-100 text-red-800 border-red-200";
  return "bg-muted text-foreground";
};

export function PatientHistoryTable({ pacienteId, data, defaultRange }: PatientHistoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "fecha", desc: true }]);
  const [prestadorFilter, setPrestadorFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [monthFilter, setMonthFilter] = useState<"todos" | "actual" | "anterior">("todos");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [rows, setRows] = useState<PatientHistoryRow[]>(data);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const defaultRangeDates = useMemo(() => {
    return {
      start: parseDateOrFallback(defaultRange.startDate),
      end: parseDateOrFallback(defaultRange.endDate),
    };
  }, [defaultRange.startDate, defaultRange.endDate]);

  const [loadedRange, setLoadedRange] = useState(defaultRangeDates);
  const initialDataRef = useRef(data);

  useEffect(() => {
    initialDataRef.current = data;
    setRows(data);
  }, [data]);

  useEffect(() => {
    setLoadedRange(defaultRangeDates);
  }, [defaultRangeDates]);

  const prestadorOptions = useMemo(() => {
    const unique = new Map<string, string>();
    rows.forEach(row => {
      if (row.prestador?.id) {
        unique.set(row.prestador.id, formatPrestador(row));
      }
    });
    return Array.from(unique.entries());
  }, [rows]);

  const tipoOptions = useMemo(() => {
    return Array.from(new Set(rows.map(row => row.tipo_prestacion))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const boundaries = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { currentStart, nextStart, prevStart };
  }, []);

  const dateRange = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    return { start, end };
  }, [startDate, endDate]);

  const shouldFetchFromServer = useMemo(() => {
    if (!dateRange.start || !dateRange.end) {
      return false;
    }
    if (dateRange.start < loadedRange.start) {
      return true;
    }
    if (dateRange.end > loadedRange.end) {
      return true;
    }
    return false;
  }, [dateRange, loadedRange]);

  const fetchPrestaciones = useCallback(
    async (range: { startDate: string; endDate: string }) => {
      setIsFetching(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams();
        params.set("startDate", range.startDate);
        params.set("endDate", range.endDate);
        const query = params.toString();
        const response = await fetch(
          `/api/beneficiarios/${pacienteId}/prestaciones?${query}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("No se pudieron obtener las prestaciones para el rango solicitado");
        }

        const json = await response.json();
        return (json.data || []) as PatientHistoryRow[];
      } catch (error: any) {
        console.error("Error cargando prestaciones con rango dinámico", error);
        setFetchError(error?.message || "No se pudieron actualizar los datos");
        return null;
      } finally {
        setIsFetching(false);
      }
    },
    [pacienteId]
  );

  useEffect(() => {
    if (!shouldFetchFromServer) return;

    const effectiveStart = startDate || toDateOnlyString(loadedRange.start);
    const effectiveEnd = endDate || toDateOnlyString(loadedRange.end);

    let cancelled = false;

    const run = async () => {
      const fetched = await fetchPrestaciones({ startDate: effectiveStart, endDate: effectiveEnd });
      if (!cancelled && fetched) {
        setRows(fetched);
        setLoadedRange({
          start: parseDateOrFallback(`${effectiveStart}T00:00:00`, loadedRange.start),
          end: parseDateOrFallback(`${effectiveEnd}T23:59:59.999`, loadedRange.end),
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [shouldFetchFromServer, startDate, endDate, fetchPrestaciones, loadedRange]);

  const filteredData = useMemo(() => {
    return rows.filter(row => {
      if (prestadorFilter !== "todos" && row.prestador?.id !== prestadorFilter) {
        return false;
      }
      if (tipoFilter !== "todos" && row.tipo_prestacion !== tipoFilter) {
        return false;
      }
      if (monthFilter !== "todos") {
        const fecha = new Date(row.fecha);
        if (monthFilter === "actual") {
          if (!(fecha >= boundaries.currentStart && fecha < boundaries.nextStart)) {
            return false;
          }
        } else if (monthFilter === "anterior") {
          if (!(fecha >= boundaries.prevStart && fecha < boundaries.currentStart)) {
            return false;
          }
        }
      }
      if (dateRange.start || dateRange.end) {
        const fecha = new Date(row.fecha);
        if (dateRange.start && fecha < dateRange.start) {
          return false;
        }
        if (dateRange.end && fecha > dateRange.end) {
          return false;
        }
      }
      return true;
    });
  }, [rows, prestadorFilter, tipoFilter, monthFilter, boundaries, dateRange]);

  const columns: ColumnDef<PatientHistoryRow>[] = [
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ row }) => dateFormatter.format(new Date(row.original.fecha)),
    },
    {
      accessorKey: "tipo_prestacion",
      header: "Tipo",
      cell: ({ row }) => <span className="font-medium">{formatTipoLabel(row.original.tipo_prestacion)}</span>,
    },
    {
      accessorKey: "prestador",
      header: "Prestador",
      cell: ({ row }) => formatPrestador(row.original),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const rawEstado = row.original.estado ?? "pendiente";
        return (
          <Badge variant="outline" className={`${estadoBadgeClasses(row.original.estado)} capitalize`}>
            {rawEstado}
          </Badge>
        );
      },
    },
    {
      accessorKey: "cronico",
      header: "Crónica",
      cell: ({ row }) =>
        row.original.cronico ? (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
            Sí
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-foreground">
            No
          </Badge>
        ),
    },
    {
      accessorKey: "monto",
      header: () => <span className="text-right block">Monto</span>,
      cell: ({ row }) => (
        <span className="text-right block">
          {row.original.monto != null ? currencyFormatter.format(row.original.monto) : "-"}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Select value={prestadorFilter} onValueChange={setPrestadorFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Prestador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Prestador (todos)</SelectItem>
            {prestadorOptions.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Tipo (todos)</SelectItem>
            {tipoOptions.map(tipo => (
              <SelectItem key={tipo} value={tipo}>
                {formatTipoLabel(tipo)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={value => setMonthFilter(value as typeof monthFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Mes (actual y anterior)</SelectItem>
            <SelectItem value="actual">Sólo mes actual</SelectItem>
            <SelectItem value="anterior">Sólo mes anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="historial-desde" className="text-sm font-medium text-muted-foreground">Desde</label>
          <Input
            id="historial-desde"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={event => setStartDate(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="historial-hasta" className="text-sm font-medium text-muted-foreground">Hasta</label>
          <Input
            id="historial-hasta"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={event => setEndDate(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!startDate && !endDate}
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setFetchError(null);
              setRows(initialDataRef.current);
              setLoadedRange(defaultRangeDates);
            }}
          >
            Limpiar rango
          </Button>
        </div>
      </div>

      <div className="min-h-[1.25rem] text-sm">
        {isFetching && <span className="text-muted-foreground">Actualizando datos del servidor…</span>}
        {!isFetching && fetchError && <span className="text-destructive">{fetchError}</span>}
      </div>

      <DataTable table={table} />
      <DataTablePagination table={table} showSelectedCount={false} />

      {filteredData.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No encontramos prestaciones con los filtros actuales.
          <Button variant="link" onClick={() => { setPrestadorFilter("todos"); setTipoFilter("todos"); setMonthFilter("todos"); }}>
            Reiniciar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
