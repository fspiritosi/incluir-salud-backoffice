"use client";

import { useCallback, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  LineChart,
  ListTodo,
  XCircle,
} from "lucide-react";
import {
  ColumnDef,
  SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { DashboardStats } from "@/actions/dashboard-actions";
import type { DashboardPeriod } from "@/lib/dashboard-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const estadoLabel = (estado: string | null) => (estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : "Pendiente");

const formatPersona = (persona?: { apellido?: string | null; nombre?: string | null; documento?: string | null }) => {
  if (!persona) return "Sin asignar";
  const nombre = [persona.apellido, persona.nombre].filter(Boolean).join(", ").trim();
  if (persona.documento) {
    return `${nombre} · DNI ${persona.documento}`;
  }
  return nombre || "Sin datos";
};

const formatFecha = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch (error) {
    return iso;
  }
};

type PrestacionDetalle = DashboardStats["prestacionesDetalle"][number];
type CardId = "total" | "completadas" | "porcentaje" | "monto" | "canceladas";

type CardConfig = {
  id: CardId;
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  accentClasses: string;
  filter: (row: DashboardStats["prestacionesDetalle"][number]) => boolean;
};

const PERIOD_TABS: { id: DashboardPeriod; label: string }[] = [
  { id: "day", label: "Hoy" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "quarter", label: "Trimestre" },
  { id: "semester", label: "Semestre" },
  { id: "year", label: "Año" },
  { id: "custom", label: "Personalizado" },
];

