import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { listPrestaciones } from "@/app/protected/prestaciones/actions";
import { PrestacionesTable } from "@/components/prestaciones/PrestacionesTable";

export default async function PrestacionesPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const { data, error } = await listPrestaciones();
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Prestaciones</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la lista de prestaciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prestaciones</h1>
        <Link href="/protected/prestaciones/crear">
          <Button>Nueva Prestación</Button>
        </Link>
      </div>
      <PrestacionesTable data={(data || []) as any} />
    </div>
  );
}
