import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PrestacionForm } from "@/components/prestaciones/PrestacionForm";
import { getPrestacionById, listObrasSocialesForSelect, listPacientesForSelect, listPrestadoresForSelect } from "@/app/protected/prestaciones/actions";

export default async function EditarPrestacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  if (!id) {
    return (
      <div className="container mx-auto py-10">
        <Link href="/protected/prestaciones" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de prestaciones
        </Link>
        <p className="text-red-600 text-sm">ID inválido</p>
      </div>
    );
  }

  const [{ data, error }, { data: pacientes }, { data: obrasSociales }, { data: prestadores }] = await Promise.all([
    getPrestacionById(id),
    listPacientesForSelect(),
    listObrasSocialesForSelect(),
    listPrestadoresForSelect(),
  ]);

  if (error || !data) {
    return (
      <div className="container mx-auto py-10">
        <Link href="/protected/prestaciones" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de prestaciones
        </Link>
        <p className="text-red-600 text-sm">No se encontró la prestación</p>
        {error && (
          <pre className="mt-2 text-xs text-muted-foreground">{error.message}</pre>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Link href="/protected/prestaciones" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a la lista de prestaciones
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Editar Prestación</h1>
      <PrestacionForm initialData={data} isEditing pacientes={pacientes || []} obrasSociales={obrasSociales || []} prestadores={prestadores || []} />
    </div>
  );
}
