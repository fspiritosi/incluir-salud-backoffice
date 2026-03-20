"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export type PrestacionInput = {
  tipo_prestacion: string; // enum in DB
  obra_social_id?: string | null;
  fecha: string; // ISO string
  estado?: string | null; // enum in DB, default pendiente
  cronico?: boolean | null;
  monto?: number | null;
  descripcion?: string | null;
  notas?: string | null;
  paciente_id?: string | null;
  user_id: string; // selected provider user id (FK -> auth.users.id)
  centro_id?: string | null;
  sentido_transporte?: 'ida' | 'vuelta' | 'ida_y_vuelta' | null;
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null as any;
  return createAdminClient(url, serviceKey);
}

// Helper para extraer solo la fecha (YYYY-MM-DD) de un ISO string
function extractDateOnly(isoString: string): string {
  return isoString.split('T')[0];
}

// Normalizar fecha-hora a ISO
const normalizeDateTimeIso = (value: string) => {
  try {
    return new Date(value).toISOString();
  } catch {
    return value;
  }
};

// Detectar conflictos: mismo paciente, mismo tipo y misma fecha/hora (sin importar prestador)
async function findConflictingPrestaciones(
  supabase: any,
  records: Array<{ paciente_id?: string | null; tipo_prestacion: string; fecha: string }>
): Promise<{ paciente_id: string | null | undefined; fecha: string; tipo_prestacion: string }[]> {
  if (!records.length) return [];

  const pacientesIds = [...new Set(records.map((r) => r.paciente_id).filter(Boolean))] as string[];
  const tipos = [...new Set(records.map((r) => r.tipo_prestacion))];
  const fechasNorm = records.map((r) => normalizeDateTimeIso(r.fecha)).filter(Boolean) as string[];

  if (!pacientesIds.length || !tipos.length || !fechasNorm.length) return [];

  const sortedFechas = [...fechasNorm].sort();
  const minFecha = sortedFechas[0];
  const maxFecha = sortedFechas[sortedFechas.length - 1];

  const { data: existing, error } = await supabase
    .from("prestaciones")
    .select("paciente_id, fecha, tipo_prestacion")
    .in("paciente_id", pacientesIds)
    .in("tipo_prestacion", tipos)
    .gte("fecha", minFecha)
    .lte("fecha", maxFecha);

  if (error || !existing) return [];

  const existingKeys = new Set(
    existing.map(
      (e: any) => `${e.paciente_id || 'null'}|${normalizeDateTimeIso(e.fecha)}|${e.tipo_prestacion}`
    )
  );

  return records.filter((r) =>
    existingKeys.has(`${r.paciente_id || 'null'}|${normalizeDateTimeIso(r.fecha)}|${r.tipo_prestacion}`)
  ).map((r) => ({ paciente_id: r.paciente_id, fecha: normalizeDateTimeIso(r.fecha), tipo_prestacion: r.tipo_prestacion }));
}

// Verificar si ya existe una prestación con los mismos datos clave
async function checkDuplicatePrestacion(
  supabase: any,
  params: {
    paciente_id?: string | null;
    user_id: string;
    tipo_prestacion: string;
    fecha: string;
    centro_id?: string | null;
    sentido_transporte?: string | null;
  }
): Promise<{ exists: boolean; error?: any }> {
  const fechaDate = extractDateOnly(params.fecha);
  
  let query = supabase
    .from("prestaciones")
    .select("id")
    .eq("tipo_prestacion", params.tipo_prestacion)
    .eq("user_id", params.user_id)
    .gte("fecha", `${fechaDate}T00:00:00.000Z`)
    .lt("fecha", `${fechaDate}T23:59:59.999Z`);

  if (params.paciente_id) {
    query = query.eq("paciente_id", params.paciente_id);
  } else {
    query = query.is("paciente_id", null);
  }

  if (params.centro_id) {
    query = query.eq("centro_id", params.centro_id);
  } else {
    query = query.is("centro_id", null);
  }

  if (params.sentido_transporte) {
    query = query.eq("sentido_transporte", params.sentido_transporte);
  } else {
    query = query.is("sentido_transporte", null);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    return { exists: false, error };
  }

  return { exists: (data?.length || 0) > 0 };
}

