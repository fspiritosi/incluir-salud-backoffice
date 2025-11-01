import { NextResponse } from 'next/server';
import { createPrestacion } from '@/app/protected/prestaciones/actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data, error } = await createPrestacion(body);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ id: data?.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
