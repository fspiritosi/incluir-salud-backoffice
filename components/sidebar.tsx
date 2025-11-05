'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, UserPlus, Users, Stethoscope, ClipboardList, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBackofficeRoles } from '@/hooks/useBackofficeRoles';
import { canCreateOrEditPaciente } from '@/utils/permissions';

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { roles, loading } = useBackofficeRoles();
  const canCreateBenef = canCreateOrEditPaciente(roles);

  const menuItems = [
    {
      name: 'Dashboard',
      href: '/protected',
      icon: LayoutDashboard,
    },
    {
      name: 'Beneficiarios',
      href: '/protected/beneficiarios',
      icon: Users,
    },
    // Crear Beneficiario: solo si tiene permiso
    canCreateBenef ? {
      name: 'Crear Beneficiario',
      href: '/protected/beneficiarios/crear',
      icon: UserPlus,
    } : null,
    {
      name: 'Prestaciones',
      href: '/protected/prestaciones',
      icon: ClipboardList,
    },
    {
      name: 'Prestadores',
      href: '/protected/prestadores',
      icon: Stethoscope,
    },
    {
      name: 'Reportes',
      href: '/protected/reportes',
      icon: FileText,
    },
  ];

  return (
    <div className={cn(
      "hidden border-r bg-muted/40 md:block transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-full max-h-screen flex-col gap-2"> 
        {/* Botón de colapsar */}
        <div className="flex justify-end p-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 py-4 space-y-1">
            {menuItems.filter(Boolean).map((item: any) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-muted',
                    isActive && 'bg-muted text-primary',
                    isCollapsed && 'justify-center'
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}