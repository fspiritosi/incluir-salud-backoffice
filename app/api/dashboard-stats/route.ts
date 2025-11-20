import { NextResponse, type NextRequest } from "next/server";

import { getDashboardStats, type DashboardStatsParams } from "@/actions/dashboard-actions";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const periodParam = searchParams.get("period") ?? undefined;
  const start = searchParams.get("start") ?? undefined;
  const end = searchParams.get("end") ?? undefined;

  const params: DashboardStatsParams = {};

  if (periodParam) {
    params.period = periodParam as DashboardStatsParams["period"];
  }

  if (start || end) {
    if (!start || !end) {
      return NextResponse.json(
        { error: "Debes enviar start y end para un rango personalizado" },
        { status: 400 },
      );
    }

    params.period = "custom";
    params.customRange = { start, end };
  }

  try {
    const stats = await getDashboardStats(params);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error obteniendo estadísticas del dashboard", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las estadísticas" },
      { status: 500 },
    );
  }
}