// Filtrar registros que ya existen en la base de datos
async function filterExistingPrestaciones(
  supabase: any,
  records: Array<{
    paciente_id?: string | null;
    user_id: string;
    tipo_prestacion: string;
    fecha: string;
    centro_id?: string | null;
    sentido_transporte?: string | null;
    [key: string]: any;
  }>
): Promise<{ newRecords: typeof records; duplicateCount: number }> {
  if (records.length === 0) return { newRecords: [], duplicateCount: 0 };

  // Obtener todas las fechas únicas para buscar
  const fechas = [...new Set(records.map(r => extractDateOnly(r.fecha)))];
  const minFecha = `${fechas.sort()[0]}T00:00:00.000Z`;
  const maxFecha = `${fechas.sort().reverse()[0]}T23:59:59.999Z`;

  // Buscar prestaciones existentes en el rango de fechas
  const { data: existing, error } = await supabase
    .from("prestaciones")
    .select("paciente_id, user_id, tipo_prestacion, fecha, centro_id, sentido_transporte")
    .gte("fecha", minFecha)
    .lte("fecha", maxFecha);

  if (error || !existing) {
    // Si hay error, intentar insertar todos (la DB rechazará duplicados si hay constraint)
    return { newRecords: records, duplicateCount: 0 };
  }

  // Crear un Set de claves únicas de prestaciones existentes
  const existingKeys = new Set(
    existing.map((e: any) => 
      `${e.paciente_id || 'null'}|${e.user_id}|${e.tipo_prestacion}|${extractDateOnly(e.fecha)}|${e.centro_id || 'null'}|${e.sentido_transporte || 'null'}`
    )
  );

  // Filtrar registros que no existen
  const newRecords = records.filter(r => {
    const key = `${r.paciente_id || 'null'}|${r.user_id}|${r.tipo_prestacion}|${extractDateOnly(r.fecha)}|${r.centro_id || 'null'}|${r.sentido_transporte || 'null'}`;
    return !existingKeys.has(key);
  });

  return { newRecords, duplicateCount: records.length - newRecords.length };
}

// Filtrar prestadores por especialidad que debe coincidir con el tipo de prestación seleccionado
export async function listPrestadoresByEspecialidad(especialidad: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, documento')
    .eq('tipo_usuario', 'prestador')
    .eq('activo', true)
    .eq('especialidad', especialidad)
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true });
  if (error) {
    console.error('Error listando prestadores por especialidad:', error);
    return { data: [] as { id: string; apellido: string; nombre: string; documento?: string }[], error };
  }
  return { data: (data || []) as { id: string; apellido: string; nombre: string; documento?: string }[], error: null };
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

type ListPrestacionesParams = {
  fechaDesde?: string;
  fechaHasta?: string;
  pacienteIds?: string[];
};

const parseDateInput = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDayIso = (date: Date) => {
  const clone = new Date(date);
  clone.setUTCHours(0, 0, 0, 0);
  return clone.toISOString();
};

const endOfDayIso = (date: Date) => {
  const clone = new Date(date);
  clone.setUTCHours(23, 59, 59, 999);
  return clone.toISOString();
};

