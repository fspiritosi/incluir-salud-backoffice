import { LoginForm } from "@/components/login-form";
import Image from "next/image";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Image 
  src="/images/logoIncluirTransparente.png" 
  alt="Logo Incluir" 
  width={100}  // Ajusta según el ancho deseado
  height={100} // Ajusta según la proporción de tu logo
  className="mx-auto mb-6" // Clases opcionales para estilos
/>
        <LoginForm />
      </div>
    </div>
  );
}
