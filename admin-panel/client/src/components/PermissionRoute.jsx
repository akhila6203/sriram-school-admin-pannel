import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import {
  canAccess,
  landingPage,
} from "../utils/adminPermissions";

export default function PermissionRoute({
  permission,
  children,
}) {
  const { admin } = useAuth();

  if (!canAccess(admin, permission)) {
    return (
      <Navigate
        to={landingPage(admin)}
        replace
      />
    );
  }

  return children || <Outlet />;
}