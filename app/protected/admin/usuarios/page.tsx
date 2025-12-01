import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackofficeUsersTable from "@/components/admin/BackofficeUsersTable";
import { listBackofficeUsers } from "./actions";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const currentUserId = userRes?.user?.id;
  if (!currentUserId) {
    redirect("/auth/login");
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("v_user_roles")
    .select("role")
    .eq("user_id", currentUserId);

  if (rolesError) {
    redirect("/acceso-denegado");
  }

  const roles = (roleRows || []).map((row) => row.role as string);
  if (!roles.includes("super_admin")) {
    redirect("/acceso-denegado");
  }

  const { data, error } = await listBackofficeUsers();

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Administración</p>
        <h1 className="text-3xl font-bold text-foreground">Permisos de backoffice</h1>
        <p className="text-sm text-muted-foreground">
          Asigná o quitá roles para los usuarios internos del sistema. Sólo visible para super admins.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!!data && data.length > 0 && !error && (
        <BackofficeUsersTable users={data} currentUserId={currentUserId} />
      )}

      {!error && data?.length === 0 && (
        <div className="rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground">
          No hay usuarios de backoffice con roles asignados todavía.
        </div>
      )}
    </div>
  );
}
