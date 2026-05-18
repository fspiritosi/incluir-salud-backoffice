'use server';

import { cache } from 'react';

import { getDashboardRange, type DashboardPeriod } from '@/lib/dashboard-range';
import { createClient } from '@/lib/supabase/server';

export type DashboardStatsParams = {
  period?: DashboardPeriod;
  customRange?: { start: string; end: string };
};

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

type DashboardSummaryRow = {
  total: number | null;
  completadas: number | null;
  pendientes: number | null;
  canceladas: number | null;
  monto_total: number | null;
  porcentaje_completado: number | null;
  prestaciones_por_tipo: Record<string, number> | null;
};

type PrestacionDetalleRow = {
  id: string;
  tipo_prestacion: string;
  fecha: string;
  estado: string;
  monto: number | null;
  cronico: boolean | null;
  paciente_id: string | null;
  user_id: string | null;
};

const DEFAULT_PERIOD: DashboardPeriod = 'day';
const AVAILABLE_PERIODS: DashboardPeriod[] = ['day', 'week', 'month', 'quarter', 'semester', 'year', 'custom'];
const MAX_DETALLE_ROWS = 5000;

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
  const { data: summaryRows, error: summaryError } = await supabase.rpc('get_dashboard_summary', {
    p_start: range.start,
    p_end: range.end,
  });

  if (summaryError) {
    console.error('Error ejecutando get_dashboard_summary', summaryError);
    throw new Error('No se pudo obtener el resumen del dashboard');
  }

  const summary: DashboardSummaryRow = summaryRows?.[0] ?? {
    total: 0,
    completadas: 0,
    pendientes: 0,
    canceladas: 0,
    monto_total: 0,
    porcentaje_completado: 0,
    prestaciones_por_tipo: {},
  };

  const { data: detalleRows = [], error: detalleError } = await supabase
    .from('prestaciones')
    .select('id, tipo_prestacion, fecha, estado, monto, user_id, paciente_id, cronico')
    .gte('fecha', range.start)
    .lte('fecha', range.end)
    .order('fecha', { ascending: false })
    .limit(MAX_DETALLE_ROWS);

  if (detalleError) {
    console.error('Error obteniendo detalle del dashboard', detalleError);
  }

  const pacienteIds = Array.from(new Set(detalleRows?.map(p => p.paciente_id).filter(Boolean))) as string[];
  const prestadorIds = Array.from(new Set(detalleRows?.map(p => p.user_id).filter(Boolean))) as string[];

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

  const detalle = (detalleRows || []) as PrestacionDetalleRow[];
  const prestacionesDetalle = detalle.map((p) => ({
    id: p.id,
    tipo_prestacion: p.tipo_prestacion,
    fecha: p.fecha,
    estado: p.estado,
    monto: p.monto,
    cronico: p.cronico,
    paciente: p.paciente_id ? pacientesMap.get(p.paciente_id) || null : null,
    prestador: p.user_id ? prestadoresMap.get(p.user_id) || null : null,
  }));

  return {
    range,
    total: Number(summary.total ?? 0),
    completadas: Number(summary.completadas ?? 0),
    pendientes: Number(summary.pendientes ?? 0),
    porcentajeCompletado: Number(summary.porcentaje_completado ?? 0),
    montoTotal: Number(summary.monto_total ?? 0),
    canceladas: Number(summary.canceladas ?? 0),
    prestacionesPorTipo: summary.prestaciones_por_tipo ?? {},
    prestacionesDetalle,
  };
});
