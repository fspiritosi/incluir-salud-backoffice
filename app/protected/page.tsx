import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDashboardStats } from '@/actions/dashboard-actions';
import { StatsCards } from "@/components/dashboard/StatsCards";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }
  
  const stats = await getDashboardStats({ period: 'day' });
  

  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Resumen de actividades para {stats.range.label.toLowerCase()}</p>
        </div>
      </div>

      <StatsCards initialStats={stats} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de progreso */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Progreso</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completadas</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{stats.porcentajeCompletado}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div 
                  className="bg-green-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${stats.porcentajeCompletado}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completadas}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completadas</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.pendientes}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de tipos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tipos de Prestación</h2>
          <div className="space-y-4">
            {Object.entries(stats.prestacionesPorTipo).map(([tipo, cantidad]) => {
              const porcentaje = stats.total > 0 ? (cantidad / stats.total) * 100 : 0;
              return (
                <div key={tipo} className="space-y-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tipo}</span>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                      <div 
                        className="bg-blue-600 h-4 rounded-full transition-all duration-500" 
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                    <div className="flex flex-col items-end w-20">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{Math.round(porcentaje)}%</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{cantidad} prest.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
