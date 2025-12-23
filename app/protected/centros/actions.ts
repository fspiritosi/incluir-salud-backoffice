"use server";

import { createClient } from "@/lib/supabase/server";

function parseWKBPoint(wkbHex: string): { lng: number; lat: number } | null {
  try {
    const coordsHex = wkbHex.substring(18);
    const lngHex = coordsHex.substring(0, 16);
    const latHex = coordsHex.substring(16, 32);

    const lngBuffer = new ArrayBuffer(8);
    const lngView = new DataView(lngBuffer);
    for (let i = 0; i < 8; i++) {
      lngView.setUint8(i, parseInt(lngHex.substr(i * 2, 2), 16));
    }
    const lng = lngView.getFloat64(0, true);

    const latBuffer = new ArrayBuffer(8);
    const latView = new DataView(latBuffer);
    for (let i = 0; i < 8; i++) {
      latView.setUint8(i, parseInt(latHex.substr(i * 2, 2), 16));
    }
    const lat = latView.getFloat64(0, true);

    return { lng, lat };
  } catch {
    return null;
  }
}

export type CentroTipo = "geriatrico" | "escuela" | "centro medico" | "otro";

export type CentroRow = {
  id: string;
  nombre: string;
  tipo: CentroTipo;
  direccion_completa: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  radio_metros: number;
  activo: boolean | null;
  ubicacion: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export type CentroInput = {
  nombre: string;
  tipo: CentroTipo;
  direccion_completa: string;
  ciudad?: string | null;
  provincia?: string | null;
  codigo_postal?: string | null;
  radio_metros: number;
  activo: boolean;
  ubicacion: { lng: number; lat: number } | null;
};

const escapeIlikeValue = (value: string) => value.replace(/[%_\\]/g, (match) => `\\${match}`);

type ListCentrosParams = {
  search?: string;
  tipos?: CentroTipo[];
  activo?: "todos" | "si" | "no";
};

export async function listCentros(params: ListCentrosParams = {}) {
  const supabase = await createClient();
  const { search, tipos, activo } = params;

  let query = supabase
    .from("centros")
    .select(
      "id, nombre, tipo, direccion_completa, ciudad, provincia, codigo_postal, radio_metros, activo, ubicacion",
      { count: "exact" },
    );

  if (search?.trim()) {
    const sanitized = escapeIlikeValue(search.trim());
    const term = `%${sanitized}%`;
    query = query.or(`nombre.ilike.${term},direccion_completa.ilike.${term}`);
  }

  if (tipos && tipos.length > 0) {
    query = query.in("tipo", tipos);
  }

  if (activo === "si") {
    query = query.eq("activo", true);
  } else if (activo === "no") {
    query = query.eq("activo", false);
  }

  const { data, error, count } = await query.order("nombre", { ascending: true });

  if (error) {
    console.error("Error listando centros", error);
    return { data: null as CentroRow[] | null, total: 0, error };
  }

  return { data: (data || []) as CentroRow[], total: count ?? (data || []).length, error: null };
}

export async function getCentroById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("centros")
    .select(
      "id, nombre, tipo, direccion_completa, ciudad, provincia, codigo_postal, radio_metros, activo, ubicacion",
    )
    .eq("id", id)
    .single();

  if (data && data.ubicacion && typeof data.ubicacion === "string" && data.ubicacion.match(/^[0-9A-F]+$/i)) {
    const parsed = parseWKBPoint(data.ubicacion);
    if (parsed) {
      data.ubicacion = parsed;
    }
  }

  return { data, error };
}

export async function createCentro(values: CentroInput) {
  const supabase = await createClient();
  const payload: any = {
    ...values,
    ubicacion: values.ubicacion
      ? `SRID=4326;POINT(${values.ubicacion.lng} ${values.ubicacion.lat})`
      : null,
  };
  const { data, error } = await supabase.from("centros").insert([payload]).select("id").single();
  return { data, error };
}

export async function updateCentro(id: string, values: CentroInput) {
  const supabase = await createClient();
  const payload: any = {
    ...values,
    ubicacion: values.ubicacion
      ? `SRID=4326;POINT(${values.ubicacion.lng} ${values.ubicacion.lat})`
      : null,
  };
  const { data, error } = await supabase.from("centros").update(payload).eq("id", id).select("id").single();
  return { data, error };
}

export async function setCentroActivo(id: string, activo: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("centros")
    .update({ activo })
    .eq("id", id)
    .select("id, activo")
    .single();
  return { data, error };
}
