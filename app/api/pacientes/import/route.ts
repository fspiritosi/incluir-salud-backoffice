type PendingGeocodeRow = {
  rowNumber: number;
  documento: string;
  nombre: string;
  apellido: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  motivo: string;
};

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { BeneficiarioInput } from "@/app/protected/beneficiarios/actions";

const REQUIRED_HEADERS = [
  "clave_excaja",
  "clave_tipo",
  "clave_numero",
  "clave_coparticipe",
  "clave_parentesco",
  "leyaplicada",
  "apenom",
  "sexo",
  "estcivil",
  "tipo_doc",
  "numero_doc",
  "fe_nac",
  "incapacidad",
  "fech_alta",
  "Dom_calle",
  "Dom_Nro",
  "Dom_Piso",
  "Dom_Dpto",
  "Cod_Pos",
  "Cug_Pcia",
  "cug_dpto",
  "cug_loc",
];

type RowError = {
  row: number;
  message: string;
};

type LocalidadInfo = {
  nombre: string;
  codigoPostal: string;
};

type Lookups = {
  provincias: Map<number, string>;
  departamentos: Map<string, string>;
  localidades: Map<string, LocalidadInfo>;
};

const MAPBOX_TOKEN =
  process.env.MAPBOX_API_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const SKIP_GEOCODING = process.env.SKIP_GEOCODING === "true";

type CandidateRow = {
  data: BeneficiarioInput;
  rowNumber: number;
  documento: string;
  forceUbicacion: boolean;
  needsGeocode: boolean;
  addressSignature: string;
  numeroEsCero: boolean;
  skip?: boolean;
};

type ExistingPacienteRow = {
  documento: string | null;
  direccion_completa: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  ubicacion: unknown;
};

const HEADER_SHEET_OPTIONS = { header: 1, raw: true } as const;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const getServiceRoleClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan credenciales SUPABASE_SERVICE_ROLE_KEY para ejecutar la importación");
    return null;
  }
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false },
  });
};

const normalizeKey = (value: unknown) =>
  typeof value === "string" ? value.trim() : value ?? "";

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringSafe = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toTitleCase = (text: string) =>
  text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const splitApenom = (raw: string) => {
  const cleaned = toStringSafe(raw);
  if (!cleaned) {
    return { nombre: "", apellido: "" };
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return {
      apellido: toTitleCase(parts[0]),
      nombre: toTitleCase(parts[0]),
    };
  }
  const apellido = parts[0];
  const nombre = parts.slice(1).join(" ");
  return {
    apellido: toTitleCase(apellido),
    nombre: toTitleCase(nombre),
  };
};

const makeDepartamentoKey = (provincia: number | null, departamento: number | null) =>
  `${provincia ?? ""}-${departamento ?? ""}`;

const makeLocalidadKey = (
  provincia: number | null,
  departamento: number | null,
  localidad: number | null,
) => `${provincia ?? ""}-${departamento ?? ""}-${localidad ?? ""}`;

const loadProvincias = (workbook: XLSX.WorkBook) => {
  const result = new Map<number, string>();
  const sheet = workbook.Sheets.PROVINCIA;
  if (!sheet) return result;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  for (const row of rows) {
    const code = toNumberOrNull(row.Provincia);
    const name = toStringSafe(row.Detalle);
    if (code !== null && name) {
      result.set(code, toTitleCase(name));
    }
  }
  return result;
};

const loadDepartamentos = (workbook: XLSX.WorkBook) => {
  const result = new Map<string, string>();
  const sheet = workbook.Sheets.DEPARTAMENTO;
  if (!sheet) return result;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  for (const row of rows) {
    const prov = toNumberOrNull(row.Provincia);
    const dept = toNumberOrNull(row.Departamento);
    const name = toStringSafe(row.Nombre_Dep);
    if (prov !== null && dept !== null && name) {
      result.set(makeDepartamentoKey(prov, dept), toTitleCase(name));
    }
  }
  return result;
};

const loadLocalidades = (workbook: XLSX.WorkBook) => {
  const result = new Map<string, LocalidadInfo>();
  const sheet = workbook.Sheets.LOCALIDAD;
  if (!sheet) return result;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  for (const row of rows) {
    const prov = toNumberOrNull(row.Provincia);
    const dept = toNumberOrNull(row.Departamento);
    const loc = toNumberOrNull(row.Localidad);
    const nombre = toStringSafe(row.Nombre_Loc);
    const cp = toStringSafe(row.CódigoPostal);
    if (prov !== null && dept !== null && loc !== null && nombre) {
      result.set(makeLocalidadKey(prov, dept, loc), {
        nombre: toTitleCase(nombre),
        codigoPostal: cp,
      });
    }
  }
  return result;
};

