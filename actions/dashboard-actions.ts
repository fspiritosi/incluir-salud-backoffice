'use server';

import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';

export const getDashboardStats = cache(async () => {
  const supabase = await createClient();
  // Hoy en Buenos Aires (YYYY-MM-DD) y rango con offset -03:00
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  const todayBA = `${y}-${m}-${d}`;
  const startBA = `${todayBA}T00:00:00-03:00`;
  const endBA = `${todayBA}T23:59:59.999-03:00`;

  const { data: prestacionesHoy } = await supabase
    .from('prestaciones')
    .select('*')
    .gte('fecha', startBA)
    .lte('fecha', endBA);

  const total = prestacionesHoy?.length || 0;
  const completadas = prestacionesHoy?.filter(p => p.estado === 'completada').length || 0;
  const pendientes = prestacionesHoy?.filter(p => p.estado === 'pendiente').length || 0;
  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const monto = prestacionesHoy?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;
  
  // Agrupar por tipo de prestación
  const porTipo: Record<string, number> = {};
  prestacionesHoy?.forEach(p => {
    porTipo[p.tipo_prestacion] = (porTipo[p.tipo_prestacion] || 0) + 1;
  });
  
  return {
    totalHoy: total,
    completadas,
    pendientes,
    porcentajeCompletado: porcentaje,
    montoTotal: monto,
    prestacionesPorTipo: porTipo
  };
});
