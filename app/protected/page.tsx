import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Calendar, CheckCircle2, Clock, TrendingUp } from "lucide-react";

async function getDashboardStats() {
  const supabase = await createClient();
  
  // Obtener fecha de hoy en formato ISO (solo fecha)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // Prestaciones del día
  const { data: prestacionesHoy, error } = await supabase
    .from("prestaciones")
    .select("id, estado, tipo_prestacion, monto")
    .gte("fecha", todayStr)
    .lt("fecha", tomorrowStr);
  
  if (error) {
    console.error('Error obteniendo prestaciones:', error);
    return {
      totalHoy: 0,
      completadas: 0,
      pendientes: 0,
      porcentajeCompletado: 0,
      montoTotal: 0,
      prestacionesPorTipo: {} as Record<string, number>
    };
  }
  
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
}

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }
  
  const stats = await getDashboardStats();

  return (
    <div className="flex-1 w-full flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Resumen de prestaciones del día</p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total del día */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Hoy</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalHoy}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Completadas */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Completadas</p>
              <p className="text-3xl font-bold text-green-600">{stats.completadas}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Pendientes</p>
              <p className="text-3xl font-bold text-orange-600">{stats.pendientes}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Monto total */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Monto Total</p>
              <p className="text-3xl font-bold text-purple-600">
                ${stats.montoTotal.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de progreso */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Progreso del Día</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Completadas</span>
                <span className="text-sm font-medium text-gray-900">{stats.porcentajeCompletado}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-green-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${stats.porcentajeCompletado}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{stats.completadas}</p>
                <p className="text-sm text-gray-600 mt-1">Completadas</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{stats.pendientes}</p>
                <p className="text-sm text-gray-600 mt-1">Pendientes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Prestaciones por tipo */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Prestaciones por Tipo</h2>
          {Object.keys(stats.prestacionesPorTipo).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.prestacionesPorTipo)
                .sort(([, a], [, b]) => b - a)
                .map(([tipo, cantidad]) => {
                  const porcentaje = stats.totalHoy > 0 ? Math.round((cantidad / stats.totalHoy) * 100) : 0;
                  return (
                    <div key={tipo}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {tipo.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {cantidad} ({porcentaje}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No hay prestaciones registradas para hoy</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
