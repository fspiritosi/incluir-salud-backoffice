"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Pencil, MoreHorizontalIcon, XCircle, ChevronDown } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type CheckedState = boolean | 'indeterminate';

export type PrestacionRow = {
  id: string;
  tipo_prestacion: string;
  fecha: string;
  estado: string | null;
  monto: number | null;
  cronico?: boolean | null;
  sentido_transporte?: string | null;
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

export const PrestacionesTable = ({ data }: { data: PrestacionRow[] }) => {
  const router = useRouter();
  const { roles, loading } = useBackofficeRoles();
  const canWritePrestaciones = canCreateOrEditPrestacion(roles);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");

  const [rowSelection, setRowSelection] = useState({});
  const [massEditOpen, setMassEditOpen] = useState(false);
  const [massEditError, setMassEditError] = useState('');
  const [massEditDay, setMassEditDay] = useState<string | null>(null);
  const [massEditMonto, setMassEditMonto] = useState<string>('');
  const [massEditTime, setMassEditTime] = useState<string>('');
  const [massEditSaving, setMassEditSaving] = useState(false);
  const [massEditSaveError, setMassEditSaveError] = useState<string | null>(null);
  const [massEditCronico, setMassEditCronico] = useState<boolean>(false);
  const [massEditCronicoMixed, setMassEditCronicoMixed] = useState<boolean>(false);
  const [massCancelOpen, setMassCancelOpen] = useState(false);
  const [massCancelSaving, setMassCancelSaving] = useState(false);
  const [massCancelError, setMassCancelError] = useState<string | null>(null);
  const [tipoFilterSearch, setTipoFilterSearch] = useState('');
  const [pacienteFilterSearch, setPacienteFilterSearch] = useState('');
  const [prestadorFilterSearch, setPrestadorFilterSearch] = useState('');
  const [diaFilterSearch, setDiaFilterSearch] = useState('');

  const enhancedData = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("es-AR", { weekday: "long" });
    return data.map((item) => {
      const fechaDate = new Date(item.fecha);
      const weekday = formatter.format(fechaDate);
      const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return {
        ...item,
        dia_semana: capitalizedWeekday,
      };
    });
  }, [data]);

  const tipoOptions = useMemo(() => {
    const set = new Set<string>();
    enhancedData.forEach(item => {
      if (item.tipo_prestacion) set.add(item.tipo_prestacion);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enhancedData]);

  const pacientesOptions = useMemo(() => {
    const map = new Map<string, string>();
    enhancedData.forEach((item) => {
      if (item.paciente?.id) {
        const fullName = `${item.paciente.apellido}, ${item.paciente.nombre}`;
        map.set(item.paciente.id, fullName);
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enhancedData]);

  const prestadoresOptions = useMemo(() => {
    const map = new Map<string, string>();
    enhancedData.forEach((item) => {
      if (item.prestador?.id) {
        const fullName = `${item.prestador.apellido ?? ''} ${item.prestador.nombre ?? ''}`.trim();
        map.set(item.prestador.id, fullName || item.prestador.id);
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label: label || 'Prestador sin nombre' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enhancedData]);

  const diasSemanaOptions = useMemo(() => {
    const set = new Set<string>();
    enhancedData.forEach(item => {
      if (item.dia_semana) set.add(item.dia_semana);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enhancedData]);

  const columns: ColumnDef<PrestacionRow & { dia_semana?: string }>[] = [
    {
      id: "select",
      header: ({ table }) => {
        const checked = table.getIsAllPageRowsSelected()
          ? true
          : table.getIsSomePageRowsSelected()
            ? "indeterminate"
            : false;
        return (
          <Checkbox
            checked={checked as CheckedState}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            disabled={table.getRowModel().rows.filter(row => row.getCanSelect()).length === 0}
          />
        );
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          disabled={!row.getCanSelect()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "tipo_prestacion",
      header: "Tipo",
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = row.getValue(columnId) as string | undefined;
        if (!value) return false;
        return values.includes(value);
      },
    },
    {
      accessorKey: "sentido_transporte",
      header: "Sentido",
      cell: ({ row }) => {
        const tipo = (row.getValue("tipo_prestacion") as string) || "";
        if (tipo !== "Transporte") return "-";
        const sentido = (row.getValue("sentido_transporte") as string | null) || "-";
        if (sentido === "ida") return "Ida";
        if (sentido === "vuelta") return "Vuelta";
        if (sentido === "ida_y_vuelta") return "Ida y vuelta";
        return sentido;
      },
      enableColumnFilter: false,
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
      accessorKey: "dia_semana",
      header: "Día",
      cell: ({ row }) => {
        const value = row.getValue("dia_semana") as string | undefined;
        return value || "-";
      },
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const value = (row.getValue(columnId) as string | undefined) ?? "";
        return values.includes(value);
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
      accessorKey: "cronico",
      header: () => {
        const cronicas = data.filter(item => item.cronico).length;
        return (
          <div className="flex flex-col">
            <span>Crónica</span>
            <span className="text-xs text-muted-foreground">{cronicas} activas</span>
          </div>
        );
      },
      cell: ({ row }) => {
        const value = Boolean(row.getValue("cronico"));
        return value ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Sí
          </Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
        );
      },
      enableSorting: false,
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
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const prestador = row.getValue(columnId) as PrestacionRow["prestador"];
        if (!prestador?.id) return false;
        return values.includes(prestador.id);
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
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const paciente = row.getValue(columnId) as PrestacionRow["paciente"];
        if (!paciente?.id) return false;
        return values.includes(paciente.id);
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

  const formatLocalTimestamp = (date: Date) => {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 19);
  };

  const table = useReactTable({
    data: enhancedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: (row) => {
      const estado = (row.original.estado || '').toLowerCase();
      return estado === 'pendiente';
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;
  const selectedRows = table.getRowModel().rows
    .filter(row => row.getIsSelected())
    .map(row => row.original);
  const referenceRow = selectedRows[0];

  const allSamePrestador = selectedRows.every(r => r.prestador?.id === referenceRow?.prestador?.id);
  const allSamePaciente = selectedRows.every(r => r.paciente?.id === referenceRow?.paciente?.id);
  const allSameTipo = selectedRows.every(r => r.tipo_prestacion === referenceRow?.tipo_prestacion);
  const allSameCronico = selectedRows.every(r => Boolean(r.cronico) === Boolean(referenceRow?.cronico));
  const toDay = (fecha?: string) => {
    if (!fecha) return null;
    const d = new Date(fecha);
    return Number.isNaN(d.getTime()) ? null : d.getDay();
  };
  const toTime = (fecha?: string) => {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };
  const referenceDay = toDay(referenceRow?.fecha);
  const referenceTime = toTime(referenceRow?.fecha);
  const allSameDay = selectedRows.every(r => toDay(r.fecha) === referenceDay);
  const allSameTime = selectedRows.every(r => toTime(r.fecha) === referenceTime);

  const canEditSchedule =
    selectedRows.length > 0 &&
    allSamePrestador &&
    allSamePaciente &&
    allSameTipo &&
    allSameDay &&
    allSameTime &&
    allSameCronico;

  const canEditCronicoOnly =
    selectedRows.length > 0 &&
    allSamePrestador &&
    allSamePaciente &&
    allSameCronico &&
    !canEditSchedule;

  const isValidSelection = canEditSchedule || canEditCronicoOnly;
  const validateSelection = () => {
    if (selectedCount === 0) return false;

    if (!isValidSelection) {
      if (!allSamePrestador || !allSamePaciente) {
        setMassEditError('Seleccioná prestaciones del mismo prestador y beneficiario.');
      } else if (!allSameCronico) {
        setMassEditError('Todos deben compartir el mismo estado crónico.');
      } else if (!allSameTipo) {
        setMassEditError('Las prestaciones deben ser del mismo tipo.');
      } else {
        setMassEditError('Para cambiar día/hora, todas deben compartir la misma agenda.');
      }
      return false;
    }

    setMassEditError('');
    return true;
  };

  const prepareMassEditState = () => {
    if (!selectedRows.length) {
      setMassEditCronico(false);
      setMassEditCronicoMixed(false);
      setMassEditDay(null);
      setMassEditMonto('');
      setMassEditTime('');
      return;
    }

    const firstValue = Boolean(selectedRows[0].cronico);
    const isMixed = selectedRows.some(row => Boolean(row.cronico) !== firstValue);
    setMassEditCronico(isMixed ? false : firstValue);
    setMassEditCronicoMixed(isMixed);

    if (canEditSchedule && referenceRow) {
      setMassEditDay(referenceDay != null ? referenceDay.toString() : null);
      setMassEditMonto(referenceRow.monto != null ? referenceRow.monto.toString() : '');
      setMassEditTime(referenceTime ?? '');
    } else {
      setMassEditDay(null);
      setMassEditMonto('');
      setMassEditTime('');
    }
  };

  const handleMassEditClick = () => {
    if (validateSelection()) {
      prepareMassEditState();
      setMassEditOpen(true);
    } else {
      setMassEditOpen(true); // Mostrar diálogo con error
    }
  };

  const handleMassEditSave = () => {
    if (!selectedRows.length) return;

    const targetDayString = canEditSchedule && referenceRow
      ? massEditDay ?? new Date(referenceRow.fecha).getDay().toString()
      : null;
    const targetDay = targetDayString != null ? Number(targetDayString) : null;
    const trimmedTime = massEditTime.trim();
    const hasTimeChange = canEditSchedule && trimmedTime !== '';

    const montoNumber = canEditSchedule
      ? massEditMonto.trim() === ''
        ? referenceRow?.monto ?? null
        : Number(massEditMonto)
      : null;

    setMassEditSaving(true);
    setMassEditSaveError(null);

    startTransition(async () => {
      try {
        for (const row of selectedRows) {
          if (!row.user_id) {
            continue;
          }

          const payload: Record<string, any> = {
            user_id: row.user_id,
            cronico: Boolean(massEditCronico),
          };

          if (canEditSchedule && referenceRow) {
            const originalDate = new Date(row.fecha);
            const newDate = new Date(originalDate);

            if (targetDay !== null) {
              const diff = targetDay - originalDate.getDay();
              newDate.setDate(originalDate.getDate() + diff);
            }

            if (hasTimeChange) {
              const [hoursStr = '0', minutesStr = '0'] = trimmedTime.split(':');
              const hours = Math.min(23, Math.max(0, Number(hoursStr) || 0));
              const minutes = Math.min(59, Math.max(0, Number(minutesStr) || 0));
              newDate.setHours(hours, minutes, 0, 0);
            }

            payload.fecha = formatLocalTimestamp(newDate);
            payload.monto = montoNumber;
          }

          const res = await fetch(`/api/prestaciones/${row.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            throw new Error('Error al actualizar una de las prestaciones');
          }
        }

        toast({
          title: 'Prestaciones actualizadas',
          description: canEditSchedule
            ? 'Se guardaron los cambios de día, horario, monto y estado crónico.'
            : 'Se actualizó el estado crónico de las prestaciones seleccionadas.',
        });
        setMassEditOpen(false);
        setRowSelection({});
        router.refresh();
      } catch (e) {
        setMassEditSaveError(
          'No se pudieron guardar los cambios. Intentalo nuevamente.'
        );
      } finally {
        setMassEditSaving(false);
      }
    });
  };

  const handleMassCancelSave = () => {
    if (!selectedRows.length) return;

    setMassCancelSaving(true);
    setMassCancelError(null);

    startTransition(async () => {
      try {
        for (const row of selectedRows) {
          const { error } = await cancelPrestacion(row.id);
          if (error) {
            throw error;
          }
        }

        toast({
          title: 'Prestaciones canceladas',
          description: 'Las prestaciones seleccionadas fueron canceladas.',
        });
        setMassCancelOpen(false);
        setRowSelection({});
        router.refresh();
      } catch (e) {
        setMassCancelError('No se pudieron cancelar todas las prestaciones. Intentalo nuevamente.');
      } finally {
        setMassCancelSaving(false);
      }
    });
  };

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Inicio (desde)</span>
          <Input
            type="date"
            className="w-[150px]"
            value={fechaInicio}
            onChange={(event) => {
              const value = event.target.value;
              setFechaInicio(value);
              table.getColumn("fecha")?.setFilterValue([value, fechaFin]);
            }}
            placeholder="Desde"
            aria-label="Fecha de inicio"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Fin (hasta)</span>
          <Input
            type="date"
            className="w-[150px]"
            value={fechaFin}
            onChange={(event) => {
              const value = event.target.value;
              setFechaFin(value);
              table.getColumn("fecha")?.setFilterValue([fechaInicio, value]);
            }}
            placeholder="Hasta"
            aria-label="Fecha de fin"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between">
              <span className="truncate text-left">
                {(() => {
                  const selected = (table.getColumn("dia_semana")?.getFilterValue() as string[]) || [];
                  if (!selected?.length) return "Días...";
                  if (selected.length === 1) return selected[0];
                  return `${selected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2">
            <Input
              placeholder="Buscar día"
              value={diaFilterSearch}
              onChange={(e) => setDiaFilterSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {diasSemanaOptions
                .filter(option => option.toLowerCase().includes(diaFilterSearch.toLowerCase().trim()))
                .map(option => {
                  const selected = (table.getColumn("dia_semana")?.getFilterValue() as string[]) || [];
                  const isChecked = selected.includes(option);
                  return (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          const column = table.getColumn("dia_semana");
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
              {diasSemanaOptions.filter(option => option.toLowerCase().includes(diaFilterSearch.toLowerCase().trim())).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between">
              <span className="truncate text-left">
                {(() => {
                  const selected = (table.getColumn("tipo_prestacion")?.getFilterValue() as string[]) || [];
                  if (!selected?.length) return "Tipos...";
                  if (selected.length === 1) return selected[0];
                  return `${selected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2">
            <Input
              placeholder="Buscar tipo"
              value={tipoFilterSearch}
              onChange={(e) => setTipoFilterSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {tipoOptions.filter(option => option.toLowerCase().includes(tipoFilterSearch.toLowerCase().trim())).map(option => {
                const selected = (table.getColumn("tipo_prestacion")?.getFilterValue() as string[]) || [];
                const isChecked = selected.includes(option);
                return (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => {
                        const column = table.getColumn("tipo_prestacion");
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
              {tipoOptions.filter(option => option.toLowerCase().includes(tipoFilterSearch.toLowerCase().trim())).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between">
              <span className="truncate text-left">
                {(() => {
                  const selected = (table.getColumn("paciente")?.getFilterValue() as string[]) || [];
                  if (!selected?.length) return "Pacientes...";
                  if (selected.length === 1) {
                    const option = pacientesOptions.find(opt => opt.id === selected[0]);
                    return option?.label || "1 seleccionado";
                  }
                  return `${selected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2">
            <Input
              placeholder="Buscar paciente"
              value={pacienteFilterSearch}
              onChange={(e) => setPacienteFilterSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {pacientesOptions.filter(opt => opt.label.toLowerCase().includes(pacienteFilterSearch.toLowerCase().trim()))
                .map((option) => {
                  const selected = ((table.getColumn("paciente")?.getFilterValue() as string[]) || []);
                  const isChecked = selected.includes(option.id);
                  return (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          const column = table.getColumn("paciente");
                          if (!column) return;
                          const current = (column.getFilterValue() as string[]) || [];
                          const next = isChecked
                            ? current.filter((id) => id !== option.id)
                            : [...current, option.id];
                          column.setFilterValue(next.length ? next : undefined);
                        }}
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  );
                })}
              {pacientesOptions.filter(opt => opt.label.toLowerCase().includes(pacienteFilterSearch.toLowerCase().trim())).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Input
          placeholder="DNI..."
          className="w-[100px]"
          value={(table.getColumn("paciente_documento")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("paciente_documento")?.setFilterValue(event.target.value)
          }
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between">
              <span className="truncate text-left">
                {(() => {
                  const selected = (table.getColumn("prestador")?.getFilterValue() as string[]) || [];
                  if (!selected?.length) return "Prestadores...";
                  if (selected.length === 1) {
                    const option = prestadoresOptions.find(opt => opt.id === selected[0]);
                    return option?.label || "1 seleccionado";
                  }
                  return `${selected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-2">
            <Input
              placeholder="Buscar prestador"
              value={prestadorFilterSearch}
              onChange={(e) => setPrestadorFilterSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {prestadoresOptions.filter(opt => opt.label.toLowerCase().includes(prestadorFilterSearch.toLowerCase().trim()))
                .map((option) => {
                  const selected = ((table.getColumn("prestador")?.getFilterValue() as string[]) || []);
                  const isChecked = selected.includes(option.id);
                  return (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          const column = table.getColumn("prestador");
                          if (!column) return;
                          const current = (column.getFilterValue() as string[]) || [];
                          const next = isChecked
                            ? current.filter((id) => id !== option.id)
                            : [...current, option.id];
                          column.setFilterValue(next.length ? next : undefined);
                        }}
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  );
                })}
              {prestadoresOptions.filter(opt => opt.label.toLowerCase().includes(prestadorFilterSearch.toLowerCase().trim())).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
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
      </div>

      <DataTable table={table} isLoading={loading} />
      
      <DataTablePagination 
        table={table} 
        showSelectedCount={true}
        showPageNumbers={true}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {selectedCount > 0 && (
      <div className="mt-4 flex justify-end">
        <Button 
          onClick={handleMassEditClick}
          variant="outline"
          className="bg-blue-50 text-blue-600 hover:bg-blue-100"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar {selectedCount} seleccionadas
        </Button>

        <Dialog open={massEditOpen} onOpenChange={setMassEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar {selectedCount} prestaciones</DialogTitle>
              {massEditError ? (
                <div className="text-red-600">{massEditError}</div>
              ) : (
                <DialogDescription>
                  {canEditSchedule
                    ? 'Podés ajustar el día, horario, monto y el estado crónico.'
                    : 'Esta selección permite cambiar únicamente el estado crónico.'}
                </DialogDescription>
              )}
            </DialogHeader>
            
            {!massEditError && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Prestación crónica</Label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={massEditCronico}
                      onCheckedChange={(checked) => {
                        setMassEditCronico(Boolean(checked));
                        setMassEditCronicoMixed(false);
                      }}
                      disabled={massEditSaving}
                    />
                    {massEditCronicoMixed && (
                      <span className="text-xs text-muted-foreground">
                        La selección tenía valores distintos. Elegí el valor final.
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Si desactivás este switch, estas prestaciones no se generarán automáticamente el próximo mes.
                  </p>
                </div>

                {canEditSchedule && referenceRow && (
                  <>
                    <div>
                      <Label>Nuevo día de la semana</Label>
                      <Select
                        value={massEditDay ?? new Date(referenceRow.fecha).getDay().toString()}
                        onValueChange={(day) => setMassEditDay(day)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar día" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Domingo</SelectItem>
                          <SelectItem value="1">Lunes</SelectItem>
                          <SelectItem value="2">Martes</SelectItem>
                          <SelectItem value="3">Miércoles</SelectItem>
                          <SelectItem value="4">Jueves</SelectItem>
                          <SelectItem value="5">Viernes</SelectItem>
                          <SelectItem value="6">Sábado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={massEditMonto}
                        onChange={(e) => setMassEditMonto(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Hora</Label>
                      <Input
                        type="time"
                        value={massEditTime}
                        onChange={(e) => setMassEditTime(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {massEditSaveError && (
                  <div className="text-red-600 text-sm">{massEditSaveError}</div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setMassEditOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => {
                    // Lógica para guardar
                    handleMassEditSave();
                  }}>
                    {massEditSaving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

          <Dialog open={massCancelOpen} onOpenChange={setMassCancelOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                className="ml-2"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar {selectedCount} seleccionadas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar {selectedCount} prestaciones</DialogTitle>
                <DialogDescription>
                  Esta acción cambiará el estado de todas las prestaciones seleccionadas a <b>cancelada</b>. ¿Deseás continuar?
                </DialogDescription>
              </DialogHeader>

              {massCancelError && (
                <div className="text-red-600 text-sm">{massCancelError}</div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setMassCancelOpen(false)}>
                  Volver
                </Button>
                <Button
                  variant="destructive"
                  disabled={massCancelSaving}
                  onClick={handleMassCancelSave}
                >
                  {massCancelSaving ? 'Cancelando...' : 'Confirmar cancelación'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

// export type { PrestacionRow };
// export { PrestacionesTable };