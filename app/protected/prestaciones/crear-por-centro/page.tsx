import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { canCreateOrEditPrestacion, type RoleName } from "@/utils/permissions";
import { listPrestadoresByEspecialidad } from "../actions";
import { listCentros } from "../../centros/actions";
import CrearPorCentroForm from "./ui/CrearPorCentroForm";

export default async function CrearPorCentroPage() {
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

  if (!canCreateOrEditPrestacion(roles)) {
    redirect("/acceso-denegado");
  }

  // Obtener centros activos (solo geriátricos)
  const { data: centros } = await listCentros({ activo: "si", tipos: ["geriatrico"] });

  // Obtener prestadores de AT
  const { data: prestadores } = await listPrestadoresByEspecialidad("Acompañante Terapeutico");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/protected/prestaciones">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Crear Prestaciones por Centro</h1>
        </div>
      </div>

      <p className="text-muted-foreground">
        Creá prestaciones de Acompañante Terapéutico para todos los pacientes asignados a un geriátrico.
      </p>

      <CrearPorCentroForm
        centros={(centros || []).map(c => ({ id: c.id, nombre: c.nombre }))}
        prestadores={(prestadores || []).map(p => ({ 
          id: p.id, 
          nombre: p.nombre, 
          apellido: p.apellido,
          documento: p.documento 
        }))}
      />
    </div>
  );
}
