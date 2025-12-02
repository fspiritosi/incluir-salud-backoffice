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
    </div>
  );
}
