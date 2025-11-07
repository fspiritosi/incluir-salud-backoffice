"use client";

import { DeployButton } from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Sidebar } from '@/components/sidebar';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      {/* <nav className="w-full flex justify-between items-center border-b border-b-foreground/10 h-16 px-5">
        <div className="font-semibold">
          <Link href={"/protected"}>
            <Image src="/images/logoIncluirTransparente.png" alt="Logo" width={40} height={40} />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          {!hasEnvVars ? <EnvVarWarning /> : <AuthButton isCollapsed={false} />}
        </div>
      </nav> */}

      {/* Contenido principal con Sidebar */}
      <div className="flex flex-1">
        <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((v) => !v)} />
        <main className={cn(
          "flex-1 p-6 overflow-auto transition-[margin-left] duration-300",
          isCollapsed ? "ml-16" : "ml-56"
        )}>
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
        <p>
          <span className="font-bold">Incluir Salud Mendoza 2025</span>
        </p>
      </footer>
    </div>
  );
}
