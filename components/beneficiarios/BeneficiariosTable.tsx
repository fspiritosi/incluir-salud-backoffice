"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, UserX, RotateCcw, MoreHorizontal, ChevronDown, Eye } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [identidadSearch, setIdentidadSearch] = useState("");
  const [identidadSelected, setIdentidadSelected] = useState<string[]>([]);
  const [ciudadSearch, setCiudadSearch] = useState("");
  const [provinciaSearch, setProvinciaSearch] = useState("");

  const buildOptions = (selector: (p: Paciente) => string | null | undefined) => {
    const set = new Set<string>();
    data.forEach((item) => {
      const value = selector(item);
      if (value) set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  const identidadOptions = useMemo(() => {
    const formatLabel = (paciente: Paciente) => {
      const nombreCompleto = [paciente.apellido, paciente.nombre].filter(Boolean).join(", ");
      const documento = paciente.documento ? ` · DNI ${paciente.documento}` : "";
      return `${nombreCompleto || "Sin datos"}${documento}`;
    };

    return data
      .map((paciente) => ({ value: paciente.id, label: formatLabel(paciente) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);
  const identidadLabels = useMemo(() => {
    const map = new Map<string, string>();
    identidadOptions.forEach(({ value, label }) => map.set(value, label));
    return map;
  }, [identidadOptions]);
  const ciudadOptions = useMemo(() => buildOptions((p) => p.ciudad ?? undefined), [data]);
  const provinciaOptions = useMemo(() => buildOptions((p) => p.provincia ?? undefined), [data]);

  const tableData = useMemo(() => {
    if (!identidadSelected.length) return data;
    return data.filter((paciente) => identidadSelected.includes(paciente.id));
  }, [data, identidadSelected]);

  const columns: ColumnDef<Paciente>[] = [
    {
      accessorKey: "nombre",
      header: "Nombre",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = (row.getValue(columnId) as string) || "";
        return values.includes(value);
      },
    },
    {
      accessorKey: "apellido",
      header: "Apellido",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = (row.getValue(columnId) as string) || "";
        return values.includes(value);
      },
    },
    {
      accessorKey: "documento",
      header: "Documento",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = (row.getValue(columnId) as string) || "";
        return values.includes(value);
      },
    },
    {
      accessorKey: "direccion_completa",
      header: "Dirección",
    },
    {
      accessorKey: "ciudad",
      header: "Ciudad",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = (row.getValue(columnId) as string) || "";
        return values.includes(value);
      },
    },
    {
      accessorKey: "provincia",
      header: "Provincia",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = (row.getValue(columnId) as string) || "";
        return values.includes(value);
      },
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
            <Link href={`/protected/beneficiarios/${paciente.id}`} aria-label="Ver detalle">
              <Button size="icon" variant="outline">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
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
    data: tableData,
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="truncate text-left">
                {(() => {
                  if (identidadSelected.length === 0) return "Nombre / Apellido / Documento...";
                  if (identidadSelected.length === 1) {
                    return identidadLabels.get(identidadSelected[0]) || "1 seleccionado";
                  }
                  return `${identidadSelected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2">
            <Input
              placeholder="Buscar nombre, apellido o documento"
              value={identidadSearch}
              onChange={(e) => setIdentidadSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {identidadOptions
                .filter(({ label }) => label.toLowerCase().includes(identidadSearch.toLowerCase().trim()))
                .map(({ value, label }) => {
                  const isChecked = identidadSelected.includes(value);
                  return (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          setIdentidadSelected((current) => {
                            const next = isChecked
                              ? current.filter((item) => item !== value)
                              : [...current, value];
                            return next;
                          });
                        }}
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })}
              {identidadOptions.filter(({ label }) => label.toLowerCase().includes(identidadSearch.toLowerCase().trim())).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        {[
          { key: "ciudad", label: "Ciudades...", options: ciudadOptions, search: ciudadSearch, setSearch: setCiudadSearch },
          { key: "provincia", label: "Provincias...", options: provinciaOptions, search: provinciaSearch, setSearch: setProvinciaSearch },
        ].map(({ key, label, options, search, setSearch }) => (
          <DropdownMenu key={key}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="truncate text-left">
                  {(() => {
                    const selected = (table.getColumn(key)?.getFilterValue() as string[]) || [];
                    if (!selected?.length) return label;
                    if (selected.length === 1) return selected[0];
                    return `${selected.length} seleccionados`;
                  })()}
                </span>
                <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2">
              <Input
                placeholder={`Buscar ${label.toLowerCase().replace('...', '')}`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-[320px] overflow-y-auto space-y-2">
                {options.filter((option) => option.toLowerCase().includes(search.toLowerCase().trim())).map((option) => {
                  const selected = (table.getColumn(key)?.getFilterValue() as string[]) || [];
                  const isChecked = selected.includes(option);
                  return (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          const column = table.getColumn(key);
                          if (!column) return;
                          const current = (column.getFilterValue() as string[]) || [];
                          const next = isChecked
                            ? current.filter((value) => value !== option)
                            : [...current, option];
                          column.setFilterValue(next.length ? next : undefined);
                        }}
                      />
                      <span className="truncate">{option}</span>
                    </label>
                  );
                })}
                {options.filter((option) => option.toLowerCase().includes(search.toLowerCase().trim())).length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin resultados</p>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        <Select
          value={fActivo}
          onValueChange={(value) => {
            setFActivo(value as "todos" | "si" | "no");
            table.getColumn("activo")?.setFilterValue(value);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Activo (todos)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Activo (todos)</SelectItem>
            <SelectItem value="si">Sólo activos</SelectItem>
            <SelectItem value="no">Sólo inactivos</SelectItem>
          </SelectContent>
        </Select>
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
