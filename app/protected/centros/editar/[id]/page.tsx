import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CentroForm } from "@/components/forms/centro-form";
import { getCentroById } from "@/app/protected/centros/actions";
import { canManageCentros, type RoleName } from "@/utils/permissions";

export default async function EditarCentroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  if (!id) {
    return (
      <div className="container mx-auto py-10">
        <Link href="/protected/centros" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de centros
        </Link>
        <p className="text-red-600 text-sm">ID inválido</p>
      </div>
    );
  }

  const { data, error } = await getCentroById(id);

  if (error || !data) {
    return (
      <div className="container mx-auto py-10">
        <Link href="/protected/centros" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de centros
        </Link>
        <p className="text-red-600 text-sm">No se encontró el centro</p>
        {error && <pre className="mt-2 text-xs text-muted-foreground">{error.message}</pre>}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Link href="/protected/centros" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a la lista de centros
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Editar Centro</h1>
      <CentroForm initialData={data} isEditing />
    </div>
  );
}
