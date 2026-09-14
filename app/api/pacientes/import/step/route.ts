import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CandidateRow,
  ExistingPacienteRow,
  MAPBOX_TOKEN,
  PendingGeocodeRow,
  RowError,
  SKIP_GEOCODING,
  buildGeocodeQuery,
  chunkArray,
  geocodeAddress,
  getServiceRoleClient,
  sleep,
} from "../_lib";

export const maxDuration = 60;

// Cada llamada procesa lo que pueda dentro de este presupuesto de tiempo y
// devuelve el progreso. El cliente vuelve a llamar hasta que done === true.
// Esto permite correr en Vercel (funciones de corta duración) sin perder
// estado entre llamadas, porque todo se persiste en la tabla import_jobs.
const STEP_BUDGET_MS = 8_000;

type JobRow = {
  id: string;
  status: string;
  stage: string;
  candidates: CandidateRow[];
  pending_geocode: PendingGeocodeRow[];
  errors: RowError[];
  bajas_documentos: string[];
  baja_paciente_ids: string[];
  existing_map: Record<string, ExistingPacienteRow>;
  geocode_queue_indices: number[];
  geocode_cache: Record<string, { lng: number; lat: number } | null>;
  consult_cursor: number;
  geocode_cursor: number;
  upsert_cursor: number;
  bajas_pac_cursor: number;
  bajas_prest_cursor: number;
  geocoded_count: number;
  prestaciones_cancelled: number;
  summary: Record<string, unknown> | null;
};

