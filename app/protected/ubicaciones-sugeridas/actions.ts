"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RoleName } from "@/utils/permissions";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Faltan credenciales del servicio de Supabase (service role)");
    return null;
  }

  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

async function requireAuditorOrSuperAdmin() {
  const supabase = await createClient();
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  if (userError || !userRes?.user?.id) {
    throw new Error("Usuario no autenticado");
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("v_user_roles")
    .select("role")
    .eq("user_id", userRes.user.id);

  if (rolesError) {
    console.error("No se pudieron leer los roles del actor", rolesError);
    throw new Error("No autorizado");
  }

  const roles = (roleRows || []).map((row) => row.role as RoleName);
  if (!roles.includes("auditor") && !roles.includes("super_admin")) {
    throw new Error("No autorizado");
  }

  return { currentUserId: userRes.user.id, roles };
}

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

export type UbicacionCoords = { lng: number; lat: number };

export type PacienteUbicacionSugeridaRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  documento: string | null;
  direccion_completa: string | null;
  ciudad: string | null;
  provincia: string | null;
  ubicacion: UbicacionCoords | null;
  ubicacion_sugerida: UbicacionCoords | null;
  ubicacion_sugerida_at: string | null;
  ubicacion_sugerida_por: string | null;
  ubicacion_sugerida_por_nombre: string | null;
  ubicacion_sugerida_por_email: string | null;
  ubicacion_sugerida_precision_m: number | null;
};

export type CentroUbicacionSugeridaRow = {
  id: string;
  nombre: string | null;
  tipo: string | null;
  direccion_completa: string | null;
  ciudad: string | null;
  provincia: string | null;
  ubicacion: UbicacionCoords | null;
  ubicacion_sugerida: UbicacionCoords | null;
  ubicacion_sugerida_at: string | null;
  ubicacion_sugerida_por: string | null;
  ubicacion_sugerida_por_nombre: string | null;
  ubicacion_sugerida_por_email: string | null;
  ubicacion_sugerida_precision_m: number | null;
};

function normalizeCoords(value: unknown): UbicacionCoords | null {
  if (!value) return null;
  if (typeof value === "object") {
    const obj = value as any;
    const lng = Number(obj.lng);
    const lat = Number(obj.lat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lng, lat };
    }
    return null;
  }
  if (typeof value === "string" && value.match(/^[0-9A-F]+$/i)) {
    return parseWKBPoint(value);
  }
  return null;
}

type SuggestedByInfo = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
};

async function fetchSuggestedUsersMap(admin: SupabaseClient, ids: string[]) {
  const map = new Map<string, SuggestedByInfo>();
  if (!ids.length) return map;

  const { data, error } = await admin
    .from("profiles")
    .select("id, nombre, apellido, email")
    .in("id", ids);

  if (error) {
    console.error("No se pudo cargar info de usuarios que sugirieron ubicaciones", error);
    return map;
  }

  for (const row of data || []) {
    map.set(row.id, {
      id: row.id,
      nombre: row.nombre ?? null,
      apellido: row.apellido ?? null,
      email: row.email ?? null,
    });
  }

  return map;
}

export async function listPacientesConUbicacionSugerida() {
  try {
    await requireAuditorOrSuperAdmin();
  } catch (error) {
    return {
      data: null as PacienteUbicacionSugeridaRow[] | null,
      error: error instanceof Error ? error.message : "No autorizado",
    };
  }

  const admin = getAdminSupabase();
  if (!admin) {
    return { data: null, error: "Backend sin credenciales de servicio" };
  }

  const { data, error } = await admin
    .from("pacientes")
    .select(
      "id, nombre, apellido, documento, direccion_completa, ciudad, provincia, ubicacion, ubicacion_sugerida, ubicacion_sugerida_at, ubicacion_sugerida_por, ubicacion_sugerida_precision_m",
    )
    .not("ubicacion_sugerida", "is", null)
    .order("ubicacion_sugerida_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error listando pacientes con ubicación sugerida", error);
    return { data: null, error: "No se pudo cargar la lista" };
  }

  const suggestedByIds = (data || [])
    .map((row: any) => row.ubicacion_sugerida_por)
    .filter((id): id is string => !!id);
  const suggestedByMap = await fetchSuggestedUsersMap(admin, suggestedByIds);

  const mapped = (data || []).map((row: any) => {
    const suggestedBy = row.ubicacion_sugerida_por ? suggestedByMap.get(row.ubicacion_sugerida_por) : null;
    return {
      id: row.id,
      nombre: row.nombre ?? null,
      apellido: row.apellido ?? null,
      documento: row.documento ?? null,
      direccion_completa: row.direccion_completa ?? null,
      ciudad: row.ciudad ?? null,
      provincia: row.provincia ?? null,
      ubicacion: normalizeCoords(row.ubicacion),
      ubicacion_sugerida: normalizeCoords(row.ubicacion_sugerida),
      ubicacion_sugerida_at: row.ubicacion_sugerida_at ?? null,
      ubicacion_sugerida_por: row.ubicacion_sugerida_por ?? null,
      ubicacion_sugerida_por_nombre: suggestedBy ? `${suggestedBy.apellido}, ${suggestedBy.nombre}`.trim() : null,
      ubicacion_sugerida_por_email: suggestedBy?.email ?? null,
      ubicacion_sugerida_precision_m: row.ubicacion_sugerida_precision_m ?? null,
    };
  }) as PacienteUbicacionSugeridaRow[];

  return { data: mapped, error: null as string | null };
}

