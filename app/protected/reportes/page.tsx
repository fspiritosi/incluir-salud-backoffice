import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReporteGenerator from "./components/ReporteGenerator";

export default async function ReportesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const { data: prestadoresData } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento")
    .eq("tipo_usuario", "prestador")
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reportes de Prestaciones</h1>
        <p className="text-gray-600 mt-1">
          Genera reportes de prestaciones completadas por prestador y rango de fechas
        </p>
      </div>

      <ReporteGenerator prestadores={prestadoresData || []} />
    </div>
  );
}
