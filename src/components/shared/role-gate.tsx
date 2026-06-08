import React from "react";
import type { UserRole } from "@/lib/types/database.types";

interface RoleGateProps {
  allowedRole: UserRole | UserRole[];
  currentRole: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ allowedRole, currentRole, children, fallback }: RoleGateProps) {
  const allowed = Array.isArray(allowedRole)
    ? allowedRole.includes(currentRole)
    : allowedRole === currentRole;

  if (allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return null;
}
