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
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null as any;
  return createAdminClient(url, serviceKey);
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

export async function listPrestaciones() {
  const supabase = await createClient();

  // Primero obtenemos las prestaciones base
  const { data: prestaciones, error } = await supabase
    .from("prestaciones")
    .select("id, tipo_prestacion, fecha, estado, monto, user_id, paciente_id, cronico")
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
    cronico: p.cronico,
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
      "id, tipo_prestacion, obra_social_id, fecha, estado, monto, descripcion, notas, paciente_id, user_id, cronico"
    )
    .eq("id", id)
    .single();
  return { data, error };
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
    cronico: values.cronico ?? false,
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
    cronico: common.cronico ?? false,
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
    cronico: values.cronico ?? false,
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

export async function listPrestacionesParaReasignar() {
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
    .select("id, nombre, apellido, documento")
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