export async function listCentrosConUbicacionSugerida() {
  try {
    await requireAuditorOrSuperAdmin();
  } catch (error) {
    return {
      data: null as CentroUbicacionSugeridaRow[] | null,
      error: error instanceof Error ? error.message : "No autorizado",
    };
  }

  const admin = getAdminSupabase();
  if (!admin) {
    return { data: null, error: "Backend sin credenciales de servicio" };
  }

  const { data, error } = await admin
    .from("centros")
    .select(
      "id, nombre, tipo, direccion_completa, ciudad, provincia, ubicacion, ubicacion_sugerida, ubicacion_sugerida_at, ubicacion_sugerida_por, ubicacion_sugerida_precision_m",
    )
    .not("ubicacion_sugerida", "is", null)
    .order("ubicacion_sugerida_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error listando centros con ubicación sugerida", error);
    return { data: null, error: "No se pudo cargar la lista" };
  }

  const suggestedByIds = (data || [])
    .map((row: any) => row.ubicacion_sugerida_por)
    .filter((id): id is string => !!id);
  const suggestedByMap = await fetchSuggestedUsersMap(admin, suggestedByIds);

  const mapped = (data || []).map((row: any) => {
    const suggestedBy = row.ubicacion_sugerida_por ? suggestedByMap.get(row.ubicacion_sugerida_por) : null;
    return {
      id: row.id,
      nombre: row.nombre ?? null,
      tipo: row.tipo ?? null,
      direccion_completa: row.direccion_completa ?? null,
      ciudad: row.ciudad ?? null,
      provincia: row.provincia ?? null,
      ubicacion: normalizeCoords(row.ubicacion),
      ubicacion_sugerida: normalizeCoords(row.ubicacion_sugerida),
      ubicacion_sugerida_at: row.ubicacion_sugerida_at ?? null,
      ubicacion_sugerida_por: row.ubicacion_sugerida_por ?? null,
      ubicacion_sugerida_por_nombre: suggestedBy ? `${suggestedBy.apellido}, ${suggestedBy.nombre}`.trim() : null,
      ubicacion_sugerida_por_email: suggestedBy?.email ?? null,
      ubicacion_sugerida_precision_m: row.ubicacion_sugerida_precision_m ?? null,
    };
  }) as CentroUbicacionSugeridaRow[];

  return { data: mapped, error: null as string | null };
}

async function runWithAdmin(action: (admin: SupabaseClient) => Promise<void>) {
  await requireAuditorOrSuperAdmin();

  const admin = getAdminSupabase();
  if (!admin) {
    throw new Error("Backend sin credenciales de servicio");
  }

  await action(admin);
  revalidatePath("/protected/ubicaciones-sugeridas");
}

export async function aprobarUbicacionSugeridaPaciente(formData: FormData) {
  const pacienteId = String(formData.get("paciente_id") || "");
  if (!pacienteId) {
    return { success: false, error: "Beneficiario inválido" };
  }

  try {
    await runWithAdmin(async (admin) => {
      const { error } = await admin.rpc("aprobar_ubicacion_sugerida_paciente", {
        p_paciente_id: pacienteId,
      });
      if (error) {
        throw error;
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error aprobando ubicación sugerida de paciente", error);
    return { success: false, error: error instanceof Error ? error.message : "No se pudo aprobar" };
  }
}

export async function rechazarUbicacionSugeridaPaciente(formData: FormData) {
  const pacienteId = String(formData.get("paciente_id") || "");
  if (!pacienteId) {
    return { success: false, error: "Beneficiario inválido" };
  }

  try {
    await runWithAdmin(async (admin) => {
      const { error } = await admin.rpc("rechazar_ubicacion_sugerida_paciente", {
        p_paciente_id: pacienteId,
      });
      if (error) {
        throw error;
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error rechazando ubicación sugerida de paciente", error);
    return { success: false, error: error instanceof Error ? error.message : "No se pudo rechazar" };
  }
}

export async function aprobarUbicacionSugeridaCentro(formData: FormData) {
  const centroId = String(formData.get("centro_id") || "");
  if (!centroId) {
    return { success: false, error: "Centro inválido" };
  }

  try {
    await runWithAdmin(async (admin) => {
      const { error } = await admin.rpc("aprobar_ubicacion_sugerida_centro", {
        p_centro_id: centroId,
      });
      if (error) {
        throw error;
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error aprobando ubicación sugerida de centro", error);
    return { success: false, error: error instanceof Error ? error.message : "No se pudo aprobar" };
  }
}

export async function rechazarUbicacionSugeridaCentro(formData: FormData) {
  const centroId = String(formData.get("centro_id") || "");
  if (!centroId) {
    return { success: false, error: "Centro inválido" };
  }

  try {
    await runWithAdmin(async (admin) => {
      const { error } = await admin.rpc("rechazar_ubicacion_sugerida_centro", {
        p_centro_id: centroId,
      });
      if (error) {
        throw error;
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error rechazando ubicación sugerida de centro", error);
    return { success: false, error: error instanceof Error ? error.message : "No se pudo rechazar" };
  }
}
