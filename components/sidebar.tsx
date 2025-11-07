'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Stethoscope, ClipboardList, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AuthButton } from '@/components/auth-button';
import Image from 'next/image';

type SidebarProps = {
  isCollapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

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
    {
      name: 'Prestaciones',
      href: '/protected/prestaciones',
      icon: ClipboardList,
    },
    {
      name: 'Reportes',
      href: '/protected/reportes',
      icon: FileText,
    },
  ];

  return (
    <div className={cn(
      "fixed left-0 top-0 h-screen border-r bg-background transition-all duration-300 z-20",
      isCollapsed ? "w-16" : "w-56"
    )}>
      <div className="flex h-full flex-col gap-4">
        <div className={cn(
          "p-4",
          isCollapsed ? "flex flex-col gap-2" : "flex items-center justify-between"
        )}>
          {isCollapsed ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8 self-end"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Link href="/protected" className="flex justify-center">
                <div className="p-1 rounded-lg bg-primary/10">
                  <Image 
                    src="/images/logoIncluirTransparente.png" 
                    alt="Logo" 
                    width={32} 
                    height={32}
                    className="rounded-md"
                  />
                </div>
              </Link>
            </>
          ) : (
            <>
              <Link href="/protected" className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-primary/10">
                  <Image 
                    src="/images/logoIncluirTransparente.png" 
                    alt="Logo" 
                    width={32} 
                    height={32}
                    className="rounded-md"
                  />
                </div>
                <span className="text-lg font-semibold">Incluir Salud</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <nav className="grid gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  pathname === item.href ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted/50",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4" />
                {!isCollapsed && item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4">
          <div className="flex flex-col gap-2">
            <ThemeSwitcher />
            <AuthButton isCollapsed={isCollapsed} />
          </div>
        </div>
      </div>
    </div>
  );
}