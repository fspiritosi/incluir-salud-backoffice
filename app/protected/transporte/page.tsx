import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canAccessTransporte, type RoleName } from "@/utils/permissions";
import { Button } from "@/components/ui/button";

export default async function TransportePage() {
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

  if (!canAccessTransporte(roles)) {
    redirect("/acceso-denegado");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Transporte</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/protected/transporte/crear">
          <Button>Nueva Prestación de Transporte</Button>
        </Link>
        <Link href="/protected/centros">
          <Button variant="outline">Administrar Centros</Button>
        </Link>
      </div>
    </div>
  );
}
