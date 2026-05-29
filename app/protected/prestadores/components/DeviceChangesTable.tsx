"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeviceChangeRow } from "../actions";

type DeviceChangesTableProps = {
  deviceChanges: DeviceChangeRow[];
  prestadores: Array<{ id: string; nombre: string; apellido: string }>;
  filters?: {
    fechaDesde: string;
    fechaHasta: string;
    prestadorIds: string[];
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
};

type DeviceChangesFilters = {
  fechaDesde: string;
  fechaHasta: string;
  prestadorIds: string[];
};

const formatFecha = (fecha: string | null) => {
  if (!fecha) return "—";
  try {
    const date = new Date(fecha);
    return date.toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
};

const formatDeviceId = (deviceId: string | null) => {
  if (!deviceId) return "—";
  return deviceId.length > 20 ? `${deviceId.substring(0, 20)}...` : deviceId;
};

const getPrestadorLabel = (row: DeviceChangeRow) => {
  return `${row.prestador_apellido || ""}, ${row.prestador_nombre || ""}`.trim() || "Sin nombre";
};

export default function DeviceChangesTable({
  deviceChanges,
  prestadores,
  filters,
  pagination,
}: DeviceChangesTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const [fechaDesde, setFechaDesde] = useState<string>(filters?.fechaDesde ?? "");
  const [fechaHasta, setFechaHasta] = useState<string>(filters?.fechaHasta ?? "");
  const [prestadorSelected, setPrestadorSelected] = useState<string[]>(filters?.prestadorIds ?? []);
  const [prestadorFilterSearch, setPrestadorFilterSearch] = useState("");

  // Persistencia en localStorage
  useEffect(() => {
    const saved = localStorage.getItem("deviceChangesFilters");
    if (saved) {
      try {
        const { fechaDesde: savedFechaDesde, fechaHasta: savedFechaHasta, prestadorIds: savedPrestadorIds } = JSON.parse(saved);
        setFechaDesde(savedFechaDesde ?? "");
        setFechaHasta(savedFechaHasta ?? "");
        setPrestadorSelected(savedPrestadorIds ?? []);
      } catch (e) {
        console.error("Error loading filters from localStorage", e);
      }
    }
  }, []);

  // Guardar filtros en localStorage y URL
  const updateFilters = useCallback((
    newFechaDesde: string,
    newFechaHasta: string,
    newPrestadorIds: string[] = []
  ) => {
    setFechaDesde(newFechaDesde);
    setFechaHasta(newFechaHasta);
    setPrestadorSelected(newPrestadorIds);

    localStorage.setItem("deviceChangesFilters", JSON.stringify({
      fechaDesde: newFechaDesde,
      fechaHasta: newFechaHasta,
      prestadorIds: newPrestadorIds,
    }));

    const params = new URLSearchParams();
    if (newFechaDesde) params.set("fechaDesde", newFechaDesde);
    if (newFechaHasta) params.set("fechaHasta", newFechaHasta);
    newPrestadorIds.forEach(id => params.append("prestadorIds", id));
    params.set("page", "1");
    params.set("pageSize", "25");

    router.push(`?${params.toString()}`);
  }, [router]);

  const prestadoresOptions = useMemo(() => {
    const map = new Map<string, string>();
    prestadores.forEach(p => {
      const fullName = `${p.apellido || ""}, ${p.nombre || ""}`.trim();
      map.set(p.id, fullName || "Sin nombre");
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [prestadores]);

  // Filtrar datos
  const datosFiltrados = useMemo(() => {
    let filtered = deviceChanges;

    if (fechaDesde) {
      filtered = filtered.filter(d => {
        const fecha = d.created_at ? new Date(d.created_at) : null;
        return fecha && fecha >= new Date(fechaDesde);
      });
    }

    if (fechaHasta) {
      filtered = filtered.filter(d => {
        const fecha = d.created_at ? new Date(d.created_at) : null;
        return fecha && fecha <= new Date(fechaHasta + "T23:59:59");
      });
    }

    if (prestadorSelected.length > 0) {
      filtered = filtered.filter(d => prestadorSelected.includes(d.user_id));
    }

    return filtered.sort((a, b) => {
      const aFecha = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bFecha = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bFecha - aFecha;
    });
  }, [deviceChanges, fechaDesde, fechaHasta, prestadorSelected]);

  // Paginación
  const paginatedData = useMemo(() => {
    const pageSize = pagination?.pageSize ?? 25;
    const page = pagination?.page ?? 1;
    const start = (page - 1) * pageSize;
    return datosFiltrados.slice(start, start + pageSize);
  }, [datosFiltrados, pagination]);

  const columns: ColumnDef<DeviceChangeRow>[] = [
    {
      accessorKey: "created_at",
      header: "Fecha y Hora",
      cell: ({ row }) => formatFecha(row.original.created_at),
    },
    {
      accessorKey: "prestador_apellido",
      header: "Prestador",
      cell: ({ row }) => getPrestadorLabel(row.original),
    },
    {
      accessorKey: "old_device_id",
      header: "Dispositivo Anterior",
      cell: ({ row }) => formatDeviceId(row.original.old_device_id),
    },
    {
      accessorKey: "new_device_id",
      header: "Nuevo Dispositivo",
      cell: ({ row }) => formatDeviceId(row.original.new_device_id),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusMap: Record<string, { label: string; color: string }> = {
          pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
          authorized: { label: "Autorizado", color: "bg-green-100 text-green-800" },
          rejected: { label: "Rechazado", color: "bg-red-100 text-red-800" },
        };
        const config = statusMap[status] || { label: status, color: "bg-gray-100 text-gray-800" };
        return <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>{config.label}</span>;
      },
    },
  ];

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Desde (YYYY-MM-DD)"
            type="date"
            value={fechaDesde}
            onChange={(e) => updateFilters(e.target.value, fechaHasta, prestadorSelected)}
            className="w-40"
          />
          <Input
            placeholder="Hasta (YYYY-MM-DD)"
            type="date"
            value={fechaHasta}
            onChange={(e) => updateFilters(fechaDesde, e.target.value, prestadorSelected)}
            className="w-40"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-48">
                Prestador {prestadorSelected.length > 0 && `(${prestadorSelected.length})`} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
              <Input
                placeholder="Buscar prestador…"
                value={prestadorFilterSearch}
                onChange={(e) => setPrestadorFilterSearch(e.target.value)}
                className="mb-2"
              />
              <DropdownMenuCheckboxItem
                checked={prestadorSelected.length === 0}
                onCheckedChange={() => updateFilters(fechaDesde, fechaHasta, [])}
              >
                Todos
              </DropdownMenuCheckboxItem>
              {prestadoresOptions
                .filter(p => p.label.toLowerCase().includes(prestadorFilterSearch.toLowerCase()))
                .map((p) => (
                  <DropdownMenuCheckboxItem
                    key={p.id}
                    checked={prestadorSelected.includes(p.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = checked
                        ? [...prestadorSelected, p.id]
                        : prestadorSelected.filter(id => id !== p.id);
                      updateFilters(fechaDesde, fechaHasta, newSelected);
                    }}
                  >
                    {p.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            onClick={() => updateFilters("", "", [])}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <DataTable table={table} />
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
