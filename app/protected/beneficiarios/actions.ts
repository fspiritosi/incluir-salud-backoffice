"use server";

import { createClient } from "@/lib/supabase/server";

// Parse WKB (Well-Known Binary) hexadecimal string to extract Point coordinates
function parseWKBPoint(wkbHex: string): { lng: number; lat: number } | null {
  try {
    // WKB format for Point with SRID:
    // 01 = byte order (little endian)
    // 01000020 = geometry type (Point with SRID)
    // E6100000 = SRID (4326 in little endian)
    // Next 8 bytes = X coordinate (longitude) as double
    // Next 8 bytes = Y coordinate (latitude) as double
    
    // Skip first 9 bytes (byte order + type + SRID) = 18 hex chars
    const coordsHex = wkbHex.substring(18);
    
    // Extract X (longitude) - next 16 hex chars
    const lngHex = coordsHex.substring(0, 16);
    // Extract Y (latitude) - next 16 hex chars  
    const latHex = coordsHex.substring(16, 32);
    
    // Convert hex to double (IEEE 754)
    const lngBuffer = new ArrayBuffer(8);
    const lngView = new DataView(lngBuffer);
    for (let i = 0; i < 8; i++) {
      lngView.setUint8(i, parseInt(lngHex.substr(i * 2, 2), 16));
    }
    const lng = lngView.getFloat64(0, true); // true = little endian
    
    const latBuffer = new ArrayBuffer(8);
    const latView = new DataView(latBuffer);
    for (let i = 0; i < 8; i++) {
      latView.setUint8(i, parseInt(latHex.substr(i * 2, 2), 16));
    }
    const lat = latView.getFloat64(0, true);
    
    console.log('Parsed WKB to coordinates:', { lng, lat });
    return { lng, lat };
  } catch (e) {
    console.error('Failed to parse WKB:', e);
    return null;
  }
}

export async function getBeneficiarioById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pacientes")
    .select(
      "id, nombre, apellido, documento, telefono, email, direccion_completa, ciudad, provincia, codigo_postal, activo, ubicacion"
    )
    .eq("id", id)
    .single();
  
  console.log('=== getBeneficiarioById ===');
  console.log('ID:', id);
  console.log('Data.ubicacion (raw from DB):', data?.ubicacion);
  console.log('Type:', typeof data?.ubicacion);
  
  // Parse WKB hexadecimal to {lng, lat} format
  if (data && data.ubicacion && typeof data.ubicacion === 'string' && data.ubicacion.match(/^[0-9A-F]+$/i)) {
    const parsed = parseWKBPoint(data.ubicacion);
    if (parsed) {
      data.ubicacion = parsed;
      console.log('Converted WKB to lng/lat:', data.ubicacion);
    }
  }
  
  return { data, error };
}

type ListBeneficiariosParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  ciudades?: string[];
  provincias?: string[];
  activo?: "todos" | "si" | "no";
  ids?: string[];
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;

const escapeIlikeValue = (value: string) => value.replace(/[%_\\]/g, (match) => `\\${match}`);

export async function listBeneficiarios(params: ListBeneficiariosParams = {}) {
  const supabase = await createClient();
  const page = Math.max(DEFAULT_PAGE, Number(params.page) || DEFAULT_PAGE);
  const rawPageSize = Number(params.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, rawPageSize), MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { search, ciudades, provincias, activo, ids } = params;

  let query = supabase
    .from("pacientes")
    .select(
      "id, nombre, apellido, documento, direccion_completa, ciudad, provincia, activo, ubicacion",
      { count: "exact" }
    );

  if (search?.trim()) {
    const sanitized = escapeIlikeValue(search.trim());
    const term = `%${sanitized}%`;
    query = query.or(
      `nombre.ilike.${term},apellido.ilike.${term},documento.ilike.${term}`
    );
  }

  if (ciudades && ciudades.length > 0) {
    query = query.in("ciudad", ciudades);
  }

  if (provincias && provincias.length > 0) {
    query = query.in("provincia", provincias);
  }

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  if (activo === "si") {
    query = query.eq("activo", true);
  } else if (activo === "no") {
    query = query.eq("activo", false);
  }

  const { data, error, count } = await query
    .order("apellido", { ascending: true })
    .range(from, to);
  const enriched = (data || []).map((row) => ({
    ...row,
    tiene_ubicacion: Boolean(row.ubicacion),
  }));
  return { data: enriched, total: count ?? enriched.length, error };
}

type SearchBeneficiariosParams = {
  query?: string;
  page?: number;
  pageSize?: number;
  includeInactivos?: boolean;
  ids?: string[];
};

