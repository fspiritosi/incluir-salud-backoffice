import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPrestadores, listDeviceChanges } from "./actions";
import PrestadoresTable from "./components/PrestadoresTable";
import DeviceChangesTable from "./components/DeviceChangesTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PrestadoresPageProps = {
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

export default async function PrestadoresPage({ searchParams }: PrestadoresPageProps) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = toNumber(resolvedSearchParams?.page, 1);
  const pageSize = toNumber(resolvedSearchParams?.pageSize, 25);
  const filters = {
    fechaDesde: toSingle(resolvedSearchParams?.fechaDesde) ?? "",
    fechaHasta: toSingle(resolvedSearchParams?.fechaHasta) ?? "",
    prestadorIds: toArray(resolvedSearchParams?.prestadorIds),
  };

  const { data: prestadores } = await listPrestadores();
  const { data: deviceChanges } = await listDeviceChanges();

  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prestadores</h1>
          <p className="text-gray-600 mt-1">Gestiona los prestadores del sistema</p>
        </div>
      </div>

      <Tabs defaultValue="prestadores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prestadores">Prestadores</TabsTrigger>
          <TabsTrigger value="cambios-dispositivos">Cambios de dispositivos</TabsTrigger>
        </TabsList>

        <TabsContent value="prestadores" className="space-y-4">
          <PrestadoresTable prestadores={prestadores || []} />
        </TabsContent>

        <TabsContent value="cambios-dispositivos" className="space-y-4">
          <DeviceChangesTable 
            deviceChanges={deviceChanges || []} 
            prestadores={prestadores || []}
            filters={filters}
            pagination={{ page, pageSize, total: (deviceChanges || []).length }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
