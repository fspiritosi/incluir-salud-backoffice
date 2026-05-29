"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createAdminClient(url, serviceKey);
}

export type PrestadorRow = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean | null;
  created_at: string;
  especialidad?: string | null;
  avatar_url?: string | null;
};

export async function listPrestadores(): Promise<{ data: PrestadorRow[] | null; error: any }> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento, email, telefono, activo, created_at, especialidad")
    .eq("tipo_usuario", "prestador")
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error('Error listando prestadores:', error);
    return { data: null, error };
  }

  if (!data || data.length === 0) {
    return { data: [], error: null };
  }

  // Enrich with metadata as fallback for missing profile data
  const admin = getAdminSupabase();
  const metadataMap = new Map<string, {
    avatar_url: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    document_number: string | null;
    full_name: string | null;
  }>();

  if (admin) {
    await Promise.all(
      data.map(async (row) => {
        try {
          const { data: authData } = await admin.auth.admin.getUserById(row.id);
          const metadata = authData?.user?.user_metadata || {};
          metadataMap.set(row.id, {
            avatar_url: metadata.avatar_url ?? null,
            first_name: metadata.first_name ?? null,
            last_name: metadata.last_name ?? null,
            phone: metadata.phone ?? null,
            document_number: metadata.document_number ?? null,
            full_name: metadata.full_name ?? null,
          });
        } catch {
          metadataMap.set(row.id, {
            avatar_url: null,
            first_name: null,
            last_name: null,
            phone: null,
            document_number: null,
            full_name: null,
          });
        }
      })
    );
  }

  const enriched: PrestadorRow[] = data.map((row) => {
    const metadata = metadataMap.get(row.id) || {
      avatar_url: null,
      first_name: null,
      last_name: null,
      phone: null,
      document_number: null,
      full_name: null,
    };

    return {
      ...row,
      // Use metadata as fallback when profile fields are empty
      nombre: row.nombre || metadata.first_name || null,
      apellido: row.apellido || metadata.last_name || null,
      telefono: row.telefono || metadata.phone || null,
      documento: row.documento || metadata.document_number || null,
      avatar_url: metadata.avatar_url,
    };
  });

  return { data: enriched, error: null };
}

type PrestacionPendienteDetalle = {
  id: string;
  fecha: string;
  tipo_prestacion: string;
  paciente_id: string | null;
  paciente?: { id: string; nombre: string; apellido: string; documento: string | null } | null;
};

type DisablePreviewData = {
  fechaInhabilitacion: string;
  pendientesPrevias: PrestacionPendienteDetalle[];
  pendientesDesdeFecha: PrestacionPendienteDetalle[];
  prestador: { id: string; nombre: string; apellido: string; especialidad?: string | null };
};

