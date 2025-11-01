"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPrestacionesReporte(
  prestadorId: string,
  fechaInicio: string,
  fechaFin: string
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

  const { data: prestaciones, error: prestacionesError } = await supabase
    .from("prestaciones")
    .select("id, tipo_prestacion, fecha, monto, descripcion, paciente_id")
    .eq("user_id", prestadorId)
    .eq("estado", "completada")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true });

  if (prestacionesError) {
    console.error("Error obteniendo prestaciones:", prestacionesError);
    return { data: null, error: prestacionesError };
  }

  const pacienteIds = Array.from(
    new Set(prestaciones?.map((p) => p.paciente_id).filter(Boolean))
  );

  let pacientesMap = new Map();
  if (pacienteIds.length > 0) {
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, nombre, apellido, documento")
      .in("id", pacienteIds);

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
