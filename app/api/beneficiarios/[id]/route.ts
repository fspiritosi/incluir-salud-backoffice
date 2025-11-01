import { NextResponse } from 'next/server';
import { updateBeneficiario } from '@/app/protected/beneficiarios/actions';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    console.log('=== API PATCH beneficiario ===');
    console.log('ID:', id);
    console.log('Body recibido:', body);
    console.log('Ubicación recibida:', body.ubicacion);
    const { data, error } = await updateBeneficiario(id, body);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
