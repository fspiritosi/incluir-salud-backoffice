"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, MoreHorizontal, ChevronDown } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { togglePrestadorActivo } from "../actions";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const [fPrestador, setFPrestador] = useState("");
  const [selectedPrestLabel, setSelectedPrestLabel] = useState<string>("");

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
        const variant = prestador.activo ? "destructive" : "default" as const;
        const actionLabel = prestador.activo ? "Deshabilitar" : "Habilitar";
        return (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                disabled={isUpdating === prestador.id || !canToggle || loading}
                variant={variant}
                size="sm"
                title={!canToggle && !loading ? "No tenés permiso para habilitar/deshabilitar prestadores" : undefined}
              >
                {actionLabel}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{actionLabel} prestador</DialogTitle>
                <DialogDescription>
                  ¿Confirmás {actionLabel.toLowerCase()} al prestador {prestador.apellido}, {prestador.nombre}?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-end">
                <div className="flex items-center gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant={variant}
                      disabled={isUpdating === prestador.id || !canToggle || loading}
                      onClick={() => handleToggleActivo(prestador.id, prestador.activo)}
                    >
                      {isUpdating === prestador.id ? "Actualizando..." : "Confirmar"}
                    </Button>
                  </DialogClose>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        <div className="md:col-span-3">
          <label className="sr-only">Filtrar prestador</label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between h-10 rounded-md border border-input bg-background px-3 text-sm font-normal hover:bg-background"
              >
                <span className={selectedPrestLabel ? '' : 'text-muted-foreground'}>
                  {selectedPrestLabel || 'Filtrar por prestador'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-2">
              <Input
                placeholder="Buscar (Apellido Nombre o DNI)"
                value={fPrestador}
                onChange={(e) => setFPrestador(e.target.value)}
                className="mb-2"
              />
              {prestadores
                .filter(p => {
                  const full = `${p.apellido} ${p.nombre}`.toLowerCase();
                  const doc = (p.documento || '').toLowerCase();
                  const q = fPrestador.toLowerCase();
                  return full.includes(q) || doc.includes(q);
                })
                .map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedPrestLabel(`${p.apellido}, ${p.nombre}${p.documento ? ' - DNI ' + p.documento : ''}`);
                      table.getColumn('apellido')?.setFilterValue(p.apellido);
                      table.getColumn('nombre')?.setFilterValue(p.nombre);
                      table.getColumn('documento')?.setFilterValue(p.documento || "");
                    }}
                  >
                    {p.apellido}, {p.nombre}{p.documento ? ` - DNI ${p.documento}` : ''}
                  </Button>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Select
          value={filterActivo}
          onValueChange={(value) => {
            setFilterActivo(value as "todos" | "activos" | "inactivos");
            table.getColumn("activo")?.setFilterValue(value);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Activo (todos)</SelectItem>
            <SelectItem value="activos">Sólo activos</SelectItem>
            <SelectItem value="inactivos">Sólo inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable table={table} isLoading={loading} />
      <DataTablePagination table={table} showSelectedCount={false} />
    </div>
  );
}
