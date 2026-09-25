import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import {
  HEADER_SHEET_OPTIONS,
  buildAddressSignature,
  buildLookups,
  CandidateRow,
  chunkArray,
  collectBajaDocumentos,
  getServiceRoleClient,
  mapRowToBeneficiario,
  RowError,
  validateHeaders,
} from "../_lib";

const IMPORT_BUCKET = "importaciones";

export const maxDuration = 60;

// Parsea el Excel y crea el job en Supabase. Debe ser rápido: no hace
// geocoding ni escrituras masivas, solo validación + parseo en memoria.
export async function POST(req: Request) {
  try {
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

    const contentType = req.headers.get("content-type") || "";
    let arrayBuffer: ArrayBuffer;

    if (contentType.includes("application/json")) {
      // Archivo grande: ya se subió a Supabase Storage desde el cliente;
      // acá solo recibimos la ruta y lo descargamos con el service role.
      const body = await req.json().catch(() => null);
      const filePath = body?.filePath;
      if (!filePath || typeof filePath !== "string") {
        return NextResponse.json({ error: "Ruta de archivo no provista" }, { status: 400 });
      }
      // El path debe empezar con el id del usuario autenticado (mismo prefijo
      // que usa el cliente al subir) para que nadie pueda pedir el archivo de otro.
      if (!filePath.startsWith(`${userRes.user.id}/`)) {
        return NextResponse.json({ error: "Ruta de archivo no autorizada" }, { status: 403 });
      }

      const adminClient = getServiceRoleClient();
      if (!adminClient) {
        return NextResponse.json(
          { error: "Backend sin credenciales de servicio para importar" },
          { status: 500 },
        );
      }

      const { data: fileData, error: downloadError } = await adminClient.storage
        .from(IMPORT_BUCKET)
        .download(filePath);
      if (downloadError || !fileData) {
        return NextResponse.json(
          { error: `No se pudo descargar el archivo subido: ${downloadError?.message || "desconocido"}` },
          { status: 400 },
        );
      }
      arrayBuffer = await fileData.arrayBuffer();

      // Limpieza best-effort: ya tenemos los bytes en memoria, no necesitamos conservarlo.
      adminClient.storage.from(IMPORT_BUCKET).remove([filePath]).catch(() => {});
    } else {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: "Archivo no provisto" }, { status: 400 });
      }
      arrayBuffer = await file.arrayBuffer();
    }

    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets.PROFE;
    if (!sheet) {
      return NextResponse.json({ error: "Hoja PROFE no encontrada" }, { status: 400 });
    }

    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, HEADER_SHEET_OPTIONS);
    if (!headerRows.length) {
      return NextResponse.json({ error: "Hoja PROFE vacía" }, { status: 400 });
    }

    const missingHeaders = validateHeaders(headerRows[0] || []);
    if (missingHeaders.length) {
      return NextResponse.json(
        { error: `Faltan columnas requeridas: ${missingHeaders.join(", ")}` },
        { status: 400 },
      );
    }

    const lookups = buildLookups(workbook);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: true,
      defval: "",
    });
    const bajasDocumentos = collectBajaDocumentos(workbook);

    const candidates: CandidateRow[] = [];
    const errors: RowError[] = [];
    const seenDocs = new Set<string>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 por header y +1 para base 1
      const { data, numeroEsCero, error } = mapRowToBeneficiario(row, rowNumber, lookups);
      if (error) {
        errors.push(error);
        return;
      }
      if (!data) return;
      if (seenDocs.has(data.documento)) {
        errors.push({ row: rowNumber, message: "Documento duplicado en archivo" });
        return;
      }
      seenDocs.add(data.documento);
      candidates.push({
        data,
        rowNumber,
        documento: data.documento,
        forceUbicacion: false,
        needsGeocode: false,
        addressSignature: buildAddressSignature(
          data.direccion_completa,
          data.ciudad,
          data.provincia,
          data.codigo_postal,
        ),
        numeroEsCero: Boolean(numeroEsCero),
      });
    });

    if (!candidates.length) {
      return NextResponse.json(
        { error: "No se encontraron filas válidas", details: { errors } },
        { status: 400 },
      );
    }

    // Padrones grandes (decenas de miles de filas) generan un JSON de candidatos
    // que puede superar el límite de tamaño de request de la API de Supabase si
    // se manda todo en un solo insert. Por eso se crea el job con el primer chunk
    // y el resto se agrega con RPCs que hacen el append en el servidor (jsonb ||).
    const JOB_CHUNK_SIZE = 1500;
    const candidateChunks = chunkArray(candidates, JOB_CHUNK_SIZE);
    const errorChunks = chunkArray(errors, JOB_CHUNK_SIZE);

    const { data: job, error: insertError } = await supabase
      .from("import_jobs")
      .insert({
        created_by: userRes.user.id,
        status: "processing",
        stage: "consultando_existentes",
        candidates: candidateChunks[0] ?? [],
        errors: errorChunks[0] ?? [],
        bajas_documentos: bajasDocumentos,
      })
      .select("id")
      .single();

    if (insertError || !job) {
      console.error("Error creando import_job", insertError);
      return NextResponse.json(
        { error: "No se pudo crear el trabajo de importación" },
        { status: 500 },
      );
    }

    for (let i = 1; i < candidateChunks.length; i++) {
      const { error: appendError } = await supabase.rpc("append_import_job_candidates", {
        p_job_id: job.id,
        p_chunk: candidateChunks[i],
      });
      if (appendError) {
        console.error("Error agregando candidatos al job", appendError);
        return NextResponse.json(
          { error: "No se pudo guardar el padrón completo (archivo muy grande)" },
          { status: 500 },
        );
      }
    }

    for (let i = 1; i < errorChunks.length; i++) {
      const { error: appendError } = await supabase.rpc("append_import_job_errors", {
        p_job_id: job.id,
        p_chunk: errorChunks[i],
      });
      if (appendError) {
        // No bloqueante: los errores son solo informativos para el usuario.
        console.error("Error agregando errores al job", appendError);
      }
    }

    return NextResponse.json({
      jobId: job.id,
      totalCandidates: candidates.length,
      totalErrors: errors.length,
      totalBajas: bajasDocumentos.length,
    });
  } catch (error) {
    console.error("Error iniciando importación", error);
    return NextResponse.json(
      { error: "Error inesperado iniciando la importación" },
      { status: 500 },
    );
  }
}
