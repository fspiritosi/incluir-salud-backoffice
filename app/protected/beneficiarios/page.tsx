import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BeneficiariosTable } from "@/components/beneficiarios/BeneficiariosTable";
import { Button } from "@/components/ui/button";
import { listBeneficiarios } from "@/app/protected/beneficiarios/actions";

export default async function BeneficiariosPage() {
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  let roles: string[] = [];
  if (userId) {
    const { data: roleRows } = await supabase
      .from("v_user_roles")
      .select("role")
      .eq("user_id", userId);
    roles = (roleRows || []).map((r: any) => r.role as string);
  }
  const canCreate = roles.some((r) => ["administrativo", "auditor", "super_admin"].includes(r));

  const { data: pacientes, error } = await listBeneficiarios();

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Beneficiarios</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la lista de pacientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Beneficiarios</h1>
        {canCreate ? (
          <Link href="/protected/beneficiarios/crear">
            <Button>Nuevo Beneficiario</Button>
          </Link>
        ) : (
          <Button disabled title="No tenés permiso para crear beneficiarios">Nuevo</Button>
        )}
      </div>
      <BeneficiariosTable data={(pacientes || []) as any} />
    </div>
  );
}

