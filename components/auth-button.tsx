'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';

export function AuthButton({ isCollapsed }: { isCollapsed: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<{nombre?: string; apellido?: string} | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombre, apellido')
          .eq('id', user.id)
          .single();
        setUser(profile);
      }
    };

    getSession();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      {!isCollapsed && user && (
        <span className="text-sm font-medium px-2">
          Hola, {user.nombre} {user.apellido}!
        </span>
      )}
      <Button 
        variant={isCollapsed ? "ghost" : "default"}
        onClick={handleSignOut}
        size={isCollapsed ? "icon" : "default"}
        className={isCollapsed ? "w-10 h-10" : "w-32"}
      >
        {isCollapsed ? <LogOut className="h-4 w-4" /> : 'Cerrar sesión'}
      </Button>
    </div>
  );
}
