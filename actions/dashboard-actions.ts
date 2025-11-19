'use server';

import { cache } from 'react';

import { getDashboardRange, type DashboardPeriod } from '@/lib/dashboard-range';
import { createClient } from '@/lib/supabase/server';

export type DashboardStatsParams = {
  period?: DashboardPeriod;
  customRange?: { start: string; end: string };
};

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

const DEFAULT_PERIOD: DashboardPeriod = 'day';
const AVAILABLE_PERIODS: DashboardPeriod[] = ['day', 'week', 'month', 'quarter', 'semester', 'year', 'custom'];

const normalizeParams = (params: DashboardStatsParams = {}) => {
  const period = params.period ?? DEFAULT_PERIOD;

  if (!AVAILABLE_PERIODS.includes(period)) {
    throw new Error('Periodo solicitado no válido');
  }

  if (period !== 'custom' && params.customRange) {
    throw new Error('Solo los periodos personalizados aceptan un rango manual');
  }

  return {
    period,
    customRange: params.customRange,
  };
};

export const getDashboardStats = cache(async (params: DashboardStatsParams = {}) => {
  const { period, customRange } = normalizeParams(params);
  const range = getDashboardRange(period, { customRange });

  const supabase = await createClient();
  const { data: prestaciones } = await supabase
    .from('prestaciones')
    .select('id, tipo_prestacion, fecha, estado, monto, user_id, paciente_id, cronico')
    .gte('fecha', range.start)
    .lte('fecha', range.end);

  const total = prestaciones?.length || 0;
  const completadas = prestaciones?.filter(p => p.estado === 'completada').length || 0;
  const pendientes = prestaciones?.filter(p => p.estado === 'pendiente').length || 0;
  const canceladas = prestaciones?.filter(p => p.estado === 'cancelada').length || 0;
  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const monto = prestaciones?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;
  const pacienteIds = Array.from(new Set((prestaciones || []).map(p => p.paciente_id).filter(Boolean))) as string[];
  const prestadorIds = Array.from(new Set((prestaciones || []).map(p => p.user_id).filter(Boolean))) as string[];

  let pacientesMap = new Map<string, { id: string; nombre: string; apellido: string; documento: string }>();
  if (pacienteIds.length > 0) {
    const { data: pacientes } = await supabase
      .from('pacientes')
      .select('id, nombre, apellido, documento')
      .in('id', pacienteIds);
    pacientesMap = new Map((pacientes || []).map((p) => [p.id, p]));
  }

  let prestadoresMap = new Map<string, { id: string; nombre: string; apellido: string; documento?: string | null }>();
  if (prestadorIds.length > 0) {
    const { data: prestadores } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, documento')
      .in('id', prestadorIds);
    prestadoresMap = new Map((prestadores || []).map((p) => [p.id, p]));
  }

  const prestacionesDetalle = (prestaciones || []).map((p) => ({
    id: p.id,
    tipo_prestacion: p.tipo_prestacion,
    fecha: p.fecha,
    estado: p.estado,
    monto: p.monto,
    cronico: p.cronico,
    paciente: p.paciente_id ? pacientesMap.get(p.paciente_id) || null : null,
    prestador: p.user_id ? prestadoresMap.get(p.user_id) || null : null,
  }));

  const porTipo: Record<string, number> = {};
  prestaciones?.forEach(p => {
    porTipo[p.tipo_prestacion] = (porTipo[p.tipo_prestacion] || 0) + 1;
  });

  return {
    range,
    total,
    completadas,
    pendientes,
    porcentajeCompletado: porcentaje,
    montoTotal: monto,
    canceladas,
    prestacionesPorTipo: porTipo,
    prestacionesDetalle,
  };
});
