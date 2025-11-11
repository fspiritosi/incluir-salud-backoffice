"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPrestacionesReporte(
  prestadorId: string,
  fechaInicio: string, // Formato YYYY-MM-DD
  fechaFin: string,    // Formato YYYY-MM-DD
  estado?: 'pendiente' | 'completada',
  pacienteIds?: string[],
  tiposPrestacion?: string[]
) {
  const supabase = await createClient();

  const { data: prestador, error: prestadorError } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento, email, telefono")
    .eq("id", prestadorId)
    .single();

  if (prestadorError) {
    console.error("Error obteniendo prestador:", prestadorError);
    return { data: null, error: prestadorError };
  }

  // Consulta corregida con AND para rango exacto
  let query = supabase
    .from("prestaciones")
    .select(`id, tipo_prestacion, fecha, monto, descripcion, paciente_id, estado, 
             pacientes(nombre, apellido, documento)`)
    .eq("user_id", prestadorId)
    .gte("fecha", `${fechaInicio}T00:00:00-03:00`)
    .lte("fecha", `${fechaFin}T23:59:59-03:00`)
    .order("fecha", { ascending: true });

  if (estado) {
    query = query.eq("estado", estado);
  }
  if (pacienteIds && pacienteIds.length > 0) {
    query = query.in('paciente_id', pacienteIds);
  }
  if (tiposPrestacion && tiposPrestacion.length > 0) {
    query = query.in('tipo_prestacion', tiposPrestacion);
  }

  const { data: prestaciones, error: prestacionesError } = await query;

  if (prestacionesError) {
    console.error("Error obteniendo prestaciones:", prestacionesError);
    return { data: null, error: prestacionesError };
  }

  const pacienteIdsFromResults = Array.from(
    new Set(prestaciones?.map((p) => p.paciente_id).filter(Boolean))
  );

  let pacientesMap = new Map();
  if (pacienteIdsFromResults.length > 0) {
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, nombre, apellido, documento")
      .in("id", pacienteIdsFromResults);

    pacientesMap = new Map((pacientes || []).map((p) => [p.id, p]));
  }

  const prestacionesConPaciente = prestaciones?.map((p) => ({
    ...p,
    paciente: p.paciente_id ? pacientesMap.get(p.paciente_id) || null : null,
  }));

  const totalPrestaciones = prestaciones?.length || 0;
  const montoTotal = prestaciones?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;

  return {
    data: {
      prestador,
      prestaciones: prestacionesConPaciente,
      totales: {
        cantidad: totalPrestaciones,
        monto: montoTotal,
      },
    },
    error: null,
  };
}

export async function getPrestadores() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento")
    .eq("tipo_usuario", "prestador")
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error obteniendo prestadores:", error);
    return [];
  }

  return data || [];
}

export async function getPacientesDePrestador(prestadorId: string) {
  const supabase = await createClient();
  const { data: prestaciones, error } = await supabase
    .from('prestaciones')
    .select('paciente_id')
    .eq('user_id', prestadorId)
    .not('paciente_id', 'is', null);
  if (error) {
    console.error('Error obteniendo pacientes del prestador:', error);
    return [] as { id: string; nombre: string; apellido: string; documento?: string }[];
  }
  const ids = Array.from(new Set((prestaciones || []).map(p => p.paciente_id).filter(Boolean) as string[]));
  if (ids.length === 0) return [];
  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, documento')
    .in('id', ids)
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true });
  return (pacientes || []) as { id: string; nombre: string; apellido: string; documento?: string }[];
}

export async function getTiposPrestacionDePrestador(prestadorId: string, pacienteIds?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from('prestaciones')
    .select('tipo_prestacion')
    .eq('user_id', prestadorId);
  if (pacienteIds && pacienteIds.length > 0) {
    query = query.in('paciente_id', pacienteIds);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error obteniendo tipos de prestación:', error);
    return [] as string[];
  }
  const tipos = Array.from(
    new Set((data || []).map((r: any) => r.tipo_prestacion).filter(Boolean))
  ) as string[];
  tipos.sort((a, b) => a.localeCompare(b));
  return tipos;
}
