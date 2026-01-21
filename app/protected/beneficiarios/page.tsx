import { redirect } from "next/navigation";
import Link from "next/link";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BeneficiariosTable } from "@/components/beneficiarios/BeneficiariosTable";
import { Button } from "@/components/ui/button";
import { listBeneficiarios } from "./actions";

type BeneficiariosPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_UI_PAGE_SIZE = 25;

const toArray = (value: string | string[] | undefined) => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

const toSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const sanitizeActivo = (raw: string | undefined): "todos" | "si" | "no" => {
  if (raw === "si" || raw === "no") return raw;
  return "todos";
};

export default async function BeneficiariosPage({ searchParams }: BeneficiariosPageProps) {
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  let roles: string[] = [];
  if (userId) {
    const { data: roleRows } = await supabase
      .from("v_user_roles")
      .select("role")
      .eq("user_id", userId);
    roles = (roleRows || []).map((r: any) => r.role as string);
  }
  const canCreate = roles.some((r) => ["administrativo", "auditor", "super_admin"].includes(r));

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageParam = toSingle(resolvedSearchParams?.page);
  const pageSizeParam = toSingle(resolvedSearchParams?.pageSize);
  const parsedPage = Number(pageParam);
  const parsedPageSize = Number(pageSizeParam);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : DEFAULT_UI_PAGE_SIZE;

  const filters = {
    search: toSingle(resolvedSearchParams?.search) ?? "",
    ids: toArray(resolvedSearchParams?.ids),
    ciudades: toArray(resolvedSearchParams?.ciudades),
    activo: sanitizeActivo(toSingle(resolvedSearchParams?.activo)),
  };

  // Ejecutar queries en paralelo para mejor performance
  const [beneficiariosResult, citiesResult] = await Promise.all([
    listBeneficiarios({
      page,
      pageSize,
      search: filters.search,
      ids: filters.ids,
      ciudades: filters.ciudades,
      activo: filters.activo,
    }),
    supabase
      .from("pacientes")
      .select("ciudad")
      .not("ciudad", "is", null)
      .order("ciudad", { ascending: true }),
  ]);

  const { data: pacientes, total, error } = beneficiariosResult;

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Beneficiarios</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la lista de pacientes</p>
      </div>
    );
  }

  const uniqueCities = new Set<string>();
  (citiesResult.data || []).forEach((row) => {
    if (typeof row.ciudad === "string" && row.ciudad.trim()) {
      uniqueCities.add(row.ciudad.trim());
    }
  });
  const allCities = Array.from(uniqueCities).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Beneficiarios</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? (
            <>
              <Link href="/protected/beneficiarios/importar">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar padrón
                </Button>
              </Link>
              <Link href="/protected/beneficiarios/crear">
                <Button>Nuevo Beneficiario</Button>
              </Link>
            </>
          ) : (
            <>
              <Button disabled title="No tenés permiso para importar">Importar</Button>
              <Button disabled title="No tenés permiso para crear beneficiarios">Nuevo</Button>
            </>
          )}
        </div>
      </div>
      <BeneficiariosTable
        data={(pacientes || []) as any}
        pagination={{
          page,
          pageSize,
          total: total ?? pacientes?.length ?? 0,
        }}
        filters={filters}
        allCities={allCities}
      />
    </div>
  );
}

