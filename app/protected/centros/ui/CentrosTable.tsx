"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { MapPin, Pencil, UserX, Check, X, Users, MoreHorizontal, ChevronDown } from "lucide-react";

type CentroTipo = "geriatrico" | "escuela" | "centro medico" | "otro";

type Centro = {
  id: string;
  nombre: string;
  tipo: CentroTipo;
  direccion_completa: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  radio_metros: number;
  activo: boolean | null;
  ubicacion?: any;
};

const TIPO_LABEL: Record<CentroTipo, string> = {
  geriatrico: "Geriátrico",
  escuela: "Escuela",
  "centro medico": "Centro médico",
  otro: "Otro",
};

const UBICACION_OPTIONS = [
  { value: "con", label: "Con ubicación" },
  { value: "sin", label: "Sin ubicación" },
] as const;

type UbicacionFilterValue = (typeof UBICACION_OPTIONS)[number]["value"];

const normalizeStringArray = (values: string[] = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export default function CentrosTable({ data }: { data: Centro[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [fNombreSearch, setFNombreSearch] = useState("");
  const [fNombres, setFNombres] = useState<string[]>([]);
  const [fTipoSearch, setFTipoSearch] = useState("");
  const [fTipos, setFTipos] = useState<CentroTipo[]>([]);
  const [fUbicacionSearch, setFUbicacionSearch] = useState("");
  const [fUbicacion, setFUbicacion] = useState<UbicacionFilterValue[]>([]);

  const rows = useMemo(() => data || [], [data]);
  const nombresDisponibles = useMemo(
    () => Array.from(new Set(rows.map((row) => row.nombre))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const tiposDisponibles = useMemo(() => Array.from(new Set(rows.map((row) => row.tipo))), [rows]);
  const tiposFiltrados = useMemo(() => {
    const q = fTipoSearch.trim().toLowerCase();
    if (!q) return tiposDisponibles;
    return tiposDisponibles.filter((tipo) => TIPO_LABEL[tipo].toLowerCase().includes(q));
  }, [fTipoSearch, tiposDisponibles]);
  const nombresFiltrados = useMemo(() => {
    const q = fNombreSearch.trim().toLowerCase();
    if (!q) return nombresDisponibles;
    return nombresDisponibles.filter((nombre) => nombre.toLowerCase().includes(q));
  }, [fNombreSearch, nombresDisponibles]);
  const ubicacionesFiltradas = useMemo(() => {
    const q = fUbicacionSearch.trim().toLowerCase();
    if (!q) return UBICACION_OPTIONS;
    return UBICACION_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [fUbicacionSearch]);

  const toggleActivo = async (centroId: string, activo: boolean) => {
    setPendingId(centroId);
    try {
      const res = await fetch(`/api/centros/${centroId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "No se pudo actualizar");
      }
      toast({ title: "Actualizado", description: "Estado del centro actualizado" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No se pudo actualizar", variant: "destructive" });
    } finally {
      setPendingId(null);
    }
  };

  const columns: ColumnDef<Centro>[] = [
    {
      accessorKey: "nombre",
      header: "Nombre",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = String(row.getValue(columnId) || "");
        return values.includes(value);
      },
    },
    {
      accessorKey: "tipo",
      header: "Tipo",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as CentroTipo[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = row.getValue(columnId) as CentroTipo;
        return values.includes(value);
      },
      cell: ({ row }) => <Badge variant="outline">{TIPO_LABEL[row.original.tipo] || row.original.tipo}</Badge>,
    },
    {
      accessorKey: "direccion_completa",
      header: "Dirección",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.direccion_completa}</span>,
    },
    {
      accessorKey: "radio_metros",
      header: "Radio",
      cell: ({ row }) => `${row.original.radio_metros} m`,
    },
    {
      id: "tiene_ubicacion",
      header: "Ubicación",
      accessorFn: (row) => Boolean(row.ubicacion),
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const hasLocation = row.getValue(columnId) as boolean;
        const values = (filterValue as UbicacionFilterValue[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value: UbicacionFilterValue = hasLocation ? "con" : "sin";
        return values.includes(value);
      },
      cell: ({ row }) => {
        const tieneUbic = !!row.original.ubicacion;
        return tieneUbic ? (
          <span className="inline-flex items-center gap-2 text-green-700">
            <MapPin className="h-4 w-4" />
            OK
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-red-700">
            <MapPin className="h-4 w-4" />
            Falta
          </span>
        );
      },
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ row }) =>
        row.original.activo ? (
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
    },
    {
      id: "actions",
      header: "Acciones",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const c = row.original;
        const isBusy = pendingId === c.id;
        return (
          <div className="flex items-center gap-2">
            <Link href={`/protected/centros/${c.id}/pacientes`}>
              <Button size="sm" variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Pacientes
              </Button>
            </Link>
            <Link href={`/protected/centros/editar/${c.id}`}>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
            <Button
              size="sm"
              variant={c.activo ? "destructive" : "default"}
              disabled={isBusy}
              onClick={() => toggleActivo(c.id, !c.activo)}
            >
              <UserX className="h-4 w-4 mr-2" />
              {c.activo ? "Desactivar" : "Activar"}
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: rows,
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

  const appliedNombres = normalizeStringArray(
    ((table.getColumn("nombre")?.getFilterValue() as string[] | undefined) ?? [])
  );
  const appliedTipos = normalizeStringArray(
    ((table.getColumn("tipo")?.getFilterValue() as CentroTipo[] | undefined) ?? []).map(String)
  );
  const appliedUbicacion = normalizeStringArray(
    ((table.getColumn("tiene_ubicacion")?.getFilterValue() as UbicacionFilterValue[] | undefined) ?? []).map(String)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Centros</h2>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="truncate text-left">
                {fNombres.length === 0
                  ? "Filtrar por nombre"
                  : fNombres.length === 1
                    ? fNombres[0]
                    : `${fNombres.length} seleccionados`}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 p-2">
            <Input
              placeholder="Buscar nombre"
              value={fNombreSearch}
              onChange={(e) => setFNombreSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {nombresFiltrados.map((nombre) => {
                const checked = fNombres.includes(nombre);
                return (
                  <label key={nombre} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        setFNombres((current) => {
                          return checked ? current.filter((n) => n !== nombre) : [...current, nombre];
                        });
                      }}
                    />
                    <span className="truncate">{nombre}</span>
                  </label>
                );
              })}
              {nombresFiltrados.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados</p>}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFNombres([]);
                  table.getColumn("nombre")?.setFilterValue(undefined);
                }}
                disabled={fNombres.length === 0}
              >
                Limpiar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const next = normalizeStringArray(fNombres);
                  table.getColumn("nombre")?.setFilterValue(next.length ? next : undefined);
                }}
                disabled={arraysEqual(normalizeStringArray(fNombres), appliedNombres)}
              >
                Aplicar
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="truncate text-left">
                {fTipos.length === 0
                  ? "Filtrar por tipo"
                  : fTipos.length === 1
                    ? TIPO_LABEL[fTipos[0]]
                    : `${fTipos.length} seleccionados`}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2">
            <Input
              placeholder="Buscar tipo"
              value={fTipoSearch}
              onChange={(e) => setFTipoSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {tiposFiltrados.map((tipo) => {
                const checked = fTipos.includes(tipo);
                return (
                  <label key={tipo} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        setFTipos((current) => {
                          return checked ? current.filter((t) => t !== tipo) : [...current, tipo];
                        });
                      }}
                    />
                    <span className="truncate">{TIPO_LABEL[tipo]}</span>
                  </label>
                );
              })}
              {tiposFiltrados.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados</p>}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFTipos([]);
                  table.getColumn("tipo")?.setFilterValue(undefined);
                }}
                disabled={fTipos.length === 0}
              >
                Limpiar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const next = normalizeStringArray(fTipos.map(String));
                  table.getColumn("tipo")?.setFilterValue(next.length ? next : undefined);
                }}
                disabled={arraysEqual(normalizeStringArray(fTipos.map(String)), appliedTipos)}
              >
                Aplicar
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="truncate text-left">
                {fUbicacion.length === 0
                  ? "Filtrar por ubicación"
                  : fUbicacion.length === 1
                    ? UBICACION_OPTIONS.find((opt) => opt.value === fUbicacion[0])?.label
                    : `${fUbicacion.length} seleccionados`}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2">
            <Input
              placeholder="Buscar ubicación"
              value={fUbicacionSearch}
              onChange={(e) => setFUbicacionSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {ubicacionesFiltradas.map((opt) => {
                const checked = fUbicacion.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        setFUbicacion((current) => {
                          return checked
                            ? current.filter((value) => value !== opt.value)
                            : [...current, opt.value];
                        });
                      }}
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
              {ubicacionesFiltradas.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados</p>}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFUbicacion([]);
                  table.getColumn("tiene_ubicacion")?.setFilterValue(undefined);
                }}
                disabled={fUbicacion.length === 0}
              >
                Limpiar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const next = normalizeStringArray(fUbicacion.map(String));
                  table.getColumn("tiene_ubicacion")?.setFilterValue(next.length ? next : undefined);
                }}
                disabled={arraysEqual(normalizeStringArray(fUbicacion.map(String)), appliedUbicacion)}
              >
                Aplicar
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable table={table} />
      <DataTablePagination table={table} showSelectedCount={false} />
    </div>
  );
}
