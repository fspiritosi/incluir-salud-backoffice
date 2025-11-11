"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { 
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, MoreHorizontalIcon, XCircle } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canCreateOrEditPrestacion } from "@/utils/permissions";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cancelPrestacion } from "@/app/protected/prestaciones/actions";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

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
  const { roles, loading } = useBackofficeRoles();
  const canWritePrestaciones = canCreateOrEditPrestacion(roles);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");

  const columns: ColumnDef<PrestacionRow>[] = [
    {
      accessorKey: "tipo_prestacion",
      header: "Tipo",
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ row }) => new Date(row.getValue("fecha")).toLocaleDateString('es-AR'),
      filterFn: (row, columnId, filterValues) => {
        const fecha = new Date(row.getValue(columnId));
        const [inicio, fin] = filterValues as [string, string];
        const toStart = (d: string) => new Date(`${d}T00:00:00`);
        const toEnd = (d: string) => new Date(`${d}T23:59:59.999`);

        if (!inicio && !fin) return true;
        if (inicio && !fin) return fecha >= toStart(inicio);
        if (!inicio && fin) return fecha <= toEnd(fin);
        return fecha >= toStart(inicio) && fecha <= toEnd(fin);
      },
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const raw = (row.getValue("estado") as string | null) || "-";
        const val = raw.toLowerCase();
        let cls = "";
        if (val === "completada") cls = "bg-green-100 text-green-800 border-green-200";
        else if (val === "pendiente") cls = "bg-yellow-100 text-yellow-800 border-yellow-200";
        else if (val === "cancelada") cls = "bg-red-100 text-red-800 border-red-200";
        else cls = "bg-muted text-foreground";
        return (
          <Badge variant="outline" className={`${cls} capitalize`}>{raw}</Badge>
        );
      },
      meta: {
        filterType: "select",
        options: ["pendiente", "completada", "cancelada", "todos"]
      },
      filterFn: (row, columnId, filterValue) => {
        const val = (filterValue as string) ?? "";
        if (!val || val === "todos") return true;
        const estado = (row.getValue(columnId) as string | null) ?? "";
        return estado.toLowerCase() === val.toLowerCase();
      }
    },
    {
      accessorKey: "monto",
      header: "Monto",
      cell: ({ row }) => row.getValue("monto") != null ? `$${Number(row.getValue("monto")).toFixed(2)}` : "-",
    },
    {
      accessorKey: "prestador",
      header: "Prestador",
      cell: ({ row }) => {
        const prestador = row.getValue("prestador") as PrestacionRow["prestador"];
        return prestador ? `${prestador.nombre} ${prestador.apellido}` : '-';
      },
      filterFn: (row, columnId, filterValue) => {
        const prestador = row.getValue(columnId) as PrestacionRow["prestador"];
        const fullName = prestador ? `${prestador.apellido} ${prestador.nombre}`.toLowerCase() : "";
        return fullName.includes(filterValue.toLowerCase());
      },
    },
    {
      accessorKey: "paciente",
      header: "Paciente",
      cell: ({ row }) => {
        const paciente = row.getValue("paciente") as PrestacionRow["paciente"];
        return paciente ? `${paciente.apellido}, ${paciente.nombre}` : '-';
      },
      filterFn: (row, columnId, filterValue) => {
        const paciente = row.getValue(columnId) as PrestacionRow["paciente"];
        const fullName = paciente ? `${paciente.apellido} ${paciente.nombre}`.toLowerCase() : "";
        return fullName.includes(filterValue.toLowerCase());
      },
    },
    {
      id: "paciente_documento",
      header: "DNI",
      accessorFn: (row) => row.paciente?.documento,
      cell: ({ row }) => {
        const paciente = row.getValue("paciente") as PrestacionRow["paciente"];
        return paciente?.documento || '-';
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const prestacion = row.original;
        const estado = (prestacion.estado || '').toLowerCase();
        if (!canWritePrestaciones || loading) {
          return (
            <Button
              size="icon"
              variant="outline"
              disabled
              title="No tenés permiso para editar prestaciones"
              aria-disabled
            >
              <Pencil className="h-4 w-4" />
            </Button>
          );
        }
        // Solo acciones para pendientes
        if (estado === 'pendiente') {
          return (
            <div className="flex items-center gap-2">
              <Link href={`/protected/prestaciones/editar/${prestacion.id}`} aria-label="Editar">
                <Button size="icon" variant="outline">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="icon" variant="destructive" aria-label="Cancelar prestación">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancelar prestación</DialogTitle>
                    <DialogDescription>
                      Esta acción cambiará el estado a <b>cancelada</b>. ¿Deseás continuar?
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
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              const { error } = await cancelPrestacion(prestacion.id);
                              if (error) {
                                toast({
                                  title: "No se pudo cancelar",
                                  description: error.message || "Intentalo nuevamente",
                                  variant: "destructive",
                                });
                              } else {
                                toast({
                                  title: "Prestación cancelada",
                                  description: "La prestación pasó a estado cancelada.",
                                });
                              }
                            });
                          }}
                        >
                          {isPending ? "Cancelando..." : "Confirmar"}
                        </Button>
                      </DialogClose>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          );
        }
        // Para completadas o canceladas: sin acciones de edición/cancelación
        return null;
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
        <h2 className="text-base font-semibold">Prestaciones</h2>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <MoreHorizontalIcon className="mr-2 h-4 w-4" />
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

      <div className="flex items-center gap-2 overflow-x-auto py-2">
        <Input
          placeholder="Tipo..."
          className="w-[120px]"
          value={(table.getColumn("tipo_prestacion")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("tipo_prestacion")?.setFilterValue(event.target.value)
          }
        />
        <Input
          placeholder="Paciente..."
          className="w-[120px]"
          value={(table.getColumn("paciente")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("paciente")?.setFilterValue(event.target.value)
          }
        />
        <Input
          placeholder="DNI..."
          className="w-[100px]"
          value={(table.getColumn("paciente_documento")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("paciente_documento")?.setFilterValue(event.target.value)
          }
        />
        <Input
          placeholder="Prestador..."
          className="w-[120px]"
          value={(table.getColumn("prestador")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("prestador")?.setFilterValue(event.target.value)
          }
        />
        <div className="w-[140px]">
          <Select
            value={(table.getColumn("estado")?.getFilterValue() as string) ?? ""}
            onValueChange={(value: string) =>
              table.getColumn("estado")?.setFilterValue(value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          type="date"
          className="w-[140px]"
          placeholder="Desde..."
          value={fechaInicio}
          onChange={(e) => {
            setFechaInicio(e.target.value);
            table.getColumn("fecha")?.setFilterValue([e.target.value, fechaFin]);
          }}
        />
        <Input
          type="date"
          className="w-[140px]"
          placeholder="Hasta..."
          value={fechaFin}
          onChange={(e) => {
            setFechaFin(e.target.value);
            table.getColumn("fecha")?.setFilterValue([fechaInicio, e.target.value]);
          }}
        />
      </div>

      <DataTable table={table} isLoading={loading} />
      
      <DataTablePagination 
        table={table} 
        showSelectedCount={false}
        showPageNumbers={true}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </div>
  );
}