import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  lng?: number;
  lat?: number;
  precision_m?: number | null;
  ubicacion?: { lng?: number; lat?: number } | null;
};

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => null)) as Body | null;

    const lng = Number(body?.ubicacion?.lng ?? body?.lng);
    const lat = Number(body?.ubicacion?.lat ?? body?.lat);
    const precision_m = body?.precision_m == null ? null : Number(body.precision_m);

    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json({ error: "Ubicación inválida" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claims?.claims) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const ewkt = `SRID=4326;POINT(${lng} ${lat})`;

    const { error } = await supabase.rpc("sugerir_ubicacion_paciente", {
      p_paciente_id: id,
      p_ubicacion: ewkt,
      p_precision_m: Number.isFinite(precision_m as number) ? precision_m : null,
    });

    if (error) {
      const msg = String(error.message || "");
      if (msg.toLowerCase().includes("ya existe") || msg.toLowerCase().includes("pendiente")) {
        return NextResponse.json({ error: msg }, { status: 409 });
      }
      if (msg.toLowerCase().includes("no autenticado")) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
      return NextResponse.json({ error: msg || "No se pudo sugerir ubicación" }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
