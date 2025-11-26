"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function listPrestadores() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, documento, email, telefono, activo, created_at")
    .eq("tipo_usuario", "prestador")
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error('Error listando prestadores:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

type TogglePrestadorResponse = Promise<{ data: { cancelledCount: number } | null; error: any }>;

export async function togglePrestadorActivo(id: string, activo: boolean): TogglePrestadorResponse {
  const supabase = await createClient();

  // Si se deshabilita, usar la función RPC para cancelar prestaciones pendientes y cargarlas al pool
  if (!activo) {
    const { data: userRes, error: userError } = await supabase.auth.getUser();
    if (userError || !userRes?.user?.id) {
      const err = userError ?? new Error("Usuario no autenticado");
      console.error("No se pudo obtener el usuario que deshabilita: ", err);
      return { data: null, error: err };
    }

    const { data, error } = await supabase.rpc("disable_prestador_and_cancel", {
      p_prestador_id: id,
      p_actor_id: userRes.user.id,
      p_reason: "Prestador deshabilitado",
    });

    if (error) {
      console.error("Error deshabilitando prestador con cascada:", error);
      return { data: null, error };
    }

    revalidatePath("/protected/prestadores");
    revalidatePath("/protected/prestaciones");

    const cancelledCount = Array.isArray(data) && data[0]?.cancelled_count ? Number(data[0].cancelled_count) : 0;
    return { data: { cancelledCount }, error: null };
  }

  const { error } = await supabase.rpc("set_prestador_activo", {
    p_prestador_id: id,
    p_activo: true,
  });

  if (error) {
    console.error('Error actualizando prestador:', error);
    return { data: null, error };
  }

  revalidatePath("/protected/prestadores");
  return { data: { cancelledCount: 0 }, error: null };
}
