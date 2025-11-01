import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPrestadores } from "./actions";
import PrestadoresTable from "./components/PrestadoresTable";

export default async function PrestadoresPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const { data: prestadores } = await listPrestadores();

  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prestadores</h1>
          <p className="text-gray-600 mt-1">Gestiona los prestadores del sistema</p>
        </div>
      </div>

      <PrestadoresTable prestadores={prestadores || []} />
    </div>
  );
}
