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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Pencil,
  UserX,
  RotateCcw,
  Loader2,
  MoreHorizontal,
  ChevronDown,
  Eye,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canCreateOrEditPaciente, canToggleBeneficiario } from "@/utils/permissions";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  direccion_completa: string;
  ciudad: string | null;
  provincia: string | null;
  activo: boolean | null;
  tiene_ubicacion?: boolean | null;
};

interface ServerPaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

type BeneficiarioFilters = {
  search: string;
  ids: string[];
  ciudades: string[];
  activo: "todos" | "si" | "no";
};

const EMPTY_FILTERS: BeneficiarioFilters = {
  search: "",
  ids: [],
  ciudades: [],
  activo: "todos",
};

interface BeneficiariosTableProps {
  data: Paciente[];
  pagination?: ServerPaginationInfo;
  filters?: BeneficiarioFilters;
  allCities?: string[];
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];
const FILTER_OPTION_LIMIT = 250;
const IDENTITY_PAGE_SIZE = 25;

type IdentityOption = {
  id: string;
  label: string;
  raw: {
    nombre: string | null;
    apellido: string | null;
    documento: string | null;
    activo: boolean | null;
  };
};

type IdentityRecord = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  documento: string | null;
  activo: boolean | null;
};

const formatIdentityLabel = (record: IdentityRecord) => {
  const nombreCompleto = [record.apellido, record.nombre].filter(Boolean).join(", ");
  const documento = record.documento ? ` · DNI ${record.documento}` : "";
  return `${nombreCompleto || "Sin datos"}${documento}`;
};

const toIdentityOption = (record: IdentityRecord): IdentityOption => ({
  id: record.id,
  label: formatIdentityLabel(record),
  raw: {
    nombre: record.nombre,
    apellido: record.apellido,
    documento: record.documento,
    activo: record.activo,
  },
});

