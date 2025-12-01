"use server";

import { createClient } from "@/lib/supabase/server";

export type PrestadorResumen = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  email?: string | null;
  telefono?: string | null;
};

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

export async function getBeneficiarios() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, documento')
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error obteniendo beneficiarios:', error);
    return [];
  }

  return data || [];
}

export async function getPrestadoresDeBeneficiario(beneficiarioId: string) {
  const supabase = await createClient();
  const { data: prestaciones, error } = await supabase
    .from('prestaciones')
    .select('user_id')
    .eq('paciente_id', beneficiarioId)
    .not('user_id', 'is', null);

  if (error) {
    console.error('Error obteniendo prestadores del beneficiario:', error);
    return [] as { id: string; nombre: string; apellido: string; documento?: string | null }[];
  }

  const ids = Array.from(new Set((prestaciones || []).map((p) => p.user_id).filter(Boolean))) as string[];
  if (ids.length === 0) return [];

  const { data: prestadores, error: prestadoresError } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, documento, email, telefono')
    .in('id', ids)
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true });

  if (prestadoresError) {
    console.error('Error obteniendo datos de prestadores:', prestadoresError);
    return [] as PrestadorResumen[];
  }

  return (prestadores || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido,
    documento: p.documento ?? null,
    email: (p as any).email ?? null,
    telefono: (p as any).telefono ?? null,
  })) satisfies PrestadorResumen[];
}

export async function getTiposPrestacionDeBeneficiario(beneficiarioId: string, prestadorIds?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from('prestaciones')
    .select('tipo_prestacion')
    .eq('paciente_id', beneficiarioId);

  if (prestadorIds && prestadorIds.length > 0) {
    query = query.in('user_id', prestadorIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error obteniendo tipos de prestación por beneficiario:', error);
    return [] as string[];
  }

  const tipos = Array.from(
    new Set((data || []).map((r: any) => r.tipo_prestacion).filter(Boolean))
  ) as string[];
  tipos.sort((a, b) => a.localeCompare(b));
  return tipos;
}

export async function getPrestacionesReporteBeneficiario(
  beneficiarioId: string,
  fechaInicio: string,
  fechaFin: string,
  estado?: 'pendiente' | 'completada',
  prestadorIds?: string[],
  tiposPrestacion?: string[]
) {
  const supabase = await createClient();

  const { data: beneficiario, error: beneficiarioError } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, documento, email, telefono')
    .eq('id', beneficiarioId)
    .single();

  if (beneficiarioError) {
    console.error('Error obteniendo beneficiario:', beneficiarioError);
    return { data: null, error: beneficiarioError };
  }

  let query = supabase
    .from('prestaciones')
    .select('id, tipo_prestacion, fecha, monto, descripcion, estado, user_id')
    .eq('paciente_id', beneficiarioId)
    .gte('fecha', `${fechaInicio}T00:00:00-03:00`)
    .lte('fecha', `${fechaFin}T23:59:59-03:00`)
    .order('fecha', { ascending: true });

  if (estado) {
    query = query.eq('estado', estado);
  }
  if (prestadorIds && prestadorIds.length > 0) {
    query = query.in('user_id', prestadorIds);
  }
  if (tiposPrestacion && tiposPrestacion.length > 0) {
    query = query.in('tipo_prestacion', tiposPrestacion);
  }

  const { data: prestaciones, error: prestacionesError } = await query;

  if (prestacionesError) {
    console.error('Error obteniendo prestaciones del beneficiario:', prestacionesError);
    return { data: null, error: prestacionesError };
  }

  const prestadoresIdsFromResults = Array.from(
    new Set((prestaciones || []).map((p) => p.user_id).filter(Boolean))
  );

  let prestadoresMap = new Map();
  if (prestadoresIdsFromResults.length > 0) {
    const { data: prestadores } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, documento, email, telefono')
      .in('id', prestadoresIdsFromResults as string[]);

    prestadoresMap = new Map((prestadores || []).map((p) => [p.id, p]));
  }

  const prestacionesConPrestador = prestaciones?.map((p) => ({
    ...p,
    prestador: p.user_id ? prestadoresMap.get(p.user_id) || null : null,
  }));

  const totalPrestaciones = prestaciones?.length || 0;
  const montoTotal = prestaciones?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;

  return {
    data: {
      beneficiario,
      prestaciones: prestacionesConPrestador,
      totales: {
        cantidad: totalPrestaciones,
        monto: montoTotal,
      },
    },
    error: null,
  };
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
