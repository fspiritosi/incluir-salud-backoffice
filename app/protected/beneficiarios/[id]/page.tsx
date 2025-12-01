import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBeneficiarioById, getPrestacionesByPaciente } from "../actions";
import { PacienteNotesPlaceholder } from "@/components/beneficiarios/PacienteNotesPlaceholder";
import { CloneCronicasButton } from "@/components/beneficiarios/CloneCronicasButton";
import { PatientHistoryTable } from "@/components/beneficiarios/PatientHistoryTable";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "full",
  timeStyle: "short",
});

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatName(record?: { nombre?: string | null; apellido?: string | null }) {
  if (!record) return "Sin asignar";
  return `${record.apellido ?? ""}, ${record.nombre ?? ""}`.trim();
}

function formatTipo(tipo: string) {
  return tipo
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, match => match.toUpperCase());
}

function summarizePrestaciones(rows: NonNullable<Awaited<ReturnType<typeof getPrestacionesByPaciente>>["data"]>) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);

  const summary = {
    total: rows.length,
    cronicas: rows.filter(row => row.cronico).length,
    estados: {
      completada: { count: 0, monto: 0 },
      pendiente: { count: 0, monto: 0 },
      cancelada: { count: 0, monto: 0 },
    },
    nextMonth: { count: 0, monto: 0 },
  };

  rows.forEach(row => {
    const fecha = new Date(row.fecha);
    const normalizedEstado = (row.estado || "pendiente").toLowerCase();
    const bucket = summary.estados[normalizedEstado as keyof typeof summary.estados];
    if (bucket) {
      bucket.count += 1;
      if (row.monto != null) {
        bucket.monto += Number(row.monto);
      }
    }

    if (fecha.getFullYear() === nextMonthDate.getFullYear() && fecha.getMonth() === nextMonthDate.getMonth()) {
      summary.nextMonth.count += 1;
      if (row.monto != null) {
        summary.nextMonth.monto += Number(row.monto);
      }
    }
  });

  return summary;
}

export default async function BeneficiarioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const claimsData = (claims?.claims as Record<string, any>) || {};
  const currentUserName =
    (claimsData?.user_metadata?.full_name as string | undefined) ??
    (claimsData?.full_name as string | undefined) ??
    (claimsData?.email as string | undefined) ??
    "Usuario";

  const beneficiarioRes = await getBeneficiarioById(id);
  if (beneficiarioRes.error || !beneficiarioRes.data) {
    notFound();
  }

  const prestacionesRes = await getPrestacionesByPaciente(id);
  const prestaciones = prestacionesRes.data ?? [];
  const today = new Date();
  const defaultHistoryRange = {
    startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth() + 2, 1).toISOString(),
  };
  const summary = summarizePrestaciones(prestaciones);
  const eligibleCronicas = prestaciones.filter(row => {
    const fecha = new Date(row.fecha);
    const now = new Date();
    return (
      row.cronico &&
      fecha.getFullYear() === now.getFullYear() &&
      fecha.getMonth() === now.getMonth()
    );
  }).length;
  const notes = prestaciones
    .filter(row => row.notas && row.notas.trim().length > 0)
    .slice(0, 10)
    .map(row => ({
      id: row.id,
      fecha: row.fecha,
      prestador: formatName(row.prestador || undefined),
      texto: row.notas,
      tipo: formatTipo(row.tipo_prestacion),
      estado: row.estado,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Detalle de paciente</p>
          <h1 className="text-3xl font-semibold">
            {beneficiarioRes.data.apellido}, {beneficiarioRes.data.nombre}
          </h1>
          <p className="text-sm text-muted-foreground">Documento {beneficiarioRes.data.documento}</p>
        </div>
        <Badge variant={beneficiarioRes.data.activo ? "default" : "secondary"} className="ml-auto">
          {beneficiarioRes.data.activo ? "Activo" : "Inactivo"}
        </Badge>
        <Link href="/protected/beneficiarios">
          <Button variant="outline">Volver al listado</Button>
        </Link>
        <Link href={`/protected/beneficiarios/editar/${beneficiarioRes.data.id}`}>
          <Button variant="secondary">Editar paciente</Button>
        </Link>
        <CloneCronicasButton pacienteId={beneficiarioRes.data.id} eligibleCount={eligibleCronicas} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Teléfono:</span> {beneficiarioRes.data.telefono ?? "Sin dato"}</p>
            <p><span className="text-muted-foreground">Email:</span> {beneficiarioRes.data.email ?? "Sin dato"}</p>
            <p><span className="text-muted-foreground">Dirección:</span> {beneficiarioRes.data.direccion_completa}</p>
            <p>
              <span className="text-muted-foreground">Ciudad / Provincia:</span> {beneficiarioRes.data.ciudad ?? "-"} / {beneficiarioRes.data.provincia ?? "-"}
            </p>
            <p><span className="text-muted-foreground">Código Postal:</span> {beneficiarioRes.data.codigo_postal ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen mensual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-md border border-dashed px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Historial total</p>
                <p className="text-lg font-semibold text-foreground">{summary.total}</p>
              </div>
              <div className="rounded-md border border-dashed px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Crónicas activas</p>
                <p className="text-lg font-semibold text-foreground">{summary.cronicas}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[{ label: "Completadas", key: "completada", accent: "text-emerald-600" }, { label: "Pendientes", key: "pendiente", accent: "text-amber-600" }, { label: "Canceladas", key: "cancelada", accent: "text-rose-600" }].map(item => (
                <div key={item.key} className="rounded-md bg-muted/40 px-2 py-2">
                  <p className={`text-[0.65rem] uppercase tracking-wide ${item.accent}`}>{item.label}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {summary.estados[item.key as keyof typeof summary.estados].count}
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">{currencyFormatter.format(summary.estados[item.key as keyof typeof summary.estados].monto)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-center">
              <p className="text-xs uppercase tracking-wide text-primary">Próximo mes</p>
              <div className="mt-1 flex items-center justify-between text-sm font-semibold text-primary">
                <span>{summary.nextMonth.count} programadas</span>
                <span>{currencyFormatter.format(summary.nextMonth.monto)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <PacienteNotesPlaceholder notes={notes} currentUserName={currentUserName} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prestaciones del mes actual y anterior</CardTitle>
          <p className="text-sm text-muted-foreground">
            Filtrá por prestador, tipo de prestación o mes para encontrar rápidamente la agenda más reciente.
          </p>
        </CardHeader>
        <CardContent>
          <PatientHistoryTable
            pacienteId={id}
            data={prestaciones}
            defaultRange={defaultHistoryRange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
