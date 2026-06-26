import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listPrestaciones, listPrestacionesParaReasignar, listPrestadoresByEspecialidad, listPrestadoresDePrestaciones, listPacientesConPrestaciones } from "@/app/protected/prestaciones/actions";
import { PrestacionesTable, type PrestacionRow } from "@/components/prestaciones/PrestacionesTable";
import PrestacionesReassignTable from "@/components/prestaciones/PrestacionesReassignTable";
import { CloneCronicasGlobalButton } from "@/components/prestaciones/CloneCronicasGlobalButton";

type PrestacionesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const toArray = (value: string | string[] | undefined) => {
  if (!value) return [] as string[];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

const toSingle = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const toNumber = (value: string | string[] | undefined, defaultValue: number) => {
  const num = Number(toSingle(value));
  return Number.isNaN(num) || num <= 0 ? defaultValue : num;
};

export default async function PrestacionesPage({ searchParams }: PrestacionesPageProps) {
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
  const canCreate = roles.some((r) => ["auditor", "super_admin"].includes(r));
  const isSuperAdmin = roles.includes("super_admin");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = toNumber(resolvedSearchParams?.page, 1);
  const pageSize = toNumber(resolvedSearchParams?.pageSize, 25);
  const filters = {
    fechaDesde: toSingle(resolvedSearchParams?.fechaDesde) ?? "",
    fechaHasta: toSingle(resolvedSearchParams?.fechaHasta) ?? "",
    pacienteIds: toArray(resolvedSearchParams?.pacienteIds),
    prestadorIds: toArray(resolvedSearchParams?.prestadorIds),
    estados: toArray(resolvedSearchParams?.estados),
  };

  const [{ data, error, pagination }, { data: poolData, error: poolError }, { data: allPrestadores }, { data: allPacientes }] = await Promise.all([
    listPrestaciones({
      fechaDesde: filters.fechaDesde,
      fechaHasta: filters.fechaHasta,
      pacienteIds: filters.pacienteIds,
      prestadorIds: filters.prestadorIds,
      estados: filters.estados,
      page,
      pageSize,
    }),
    listPrestacionesParaReasignar(),
    listPrestadoresDePrestaciones(),
    listPacientesConPrestaciones(),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Prestaciones</h1>
        <p className="text-red-600 text-sm">No se pudo cargar la lista de prestaciones</p>
      </div>
    );
  }

  if (poolError) {
    console.error("No se pudo cargar la cola de reasignación", poolError);
  }

  const prestadoresPorTipo: Record<string, { id: string; apellido: string; nombre: string; documento?: string }[]> = {};
  const tiposNecesarios = Array.from(new Set((poolData || [])
    .map((row) => row.prestacion?.tipo_prestacion)
    .filter((tipo): tipo is string => Boolean(tipo))));

  if (tiposNecesarios.length > 0) {
    await Promise.all(tiposNecesarios.map(async (tipo) => {
      const { data: prestadoresTipo, error: prestadoresTipoError } = await listPrestadoresByEspecialidad(tipo);
      if (prestadoresTipoError) {
        console.error(`No se pudo obtener prestadores para ${tipo}`, prestadoresTipoError);
        prestadoresPorTipo[tipo] = [];
        return;
      }
      prestadoresPorTipo[tipo] = prestadoresTipo;
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prestaciones</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná prestaciones activas o reasigná las canceladas automáticamente.
          </p>
        </div>
        {canCreate ? (
          <div className="flex items-center gap-2">
            {isSuperAdmin && <CloneCronicasGlobalButton />}
            <Link href="/protected/prestaciones/crear-por-centro">
              <Button variant="outline">Crear por Centro</Button>
            </Link>
            <Link href="/protected/prestaciones/crear">
              <Button>Nueva Prestación</Button>
            </Link>
          </div>
        ) : (
          <Button disabled title="No tenés permiso para crear prestaciones">Nueva Prestación</Button>
        )}
      </div>

      <Tabs defaultValue="todas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="reasignar">
            Reasignar
            <span className="ml-2 rounded-full bg-black/10 px-2 text-xs">
              {poolData?.length ?? 0}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todas">
          <PrestacionesTable
            data={(data || []) as PrestacionRow[]}
            filters={filters}
            pagination={pagination}
            allPrestadores={allPrestadores || []}
            allPacientes={allPacientes || []}
          />
        </TabsContent>

        <TabsContent value="reasignar">
          <PrestacionesReassignTable data={poolData || []} prestadoresPorTipo={prestadoresPorTipo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
