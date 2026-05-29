"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, X, MoreHorizontal, ChevronDown, Loader2, User } from "lucide-react";
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
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { togglePrestadorActivo, previewPrestadorDisable, disablePrestadorConReasignacion } from "../actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

type Prestador = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean | null;
  created_at: string;
  especialidad?: string | null;
  avatar_url?: string | null;
};

type DisablePreviewData = Awaited<ReturnType<typeof previewPrestadorDisable>>["data"];

export default function PrestadoresTable({ prestadores }: { prestadores: Prestador[] }) {
  const router = useRouter();
  const { roles, loading } = useBackofficeRoles();
  const canToggle = canTogglePrestador(roles);
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filterActivo, setFilterActivo] = useState<"todos" | "activos" | "inactivos">("todos");
  const [fPrestador, setFPrestador] = useState("");
  const [selectedPrestLabel, setSelectedPrestLabel] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPrestador, setDialogPrestador] = useState<Prestador | null>(null);
  const [dialogMode, setDialogMode] = useState<"enable" | "disable" | null>(null);
  const [disableDate, setDisableDate] = useState<string>(() => new Date().toISOString());
  const [preview, setPreview] = useState<DisablePreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [replacementId, setReplacementId] = useState<string>("");
  const [submittingDisable, setSubmittingDisable] = useState(false);

  const handleToggleActivo = async (id: string, currentActivo: boolean | null, nombreCompleto: string) => {
    setIsUpdating(id);
    try {
      const { data, error } = await togglePrestadorActivo(id, !currentActivo);
      if (error) {
        toast({
          title: "No se pudo actualizar",
          description: error.message || "Intentá nuevamente",
          variant: "destructive",
        });
        return;
      }

      if (currentActivo) {
        const cancelled = data && 'cancelledCount' in data ? data.cancelledCount ?? 0 : 0;
        toast({
          title: "Prestador deshabilitado",
          description: cancelled > 0
            ? `${cancelled} prestaciones pendientes se cancelaron y pasaron al pool de reasignación.`
            : `No tenía prestaciones pendientes.`
        });
      } else {
        toast({
          title: "Prestador habilitado",
          description: `${nombreCompleto} vuelve a estar disponible.`,
        });
      }

      router.refresh();
    } catch (error) {
      console.error("Error al actualizar prestador:", error);
      toast({
        title: "Error inesperado",
        description: "No se pudo actualizar el prestador",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const futureCount = preview?.pendientesDesdeFecha.length ?? 0;
  const previasCount = preview?.pendientesPrevias.length ?? 0;
  const hasFuturePrestaciones = futureCount > 0;

  const normalizeEspecialidad = (value?: string | null) => (value ?? "").trim().toLowerCase();
  const targetEspecialidad = useMemo(() => {
    if (!dialogPrestador) return null as string | null;
    const prestadorEspecialidad = normalizeEspecialidad(dialogPrestador.especialidad);
    if (prestadorEspecialidad) return prestadorEspecialidad;
    const firstTipo = preview?.pendientesDesdeFecha?.[0]?.tipo_prestacion;
    return normalizeEspecialidad(firstTipo);
  }, [dialogPrestador, preview?.pendientesDesdeFecha]);

  const replacementCandidates = useMemo(() => {
    if (!dialogPrestador) return [] as Prestador[];
    if (!targetEspecialidad) return [] as Prestador[];
    return prestadores.filter((p) => {
      if (p.id === dialogPrestador.id) return false;
      if (!p.activo) return false;
      return normalizeEspecialidad(p.especialidad) === targetEspecialidad;
    });
  }, [dialogPrestador, prestadores, targetEspecialidad]);

  const columns: ColumnDef<Prestador>[] = [
    {
      id: "avatar",
      header: "",
      cell: ({ row }) => {
        const avatarUrl = row.original.avatar_url;
        const initials = [
          row.original.apellido?.[0] ?? "",
          row.original.nombre?.[0] ?? "",
        ]
          .join("")
          .toUpperCase();
        return (
          <div className="flex items-center justify-center">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`${row.original.apellido}, ${row.original.nombre}`}
                width={32}
                height={32}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {initials || <User className="h-4 w-4" />}
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
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
          <Button
            disabled={isUpdating === prestador.id || !canToggle || loading}
            variant={variant}
            size="sm"
            title={!canToggle && !loading ? "No tenés permiso para habilitar/deshabilitar prestadores" : undefined}
            onClick={() => {
              if (!canToggle || loading) return;
              const now = new Date();
              const nowIso = now.toISOString();
              setDialogPrestador(prestador);
              setDialogMode(prestador.activo ? "disable" : "enable");
              setDialogOpen(true);
              setDisableDate(nowIso);
              setReplacementId("");
              setPreview(null);
              if (prestador.activo) {
                loadPreview(prestador.id, nowIso);
              }
            }}
          >
            {isUpdating === prestador.id ? "Actualizando..." : actionLabel}
          </Button>
        );
      },
    }
  ];

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogPrestador(null);
    setDialogMode(null);
    setPreview(null);
    setReplacementId("");
    setPreviewLoading(false);
    setSubmittingDisable(false);
  };

  const loadPreview = async (prestadorId: string, isoDate: string) => {
    setPreviewLoading(true);
    const { data, error } = await previewPrestadorDisable(prestadorId, isoDate);
    if (error) {
      console.error("Error preview inhabilitación", error);
      toast({
        title: "No se pudo obtener la vista previa",
        description: error.message || "Intentá nuevamente",
        variant: "destructive",
      });
      setPreview(null);
    } else {
      setPreview(data);
    }
    setPreviewLoading(false);
  };

  const handleDisableSubmit = async () => {
    if (!dialogPrestador) return;
    const isoDate = new Date(disableDate);
    if (Number.isNaN(isoDate.getTime())) {
      toast({
        title: "Fecha inválida",
        description: "Ingresá una fecha de inhabilitación válida",
        variant: "destructive",
      });
      return;
    }
    try {
      setSubmittingDisable(true);
      setIsUpdating(dialogPrestador.id);
      const { data, error } = await disablePrestadorConReasignacion({
        prestadorId: dialogPrestador.id,
        nuevoPrestadorId: replacementId || null,
        fechaInhabilitacion: isoDate.toISOString(),
      });
      if (error) {
        throw error;
      }
      toast({
        title: "Prestador deshabilitado",
        description: data
          ? `${data.canceladasAntes} canceladas, ${data.reasignadas} reasignadas, ${data.enviadasAlPool} al pool.`
          : `${dialogPrestador.apellido}, ${dialogPrestador.nombre} fue deshabilitado.`,
      });
      router.refresh();
      closeDialog();
    } catch (error: any) {
      console.error("Error deshabilitando prestador", error);
      toast({
        title: "No se pudo deshabilitar",
        description: error?.message || "Intentá nuevamente",
        variant: "destructive",
      });
    } finally {
      setSubmittingDisable(false);
      setIsUpdating(null);
    }
  };

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
              <DropdownMenuItem
                onSelect={() => {
                  setSelectedPrestLabel("");
                  setFPrestador("");
                  table.getColumn('apellido')?.setFilterValue("");
                  table.getColumn('nombre')?.setFilterValue("");
                  table.getColumn('documento')?.setFilterValue("");
                }}
                className="text-sm text-muted-foreground"
              >
                Limpiar filtro (ver todos)
              </DropdownMenuItem>
              
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

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          closeDialog();
        } else {
          setDialogOpen(true);
        }
      }}>
        {dialogPrestador && dialogMode && (
          <DialogContent className="max-w-2xl">
            {dialogMode === "enable" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Habilitar prestador</DialogTitle>
                  <DialogDescription>
                    {`¿Confirmás habilitar a ${dialogPrestador.apellido}, ${dialogPrestador.nombre}?`}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="justify-end gap-2">
                  <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                  <Button
                    variant="default"
                    disabled={isUpdating === dialogPrestador.id}
                    onClick={() => {
                      closeDialog();
                      handleToggleActivo(
                        dialogPrestador.id,
                        dialogPrestador.activo,
                        `${dialogPrestador.apellido}, ${dialogPrestador.nombre}`
                      );
                    }}
                  >
                    {isUpdating === dialogPrestador.id ? "Actualizando..." : "Confirmar"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Deshabilitar prestador</DialogTitle>
                  <DialogDescription>
                    {`Revisá las prestaciones pendientes de ${dialogPrestador.apellido}, ${dialogPrestador.nombre} antes de confirmar.`}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Fecha de inhabilitación</p>
                    <p>{new Date(disableDate).toLocaleString("es-AR")}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Especialidad</p>
                    <p>{dialogPrestador.especialidad || "Sin dato"}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Prestaciones anteriores</p>
                    <p className="text-2xl font-semibold">{previasCount}</p>
                    <p className="text-xs text-muted-foreground">Se cancelarán automáticamente.</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Prestaciones desde la fecha</p>
                    <p className="text-2xl font-semibold">{futureCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {futureCount > 0
                        ? "Debés reasignarlas o irán al pool"
                        : "No requiere reasignación"}
                    </p>
                  </div>
                </div>

                {hasFuturePrestaciones && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nuevo prestador (misma especialidad)</label>
                    <Select value={replacementId} onValueChange={setReplacementId}>
                      <SelectTrigger disabled={replacementCandidates.length === 0}>
                        <SelectValue placeholder="Seleccioná un prestador" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {replacementCandidates.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            No hay prestadores disponibles con esta especialidad activa.
                          </div>
                        ) : (
                          replacementCandidates.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.apellido}, {p.nombre}
                              {p.documento ? ` - DNI ${p.documento}` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {replacementCandidates.length === 0 && (
                      <p className="text-xs text-destructive">
                        No hay prestadores activos con la misma especialidad. Las prestaciones irán al pool.
                      </p>
                    )}
                    {replacementCandidates.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Si no seleccionás un reemplazo, las prestaciones pendientes pasarán al pool.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-medium">Prestaciones a reevaluar</p>
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    {previewLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando vista previa...
                      </div>
                    ) : futureCount === 0 && previasCount === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No hay prestaciones pendientes.
                      </p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {preview?.pendientesDesdeFecha.map((prestacion) => (
                          <li key={prestacion.id} className="px-4 py-2">
                            <p className="font-medium">{prestacion.tipo_prestacion}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(prestacion.fecha).toLocaleDateString("es-AR")} · {prestacion.paciente?.apellido}, {prestacion.paciente?.nombre}
                            </p>
                          </li>
                        ))}
                        {preview && preview.pendientesDesdeFecha.length === 0 && (
                          <li className="px-4 py-2 text-xs text-muted-foreground">
                            Las prestaciones para cancelar se procesarán automáticamente.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>

                <DialogFooter className="justify-end gap-2">
                  <Button variant="outline" onClick={closeDialog} disabled={submittingDisable}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={submittingDisable || previewLoading}
                    onClick={handleDisableSubmit}
                  >
                    {submittingDisable ? "Procesando..." : "Confirmar deshabilitación"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