const normalizeStringArray = (values: string[] = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const normalizeForSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function BeneficiariosTable({
  data,
  pagination,
  filters,
  allCities = [],
}: BeneficiariosTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { roles, loading } = useBackofficeRoles();
  const canEdit = canCreateOrEditPaciente(roles);
  const canToggle = canToggleBeneficiario(roles);
  const isServerPaginated = Boolean(pagination);
  const [isPaginationPending, startPaginationTransition] = useTransition();
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize || 1)) : 1;

  const filtersSignature = useMemo(
    () =>
      [
        filters?.search ?? "",
        normalizeStringArray(filters?.ids || []).join("|"),
        normalizeStringArray(filters?.ciudades || []).join("|"),
        filters?.activo ?? "todos",
      ].join("::"),
    [filters]
  );

  const normalizedFilters = useMemo<BeneficiarioFilters>(
    () => ({
      ...EMPTY_FILTERS,
      ...(filters || {}),
      ids: normalizeStringArray(filters?.ids || []),
      ciudades: normalizeStringArray(filters?.ciudades || []),
    }),
    [filtersSignature]
  );

  const [localFilters, setLocalFilters] = useState<BeneficiarioFilters>(normalizedFilters);
  const [searchDraft, setSearchDraft] = useState(normalizedFilters.search);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [fActivo, setFActivo] = useState<"todos" | "si" | "no">(normalizedFilters.activo);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState<Paciente | null>(null);
  const [identidadSearch, setIdentidadSearch] = useState("");
  const [identidadSelected, setIdentidadSelected] = useState<string[]>(normalizedFilters.ids);
  const [ciudadSearch, setCiudadSearch] = useState("");
  const [ciudadSelected, setCiudadSelected] = useState<string[]>(normalizedFilters.ciudades);
  const [identityOptions, setIdentityOptions] = useState<IdentityOption[]>([]);
  const [identityPage, setIdentityPage] = useState(1);
  const [identityHasMore, setIdentityHasMore] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [selectedIdentityMap, setSelectedIdentityMap] = useState<Map<string, IdentityOption>>(new Map());

  const deferredIdentidadSearch = useDeferredValue(identidadSearch.trim().toLowerCase());
  const deferredCiudadSearch = useDeferredValue(ciudadSearch.trim().toLowerCase());
  const deferredIdentityQuery = useDeferredValue(identidadSearch.trim());
  const identityAbortRef = useRef<AbortController | null>(null);

  const applyFiltersToQueryParams = useCallback(
    (nextFilters: BeneficiarioFilters) => {
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

      params.set("page", "1");
      if (pagination?.pageSize) {
        params.set("pageSize", String(pagination.pageSize));
      }

      try {
        localStorage.setItem(
          "beneficiarios_filters",
          JSON.stringify({
            search: nextFilters.search,
            ids: nextFilters.ids,
            ciudades: nextFilters.ciudades,
            activo: nextFilters.activo,
          })
        );
      } catch {}

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    },
    [pagination?.pageSize, pathname, router, searchParams]
  );

  useEffect(() => {
    const hasFilterParams =
      searchParams?.has("search") ||
      searchParams?.has("ids") ||
      searchParams?.has("ciudades") ||
      searchParams?.has("activo");
    if (hasFilterParams) return;
    try {
      const saved = localStorage.getItem("beneficiarios_filters");
      if (!saved) return;
      const parsed: BeneficiarioFilters = JSON.parse(saved);
      const hasAny =
        parsed.search ||
        parsed.ids?.length ||
        parsed.ciudades?.length ||
        (parsed.activo && parsed.activo !== "todos");
      if (!hasAny) return;
      const p = new URLSearchParams();
      if (parsed.search) p.set("search", parsed.search);
      (parsed.ids || []).forEach((id) => p.append("ids", id));
      (parsed.ciudades || []).forEach((c) => p.append("ciudades", c));
      if (parsed.activo && parsed.activo !== "todos")
        p.set("activo", parsed.activo);
      router.replace(`${pathname}?${p.toString()}`);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setSelectedIdentityMap((prev) => {
          const next = new Map(prev);
          options.forEach((option: IdentityOption) => {
            if (!next.has(option.id)) {
              next.set(option.id, option);
            }
          });
          return next;
        });
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
    setSelectedIdentityMap((prev) => {
      if (!normalizedFilters.ids.length) {
        return new Map();
      }
      const next = new Map<string, IdentityOption>();
      normalizedFilters.ids.forEach((id) => {
        const option = prev.get(id);
        if (option) {
          next.set(id, option);
        }
      });
      return next;
    });
  }, [normalizedFilters]);

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

  
  useEffect(() => {
    const missing = identidadSelected.filter((id) => !selectedIdentityMap.has(id));
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
        setSelectedIdentityMap((prev) => {
          const next = new Map(prev);
          options.forEach((option: IdentityOption) => next.set(option.id, option));
          return next;
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
  }, [identidadSelected, selectedIdentityMap]);

  const normalizedAllCities = useMemo(() => {
    const fallbackCities = data.map((row) => row.ciudad || "").filter(Boolean);
    return normalizeStringArray([...allCities, ...fallbackCities]);
  }, [allCities, data]);

  const identityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    identityOptions.forEach((option: IdentityOption) => map.set(option.id, option.label));
    selectedIdentityMap.forEach((option: IdentityOption, id) => map.set(id, option.label));
    return map;
  }, [identityOptions, selectedIdentityMap]);

  const identitySelectableOptions = useMemo(() => {
    const seen = new Set(identityOptions.map((option) => option.id));
    const merged = [...identityOptions];
    identidadSelected.forEach((id) => {
      if (!seen.has(id)) {
        const option = selectedIdentityMap.get(id);
        if (option) {
          merged.unshift(option);
          seen.add(id);
        }
      }
    });
    return merged;
  }, [identityOptions, identidadSelected, selectedIdentityMap]);

  const filteredCiudadOptions = useMemo(() => {
    if (!deferredCiudadSearch) return normalizedAllCities;
    const normalizedQuery = normalizeForSearch(deferredCiudadSearch);
    if (!normalizedQuery) return normalizedAllCities;
    return normalizedAllCities.filter((option) =>
      normalizeForSearch(option).includes(normalizedQuery)
    );
  }, [normalizedAllCities, deferredCiudadSearch]);

  const tableData = useMemo(() => {
    if (isServerPaginated || !identidadSelected.length) return data;
    return data.filter((paciente) => identidadSelected.includes(paciente.id));
  }, [data, identidadSelected, isServerPaginated]);

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
      id: "tiene_ubicacion",
      header: "Geo",
      enableColumnFilter: false,
      enableSorting: false,
      cell: ({ row }) => {
        const hasLocation = Boolean(row.original.tiene_ubicacion);
        return (
          <div className="flex justify-center">
            <span
              className="inline-flex"
              title={hasLocation ? "Con geolocalización" : "Sin geolocalización"}
            >
              <MapPin
                className={`h-4 w-4 ${hasLocation ? "text-emerald-600" : "text-muted-foreground/60"}`}
                aria-label={hasLocation ? "Con geolocalización" : "Sin geolocalización"}
              />
            </span>
          </div>
        );
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
    manualPagination: isServerPaginated,
    pageCount: isServerPaginated ? totalPages : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
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
    table.setPageSize(tableData.length || pagination?.pageSize || 10);
  }, [isServerPaginated, pagination?.page, pagination?.pageSize, table, tableData.length]);

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
              {identitySelectableOptions.map(({ id, label }) => {
                const isChecked = identidadSelected.includes(id);
                return (
                  <label key={id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => {
                        setIdentidadSelected((current) => {
                          const next = isChecked
                            ? current.filter((item) => item !== id)
                            : [...current, id];
                          return next;
                        });
                      }}
                    />
                    <span className="truncate">{label}</span>
                  </label>
                );
              })}
              {!identitySelectableOptions.length && !identityLoading && (
                <p className="text-sm text-muted-foreground">Sin resultados</p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIdentidadSelected([])}
                disabled={identidadSelected.length === 0}
              >
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchIdentityPage(identityPage + 1, true)}
                  disabled={identityLoading}
                >
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
        ].map(
          ({
            key,
            label,
            options,
            search,
            setSearch,
            total,
            isDeferredEmpty,
            selected,
            setSelected,
            applyFilters,
            originalValues,
          }) => {
            const column = table.getColumn(key);
            const toggleOption = (option: string) => {
              setSelected((current) => {
                const exists = current.includes(option);
                const next = exists ? current.filter((value) => value !== option) : [...current, option];
                column?.setFilterValue(next.length ? next : undefined);
                return next;
              });
            };
            const handleClear = () => {
              setSelected([]);
              column?.setFilterValue(undefined);
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
                        Mostrando los primeros {FILTER_OPTION_LIMIT.toLocaleString()} resultados. Refiná la búsqueda
                        para ver más.
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
          }
        )}
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

      <DataTable table={table} isLoading={loading || isPaginationPending} />
      
      {isServerPaginated ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
          <div className="text-sm text-muted-foreground">
            {pagination?.total ? (
              <>
                Mostrando {firstItem.toLocaleString()} – {lastItem.toLocaleString()} de{" "}
                {pagination.total.toLocaleString()} fila(s)
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
