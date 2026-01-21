import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canAccessTransporte, type RoleName } from "@/utils/permissions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransportePrestacionesTable } from "@/components/transporte/TransportePrestacionesTable";
import PrestacionesReassignTable from "@/components/prestaciones/PrestacionesReassignTable";
import { listTransportePrestaciones } from "./actions";
import { listPrestacionesParaReasignar, listPrestadoresByEspecialidad } from "@/app/protected/prestaciones/actions";

type TransportePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_UI_PAGE_SIZE = 25;

const toArray = (value: string | string[] | undefined) => {
  if (!value) return [] as string[];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

const toSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const sanitizeActivo = (raw: string | undefined): "todos" | "si" | "no" => {
  if (raw === "si" || raw === "no") return raw;
  return "todos";
};

export default async function TransportePage({ searchParams }: TransportePageProps) {
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

  if (!canAccessTransporte(roles)) {
    redirect("/acceso-denegado");
  }

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
    fechaDesde: toSingle(resolvedSearchParams?.fechaDesde) ?? "",
    fechaHasta: toSingle(resolvedSearchParams?.fechaHasta) ?? "",
  } as const;

  const [prestacionesResult, citiesResult, poolResult] = await Promise.all([
    listTransportePrestaciones({
      page,
      pageSize,
      search: filters.search,
      ids: filters.ids,
      ciudades: filters.ciudades,
      activo: filters.activo,
      fechaDesde: filters.fechaDesde,
      fechaHasta: filters.fechaHasta,
    }),
    supabase
      .from("pacientes")
      .select("ciudad")
      .not("ciudad", "is", null)
      .order("ciudad", { ascending: true }),
    listPrestacionesParaReasignar({ tipoPrestacion: "Transporte" }),
  ]);

  const { data: prestaciones, total, error } = prestacionesResult;
  const { data: poolData, error: poolError } = poolResult;

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Transporte</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la lista de prestaciones</p>
      </div>
    );
  }

  if (poolError) {
    console.error("No se pudo cargar la cola de reasignación de transporte", poolError);
  }

  const uniqueCities = new Set<string>();
  (citiesResult.data || []).forEach((row) => {
    if (typeof row.ciudad === "string" && row.ciudad.trim()) {
      uniqueCities.add(row.ciudad.trim());
    }
  });
  const allCities = Array.from(uniqueCities).sort((a, b) => a.localeCompare(b));

  const { data: prestadoresTransporte } = await listPrestadoresByEspecialidad("Transporte");
  const prestadoresPorTipo = {
    Transporte: prestadoresTransporte || [],
  } as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Transporte</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/protected/transporte/crear">
          <Button>Nueva Prestación de Transporte</Button>
        </Link>
        <Link href="/protected/centros">
          <Button variant="outline">Administrar Centros</Button>
        </Link>
      </div>
      <Tabs defaultValue="prestaciones" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prestaciones">Prestaciones</TabsTrigger>
          <TabsTrigger value="reasignar">
            Reasignar
            <span className="ml-2 rounded-full bg-black/10 px-2 text-xs">
              {poolData?.length ?? 0}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prestaciones">
          <TransportePrestacionesTable
            data={prestaciones || []}
            pagination={{
              page,
              pageSize,
              total: total ?? prestaciones?.length ?? 0,
            }}
            filters={filters}
            allCities={allCities}
          />
        </TabsContent>

        <TabsContent value="reasignar">
          <PrestacionesReassignTable
            data={poolData || []}
            prestadoresPorTipo={prestadoresPorTipo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
