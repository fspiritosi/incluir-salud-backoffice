"use client";

import { useState, useTransition, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  type PaginationState,
  type Updater,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  aprobarUbicacionSugeridaPaciente, 
  rechazarUbicacionSugeridaPaciente,
  aprobarUbicacionSugeridaCentro,
  rechazarUbicacionSugeridaCentro,
  type PacienteUbicacionSugeridaRow,
  type CentroUbicacionSugeridaRow,
} from "@/app/protected/ubicaciones-sugeridas/actions";

interface ServerPaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

type UbicacionesSugeridasFilters = {
  tipo: string;
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
  pacienteIds: string[];
  centroIds: string[];
  sugeridoPorIds: string[];
};

const ESTADO_OPTIONS = ["pendiente", "aprobada", "rechazada"] as const;

type UbicacionesSugeridasTableProps = {
  pacientes: PacienteUbicacionSugeridaRow[];
  centros: CentroUbicacionSugeridaRow[];
  filters?: UbicacionesSugeridasFilters;
  pagination?: ServerPaginationInfo;
};


const formatCoords = (coords: { lng: number; lat: number } | null) => {
  if (!coords) return "—";
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
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
    return fecha;
  }
};

const nombreCompleto = (row: PacienteUbicacionSugeridaRow) => {
  return `${row.apellido || ""}, ${row.nombre || ""}`.trim() || "Sin nombre";
};

