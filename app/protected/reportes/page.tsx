import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReporteGenerator from "./components/ReporteGenerator";
import ReporteBeneficiarioGenerator from "./components/ReporteBeneficiarioGenerator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPrestadores, getBeneficiarios } from "./actions";

export default async function ReportesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const [prestadores, beneficiarios] = await Promise.all([
    getPrestadores(),
    getBeneficiarios(),
  ]);

  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Reportes de Prestaciones</h1>
        <p className="mt-1">
          Genera reportes de prestaciones por prestador y rango de fechas
        </p>
      </div>

      <Tabs defaultValue="prestador" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prestador">Por prestador</TabsTrigger>
          <TabsTrigger value="beneficiario">Por beneficiario</TabsTrigger>
        </TabsList>
        <TabsContent value="prestador">
          <ReporteGenerator prestadores={prestadores} />
        </TabsContent>
        <TabsContent value="beneficiario">
          <ReporteBeneficiarioGenerator beneficiarios={beneficiarios} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