const buildLookups = (workbook: XLSX.WorkBook): Lookups => ({
  provincias: loadProvincias(workbook),
  departamentos: loadDepartamentos(workbook),
  localidades: loadLocalidades(workbook),
});

const collectBajaDocumentos = (workbook: XLSX.WorkBook): string[] => {
  const sheet = workbook.Sheets.BAJAS;
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const docs = new Set<string>();
  rows.forEach((row) => {
    const doc = sanitizeDocumento(row.numero_doc);
    if (doc) {
      docs.add(doc);
    }
  });
  return Array.from(docs);
};

const normalizeAddressComponent = (value: unknown) => {
  const cleaned = toStringSafe(value);
  if (!cleaned) return "";
  const normalized = cleaned.toLowerCase();
  if (normalized === "-" || normalized === "n/a") {
    return "";
  }
  if (normalized === "s/n") {
    return "S/N";
  }
  if (normalized === "0" || normalized === "00") {
    return "";
  }
  return cleaned;
};

const buildDireccion = (row: Record<string, unknown>) => {
  const calle = toStringSafe(row.Dom_calle);
  const numeroRaw = toStringSafe(row.Dom_Nro);
  const numeroNormalized = normalizeAddressComponent(numeroRaw);
  const piso = normalizeAddressComponent(row.Dom_Piso);
  const dpto = normalizeAddressComponent(row.Dom_Dpto);
  const parts = [
    calle,
    numeroNormalized ? (numeroNormalized === "S/N" ? numeroNormalized : `#${numeroNormalized}`) : "",
    piso ? `Piso ${piso}` : "",
    dpto ? `Dpto ${dpto}` : "",
  ].filter(Boolean);
  const direccion = parts.join(" ").trim();
  const numeroEsCero = numeroRaw.trim() !== "" && numeroRaw.replace(/[^0-9]/g, "") === "0";
  return { direccion, numeroEsCero };
};

const sanitizeDocumento = (value: unknown) => {
  const raw = toStringSafe(value);
  const digits = raw.replace(/[^0-9]/g, "");
  return digits;
};

const buildAddressSignature = (
  direccion: string,
  ciudad: string,
  provincia: string,
  codigoPostal: string,
) =>
  [
    direccion,
    ciudad,
    provincia,
    codigoPostal,
  ]
    .map((part) => (part || "").toLowerCase().trim())
    .join("|");