const normalizeStringArray = (values: string[] = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

export async function listPrestaciones(params: ListPrestacionesParams = {}) {
  const supabase = await createClient();

  const filters = {
    fechaDesde: params.fechaDesde?.trim() ?? "",
    fechaHasta: params.fechaHasta?.trim() ?? "",
    pacienteIds: normalizeStringArray(params.pacienteIds),
  };

  let query = supabase
    .from("prestaciones")
    .select("id, tipo_prestacion, fecha, estado, monto, user_id, paciente_id, cronico, sentido_transporte")
    .neq("tipo_prestacion", "Transporte")
    .order("fecha", { ascending: false });

  if (filters.fechaDesde) {
    const parsed = parseDateInput(filters.fechaDesde);
    if (parsed) {
      query = query.gte("fecha", startOfDayIso(parsed));
    }
  }

  if (filters.fechaHasta) {
    const parsed = parseDateInput(filters.fechaHasta);
    if (parsed) {
      query = query.lte("fecha", endOfDayIso(parsed));
    }
  }

  if (filters.pacienteIds.length > 0) {
    query = query.in("paciente_id", filters.pacienteIds);
  }

  const { data: prestaciones, error } = await query;

  if (error) {
    console.error("Error listando prestaciones:", error);
    return { data: null as any, error };
  }

  if (!prestaciones || prestaciones.length === 0) {
    return { data: [], error: null };
  }

  const pacienteIds = Array.from(new Set(prestaciones.map((p) => p.paciente_id).filter(Boolean)));
  const prestadorIds = Array.from(new Set(prestaciones.map((p) => p.user_id).filter(Boolean)));

  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("id, nombre, apellido, documento")
    .in("id", pacienteIds);

  const { data: prestadores } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento")
    .in("id", prestadorIds);

  const pacientesMap = new Map((pacientes || []).map((p) => [p.id, p]));
  const prestadoresMap = new Map((prestadores || []).map((p) => [p.id, p]));

  const data = prestaciones.map((p) => ({
    id: p.id,
    tipo_prestacion: p.tipo_prestacion,
    fecha: p.fecha,
    estado: p.estado,
    monto: p.monto,
    user_id: p.user_id,
    cronico: p.cronico,
    sentido_transporte: (p as any).sentido_transporte ?? null,
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
      sentido_transporte?: string | null;
      user_id?: string | null;
      paciente: { id: string; nombre: string; apellido: string; documento: string } | null;
      prestador: { id: string; nombre: string; apellido: string; documento?: string } | null;
    }> | null,
    error: null,
  };
}

export async function getPrestacionById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prestaciones")
    .select(
      "id, tipo_prestacion, obra_social_id, fecha, estado, monto, descripcion, notas, paciente_id, user_id, cronico, centro_id, sentido_transporte"
    )
    .eq("id", id)
    .single();
  return { data, error };
}

export async function listCentrosForSelect() {
  const supabase = await createClient();
  let lastError: any = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('centros')
      .select('id, nombre, tipo')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (!error) {
      return { data: (data || []) as { id: string; nombre: string; tipo: string }[], error: null };
    }

    lastError = error;
    const msg = String((error as any)?.message || '');
    const isFetchFailed = msg.toLowerCase().includes('fetch failed');
    if (!isFetchFailed || attempt === 1) {
      console.error('Error listando centros:', error);
      return { data: [] as { id: string; nombre: string; tipo: string }[], error };
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  console.error('Error listando centros:', lastError);
  return { data: [] as { id: string; nombre: string; tipo: string }[], error: lastError };
}

export async function updatePrestacionNota(id: string, notas: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prestaciones")
    .update({ notas })
    .eq("id", id)
    .select("id, notas")
    .single();
  return { data, error };
}

export async function createPrestacion(values: PrestacionInput) {
  const supabase = await createClient();
  
  // Verificar duplicados antes de insertar
  const { exists, error: dupError } = await checkDuplicatePrestacion(supabase, {
    paciente_id: values.paciente_id,
    user_id: values.user_id,
    tipo_prestacion: values.tipo_prestacion,
    fecha: values.fecha,
    centro_id: values.centro_id,
    sentido_transporte: values.sentido_transporte,
  });

  if (dupError) {
    console.error("Error verificando duplicados:", dupError);
  }

  if (exists) {
    return { 
      data: null, 
      error: { message: "Ya existe una prestación con los mismos datos para esta fecha" } 
    };
  }

  const payload: any = {
    ...values,
    estado: values.estado ?? "pendiente",
    cronico: values.cronico ?? false,
    user_id: values.user_id,
    centro_id: values.centro_id ?? null,
    sentido_transporte: values.sentido_transporte ?? null,
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
    return { data: null, error: { message: 'No hay fechas para insertar' }, duplicateCount: 0 } as const;
  }
  // Normalizar y limitar a 60
  const sanitized = fechas
    .map(f => {
      try { return new Date(f).toISOString(); } catch { return null; }
    })
    .filter((f): f is string => !!f)
    .slice(0, 60);
  if (sanitized.length === 0) {
    return { data: null, error: { message: 'Fechas inválidas' }, duplicateCount: 0 } as const;
  }

  const records = sanitized.map((f) => ({
    ...common,
    fecha: f,
    estado: common.estado ?? 'pendiente',
    cronico: common.cronico ?? false,
    user_id: common.user_id,
    paciente_id: common.paciente_id ?? null,
    tipo_prestacion: common.tipo_prestacion,
    monto: common.monto == null ? null : Number(common.monto),
    centro_id: (common as any).centro_id ?? null,
    sentido_transporte: (common as any).sentido_transporte ?? null,
  }));

  // Filtrar duplicados
  const { newRecords, duplicateCount } = await filterExistingPrestaciones(supabase, records);

  if (newRecords.length === 0) {
    return { 
      data: [], 
      error: null, 
      duplicateCount,
      message: `Todas las ${duplicateCount} prestaciones ya existían` 
    } as const;
  }

  const { data, error } = await supabase
    .from('prestaciones')
    .insert(newRecords)
    .select('id');

  if (error) return { data: null, error, duplicateCount } as const;
  return { data, error: null, duplicateCount } as const;
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
    cronico: values.cronico ?? false,
    user_id: values.user_id,
    centro_id: values.centro_id ?? null,
    sentido_transporte: values.sentido_transporte ?? null,
  };
  
  const { data, error } = await supabase
    .from("prestaciones")
    .update(payload)
    .eq("id", id)
    .select("id")
    .single();
  return { data, error };
}

export type PrestacionParaReasignar = {
  pool_id: string;
  prestacion_id: string;
  cancelled_at: string;
  reason: string;
  prestacion: {
    id: string;
    tipo_prestacion: string;
    fecha: string;
    estado: string | null;
    monto: number | null;
    cronico: boolean | null;
  } | null;
  paciente: { id: string; nombre: string; apellido: string; documento: string } | null;
  prestadorAnterior: { id: string; nombre: string; apellido: string; documento?: string | null } | null;
  metadata: Record<string, any> | null;
};

type ListPrestacionesParaReasignarOptions = {
  tipoPrestacion?: string;
};

export async function listPrestacionesParaReasignar(options: ListPrestacionesParaReasignarOptions = {}) {
  const supabase = await createClient();

  const { data: poolRows, error } = await supabase
    .from('prestaciones_reasignacion_pool')
    .select('id, prestacion_id, prestador_id, cancelled_at, reason, metadata')
    .is('processed_at', null)
    .order('cancelled_at', { ascending: false });

  if (error) {
    console.error('Error obteniendo pool de reasignación:', error);
    return { data: null as PrestacionParaReasignar[] | null, error };
  }

  if (!poolRows || poolRows.length === 0) {
    return { data: [] as PrestacionParaReasignar[], error: null };
  }

  const prestacionIds = poolRows.map((row) => row.prestacion_id).filter(Boolean) as string[];
  const { data: prestaciones, error: prestacionesError } = await supabase
    .from('prestaciones')
    .select('id, tipo_prestacion, fecha, estado, monto, cronico, paciente_id, user_id')
    .in('id', prestacionIds);

  if (prestacionesError) {
    console.error('Error obteniendo prestaciones para reasignar:', prestacionesError);
    return { data: null as PrestacionParaReasignar[] | null, error: prestacionesError };
  }

  const pacientesIds = Array.from(new Set((prestaciones || []).map((p) => p.paciente_id).filter(Boolean))) as string[];
  const prestadoresIds = Array.from(new Set([
    ...poolRows.map((row) => row.prestador_id).filter(Boolean) as string[],
    ...((prestaciones || []).map((p) => p.user_id).filter(Boolean) as string[]),
  ]));

  let pacientesMap = new Map<string, { id: string; nombre: string; apellido: string; documento: string }>();
  if (pacientesIds.length > 0) {
    const { data: pacientes } = await supabase
      .from('pacientes')
      .select('id, nombre, apellido, documento')
      .in('id', pacientesIds);
    pacientesMap = new Map((pacientes || []).map((p) => [p.id, p]));
  }

  let prestadoresMap = new Map<string, { id: string; nombre: string; apellido: string; documento?: string | null }>();
  if (prestadoresIds.length > 0) {
    const { data: prestadores } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, documento')
      .in('id', prestadoresIds);
    prestadoresMap = new Map((prestadores || []).map((p) => [p.id, p]));
  }

  const prestacionesMap = new Map((prestaciones || []).map((p) => [p.id, p]));

  const data: PrestacionParaReasignar[] = [];
  const autoProcessedIds: string[] = [];

  poolRows.forEach((row) => {
    const prestacion = (row.prestacion_id && prestacionesMap.get(row.prestacion_id)) || null;
    const paciente = prestacion?.paciente_id ? pacientesMap.get(prestacion.paciente_id) || null : null;
    const prestadorAnterior = row.prestador_id ? prestadoresMap.get(row.prestador_id) || null : null;

    const prestacionFecha = prestacion?.fecha ? new Date(prestacion.fecha) : null;
    const cancelledAtDate = row.cancelled_at ? new Date(row.cancelled_at) : null;
    const shouldAutoProcess = Boolean(
      prestacionFecha && cancelledAtDate && prestacionFecha.getTime() < cancelledAtDate.getTime()
    );

    if (shouldAutoProcess) {
      autoProcessedIds.push(row.id);
      return;
    }

    if (options.tipoPrestacion && prestacion?.tipo_prestacion !== options.tipoPrestacion) {
      return;
    }

    data.push({
      pool_id: row.id,
      prestacion_id: row.prestacion_id,
      cancelled_at: row.cancelled_at,
      reason: row.reason,
      metadata: (row.metadata as Record<string, any>) || null,
      prestacion: prestacion
        ? {
            id: prestacion.id,
            tipo_prestacion: prestacion.tipo_prestacion,
            fecha: prestacion.fecha,
            estado: prestacion.estado,
            monto: prestacion.monto,
            cronico: prestacion.cronico,
          }
        : null,
      paciente,
      prestadorAnterior,
    });
  });

  if (autoProcessedIds.length > 0) {
    const nowIso = new Date().toISOString();
    const { error: autoProcessError } = await supabase
      .from('prestaciones_reasignacion_pool')
      .update({
        processed_at: nowIso,
        metadata: {
          status: 'cancelada',
          auto_processed: true,
          auto_processed_reason: 'prestacion anterior a fecha de inhabilitacion',
        },
      })
      .in('id', autoProcessedIds);

    if (autoProcessError) {
      console.error('Error auto-procesando prestaciones previas a inhabilitación:', autoProcessError);
    }
  }

  return { data, error: null };
}

export async function reasignarPrestacionDesdePool(poolId: string, nuevoPrestadorId: string, nuevaHora?: string) {
  const supabase = await createClient();

  const { data: userRes, error: userError } = await supabase.auth.getUser();
  if (userError || !userRes?.user?.id) {
    const err = userError ?? new Error('Usuario no autenticado');
    return { data: null, error: err } as const;
  }

  const { data: poolRow, error: poolError } = await supabase
    .from('prestaciones_reasignacion_pool')
    .select('id, prestacion_id, metadata')
    .eq('id', poolId)
    .is('processed_at', null)
    .single();

  if (poolError || !poolRow) {
    const err = poolError ?? new Error('Registro no encontrado en el pool');
    return { data: null, error: err } as const;
  }

  const updates: Record<string, any> = {
    user_id: nuevoPrestadorId,
    estado: 'pendiente',
  };

  if (nuevaHora) {
    const [hoursStr = '0', minutesStr = '0'] = nuevaHora.split(':');
    const hours = Math.min(23, Math.max(0, Number(hoursStr) || 0));
    const minutes = Math.min(59, Math.max(0, Number(minutesStr) || 0));
    const { data: prestacionActual } = await supabase
      .from('prestaciones')
      .select('fecha')
      .eq('id', poolRow.prestacion_id)
      .single();

    if (prestacionActual?.fecha) {
      const date = new Date(prestacionActual.fecha);
      if (!Number.isNaN(date.getTime())) {
        date.setHours(hours, minutes, 0, 0);
        updates.fecha = date.toISOString();
      }
    }
  }

  const { data: updatedPrestacion, error: prestacionError } = await supabase
    .from('prestaciones')
    .update(updates)
    .eq('id', poolRow.prestacion_id)
    .select('id, fecha')
    .single();

  if (prestacionError) {
    console.error('Error reasignando prestación:', prestacionError);
    return { data: null, error: prestacionError } as const;
  }

  const nowIso = new Date().toISOString();
  const updatedMetadata = {
    ...(poolRow.metadata as Record<string, any> | null ?? {}),
    reassigned_to: nuevoPrestadorId,
    reassigned_at: nowIso,
  };

  const { error: poolUpdateError } = await supabase
    .from('prestaciones_reasignacion_pool')
    .update({
      processed_at: nowIso,
      processed_by: userRes.user.id,
      metadata: updatedMetadata,
    })
    .eq('id', poolId);

  if (poolUpdateError) {
    console.error('Error actualizando pool de reasignación:', poolUpdateError);
    return { data: null, error: poolUpdateError } as const;
  }

  revalidatePath('/protected/prestaciones');
  revalidatePath('/protected/transporte');

  return { data: updatedPrestacion, error: null } as const;
}

export type ReasignacionMasivaPoolItem = {
  poolId: string;
  nuevoPrestadorId: string;
  nuevaHora?: string;
};

export async function reasignarPrestacionesMasivasDesdePool(items: ReasignacionMasivaPoolItem[]) {
  if (!items.length) {
    return { data: { successIds: [] as string[], errors: [] as { poolId: string; message: string }[] }, error: null } as const;
  }

  const successIds: string[] = [];
  const errors: { poolId: string; message: string }[] = [];

  for (const item of items) {
    const { error } = await reasignarPrestacionDesdePool(item.poolId, item.nuevoPrestadorId, item.nuevaHora);
    if (error) {
      errors.push({ poolId: item.poolId, message: error?.message || "No se pudo reasignar" });
    } else {
      successIds.push(item.poolId);
    }
  }

  return { data: { successIds, errors }, error: null } as const;
}

export async function descartarPrestacionDePool(poolId: string, motivo: string = 'Cancelada desde pool') {
  const supabase = await createClient();

  const { data: userRes, error: userError } = await supabase.auth.getUser();
  if (userError || !userRes?.user?.id) {
    const err = userError ?? new Error('Usuario no autenticado');
    return { data: null, error: err } as const;
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('prestaciones_reasignacion_pool')
    .update({
      processed_at: nowIso,
      processed_by: userRes.user.id,
      metadata: {
        status: 'descartada',
        reason: motivo,
        processed_at: nowIso,
        processed_by: userRes.user.id,
      },
    })
    .eq('id', poolId);

  if (error) {
    console.error('Error descartando prestación del pool:', error);
    return { data: null, error } as const;
  }

  revalidatePath('/protected/prestaciones');

  return { data: { poolId }, error: null } as const;
}

export async function listPacientesForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nombre, apellido, documento, ubicacion")
    .order("apellido", { ascending: true });
  const mapped =
    data?.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      apellido: row.apellido,
      documento: row.documento ?? undefined,
      tiene_ubicacion: Boolean(row.ubicacion),
    })) ?? null;
  return {
    data: mapped,
    error,
  } as {
    data: { id: string; nombre: string; apellido: string; documento?: string; tiene_ubicacion: boolean }[] | null;
    error: any;
  };
}

