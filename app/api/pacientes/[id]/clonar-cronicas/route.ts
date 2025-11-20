import { NextResponse } from "next/server";
import { clonePrestacionesCronicasPaciente } from "@/app/protected/beneficiarios/actions";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await clonePrestacionesCronicasPaciente(id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error clonando prestaciones crónicas", error);
    return NextResponse.json(
      { error: error?.message || "No se pudieron clonar las prestaciones" },
      { status: 500 }
    );
  }
}
