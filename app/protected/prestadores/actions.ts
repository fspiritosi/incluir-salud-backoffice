"use server";

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

export async function togglePrestadorActivo(id: string, activo: boolean) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .update({ activo })
    .eq("id", id)
    .eq("tipo_usuario", "prestador")
    .select("id, activo")
    .single();

  if (error) {
    console.error('Error actualizando prestador:', error);
    return { data: null, error };
  }

  return { data, error: null };
}
