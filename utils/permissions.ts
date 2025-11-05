export type RoleName = "usuario" | "administrativo" | "auditor" | "super_admin";

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