export async function previewPrestadorDisable(
  prestadorId: string,
  fechaInhabilitacion?: string
): Promise<{ data: DisablePreviewData | null; error: any }> {
  const supabase = await createClient();

  const cutoffDate = fechaInhabilitacion ? new Date(fechaInhabilitacion) : new Date();
  const cutoffIso = Number.isNaN(cutoffDate.getTime()) ? new Date().toISOString() : cutoffDate.toISOString();

  const { data: prestador, error: prestadorError } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, especialidad')
    .eq('id', prestadorId)
    .single();

  if (prestadorError || !prestador) {
    return { data: null, error: prestadorError ?? new Error('Prestador no encontrado') };
  }

  const { data: pendientes, error: pendientesError } = await supabase
    .from('prestaciones')
    .select('id, fecha, tipo_prestacion, paciente_id')
    .eq('user_id', prestadorId)
    .eq('estado', 'pendiente')
    .order('fecha', { ascending: true });

  if (pendientesError) {
    console.error('Error obteniendo prestaciones pendientes para vista previa:', pendientesError);
    return { data: null, error: pendientesError };
  }

  const pacientesIds = Array.from(new Set((pendientes || []).map((p) => p.paciente_id).filter(Boolean))) as string[];
  let pacientesMap = new Map<string, { id: string; nombre: string; apellido: string; documento: string | null }>();

  if (pacientesIds.length > 0) {
    const { data: pacientes } = await supabase
      .from('pacientes')
      .select('id, nombre, apellido, documento')
      .in('id', pacientesIds);
    pacientesMap = new Map((pacientes || []).map((p) => [p.id, p]));
  }

  const previas: PrestacionPendienteDetalle[] = [];
  const posteriores: PrestacionPendienteDetalle[] = [];

  const cutoffMillis = new Date(cutoffIso).getTime();

  (pendientes || []).forEach((row) => {
    const fechaDate = row.fecha ? new Date(row.fecha).getTime() : NaN;
    const target = !Number.isFinite(fechaDate) || fechaDate < cutoffMillis ? previas : posteriores;
    target.push({
      ...row,
      paciente: row.paciente_id ? pacientesMap.get(row.paciente_id) || null : null,
    });
  });

  return {
    data: {
      fechaInhabilitacion: cutoffIso,
      pendientesPrevias: previas,
      pendientesDesdeFecha: posteriores,
      prestador,
    },
    error: null,
  };
}

type TogglePrestadorResponse = Promise<{ data: { cancelledCount: number } | null; error: any }>;

export async function togglePrestadorActivo(id: string, activo: boolean): TogglePrestadorResponse {
  const supabase = await createClient();

  // Si se deshabilita, usar la función RPC para cancelar prestaciones pendientes y cargarlas al pool
  if (!activo) {
    const { data: userRes, error: userError } = await supabase.auth.getUser();
    if (userError || !userRes?.user?.id) {
      const err = userError ?? new Error("Usuario no autenticado");
      console.error("No se pudo obtener el usuario que deshabilita: ", err);
      return { data: null, error: err };
    }

    const { data, error } = await supabase.rpc("disable_prestador_and_cancel", {
      p_prestador_id: id,
      p_actor_id: userRes.user.id,
      p_reason: "Prestador deshabilitado",
    });

    if (error) {
      console.error("Error deshabilitando prestador con cascada:", error);
      return { data: null, error };
    }

    revalidatePath("/protected/prestadores");
    revalidatePath("/protected/prestaciones");

    const cancelledCount = Array.isArray(data) && data[0]?.cancelled_count ? Number(data[0].cancelled_count) : 0;
    return { data: { cancelledCount }, error: null };
  }

  const { error } = await supabase.rpc("set_prestador_activo", {
    p_prestador_id: id,
    p_activo: true,
  });

  if (error) {
    console.error('Error actualizando prestador:', error);
    return { data: null, error };
  }

  revalidatePath("/protected/prestadores");
  return { data: { cancelledCount: 0 }, error: null };
}

type DisablePrestadorPayload = {
  prestadorId: string;
  nuevoPrestadorId?: string | null;
  fechaInhabilitacion?: string;
};

type DisablePrestadorResult = {
  fechaInhabilitacion: string;
  canceladasAntes: number;
  reasignadas: number;
  enviadasAlPool: number;
  totalPendientes: number;
};

