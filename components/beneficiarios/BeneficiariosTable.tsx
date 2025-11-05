"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, UserX, RotateCcw, MoreHorizontal } from "lucide-react";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canCreateOrEditPaciente, canToggleBeneficiario } from "@/utils/permissions";
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
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  direccion_completa: string;
  ciudad: string | null;
  provincia: string | null;
  activo: boolean | null;
};

interface BeneficiariosTableProps {
  data: Paciente[];
}

export function BeneficiariosTable({ data }: BeneficiariosTableProps) {
  const router = useRouter();
  const { roles, loading } = useBackofficeRoles();
  const canEdit = canCreateOrEditPaciente(roles);
  const canToggle = canToggleBeneficiario(roles);
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [fActivo, setFActivo] = useState<"todos" | "si" | "no">("todos");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState<Paciente | null>(null);

  const columns: ColumnDef<Paciente>[] = [
    {
      accessorKey: "nombre",
      header: "Nombre",
      enableColumnFilter: true,
    },
    {
      accessorKey: "apellido",
      header: "Apellido",
      enableColumnFilter: true,
    },
    {
      accessorKey: "documento",
      header: "Documento",
      enableColumnFilter: true,
    },
    {
      accessorKey: "direccion_completa",
      header: "Dirección",
    },
    {
      accessorKey: "ciudad",
      header: "Ciudad",
      enableColumnFilter: true,
    },
    {
      accessorKey: "provincia",
      header: "Provincia",
      enableColumnFilter: true,
    },
    {
      accessorKey: "activo",
      header: "Activo",
      cell: ({ row }) => row.getValue("activo") ? "Sí" : "No",
      filterFn: (row, columnId, filterValue) => {
        const activo = row.getValue(columnId) as boolean;
        if (filterValue === "todos") return true;
        if (filterValue === "si") return activo;
        return !activo;
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const paciente = row.original;
        return (
          <div className="flex items-center gap-2">
            {canEdit && !loading ? (
              <Link href={`/protected/beneficiarios/editar/${paciente.id}`} aria-label="Editar">
                <Button size="icon" variant="outline">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button size="icon" variant="outline" disabled title="No tenés permiso para editar beneficiarios" aria-disabled>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {paciente.activo ? (
              <Button
                size="icon"
                variant="destructive"
                aria-label="Baja"
                disabled={busyId === paciente.id || !canToggle || loading}
                title={!canToggle && !loading ? "No tenés permiso para dar de baja beneficiarios" : undefined}
                onClick={() => { setTargetRow(paciente); setConfirmOpen(true); }}
              >
                <UserX className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="default"
                aria-label="Re-activar"
                disabled={busyId === paciente.id || !canToggle || loading}
                title={!canToggle && !loading ? "No tenés permiso para re-activar beneficiarios" : undefined}
                onClick={() => toggleActivo(paciente)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const toggleActivo = async (row: Paciente) => {
    try {
      setBusyId(row.id);
      const res = await fetch(`/api/beneficiarios/${row.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !row.activo }),
      });
      if (!res.ok) {
        console.error("No se pudo cambiar el estado");
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const table = useReactTable({
    data,
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
        <h2 className="text-base font-semibold">Beneficiarios</h2>
        
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
          placeholder="Filtrar nombre"
          value={(table.getColumn("nombre")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("nombre")?.setFilterValue(e.target.value)}
        />
        <Input
          placeholder="Filtrar apellido"
          value={(table.getColumn("apellido")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("apellido")?.setFilterValue(e.target.value)}
        />
        <Input
          placeholder="Filtrar documento"
          value={(table.getColumn("documento")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("documento")?.setFilterValue(e.target.value)}
        />
        <Input
          placeholder="Filtrar ciudad"
          value={(table.getColumn("ciudad")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("ciudad")?.setFilterValue(e.target.value)}
        />
        <Input
          placeholder="Filtrar provincia"
          value={(table.getColumn("provincia")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("provincia")?.setFilterValue(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={fActivo}
          onChange={(e) => {
            setFActivo(e.target.value as any);
            table.getColumn("activo")?.setFilterValue(e.target.value);
          }}
        >
          <option value="todos">Activo (todos)</option>
          <option value="si">Sólo activos</option>
          <option value="no">Sólo inactivos</option>
        </select>
      </div>

      <DataTable table={table} isLoading={loading} />
      
      <DataTablePagination table={table} showSelectedCount={false} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar baja</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Realmente desea dar de baja este beneficiario?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (targetRow) {
                  await toggleActivo(targetRow);
                }
                setConfirmOpen(false);
                setTargetRow(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
