import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { canManageCentros, type RoleName } from "@/utils/permissions";
import { listPacientesCentro, getCentroNombre } from "./actions";
import PacientesCentroManager from "./ui/PacientesCentroManager";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PacientesCentroPage({ params }: PageProps) {
  const { id: centroId } = await params;
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  let roles: RoleName[] = [];
  if (userId) {
    const { data: roleRows } = await supabase.from("v_user_roles").select("role").eq("user_id", userId);
    roles = (roleRows || []).map((r: any) => r.role as RoleName);
  }

  if (!canManageCentros(roles)) {
    redirect("/acceso-denegado");
  }

  const [centroNombre, { data: pacientes, error }] = await Promise.all([
    getCentroNombre(centroId),
    listPacientesCentro(centroId),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pacientes del Centro</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la lista de pacientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/protected/centros">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Pacientes de {centroNombre}</h1>
        </div>
      </div>

      <PacientesCentroManager
        centroId={centroId}
        initialPacientes={pacientes || []}
      />
    </div>
  );
}
