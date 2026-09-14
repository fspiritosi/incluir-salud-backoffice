import * as XLSX from "xlsx";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { BeneficiarioInput } from "@/app/protected/beneficiarios/actions";

export const REQUIRED_HEADERS = [
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

export type RowError = {
  row: number;
  message: string;
};

export type PendingGeocodeRow = {
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

type LocalidadInfo = {
  nombre: string;
  codigoPostal: string;
};

type Lookups = {
  provincias: Map<number, string>;
  departamentos: Map<string, string>;
  localidades: Map<string, LocalidadInfo>;
};

export const MAPBOX_TOKEN =
  process.env.MAPBOX_API_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
export const SKIP_GEOCODING = process.env.SKIP_GEOCODING === "true";

export type CandidateRow = {
  data: BeneficiarioInput;
  rowNumber: number;
  documento: string;
  forceUbicacion: boolean;
  needsGeocode: boolean;
  addressSignature: string;
  numeroEsCero: boolean;
  skip?: boolean;
};

export type ExistingPacienteRow = {
  documento: string | null;
  direccion_completa: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  ubicacion: unknown;
};

export const HEADER_SHEET_OPTIONS = { header: 1, raw: true } as const;

export const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export const getServiceRoleClient = () => {
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

export const toStringSafe = (value: unknown) => {
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

export const buildLookups = (workbook: XLSX.WorkBook): Lookups => ({
  provincias: loadProvincias(workbook),
  departamentos: loadDepartamentos(workbook),
  localidades: loadLocalidades(workbook),
});

export const collectBajaDocumentos = (workbook: XLSX.WorkBook): string[] => {
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

export const buildAddressSignature = (
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

export const buildGeocodeQuery = (data: BeneficiarioInput) => {
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

const GEOCODE_TIMEOUT_MS = 10_000;

export async function geocodeAddress(query: string, token: string) {
  if (!token) {
    return null;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
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
    const response = await fetch(url, { signal: controller.signal });
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
    if ((error as Error)?.name === "AbortError") {
      console.error("Mapbox geocoding timeout", { query, timeoutMs: GEOCODE_TIMEOUT_MS });
    } else {
      console.error("Error calling Mapbox geocoding", error);
    }
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mapRowToBeneficiario = (
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

export const validateHeaders = (headers: unknown[]): string[] => {
  const normalized = headers.map((h) => toStringSafe(h));
  return REQUIRED_HEADERS.filter((required) => !normalized.includes(required));
};