export const UbicacionesSugeridasTable = ({ 
  pacientes, 
  centros, 
  filters, 
  pagination 
}: UbicacionesSugeridasTableProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  
  const [tipo, setTipo] = useState<string>(filters?.tipo ?? "");
  const [estado, setEstado] = useState<string>(filters?.estado ?? "");
  const [fechaDesde, setFechaDesde] = useState<string>(filters?.fechaDesde ?? "");
  const [fechaHasta, setFechaHasta] = useState<string>(filters?.fechaHasta ?? "");
  const [pacienteSelected, setPacienteSelected] = useState<string[]>(filters?.pacienteIds ?? []);
  const [centroSelected, setCentroSelected] = useState<string[]>(filters?.centroIds ?? []);
  const [sugeridoPorSelected, setSugeridoPorSelected] = useState<string[]>(filters?.sugeridoPorIds ?? []);
  const [estadoFilterSearch, setEstadoFilterSearch] = useState("");
  const [pacienteFilterSearch, setPacienteFilterSearch] = useState("");
  const [centroFilterSearch, setCentroFilterSearch] = useState("");
  const [sugeridoPorFilterSearch, setSugeridoPorFilterSearch] = useState("");
  const initialPaginationState: PaginationState = {
    pageIndex: Math.max(0, (pagination?.page ?? 1) - 1),
    pageSize: pagination?.pageSize ?? 25,
  };
  const [paginationState, setPaginationState] = useState<PaginationState>(initialPaginationState);

  const [activeTab, setActiveTab] = useState("pacientes");

  // Persistencia en localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ubicacionesSugeridasFilters");
    if (saved) {
      try {
        const { tipo: savedTipo, estado: savedEstado, fechaDesde: savedFechaDesde, fechaHasta: savedFechaHasta, pacienteIds: savedPacienteIds, centroIds: savedCentroIds, sugeridoPorIds: savedSugeridoPorIds } = JSON.parse(saved);
        setTipo(savedTipo ?? "");
        setEstado(savedEstado ?? "");
        setFechaDesde(savedFechaDesde ?? "");
        setFechaHasta(savedFechaHasta ?? "");
        setPacienteSelected(savedPacienteIds ?? []);
        setCentroSelected(savedCentroIds ?? []);
        setSugeridoPorSelected(savedSugeridoPorIds ?? []);
      } catch (e) {
        console.error("Error loading filters from localStorage", e);
      }
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("ubicacionesSugeridasPagination");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed?.pageIndex === "number" &&
          parsed.pageIndex >= 0 &&
          typeof parsed?.pageSize === "number" &&
          parsed.pageSize > 0
        ) {
          setPaginationState({ pageIndex: parsed.pageIndex, pageSize: parsed.pageSize });
        }
      } catch (e) {
        console.error("Error loading pagination from localStorage", e);
      }
    }
  }, []);

  const getFiltersSnapshot = useCallback(() => ({
    tipo,
    estado,
    fechaDesde,
    fechaHasta,
    pacienteIds: pacienteSelected,
    centroIds: centroSelected,
    sugeridoPorIds: sugeridoPorSelected,
  }), [tipo, estado, fechaDesde, fechaHasta, pacienteSelected, centroSelected, sugeridoPorSelected]);

  const pushStateToUrl = useCallback((
    filtersToPersist: UbicacionesSugeridasFilters,
    paginationToPersist: PaginationState,
  ) => {
    const params = new URLSearchParams();
    if (filtersToPersist.tipo) params.set("tipo", filtersToPersist.tipo);
    if (filtersToPersist.estado) params.set("estado", filtersToPersist.estado);
    if (filtersToPersist.fechaDesde) params.set("fechaDesde", filtersToPersist.fechaDesde);
    if (filtersToPersist.fechaHasta) params.set("fechaHasta", filtersToPersist.fechaHasta);
    filtersToPersist.pacienteIds.forEach((id) => params.append("pacienteIds", id));
    filtersToPersist.centroIds.forEach((id) => params.append("centroIds", id));
    filtersToPersist.sugeridoPorIds.forEach((id) => params.append("sugeridoPorIds", id));
    params.set("page", String(paginationToPersist.pageIndex + 1));
    params.set("pageSize", String(paginationToPersist.pageSize));
    router.push(`?${params.toString()}`);
  }, [router]);

  // Guardar filtros en localStorage y URL
  const updateFilters = useCallback((
    newTipo: string, 
    newEstado: string, 
    newFechaDesde: string, 
    newFechaHasta: string,
    newPacienteIds: string[] = [],
    newCentroIds: string[] = [],
    newSugeridoPorIds: string[] = []
  ) => {
    setTipo(newTipo);
    setEstado(newEstado);
    setFechaDesde(newFechaDesde);
    setFechaHasta(newFechaHasta);
    setPacienteSelected(newPacienteIds);
    setCentroSelected(newCentroIds);
    setSugeridoPorSelected(newSugeridoPorIds);

    localStorage.setItem("ubicacionesSugeridasFilters", JSON.stringify({
      tipo: newTipo,
      estado: newEstado,
      fechaDesde: newFechaDesde,
      fechaHasta: newFechaHasta,
      pacienteIds: newPacienteIds,
      centroIds: newCentroIds,
      sugeridoPorIds: newSugeridoPorIds,
    }));
    const nextPagination = { pageIndex: 0, pageSize: paginationState.pageSize };
    setPaginationState(nextPagination);
    localStorage.setItem("ubicacionesSugeridasPagination", JSON.stringify(nextPagination));
    pushStateToUrl({
      tipo: newTipo,
      estado: newEstado,
      fechaDesde: newFechaDesde,
      fechaHasta: newFechaHasta,
      pacienteIds: newPacienteIds,
      centroIds: newCentroIds,
      sugeridoPorIds: newSugeridoPorIds,
    }, nextPagination);
  }, [paginationState.pageSize, pushStateToUrl]);

  const handlePaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setPaginationState((prev) => {
      const nextState = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem("ubicacionesSugeridasPagination", JSON.stringify(nextState));
      pushStateToUrl(getFiltersSnapshot(), nextState);
      return nextState;
    });
  }, [getFiltersSnapshot, pushStateToUrl]);


  const estadoOptionsFiltradas = useMemo(() => {
    const q = estadoFilterSearch.trim().toLowerCase();
    if (!q) return ESTADO_OPTIONS;
    return ESTADO_OPTIONS.filter((e) => e.toLowerCase().includes(q));
  }, [estadoFilterSearch]);

  const pacientesOptions = useMemo(() => {
    const map = new Map<string, string>();
    pacientes.forEach(p => {
      const fullName = `${p.apellido || ""}, ${p.nombre || ""}`.trim();
      map.set(p.id, fullName || "Sin nombre");
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [pacientes]);

  const centrosOptions = useMemo(() => {
    const map = new Map<string, string>();
    centros.forEach(c => {
      map.set(c.id, c.nombre || "Sin nombre");
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [centros]);

  const sugeridoPorOptions = useMemo(() => {
    const map = new Map<string, string>();
    pacientes.forEach(p => {
      if (p.ubicacion_sugerida_por) {
        const fullName = p.ubicacion_sugerida_por_nombre || p.ubicacion_sugerida_por_email || p.ubicacion_sugerida_por;
        map.set(p.ubicacion_sugerida_por, fullName);
      }
    });
    centros.forEach(c => {
      if (c.ubicacion_sugerida_por) {
        const fullName = c.ubicacion_sugerida_por_nombre || c.ubicacion_sugerida_por_email || c.ubicacion_sugerida_por;
        map.set(c.ubicacion_sugerida_por, fullName);
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [pacientes, centros]);

  // Filtrar datos
  const pacientesFiltrados = useMemo(() => {
    let filtered = pacientes;
    if (estado && estado !== "pendiente") {
      filtered = filtered.filter(() => false);
    }
    if (fechaDesde) {
      filtered = filtered.filter(p => {
        const fecha = p.ubicacion_sugerida_at ? new Date(p.ubicacion_sugerida_at) : null;
        return fecha && fecha >= new Date(fechaDesde);
      });
    }
    if (fechaHasta) {
      filtered = filtered.filter(p => {
        const fecha = p.ubicacion_sugerida_at ? new Date(p.ubicacion_sugerida_at) : null;
        return fecha && fecha <= new Date(fechaHasta + "T23:59:59");
      });
    }
    if (pacienteSelected.length > 0) {
      filtered = filtered.filter(p => pacienteSelected.includes(p.id));
    }
    if (sugeridoPorSelected.length > 0) {
      filtered = filtered.filter(p => p.ubicacion_sugerida_por && sugeridoPorSelected.includes(p.ubicacion_sugerida_por));
    }
    return filtered.sort((a, b) => {
      const aFecha = a.ubicacion_sugerida_at ? new Date(a.ubicacion_sugerida_at).getTime() : 0;
      const bFecha = b.ubicacion_sugerida_at ? new Date(b.ubicacion_sugerida_at).getTime() : 0;
      return aFecha - bFecha;
    });
  }, [pacientes, estado, fechaDesde, fechaHasta, pacienteSelected, sugeridoPorSelected]);

  const centrosFiltrados = useMemo(() => {
    let filtered = centros;
    if (estado && estado !== "pendiente") {
      filtered = filtered.filter(() => false);
    }
    if (fechaDesde) {
      filtered = filtered.filter(c => {
        const fecha = c.ubicacion_sugerida_at ? new Date(c.ubicacion_sugerida_at) : null;
        return fecha && fecha >= new Date(fechaDesde);
      });
    }
    if (fechaHasta) {
      filtered = filtered.filter(c => {
        const fecha = c.ubicacion_sugerida_at ? new Date(c.ubicacion_sugerida_at) : null;
        return fecha && fecha <= new Date(fechaHasta + "T23:59:59");
      });
    }
    if (centroSelected.length > 0) {
      filtered = filtered.filter(c => centroSelected.includes(c.id));
    }
    if (sugeridoPorSelected.length > 0) {
      filtered = filtered.filter(c => c.ubicacion_sugerida_por && sugeridoPorSelected.includes(c.ubicacion_sugerida_por));
    }
    return filtered.sort((a, b) => {
      const aFecha = a.ubicacion_sugerida_at ? new Date(a.ubicacion_sugerida_at).getTime() : 0;
      const bFecha = b.ubicacion_sugerida_at ? new Date(b.ubicacion_sugerida_at).getTime() : 0;
      return aFecha - bFecha;
    });
  }, [centros, estado, fechaDesde, fechaHasta, centroSelected, sugeridoPorSelected]);

  // Paginación
  const pacientesColumns: ColumnDef<PacienteUbicacionSugeridaRow>[] = [
    {
      accessorKey: "nombre",
      header: "Beneficiario",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{nombreCompleto(row.original)}</div>
          <div className="text-xs text-muted-foreground">
            {[row.original.direccion_completa, row.original.ciudad, row.original.provincia].filter(Boolean).join(" · ")}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "documento",
      header: "DNI",
      cell: ({ row }) => row.original.documento || "—",
    },
    {
      accessorKey: "ubicacion_sugerida_por_nombre",
      header: "Sugerida por",
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.ubicacion_sugerida_por_nombre || "—"}</div>
          <div className="text-xs text-muted-foreground">{row.original.ubicacion_sugerida_por_email || ""}</div>
        </div>
      ),
    },
    {
      accessorKey: "ubicacion_sugerida_at",
      header: "Fecha",
      cell: ({ row }) => formatFecha(row.original.ubicacion_sugerida_at),
    },
    {
      accessorKey: "ubicacion_sugerida",
      header: "Ubicación sugerida",
      cell: ({ row }) => formatCoords(row.original.ubicacion_sugerida),
    },
    {
      accessorKey: "ubicacion",
      header: "Ubicación actual",
      cell: ({ row }) => formatCoords(row.original.ubicacion),
    },
    {
      accessorKey: "ubicacion_sugerida_precision_m",
      header: "Precisión (m)",
      cell: ({ row }) => row.original.ubicacion_sugerida_precision_m ?? "—",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <form
            action={(fd) => {
              startTransition(() => {
                aprobarUbicacionSugeridaPaciente(fd).then(() => {
                  toast({ title: "Ubicación aprobada" });
                  router.refresh();
                });
              });
            }}
          >
            <input type="hidden" name="paciente_id" value={row.original.id} />
            <Button type="submit" size="sm" disabled={isPending}>
              Aprobar
            </Button>
          </form>
          <form
            action={(fd) => {
              startTransition(() => {
                rechazarUbicacionSugeridaPaciente(fd).then(() => {
                  toast({ title: "Ubicación rechazada" });
                  router.refresh();
                });
              });
            }}
          >
            <input type="hidden" name="paciente_id" value={row.original.id} />
            <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
              Rechazar
            </Button>
          </form>
        </div>
      ),
    },
  ];

  const centrosColumns: ColumnDef<CentroUbicacionSugeridaRow>[] = [
    {
      accessorKey: "nombre",
      header: "Centro",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.nombre || "Sin nombre"}</div>
          <div className="text-xs text-muted-foreground">
            {[row.original.direccion_completa, row.original.ciudad, row.original.provincia].filter(Boolean).join(" · ")}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ row }) => row.original.tipo || "—",
    },
    {
      accessorKey: "ubicacion_sugerida_por_nombre",
      header: "Sugerida por",
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.ubicacion_sugerida_por_nombre || "—"}</div>
          <div className="text-xs text-muted-foreground">{row.original.ubicacion_sugerida_por_email || ""}</div>
        </div>
      ),
    },
    {
      accessorKey: "ubicacion_sugerida_at",
      header: "Fecha",
      cell: ({ row }) => formatFecha(row.original.ubicacion_sugerida_at),
    },
    {
      accessorKey: "ubicacion_sugerida",
      header: "Ubicación sugerida",
      cell: ({ row }) => formatCoords(row.original.ubicacion_sugerida),
    },
    {
      accessorKey: "ubicacion",
      header: "Ubicación actual",
      cell: ({ row }) => formatCoords(row.original.ubicacion),
    },
    {
      accessorKey: "ubicacion_sugerida_precision_m",
      header: "Precisión (m)",
      cell: ({ row }) => row.original.ubicacion_sugerida_precision_m ?? "—",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <form
            action={(fd) => {
              startTransition(() => {
                aprobarUbicacionSugeridaCentro(fd).then(() => {
                  toast({ title: "Ubicación aprobada" });
                  router.refresh();
                });
              });
            }}
          >
            <input type="hidden" name="centro_id" value={row.original.id} />
            <Button type="submit" size="sm" disabled={isPending}>
              Aprobar
            </Button>
          </form>
          <form
            action={(fd) => {
              startTransition(() => {
                rechazarUbicacionSugeridaCentro(fd).then(() => {
                  toast({ title: "Ubicación rechazada" });
                  router.refresh();
                });
              });
            }}
          >
            <input type="hidden" name="centro_id" value={row.original.id} />
            <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
              Rechazar
            </Button>
          </form>
        </div>
      ),
    },
  ];

  const pacientesTable = useReactTable({
    data: pacientesFiltrados,
    columns: pacientesColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: paginationState,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
  });

  const centrosTable = useReactTable({
    data: centrosFiltrados,
    columns: centrosColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: paginationState,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Desde (YYYY-MM-DD)"
            type="date"
            value={fechaDesde}
            onChange={(e) => updateFilters(tipo, estado, e.target.value, fechaHasta, pacienteSelected, centroSelected, sugeridoPorSelected)}
            className="w-40"
          />
          <Input
            placeholder="Hasta (YYYY-MM-DD)"
            type="date"
            value={fechaHasta}
            onChange={(e) => updateFilters(tipo, estado, fechaDesde, e.target.value, pacienteSelected, centroSelected, sugeridoPorSelected)}
            className="w-40"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-40">
                {estado || "Estado"} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40">
              <Input
                placeholder="Buscar estado…"
                value={estadoFilterSearch}
                onChange={(e) => setEstadoFilterSearch(e.target.value)}
                className="mb-2"
              />
              <DropdownMenuCheckboxItem
                checked={estado === ""}
                onCheckedChange={() => updateFilters(tipo, "", fechaDesde, fechaHasta, pacienteSelected, centroSelected, sugeridoPorSelected)}
              >
                Todos
              </DropdownMenuCheckboxItem>
              {estadoOptionsFiltradas.map((e) => (
                <DropdownMenuCheckboxItem
                  key={e}
                  checked={estado === e}
                  onCheckedChange={() => updateFilters(tipo, e, fechaDesde, fechaHasta, pacienteSelected, centroSelected, sugeridoPorSelected)}
                >
                  {e}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-48">
                Beneficiario {pacienteSelected.length > 0 && `(${pacienteSelected.length})`} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
              <Input
                placeholder="Buscar beneficiario…"
                value={pacienteFilterSearch}
                onChange={(e) => setPacienteFilterSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="mb-2"
              />
              <DropdownMenuCheckboxItem
                checked={pacienteSelected.length === 0}
                onCheckedChange={() => updateFilters(tipo, estado, fechaDesde, fechaHasta, [], centroSelected, sugeridoPorSelected)}
              >
                Todos
              </DropdownMenuCheckboxItem>
              {pacientesOptions
                .filter(p => p.label.toLowerCase().includes(pacienteFilterSearch.toLowerCase()))
                .map((p) => (
                  <DropdownMenuCheckboxItem
                    key={p.id}
                    checked={pacienteSelected.includes(p.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = checked
                        ? [...pacienteSelected, p.id]
                        : pacienteSelected.filter(id => id !== p.id);
                      updateFilters(tipo, estado, fechaDesde, fechaHasta, newSelected, centroSelected, sugeridoPorSelected);
                    }}
                  >
                    {p.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-48">
                Centro {centroSelected.length > 0 && `(${centroSelected.length})`} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
              <Input
                placeholder="Buscar centro…"
                value={centroFilterSearch}
                onChange={(e) => setCentroFilterSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="mb-2"
              />
              <DropdownMenuCheckboxItem
                checked={centroSelected.length === 0}
                onCheckedChange={() => updateFilters(tipo, estado, fechaDesde, fechaHasta, pacienteSelected, [], sugeridoPorSelected)}
              >
                Todos
              </DropdownMenuCheckboxItem>
              {centrosOptions
                .filter(c => c.label.toLowerCase().includes(centroFilterSearch.toLowerCase()))
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={centroSelected.includes(c.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = checked
                        ? [...centroSelected, c.id]
                        : centroSelected.filter(id => id !== c.id);
                      updateFilters(tipo, estado, fechaDesde, fechaHasta, pacienteSelected, newSelected, sugeridoPorSelected);
                    }}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-48">
                Sugerida por {sugeridoPorSelected.length > 0 && `(${sugeridoPorSelected.length})`} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
              <Input
                placeholder="Buscar usuario…"
                value={sugeridoPorFilterSearch}
                onChange={(e) => setSugeridoPorFilterSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="mb-2"
              />
              <DropdownMenuCheckboxItem
                checked={sugeridoPorSelected.length === 0}
                onCheckedChange={() => updateFilters(tipo, estado, fechaDesde, fechaHasta, pacienteSelected, centroSelected, [])}
              >
                Todos
              </DropdownMenuCheckboxItem>
              {sugeridoPorOptions
                .filter(s => s.label.toLowerCase().includes(sugeridoPorFilterSearch.toLowerCase()))
                .map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s.id}
                    checked={sugeridoPorSelected.includes(s.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = checked
                        ? [...sugeridoPorSelected, s.id]
                        : sugeridoPorSelected.filter(id => id !== s.id);
                      updateFilters(tipo, estado, fechaDesde, fechaHasta, pacienteSelected, centroSelected, newSelected);
                    }}
                  >
                    {s.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            onClick={() => updateFilters("", "", "", "", [], [], [])}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pacientes">
            Beneficiarios
            <span className="ml-2 rounded-full bg-black/10 px-2 text-xs">{pacientesFiltrados.length}</span>
          </TabsTrigger>
          <TabsTrigger value="centros">
            Centros
            <span className="ml-2 rounded-full bg-black/10 px-2 text-xs">{centrosFiltrados.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pacientes" className="space-y-4">
          <DataTable table={pacientesTable} />
          <DataTablePagination table={pacientesTable} showTotalCount={false} />
        </TabsContent>

        <TabsContent value="centros" className="space-y-4">
          <DataTable table={centrosTable} />
          <DataTablePagination table={centrosTable} showTotalCount={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UbicacionesSugeridasTable;
