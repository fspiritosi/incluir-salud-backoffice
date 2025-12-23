export type RoleName = "usuario" | "administrativo" | "auditor" | "super_admin" | "transporte";

const hasRole = (roles: RoleName[], allowed: RoleName[]) =>
  roles.some(r => allowed.includes(r));

export const canCreateOrEditPaciente = (roles: RoleName[]) =>
  hasRole(roles, ["administrativo", "auditor", "super_admin"]);

export const canCreateOrEditPrestacion = (roles: RoleName[]) =>
  hasRole(roles, ["auditor", "super_admin"]);

export const canTogglePrestador = (roles: RoleName[]) =>
  hasRole(roles, ["auditor", "super_admin"]);

export const canToggleBeneficiario = (roles: RoleName[]) =>
  hasRole(roles, ["auditor", "super_admin"]);

export const canAccessTransporte = (roles: RoleName[]) =>
  hasRole(roles, ["transporte", "auditor", "super_admin"]);

export const canManageCentros = (roles: RoleName[]) =>
  hasRole(roles, ["transporte", "administrativo", "auditor", "super_admin"]);

export const BACKOFFICE_ROLE_OPTIONS: RoleName[] = [
  "administrativo",
  "auditor",
  "super_admin",
  "transporte",
];

export const ROLE_LABELS: Record<RoleName, string> = {
  usuario: "Usuario",
  administrativo: "Administrativo",
  auditor: "Auditor",
  super_admin: "Super Admin",
  transporte: "Transporte",
};