const DEFAULT_SEARCH_PAGE_SIZE = 25;
const MAX_SEARCH_PAGE_SIZE = 100;

export async function searchBeneficiariosIdentidad(
  params: SearchBeneficiariosParams = {}
) {
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page) || 1);
  const rawPageSize = Number(params.pageSize) || DEFAULT_SEARCH_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, rawPageSize), MAX_SEARCH_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("pacientes")
    .select("id, nombre, apellido, documento, activo", { count: "exact" })
    .order("apellido", { ascending: true });

  if (params.ids && params.ids.length > 0) {
    query = query.in("id", params.ids);
  }

  if (params.query?.trim()) {
    const sanitized = escapeIlikeValue(params.query.trim());
    const term = `%${sanitized}%`;
    query = query.or(
      `nombre.ilike.${term},apellido.ilike.${term},documento.ilike.${term}`
    );
  }

  if (!params.includeInactivos) {
    query = query.eq("activo", true);
  }

  if (params.ids && params.ids.length > 0) {
    const { data, error } = await query;
    const payload = data || [];
    return {
      data: payload,
      total: payload.length,
      page: 1,
      pageSize: payload.length || params.ids.length,
      error,
    };
  }

  const { data, error, count } = await query.range(from, to);

  return {
    data: data || [],
    total: count ?? data?.length ?? 0,
    page,
    pageSize,
    error,
  };
}

export type BeneficiarioInput = {
  nombre: string;
  apellido: string;
  documento: string;
  telefono?: string | null;
  email?: string | null;
  direccion_completa: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  activo: boolean;
  ubicacion: null | { lng: number; lat: number };
};

export async function createBeneficiario(values: BeneficiarioInput) {
  const supabase = await createClient();
  const payload: any = {
    ...values,
    ubicacion: values.ubicacion ? `SRID=4326;POINT(${values.ubicacion.lng} ${values.ubicacion.lat})` : null,
  };
  const { data, error } = await supabase.from("pacientes").insert([payload]).select("id").single();
  return { data, error };
}

export async function updateBeneficiario(id: string, values: BeneficiarioInput) {
  const supabase = await createClient();
  const payload: any = {
    ...values,
    ubicacion: values.ubicacion ? `SRID=4326;POINT(${values.ubicacion.lng} ${values.ubicacion.lat})` : null,
  };
  console.log('=== updateBeneficiario ===');
  console.log('ID:', id);
  console.log('Values.ubicacion:', values.ubicacion);
  console.log('Payload.ubicacion (EWKT):', payload.ubicacion);
  const { data, error } = await supabase.from("pacientes").update(payload).eq("id", id).select("id").single();
  return { data, error };
}

export async function setBeneficiarioActivo(id: string, activo: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pacientes")
    .update({ activo })
    .eq("id", id)
    .select("id, activo")
    .single();
  return { data, error };
}

type PrestadorInfo = {
  id: string;
  nombre: string;
  apellido: string;
  documento?: string | null;
};

export type PrestacionPaciente = {
  id: string;
  tipo_prestacion: string;
  fecha: string;
  estado: string | null;
  monto: number | null;
  cronico: boolean | null;
  user_id: string | null;
  prestador: PrestadorInfo | null;
  notas: string | null;
};

type PrestacionPacienteRange = {
  startDate?: string | null;
  endDate?: string | null;
};

export async function getPrestacionesByPaciente(pacienteId: string, range: PrestacionPacienteRange = {}) {
  const supabase = await createClient();
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  let queryStartDate = defaultStart;
  let queryEndDate = defaultEnd;

  if (range.startDate) {
    const parsedStart = new Date(`${range.startDate}T00:00:00`);
    if (!Number.isNaN(parsedStart.getTime())) {
      queryStartDate = parsedStart;
    }
  }

  if (range.endDate) {
    const parsedEnd = new Date(`${range.endDate}T23:59:59.999`);
    if (!Number.isNaN(parsedEnd.getTime())) {
      queryEndDate = parsedEnd;
    }
  }

  if (queryStartDate > queryEndDate) {
    const temp = queryStartDate;
    queryStartDate = queryEndDate;
    queryEndDate = temp;
  }

  const { data: prestaciones, error } = await supabase
    .from("prestaciones")
    .select("id, tipo_prestacion, fecha, estado, monto, cronico, user_id, notas")
    .eq("paciente_id", pacienteId)
    .gte("fecha", queryStartDate.toISOString())
    .lt("fecha", queryEndDate.toISOString())
    .order("fecha", { ascending: false });

  if (error) {
    console.error("Error listando prestaciones del paciente", error);
    return { data: null as PrestacionPaciente[] | null, error };
  }

  const prestadorIds = Array.from(
    new Set((prestaciones || []).map(p => p.user_id).filter(Boolean) as string[])
  );

  let prestadoresMap = new Map<string, PrestadorInfo>();
  if (prestadorIds.length > 0) {
    const { data: prestadores } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, documento")
      .in("id", prestadorIds);
    prestadoresMap = new Map((prestadores || []).map(p => [p.id, p]));
  }

  const data: PrestacionPaciente[] = (prestaciones || []).map(p => ({
    id: p.id,
    tipo_prestacion: p.tipo_prestacion,
    fecha: p.fecha,
    estado: p.estado,
    monto: p.monto,
    cronico: p.cronico,
    user_id: p.user_id,
    prestador: p.user_id ? prestadoresMap.get(p.user_id) || null : null,
    notas: (p as any).notas ?? null,
  }));

  return { data, error: null };
}

