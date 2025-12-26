import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UbicacionesSugeridasClient from "@/components/ubicaciones-sugeridas/UbicacionesSugeridasClient";
import { listCentrosConUbicacionSugerida, listPacientesConUbicacionSugerida } from "@/app/protected/ubicaciones-sugeridas/actions";

export default async function UbicacionesSugeridasPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  let roles: string[] = [];

  if (userId) {
    const { data: roleRows } = await supabase.from("v_user_roles").select("role").eq("user_id", userId);
    roles = (roleRows || []).map((r: any) => r.role as string);
  }

  const allowed = roles.some((r) => ["auditor", "super_admin"].includes(r));
  if (!allowed) {
    redirect("/protected");
  }

  const [{ data: pacientes, error: pacientesError }, { data: centros, error: centrosError }] = await Promise.all([
    listPacientesConUbicacionSugerida(),
    listCentrosConUbicacionSugerida(),
  ]);

  if (pacientesError || centrosError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Ubicaciones sugeridas</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la información</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ubicaciones sugeridas</h1>
        <p className="text-sm text-muted-foreground">Aprobá o rechazá ubicaciones sugeridas por prestadores.</p>
      </div>

      <UbicacionesSugeridasClient pacientes={pacientes || []} centros={centros || []} />
    </div>
  );
}
