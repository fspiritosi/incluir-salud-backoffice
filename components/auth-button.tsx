import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();
  
  const user = data?.claims.user_metadata;
  
  return user ? (
    <div className="flex items-center gap-4">
      Hola, {user.first_name} {user.last_name}!
      <LogoutButton />
    </div>
  ) : (""
    // <div className="flex gap-2">
    //   <Button asChild size="sm" variant={"outline"}>
    //     <Link href="/auth/login">Iniciar sesión</Link>
    //   </Button>
    //   <Button asChild size="sm" variant={"default"}>
    //     <Link href="/auth/sign-up">Registrarse</Link>
    //   </Button>
    // </div>
  );
}
