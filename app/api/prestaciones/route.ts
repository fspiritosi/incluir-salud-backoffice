import { NextResponse } from 'next/server';
import { createPrestacion, createPrestacionesBulk } from '@/app/protected/prestaciones/actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Bulk path: { common: PrestacionInput (sin fecha), fechas: string[] }
    if (body && body.common && Array.isArray(body.fechas)) {
      const { data, error } = await createPrestacionesBulk(body.common, body.fechas);
      if (error) {
        return NextResponse.json({ error: error.message || 'Error en inserción múltiple' }, { status: 400 });
      }
      return NextResponse.json({ inserted: data?.length ?? 0 }, { status: 201 });
    }

    // Single create path
    const { data, error } = await createPrestacion(body);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ id: data?.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
