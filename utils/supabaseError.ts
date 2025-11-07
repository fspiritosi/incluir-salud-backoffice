export function humanizeSupabaseError(err: any): string {
  const code = err?.code || err?.details || "";
  if (code?.toString().includes("42501") || code?.toString().toLowerCase().includes("permission") || err?.status === 403) {
    return "No tenés permiso para realizar esta acción.";
  }
  if (err?.status === 401) {
    return "Tu sesión expiró. Iniciá sesión nuevamente.";
  }
  return err?.message || "Ocurrió un error.";
}