export async function POST(req: Request) {
  let jobId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    jobId = body?.jobId;
    if (!jobId) {
      return NextResponse.json({ error: "jobId requerido" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: roleRows } = await supabase
      .from("v_user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const allowed = (roleRows || []).some((r) =>
      ["administrativo", "auditor", "super_admin"].includes(r.role as string),
    );
    if (!allowed) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: jobData, error: jobError } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !jobData) {
      return NextResponse.json({ error: "Trabajo de importación no encontrado" }, { status: 404 });
    }

    const job = jobData as unknown as JobRow;

    if (job.status === "done") {
      return NextResponse.json({
        done: true,
        stage: "done",
        summary: job.summary,
        errors: job.errors,
        pendingGeocode: job.pending_geocode,
      });
    }
    if (job.status === "error") {
      return NextResponse.json({ done: true, stage: "error", error: "La importación falló" });
    }

    const stepStart = Date.now();
    const withinBudget = () => Date.now() - stepStart < STEP_BUDGET_MS;

    const candidates: CandidateRow[] = job.candidates;
    const errors: RowError[] = job.errors || [];
    const pendingGeocode: PendingGeocodeRow[] = job.pending_geocode || [];
    const bajasDocumentos: string[] = job.bajas_documentos || [];
    const existingMap: Record<string, ExistingPacienteRow> = job.existing_map || {};
    let geocodeQueueIndices: number[] = job.geocode_queue_indices || [];
    const geocodeCache: Record<string, { lng: number; lat: number } | null> =
      job.geocode_cache || {};
    const bajaPacienteIds: string[] = job.baja_paciente_ids || [];
    let consultCursor = job.consult_cursor || 0;
    let geocodeCursor = job.geocode_cursor || 0;
    let upsertCursor = job.upsert_cursor || 0;
    let bajasPacCursor = job.bajas_pac_cursor || 0;
    let bajasPrestCursor = job.bajas_prest_cursor || 0;
    let geocodedCount = job.geocoded_count || 0;
    let prestacionesCancelled = job.prestaciones_cancelled || 0;
    let stage = job.stage;
    let summary: Record<string, unknown> | null = null;

    const documentos = candidates.map((c) => c.documento);
    const docChunks = chunkArray(documentos, 1000);

    if (stage === "consultando_existentes") {
      while (consultCursor < docChunks.length && withinBudget()) {
        const { data, error } = await supabase
          .from("pacientes")
          .select("documento, direccion_completa, ciudad, provincia, codigo_postal, ubicacion")
          .in("documento", docChunks[consultCursor]);
        if (error) throw error;
        (data as ExistingPacienteRow[] | null)?.forEach((row) => {
          if (row.documento) existingMap[row.documento] = row;
        });
        consultCursor += 1;
      }
      if (consultCursor >= docChunks.length) {
        const queue: number[] = [];
        candidates.forEach((candidate, idx) => {
          if (candidate.numeroEsCero) {
            candidate.forceUbicacion = false;
            candidate.needsGeocode = false;
            return;
          }
          const existing = existingMap[candidate.documento];
          if (!existing || !existing.ubicacion) {
            candidate.forceUbicacion = true;
            candidate.needsGeocode = true;
            queue.push(idx);
            return;
          }
        });
        geocodeQueueIndices = queue;
        stage = "geocodificando";
      }
    }

    if (stage === "geocodificando" && withinBudget()) {
      if (!MAPBOX_TOKEN) {
        if (!errors.some((e) => e.message.startsWith("MAPBOX token"))) {
          errors.push({
            row: 0,
            message:
              "MAPBOX token no configurado. Las direcciones nuevas/cambiadas quedaron sin geolocalizar.",
          });
        }
        geocodeCursor = geocodeQueueIndices.length;
      } else if (SKIP_GEOCODING) {
        while (geocodeCursor < geocodeQueueIndices.length && withinBudget()) {
          const candidate = candidates[geocodeQueueIndices[geocodeCursor]];
          candidate.needsGeocode = false;
          if (candidate.forceUbicacion) {
            candidate.skip = true;
            pendingGeocode.push({
              rowNumber: candidate.rowNumber,
              documento: candidate.documento,
              nombre: candidate.data.nombre,
              apellido: candidate.data.apellido,
              direccion: candidate.data.direccion_completa,
              ciudad: candidate.data.ciudad,
              provincia: candidate.data.provincia,
              codigo_postal: candidate.data.codigo_postal,
              motivo: "Requiere geocodificación (SKIP_GEOCODING activo)",
            });
            errors.push({
              row: candidate.rowNumber,
              message:
                "Fila requiere geolocalización nueva/cambiada. Ejecutá sin SKIP_GEOCODING para insertarla",
            });
          }
          geocodeCursor += 1;
        }
      } else {
        while (geocodeCursor < geocodeQueueIndices.length && withinBudget()) {
          const candidate = candidates[geocodeQueueIndices[geocodeCursor]];
          const query = buildGeocodeQuery(candidate.data);
          if (query) {
            let coords = geocodeCache[query];
            if (typeof coords === "undefined") {
              coords = await geocodeAddress(query, MAPBOX_TOKEN);
              geocodeCache[query] = coords;
              if (coords) geocodedCount += 1;
              await sleep(120);
            }
            candidate.data.ubicacion = coords ?? null;
            if (!coords && candidate.forceUbicacion) {
              candidate.skip = true;
              pendingGeocode.push({
                rowNumber: candidate.rowNumber,
                documento: candidate.documento,
                nombre: candidate.data.nombre,
                apellido: candidate.data.apellido,
                direccion: candidate.data.direccion_completa,
                ciudad: candidate.data.ciudad,
                provincia: candidate.data.provincia,
                codigo_postal: candidate.data.codigo_postal,
                motivo: "Mapbox no devolvió coordenadas",
              });
              errors.push({
                row: candidate.rowNumber,
                message: "No se pudo geocodificar la dirección (Mapbox sin resultados)",
              });
            }
          }
          geocodeCursor += 1;
        }
      }
      if (geocodeCursor >= geocodeQueueIndices.length) {
        stage = "guardando";
      }
    }

    const effectiveCandidates = candidates.filter((c) => !c.skip);

    if (stage === "guardando" && withinBudget()) {
      const payload = effectiveCandidates.map((candidate) => {
        const { ubicacion, ...rest } = candidate.data;
        const base: Record<string, unknown> = {
          ...rest,
          telefono: rest.telefono ?? null,
          email: rest.email ?? null,
        };
        if (ubicacion) {
          base.ubicacion = `SRID=4326;POINT(${ubicacion.lng} ${ubicacion.lat})`;
        }
        // Si la geocodificación falla o está desactivada, no enviamos ubicación
        // para no pisar la coordenada ya guardada con null.
        return base;
      });
      const upsertChunks = chunkArray(payload, 500);
      const adminClient = getServiceRoleClient();
      if (!adminClient) {
        throw new Error("Backend sin credenciales de servicio para importar");
      }
      while (upsertCursor < upsertChunks.length && withinBudget()) {
        const { error: upsertError } = await adminClient
          .from("pacientes")
          .upsert(upsertChunks[upsertCursor], { onConflict: "documento" });
        if (upsertError) throw upsertError;
        upsertCursor += 1;
      }
      if (upsertCursor >= upsertChunks.length) {
        stage = bajasDocumentos.length ? "procesando_bajas_pacientes" : "finalizando";
      }
    }

    if (stage === "procesando_bajas_pacientes" && withinBudget()) {
      const adminClient = getServiceRoleClient();
      if (!adminClient) {
        throw new Error("Backend sin credenciales de servicio para importar");
      }
      const bajaChunks = chunkArray(bajasDocumentos, 1000);
      while (bajasPacCursor < bajaChunks.length && withinBudget()) {
        const { data: bajasUpdated, error: bajasError } = await adminClient
          .from("pacientes")
          .update({ activo: false })
          .in("documento", bajaChunks[bajasPacCursor])
          .select("id, documento");
        if (bajasError) throw bajasError;
        (bajasUpdated as { id: string | null }[] | null)?.forEach((row) => {
          if (row.id) bajaPacienteIds.push(row.id);
        });
        bajasPacCursor += 1;
      }
      if (bajasPacCursor >= bajaChunks.length) {
        stage = bajaPacienteIds.length ? "procesando_bajas_prestaciones" : "finalizando";
      }
    }

    if (stage === "procesando_bajas_prestaciones" && withinBudget()) {
      const adminClient = getServiceRoleClient();
      if (!adminClient) {
        throw new Error("Backend sin credenciales de servicio para importar");
      }
      const idChunks = chunkArray(bajaPacienteIds, 500);
      const motivo = "Cancelada automáticamente por baja del beneficiario";
      while (bajasPrestCursor < idChunks.length && withinBudget()) {
        const chunk = idChunks[bajasPrestCursor];
        const { data: prestacionesPorCancelar, error: prestFetchError } = await adminClient
          .from("prestaciones")
          .select("id, notas, estado")
          .in("paciente_id", chunk)
          .neq("estado", "cancelada");
        if (prestFetchError) throw prestFetchError;

        if (prestacionesPorCancelar && prestacionesPorCancelar.length > 0) {
          const updates = prestacionesPorCancelar.map((row) => ({
            id: row.id,
            estado: "cancelada",
            cronico: false,
            notas: row.notas ? `${row.notas}\n${motivo}` : motivo,
          }));
          const { error: prestUpdateError } = await adminClient
            .from("prestaciones")
            .upsert(updates, { onConflict: "id" });
          if (prestUpdateError) throw prestUpdateError;
          prestacionesCancelled += updates.length;
        }
        bajasPrestCursor += 1;
      }
      if (bajasPrestCursor >= idChunks.length) {
        stage = "finalizando";
      }
    }

    if (stage === "finalizando") {
      const { count: activeCount, error: countError } = await supabase
        .from("pacientes")
        .select("id", { count: "exact", head: true })
        .eq("activo", true);
      if (countError) throw countError;

      const existingDocs = new Set(Object.keys(existingMap));
      const inserted = effectiveCandidates.filter((c) => !existingDocs.has(c.documento)).length;
      const updated = effectiveCandidates.length - inserted;

      summary = {
        processed: candidates.length,
        inserted,
        updated,
        errors: errors.length,
        geocoded: geocodedCount,
        inactivated: bajaPacienteIds.length,
        activeTotal: activeCount ?? null,
        prestacionesCancelled,
        pendingGeocodeCount: pendingGeocode.length,
      };
      stage = "done";
    }

    const updatePayload: Record<string, unknown> = {
      stage,
      candidates,
      errors,
      pending_geocode: pendingGeocode,
      existing_map: existingMap,
      geocode_queue_indices: geocodeQueueIndices,
      geocode_cache: geocodeCache,
      baja_paciente_ids: bajaPacienteIds,
      consult_cursor: consultCursor,
      geocode_cursor: geocodeCursor,
      upsert_cursor: upsertCursor,
      bajas_pac_cursor: bajasPacCursor,
      bajas_prest_cursor: bajasPrestCursor,
      geocoded_count: geocodedCount,
      prestaciones_cancelled: prestacionesCancelled,
      updated_at: new Date().toISOString(),
    };
    if (stage === "done") {
      updatePayload.status = "done";
      updatePayload.summary = summary;
    }

    const { error: updateError } = await supabase
      .from("import_jobs")
      .update(updatePayload)
      .eq("id", jobId);
    if (updateError) throw updateError;

    let processed = 0;
    let total = 0;
    switch (stage) {
      case "consultando_existentes":
        processed = Math.min(consultCursor * 1000, documentos.length);
        total = documentos.length;
        break;
      case "geocodificando":
        processed = geocodeCursor;
        total = geocodeQueueIndices.length;
        break;
      case "guardando":
        processed = Math.min(upsertCursor * 500, effectiveCandidates.length);
        total = effectiveCandidates.length;
        break;
      case "procesando_bajas_pacientes":
        processed = Math.min(bajasPacCursor * 1000, bajasDocumentos.length);
        total = bajasDocumentos.length;
        break;
      case "procesando_bajas_prestaciones":
        processed = Math.min(bajasPrestCursor * 500, bajaPacienteIds.length);
        total = bajaPacienteIds.length;
        break;
      case "done":
        processed = 1;
        total = 1;
        break;
    }

    return NextResponse.json({
      done: stage === "done",
      stage,
      processed,
      total,
      summary: stage === "done" ? summary : null,
      errors: stage === "done" ? errors : undefined,
      pendingGeocode: stage === "done" ? pendingGeocode : undefined,
      executedBy:
        stage === "done" ? { id: userRes.user.id, email: userRes.user.email } : undefined,
    });
  } catch (error) {
    console.error("Error procesando paso de importación", error);
    if (jobId) {
      try {
        const supabase = await createClient();
        await supabase
          .from("import_jobs")
          .update({
            status: "error",
            error_message: error instanceof Error ? error.message : String(error),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      } catch (updateErr) {
        console.error("Error marcando job como fallido", updateErr);
      }
    }
    return NextResponse.json(
      { done: true, stage: "error", error: "Error inesperado importando pacientes" },
      { status: 500 },
    );
  }
}
