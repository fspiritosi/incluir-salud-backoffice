"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { BACKOFFICE_ROLE_OPTIONS, type RoleName } from "@/utils/permissions";

export type BackofficeUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  documentNumber: string | null;
  roles: RoleName[];
  createdAt: string | null;
  lastSignInAt: string | null;
};

type ProfileRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  documento: string | null;
  email: string | null;
};

type ListResponse = { data: BackofficeUser[]; error: null } | { data: null; error: string };
type ActionResponse = { success: boolean; error?: string };

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Faltan credenciales del servicio de Supabase (service role)");
    return null;
  }
  return createAdminClient(url, serviceKey);
}

const roleIdCache = new Map<RoleName, string>();

async function resolveRoleId(admin: SupabaseClient, role: RoleName) {
  const cached = roleIdCache.get(role);
  if (cached) return cached;

  const { data, error } = await admin.from("roles").select("id").eq("name", role).single();
  if (error || !data?.id) {
    console.error(`No se pudo obtener role_id para ${role}`, error);
    return null;
  }

  roleIdCache.set(role, data.id);
  return data.id;
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  if (userError || !userRes?.user?.id) {
    throw new Error("Usuario no autenticado");
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("v_user_roles")
    .select("role")
    .eq("user_id", userRes.user.id);

  if (rolesError) {
    console.error("No se pudieron leer los roles del actor", rolesError);
    throw new Error("No autorizado");
  }

  const roles = (roleRows || []).map((row) => row.role as RoleName);
  if (!roles.includes("super_admin")) {
    throw new Error("No autorizado");
  }

  return { currentUserId: userRes.user.id };
}

function buildDisplayName(
  firstName: string | null,
  lastName: string | null,
  fallback?: string | null,
) {
  const parts = [lastName, firstName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return fallback ?? null;
}

export async function listBackofficeUsers(): Promise<ListResponse> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "No autorizado",
    };
  }

  const admin = getAdminSupabase();
  if (!admin) {
    return { data: null, error: "No hay credenciales para listar usuarios" };
  }

  const { data: profileRows, error: profilesError } = await admin
    .from("profiles")
    .select("id, nombre, apellido, documento, email")
    .eq("registration_source", "web")
    .order("apellido", { ascending: true, nullsFirst: true })
    .order("nombre", { ascending: true, nullsFirst: true });

  if (profilesError) {
    console.error("No se pudieron obtener perfiles de backoffice", profilesError);
    return { data: null, error: "No se pudieron obtener los usuarios" };
  }

  if (!profileRows || profileRows.length === 0) {
    return { data: [], error: null };
  }

  const userIds = profileRows.map((profile) => profile.id);

  const rolesByUser = new Map<string, RoleName[]>();
  if (userIds.length > 0) {
    const { data: roleRows, error: rolesError } = await admin
      .from("v_user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    if (rolesError) {
      console.error("Error listando roles de usuarios", rolesError);
      return { data: null, error: "No se pudieron obtener los roles actuales" };
    }

    for (const row of roleRows ?? []) {
      const roles = rolesByUser.get(row.user_id) ?? [];
      if (!roles.includes(row.role as RoleName)) {
        roles.push(row.role as RoleName);
      }
      rolesByUser.set(row.user_id, roles);
    }
  }

  const authMap = new Map<
    string,
    {
      email: string | null;
      created_at: string | null;
      last_sign_in_at: string | null;
      user_metadata?: Record<string, any> | null;
    }
  >();

  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data, error: authError } = await admin.auth.admin.getUserById(id);
        if (authError) {
          console.warn(`No se pudo obtener auth.user ${id}`, authError);
          return;
        }
        if (data?.user) {
          authMap.set(id, {
            email: data.user.email ?? null,
            created_at: data.user.created_at ?? null,
            last_sign_in_at: (data.user as any).last_sign_in_at ?? null,
            user_metadata: data.user.user_metadata ?? null,
          });
        }
      } catch (err) {
        console.warn(`Fallo getUserById(${id})`, err);
      }
    }),
  );

  const collator = new Intl.Collator("es");
  const users: BackofficeUser[] = profileRows
    .map((profile) => {
      const authUser = authMap.get(profile.id);
      const metadata = authUser?.user_metadata ?? {};
      const firstName = profile.nombre ?? metadata.first_name ?? metadata.nombre ?? null;
      const lastName = profile.apellido ?? metadata.last_name ?? metadata.apellido ?? null;
      const fullName = buildDisplayName(firstName, lastName, metadata.full_name ?? null);
      const documentNumber = profile.documento ?? metadata.document_number ?? null;

      return {
        id: profile.id,
        email: profile.email ?? authUser?.email ?? metadata.email ?? null,
        firstName,
        lastName,
        fullName,
        documentNumber,
        roles: rolesByUser.get(profile.id) ?? [],
        createdAt: authUser?.created_at ?? null,
        lastSignInAt: authUser?.last_sign_in_at ?? null,
      } satisfies BackofficeUser;
    })
    .sort((a, b) => {
      const left = a.fullName || a.email || "";
      const right = b.fullName || b.email || "";
      return collator.compare(left, right);
    });

  return { data: users, error: null };
}

export async function assignUserRole(userId: string, role: RoleName): Promise<ActionResponse> {
  if (!userId) {
    return { success: false, error: "Usuario inválido" };
  }
  if (!BACKOFFICE_ROLE_OPTIONS.includes(role)) {
    return { success: false, error: "Rol no permitido" };
  }

  try {
    await requireSuperAdmin();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No autorizado",
    };
  }

  const admin = getAdminSupabase();
  if (!admin) {
    return { success: false, error: "No hay credenciales para asignar roles" };
  }

  const roleId = await resolveRoleId(admin, role);
  if (!roleId) {
    return { success: false, error: "Rol no configurado en la base" };
  }

  const { error } = await admin
    .from("user_roles")
    .upsert(
      { user_id: userId, role_id: roleId },
      { onConflict: "user_id,role_id", ignoreDuplicates: true },
    );

  if (error) {
    console.error("Error asignando rol", error);
    return { success: false, error: "No se pudo asignar el rol" };
  }

  revalidatePath("/protected/admin/usuarios");
  return { success: true };
}

export async function removeUserRole(userId: string, role: RoleName): Promise<ActionResponse> {
  if (!userId) {
    return { success: false, error: "Usuario inválido" };
  }
  if (!BACKOFFICE_ROLE_OPTIONS.includes(role)) {
    return { success: false, error: "Rol no permitido" };
  }

  try {
    await requireSuperAdmin();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No autorizado",
    };
  }

  const admin = getAdminSupabase();
  if (!admin) {
    return { success: false, error: "No hay credenciales para eliminar roles" };
  }

  const roleId = await resolveRoleId(admin, role);
  if (!roleId) {
    return { success: false, error: "Rol no configurado en la base" };
  }

  if (role === "super_admin") {
    const { data: currentSupers, error: superError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role_id", roleId);
    if (superError) {
      console.error("No se pudo validar los super admins", superError);
      return { success: false, error: "No se pudo validar la operación" };
    }
    const remaining = (currentSupers || []).filter((row) => row.user_id !== userId);
    if (remaining.length === 0) {
      return {
        success: false,
        error: "Debe permanecer al menos un super admin activo",
      };
    }
  }

  const { error } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", roleId);

  if (error) {
    console.error("Error eliminando rol", error);
    return { success: false, error: "No se pudo eliminar el rol" };
  }

  revalidatePath("/protected/admin/usuarios");
  return { success: true };
}