const cleanGeocodePart = (value: string | null | undefined) =>
  toStringSafe(value)
    .replace(/\r|\n/g, " ")
    .replace(/#/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^,|,$/g, "")
    .trim();

const buildGeocodeQuery = (data: BeneficiarioInput) => {
  const direccionClean = cleanGeocodePart(data.direccion_completa);
  const seen = new Set<string>();
  const parts: string[] = [];

  const pushPart = (raw: string | null | undefined) => {
    const cleaned = cleanGeocodePart(raw);
    if (!cleaned) return;
    const signature = cleaned.toLowerCase();
    if (seen.has(signature)) return;
    seen.add(signature);
    parts.push(cleaned);
  };

  pushPart(direccionClean);

  const maybeAdd = (raw: string | null | undefined) => {
    const cleaned = cleanGeocodePart(raw);
    if (!cleaned) return;
    const signature = cleaned.toLowerCase();
    if (direccionClean.toLowerCase().includes(signature)) {
      return;
    }
    pushPart(cleaned);
  };

  maybeAdd(data.ciudad);
  maybeAdd(data.provincia);
  pushPart(data.codigo_postal);
  pushPart("Argentina");

  return parts.join(", ").slice(0, 250);
};

async function geocodeAddress(query: string, token: string) {
  if (!token) {
    return null;
  }
  try {
    const params = new URLSearchParams({
      access_token: token,
      country: "ar",
      language: "es",
      limit: "1",
      types: "address,place,locality",
      autocomplete: "false",
    });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorPayload = await response.text();
      console.error("Mapbox geocoding error", {
        status: response.status,
        statusText: response.statusText,
        query,
        body: errorPayload?.slice(0, 500) ?? null,
      });
      return null;
    }
    const data = await response.json();
    const feature = data?.features?.[0];
    if (
      feature &&
      Array.isArray(feature.center) &&
      Number.isFinite(feature.center[0]) &&
      Number.isFinite(feature.center[1])
    ) {
      return { lng: feature.center[0], lat: feature.center[1] };
    }
  } catch (error) {
    console.error("Error calling Mapbox geocoding", error);
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mapRowToBeneficiario = (
  row: Record<string, unknown>,
  rowNumber: number,
  lookups: Lookups,
): { data?: BeneficiarioInput; numeroEsCero?: boolean; error?: RowError } => {
  const { nombre, apellido } = splitApenom(toStringSafe(row.apenom));
  if (!nombre || !apellido) {
    return { error: { row: rowNumber, message: "apenom vacío o inválido" } };
  }
  const documento = sanitizeDocumento(row.numero_doc);
  if (!documento) {
    return { error: { row: rowNumber, message: "numero_doc vacío" } };
  }
  const { direccion, numeroEsCero } = buildDireccion(row);
  if (!direccion) {
    return { error: { row: rowNumber, message: "Dirección incompleta" } };
  }

  const provCode = toNumberOrNull(row.Cug_Pcia);
  const deptCode = toNumberOrNull(row.cug_dpto);
  const locCode = toNumberOrNull(row.cug_loc);
  const provinciaNombre = provCode !== null ? lookups.provincias.get(provCode) ?? "" : "";
  const localidadKey = makeLocalidadKey(provCode, deptCode, locCode);
  const localidadInfo = lookups.localidades.get(localidadKey);
  const ciudad = localidadInfo?.nombre ||
    (provCode !== null && deptCode !== null
      ? lookups.departamentos.get(makeDepartamentoKey(provCode, deptCode)) || ""
      : "");
  const codigoPostal = localidadInfo?.codigoPostal || toStringSafe(row.Cod_Pos);

  const provincia = provinciaNombre || "";
  if (!ciudad || !provincia) {
    return {
      error: {
        row: rowNumber,
        message: "No se pudo resolver ciudad/provincia a partir de CUG",
      },
    };
  }

  const data: BeneficiarioInput = {
    nombre,
    apellido,
    documento,
    telefono: null,
    email: null,
    direccion_completa: `${direccion}${ciudad ? `, ${ciudad}` : ""}${provincia ? `, ${provincia}` : ""}`,
    ciudad,
    provincia,
    codigo_postal: codigoPostal,
    activo: true,
    ubicacion: null,
  };

  return { data, numeroEsCero };
};

const validateHeaders = (headers: unknown[]): string[] => {
  const normalized = headers.map((h) => toStringSafe(h));
  return REQUIRED_HEADERS.filter((required) => !normalized.includes(required));
};

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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Archivo no provisto" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
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
    const pendingGeocode: PendingGeocodeRow[] = [];
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

    const documentos = candidates.map((c) => c.documento);
    const existingRows: ExistingPacienteRow[] = [];
    if (documentos.length) {
      for (const chunk of chunkArray(documentos, 1000)) {
        const { data, error } = await supabase
          .from("pacientes")
          .select(
            "documento, direccion_completa, ciudad, provincia, codigo_postal, ubicacion",
          )
          .in("documento", chunk);
        if (error) {
          throw error;
        }
        existingRows.push(...((data as ExistingPacienteRow[]) || []));
      }
    }
    const existingSet = new Set(
      (existingRows || [])
        .map((row) => row.documento)
        .filter((doc): doc is string => Boolean(doc)),
    );
    const existingMap = new Map<string, ExistingPacienteRow>();
    (existingRows || []).forEach((row) => {
      if (row.documento) {
        existingMap.set(row.documento, row as ExistingPacienteRow);
      }
    });

    const geocodeQueue: CandidateRow[] = [];
    candidates.forEach((candidate) => {
      if (candidate.numeroEsCero) {
        candidate.forceUbicacion = false;
        candidate.needsGeocode = false;
        return;
      }
      const existing = existingMap.get(candidate.documento);
      if (!existing) {
        candidate.forceUbicacion = true;
        candidate.needsGeocode = true;
        geocodeQueue.push(candidate);
        return;
      }
      const existingSignature = buildAddressSignature(
        existing.direccion_completa ?? "",
        existing.ciudad ?? "",
        existing.provincia ?? "",
        existing.codigo_postal ?? "",
      );
      if (existingSignature !== candidate.addressSignature) {
        candidate.forceUbicacion = true;
        candidate.needsGeocode = true;
        geocodeQueue.push(candidate);
        return;
      }
      const hasUbicacion = Boolean(existing.ubicacion);
      if (!hasUbicacion) {
        candidate.needsGeocode = true;
        geocodeQueue.push(candidate);
      }
    });

    let geocodedCount = 0;
    if (geocodeQueue.length) {
      if (!MAPBOX_TOKEN) {
        errors.push({
          row: 0,
          message:
            "MAPBOX token no configurado. Las direcciones nuevas/cambiadas quedaron sin geolocalizar.",
        });
      } else {
        if (SKIP_GEOCODING) {
          geocodedCount = 0;
          geocodeQueue.forEach((candidate) => {
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
          });
        } else {
          const geocodeCache = new Map<string, { lng: number; lat: number } | null>();
          for (const candidate of geocodeQueue) {
            const query = buildGeocodeQuery(candidate.data);
            if (!query) continue;
            let coords = geocodeCache.get(query);
            if (typeof coords === "undefined") {
              coords = await geocodeAddress(query, MAPBOX_TOKEN);
              geocodeCache.set(query, coords);
              if (coords) {
                geocodedCount += 1;
              }
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
        }
      }
    }

    const effectiveCandidates = candidates.filter((candidate) => !candidate.skip);
    const payload = effectiveCandidates.map((candidate) => {
      const { ubicacion, ...rest } = candidate.data;
      const base: Record<string, any> = {
        ...rest,
        telefono: rest.telefono ?? null,
        email: rest.email ?? null,
      };
      if (ubicacion) {
        base.ubicacion = `SRID=4326;POINT(${ubicacion.lng} ${ubicacion.lat})`;
      } else if (candidate.forceUbicacion) {
        base.ubicacion = null;
      }
      return base;
    });

    const adminClient = getServiceRoleClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Backend sin credenciales de servicio para importar" },
        { status: 500 },
      );
    }

    const { error: upsertError } = await adminClient
      .from("pacientes")
      .upsert(payload, { onConflict: "documento" });
    if (upsertError) {
      throw upsertError;
    }

    const inserted = effectiveCandidates.filter((c) => !existingSet.has(c.documento)).length;
    const updated = effectiveCandidates.length - inserted;

    let inactivated = 0;
    let prestacionesCancelled = 0;
    if (bajasDocumentos.length) {
      const bajasUpdatedAggregate: { id: string | null }[] = [];

      for (const chunk of chunkArray(bajasDocumentos, 1000)) {
        const { data: bajasUpdated, error: bajasError } = await adminClient
          .from("pacientes")
          .update({ activo: false })
          .in("documento", chunk)
          .select("id, documento");
        if (bajasError) {
          throw bajasError;
        }
        bajasUpdatedAggregate.push(...((bajasUpdated as { id: string | null }[]) || []));
      }
      inactivated = bajasUpdatedAggregate.length;

      const bajaPacienteIds = bajasUpdatedAggregate
        .map((row) => row.id)
        .filter((id): id is string => Boolean(id));

      if (bajaPacienteIds.length) {
        const motivo = "Cancelada automáticamente por baja del beneficiario";

        for (const chunk of chunkArray(bajaPacienteIds, 500)) {
          const { data: prestacionesPorCancelar, error: prestFetchError } = await adminClient
            .from("prestaciones")
            .select("id, notas, estado")
            .in("paciente_id", chunk)
            .neq("estado", "cancelada");
          if (prestFetchError) {
            throw prestFetchError;
          }

          if (!prestacionesPorCancelar || prestacionesPorCancelar.length === 0) {
            continue;
          }

          const updates: { id: string; estado: string; cronico: boolean; notas: string }[] = [];
          for (const row of prestacionesPorCancelar) {
            const notas = row.notas ? `${row.notas}\n${motivo}` : motivo;
            updates.push({
              id: row.id,
              estado: "cancelada",
              cronico: false,
              notas,
            });
          }

          if (updates.length === 0) {
            continue;
          }

          const { error: prestUpdateError } = await adminClient
            .from("prestaciones")
            .upsert(updates, { onConflict: "id" });
          if (prestUpdateError) {
            throw prestUpdateError;
          }

          prestacionesCancelled += updates.length;
        }
      }
    }

    const { count: activeCount, error: countError } = await supabase
      .from("pacientes")
      .select("id", { count: "exact", head: true })
      .eq("activo", true);
    if (countError) {
      throw countError;
    }

    return NextResponse.json({
      executedBy: {
        id: userRes.user.id,
        email: userRes.user.email,
      },
      summary: {
        processed: candidates.length,
        inserted,
        updated,
        errors: errors.length,
        geocoded: geocodedCount,
        inactivated,
        activeTotal: activeCount ?? null,
        prestacionesCancelled,
        pendingGeocodeCount: pendingGeocode.length,
      },
      errors,
      pendingGeocode,
    });
  } catch (error) {
    console.error("Error importando pacientes", error);
    return NextResponse.json(
      { error: "Error inesperado importando pacientes" },
      { status: 500 },
    );
  }
}
