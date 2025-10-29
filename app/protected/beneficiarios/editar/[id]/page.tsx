import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BeneficiarioForm } from "@/components/forms/beneficiario-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditarBeneficiarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  if (!id) {
    return (
      <div className="container mx-auto py-10">
        <Link href="/protected/beneficiarios" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de beneficiarios
        </Link>
        <p className="text-red-600 text-sm">ID inválido</p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nombre, apellido, documento, telefono, email, direccion_completa, ciudad, provincia, codigo_postal, activo, ubicacion")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <div className="container mx-auto py-10">
        <Link href="/protected/beneficiarios" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de beneficiarios
        </Link>
        <p className="text-red-600 text-sm">No se encontró el beneficiario</p>
        {error && (
          <pre className="mt-2 text-xs text-muted-foreground">{error.message}</pre>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Link href="/protected/beneficiarios" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a la lista de beneficiarios
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Editar Beneficiario</h1>
      <BeneficiarioForm initialData={data} isEditing />
    </div>
  );
}
