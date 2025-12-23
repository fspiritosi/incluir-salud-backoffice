import { NextResponse } from "next/server";
import { setCentroActivo } from "@/app/protected/centros/actions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { activo } = body as { activo?: boolean };
    if (typeof activo !== "boolean") {
      return NextResponse.json({ error: 'Campo "activo" requerido (boolean)' }, { status: 400 });
    }

    const { id } = await params;
    const { data, error } = await setCentroActivo(id, activo);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ id: data?.id, activo: data?.activo }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
