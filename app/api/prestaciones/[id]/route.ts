import { NextResponse } from 'next/server';
import { updatePrestacion } from '@/app/protected/prestaciones/actions';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { data, error } = await updatePrestacion(params.id, body);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
