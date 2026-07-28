"use client";

import { useState, useTransition, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Pencil, MoreHorizontalIcon, XCircle, ChevronDown, Loader2, Repeat, Users, CheckCircle2, Trash2, CalendarClock, MapPin } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canCreateOrEditPrestacion } from "@/utils/permissions";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  cancelPrestacion,
  completePrestacion,
  deletePrestacion,
  completePrestacionesBulk,
  deletePrestacionesBulk,
  getPrestacionesPendientesDePaciente,
  listPrestadoresByEspecialidad,
  reasignarPrestacionesDePaciente,
  reasignarPrestacionesSeleccionadas,
  updatePrestacionesHorarioResidencia,
  type PacientePendienteResumen,
} from "@/app/protected/prestaciones/actions";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input as SearchInput } from "@/components/ui/input";

interface ServerPaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

type PrestacionesFilters = {
  fechaDesde: string;
  fechaHasta: string;
  pacienteIds: string[];
  prestadorIds: string[];
  estados: string[];
};

type CheckedState = boolean | 'indeterminate';

const ESTADO_OPTIONS = ["pendiente", "completada", "cancelada"] as const;

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const formatDateLabel = (date: Date) => dateFormatter.format(date);
const formatTimeLabel = (date: Date) => `${timeFormatter.format(date)} hs`;

export type PrestacionRow = {
  id: string;
  tipo_prestacion: string;
  fecha: string;
  estado: string | null;
  monto: number | null;
  cronico?: boolean | null;
  sentido_transporte?: string | null;
  user_id?: string | null;
  completed_at?: string | null;
  started_at?: string | null;
  centros_asignados?: { id: string; nombre: string }[];
  centro_id?: string | null;
  ubicacion_cierre?: any | null;
  distancia_validacion?: number | null;
  prestador?: {
    id: string;
    nombre: string;
    apellido: string;
    documento?: string;
  } | null;
  completador?: {
    id: string;
    nombre: string;
    apellido: string;
    documento?: string;
  } | null;
  notas?: string | null;
  paciente?: {
    id: string;
    nombre: string;
    apellido: string;
    documento: string;
  } | null;
};

type PrestacionesTableProps = {
  data: PrestacionRow[];
  filters?: PrestacionesFilters;
  pagination?: ServerPaginationInfo;
  allPrestadores?: { id: string; nombre: string; apellido: string; documento?: string }[];
  allPacientes?: { id: string; nombre: string; apellido: string; documento: string }[];
};

type PrestadorOption = {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  documento?: string | null;
};

