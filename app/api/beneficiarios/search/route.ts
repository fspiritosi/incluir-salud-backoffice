import { NextRequest, NextResponse } from "next/server";
import { searchBeneficiariosIdentidad } from "@/app/protected/beneficiarios/actions";

const toBool = (value: string | null) =>
  value === "true" || value === "1" || value === "yes";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 25;
    const query = params.get("query") || undefined;
    const includeInactivos = toBool(params.get("includeInactivos"));
    const ids = params.getAll("ids").filter(Boolean);

    const { data, total, error } = await searchBeneficiariosIdentidad({
      page,
      pageSize,
      query,
      includeInactivos,
      ids: ids.length ? ids : undefined,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Error buscando beneficiarios" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error in /api/beneficiarios/search", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
