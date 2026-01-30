"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { transportePrestacionFormSchema, type TransportePrestacionFormValues } from "@/lib/validations/transporte-prestacion";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { CloneCronicasButton } from "@/components/beneficiarios/CloneCronicasButton";
import { ChevronDown } from "lucide-react";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
  documento?: string;
  tiene_ubicacion: boolean;
};

type BeneficiarioSearchRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  documento: string | null;
  activo: boolean | null;
  ubicacion?: unknown | null;
};

type Prestador = { id: string; nombre: string; apellido: string; documento?: string };

type Centro = { id: string; nombre: string; tipo?: string };

export function TransportePrestacionForm({
  pacientes,
  prestadores,
  centros,
}: {
  pacientes: Paciente[];
  prestadores: Prestador[];
  centros: Centro[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkStart, setBulkStart] = useState<string>("");
  const [bulkEnd, setBulkEnd] = useState<string>("");
  const [bulkHour, setBulkHour] = useState<string>("");
  const [bulkWeekdays, setBulkWeekdays] = useState<{ [k: string]: boolean }>({
    lun: true,
    mar: false,
    mie: true,
    jue: false,
    vie: true,
    sab: false,
    dom: false,
  });
  const [generatedDates, setGeneratedDates] = useState<string[]>([]);
  const [fPaciente, setFPaciente] = useState<string>("");
  const [pacienteMenuOpen, setPacienteMenuOpen] = useState(false);
  const [visiblePacientesCount, setVisiblePacientesCount] = useState(20);

  const deferredPacienteQuery = useDeferredValue(fPaciente.trim());
  const pacientesAbortRef = useRef<AbortController | null>(null);
  const pacientesCacheRef = useRef<Map<string, Paciente>>(new Map());
  const [pacientesOptions, setPacientesOptions] = useState<Paciente[]>(pacientes.slice(0, 20));
  const [pacientesPage, setPacientesPage] = useState(1);
  const [pacientesHasMore, setPacientesHasMore] = useState(false);
  const [pacientesLoading, setPacientesLoading] = useState(false);

  const pacientesFiltrados = pacientesOptions;

  const fetchPacientesPage = (pageToLoad: number, append: boolean) => {
    pacientesAbortRef.current?.abort();
    const controller = new AbortController();
    pacientesAbortRef.current = controller;
    setPacientesLoading(true);

    const params = new URLSearchParams({
      page: String(pageToLoad),
      pageSize: "20",
      includeInactivos: "true",
    });
    if (deferredPacienteQuery) {
      params.set("query", deferredPacienteQuery);
    }

    fetch(`/api/beneficiarios/search?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la búsqueda de beneficiarios"))))
      .then((payload) => {
        const rows: BeneficiarioSearchRow[] = payload.data || [];
        const mapped: Paciente[] = rows.map((row) => ({
          id: row.id,
          nombre: row.nombre || "",
          apellido: row.apellido || "",
          documento: row.documento || undefined,
          tiene_ubicacion: Boolean((row as any).ubicacion),
        }));

        mapped.forEach((p) => pacientesCacheRef.current.set(p.id, p));

        setPacientesOptions((prev) => {
          if (!append) return mapped;
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          mapped.forEach((p) => {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              merged.push(p);
            }
          });
          return merged;
        });

        const total = typeof payload.total === "number" ? payload.total : 0;
        const resolvedPage = typeof payload.page === "number" ? payload.page : pageToLoad;
        const resolvedPageSize = typeof payload.pageSize === "number" ? payload.pageSize : 20;
        setPacientesPage(resolvedPage);
        setPacientesHasMore(total ? resolvedPage * resolvedPageSize < total : mapped.length === 20);
      })
      .catch((e: any) => {
        if (e?.name !== "AbortError") {
          console.error("Error buscando beneficiarios", e);
        }
      })
      .finally(() => {
        if (pacientesAbortRef.current === controller) {
          pacientesAbortRef.current = null;
        }
        setPacientesLoading(false);
      });
  };

  useEffect(() => {
    if (!pacienteMenuOpen) return;

    fetchPacientesPage(1, false);
  }, [pacienteMenuOpen, deferredPacienteQuery]);

  useEffect(() => {
    return () => {
      pacientesAbortRef.current?.abort();
    };
  }, []);

  function toISO(dtLocal: string) {
    try {
      return new Date(dtLocal).toISOString();
    } catch {
      return "";
    }
  }

  function generateDates() {
    const out: string[] = [];
    if (!bulkStart || !bulkEnd || !bulkHour) {
      setGeneratedDates([]);
      return;
    }

    const start = new Date(`${bulkStart}T00:00:00`);
    const end = new Date(`${bulkEnd}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      setGeneratedDates([]);
      return;
    }

    const chosen = new Set<number>();
    if (bulkWeekdays.dom) chosen.add(0);
    if (bulkWeekdays.lun) chosen.add(1);
    if (bulkWeekdays.mar) chosen.add(2);
    if (bulkWeekdays.mie) chosen.add(3);
    if (bulkWeekdays.jue) chosen.add(4);
    if (bulkWeekdays.vie) chosen.add(5);
    if (bulkWeekdays.sab) chosen.add(6);

    const [hh, mm] = bulkHour.split(":").map(Number);
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      if (chosen.has(d.getDay())) {
        const dt = new Date(d);
        dt.setHours(hh || 0, mm || 0, 0, 0);
        out.push(dt.toISOString());
        if (out.length >= 60) break;
      }
    }

    setGeneratedDates(out);
  }

  const form = useForm<TransportePrestacionFormValues>({
    resolver: zodResolver(transportePrestacionFormSchema),
    defaultValues: {
      paciente_id: "",
      user_id: "",
      centro_id: "",
      sentido: "ida",
      fecha: "",
      cronico: false,
      monto: undefined,
      descripcion: "",
      notas: "",
    },
  });

  const sentido = form.watch("sentido");
  const pacienteId = form.watch("paciente_id");
  const loading = form.formState.isSubmitting;

  const onSubmit = async (values: TransportePrestacionFormValues) => {
    const selectedPaciente = pacientesCacheRef.current.get(values.paciente_id) || pacientes.find((p) => p.id === values.paciente_id);
    if (!selectedPaciente?.tiene_ubicacion) {
      toast({
        title: "No se pudo guardar",
        description: "El beneficiario seleccionado no tiene geolocalización. Asignala antes de crear la prestación.",
        variant: "destructive",
      });
      return;
    }

    const body = bulkMode
      ? {
          common: {
            paciente_id: values.paciente_id,
            user_id: values.user_id,
            centro_id: values.centro_id,
            sentido: values.sentido,
            cronico: values.cronico ?? false,
            monto: values.monto,
            descripcion: values.descripcion,
            notas: values.notas,
          },
          fechas: generatedDates,
        }
      : {
          ...values,
          fecha: values.fecha ? toISO(values.fecha) : new Date().toISOString(),
        };

    const res = await fetch("/api/transporte/prestaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.json().catch(() => ({} as any));
      toast({
        title: "No se pudo guardar",
        description: t?.error || t?.message || `Error guardando prestación (${res.status})`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: bulkMode ? "Prestaciones de transporte creadas" : "Prestación de transporte creada",
      description: bulkMode ? `Se crearon ${generatedDates.length}${values.sentido === "ida_y_vuelta" ? " (x2 por ida/vuelta)" : ""} fechas.` : undefined,
    });
    router.push("/protected/prestaciones");
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 flex items-center justify-between">
            <div className="text-sm font-medium">Modo masivo</div>
            <Switch checked={bulkMode} onCheckedChange={setBulkMode} disabled={loading} />
          </div>

          {bulkMode && (
            <>
              <FormItem>
                <FormLabel>Inicio</FormLabel>
                <FormControl>
                  <Input type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} disabled={loading} />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Fin</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    disabled={loading}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Hora</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    value={bulkHour}
                    onChange={(e) => setBulkHour(e.target.value)}
                    disabled={loading}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Días</FormLabel>
                <FormControl>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        ["lun", "Lun"],
                        ["mar", "Mar"],
                        ["mie", "Mié"],
                        ["jue", "Jue"],
                        ["vie", "Vie"],
                        ["sab", "Sáb"],
                        ["dom", "Dom"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!bulkWeekdays[key]}
                          onChange={(e) => setBulkWeekdays((prev) => ({ ...prev, [key]: e.target.checked }))}
                          disabled={loading}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={generateDates} disabled={loading}>
                  Generar fechas
                </Button>
              </div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                {generatedDates.length ? `Fechas generadas: ${generatedDates.length}` : "Generá fechas antes de guardar."}
              </div>
            </>
          )}

          <FormField
            control={form.control}
            name="paciente_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beneficiario</FormLabel>
                <FormControl>
                  <DropdownMenu
                    open={pacienteMenuOpen}
                    onOpenChange={(open) => {
                      setPacienteMenuOpen(open);
                      if (open) {
                        setVisiblePacientesCount(20);
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading}
                        className="w-full justify-between h-10 rounded-md border border-input bg-background px-3 text-sm font-normal hover:bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={field.value ? "" : "text-muted-foreground"}>
                          {(() => {
                            const p = pacientesCacheRef.current.get(field.value) || pacientes.find((p) => p.id === field.value);
                            return p ? `${p.apellido}, ${p.nombre}` : "Seleccionar beneficiario";
                          })()}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-96 p-2">
                      <Input
                        placeholder="Buscar beneficiario (Apellido Nombre o DNI)"
                        value={fPaciente}
                        onChange={(e) => {
                          setFPaciente(e.target.value);
                          setVisiblePacientesCount(20);
                        }}
                        className="mb-2"
                        disabled={loading}
                      />

                      <div
                        className="max-h-60 overflow-y-auto"
                        onScroll={(e) => {
                          const el = e.currentTarget;
                          const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
                          if (nearBottom && pacientesHasMore && !pacientesLoading) {
                            fetchPacientesPage(pacientesPage + 1, true);
                          }
                        }}
                      >
                        {pacientesFiltrados.slice(0, visiblePacientesCount).map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              onClick={() => {
                                field.onChange(p.id);
                              }}
                            >
                              {p.apellido}, {p.nombre}
                              {p.documento ? ` - DNI ${p.documento}` : ""}
                            </DropdownMenuItem>
                          ))}
                        {pacientesLoading && (
                          <DropdownMenuItem disabled>Cargando...</DropdownMenuItem>
                        )}
                        {!pacientesFiltrados.length && !pacientesLoading && (
                          <DropdownMenuItem disabled>Sin resultados</DropdownMenuItem>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="md:col-span-2 flex items-center justify-between">
            <div className="text-sm font-medium">Crónico</div>
            <FormField
              control={form.control}
              name="cronico"
              render={({ field }) => (
                <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={loading} />
              )}
            />
          </div>

          {pacienteId ? (
            <div className="md:col-span-2">
              <CloneCronicasButton pacienteId={pacienteId} eligibleCount={0} />
            </div>
          ) : null}

          <FormField
            control={form.control}
            name="centro_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Centro de tratamiento</FormLabel>
                <FormControl>
                  <Select value={field.value || ""} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={centros.length ? "Seleccionar centro" : "No hay centros activos"} />
                    </SelectTrigger>
                    <SelectContent>
                      {centros.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sentido"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sentido</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar sentido" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ida">Ida (domicilio → centro)</SelectItem>
                      <SelectItem value="vuelta">Vuelta (centro → domicilio)</SelectItem>
                      <SelectItem value="ida_y_vuelta">Ida y vuelta</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="user_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transportista</FormLabel>
                <FormControl>
                  <Select value={field.value || ""} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={prestadores.length ? "Seleccionar transportista" : "No hay transportistas"} />
                    </SelectTrigger>
                    <SelectContent>
                      {prestadores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.apellido}, {p.nombre}{p.documento ? ` - DNI ${p.documento}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input type="datetime-local" value={field.value || ""} onChange={field.onChange} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="monto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    value={(field.value as any) ?? ""}
                    onChange={field.onChange}
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="descripcion"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Input value={field.value || ""} onChange={field.onChange} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notas"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Notas</FormLabel>
                <FormControl>
                  <Textarea value={field.value || ""} onChange={field.onChange} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
