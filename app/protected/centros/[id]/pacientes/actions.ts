"use server";

import { createClient } from "@/lib/supabase/server";

export type PacienteCentro = {
  id: string;
  paciente_id: string;
  centro_id: string;
  desde: string;
  hasta: string | null;
  activo: boolean;
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_documento: string;
};

export type PacienteDisponible = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
};

export async function listPacientesCentro(centroId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("paciente_centros")
    .select(`
      id,
      paciente_id,
      centro_id,
      desde,
      hasta,
      activo,
      pacientes (
        nombre,
        apellido,
        documento
      )
    `)
    .eq("centro_id", centroId)
    .order("activo", { ascending: false });

  if (error) {
    console.error("Error listando pacientes del centro", error);
    return { data: null, error };
  }

  const mapped: PacienteCentro[] = (data || []).map((row: any) => ({
    id: row.id,
    paciente_id: row.paciente_id,
    centro_id: row.centro_id,
    desde: row.desde,
    hasta: row.hasta,
    activo: row.activo ?? true,
    paciente_nombre: row.pacientes?.nombre || "",
    paciente_apellido: row.pacientes?.apellido || "",
    paciente_documento: row.pacientes?.documento || "",
  }));

  return { data: mapped, error: null };
}

export async function listPacientesDisponibles(centroId: string, search?: string) {
  const supabase = await createClient();

  // Obtener IDs de pacientes ya asignados al centro
  const { data: asignados } = await supabase
    .from("paciente_centros")
    .select("paciente_id")
    .eq("centro_id", centroId)
    .eq("activo", true);

  const idsAsignados = (asignados || []).map((r) => r.paciente_id);

  let query = supabase
    .from("pacientes")
    .select("id, nombre, apellido, documento")
    .eq("activo", true)
    .order("apellido", { ascending: true })
    .limit(50);

  if (idsAsignados.length > 0) {
    query = query.not("id", "in", `(${idsAsignados.join(",")})`);
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`nombre.ilike.${term},apellido.ilike.${term},documento.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error listando pacientes disponibles", error);
    return { data: null, error };
  }

  return { data: data as PacienteDisponible[], error: null };
}

export async function asignarPacienteACentro(centroId: string, pacienteId: string) {
  const supabase = await createClient();

  // Verificar si ya existe (incluso inactivo)
  const { data: existing } = await supabase
    .from("paciente_centros")
    .select("id, activo")
    .eq("centro_id", centroId)
    .eq("paciente_id", pacienteId)
    .single();

  if (existing) {
    if (existing.activo) {
      return { data: null, error: { message: "El paciente ya está asignado a este centro" } };
    }
    // Reactivar
    const { data, error } = await supabase
      .from("paciente_centros")
      .update({ activo: true, desde: new Date().toISOString().split("T")[0], hasta: null })
      .eq("id", existing.id)
      .select("id")
      .single();
    return { data, error };
  }

  const { data, error } = await supabase
    .from("paciente_centros")
    .insert({
      centro_id: centroId,
      paciente_id: pacienteId,
      activo: true,
    })
    .select("id")
    .single();

  return { data, error };
}

export async function desasignarPacienteDeCentro(pacienteCentroId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("paciente_centros")
    .update({ activo: false, hasta: new Date().toISOString().split("T")[0] })
    .eq("id", pacienteCentroId)
    .select("id")
    .single();

  return { data, error };
}

export async function getCentroNombre(centroId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("centros")
    .select("nombre")
    .eq("id", centroId)
    .single();
  return data?.nombre || "Centro";
}
