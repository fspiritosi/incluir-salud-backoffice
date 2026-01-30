import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import CentrosTable from "./ui/CentrosTable";
import { listCentros } from "./actions";
import { canManageCentros, type RoleName } from "@/utils/permissions";

type CentrosPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const toSingle = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const toArray = (value: string | string[] | undefined) => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

const sanitizeActivo = (raw: string | undefined): "todos" | "si" | "no" => {
  if (raw === "si" || raw === "no") return raw;
  return "todos";
};

export default async function CentrosPage({ searchParams }: CentrosPageProps) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = {
    search: toSingle(resolvedSearchParams?.search) ?? "",
    tipos: toArray(resolvedSearchParams?.tipos) as any,
    activo: sanitizeActivo(toSingle(resolvedSearchParams?.activo)),
  };

  const { data: centros, error } = await listCentros({
    search: filters.search,
    tipos: filters.tipos,
    activo: filters.activo,
  });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Centros</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la lista de centros</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Centros</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/protected/centros/crear">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Centro
            </Button>
          </Link>
        </div>
      </div>

      <CentrosTable data={(centros || []) as any} />
    </div>
  );
}
