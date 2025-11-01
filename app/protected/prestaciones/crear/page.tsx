import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PrestacionForm } from "@/components/prestaciones/PrestacionForm";
import { listObrasSocialesForSelect, listPacientesForSelect, listPrestadoresForSelect } from "@/app/protected/prestaciones/actions";

export default async function CrearPrestacionPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const [{ data: pacientes }, { data: obrasSociales }, { data: prestadores }] = await Promise.all([
    listPacientesForSelect(),
    listObrasSocialesForSelect(),
    listPrestadoresForSelect(),
  ]);

  return (
    <div className="container mx-auto py-10">
      <Link href="/protected/prestaciones" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a la lista de prestaciones
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Nueva Prestación</h1>
      <PrestacionForm pacientes={pacientes || []} obrasSociales={obrasSociales || []} prestadores={prestadores || []} />
    </div>
  );
}