export async function disablePrestadorConReasignacion({
  prestadorId,
  nuevoPrestadorId,
  fechaInhabilitacion,
}: DisablePrestadorPayload): Promise<{ data: DisablePrestadorResult | null; error: any }> {
  const supabase = await createClient();

  const { data: userRes, error: userError } = await supabase.auth.getUser();
  if (userError || !userRes?.user?.id) {
    const err = userError ?? new Error('Usuario no autenticado');
    return { data: null, error: err };
  }

  const cutoffDate = fechaInhabilitacion ? new Date(fechaInhabilitacion) : new Date();
  if (Number.isNaN(cutoffDate.getTime())) {
    return { data: null, error: new Error('Fecha de inhabilitación inválida') };
  }
  const cutoffIso = cutoffDate.toISOString();

  const { data: prestador, error: prestadorError } = await supabase
    .from('profiles')
    .select('id, especialidad, activo')
    .eq('id', prestadorId)
    .single();

  if (prestadorError || !prestador) {
    return { data: null, error: prestadorError ?? new Error('Prestador no encontrado') };
  }

  const { data: pendientes, error: pendientesError } = await supabase
    .from('prestaciones')
    .select('id, fecha, tipo_prestacion, paciente_id')
    .eq('user_id', prestadorId)
    .eq('estado', 'pendiente');

  if (pendientesError) {
    console.error('Error obteniendo prestaciones pendientes para inhabilitar:', pendientesError);
    return { data: null, error: pendientesError };
  }

  const canceladasAntes = (pendientes || []).filter((p) => {
    if (!p.fecha) return true;
    return new Date(p.fecha).getTime() < cutoffDate.getTime();
  });
  const pendientesDesdeFecha = (pendientes || []).filter((p) => {
    if (!p.fecha) return false;
    return new Date(p.fecha).getTime() >= cutoffDate.getTime();
  });

  if (canceladasAntes.length > 0) {
    const cancelIds = canceladasAntes.map((p) => p.id);
    const { error: cancelError } = await supabase
      .from('prestaciones')
      .update({ estado: 'cancelada' })
      .in('id', cancelIds);
    if (cancelError) {
      console.error('Error cancelando prestaciones previas a la inhabilitación:', cancelError);
      return { data: null, error: cancelError };
    }
  }

  let reasignadas = 0;
  let enviadasAlPool = 0;

  if (pendientesDesdeFecha.length > 0) {
    if (nuevoPrestadorId) {
      if (nuevoPrestadorId === prestadorId) {
        return { data: null, error: new Error('No podés reasignar al mismo prestador') };
      }

      const normalizeEspecialidad = (value?: string | null) => (value ?? '').trim().toLowerCase();

      const { data: nuevoPrestador, error: nuevoError } = await supabase
        .from('profiles')
        .select('id, especialidad, activo')
        .eq('id', nuevoPrestadorId)
        .single();

      if (nuevoError || !nuevoPrestador) {
        return { data: null, error: nuevoError ?? new Error('Prestador destino no encontrado') };
      }

      if (!nuevoPrestador.activo) {
        return { data: null, error: new Error('El prestador seleccionado no está activo') };
      }

      const especialidadOrigen = normalizeEspecialidad(prestador.especialidad) || normalizeEspecialidad(pendientesDesdeFecha[0]?.tipo_prestacion);
      const especialidadDestino = normalizeEspecialidad(nuevoPrestador.especialidad);

      if (especialidadOrigen && especialidadDestino && especialidadOrigen !== especialidadDestino) {
        return { data: null, error: new Error('El prestador seleccionado no coincide con la especialidad requerida') };
      }

      const pacientesIds = Array.from(new Set(pendientesDesdeFecha.map((p) => p.paciente_id).filter(Boolean))) as string[];
      const existingKeys = new Set<string>();

      if (pacientesIds.length > 0) {
        const { data: existentes } = await supabase
          .from('prestaciones')
          .select('paciente_id, fecha')
          .eq('user_id', nuevoPrestadorId)
          .eq('estado', 'pendiente')
          .in('paciente_id', pacientesIds);
        (existentes || []).forEach((row) => {
          if (!row.paciente_id || !row.fecha) return;
          const key = `${row.paciente_id}-${row.fecha.slice(0, 10)}`;
          existingKeys.add(key);
        });
      }

      const reasignarAhora: string[] = [];
      const conflictos: { id: string; paciente_id: string | null; fecha: string | null; motivo: string }[] = [];

      pendientesDesdeFecha.forEach((row) => {
        if (!row.paciente_id || !row.fecha) {
          conflictos.push({ ...row, motivo: 'Faltan datos de paciente o fecha' });
          return;
        }
        const key = `${row.paciente_id}-${row.fecha.slice(0, 10)}`;
        if (existingKeys.has(key)) {
          conflictos.push({ ...row, motivo: 'Ya existe una prestación para este paciente y día' });
          return;
        }
        existingKeys.add(key);
        reasignarAhora.push(row.id);
      });

      if (reasignarAhora.length > 0) {
        const { error: reasignError } = await supabase
          .from('prestaciones')
          .update({ user_id: nuevoPrestadorId, estado: 'pendiente' })
          .in('id', reasignarAhora);
        if (reasignError) {
          console.error('Error reasignando prestaciones automáticamente:', reasignError);
          return { data: null, error: reasignError };
        }
        reasignadas = reasignarAhora.length;
      }

      if (conflictos.length > 0) {
        const payload = conflictos.map((row) => ({
          prestacion_id: row.id,
          prestador_id: prestadorId,
          reason: 'Conflicto reasignación automática',
          metadata: {
            motivo: row.motivo,
            fecha_inhabilitacion: cutoffIso,
            actor_id: userRes.user.id,
          },
          cancelled_at: cutoffIso,
        }));

        const { error: poolInsertError } = await supabase
          .from('prestaciones_reasignacion_pool')
          .insert(payload);
        if (poolInsertError) {
          console.error('Error enviando prestaciones conflictivas al pool:', poolInsertError);
          return { data: null, error: poolInsertError };
        }
        enviadasAlPool = conflictos.length;
      }
    } else {
      const payload = pendientesDesdeFecha.map((row) => ({
        prestacion_id: row.id,
        prestador_id: prestadorId,
        reason: 'Sin prestador sustituto',
        metadata: {
          motivo: 'No se seleccionó nuevo prestador',
          fecha_inhabilitacion: cutoffIso,
          actor_id: userRes.user.id,
        },
        cancelled_at: cutoffIso,
      }));

      const { error: poolInsertError } = await supabase
        .from('prestaciones_reasignacion_pool')
        .insert(payload);
      if (poolInsertError) {
        console.error('Error enviando prestaciones futuras al pool:', poolInsertError);
        return { data: null, error: poolInsertError };
      }
      enviadasAlPool += pendientesDesdeFecha.length;
    }
  }

  const { error: disableError } = await supabase.rpc('set_prestador_activo', {
    p_prestador_id: prestadorId,
    p_activo: false,
  });

  if (disableError) {
    console.error('Error inhabilitando prestador:', disableError);
    return { data: null, error: disableError };
  }

  revalidatePath('/protected/prestadores');
  revalidatePath('/protected/prestaciones');

  return {
    data: {
      fechaInhabilitacion: cutoffIso,
      canceladasAntes: canceladasAntes.length,
      reasignadas,
      enviadasAlPool,
      totalPendientes: pendientes?.length ?? 0,
    },
    error: null,
  };
}

export type DeviceChangeRow = {
  id: string;
  user_id: string;
  prestador_nombre: string;
  prestador_apellido: string;
  old_device_id: string | null;
  new_device_id: string | null;
  status: string;
  created_at: string;
};

export async function listDeviceChanges(): Promise<{ data: DeviceChangeRow[] | null; error: any }> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("device_changes")
    .select(`
      id,
      user_id,
      old_device_id,
      new_device_id,
      status,
      created_at,
      user:profiles(nombre, apellido)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error('Error listando cambios de dispositivos:', error);
    return { data: null, error };
  }

  if (!data || data.length === 0) {
    return { data: [], error: null };
  }

  const mapped = data.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    prestador_nombre: row.user?.nombre || "",
    prestador_apellido: row.user?.apellido || "",
    old_device_id: row.old_device_id,
    new_device_id: row.new_device_id,
    status: row.status,
    created_at: row.created_at,
  }));

  return { data: mapped, error: null };
}
