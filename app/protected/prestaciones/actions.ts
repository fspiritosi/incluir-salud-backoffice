"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export type PrestacionInput = {
  tipo_prestacion: string; // enum in DB
  obra_social_id?: string | null;
  fecha: string; // ISO string
  estado?: string | null; // enum in DB, default pendiente
  monto?: number | null;
  descripcion?: string | null;
  notas?: string | null;
  paciente_id?: string | null;
  user_id: string; // selected provider user id (FK -> auth.users.id)
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null as any;
  return createAdminClient(url, serviceKey);
}

export async function listPrestadoresForSelect() {
  const supabase = await createClient();
  
  // Query directo a la tabla profiles - solo prestadores activos
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento")
    .eq("tipo_usuario", "prestador")
    .eq("activo", true)
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error('Error listando prestadores:', error);
    return { 
      data: [] as { id: string; apellido: string; nombre: string; documento?: string }[], 
      error 
    };
  }

  console.log('Prestadores activos encontrados:', data?.length || 0);
  return { 
    data: (data || []) as { id: string; apellido: string; nombre: string; documento?: string }[], 
    error: null 
  };
}

export async function listPrestaciones() {
  const supabase = await createClient();

  // Primero obtenemos las prestaciones base
  const { data: prestaciones, error } = await supabase
    .from("prestaciones")
    .select("id, tipo_prestacion, fecha, estado, monto, user_id, paciente_id")
    .order("fecha", { ascending: false });

  if (error) {
    console.error('Error listando prestaciones:', error);
    return { data: null as any, error };
  }

  if (!prestaciones || prestaciones.length === 0) {
    return { data: [], error: null };
  }

  // Obtener IDs únicos de pacientes y prestadores
  const pacienteIds = Array.from(new Set(prestaciones.map(p => p.paciente_id).filter(Boolean)));
  const prestadorIds = Array.from(new Set(prestaciones.map(p => p.user_id).filter(Boolean)));

  // Obtener datos de pacientes
  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("id, nombre, apellido, documento")
    .in("id", pacienteIds);

  // Obtener datos de prestadores desde profiles
  const { data: prestadores } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento")
    .in("id", prestadorIds);

  // Crear maps para búsqueda rápida
  const pacientesMap = new Map((pacientes || []).map(p => [p.id, p]));
  const prestadoresMap = new Map((prestadores || []).map(p => [p.id, p]));

  // Combinar los datos
  const data = prestaciones.map(p => ({
    id: p.id,
    tipo_prestacion: p.tipo_prestacion,
    fecha: p.fecha,
    estado: p.estado,
    monto: p.monto,
    user_id: p.user_id,
    paciente: p.paciente_id ? pacientesMap.get(p.paciente_id) || null : null,
    prestador: p.user_id ? prestadoresMap.get(p.user_id) || null : null,
  }));

  return { 
    data: data as Array<{
      id: string;
      tipo_prestacion: string;
      fecha: string;
      estado: string | null;
      monto: number | null;
      user_id?: string | null;
      paciente: { id: string; nombre: string; apellido: string; documento: string } | null;
      prestador: { id: string; nombre: string; apellido: string; documento?: string } | null;
    }> | null, 
    error: null 
  };
}

export async function getPrestacionById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prestaciones")
    .select(
      "id, tipo_prestacion, obra_social_id, fecha, estado, monto, descripcion, notas, paciente_id, user_id"
    )
    .eq("id", id)
    .single();
  return { data, error };
}

export async function createPrestacion(values: PrestacionInput) {
  const supabase = await createClient();
  
  // Obtener datos del prestador desde profiles
  let fullName: string | null = null;
  let dni: string | null = null;
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, documento")
    .eq("id", values.user_id)
    .single();
  
  if (profile) {
    fullName = [profile.apellido, profile.nombre].filter(Boolean).join(', ') || null;
    dni = profile.documento || null;
  }

  const payload: any = {
    ...values,
    estado: values.estado ?? "pendiente",
    user_id: values.user_id,
  };
  
  const { data, error } = await supabase
    .from("prestaciones")
    .insert([payload])
    .select("id")
    .single();
  return { data, error };
}

export async function createPrestacionesBulk(common: Omit<PrestacionInput, 'fecha'>, fechas: string[]) {
  const supabase = await createClient();
  if (!Array.isArray(fechas) || fechas.length === 0) {
    return { data: null, error: { message: 'No hay fechas para insertar' } } as const;
  }
  // Normalizar y limitar a 60
  const sanitized = fechas
    .map(f => {
      try { return new Date(f).toISOString(); } catch { return null; }
    })
    .filter((f): f is string => !!f)
    .slice(0, 60);
  if (sanitized.length === 0) {
    return { data: null, error: { message: 'Fechas inválidas' } } as const;
  }

  const records = sanitized.map((f) => ({
    ...common,
    fecha: f,
    estado: common.estado ?? 'pendiente',
    user_id: common.user_id,
    monto: common.monto == null ? null : Number(common.monto),
  }));

  const { data, error } = await supabase
    .from('prestaciones')
    .insert(records)
    .select('id');

  if (error) return { data: null, error } as const;
  return { data, error: null } as const;
}

export async function updatePrestacion(id: string, values: PrestacionInput) {
  const supabase = await createClient();
  
  // Obtener datos del prestador desde profiles
  let fullName: string | null = null;
  let dni: string | null = null;
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, documento")
    .eq("id", values.user_id)
    .single();
  
  if (profile) {
    fullName = [profile.apellido, profile.nombre].filter(Boolean).join(', ') || null;
    dni = profile.documento || null;
  }

  const payload: any = {
    ...values,
    user_id: values.user_id,
  };
  
  const { data, error } = await supabase
    .from("prestaciones")
    .update(payload)
    .eq("id", id)
    .select("id")
    .single();
  return { data, error };
}

export async function listPacientesForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nombre, apellido")
    .order("apellido", { ascending: true });
  return { data, error } as { data: { id: string; nombre: string; apellido: string }[] | null; error: any };
}

export async function listObrasSocialesForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obras_sociales")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  return { data, error } as { data: { id: string; nombre: string }[] | null; error: any };
}
