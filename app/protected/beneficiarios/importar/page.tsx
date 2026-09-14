"use client";

import { useState, FormEvent, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, FileWarning, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

interface ImportSummary {
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  geocoded?: number;
  inactivated?: number;
  activeTotal?: number | null;
  prestacionesCancelled?: number;
}

interface ExecutedByInfo {
  id: string;
  email?: string | null;
}

interface RowError {
  row: number;
  message: string;
}

type StageKey =
  | "subiendo"
  | "consultando_existentes"
  | "geocodificando"
  | "guardando"
  | "procesando_bajas_pacientes"
  | "procesando_bajas_prestaciones"
  | "finalizando"
  | "done";

const STAGE_LABELS: Record<StageKey, string> = {
  subiendo: "Subiendo y validando archivo...",
  consultando_existentes: "Consultando pacientes existentes...",
  geocodificando: "Geolocalizando direcciones...",
  guardando: "Guardando resultados...",
  procesando_bajas_pacientes: "Procesando bajas...",
  procesando_bajas_prestaciones: "Cancelando prestaciones de bajas...",
  finalizando: "Finalizando...",
  done: "Importación completada",
};

// Rango de porcentaje que ocupa cada etapa dentro del progreso total.
// La geocodificación suele ser la más lenta (llamadas a Mapbox una por una).
const STAGE_RANGES: Record<StageKey, { start: number; end: number }> = {
  subiendo: { start: 0, end: 5 },
  consultando_existentes: { start: 5, end: 15 },
  geocodificando: { start: 15, end: 80 },
  guardando: { start: 80, end: 92 },
  procesando_bajas_pacientes: { start: 92, end: 96 },
  procesando_bajas_prestaciones: { start: 96, end: 99 },
  finalizando: { start: 99, end: 100 },
  done: { start: 100, end: 100 },
};

const formatEta = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export default function ImportarBeneficiariosPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [executedBy, setExecutedBy] = useState<ExecutedByInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [etaLabel, setEtaLabel] = useState<string | null>(null);
  const requestStartedAtRef = useRef<number | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setSummary(null);
    setRowErrors([]);
    setServerError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      toast({
        title: "Archivo requerido",
        description: "Seleccioná el padrón en formato XLSX.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setSummary(null);
    setRowErrors([]);
    setServerError(null);
    setExecutedBy(null);
    setProgress(1);
    setProgressMessage(STAGE_LABELS.subiendo);
    setEtaLabel(null);
    requestStartedAtRef.current = Date.now();

    const formData = new FormData();
    formData.append("file", file);

    const applyProgressEvent = (stage: StageKey, processed: number, total: number) => {
      const range = STAGE_RANGES[stage];
      const fraction = total > 0 ? Math.min(processed / total, 1) : processed > 0 ? 1 : 0;
      const overall = range.start + fraction * (range.end - range.start);
      setProgress(overall);
      setProgressMessage(STAGE_LABELS[stage]);

      const startedAt = requestStartedAtRef.current;
      if (startedAt && overall > 2) {
        const elapsed = Date.now() - startedAt;
        const etaMs = (elapsed / overall) * (100 - overall);
        setEtaLabel(formatEta(etaMs));
      }
    };

    try {
      const startResponse = await fetch("/api/pacientes/import/start", {
        method: "POST",
        body: formData,
      });
      const startPayload = await startResponse.json().catch(() => null);

      if (!startResponse.ok) {
        setServerError(startPayload?.error || "No se pudo procesar el archivo");
        setRowErrors(startPayload?.details?.errors ?? startPayload?.errors ?? []);
        setExecutedBy(null);
        setProgressMessage("La importación falló");
        setEtaLabel(null);
        toast({
          title: "Importación fallida",
          description: startPayload?.error || "Revisá los detalles y volvé a intentar",
          variant: "destructive",
        });
        return;
      }

      const jobId: string = startPayload.jobId;
      let done = false;

      while (!done) {
        const stepResponse = await fetch("/api/pacientes/import/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        const event = await stepResponse.json().catch(() => null);

        if (!stepResponse.ok || !event) {
          setServerError(event?.error || "Error inesperado importando pacientes");
          setProgressMessage("La importación falló");
          setEtaLabel(null);
          toast({
            title: "Importación fallida",
            description: event?.error || "Revisá los detalles y volvé a intentar",
            variant: "destructive",
          });
          return;
        }

        if (event.stage === "error") {
          setServerError(event.error || "Error inesperado importando pacientes");
          setProgressMessage("La importación falló");
          setEtaLabel(null);
          toast({
            title: "Importación fallida",
            description: event.error || "Revisá los detalles y volvé a intentar",
            variant: "destructive",
          });
          return;
        }

        if (event.stage) {
          applyProgressEvent(event.stage as StageKey, event.processed ?? 0, event.total ?? 0);
        }

        if (event.done) {
          done = true;
          setSummary(event.summary ?? null);
          setRowErrors(event.errors || []);
          setExecutedBy(event.executedBy ?? null);
          setProgress(100);
          setProgressMessage("Importación completada");
          setEtaLabel(null);
          toast({
            title: "Importación completada",
            description: `Procesadas ${event.summary?.processed ?? 0} filas`,
          });
        }
      }
    } catch (error) {
      console.error("Error al enviar importación", error);
      setServerError("Error inesperado importando pacientes");
      setProgressMessage("Error inesperado importando pacientes");
      setEtaLabel(null);
      toast({
        title: "Error del servidor",
        description: "Intentalo de nuevo en unos minutos",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/protected/beneficiarios"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a beneficiarios
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="lg:w-1/2">
          <CardHeader>
            <CardTitle>Importar padrón mensual</CardTitle>
            <CardDescription>
              Subí el Excel oficial (hoja PROFE) para insertar o actualizar los pacientes automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {progressMessage && (
              <div className="mb-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{progressMessage}</span>
                  <span>
                    {Math.round(progress)}%
                    {etaLabel ? ` · faltan ~${etaLabel}` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="padron-file">Archivo XLSX *</Label>
                <Input
                  id="padron-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                {file ? (
                  <p className="text-sm text-muted-foreground">
                    Archivo seleccionado: <span className="font-medium">{file.name}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Usá el padrón mensual con la estructura actual (hoja PROFE).
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={!file || isSubmitting}>
                <Upload className="mr-2 h-4 w-4" />
                {isSubmitting ? "Procesando..." : "Importar"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              - Solo roles Administrativo, Auditor o Super Admin pueden importar pacientes.
            </p>
            <p className="text-sm text-muted-foreground">
              - El sistema valida columnas, documentos duplicados y datos de ciudad/provincia.
            </p>
          </CardFooter>
        </Card>

        <Card className="lg:flex-1">
          <CardHeader>
            <CardTitle>Instrucciones rápidas</CardTitle>
            <CardDescription>Antes de subir verificá que el archivo cumpla con estos pasos.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal pl-5">
              <li>Usá siempre el Excel original del padrón (no cambies el orden ni el nombre de las columnas).</li>
              <li>Asegurate de que la hoja <strong>PROFE</strong> contenga los beneficiarios activos del mes.</li>
              <li>No permitas filas vacías entre medio: el sistema las ignora y se reportan como errores.</li>
              <li>Si necesitás corregir direcciones/ciudades, hacelo en el Excel antes de importar.</li>
              <li>Guardá el archivo y subilo; el proceso agrega nuevos pacientes y actualiza los existentes.</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              Importación finalizada. Verificá los totales y, si corresponde, revisá los errores detectados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {executedBy && (
              <div className="text-sm text-muted-foreground">
                Última importación registrada por <span className="font-medium text-foreground">{executedBy.email || executedBy.id}</span>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Procesadas</p>
                <p className="text-2xl font-semibold">{summary.processed}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Altas (nuevas)</p>
                <p className="text-2xl font-semibold text-emerald-600">{summary.inserted}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Actualizadas</p>
                <p className="text-2xl font-semibold text-sky-600">{summary.updated}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Bajas (mes)</p>
                <p className="text-2xl font-semibold text-rose-600">{summary.inactivated ?? 0}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Prestaciones canceladas por baja</p>
                <p className="text-2xl font-semibold text-red-500">{summary.prestacionesCancelled ?? 0}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Activos totales</p>
                <p className="text-2xl font-semibold text-foreground">{summary.activeTotal ?? "-"}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Geolocalizados</p>
                <p className="text-2xl font-semibold text-purple-600">{summary.geocoded ?? 0}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Errores</p>
                <p className="text-2xl font-semibold text-amber-600">{summary.errors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(serverError || rowErrors.length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <FileWarning className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle>Observaciones</CardTitle>
              <CardDescription>
                {serverError || `${rowErrors.length} fila${rowErrors.length !== 1 ? 's' : ''} no se pud${rowErrors.length !== 1 ? 'ieron' : 'o'} importar. El resto se procesó correctamente.`}
              </CardDescription>
            </div>
          </CardHeader>
          {rowErrors.length > 0 && (
            <CardContent>
              <ScrollArea className="max-h-72">
                <p className="mb-2 text-xs text-muted-foreground">
                  Las siguientes filas del archivo no se importaron. El número indica la fila en el Excel (la fila 2 es la primera de datos).
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Fila en Excel</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowErrors.map((err) => (
                      <TableRow key={`${err.row}-${err.message}`}>
                        <TableCell className="font-mono">{err.row}</TableCell>
                        <TableCell>{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
