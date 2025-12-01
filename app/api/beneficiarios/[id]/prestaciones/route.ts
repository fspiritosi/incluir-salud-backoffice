import { NextResponse } from "next/server";

import { getPrestacionesByPaciente } from "@/app/protected/beneficiarios/actions";

export async function GET(request: Request, context: { params: Promise<{ id?: string }> }) {
  try {
    const { id: pacienteId } = await context.params;
    if (!pacienteId) {
      return NextResponse.json({ error: "ID de paciente inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    const result = await getPrestacionesByPaciente(pacienteId, { startDate, endDate });
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message ?? "No se pudieron obtener las prestaciones" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.data ?? [] });
  } catch (error: any) {
    console.error("Error obteniendo prestaciones dinámicas del paciente", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudieron obtener las prestaciones" },
      { status: 500 }
    );
  }
}