export function StatsCards({ initialStats }: { initialStats: DashboardStats }) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [period, setPeriod] = useState<DashboardPeriod>(initialStats.range.period);
  const [customRange, setCustomRange] = useState(() => ({
    start: initialStats.range.start.slice(0, 10),
    end: initialStats.range.end.slice(0, 10),
  }));
  const prestaciones = stats.prestacionesDetalle ?? [];
  const [activeCard, setActiveCard] = useState<CardId | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "fecha", desc: true }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(
    async (nextPeriod: DashboardPeriod, rangeOverride?: { start: string; end: string }) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (nextPeriod === "custom" && rangeOverride) {
          params.set("start", rangeOverride.start);
          params.set("end", rangeOverride.end);
        } else {
          params.set("period", nextPeriod);
        }

        const response = await fetch(`/api/dashboard-stats?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data: DashboardStats = await response.json();
        setStats(data);
        setPeriod(data.range.period);
        setCustomRange({
          start: data.range.start.slice(0, 10),
          end: data.range.end.slice(0, 10),
        });
      } catch (err) {
        console.error("Error fetching dashboard stats", err);
        setError("No se pudieron cargar los datos para este periodo. Intentalo nuevamente.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleTabChange = (value: string) => {
    const nextPeriod = value as DashboardPeriod;
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") {
      fetchStats(nextPeriod);
    }
  };

  const handleApplyCustomRange = () => {
    if (!customRange.start || !customRange.end) {
      setError("Seleccioná fechas de inicio y fin válidas.");
      return;
    }

    if (customRange.start > customRange.end) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    setPeriod("custom");
    fetchStats("custom", customRange);
  };

  const cards = useMemo<CardConfig[]>(() => {
    const currencyFormatter = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });

    const normalizeEstado = (estado?: string | null) => (estado || "").toLowerCase();

    return [
      {
        id: "total",
        label: "Total",
        value: stats.total.toString(),
        helper: "Prestaciones registradas en el rango",
        icon: ListTodo,
        accentClasses: "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
        filter: () => true,
      },
      {
        id: "completadas",
        label: "Completadas",
        value: stats.completadas.toString(),
        helper: "Prestaciones finalizadas",
        icon: CheckCircle2,
        accentClasses: "border border-green-100 dark:border-green-900 bg-green-50 dark:bg-green-900/20",
        filter: row => normalizeEstado(row.estado) === "completada",
      },
      {
        id: "porcentaje",
        label: "Porcentaje completadas",
        value: `${stats.porcentajeCompletado}%`,
        helper: "Relación completadas vs total",
        icon: LineChart,
        accentClasses: "border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20",
        filter: row => normalizeEstado(row.estado) === "completada",
      },
      {
        id: "monto",
        label: "Monto total",
        value: currencyFormatter.format(stats.montoTotal),
        helper: "Suma de montos registrados",
        icon: DollarSign,
        accentClasses: "border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-900/20",
        filter: row => Number(row.monto ?? 0) > 0,
      },
      {
        id: "canceladas",
        label: "Canceladas",
        value: stats.canceladas.toString(),
        helper: "Prestaciones canceladas",
        icon: XCircle,
        accentClasses: "border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-900/20",
        filter: row => normalizeEstado(row.estado) === "cancelada",
      },
    ];
  }, [stats]);

  const selectedCard = cards.find(card => card.id === activeCard) ?? null;
  const filteredRows = useMemo(() => {
    if (!selectedCard) return [];
    return prestaciones.filter(selectedCard.filter);
  }, [selectedCard, prestaciones]);

  const detailColumns = useMemo<ColumnDef<PrestacionDetalle>[]>(
    () => [
      {
        accessorKey: "fecha",
        header: "Fecha",
        cell: ({ row }) => formatFecha(row.original.fecha),
      },
      {
        accessorKey: "paciente",
        header: "Paciente",
        cell: ({ row }) => (row.original.paciente ? formatPersona(row.original.paciente) : "Sin asignar"),
      },
      {
        accessorKey: "prestador",
        header: "Prestador",
        cell: ({ row }) => (row.original.prestador ? formatPersona(row.original.prestador) : "Sin asignar"),
      },
      {
        accessorKey: "tipo_prestacion",
        header: "Tipo",
        cell: ({ row }) => <span className="font-medium">{row.original.tipo_prestacion}</span>,
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => <Badge variant="outline">{estadoLabel(row.original.estado || null)}</Badge>,
      },
      {
        accessorKey: "monto",
        header: () => <span className="block text-right">Monto</span>,
        cell: ({ row }) => (
          <span className="block text-right">
            {row.original.monto != null
              ? new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                }).format(row.original.monto)
              : "-"}
          </span>
        ),
      },
    ],
    []
  );

  const detailTable = useReactTable({
    data: filteredRows,
    columns: detailColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="space-y-4">
        <Tabs value={period} onValueChange={handleTabChange} className="w-full">
          <div className="flex flex-col gap-3">
            <TabsList className="flex flex-wrap gap-2">
              {PERIOD_TABS.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="flex-1 basis-[120px]">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="custom">
              <div className="flex flex-wrap items-end gap-4 rounded-lg border border-dashed p-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">Desde</label>
                  <Input
                    type="date"
                    value={customRange.start}
                    onChange={event => setCustomRange(prev => ({ ...prev, start: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">Hasta</label>
                  <Input
                    type="date"
                    value={customRange.end}
                    onChange={event => setCustomRange(prev => ({ ...prev, end: event.target.value }))}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleApplyCustomRange}
                  disabled={!customRange.start || !customRange.end || loading}
                >
                  Aplicar rango
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Mostrando datos de: <strong className="text-foreground">{stats.range.label}</strong></span>
          {loading && <span className="text-primary">Actualizando…</span>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveCard(card.id)}
              className={`relative flex h-full flex-col rounded-lg p-6 pt-7 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${card.accentClasses}`}
            >
              <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/80 text-primary dark:border-white/20 dark:bg-white/10">
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0 space-y-1.5 pr-12">
                <p className="text-sm text-muted-foreground truncate" title={card.label}>{card.label}</p>
                <p className="text-3xl font-semibold leading-tight">{card.value}</p>
              </div>
              <p className="mt-4 min-h-[40px] text-sm text-muted-foreground">{card.helper}</p>
              <div className="mt-auto inline-flex items-center text-sm font-medium text-primary">
                Ver detalle
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selectedCard} onOpenChange={open => !open && setActiveCard(null)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden p-0">
          <div className="flex h-full max-h-[90vh] flex-col">
            <div className="px-6 pt-6 pb-4">
              <DialogHeader>
                <DialogTitle>{selectedCard?.label}</DialogTitle>
                <DialogDescription>
                  {selectedCard
                    ? `${filteredRows.length} prestación(es) encontradas para este indicador.`
                    : "Seleccioná una tarjeta para ver el detalle correspondiente."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 min-h-0 px-6">
              <div className="max-h-[60vh] overflow-auto rounded-md border">
                <div className="min-w-[1000px]">
                  <DataTable table={detailTable} />
                </div>
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 space-y-4">
              <DataTablePagination table={detailTable} showSelectedCount={false} showTotalCount={true} />
              <DialogFooter className="p-0 justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cerrar
                  </Button>
                </DialogClose>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
