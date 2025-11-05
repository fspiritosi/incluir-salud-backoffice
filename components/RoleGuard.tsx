'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (!user || error) {
        router.push('/auth/login');
        return;
      }

      // Verificar si el usuario tiene AL MENOS UN rol
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      // Solo redirigir si no tiene NINGÚN rol
      if (rolesError || !roles || roles.length === 0) {
        router.push('/acceso-denegado');
      }
    };

    checkRole();
  }, [supabase, router]);

  return <>{children}</>;
}
