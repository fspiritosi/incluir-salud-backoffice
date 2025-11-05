import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log('Middleware - Usuario:', user?.id);

  if (!user || error) {
    console.log('Redirigiendo a login - No user or error:', error);
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Verificación de roles con logging
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role_id, user_id')
    .eq('user_id', user.id);

  console.log('Roles encontrados:', roles, 'Error:', rolesError);

  if (rolesError) {
    console.error('Error al verificar roles:', rolesError);
  }

  if (!roles || roles.length === 0) {
    console.log('Redirigiendo a acceso-denegado - No roles');
    return NextResponse.redirect(new URL('/acceso-denegado', request.url));
  }

  console.log('Acceso permitido para usuario:', user.id, 'con roles:', roles);
  return sessionResponse;
}

export const config = {
  matcher: '/protected/:path*',
};