function projectToNextMonth(fecha: string, nextMonthStart: Date) {
  const original = new Date(fecha);
  if (Number.isNaN(original.getTime())) return null;
  const dow = original.getDay();
  const weekIndex = Math.floor((original.getDate() - 1) / 7);

  const anchor = new Date(nextMonthStart);
  const firstDow = anchor.getDay();
  const diff = (dow - firstDow + 7) % 7;
  anchor.setDate(anchor.getDate() + diff + weekIndex * 7);

  if (anchor.getMonth() !== nextMonthStart.getMonth()) {
    return null;
  }

  anchor.setHours(original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds());
  return anchor;
}

export async function clonePrestacionesCronicasPaciente(pacienteId: string) {
  const supabase = await createClient();
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const followingMonthStart = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  const { data: cronicas, error } = await supabase
    .from("prestaciones")
    .select(
      "id, tipo_prestacion, fecha, estado, monto, descripcion, notas, user_id, obra_social_id, cronico"
    )
    .eq("paciente_id", pacienteId)
    .eq("cronico", true)
    .gte("fecha", currentMonthStart.toISOString())
    .lt("fecha", nextMonthStart.toISOString());

  if (error) {
    throw error;
  }

  if (!cronicas || cronicas.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const candidates = cronicas
    .map(row => {
      const projected = projectToNextMonth(row.fecha, nextMonthStart);
      if (!projected) return null;
      return {
        source: row,
        targetDate: projected,
      };
    })
    .filter(Boolean) as { source: typeof cronicas[number]; targetDate: Date }[];

  if (candidates.length === 0) {
    return { created: 0, skipped: cronicas.length };
  }

  const { data: existingNextMonth } = await supabase
    .from("prestaciones")
    .select("fecha, tipo_prestacion")
    .eq("paciente_id", pacienteId)
    .gte("fecha", nextMonthStart.toISOString())
    .lt("fecha", followingMonthStart.toISOString());

  const existingKeys = new Set(
    (existingNextMonth || []).map(item => {
      const normalized = new Date(item.fecha);
      return `${item.tipo_prestacion}__${normalized.toISOString()}`;
    })
  );

  const rowsToInsert = candidates.filter(candidate => {
    const key = `${candidate.source.tipo_prestacion}__${candidate.targetDate.toISOString()}`;
    return !existingKeys.has(key);
  });

  if (rowsToInsert.length === 0) {
    return { created: 0, skipped: candidates.length };
  }

  const payload = rowsToInsert.map(({ source, targetDate }) => ({
    tipo_prestacion: source.tipo_prestacion,
    fecha: targetDate.toISOString(),
    estado: source.estado ?? "pendiente",
    monto: source.monto,
    descripcion: source.descripcion,
    notas: source.notas,
    paciente_id: pacienteId,
    user_id: source.user_id,
    obra_social_id: source.obra_social_id,
    cronico: true,
  }));

  const { error: insertError } = await supabase.from("prestaciones").insert(payload);
  if (insertError) {
    throw insertError;
  }

  return { created: payload.length, skipped: candidates.length - payload.length };
}

// Provincias y ciudades para selects dependientes
export type Province = { id: number; name: string };
export type City = { id: number; name: string; province_id: number };

export async function getProvinces() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('provinces')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) {
    console.error('Error fetching provinces:', error);
    return { data: [] as Province[], error };
  }
  return { data: (data || []) as Province[], error: null };
}

export async function getCitiesByProvince(provinceId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, province_id')
    .eq('province_id', provinceId)
    .order('name', { ascending: true });
  if (error) {
    console.error('Error fetching cities:', error);
    return { data: [] as City[], error };
  }
  return { data: (data || []) as City[], error: null };
}
