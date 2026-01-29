/**
 * Script de emergencia para confirmar manualmente el email de un usuario
 * cuando el servidor de correo del destinatario filtra los emails de Supabase.
 *
 * Uso:
 *   npx ts-node scripts/confirm-user-email.ts <email>
 *
 * Ejemplo:
 *   npx ts-node scripts/confirm-user-email.ts usuario@mendoza.gov.ar
 *
 * ⚠️  ARCHIVO IGNORADO POR GIT - Contiene credenciales sensibles
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function confirmUserEmail(email: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "❌ Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Buscar el usuario por email
  const { data: users, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("❌ Error al listar usuarios:", listError.message);
    process.exit(1);
  }

  const user = users.users.find((u) => u.email === email);

  if (!user) {
    console.error(`❌ No se encontró ningún usuario con email: ${email}`);
    process.exit(1);
  }

  if (user.email_confirmed_at) {
    console.log(`ℹ️  El usuario ${email} ya tiene el email confirmado.`);
    console.log(`   Confirmado el: ${user.email_confirmed_at}`);
    process.exit(0);
  }

  // Confirmar el email
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { email_confirm: true }
  );

  if (updateError) {
    console.error("❌ Error al confirmar email:", updateError.message);
    process.exit(1);
  }

  console.log(`✅ Usuario confirmado correctamente`);
  console.log(`   Email: ${email}`);
  console.log(`   ID: ${user.id}`);
}

// Ejecutar
const email = process.argv[2];

if (!email) {
  console.error("❌ Uso: npx ts-node scripts/confirm-user-email.ts <email>");
  console.error("   Ejemplo: npx ts-node scripts/confirm-user-email.ts usuario@mendoza.gov.ar");
  process.exit(1);
}

confirmUserEmail(email);
