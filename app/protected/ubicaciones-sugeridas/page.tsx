import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UbicacionesSugeridasTable from "@/components/ubicaciones-sugeridas/UbicacionesSugeridasTable";
import { listCentrosConUbicacionSugerida, listPacientesConUbicacionSugerida } from "@/app/protected/ubicaciones-sugeridas/actions";

type UbicacionesSugeridasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const toArray = (value: string | string[] | undefined) => {
  if (!value) return [] as string[];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

const toSingle = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const toNumber = (value: string | string[] | undefined, defaultValue: number) => {
  const num = Number(toSingle(value));
  return Number.isNaN(num) || num <= 0 ? defaultValue : num;
};

export default async function UbicacionesSugeridasPage({ searchParams }: UbicacionesSugeridasPageProps) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = toNumber(resolvedSearchParams?.page, 1);
  const pageSize = toNumber(resolvedSearchParams?.pageSize, 25);
  const filters = {
    tipo: toSingle(resolvedSearchParams?.tipo) ?? "",
    estado: toSingle(resolvedSearchParams?.estado) ?? "",
    fechaDesde: toSingle(resolvedSearchParams?.fechaDesde) ?? "",
    fechaHasta: toSingle(resolvedSearchParams?.fechaHasta) ?? "",
    pacienteIds: toArray(resolvedSearchParams?.pacienteIds),
    centroIds: toArray(resolvedSearchParams?.centroIds),
    sugeridoPorIds: toArray(resolvedSearchParams?.sugeridoPorIds),
  };

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

      <UbicacionesSugeridasTable 
        pacientes={pacientes || []} 
        centros={centros || []} 
        filters={filters}
        pagination={{ page, pageSize, total: (pacientes || []).length + (centros || []).length }}
      />
    </div>
  );
}
