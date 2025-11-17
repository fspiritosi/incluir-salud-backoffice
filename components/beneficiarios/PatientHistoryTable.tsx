"use client";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

import { useMemo, useState } from "react";
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
  data: PatientHistoryRow[];
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

export function PatientHistoryTable({ data }: PatientHistoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "fecha", desc: true }]);
  const [prestadorFilter, setPrestadorFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [monthFilter, setMonthFilter] = useState<"todos" | "actual" | "anterior">("todos");

  const prestadorOptions = useMemo(() => {
    const unique = new Map<string, string>();
    data.forEach(row => {
      if (row.prestador?.id) {
        unique.set(row.prestador.id, formatPrestador(row));
      }
    });
    return Array.from(unique.entries());
  }, [data]);

  const tipoOptions = useMemo(() => {
    return Array.from(new Set(data.map(row => row.tipo_prestacion))).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const boundaries = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { currentStart, nextStart, prevStart };
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(row => {
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
      return true;
    });
  }, [data, prestadorFilter, tipoFilter, monthFilter, boundaries]);

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
      cell: ({ row }) => <Badge variant="outline">{row.original.estado ?? "pendiente"}</Badge>,
    },
    {
      accessorKey: "cronico",
      header: "Crónica",
      cell: ({ row }) =>
        row.original.cronico ? (
          <Badge variant="secondary">Sí</Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
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
