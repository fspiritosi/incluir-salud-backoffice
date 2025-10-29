'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, UserPlus, Users } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Beneficiarios',
      href: '/protected/beneficiarios',
      icon: Users,
    },
    {
      name: 'Crear Beneficiario',
      href: '/protected/beneficiarios/crear',
      icon: UserPlus,
    },
    {
      name: 'Asignar Beneficiario',
      href: '/protected/beneficiarios/asignar',
      icon: Users,
    },
  ];

  return (
    <div className="hidden border-r bg-muted/40 md:block w-64">
      <div className="flex h-full max-h-screen flex-col gap-2"> 
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 py-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-muted',
                    isActive && 'bg-muted text-primary'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}