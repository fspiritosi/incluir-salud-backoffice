"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, MoreHorizontal } from "lucide-react";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canTogglePrestador } from "@/utils/permissions";
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
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { togglePrestadorActivo } from "../actions";

type Prestador = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean | null;
  created_at: string;
};

export default function PrestadoresTable({ prestadores }: { prestadores: Prestador[] }) {
  const router = useRouter();
  const { roles, loading } = useBackofficeRoles();
  const canToggle = canTogglePrestador(roles);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filterActivo, setFilterActivo] = useState<"todos" | "activos" | "inactivos">("todos");

  const handleToggleActivo = async (id: string, currentActivo: boolean | null) => {
    setIsUpdating(id);
    try {
      await togglePrestadorActivo(id, !currentActivo);
      router.refresh();
    } catch (error) {
      console.error("Error al actualizar prestador:", error);
    } finally {
      setIsUpdating(null);
    }
  };

  const columns: ColumnDef<Prestador>[] = [
    {
      accessorKey: "apellido",
      header: "Apellido",
      enableColumnFilter: true,
    },
    {
      accessorKey: "nombre",
      header: "Nombre",
      enableColumnFilter: true,
    },
    {
      accessorKey: "documento",
      header: "Documento",
      cell: ({ row }) => row.getValue("documento") || "-",
      enableColumnFilter: true,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.getValue("email") || "-",
      enableColumnFilter: true,
    },
    {
      accessorKey: "telefono",
      header: "Teléfono",
      cell: ({ row }) => row.getValue("telefono") || "-",
      enableColumnFilter: true,
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ row }) => row.getValue("activo") ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Check className="w-3 h-3 mr-1" />
          Activo
        </span>
      ) : (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <X className="w-3 h-3 mr-1" />
          Inactivo
        </span>
      ),
      filterFn: (row, columnId, filterValue) => {
        const activo = row.getValue(columnId) as boolean;
        if (filterValue === "todos") return true;
        if (filterValue === "activos") return activo;
        return !activo;
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const prestador = row.original;
        return (
          <Button
            onClick={() => handleToggleActivo(prestador.id, prestador.activo)}
            disabled={isUpdating === prestador.id || !canToggle || loading}
            variant={prestador.activo ? "destructive" : "default"}
            size="sm"
            title={!canToggle && !loading ? "No tenés permiso para habilitar/deshabilitar prestadores" : undefined}
          >
            {isUpdating === prestador.id
              ? "Actualizando..."
              : prestador.activo
                ? "Deshabilitar"
                : "Habilitar"}
          </Button>
        );
      },
    }
  ];

  const table = useReactTable({
    data: prestadores,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    enableRowSelection: false,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Prestadores</h2>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <MoreHorizontal className="mr-2 h-4 w-4" />
              Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize max-w-[200px] truncate"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  title={column.columnDef.header?.toString() || column.id}
                >
                  {column.columnDef.header?.toString() || column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <Input
          placeholder="Filtrar apellido"
          value={(table.getColumn("apellido")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("apellido")?.setFilterValue(e.target.value)}
        />
        <Input
          placeholder="Filtrar nombre"
          value={(table.getColumn("nombre")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("nombre")?.setFilterValue(e.target.value)}
        />
        <Input
          placeholder="Filtrar documento"
          value={(table.getColumn("documento")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("documento")?.setFilterValue(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={filterActivo}
          onChange={(e) => {
            setFilterActivo(e.target.value as any);
            table.getColumn("activo")?.setFilterValue(e.target.value);
          }}
        >
          <option value="todos">Activo (todos)</option>
          <option value="activos">Sólo activos</option>
          <option value="inactivos">Sólo inactivos</option>
        </select>
      </div>

      <DataTable table={table} isLoading={loading} />
      <DataTablePagination table={table} showSelectedCount={false} />
    </div>
  );
}