const normalizeStringArray = (values: string[] = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

function parseWKBPoint(wkbHex: string): { lat: number; lng: number } | null {
  try {
    const coordsHex = wkbHex.substring(18);
    const lngHex = coordsHex.substring(0, 16);
    const latHex = coordsHex.substring(16, 32);
    const lngBuffer = new ArrayBuffer(8);
    const lngView = new DataView(lngBuffer);
    for (let i = 0; i < 8; i++) {
      lngView.setUint8(i, parseInt(lngHex.substr(i * 2, 2), 16));
    }
    const lng = lngView.getFloat64(0, true);
    const latBuffer = new ArrayBuffer(8);
    const latView = new DataView(latBuffer);
    for (let i = 0; i < 8; i++) {
      latView.setUint8(i, parseInt(latHex.substr(i * 2, 2), 16));
    }
    const lat = latView.getFloat64(0, true);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function parseUbicacion(ubicacion: any): { lat: number; lng: number } | null {
  if (!ubicacion) return null;
  if (typeof ubicacion === 'string') {
    if (/^[0-9A-F]+$/i.test(ubicacion)) {
      return parseWKBPoint(ubicacion);
    }
    const match = ubicacion.match(/POINT\(([^)]+)\)/);
    if (match && match[1]) {
      const [lng, lat] = match[1].split(' ').map(Number);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
  }
  if (typeof ubicacion === 'object' && ubicacion !== null) {
    if (Array.isArray(ubicacion.coordinates)) {
      const [lng, lat] = ubicacion.coordinates;
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    }
    if (typeof ubicacion.lat === 'number' && typeof ubicacion.lng === 'number') {
      return { lat: ubicacion.lat, lng: ubicacion.lng };
    }
    if (typeof ubicacion.latitude === 'number' && typeof ubicacion.longitude === 'number') {
      return { lat: ubicacion.latitude, lng: ubicacion.longitude };
    }
  }
  return null;
}

function esCerradaAnticipadamente(prestacion: PrestacionRow) {
  if (prestacion.estado?.toLowerCase() !== "completada") return false;
  if (!prestacion.started_at || !prestacion.completed_at) return false;
  const inicio = new Date(prestacion.started_at).getTime();
  const fin = new Date(prestacion.completed_at).getTime();
  if (isNaN(inicio) || isNaN(fin) || fin < inicio) return false;
  const duracionMin = Math.floor((fin - inicio) / (1000 * 60));
  const tipo = prestacion.tipo_prestacion.toLowerCase();
  if (tipo.includes("kine")) return duracionMin < 30;
  if (tipo.includes("acompañante") || tipo.includes("acomp")) return duracionMin < 40;
  return false;
}

function RowActionsCell({ prestacion, canWrite, loading }: {
  prestacion: PrestacionRow;
  canWrite: boolean;
  loading: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [openDialog, setOpenDialog] = useState<'completar' | 'cancelar' | 'eliminar' | null>(null);
  const [openLocation, setOpenLocation] = useState(false);
  const coords = useMemo(() => parseUbicacion(prestacion.ubicacion_cierre), [prestacion.ubicacion_cierre]);
  const estado = (prestacion.estado || '').toLowerCase();

  if (!canWrite || loading) {
    return (
      <Button size="icon" variant="outline" disabled title="No tenés permiso para editar prestaciones">
        <Pencil className="h-4 w-4" />
      </Button>
    );
  }

  const esPendiente = estado === 'pendiente';
  const esCancelada = estado === 'cancelada';
  const esCompletada = estado === 'completada';

  if (!esPendiente && !esCancelada && !esCompletada) return null;

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return `${dateFormatter.format(d)} ${timeFormatter.format(d)} hs`;
  };

  const duracionMin = (() => {
    if (!prestacion.started_at || !prestacion.completed_at) return null;
    const inicio = new Date(prestacion.started_at).getTime();
    const fin = new Date(prestacion.completed_at).getTime();
    if (isNaN(inicio) || isNaN(fin) || fin < inicio) return null;
    return Math.floor((fin - inicio) / (1000 * 60));
  })();

  const duracion = duracionMin == null ? null : (() => {
    if (duracionMin < 60) return `${duracionMin} min`;
    const horas = Math.floor(duracionMin / 60);
    const minutos = duracionMin % 60;
    return `${horas}h ${minutos}min`;
  })();

  const pinColorClass = (() => {
    if (!coords) return 'text-gray-400';
    if (duracionMin == null) return 'text-blue-600';
    const tipo = prestacion.tipo_prestacion.toLowerCase();
    const umbral = tipo.includes('kine') ? 30 : tipo.includes('acompañante') ? 40 : null;
    if (umbral == null) return 'text-blue-600';
    return duracionMin < umbral ? 'text-yellow-500' : 'text-blue-600';
  })();

  return (
    <>
      {esCompletada ? (
        <Button size="icon" variant="outline" onClick={() => setOpenLocation(true)} title={coords ? "Ver ubicación de cierre" : "Sin ubicación registrada"}>
          <MapPin className={`h-4 w-4 ${pinColorClass}`} />
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline">
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {esPendiente && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Acciones</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/protected/prestaciones/editar/${prestacion.id}`} className="flex items-center cursor-pointer">
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-green-700 focus:text-green-700" onSelect={() => setOpenDialog('completar')}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Completar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Zona de riesgo</DropdownMenuLabel>
              <DropdownMenuItem className="text-orange-600 focus:text-orange-600" onSelect={() => setOpenDialog('cancelar')}>
                <XCircle className="mr-2 h-4 w-4" /> Cancelar prestación
              </DropdownMenuItem>
            </>
          )}
          {coords && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Ubicación</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setOpenLocation(true)}>
                <MapPin className="mr-2 h-4 w-4" /> Ver ubicación
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem className="text-red-600 focus:text-red-600 font-medium" onSelect={() => setOpenDialog('eliminar')}>
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar permanentemente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      <Dialog open={openDialog === 'completar'} onOpenChange={(o) => { if (!o) setOpenDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar prestación</DialogTitle>
            <DialogDescription>Esta acción marcará la prestación como <b>completada</b>. ¿Confirmás?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>Cancelar</Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700 text-white" disabled={isPending}
                onClick={() => startTransition(async () => {
                  const { error } = await completePrestacion(prestacion.id);
                  if (error) toast({ title: "Error", description: (error as any).message || "Intentalo nuevamente", variant: "destructive" });
                  else { toast({ title: "Prestación completada" }); setOpenDialog(null); router.refresh(); }
                })}>
                {isPending ? "Guardando..." : "Confirmar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === 'cancelar'} onOpenChange={(o) => { if (!o) setOpenDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar prestación</DialogTitle>
            <DialogDescription>Esta acción cambiará el estado a <b>cancelada</b>. ¿Deseás continuar?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>Volver</Button>
              <Button type="button" variant="destructive" disabled={isPending}
                onClick={() => startTransition(async () => {
                  const { error } = await cancelPrestacion(prestacion.id);
                  if (error) toast({ title: "No se pudo cancelar", description: (error as any).message || "Intentalo nuevamente", variant: "destructive" });
                  else { toast({ title: "Prestación cancelada" }); setOpenDialog(null); router.refresh(); }
                })}>
                {isPending ? "Cancelando..." : "Confirmar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === 'eliminar'} onOpenChange={(o) => { if (!o) setOpenDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar prestación</DialogTitle>
            <DialogDescription>Esta acción <b>eliminará permanentemente</b> la prestación. ¿Deseás continuar?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>Cancelar</Button>
              <Button type="button" variant="destructive" disabled={isPending}
                onClick={() => startTransition(async () => {
                  const { error } = await deletePrestacion(prestacion.id);
                  if (error) toast({ title: "No se pudo eliminar", description: (error as any).message || "Intentalo nuevamente", variant: "destructive" });
                  else { toast({ title: "Prestación eliminada" }); setOpenDialog(null); router.refresh(); }
                })}>
                {isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openLocation} onOpenChange={setOpenLocation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle de validación</DialogTitle>
            <DialogDescription>
              {prestacion.paciente
                ? `${prestacion.paciente.apellido}, ${prestacion.paciente.nombre}`
                : 'Paciente no asignado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">AT:</span>
              <span>
                {prestacion.prestador
                  ? `${prestacion.prestador.apellido ?? ''} ${prestacion.prestador.nombre ?? ''}`.trim() || prestacion.prestador.id
                  : '-'}
              </span>
            </div>
            {prestacion.completador && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completado por:</span>
                <span>
                  {`${prestacion.completador.apellido ?? ''} ${prestacion.completador.nombre ?? ''}`.trim() || prestacion.completador.id}
                  {prestacion.completador.id !== prestacion.user_id && (
                    <span className="ml-2 text-xs text-orange-600">(backoffice)</span>
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo:</span>
              <span className="capitalize">{prestacion.tipo_prestacion}</span>
            </div>
            {prestacion.notas && (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Notas:</span>
                <span className="whitespace-pre-wrap text-right">{prestacion.notas}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inicio:</span>
              <span>{formatDateTime(prestacion.started_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cierre:</span>
              <span>{formatDateTime(prestacion.completed_at)}</span>
            </div>
            {prestacion.started_at && prestacion.completed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duración:</span>
                <span>{duracion ?? 'No registrada'}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distancia:</span>
              <span>{prestacion.distancia_validacion != null ? `${prestacion.distancia_validacion} m` : '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ubicación:</span>
              <div className="mt-1">
                {coords ? (
                  <span className="block leading-relaxed">
                    <span>Lat: {coords.lat}, Lng: {coords.lng}</span><br />
                    <a href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      Ver en Google Maps
                    </a>
                  </span>
                ) : 'No hay ubicación registrada.'}
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpenLocation(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const PrestacionesTable = ({ data, filters, pagination, allPrestadores = [], allPacientes = [] }: PrestacionesTableProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { roles, loading } = useBackofficeRoles();
  const canWritePrestaciones = canCreateOrEditPrestacion(roles);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isPaginationPending, startPaginationTransition] = useTransition();
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize || 1)) : 1;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [fechaDesde, setFechaDesde] = useState<string>(filters?.fechaDesde ?? "");
  const [fechaHasta, setFechaHasta] = useState<string>(filters?.fechaHasta ?? "");
  const [pacienteSelected, setPacienteSelected] = useState<string[]>(normalizeStringArray(filters?.pacienteIds));
  const [pacienteSearch, setPacienteSearch] = useState("");

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
  const [massCompleteOpen, setMassCompleteOpen] = useState(false);
  const [massCompleteSaving, setMassCompleteSaving] = useState(false);
  const [massCompleteError, setMassCompleteError] = useState<string | null>(null);
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);
  const [massDeleteSaving, setMassDeleteSaving] = useState(false);
  const [massDeleteError, setMassDeleteError] = useState<string | null>(null);

  const [residenceScheduleOpen, setResidenceScheduleOpen] = useState(false);
  const [residenceScheduleDate, setResidenceScheduleDate] = useState("");
  const [residenceScheduleTime, setResidenceScheduleTime] = useState("");
  const [residenceScheduleSaving, setResidenceScheduleSaving] = useState(false);
  const [residenceScheduleError, setResidenceScheduleError] = useState<string | null>(null);

  // Reasignación por selección
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignPrestadores, setReassignPrestadores] = useState<PrestadorOption[]>([]);
  const [reassignPrestadorId, setReassignPrestadorId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignPrestadorSearch, setReassignPrestadorSearch] = useState('');

  // Reasignación por paciente
  const [byPatientOpen, setByPatientOpen] = useState(false);
  const [byPatientPacienteId, setByPatientPacienteId] = useState('');
  const [byPatientPacienteSearch, setByPatientPacienteSearch] = useState('');
  const [byPatientPrestadorId, setByPatientPrestadorId] = useState('');
  const [byPatientPrestadores, setByPatientPrestadores] = useState<PrestadorOption[]>([]);
  const [byPatientPrestadorSearch, setByPatientPrestadorSearch] = useState('');
  const [byPatientPrestacionesCount, setByPatientPrestacionesCount] = useState<number | null>(null);
  const [byPatientLoadingPrestaciones, setByPatientLoadingPrestaciones] = useState(false);
  const [byPatientLoadingPrestadores, setByPatientLoadingPrestadores] = useState(false);
  const [byPatientSaving, setByPatientSaving] = useState(false);
  const [byPatientError, setByPatientError] = useState<string | null>(null);

  const [tipoFilterSearch, setTipoFilterSearch] = useState('');
  const [pacienteFilterSearch, setPacienteFilterSearch] = useState('');
  const [prestadorFilterSearch, setPrestadorFilterSearch] = useState('');
  const [prestadorSelected, setPrestadorSelected] = useState<string[]>(normalizeStringArray(filters?.prestadorIds));
  const [estadoFilterSearch, setEstadoFilterSearch] = useState('');
  const [estadoSelected, setEstadoSelected] = useState<string[]>(normalizeStringArray(filters?.estados));
  const [diaFilterSearch, setDiaFilterSearch] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const isServerPaginated = Boolean(pagination) && !soloAlertas;

  const enhancedData = useMemo(() => {
    const weekdayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long" });
    return data.map((item) => {
      const fechaDate = new Date(item.fecha);
      const weekday = weekdayFormatter.format(fechaDate);
      const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return {
        ...item,
        dia_semana: capitalizedWeekday,
      };
    });
  }, [data]);

  const displayData = useMemo(() => {
    if (!soloAlertas) return enhancedData;
    return enhancedData.filter(esCerradaAnticipadamente);
  }, [enhancedData, soloAlertas]);

  const tipoOptions = useMemo(() => {
    const set = new Set<string>();
    enhancedData.forEach(item => {
      if (item.tipo_prestacion) set.add(item.tipo_prestacion);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enhancedData]);

  const estadoOptionsFiltradas = useMemo(() => {
    const q = estadoFilterSearch.trim().toLowerCase();
    if (!q) return ESTADO_OPTIONS;
    return ESTADO_OPTIONS.filter((estado) => estado.toLowerCase().includes(q));
  }, [estadoFilterSearch]);

  const pacientesOptions = useMemo(() => {
    if (allPacientes.length > 0) {
      return allPacientes
        .map(p => ({ id: p.id, label: `${p.apellido}, ${p.nombre}` }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
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
  }, [allPacientes, enhancedData]);

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
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ row }) => {
        const d = new Date(row.getValue("fecha"));
        return (
          <div className="flex flex-col leading-tight">
            <span>{formatDateLabel(d)}</span>
            <span className="text-xs text-muted-foreground">{formatTimeLabel(d)}</span>
          </div>
        );
      },
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
        options: ["pendiente", "completada", "cancelada"],
      },
      filterFn: (row, columnId, filterValue) => {
        const values = (filterValue as string[]) || [];
        if (!Array.isArray(values) || values.length === 0) return true;
        const estado = (row.getValue(columnId) as string | null) ?? "";
        return values.map((v) => v.toLowerCase()).includes(estado.toLowerCase());
      },
    },
    {
      accessorKey: "completed_at",
      header: "Validación",
      meta: { label: "Fecha de validación" },
      cell: ({ row }) => {
        const value = row.getValue("completed_at") as string | null;
        if (!value) {
          return <span className="text-muted-foreground">-</span>;
        }
        const date = new Date(value);
        return (
          <div className="flex flex-col leading-tight">
            <span>{formatTimeLabel(date)}</span>
            <span className="text-xs text-muted-foreground">{formatDateLabel(date)}</span>
          </div>
        );
      },
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
      accessorKey: "centros_asignados",
      header: "Centro asignado",
      cell: ({ row }) => {
        const centros = (row.getValue("centros_asignados") as { id: string; nombre: string }[]) || [];
        if (!centros.length) {
          return (
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
              Sin asignar
            </Badge>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            {centros.map((centro) => (
              <Badge key={centro.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {centro.nombre}
              </Badge>
            ))}
          </div>
        );
      },
      enableSorting: false,
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
      cell: ({ row }) => (
        <RowActionsCell
          prestacion={row.original}
          canWrite={canWritePrestaciones}
          loading={loading}
        />
      ),
    },
  ];

  const formatLocalTimestamp = (date: Date) => {
    return date.toISOString();
  };

  const table = useReactTable({
    data: displayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: (row) => {
      const estado = (row.original.estado || '').toLowerCase();
      return estado === 'pendiente' || estado === 'cancelada' || estado === 'completada';
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: isServerPaginated,
    pageCount: isServerPaginated ? totalPages : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: isServerPaginated ? (pagination?.pageSize || 25) : 25,
      },
    },
  });

  useEffect(() => {
    if (!isServerPaginated) return;
    table.setPageIndex(Math.max(0, (pagination?.page ?? 1) - 1));
    table.setPageSize(pagination?.pageSize || 25);
  }, [isServerPaginated, pagination?.page, pagination?.pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateQueryParams = (next: { page?: number; pageSize?: number }) => {
    const current = new URLSearchParams(searchParams?.toString() ?? "");
    if (next.page !== undefined) current.set("page", String(next.page));
    if (next.pageSize !== undefined) current.set("pageSize", String(next.pageSize));
    try {
      const saved = localStorage.getItem("prestaciones_filters");
      const parsed = saved ? JSON.parse(saved) : {};
      localStorage.setItem("prestaciones_filters", JSON.stringify({
        ...parsed,
        page: next.page ?? parsed.page ?? 1,
        pageSize: next.pageSize ?? parsed.pageSize ?? 25,
      }));
    } catch {}
    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    startPaginationTransition(() => { router.refresh(); });
  };

  const goToPage = (target: number) => {
    if (!pagination) return;
    const safe = Math.min(Math.max(1, target), totalPages);
    if (safe === pagination.page) return;
    updateQueryParams({ page: safe, pageSize: pagination.pageSize });
  };

  const handlePageSizeChange = (size: number) => {
    if (!pagination || size === pagination.pageSize) return;
    updateQueryParams({ page: 1, pageSize: size });
  };

  const firstItem = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastItem = pagination ? Math.min(pagination.total, pagination.page * pagination.pageSize) : 0;

  const selectedCount = Object.keys(rowSelection).length;
  const selectedRows = table.getRowModel().rows
    .filter(row => row.getIsSelected())
    .map(row => row.original);
  const referenceRow = selectedRows[0];

  const allSamePrestador = selectedRows.every(r => r.prestador?.id === referenceRow?.prestador?.id);
  const allSamePaciente = selectedRows.every(r => r.paciente?.id === referenceRow?.paciente?.id);
  const allSameTipo = selectedRows.every(r => r.tipo_prestacion === referenceRow?.tipo_prestacion);
  const allSameCronico = selectedRows.every(r => Boolean(r.cronico) === Boolean(referenceRow?.cronico));
  const allPendiente = selectedRows.every(r => (r.estado || '').toLowerCase() === 'pendiente');
  const hasCompleted = selectedRows.some(r => (r.estado || '').toLowerCase() === 'completada');
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
  const toDateInputValue = (fecha?: string) => {
    if (!fecha) return "";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return "";
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  };
  const buildIsoFromDateTime = (dateValue: string, timeValue: string) => {
    if (!dateValue) return null;
    const safeTime = timeValue && timeValue.includes(":") ? timeValue : `${timeValue || "00:00"}`;
    const nextDate = new Date(`${dateValue}T${safeTime}`);
    if (Number.isNaN(nextDate.getTime())) return null;
    return nextDate.toISOString();
  };
  const getRowCentroIds = (row?: PrestacionRow) => {
    if (!row) return [] as string[];
    const ids = new Set<string>();
    if (row.centro_id) ids.add(row.centro_id);
    (row.centros_asignados || []).forEach((centro) => {
      if (centro.id) ids.add(centro.id);
    });
    return Array.from(ids);
  };
  const sharedCentroId = (() => {
    const baseRows = selectedRows.length
      ? selectedRows
      : referenceRow
        ? [referenceRow]
        : [];
    const centroSets = baseRows
      .map((row) => getRowCentroIds(row))
      .filter((ids) => ids.length > 0);

    if (!centroSets.length) {
      return null;
    }

    let intersection = new Set(centroSets[0]);
    for (let i = 1; i < centroSets.length; i++) {
      const current = new Set(centroSets[i]);
      const next = new Set<string>();
      intersection.forEach((id) => {
        if (current.has(id)) next.add(id);
      });
      intersection = next;
      if (intersection.size === 0) return null;
    }

    const [first] = Array.from(intersection);
    return first ?? null;
  })();
  const referenceDay = toDay(referenceRow?.fecha);
  const referenceTime = toTime(referenceRow?.fecha);
  const allSameDay = selectedRows.every(r => toDay(r.fecha) === referenceDay);
  const allSameTime = selectedRows.every(r => toTime(r.fecha) === referenceTime);
  const referenceTimestamp = referenceRow ? new Date(referenceRow.fecha).getTime() : null;
  const allSameExactMoment = referenceTimestamp != null && selectedRows.every((row) => {
    const value = new Date(row.fecha).getTime();
    return !Number.isNaN(value) && value === referenceTimestamp;
  });
  const allSameCentro = Boolean(sharedCentroId);

  const canEditSchedule =
    selectedRows.length > 0 &&
    allPendiente &&
    allSamePrestador &&
    allSamePaciente &&
    allSameTipo &&
    allSameDay &&
    allSameTime &&
    allSameCronico;

  const canEditResidenceSchedule =
    selectedRows.length > 0 &&
    allPendiente &&
    allSamePrestador &&
    allSameTipo &&
    allSameCentro &&
    allSameExactMoment &&
    Boolean(referenceRow?.user_id);

  const residenceName = sharedCentroId
    ? (
        referenceRow?.centros_asignados?.find((centro) => centro.id === sharedCentroId)?.nombre
        ?? selectedRows
          .map((row) => row.centros_asignados?.find((centro) => centro.id === sharedCentroId)?.nombre)
          .find(Boolean)
        ?? null
      )
    : null;

  const centroDiagnostics = useMemo(() => {
    if (!selectedRows.length) {
      return { uniqueCentroIds: [] as string[], uniqueCentroLabels: [] as string[], missingCount: 0 };
    }
    const ids = new Set<string>();
    const labels = new Set<string>();
    selectedRows.forEach((row) => {
      const rowIds = getRowCentroIds(row);
      if (rowIds.length === 0 && row.centros_asignados) {
        row.centros_asignados.forEach((centro) => {
          if (centro?.nombre) labels.add(centro.nombre);
        });
      }
      rowIds.forEach((id) => {
        ids.add(id);
        const matchingName = row.centros_asignados?.find((centro) => centro.id === id)?.nombre;
        if (matchingName) labels.add(matchingName);
        else labels.add(id);
      });
    });
    const missingCount = selectedRows.filter((row) => getRowCentroIds(row).length === 0).length;
    return {
      uniqueCentroIds: Array.from(ids),
      uniqueCentroLabels: Array.from(labels),
      missingCount,
    };
  }, [selectedRows]);

  const residenceSelectionHint = useMemo(() => {
    if (!selectedRows.length) return null;
    if (!allPendiente) {
      return "Solo se puede cambiar el horario de prestaciones pendientes.";
    }
    if (!allSamePrestador) {
      return "Seleccioná prestaciones del mismo prestador.";
    }
    if (!allSameTipo) {
      return "Todas las prestaciones deben ser del mismo tipo.";
    }
    if (!allSameExactMoment) {
      return "Las prestaciones necesitan compartir la misma fecha y hora exactas.";
    }
    if (!sharedCentroId) {
      if (centroDiagnostics.missingCount > 0 && centroDiagnostics.uniqueCentroIds.length === 0) {
        return `${centroDiagnostics.missingCount} prestaciones no tienen residencia asignada. Revisá la ficha del paciente.`;
      }
      if (centroDiagnostics.uniqueCentroIds.length > 1) {
        const sample = centroDiagnostics.uniqueCentroLabels.slice(0, 3).join(", ");
        const suffix = centroDiagnostics.uniqueCentroLabels.length > 3 ? ", …" : "";
        return `Hay ${centroDiagnostics.uniqueCentroIds.length} residencias distintas en la selección (${sample}${suffix}).`;
      }
      return "No pudimos detectar una residencia compartida. Verificá que cada paciente tenga un centro asignado.";
    }
    if (!referenceRow?.user_id) {
      return "Las prestaciones deben tener un AT asignado.";
    }
    return null;
  }, [
    selectedRows,
    allPendiente,
    allSamePrestador,
    allSameTipo,
    allSameExactMoment,
    sharedCentroId,
    centroDiagnostics,
    referenceRow?.user_id,
  ]);

  const canEditCronicoOnly =
    selectedRows.length > 0 &&
    allSamePrestador &&
    !canEditSchedule;

  const isValidSelection = canEditSchedule || canEditCronicoOnly;
  const validateSelection = () => {
    if (selectedCount === 0) return false;

    if (!isValidSelection) {
      if (!allSamePrestador) {
        setMassEditError('Seleccioná prestaciones del mismo prestador.');
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

  const handleOpenResidenceSchedule = () => {
    if (!referenceRow || !canEditResidenceSchedule) {
      return;
    }
    setResidenceScheduleDate(toDateInputValue(referenceRow.fecha));
    setResidenceScheduleTime(referenceTime ?? "");
    setResidenceScheduleError(null);
    setResidenceScheduleOpen(true);
  };

  const handleResidenceScheduleSave = () => {
    if (!referenceRow?.user_id || !sharedCentroId) {
      setResidenceScheduleError("Seleccioná prestaciones con la misma residencia.");
      return;
    }

    const targetIso = buildIsoFromDateTime(residenceScheduleDate, residenceScheduleTime || referenceTime || "");
    if (!targetIso) {
      setResidenceScheduleError("Ingresá una fecha y hora válidas.");
      return;
    }

    setResidenceScheduleSaving(true);
    setResidenceScheduleError(null);
    startTransition(async () => {
      try {
        const { data, error } = await updatePrestacionesHorarioResidencia({
          centroId: sharedCentroId!,
          userId: referenceRow.user_id!,
          tipoPrestacion: referenceRow.tipo_prestacion,
          fromFecha: referenceRow.fecha,
          toFecha: targetIso,
        });

        if (error) {
          setResidenceScheduleError((error as any).message ?? "No se pudo actualizar el horario.");
          return;
        }

        toast({
          title: "Horario actualizado",
          description: data?.updated
            ? `${data.updated} prestaciones se movieron al nuevo horario.`
            : "Se actualizó el horario compartido.",
        });
        setResidenceScheduleOpen(false);
        setRowSelection({});
        router.refresh();
      } catch (e) {
        setResidenceScheduleError("No se pudo actualizar el horario.");
      } finally {
        setResidenceScheduleSaving(false);
      }
    });
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

  const handleMassCompleteSave = () => {
    if (!selectedRows.length) return;
    setMassCompleteSaving(true);
    setMassCompleteError(null);
    startTransition(async () => {
      try {
        const ids = selectedRows.map(r => r.id);
        const result = await completePrestacionesBulk(ids);
        toast({ title: `${result.completed} prestaciones completadas`, description: result.failed > 0 ? `${result.failed} no se pudieron completar.` : undefined });
        setMassCompleteOpen(false);
        setRowSelection({});
        router.refresh();
      } catch {
        setMassCompleteError('No se pudieron completar todas las prestaciones. Intentalo nuevamente.');
      } finally {
        setMassCompleteSaving(false);
      }
    });
  };

  const handleMassDeleteSave = () => {
    if (!selectedRows.length) return;
    setMassDeleteSaving(true);
    setMassDeleteError(null);
    startTransition(async () => {
      try {
        const ids = selectedRows.map(r => r.id);
        const result = await deletePrestacionesBulk(ids);
        toast({ title: `${result.deleted} prestaciones eliminadas`, description: result.skipped > 0 ? `${result.skipped} omitidas (completadas).` : undefined });
        setMassDeleteOpen(false);
        setRowSelection({});
        router.refresh();
      } catch {
        setMassDeleteError('No se pudieron eliminar todas las prestaciones. Intentalo nuevamente.');
      } finally {
        setMassDeleteSaving(false);
      }
    });
  };

  const handleOpenReassign = async () => {
    if (!selectedRows.length) return;
    const tipo = selectedRows[0]?.tipo_prestacion;
    setReassignError(null);
    setReassignPrestadorId('');
    setReassignPrestadorSearch('');
    setReassignLoading(true);
    setReassignOpen(true);
    try {
      const { data } = await listPrestadoresByEspecialidad(tipo);
      setReassignPrestadores(data || []);
    } catch {
      setReassignError('No se pudieron cargar los prestadores.');
    } finally {
      setReassignLoading(false);
    }
  };

  const handleReassignSave = () => {
    if (!reassignPrestadorId) {
      setReassignError('Seleccioná un prestador destino.');
      return;
    }
    setReassignSaving(true);
    setReassignError(null);
    startTransition(async () => {
      try {
        const ids = selectedRows.map(r => r.id);
        const { data, error } = await reasignarPrestacionesSeleccionadas(ids, reassignPrestadorId);
        if (error) {
          setReassignError((error as any).message ?? 'Error al reasignar');
          return;
        }
        const { successIds, errors } = data!;
        if (errors.length > 0) {
          toast({
            title: `${successIds.length} reasignadas, ${errors.length} con conflicto`,
            description: errors.map(e => e.message).join(' · '),
            variant: 'destructive',
          });
        } else {
          toast({ title: `${successIds.length} prestaciones reasignadas correctamente` });
        }
        setReassignOpen(false);
        setRowSelection({});
        router.refresh();
      } catch {
        setReassignError('Error inesperado al reasignar.');
      } finally {
        setReassignSaving(false);
      }
    });
  };

  const handleByPatientPacienteChange = async (pacienteId: string) => {
    setByPatientPacienteId(pacienteId);
    setByPatientPrestadores([]);
    setByPatientPrestadorId('');
    setByPatientPrestacionesCount(null);
    setByPatientError(null);
    if (!pacienteId) return;
    setByPatientLoadingPrestaciones(true);
    try {
      const { data } = await getPrestacionesPendientesDePaciente(pacienteId);
      setByPatientPrestacionesCount((data || []).length);
      const tipos = Array.from(new Set((data || []).map(p => p.tipo_prestacion)));
      if (tipos.length > 0) {
        setByPatientLoadingPrestadores(true);
        const { data: prests } = await listPrestadoresByEspecialidad(tipos[0]);
        setByPatientPrestadores(prests || []);
        setByPatientLoadingPrestadores(false);
      }
    } catch {
      setByPatientError('No se pudieron cargar las prestaciones del paciente.');
    } finally {
      setByPatientLoadingPrestaciones(false);
    }
  };

  const handleByPatientSave = () => {
    if (!byPatientPacienteId || !byPatientPrestadorId) {
      setByPatientError('Seleccioná un paciente y un prestador destino.');
      return;
    }
    setByPatientSaving(true);
    setByPatientError(null);
    startTransition(async () => {
      try {
        const { data, error } = await reasignarPrestacionesDePaciente(byPatientPacienteId, byPatientPrestadorId);
        if (error) {
          setByPatientError((error as any).message ?? 'Error al reasignar');
          return;
        }
        const { successIds, errors } = data!;
        if (errors.length > 0) {
          toast({
            title: `${successIds.length} reasignadas, ${errors.length} con conflicto`,
            description: errors.map(e => e.message).join(' · '),
            variant: 'destructive',
          });
        } else {
          toast({ title: `${successIds.length} prestaciones reasignadas correctamente` });
        }
        setByPatientOpen(false);
        setByPatientPacienteId('');
        setByPatientPrestadorId('');
        setByPatientPrestacionesCount(null);
        router.refresh();
      } catch {
        setByPatientError('Error inesperado al reasignar.');
      } finally {
        setByPatientSaving(false);
      }
    });
  };

  const applyFiltersToQueryParams = useCallback(
    (next: { fechaDesde?: string; fechaHasta?: string; pacienteIds?: string[]; prestadorIds?: string[]; estados?: string[] }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const setArrayParam = (key: string, values: string[] = []) => {
        params.delete(key);
        values.forEach((value) => params.append(key, value));
      };
      const setOptional = (key: string, value?: string) => {
        if (value?.trim()) params.set(key, value.trim());
        else params.delete(key);
      };

      setOptional("fechaDesde", next.fechaDesde ?? "");
      setOptional("fechaHasta", next.fechaHasta ?? "");
      setArrayParam("pacienteIds", normalizeStringArray(next.pacienteIds));
      setArrayParam("prestadorIds", normalizeStringArray(next.prestadorIds));
      setArrayParam("estados", normalizeStringArray(next.estados));
      params.set("page", "1");

      try {
        localStorage.setItem(
          "prestaciones_filters",
          JSON.stringify({
            fechaDesde: next.fechaDesde ?? "",
            fechaHasta: next.fechaHasta ?? "",
            pacienteIds: normalizeStringArray(next.pacienteIds),
            prestadorIds: normalizeStringArray(next.prestadorIds),
            estados: normalizeStringArray(next.estados),
            page: 1,
            pageSize: pagination?.pageSize ?? 25,
          })
        );
      } catch {}

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const hasFilterParams =
      searchParams?.has("fechaDesde") ||
      searchParams?.has("fechaHasta") ||
      searchParams?.has("pacienteIds") ||
      searchParams?.has("prestadorIds") ||
      searchParams?.has("estados") ||
      searchParams?.has("page") ||
      searchParams?.has("pageSize");
    if (hasFilterParams) return;
    try {
      const saved = localStorage.getItem("prestaciones_filters");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const hasAny = parsed.fechaDesde || parsed.fechaHasta || parsed.pacienteIds?.length ||
        parsed.prestadorIds?.length || parsed.estados?.length || parsed.page > 1 || (parsed.pageSize && parsed.pageSize !== 25);
      if (!hasAny) return;
      const p = new URLSearchParams();
      if (parsed.fechaDesde) p.set("fechaDesde", parsed.fechaDesde);
      if (parsed.fechaHasta) p.set("fechaHasta", parsed.fechaHasta);
      (parsed.pacienteIds || []).forEach((id: string) => p.append("pacienteIds", id));
      (parsed.prestadorIds || []).forEach((id: string) => p.append("prestadorIds", id));
      (parsed.estados || []).forEach((e: string) => p.append("estados", e));
      if (parsed.page && parsed.page > 1) p.set("page", String(parsed.page));
      if (parsed.pageSize && parsed.pageSize !== 25) p.set("pageSize", String(parsed.pageSize));
      router.replace(`${pathname}?${p.toString()}`);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFechaDesde(filters?.fechaDesde ?? "");
    setFechaHasta(filters?.fechaHasta ?? "");
    setPacienteSelected(normalizeStringArray(filters?.pacienteIds));
    setPrestadorSelected(normalizeStringArray(filters?.prestadorIds));
    setEstadoSelected(normalizeStringArray(filters?.estados));
  }, [filters?.fechaDesde, filters?.fechaHasta, filters?.pacienteIds, filters?.prestadorIds, filters?.estados]);

  const applyDateFilters = () => {
    if (
      (fechaDesde || "") === (filters?.fechaDesde || "") &&
      (fechaHasta || "") === (filters?.fechaHasta || "")
    ) {
      return;
    }
    applyFiltersToQueryParams({
      fechaDesde,
      fechaHasta,
      pacienteIds: pacienteSelected,
      prestadorIds: prestadorSelected,
      estados: estadoSelected,
    });
  };

  const clearDateFilters = () => {
    if (!(filters?.fechaDesde || filters?.fechaHasta)) return;
    setFechaDesde("");
    setFechaHasta("");
    applyFiltersToQueryParams({
      fechaDesde: "",
      fechaHasta: "",
      pacienteIds: pacienteSelected,
      prestadorIds: prestadorSelected,
      estados: estadoSelected,
    });
  };

  const applyPacienteFilters = () => {
    if (arraysEqual(normalizeStringArray(pacienteSelected), normalizeStringArray(filters?.pacienteIds))) return;
    applyFiltersToQueryParams({
      fechaDesde,
      fechaHasta,
      pacienteIds: pacienteSelected,
      prestadorIds: prestadorSelected,
      estados: estadoSelected,
    });
  };

  const clearPacienteFilters = () => {
    if (!filters?.pacienteIds?.length) return;
    setPacienteSelected([]);
    applyFiltersToQueryParams({
      fechaDesde,
      fechaHasta,
      pacienteIds: [],
      prestadorIds: prestadorSelected,
      estados: estadoSelected,
    });
  };

  const arraysEqual = (a: string[] = [], b: string[] = []) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

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
              .map((column) => {
                const headerValue = column.columnDef.header;
                const labelFromHeader = typeof headerValue === "string"
                  ? headerValue
                  : undefined;
                const metaLabel = (column.columnDef.meta as { label?: string } | undefined)?.label;
                const text = metaLabel || labelFromHeader || column.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="max-w-[200px] truncate"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    title={text}
                  >
                    {text}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          applyDateFilters();
        }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Fecha desde</span>
          <Input type="date" value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Fecha hasta</span>
          <Input type="date" value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="submit"
            disabled={
              (fechaDesde || "") === (filters?.fechaDesde || "") &&
              (fechaHasta || "") === (filters?.fechaHasta || "")
            }
          >
            Aplicar fechas
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={clearDateFilters}
            disabled={!(filters?.fechaDesde || filters?.fechaHasta)}
          >
            Limpiar
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[220px] justify-between">
              <span className="truncate text-left">
                {(() => {
                  if (pacienteSelected.length === 0) return "Beneficiarios...";
                  if (pacienteSelected.length === 1) {
                    const option = pacientesOptions.find((opt) => opt.id === pacienteSelected[0]);
                    return option?.label || "1 seleccionado";
                  }
                  return `${pacienteSelected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 p-2">
            <SearchInput
              placeholder="Buscar beneficiario"
              value={pacienteSearch}
              onChange={(e) => setPacienteSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {pacientesOptions
                .filter((opt) => opt.label.toLowerCase().includes(pacienteSearch.toLowerCase().trim()))
                .map((opt) => {
                  const isChecked = pacienteSelected.includes(opt.id);
                  return (
                    <label key={opt.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          setPacienteSelected((current) => {
                            const next = isChecked
                              ? current.filter((value) => value !== opt.id)
                              : [...current, opt.id];
                            return normalizeStringArray(next);
                          });
                        }}
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  );
                })}
              {pacientesOptions.filter((opt) => opt.label.toLowerCase().includes(pacienteSearch.toLowerCase().trim())).length ===
                0 && <p className="text-sm text-muted-foreground">Sin resultados</p>}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={clearPacienteFilters} disabled={!filters?.pacienteIds?.length}>
                Limpiar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={applyPacienteFilters}
                disabled={
                  arraysEqual(pacienteSelected, normalizeStringArray(filters?.pacienteIds)) || loading
                }
              >
                Aplicar
              </Button>
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
                  if (!prestadorSelected.length) return "Prestadores...";
                  if (prestadorSelected.length === 1) {
                    const p = allPrestadores.find(opt => opt.id === prestadorSelected[0]);
                    const label = p ? `${p.apellido} ${p.nombre}`.trim() : "1 seleccionado";
                    return label || "1 seleccionado";
                  }
                  return `${prestadorSelected.length} seleccionados`;
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
              {allPrestadores
                .map(p => ({ id: p.id, label: `${p.apellido ?? ''} ${p.nombre ?? ''}`.trim() || p.id }))
                .filter(opt => opt.label.toLowerCase().includes(prestadorFilterSearch.toLowerCase().trim()))
                .map((option) => {
                  const isChecked = prestadorSelected.includes(option.id);
                  return (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          setPrestadorSelected((current) => {
                            const next = isChecked
                              ? current.filter((id) => id !== option.id)
                              : [...current, option.id];
                            return normalizeStringArray(next);
                          });
                        }}
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  );
                })}
              {allPrestadores.filter(p =>
                `${p.apellido ?? ''} ${p.nombre ?? ''}`.trim().toLowerCase().includes(prestadorFilterSearch.toLowerCase().trim())
              ).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPrestadorSelected([]);
                  applyFiltersToQueryParams({
                    fechaDesde,
                    fechaHasta,
                    pacienteIds: pacienteSelected,
                    prestadorIds: [],
                    estados: estadoSelected,
                  });
                }}
                disabled={prestadorSelected.length === 0 && !filters?.prestadorIds?.length}
              >
                Limpiar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  applyFiltersToQueryParams({
                    fechaDesde,
                    fechaHasta,
                    pacienteIds: pacienteSelected,
                    prestadorIds: prestadorSelected,
                    estados: estadoSelected,
                  });
                }}
                disabled={arraysEqual(
                  normalizeStringArray(prestadorSelected),
                  normalizeStringArray(filters?.prestadorIds || [])
                )}
              >
                Aplicar
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-between">
              <span className="truncate text-left">
                {(() => {
                  if (!estadoSelected.length) return "Estado...";
                  if (estadoSelected.length === 1) {
                    return estadoSelected[0].charAt(0).toUpperCase() + estadoSelected[0].slice(1);
                  }
                  return `${estadoSelected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 p-2">
            <Input
              placeholder="Buscar estado"
              value={estadoFilterSearch}
              onChange={(e) => setEstadoFilterSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-[260px] overflow-y-auto space-y-2">
              {estadoOptionsFiltradas.map((estado) => {
                const isChecked = estadoSelected.includes(estado);
                return (
                  <label key={estado} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => {
                        setEstadoSelected((current) => {
                          const next = isChecked
                            ? current.filter((value) => value !== estado)
                            : [...current, estado];
                          return normalizeStringArray(next);
                        });
                      }}
                    />
                    <span className="capitalize">{estado}</span>
                  </label>
                );
              })}
              {estadoOptionsFiltradas.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEstadoSelected([]);
                  applyFiltersToQueryParams({
                    fechaDesde,
                    fechaHasta,
                    pacienteIds: pacienteSelected,
                    prestadorIds: prestadorSelected,
                    estados: [],
                  });
                }}
                disabled={estadoSelected.length === 0 && !filters?.estados?.length}
              >
                Limpiar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  applyFiltersToQueryParams({
                    fechaDesde,
                    fechaHasta,
                    pacienteIds: pacienteSelected,
                    prestadorIds: prestadorSelected,
                    estados: estadoSelected,
                  });
                }}
                disabled={arraysEqual(
                  normalizeStringArray(estadoSelected),
                  normalizeStringArray(filters?.estados || [])
                )}
              >
                Aplicar
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="solo-alertas"
            checked={soloAlertas}
            onCheckedChange={setSoloAlertas}
          />
          <Label htmlFor="solo-alertas" className="text-sm cursor-pointer">
            Solo cerradas anticipadamente
          </Label>
        </div>
      </div>

      <DataTable table={table} isLoading={loading} />
      
      <DataTablePagination
        table={table}
        showSelectedCount={true}
        showPageNumbers={true}
        pageSizeOptions={[25, 50, 100, 250]}
        isServerPaginated={isServerPaginated}
        goToPage={isServerPaginated ? goToPage : undefined}
        handlePageSizeChange={isServerPaginated ? handlePageSizeChange : undefined}
        firstItem={isServerPaginated ? firstItem : undefined}
        lastItem={isServerPaginated ? lastItem : undefined}
        total={isServerPaginated ? pagination?.total : undefined}
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

        {canEditResidenceSchedule && (
          <>
            <Button
              variant="outline"
              className="ml-2 bg-purple-50 text-purple-700 hover:bg-purple-100"
              onClick={handleOpenResidenceSchedule}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Cambiar horario (residencia)
            </Button>
            <Dialog open={residenceScheduleOpen} onOpenChange={setResidenceScheduleOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cambiar horario compartido</DialogTitle>
                  <DialogDescription>
                    Se actualizarán todas las prestaciones pendientes de este prestador
                    {residenceName ? ` en ${residenceName}` : " en la residencia seleccionada"}
                    con el mismo horario.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nueva fecha</Label>
                    <Input
                      type="date"
                      value={residenceScheduleDate}
                      onChange={(e) => setResidenceScheduleDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nueva hora</Label>
                    <Input
                      type="time"
                      value={residenceScheduleTime}
                      onChange={(e) => setResidenceScheduleTime(e.target.value)}
                    />
                  </div>
                  {residenceScheduleError && (
                    <p className="text-sm text-red-600">{residenceScheduleError}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setResidenceScheduleOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleResidenceScheduleSave}
                    disabled={residenceScheduleSaving}
                  >
                    {residenceScheduleSaving ? 'Guardando…' : 'Actualizar horario'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

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

          {!hasCompleted && (
          <Button
            variant="outline"
            className="ml-2 bg-amber-50 text-amber-700 hover:bg-amber-100"
            onClick={handleOpenReassign}
          >
            <Repeat className="mr-2 h-4 w-4" />
            Reasignar {selectedCount} seleccionadas
          </Button>
          )}

          <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reasignar {selectedCount} prestaciones</DialogTitle>
                <DialogDescription>
                  Seleccioná el nuevo prestador. Solo se reasignan prestaciones <b>pendientes</b> del mismo tipo.
                </DialogDescription>
              </DialogHeader>
              {reassignError && <p className="text-sm text-red-600">{reassignError}</p>}
              {reassignLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando prestadores…</div>
              ) : (
                <div className="space-y-2">
                  <Label>Nuevo prestador</Label>
                  <SearchInput
                    placeholder="Buscar por nombre…"
                    value={reassignPrestadorSearch}
                    onChange={e => setReassignPrestadorSearch(e.target.value)}
                  />
                  <div className="max-h-56 overflow-y-auto space-y-1 border rounded p-2">
                    {reassignPrestadores
                      .filter(p => `${p.apellido ?? ''} ${p.nombre ?? ''}`.toLowerCase().includes(reassignPrestadorSearch.toLowerCase()))
                      .map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="reassign_prestador"
                            value={p.id}
                            checked={reassignPrestadorId === p.id}
                            onChange={() => setReassignPrestadorId(p.id)}
                          />
                          {`${p.apellido ?? ''}, ${p.nombre ?? ''}`}
                          {p.documento ? <span className="text-xs text-muted-foreground">DNI {p.documento}</span> : null}
                        </label>
                      ))}
                    {reassignPrestadores.length === 0 && <p className="text-sm text-muted-foreground">Sin prestadores disponibles para este tipo.</p>}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancelar</Button>
                <Button
                  disabled={!reassignPrestadorId || reassignSaving || reassignLoading}
                  onClick={handleReassignSave}
                >
                  {reassignSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reasignando…</> : 'Confirmar reasignación'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {!hasCompleted && (<>
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

          <Dialog open={massCompleteOpen} onOpenChange={setMassCompleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="ml-2 text-green-700 border-green-400 hover:bg-green-50">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Completar {selectedCount} seleccionadas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Completar {selectedCount} prestaciones</DialogTitle>
                <DialogDescription>
                  Esta acción marcará como <b>completadas</b> todas las seleccionadas. ¿Deseás continuar?
                </DialogDescription>
              </DialogHeader>
              {massCompleteError && <div className="text-red-600 text-sm">{massCompleteError}</div>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMassCompleteOpen(false)}>Volver</Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={massCompleteSaving} onClick={handleMassCompleteSave}>
                  {massCompleteSaving ? 'Completando...' : 'Confirmar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>)}

          <Dialog open={massDeleteOpen} onOpenChange={setMassDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="ml-2 text-red-700 border-red-400 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar {selectedCount} seleccionadas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar {selectedCount} prestaciones</DialogTitle>
                <DialogDescription>
                  Esta acción <b>eliminará permanentemente</b> las prestaciones seleccionadas (las completadas serán omitidas). ¿Deseás continuar?
                </DialogDescription>
              </DialogHeader>
              {massDeleteError && <div className="text-red-600 text-sm">{massDeleteError}</div>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMassDeleteOpen(false)}>Volver</Button>
                <Button variant="destructive" disabled={massDeleteSaving} onClick={handleMassDeleteSave}>
                  {massDeleteSaving ? 'Eliminando...' : 'Eliminar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {!canEditResidenceSchedule && residenceSelectionHint && (
            <p className="mt-2 w-full text-right text-sm text-muted-foreground">
              {residenceSelectionHint}
            </p>
          )}
        </div>
      )}

      {/* Reasignar por paciente */}
      <div className="mt-2 flex justify-end">
        <Button
          variant="outline"
          className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          onClick={() => { setByPatientOpen(true); setByPatientError(null); }}
        >
          <Users className="mr-2 h-4 w-4" />
          Reasignar por paciente
        </Button>
      </div>

      <Dialog open={byPatientOpen} onOpenChange={setByPatientOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reasignar prestaciones por paciente</DialogTitle>
            <DialogDescription>
              Reasigna todas las prestaciones <b>pendientes</b> de un paciente a otro prestador.
            </DialogDescription>
          </DialogHeader>
          {byPatientError && <p className="text-sm text-red-600">{byPatientError}</p>}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Paciente</Label>
              <SearchInput
                placeholder="Buscar por nombre o apellido…"
                value={byPatientPacienteSearch}
                onChange={e => setByPatientPacienteSearch(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto space-y-1 border rounded p-2">
                {allPacientes
                  .filter(p => `${p.apellido} ${p.nombre}`.toLowerCase().includes(byPatientPacienteSearch.toLowerCase()))
                  .map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="bypatient_paciente"
                        value={p.id}
                        checked={byPatientPacienteId === p.id}
                        onChange={() => handleByPatientPacienteChange(p.id)}
                      />
                      {`${p.apellido}, ${p.nombre}`}
                      <span className="text-xs text-muted-foreground">DNI {p.documento}</span>
                    </label>
                  ))}
                {allPacientes.length === 0 && <p className="text-sm text-muted-foreground">Sin pacientes.</p>}
              </div>
              {byPatientPacienteId && (
                <p className="text-xs text-muted-foreground">
                  {byPatientLoadingPrestaciones
                    ? 'Cargando prestaciones…'
                    : byPatientPrestacionesCount === null
                    ? ''
                    : byPatientPrestacionesCount === 0
                    ? 'No hay prestaciones pendientes para este paciente.'
                    : `${byPatientPrestacionesCount} prestaciones pendientes encontradas.`}
                </p>
              )}
            </div>

            {byPatientPrestacionesCount !== null && byPatientPrestacionesCount > 0 && (
              <div className="space-y-1">
                <Label>Nuevo prestador</Label>
                <SearchInput
                  placeholder="Buscar por nombre…"
                  value={byPatientPrestadorSearch}
                  onChange={e => setByPatientPrestadorSearch(e.target.value)}
                />
                {byPatientLoadingPrestadores ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1 border rounded p-2">
                    {byPatientPrestadores
                      .filter(p => `${p.apellido ?? ''} ${p.nombre ?? ''}`.toLowerCase().includes(byPatientPrestadorSearch.toLowerCase()))
                      .map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="bypatient_prestador"
                            value={p.id}
                            checked={byPatientPrestadorId === p.id}
                            onChange={() => setByPatientPrestadorId(p.id)}
                          />
                          {`${p.apellido ?? ''}, ${p.nombre ?? ''}`}
                          {p.documento ? <span className="text-xs text-muted-foreground">DNI {p.documento}</span> : null}
                        </label>
                      ))}
                    {byPatientPrestadores.length === 0 && <p className="text-sm text-muted-foreground">Sin prestadores disponibles.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setByPatientOpen(false)}>Cancelar</Button>
            <Button
              disabled={!byPatientPacienteId || !byPatientPrestadorId || byPatientSaving}
              onClick={handleByPatientSave}
            >
              {byPatientSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reasignando…</> : 'Confirmar reasignación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// export type { PrestacionRow };
// export { PrestacionesTable };