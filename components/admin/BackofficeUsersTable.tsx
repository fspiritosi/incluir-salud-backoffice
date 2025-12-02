"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import type { BackofficeUser } from "@/app/protected/admin/usuarios/actions";
import { assignUserRole, removeUserRole } from "@/app/protected/admin/usuarios/actions";
import { BACKOFFICE_ROLE_OPTIONS, ROLE_LABELS, type RoleName } from "@/utils/permissions";
import { Loader2, Shield, UserRound, ShieldPlus, ShieldMinus, Check, X } from "lucide-react";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    const formatter = new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return formatter.format(new Date(value));
  } catch {
    return value;
  }
}

type Props = {
  users: BackofficeUser[];
  currentUserId: string;
};

type PendingAction = {
  userId: string;
  role?: RoleName;
  type: "assign" | "remove";
};

export default function BackofficeUsersTable({ users, currentUserId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAssign = (userId: string, role: RoleName) => {
    setPending({ userId, role, type: "assign" });
    startTransition(() => {
      assignUserRole(userId, role)
        .then((res) => {
          if (!res.success) {
            toast({
              title: "No se pudo agregar el rol",
              description: res.error ?? "Intentá nuevamente",
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Rol agregado",
            description: `Ahora el usuario tiene rol ${ROLE_LABELS[role]}.`,
          });
          router.refresh();
        })
        .finally(() => setPending((prev) => (prev?.userId === userId ? null : prev)));
    });
  };

  const handleRemove = (userId: string, role: RoleName) => {
    setPending({ userId, role, type: "remove" });
    startTransition(() => {
      removeUserRole(userId, role)
        .then((res) => {
          if (!res.success) {
            toast({
              title: "No se pudo quitar el rol",
              description: res.error ?? "Intentá nuevamente",
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Rol quitado",
            description: `${ROLE_LABELS[role]} fue removido del usuario.`,
          });
          router.refresh();
        })
        .finally(() => setPending((prev) => (prev?.userId === userId ? null : prev)));
    });
  };

  const availableRoles = (user: BackofficeUser) =>
    BACKOFFICE_ROLE_OPTIONS.filter((role) => !user.roles.includes(role));

  const sortedUsers = useMemo(() => users, [users]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm transition-colors">
      <table className="w-full text-sm text-foreground">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground dark:bg-muted/30">
          <tr>
            <th className="px-4 py-3 font-medium">Usuario</th>
            <th className="px-4 py-3 font-medium">Documento</th>
            <th className="px-4 py-3 font-medium">Roles</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
            <th className="px-4 py-3 font-medium">Actividad</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => {
            const userRoles = user.roles ?? [];
            const canAddRole = availableRoles(user);
            const isSelf = user.id === currentUserId;
            const isRowBusy = pending?.userId === user.id && isPending;

            return (
              <tr
                key={user.id}
                className="border-t border-border/60 bg-card transition-colors hover:bg-muted/40 even:bg-muted/30 dark:bg-background/80 dark:hover:bg-muted/30"
              >
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      <span>{user.fullName || user.email || "Sin nombre"}</span>
                      {isSelf && <Badge variant="secondary">Vos</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.email || "Sin email"}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                      ID: {user.id}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                  {user.documentNumber || "-"}
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap gap-2">
                    {userRoles.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sin roles</span>
                    )}
                    {userRoles.map((role) => {
                      const isRemoving =
                        pending?.userId === user.id && pending.role === role && pending.type === "remove" && isPending;
                      const isSelfSuperAdminRole = isSelf && role === "super_admin";
                      return (
                        <Badge
                          key={role}
                          variant="outline"
                          className="flex items-center gap-1 border-border/60 text-foreground dark:border-primary/30 dark:bg-primary/5 dark:text-primary"
                        >
                          <Shield className="h-3 w-3" />
                          {ROLE_LABELS[role]}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-4 w-4 text-muted-foreground hover:text-foreground"
                            disabled={isRemoving || isPending || isSelfSuperAdminRole}
                            onClick={() => handleRemove(user.id, role)}
                          >
                            {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  {canAddRole.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Todos los roles asignados</span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isRowBusy}
                          className="flex items-center gap-2"
                        >
                          {isRowBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldPlus className="h-4 w-4" />
                          )}
                          Agregar rol
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[220px]">
                        <DropdownMenuLabel>Roles disponibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {canAddRole.map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onSelect={(event) => {
                              event.preventDefault();
                              handleAssign(user.id, role);
                            }}
                            className="flex items-center gap-2"
                          >
                            <ShieldPlus className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                              <span className="text-xs text-muted-foreground">Asignar este rol</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
                <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <ShieldPlus className="h-3 w-3" />
                      <span>Creado: {formatDate(user.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ShieldMinus className="h-3 w-3" />
                      <span>Último acceso: {formatDate(user.lastSignInAt)}</span>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
