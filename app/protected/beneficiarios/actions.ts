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

export async function listBeneficiarios() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pacientes")
    .select(
      "id, nombre, apellido, documento, direccion_completa, ciudad, provincia, activo"
    )
    .order("apellido", { ascending: true });
  return { data, error };
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
