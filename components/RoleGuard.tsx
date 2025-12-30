'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BACKOFFICE_ROLE_OPTIONS, type RoleName } from '@/utils/permissions';

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
        .from('v_user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roleNames = (roles || []).map((r: any) => r.role as RoleName);
      const hasBackofficeRole = roleNames.some((r) => BACKOFFICE_ROLE_OPTIONS.includes(r));

      // Solo permitir roles del backoffice
      if (rolesError || !hasBackofficeRole) {
        router.push('/acceso-denegado');
      }
    };

    checkRole();
  }, [supabase, router]);

  return <>{children}</>;
}
