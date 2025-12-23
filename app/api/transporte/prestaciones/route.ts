import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transportePrestacionRequestSchema } from "@/lib/validations/transporte-prestacion";
import { canAccessTransporte, type RoleName } from "@/utils/permissions";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = transportePrestacionRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const values: any = parsed.data as any;
    const supabase = await createClient();

    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claims?.claims) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: roleRows, error: rolesError } = await supabase
      .from("v_user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      return NextResponse.json({ error: "No se pudieron verificar permisos" }, { status: 403 });
    }

    const roles = (roleRows || []).map((r: any) => r.role as RoleName);
    if (!canAccessTransporte(roles)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Bulk path: { common, fechas }
    if (values && values.common && Array.isArray(values.fechas)) {
      const common = values.common as any;
      const fechas = (values.fechas as string[]).slice(0, 60).map((f) => {
        try {
          return new Date(f).toISOString();
        } catch {
          return null;
        }
      }).filter(Boolean) as string[];

      if (fechas.length === 0) {
        return NextResponse.json({ error: "No hay fechas válidas" }, { status: 400 });
      }

      const base = {
        tipo_prestacion: "Transporte",
        paciente_id: common.paciente_id,
        user_id: common.user_id,
        centro_id: common.centro_id,
        estado: "pendiente",
        cronico: common.cronico ?? false,
        monto: common.monto == null ? null : Number(common.monto),
        descripcion: common.descripcion ?? null,
        notas: common.notas ?? null,
      } as const;

      if (common.sentido === "ida_y_vuelta") {
        const records = fechas.flatMap((fechaIda, idx) => {
          return [
            { ...base, fecha: fechaIda, sentido_transporte: "ida" },
            { ...base, fecha: fechaIda, sentido_transporte: "vuelta" },
          ];
        });

        const { data, error } = await supabase.from("prestaciones").insert(records).select("id");
        if (error) {
          return NextResponse.json(
            {
              error:
                error.message ||
                "No se pudieron crear prestaciones de transporte. Verificá que exista la columna sentido_transporte en la DB.",
            },
            { status: 400 },
          );
        }

        return NextResponse.json(
          { inserted: records.length, ids: (data || []).map((r: any) => r.id) },
          { status: 201 },
        );
      }

      const records = fechas.map((fecha) => ({
        ...base,
        fecha,
        sentido_transporte: common.sentido,
      }));

      const { data, error } = await supabase.from("prestaciones").insert(records).select("id");
      if (error) {
        return NextResponse.json(
          {
            error:
              error.message ||
              "No se pudieron crear prestaciones de transporte. Verificá que exista la columna sentido_transporte en la DB.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { inserted: records.length, ids: (data || []).map((r: any) => r.id) },
        { status: 201 },
      );
    }

    const base = {
      tipo_prestacion: "Transporte",
      paciente_id: values.paciente_id,
      user_id: values.user_id,
      centro_id: values.centro_id,
      estado: "pendiente",
      cronico: values.cronico ?? false,
      monto: values.monto == null ? null : Number(values.monto),
      descripcion: values.descripcion ?? null,
      notas: values.notas ?? null,
    } as const;

    const fechaIda = new Date(values.fecha).toISOString();

    if (values.sentido === "ida_y_vuelta") {
      const records = [
        { ...base, fecha: fechaIda, sentido_transporte: "ida" },
        { ...base, fecha: fechaIda, sentido_transporte: "vuelta" },
      ];

      const { data, error } = await supabase.from("prestaciones").insert(records).select("id");
      if (error) {
        return NextResponse.json(
          {
            error:
              error.message ||
              "No se pudo crear la prestación de transporte. Verificá que exista la columna sentido_transporte en la DB.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ ids: (data || []).map((r: any) => r.id) }, { status: 201 });
    }

    const record = {
      ...base,
      fecha: fechaIda,
      sentido_transporte: values.sentido,
    };

    const { data, error } = await supabase.from("prestaciones").insert([record]).select("id").single();
    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "No se pudo crear la prestación de transporte. Verificá que exista la columna sentido_transporte en la DB.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ id: data?.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
