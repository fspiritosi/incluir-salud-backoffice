'use server';

import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';

export const getDashboardStats = cache(async () => {
  const supabase = await createClient();
  // Rango de hoy en hora local (00:00:00 -> 23:59:59.999)
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const { data: prestacionesHoy } = await supabase
    .from('prestaciones')
    .select('*')
    .gte('fecha', start.toISOString())
    .lte('fecha', end.toISOString());

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
