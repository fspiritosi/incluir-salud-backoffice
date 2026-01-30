import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CentroForm } from "@/components/forms/centro-form";
import { canManageCentros, type RoleName } from "@/utils/permissions";

export default async function CrearCentroPage() {
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

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Link
          href="/protected/centros"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de centros
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo Centro</h1>
        <p className="text-muted-foreground">Complete el formulario para registrar un nuevo centro.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Centro</CardTitle>
          <CardDescription>Todos los campos son obligatorios a menos que se indique lo contrario.</CardDescription>
        </CardHeader>
        <CardContent>
          <CentroForm />
        </CardContent>
      </Card>
    </div>
  );
}
