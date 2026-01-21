"use client";

import {
  useState,
  useMemo,
  useEffect,
  useDeferredValue,
  useCallback,
  useRef,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import {
  Loader2,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  XCircle,
} from "lucide-react";

import type { TransportePrestacionListItem } from "@/app/protected/transporte/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canCreateOrEditPrestacion } from "@/utils/permissions";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelPrestacion } from "@/app/protected/prestaciones/actions";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];
const FILTER_OPTION_LIMIT = 250;
const IDENTITY_PAGE_SIZE = 25;

const normalizeStringArray = (values: string[] = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const normalizeForSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const formatSentido = (sentido?: string | null) => {
  if (!sentido) return "-";
  if (sentido === "ida") return "Ida";
  if (sentido === "vuelta") return "Vuelta";
  if (sentido === "ida_y_vuelta") return "Ida y vuelta";
  return sentido;
};

const EMPTY_FILTERS = {
  search: "",
  ids: [] as string[],
  ciudades: [] as string[],
  activo: "todos" as "todos" | "si" | "no",
  fechaDesde: "",
  fechaHasta: "",
};

interface ServerPaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

export type TransportePrestacionesFilters = typeof EMPTY_FILTERS;

interface TransportePrestacionesTableProps {
  data: TransportePrestacionListItem[];
  pagination?: ServerPaginationInfo;
  filters?: Partial<TransportePrestacionesFilters>;
  allCities?: string[];
}

type IdentityOption = {
  id: string;
  label: string;
};

type IdentityRecord = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  documento: string | null;
};

const toIdentityOption = (record: IdentityRecord): IdentityOption => {
  const nombreCompleto = [record.apellido, record.nombre].filter(Boolean).join(", ");
  const documento = record.documento ? ` · DNI ${record.documento}` : "";
  return {
    id: record.id,
    label: `${nombreCompleto || "Sin datos"}${documento}`,
  };
};

export function TransportePrestacionesTable({
  data,
  pagination,
  filters,
  allCities = [],
}: TransportePrestacionesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { roles, loading } = useBackofficeRoles();
  const canEdit = canCreateOrEditPrestacion(roles);
  const { toast } = useToast();
  const isServerPaginated = Boolean(pagination);
  const [isPaginationPending, startPaginationTransition] = useTransition();
  const totalPages = pagination ? Math.max(1, Math.ceil((pagination.total || 1) / pagination.pageSize)) : 1;

  const filtersSignature = useMemo(
    () =>
      [
        filters?.search ?? "",
        normalizeStringArray(filters?.ids || []).join("|"),
        normalizeStringArray(filters?.ciudades || []).join("|"),
        filters?.activo ?? "todos",
        filters?.fechaDesde ?? "",
        filters?.fechaHasta ?? "",
      ].join("::"),
    [filters]
  );

  const normalizedFilters = useMemo(() => {
    return {
      ...EMPTY_FILTERS,
      ...(filters || {}),
      search: filters?.search ?? "",
      ids: normalizeStringArray(filters?.ids || []),
      ciudades: normalizeStringArray(filters?.ciudades || []),
      activo: filters?.activo ?? "todos",
      fechaDesde: filters?.fechaDesde ?? "",
      fechaHasta: filters?.fechaHasta ?? "",
    } satisfies TransportePrestacionesFilters;
  }, [filtersSignature]);

  const [localFilters, setLocalFilters] = useState<TransportePrestacionesFilters>(normalizedFilters);
  const [searchDraft, setSearchDraft] = useState(normalizedFilters.search);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [fActivo, setFActivo] = useState<"todos" | "si" | "no">(normalizedFilters.activo);
  const [identidadSearch, setIdentidadSearch] = useState("");
  const [identidadSelected, setIdentidadSelected] = useState<string[]>(normalizedFilters.ids);
  const [ciudadSearch, setCiudadSearch] = useState("");
  const [ciudadSelected, setCiudadSelected] = useState<string[]>(normalizedFilters.ciudades);
  const [identityOptions, setIdentityOptions] = useState<IdentityOption[]>([]);
  const [identityPage, setIdentityPage] = useState(1);
  const [identityHasMore, setIdentityHasMore] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const identityAbortRef = useRef<AbortController | null>(null);
  const [fechaDesde, setFechaDesde] = useState(normalizedFilters.fechaDesde || "");
  const [fechaHasta, setFechaHasta] = useState(normalizedFilters.fechaHasta || "");
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [massEditOpen, setMassEditOpen] = useState(false);
  const [massEditError, setMassEditError] = useState<string | null>(null);
  const [massEditSaving, setMassEditSaving] = useState(false);
  const [massEditDay, setMassEditDay] = useState<string | null>(null);
  const [massEditTime, setMassEditTime] = useState<string>("");
  const [massEditMonto, setMassEditMonto] = useState<string>("");
  const [massEditCronico, setMassEditCronico] = useState<boolean>(false);
  const [massEditCronicoMixed, setMassEditCronicoMixed] = useState(false);
  const [massCancelOpen, setMassCancelOpen] = useState(false);
  const [massCancelSaving, setMassCancelSaving] = useState(false);
  const [massCancelError, setMassCancelError] = useState<string | null>(null);
  const [isPending, startSelectionTransition] = useTransition();

  const deferredIdentidadSearch = useDeferredValue(identidadSearch.trim().toLowerCase());
  const deferredIdentityQuery = useDeferredValue(identidadSearch.trim());
  const deferredCiudadSearch = useDeferredValue(ciudadSearch.trim().toLowerCase());

  const applyFiltersToQueryParams = useCallback(
    (nextFilters: TransportePrestacionesFilters, options?: { preservePage?: boolean }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const setArrayParam = (key: string, values: string[]) => {
        params.delete(key);
        values.forEach((value) => params.append(key, value));
      };
      const setOptionalParam = (key: string, value: string) => {
        if (value?.trim()) {
          params.set(key, value.trim());
        } else {
          params.delete(key);
        }
      };

      setOptionalParam("search", nextFilters.search);
      setArrayParam("ids", nextFilters.ids);
      setArrayParam("ciudades", nextFilters.ciudades);
      if (nextFilters.activo && nextFilters.activo !== "todos") {
        params.set("activo", nextFilters.activo);
      } else {
        params.delete("activo");
      }

      setOptionalParam("fechaDesde", nextFilters.fechaDesde || "");
      setOptionalParam("fechaHasta", nextFilters.fechaHasta || "");

      if (!options?.preservePage) {
        params.set("page", "1");
      }

      if (pagination?.pageSize) {
        params.set("pageSize", String(pagination.pageSize));
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    },
    [pagination?.pageSize, pathname, router, searchParams]
  );

  const fetchIdentityPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (identityAbortRef.current) {
        identityAbortRef.current.abort();
      }
      const controller = new AbortController();
      identityAbortRef.current = controller;
      setIdentityLoading(true);
      setIdentityError(null);
      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          pageSize: String(IDENTITY_PAGE_SIZE),
          includeInactivos: "true",
        });
        if (deferredIdentityQuery) {
          params.set("query", deferredIdentityQuery);
        }
        const res = await fetch(`/api/beneficiarios/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("No se pudo cargar la búsqueda de beneficiarios");
        }
        const payload = await res.json();
        const options = (payload.data || []).map((record: IdentityRecord) => toIdentityOption(record));
        setIdentityOptions((prev) => {
          if (!append) return options;
          const seen = new Set(prev.map((option) => option.id));
          const merged = [...prev];
          options.forEach((option: IdentityOption) => {
            if (!seen.has(option.id)) {
              seen.add(option.id);
              merged.push(option);
            }
          });
          return merged;
        });
        const resolvedPage = typeof payload.page === "number" ? payload.page : pageToLoad;
        const resolvedPageSize = typeof payload.pageSize === "number" ? payload.pageSize : IDENTITY_PAGE_SIZE;
        const resolvedTotal = typeof payload.total === "number" ? payload.total : 0;
        setIdentityPage(resolvedPage);
        const hasMore = resolvedTotal
          ? resolvedPage * resolvedPageSize < resolvedTotal
          : options.length === IDENTITY_PAGE_SIZE;
        setIdentityHasMore(hasMore);
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return;
        }
        console.error("Error buscando identidades de beneficiarios", error);
        setIdentityError("No se pudieron cargar los resultados");
      } finally {
        if (identityAbortRef.current === controller) {
          identityAbortRef.current = null;
          setIdentityLoading(false);
        }
      }
    },
    [deferredIdentityQuery]
  );

  useEffect(() => {
    setIdentityOptions([]);
    setIdentityPage(1);
    setIdentityHasMore(false);
    fetchIdentityPage(1, false);
  }, [fetchIdentityPage]);

  useEffect(() => {
    return () => {
      identityAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setLocalFilters(normalizedFilters);
    setSearchDraft(normalizedFilters.search);
    setIdentidadSelected(normalizedFilters.ids);
    setCiudadSelected(normalizedFilters.ciudades);
    setFActivo(normalizedFilters.activo);
    setFechaDesde(normalizedFilters.fechaDesde || "");
    setFechaHasta(normalizedFilters.fechaHasta || "");
  }, [normalizedFilters]);

  useEffect(() => {
    const missing = identidadSelected.filter((id) => !identityOptions.some((option) => option.id === id));
    if (missing.length === 0) return;
    const controller = new AbortController();
    let cancelled = false;

    async function loadMissing() {
      try {
        const params = new URLSearchParams();
        missing.forEach((id) => params.append("ids", id));
        const res = await fetch(`/api/beneficiarios/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("No se pudieron cargar los beneficiarios seleccionados");
        }
        const payload = await res.json();
        if (cancelled) return;
        const options = (payload.data || []).map((record: IdentityRecord) => toIdentityOption(record));
        setIdentityOptions((prev) => {
          const seen = new Set(prev.map((option) => option.id));
          const merged = [...prev];
          options.forEach((option: IdentityOption) => {
            if (!seen.has(option.id)) {
              seen.add(option.id);
              merged.push(option);
            }
          });
          return merged;
        });
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error cargando identidades seleccionadas", error);
      }
    }

    loadMissing();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [identidadSelected, identityOptions]);

  const normalizedAllCities = useMemo(() => {
    const fallbackCities = data.map((row) => row.paciente?.ciudad || "").filter(Boolean);
    return normalizeStringArray([...allCities, ...fallbackCities]);
  }, [allCities, data]);

  const identityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    identityOptions.forEach((option) => map.set(option.id, option.label));
    return map;
  }, [identityOptions]);

  const filteredCiudadOptions = useMemo(() => {
    if (!deferredCiudadSearch) return normalizedAllCities;
    const normalizedQuery = normalizeForSearch(deferredCiudadSearch);
    if (!normalizedQuery) return normalizedAllCities;
    return normalizedAllCities.filter((option) => normalizeForSearch(option).includes(normalizedQuery));
  }, [normalizedAllCities, deferredCiudadSearch]);

  const applyIdentityFilters = useCallback(
    (ids?: string[]) => {
      const normalizedIds = normalizeStringArray(ids ?? identidadSelected);
      if (arraysEqual(normalizedIds, localFilters.ids)) return;
      const nextFilters = {
        ...localFilters,
        ids: normalizedIds,
      };
      setLocalFilters(nextFilters);
      applyFiltersToQueryParams(nextFilters);
    },
    [applyFiltersToQueryParams, identidadSelected, localFilters]
  );

  const applyCityFilters = useCallback(
    (cities?: string[]) => {
      const normalizedCities = normalizeStringArray(cities ?? ciudadSelected);
      if (arraysEqual(normalizedCities, localFilters.ciudades)) return;
      const nextFilters = {
        ...localFilters,
        ciudades: normalizedCities,
      };
      setLocalFilters(nextFilters);
      applyFiltersToQueryParams(nextFilters);
    },
    [applyFiltersToQueryParams, ciudadSelected, localFilters]
  );

  const applyActivoFilter = useCallback(
    (value: "todos" | "si" | "no") => {
      if (value === localFilters.activo) return;
      const nextFilters = {
        ...localFilters,
        activo: value,
      };
      setLocalFilters(nextFilters);
      applyFiltersToQueryParams(nextFilters);
    },
    [applyFiltersToQueryParams, localFilters]
  );

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchDraft.trim();
    if (trimmed === (localFilters.search || "")) return;
    const nextFilters = {
      ...localFilters,
      search: trimmed,
    };
    setLocalFilters(nextFilters);
    applyFiltersToQueryParams(nextFilters);
  };

  const handleClearSearch = () => {
    if (!localFilters.search) return;
    const nextFilters = {
      ...localFilters,
      search: "",
    };
    setSearchDraft("");
    setLocalFilters(nextFilters);
    applyFiltersToQueryParams(nextFilters);
  };

  const applyDateFilters = useCallback(() => {
    if (
      (fechaDesde || "") === (localFilters.fechaDesde || "") &&
      (fechaHasta || "") === (localFilters.fechaHasta || "")
    ) {
      return;
    }
    const nextFilters = {
      ...localFilters,
      fechaDesde: fechaDesde || "",
      fechaHasta: fechaHasta || "",
    };
    setLocalFilters(nextFilters);
    applyFiltersToQueryParams(nextFilters);
  }, [applyFiltersToQueryParams, fechaDesde, fechaHasta, localFilters]);

  const clearDateFilters = () => {
    if (!(localFilters.fechaDesde || localFilters.fechaHasta)) return;
    setFechaDesde("");
    setFechaHasta("");
    const nextFilters = {
      ...localFilters,
      fechaDesde: "",
      fechaHasta: "",
    };
    setLocalFilters(nextFilters);
    applyFiltersToQueryParams(nextFilters);
  };

  const columns = useMemo<ColumnDef<TransportePrestacionListItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const selectableRows = table.getRowModel().rows.filter((row) => row.getCanSelect());
          const checked = selectableRows.length > 0 && selectableRows.every((row) => row.getIsSelected());
          const indeterminate =
            !checked && selectableRows.some((row) => row.getIsSelected()) ? "indeterminate" : false;
          return (
            <Checkbox
              aria-label="Seleccionar todos"
              checked={indeterminate || checked}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              disabled={selectableRows.length === 0}
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Seleccionar prestación"
            disabled={!row.getCanSelect()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "fecha",
        header: "Fecha",
        cell: ({ row }) => {
          const value = row.getValue<string>("fecha");
          const date = value ? new Date(value) : null;
          return date ? date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "-";
        },
      },
      {
        accessorKey: "sentido_transporte",
        header: "Sentido",
        cell: ({ row }) => formatSentido(row.getValue("sentido_transporte") as string | null),
      },
      {
        accessorKey: "paciente",
        header: "Beneficiario",
        cell: ({ row }) => {
          const paciente = row.getValue<TransportePrestacionListItem["paciente"]>("paciente");
          if (!paciente) return "-";
          return (
            <Link
              href={`/protected/beneficiarios/${paciente.id}`}
              className="underline-offset-4 hover:underline"
            >
              {`${paciente.apellido}, ${paciente.nombre}`}
            </Link>
          );
        },
      },
      {
        id: "paciente_documento",
        header: "DNI",
        accessorFn: (row) => row.paciente?.documento,
        cell: ({ row }) => row.original.paciente?.documento || "-",
      },
      {
        id: "paciente_ciudad",
        header: "Ciudad",
        accessorFn: (row) => row.paciente?.ciudad,
        cell: ({ row }) => row.original.paciente?.ciudad || "-",
      },
      {
        accessorKey: "prestador",
        header: "Transportista",
        cell: ({ row }) => {
          const prestador = row.getValue<TransportePrestacionListItem["prestador"]>("prestador");
          if (!prestador) return "-";
          return `${prestador.apellido ?? ""} ${prestador.nombre ?? ""}`.trim() || prestador.id;
        },
      },
      {
        accessorKey: "centro",
        header: "Centro",
        cell: ({ row }) => {
          const centro = row.getValue<TransportePrestacionListItem["centro"]>("centro");
          if (!centro) return "-";
          return centro.nombre || "-";
        },
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => {
          const estadoRaw = (row.getValue("estado") as string | null) || "-";
          const estado = estadoRaw.toLowerCase();
          let cls = "bg-muted text-foreground";
          if (estado === "pendiente") cls = "bg-yellow-100 text-yellow-800 border-yellow-200";
          if (estado === "completada") cls = "bg-green-100 text-green-800 border-green-200";
          if (estado === "cancelada") cls = "bg-red-100 text-red-800 border-red-200";
          return (
            <Badge variant="outline" className={`${cls} capitalize`}>
              {estadoRaw}
            </Badge>
          );
        },
      },
      {
        accessorKey: "cronico",
        header: "Crónica",
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
      },
      {
        accessorKey: "monto",
        header: "Monto",
        cell: ({ row }) => {
          const monto = row.getValue<number>("monto");
          if (monto == null) return "-";
          return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
          }).format(monto);
        },
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const prestacion = row.original;
          const estado = (prestacion.estado || "").toLowerCase();
          if (!canEdit || loading) {
            return (
              <Button size="icon" variant="outline" disabled title="No tenés permiso para editar" aria-disabled>
                <Pencil className="h-4 w-4" />
              </Button>
            );
          }

          const actions = (
            <div className="flex items-center gap-2">
              <Link href={`/protected/prestaciones/editar/${prestacion.id}`}>
                <Button size="icon" variant="outline" title="Editar prestación">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/protected/prestaciones/${prestacion.id}`}>
                <Button size="icon" variant="outline" title="Ver prestación">
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          );

          if (estado !== "pendiente") {
            return actions;
          }

          return (
            <div className="flex items-center gap-2">
              {actions}
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="icon" variant="destructive" title="Cancelar prestación">
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
                        <Button type="button" variant="outline">
                          Volver
                        </Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => {
                            startSelectionTransition(async () => {
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
                                router.refresh();
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
        },
      },
    ],
    [canEdit, isPending, loading, router, toast]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: (row) => ((row.original.estado || "").toLowerCase() === "pendiente"),
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
        pageSize: isServerPaginated ? data.length || pagination?.pageSize || 10 : 10,
      },
    },
  });

  useEffect(() => {
    if (!isServerPaginated) return;
    table.setPageIndex(Math.max(0, (pagination?.page ?? 1) - 1));
    table.setPageSize(data.length || pagination?.pageSize || 10);
  }, [data.length, isServerPaginated, pagination?.page, pagination?.pageSize, table]);

  const updateQueryParams = (next: { page?: number; pageSize?: number }) => {
    const current = new URLSearchParams(searchParams?.toString() ?? "");
    if (next.page !== undefined) {
      current.set("page", String(next.page));
    }
    if (next.pageSize !== undefined) {
      current.set("pageSize", String(next.pageSize));
    }
    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    startPaginationTransition(() => {
      router.refresh();
    });
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

  const selectedRows = table
    .getRowModel()
    .rows.filter((row) => row.getIsSelected())
    .map((row) => row.original);
  const selectedCount = selectedRows.length;
  const referenceRow = selectedRows[0];

  const allSamePrestador = selectedRows.every((row) => row.user_id === referenceRow?.user_id);
  const allSamePaciente = selectedRows.every((row) => row.paciente?.id === referenceRow?.paciente?.id);
  const allSameTipo = selectedRows.every((row) => row.sentido_transporte === referenceRow?.sentido_transporte);
  const allSameCronico = selectedRows.every((row) => Boolean(row.cronico) === Boolean(referenceRow?.cronico));

  const toDay = (fecha?: string) => {
    if (!fecha) return null;
    const d = new Date(fecha);
    return Number.isNaN(d.getTime()) ? null : d.getDay();
  };

  const toTime = (fecha?: string) => {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const referenceDay = toDay(referenceRow?.fecha);
  const referenceTime = toTime(referenceRow?.fecha);
  const allSameDay = selectedRows.every((row) => toDay(row.fecha) === referenceDay);
  const allSameTime = selectedRows.every((row) => toTime(row.fecha) === referenceTime);

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

  const formatLocalTimestamp = (date: Date) => {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 19);
  };

  const resetMassEditState = () => {
    setMassEditCronico(false);
    setMassEditCronicoMixed(false);
    setMassEditDay(null);
    setMassEditTime("");
    setMassEditMonto("");
  };

  const validateSelection = () => {
    if (selectedCount === 0) return false;

    if (!isValidSelection) {
      if (!allSamePrestador || !allSamePaciente) {
        setMassEditError("Seleccioná prestaciones del mismo prestador y beneficiario.");
      } else if (!allSameCronico) {
        setMassEditError("Todos deben compartir el mismo estado crónico.");
      } else if (!allSameTipo) {
        setMassEditError("Las prestaciones deben ser del mismo sentido de transporte.");
      } else {
        setMassEditError("Para cambiar día/hora, todas deben compartir la misma agenda.");
      }
      return false;
    }

    setMassEditError("");
    return true;
  };

  const prepareMassEditState = () => {
    if (!selectedRows.length) {
      resetMassEditState();
      return;
    }

    const firstValue = Boolean(selectedRows[0].cronico);
    const isMixed = selectedRows.some((row) => Boolean(row.cronico) !== firstValue);
    setMassEditCronico(isMixed ? false : firstValue);
    setMassEditCronicoMixed(isMixed);

    if (canEditSchedule && referenceRow) {
      setMassEditDay(referenceDay != null ? referenceDay.toString() : null);
      setMassEditTime(referenceTime ?? "");
      setMassEditMonto(referenceRow.monto != null ? referenceRow.monto.toString() : "");
    } else {
      setMassEditDay(null);
      setMassEditTime("");
      setMassEditMonto("");
    }
  };

  const handleMassEditClick = () => {
    if (validateSelection()) {
      prepareMassEditState();
    }
    setMassEditOpen(true);
  };

  const handleMassEditSave = () => {
    if (!selectedRows.length) return;

    const targetDayString = canEditSchedule && referenceRow
      ? massEditDay ?? new Date(referenceRow.fecha).getDay().toString()
      : null;
    const targetDay = targetDayString != null ? Number(targetDayString) : null;
    const trimmedTime = massEditTime.trim();
    const hasTimeChange = canEditSchedule && trimmedTime !== "";

    const montoNumber = canEditSchedule
      ? massEditMonto.trim() === ""
        ? referenceRow?.monto ?? null
        : Number(massEditMonto)
      : null;

    setMassEditSaving(true);
    setMassEditError(null);

    startSelectionTransition(async () => {
      try {
        for (const row of selectedRows) {
          if (!row.user_id) continue;

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
              const [hoursStr = "0", minutesStr = "0"] = trimmedTime.split(":");
              const hours = Math.min(23, Math.max(0, Number(hoursStr) || 0));
              const minutes = Math.min(59, Math.max(0, Number(minutesStr) || 0));
              newDate.setHours(hours, minutes, 0, 0);
            }

            payload.fecha = formatLocalTimestamp(newDate);
            payload.monto = montoNumber;
          }

          const res = await fetch(`/api/prestaciones/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            throw new Error("Error al actualizar una de las prestaciones");
          }
        }

        toast({
          title: "Prestaciones actualizadas",
          description: canEditSchedule
            ? "Se guardaron los cambios de día, horario, monto y estado crónico."
            : "Se actualizó el estado crónico de las prestaciones seleccionadas.",
        });
        setMassEditOpen(false);
        setRowSelection({});
        resetMassEditState();
        router.refresh();
      } catch (error) {
        console.error(error);
        setMassEditError("No se pudieron guardar los cambios. Intentalo nuevamente.");
      } finally {
        setMassEditSaving(false);
      }
    });
  };

  const handleMassCancelSave = () => {
    if (!selectedRows.length) return;
    setMassCancelSaving(true);
    setMassCancelError(null);

    startSelectionTransition(async () => {
      try {
        for (const row of selectedRows) {
          const { error } = await cancelPrestacion(row.id);
          if (error) {
            throw error;
          }
        }

        toast({
          title: "Prestaciones canceladas",
          description: "Las prestaciones seleccionadas fueron canceladas.",
        });
        setMassCancelOpen(false);
        setRowSelection({});
        router.refresh();
      } catch (error) {
        console.error(error);
        setMassCancelError("No se pudieron cancelar todas las prestaciones. Intentalo nuevamente.");
      } finally {
        setMassCancelSaving(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Prestaciones de transporte (últimos 2 meses)</h2>
          <p className="text-sm text-muted-foreground">Aplicá los mismos filtros que en Beneficiarios para encontrar prestaciones rápidamente.</p>
        </div>
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

      <form className="flex flex-wrap items-center gap-2" onSubmit={handleSearchSubmit}>
        <Input
          placeholder="Buscar beneficiario (nombre, apellido o DNI)"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="w-full flex-1"
        />
        <Button type="submit" disabled={searchDraft.trim() === (localFilters.search || "")}>Buscar</Button>
        <Button type="button" variant="ghost" onClick={handleClearSearch} disabled={!localFilters.search}>
          Limpiar
        </Button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="truncate text-left">
                {(() => {
                  if (identidadSelected.length === 0) return "Beneficiarios...";
                  if (identidadSelected.length === 1) {
                    return identityLabelMap.get(identidadSelected[0]) || "1 seleccionado";
                  }
                  return `${identidadSelected.length} seleccionados`;
                })()}
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 p-2">
            <div className="flex items-center gap-2 mb-2">
              <Input
                placeholder="Buscar nombre, apellido o documento"
                value={identidadSearch}
                onChange={(e) => setIdentidadSearch(e.target.value)}
                className="flex-1"
              />
              {identityLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {identityError && <p className="mb-2 text-xs text-destructive">{identityError}</p>}
            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {identityOptions.map(({ id, label }) => {
                const isChecked = identidadSelected.includes(id);
                return (
                  <label key={id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => {
                        setIdentidadSelected((current) => {
                          const next = isChecked ? current.filter((value) => value !== id) : [...current, id];
                          return next;
                        });
                      }}
                    />
                    <span className="truncate">{label}</span>
                  </label>
                );
              })}
              {!identityOptions.length && !identityLoading && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIdentidadSelected([])} disabled={identidadSelected.length === 0}>
                Limpiar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => applyIdentityFilters()}
                disabled={identityLoading || arraysEqual(normalizeStringArray(identidadSelected), localFilters.ids)}
              >
                Aplicar
              </Button>
              {identityHasMore && (
                <Button variant="outline" size="sm" onClick={() => fetchIdentityPage(identityPage + 1, true)} disabled={identityLoading}>
                  {identityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar más"}
                </Button>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {[
          {
            key: "ciudad",
            label: "Ciudades...",
            options: filteredCiudadOptions,
            search: ciudadSearch,
            setSearch: setCiudadSearch,
            total: normalizedAllCities.length,
            isDeferredEmpty: !deferredCiudadSearch,
            selected: ciudadSelected,
            setSelected: setCiudadSelected,
            applyFilters: applyCityFilters,
            originalValues: localFilters.ciudades,
          },
        ].map(({ key, label, options, search, setSearch, total, isDeferredEmpty, selected, setSelected, applyFilters, originalValues }) => {
          const handleClear = () => {
            setSelected([]);
            applyFilters([]);
          };
          const toggleOption = (option: string) => {
            setSelected((current) => {
              const exists = current.includes(option);
              const next = exists ? current.filter((value) => value !== option) : [...current, option];
              return next;
            });
          };

          return (
            <DropdownMenu key={key}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate text-left">
                    {(() => {
                      if (!selected.length) return label;
                      if (selected.length === 1) return selected[0];
                      return `${selected.length} seleccionados`;
                    })()}
                  </span>
                  <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-2">
                <Input
                  placeholder={`Buscar ${label.toLowerCase().replace("...", "")}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                  {options.map((option) => {
                    const isChecked = selected.includes(option);
                    return (
                      <label key={option} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleOption(option)} />
                        <span className="truncate">{option}</span>
                      </label>
                    );
                  })}
                  {options.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados</p>}
                  {total > FILTER_OPTION_LIMIT && isDeferredEmpty && !search.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Mostrando los primeros {FILTER_OPTION_LIMIT.toLocaleString()} resultados. Refiná la búsqueda para ver más.
                    </p>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={handleClear} disabled={selected.length === 0}>
                    Limpiar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => applyFilters(selected)}
                    disabled={arraysEqual(normalizeStringArray(selected), normalizeStringArray(originalValues))}
                  >
                    Aplicar
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}

        <Select
          value={fActivo}
          onValueChange={(value) => {
            const next = value as "todos" | "si" | "no";
            setFActivo(next);
            applyActivoFilter(next);
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

      <form className="grid grid-cols-1 md:grid-cols-5 gap-2" onSubmit={(e) => { e.preventDefault(); applyDateFilters(); }}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="fecha-desde">
            Fecha desde
          </label>
          <Input
            id="fecha-desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="fecha-hasta">
            Fecha hasta
          </label>
          <Input
            id="fecha-hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2 md:col-span-3">
          <Button type="submit" disabled={
            (fechaDesde || "") === (localFilters.fechaDesde || "") &&
            (fechaHasta || "") === (localFilters.fechaHasta || "")
          }>
            Aplicar rango
          </Button>
          <Button type="button" variant="ghost" onClick={clearDateFilters} disabled={!(localFilters.fechaDesde || localFilters.fechaHasta)}>
            Limpiar rango
          </Button>
        </div>
      </form>

      <DataTable table={table} isLoading={loading || isPaginationPending} />

      {isServerPaginated ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
          <div className="text-sm text-muted-foreground">
            {pagination?.total ? (
              <>
                Mostrando {firstItem.toLocaleString()} – {lastItem.toLocaleString()} de {pagination.total.toLocaleString()} fila(s)
              </>
            ) : (
              "Sin resultados"
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Mostrar:</span>
              <select
                value={pagination?.pageSize ?? PAGE_SIZE_OPTIONS[0]}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => goToPage(1)}
                disabled={!pagination || pagination.page <= 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => goToPage((pagination?.page || 1) - 1)}
                disabled={!pagination || pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[140px] text-center">
                Página {pagination?.page ?? 1} de {totalPages.toLocaleString()}
              </span>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => goToPage((pagination?.page || 1) + 1)}
                disabled={!pagination || pagination.page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => goToPage(totalPages)}
                disabled={!pagination || pagination.page >= totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <DataTablePagination table={table} showSelectedCount={false} showPageNumbers />
      )}

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" className="bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={handleMassEditClick}>
            <Pencil className="mr-2 h-4 w-4" /> Editar {selectedCount} seleccionadas
          </Button>
          <Button variant="destructive" onClick={() => setMassCancelOpen(true)}>
            <XCircle className="mr-2 h-4 w-4" /> Cancelar {selectedCount} seleccionadas
          </Button>

          <Dialog open={massEditOpen} onOpenChange={setMassEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar {selectedCount} prestaciones</DialogTitle>
                {massEditError ? (
                  <div className="text-red-600 text-sm">{massEditError}</div>
                ) : (
                  <DialogDescription>
                    {canEditSchedule
                      ? "Podés ajustar el día, horario, monto y el estado crónico."
                      : "Esta selección permite cambiar únicamente el estado crónico."}
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
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>Nuevo día de la semana</Label>
                        <Select value={massEditDay ?? ""} onValueChange={(day) => setMassEditDay(day)}>
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
                          onChange={(event) => setMassEditMonto(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Hora</Label>
                        <Input
                          type="time"
                          value={massEditTime}
                          onChange={(event) => setMassEditTime(event.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMassEditOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleMassEditSave} disabled={massEditSaving}>
                      {massEditSaving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={massCancelOpen} onOpenChange={setMassCancelOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar {selectedCount} prestaciones</DialogTitle>
                <DialogDescription>
                  Esta acción cambiará el estado de todas las prestaciones seleccionadas a <b>cancelada</b>. ¿Deseás continuar?
                </DialogDescription>
              </DialogHeader>
              {massCancelError && <div className="text-red-600 text-sm">{massCancelError}</div>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMassCancelOpen(false)}>
                  Volver
                </Button>
                <Button variant="destructive" disabled={massCancelSaving} onClick={handleMassCancelSave}>
                  {massCancelSaving ? "Cancelando..." : "Confirmar cancelación"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