export async function listObrasSocialesForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obras_sociales")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  return { data, error } as { data: { id: string; nombre: string }[] | null; error: any };
}

export async function cancelPrestacion(id: string) {
  const supabase = await createClient();
  // Solo cancelar si está en estado pendiente
  const { data, error } = await supabase
    .from('prestaciones')
    .update({ estado: 'cancelada' })
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('id')
    .single();
  if (!error) {
    revalidatePath('/protected/prestaciones');
  }
  return { data, error } as const;
}

export async function cancelPrestacionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  await cancelPrestacion(id);
}

// Obtener pacientes de un centro para crear prestaciones masivas
export async function getPacientesDeCentro(centroId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("paciente_centros")
    .select(`
      paciente_id,
      pacientes (
        id,
        nombre,
        apellido,
        documento
      )
    `)
    .eq("centro_id", centroId)
    .eq("activo", true);

  if (error) {
    console.error("Error obteniendo pacientes del centro:", error);
    return { data: null, error };
  }

  const pacientes = (data || []).map((row: any) => ({
    id: row.pacientes?.id || row.paciente_id,
    nombre: row.pacientes?.nombre || "",
    apellido: row.pacientes?.apellido || "",
    documento: row.pacientes?.documento || "",
  }));

  return { data: pacientes, error: null };
}

