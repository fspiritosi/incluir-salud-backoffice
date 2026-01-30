import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  return sessionResponse;
}

export const config = {
  matcher: '/protected/:path*',
};
