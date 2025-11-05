import { DeployButton } from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Sidebar } from '@/components/sidebar';
import Image from 'next/image';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="w-full flex justify-between items-center border-b border-b-foreground/10 h-16 px-5">
        <div className="font-semibold">
          <Link href={"/protected"}>
            <Image src="/images/logoIncluirTransparente.png" alt="Logo" width={40} height={40} />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
        </div>
      </nav>

      {/* Contenido principal con Sidebar */}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-5 overflow-auto">
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
