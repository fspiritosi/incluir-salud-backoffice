"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Users, Calendar, AlertCircle } from "lucide-react";
import { getPacientesDeCentro, createPrestacionesPorCentro } from "../../actions";

type Centro = { id: string; nombre: string };
type Prestador = { id: string; nombre: string; apellido: string; documento?: string };

type Props = {
  centros: Centro[];
  prestadores: Prestador[];
};

export default function CrearPorCentroForm({ centros, prestadores }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [centroId, setCentroId] = useState("");
  const [prestadorId, setPrestadorId] = useState("");
  const [monto, setMonto] = useState("");
  const [cronico, setCronico] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [notas, setNotas] = useState("");

  const [pacientesCount, setPacientesCount] = useState<number | null>(null);
  const [loadingPacientes, setLoadingPacientes] = useState(false);

  // Modo de fechas
  const [bulkModeType, setBulkModeType] = useState<"cada-n" | "dias-semana">("dias-semana");
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [bulkHour, setBulkHour] = useState("09:00");
  const [bulkIntervalDays, setBulkIntervalDays] = useState(1);
  const [bulkCount, setBulkCount] = useState(20);
  const [bulkWeekdays, setBulkWeekdays] = useState({
    lun: true, mar: true, mie: true, jue: true, vie: true, sab: false, dom: false,
  });

  const [generatedDates, setGeneratedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar cantidad de pacientes cuando se selecciona un centro
  useEffect(() => {
    if (!centroId) {
      setPacientesCount(null);
      return;
    }
    setLoadingPacientes(true);
    getPacientesDeCentro(centroId)
      .then(({ data }) => {
        setPacientesCount(data?.length || 0);
      })
      .finally(() => setLoadingPacientes(false));
  }, [centroId]);

  const generateDates = () => {
    const out: string[] = [];

    if (bulkModeType === "cada-n") {
      if (!bulkStart || bulkIntervalDays <= 0 || bulkCount <= 0) {
        setGeneratedDates([]);
        return;
      }
      let cur = new Date(bulkStart);
      for (let i = 0; i < Math.min(bulkCount, 60); i++) {
        out.push(cur.toISOString());
        cur = new Date(cur.getTime() + bulkIntervalDays * 24 * 60 * 60 * 1000);
      }
    } else if (bulkModeType === "dias-semana") {
      if (!bulkStart || !bulkEnd || !bulkHour) {
        setGeneratedDates([]);
        return;
      }
      const start = new Date(bulkStart);
      const end = new Date(bulkEnd);
      if (end < start) {
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
    }

    setGeneratedDates(out);
  };

  const handleSubmit = async () => {
    if (!centroId) {
      toast({ title: "Error", description: "Seleccioná un centro", variant: "destructive" });
      return;
    }
    if (!prestadorId) {
      toast({ title: "Error", description: "Seleccioná un prestador (AT)", variant: "destructive" });
      return;
    }
    if (generatedDates.length === 0) {
      toast({ title: "Error", description: "Generá las fechas primero", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await createPrestacionesPorCentro({
        centro_id: centroId,
        user_id: prestadorId,
        tipo_prestacion: "Acompañante Terapeutico",
        fechas: generatedDates,
        monto: monto ? parseFloat(monto) : null,
        descripcion: descripcion || null,
        notas: notas || null,
        cronico,
      });

      if (error) throw new Error(error.message);

      toast({
        title: "Prestaciones creadas",
        description: `Se crearon ${data?.created} prestaciones (${data?.pacientes} pacientes × ${data?.fechas} fechas)`,
      });

      router.push("/protected/prestaciones");
      router.refresh();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No se pudieron crear las prestaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalPrestaciones = pacientesCount !== null && generatedDates.length > 0
    ? pacientesCount * generatedDates.length
    : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Selección de Centro */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">1. Seleccionar Geriátrico</h2>
        <Combobox
          value={centroId}
          onValueChange={setCentroId}
          disabled={loading}
          placeholder={centros.length ? "Seleccionar centro" : "No hay centros geriátricos"}
          searchPlaceholder="Buscar centro..."
          emptyText="No se encontraron centros"
          options={centros.map((c): ComboboxOption => ({
            value: c.id,
            label: c.nombre,
            searchText: c.nombre
          }))}
        />

        {loadingPacientes && <p className="text-sm text-muted-foreground">Cargando pacientes...</p>}
        {pacientesCount !== null && !loadingPacientes && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            <span className="font-medium">{pacientesCount}</span>
            <span className="text-muted-foreground">pacientes asignados a este centro</span>
          </div>
        )}
        {pacientesCount === 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Este centro no tiene pacientes asignados. Asigná pacientes primero.</span>
          </div>
        )}
      </div>

      {/* Selección de Prestador */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">2. Seleccionar Acompañante Terapéutico</h2>
        <Combobox
          value={prestadorId}
          onValueChange={setPrestadorId}
          disabled={loading}
          placeholder={prestadores.length ? "Seleccionar AT" : "No hay ATs disponibles"}
          searchPlaceholder="Buscar por nombre, apellido o DNI..."
          emptyText="No se encontraron acompañantes terapéuticos"
          options={prestadores.map((p): ComboboxOption => ({
            value: p.id,
            label: `${p.apellido}, ${p.nombre}${p.documento ? ` - DNI ${p.documento}` : ""}`,
            searchText: `${p.apellido} ${p.nombre} ${p.documento || ""}`
          }))}
        />
      </div>

      {/* Configuración de Fechas */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">3. Configurar Fechas</h2>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Modo</label>
          <Select
            value={bulkModeType}
            onValueChange={(v: "cada-n" | "dias-semana") => setBulkModeType(v)}
            disabled={loading}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dias-semana">Días de la semana</SelectItem>
              <SelectItem value="cada-n">Cada N días</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {bulkModeType === "cada-n" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Fecha de inicio</label>
              <Input
                type="datetime-local"
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Intervalo (días)</label>
              <Input
                type="number"
                min={1}
                value={bulkIntervalDays}
                onChange={(e) => setBulkIntervalDays(Number(e.target.value))}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cantidad</label>
              <Input
                type="number"
                min={1}
                max={60}
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                disabled={loading}
              />
            </div>
          </div>
        )}

        {bulkModeType === "dias-semana" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha inicio</label>
                <Input
                  type="date"
                  value={bulkStart}
                  onChange={(e) => setBulkStart(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fecha fin</label>
                <Input
                  type="date"
                  value={bulkEnd}
                  onChange={(e) => setBulkEnd(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Hora</label>
                <Input
                  type="time"
                  value={bulkHour}
                  onChange={(e) => setBulkHour(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              {[
                ["lun", "Lun"],
                ["mar", "Mar"],
                ["mie", "Mié"],
                ["jue", "Jue"],
                ["vie", "Vie"],
                ["sab", "Sáb"],
                ["dom", "Dom"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(bulkWeekdays[key as keyof typeof bulkWeekdays])}
                    onCheckedChange={(checked) =>
                      setBulkWeekdays((prev) => ({ ...prev, [key]: Boolean(checked) }))
                    }
                    disabled={loading}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={generateDates} disabled={loading}>
            <Calendar className="h-4 w-4 mr-2" />
            Generar fechas
          </Button>
          <span className="text-sm text-muted-foreground">Máximo 60 fechas</span>
        </div>

        {generatedDates.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Preview ({generatedDates.length} fechas)</div>
            <div className="max-h-40 overflow-auto border rounded p-2 text-sm text-muted-foreground">
              {generatedDates.slice(0, 10).map((d, i) => (
                <div key={i}>{new Date(d).toLocaleString("es-AR")}</div>
              ))}
              {generatedDates.length > 10 && (
                <div className="text-muted-foreground">... y {generatedDates.length - 10} más</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Opciones adicionales */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">4. Opciones adicionales</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Monto (opcional)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={cronico} onCheckedChange={setCronico} disabled={loading} />
            <label className="text-sm font-medium">Prestación crónica</label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Descripción (opcional)</label>
          <textarea
            rows={2}
            className="border rounded px-3 py-2 w-full text-sm"
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Notas (opcional)</label>
          <textarea
            rows={2}
            className="border rounded px-3 py-2 w-full text-sm"
            placeholder="Notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* Resumen y botón de creación */}
      {totalPrestaciones > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800">
                Se crearán {totalPrestaciones} prestaciones
              </p>
              <p className="text-sm text-green-700">
                {pacientesCount} pacientes × {generatedDates.length} fechas
              </p>
            </div>
            <Button onClick={handleSubmit} disabled={loading} size="lg">
              {loading ? "Creando..." : "Crear Prestaciones"}
            </Button>
          </div>
        </div>
      )}

      {totalPrestaciones === 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={true} size="lg">
            Crear Prestaciones
          </Button>
        </div>
      )}
    </div>
  );
}