// Crear prestaciones para todos los pacientes de un centro
type PacientesPorFechaPayload = {
  fecha: string;
  paciente_ids: string[];
};

export async function createPrestacionesPorCentro(params: {
  centro_id: string;
  user_id: string;
  tipo_prestacion: string;
  fechas: string[];
  pacientes_por_fecha?: PacientesPorFechaPayload[];
  monto?: number | null;
  descripcion?: string | null;
  notas?: string | null;
  cronico?: boolean;
}) {
  const supabase = await createClient();

  // Obtener pacientes del centro
  const { data: pacientes, error: errorPacientes } = await getPacientesDeCentro(params.centro_id);

  if (errorPacientes || !pacientes || pacientes.length === 0) {
    return { 
      data: null, 
      error: { message: errorPacientes?.message || "No hay pacientes asignados a este centro" } 
    };
  }

  // Validar fechas
  const fechasValidas = params.fechas
    .map(f => { try { return new Date(f).toISOString(); } catch { return null; } })
    .filter((f): f is string => !!f);

  if (fechasValidas.length === 0) {
    return { data: null, error: { message: "No hay fechas válidas" } };
  }

  const pacientesValidos = new Map(pacientes.map((p) => [p.id, p]));

  const parseFecha = (fechaRaw: string) => {
    try {
      return new Date(fechaRaw).toISOString();
    } catch {
      return null;
    }
  };

  // Crear una prestación por cada paciente por cada fecha
  const records: any[] = [];

  const assignments = params.pacientes_por_fecha?.length
    ? params.pacientes_por_fecha
    : fechasValidas.map((fecha) => ({ fecha, paciente_ids: pacientes.map((p) => p.id) }));

  for (const assignment of assignments) {
    const fechaISO = parseFecha(assignment.fecha);
    if (!fechaISO) continue;

    const pacientesAsignados = (assignment.paciente_ids || []).filter((id) => pacientesValidos.has(id));
    if (pacientesAsignados.length === 0) continue;

    for (const pacienteId of pacientesAsignados) {
      records.push({
        user_id: params.user_id,
        paciente_id: pacienteId,
        centro_id: params.centro_id,
        tipo_prestacion: params.tipo_prestacion,
        fecha: fechaISO,
        estado: "pendiente",
        monto: params.monto ?? null,
        descripcion: params.descripcion ?? null,
        notas: params.notas ?? null,
        cronico: params.cronico ?? false,
        sentido_transporte: null,
      });
    }
  }

  if (records.length === 0) {
    return {
      data: null,
      error: { message: "No hay pacientes seleccionados para las fechas indicadas" },
    };
  }

  // Conflictos: mismo paciente, mismo tipo y misma fecha/hora, sin importar prestador
  const conflicts = await findConflictingPrestaciones(supabase, records);
  if (conflicts.length > 0) {
    const pacientesConflictivos = [...new Set(conflicts.map((c) => c.paciente_id).filter(Boolean))];
    return {
      data: null,
      error: {
        message:
          "Existen prestaciones ya cargadas para uno o más pacientes en las mismas fechas/horarios", // msg amigable
        detalles: {
          pacientes: pacientesConflictivos,
          totalConflictos: conflicts.length,
        },
      },
    };
  }

  // Limitar a 500 registros por seguridad
  const recordsLimited = records.slice(0, 500);
  const resumenPacientes = new Set(recordsLimited.map((r) => r.paciente_id)).size;
  const resumenFechas = new Set(recordsLimited.map((r) => extractDateOnly(r.fecha))).size;

  // Filtrar duplicados
  const { newRecords, duplicateCount } = await filterExistingPrestaciones(supabase, recordsLimited);

  if (newRecords.length === 0) {
    return { 
      data: { created: 0, pacientes: resumenPacientes, fechas: resumenFechas, duplicateCount },
      error: null,
      message: `Todas las ${duplicateCount} prestaciones ya existían`
    };
  }

  const { data, error } = await supabase
    .from("prestaciones")
    .insert(newRecords)
    .select("id");

  if (error) {
    console.error("Error creando prestaciones por centro:", error);
    return { data: null, error };
  }

  revalidatePath("/protected/prestaciones");

  return { 
    data: { 
      created: data?.length || 0, 
      pacientes: resumenPacientes,
      fechas: resumenFechas,
      duplicateCount 
    }, 
    error: null 
  };
}
