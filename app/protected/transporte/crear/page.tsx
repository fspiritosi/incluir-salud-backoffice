import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TransportePrestacionForm } from "@/components/transporte/TransportePrestacionForm";
import {
  listCentrosForSelect,
  listPacientesForSelect,
  listPrestadoresByEspecialidad,
} from "@/app/protected/prestaciones/actions";
import { canAccessTransporte, type RoleName } from "@/utils/permissions";

export default async function CrearPrestacionTransportePage() {
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  let roles: RoleName[] = [];
  if (userId) {
    const { data: roleRows, error: rolesError } = await supabase
      .from("v_user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      redirect("/acceso-denegado");
    }

    roles = (roleRows || []).map((r: any) => r.role as RoleName);
  }

  if (!canAccessTransporte(roles)) {
    redirect("/acceso-denegado");
  }

  const [{ data: pacientes }, { data: prestadores }, { data: centros }] = await Promise.all([
    listPacientesForSelect(),
    listPrestadoresByEspecialidad("Transporte"),
    listCentrosForSelect(),
  ]);

  return (
    <div className="container mx-auto py-10">
      <Link
        href="/protected/transporte"
        className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Transporte
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Nueva Prestación de Transporte</h1>
      <TransportePrestacionForm
        pacientes={pacientes || []}
        prestadores={prestadores || []}
        centros={centros || []}
      />
    </div>
  );
}
