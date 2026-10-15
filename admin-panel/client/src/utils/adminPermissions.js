export const PERMISSIONS = [
  ["dashboard", "Dashboard"],
  ["students", "Students"],
  ["products", "Products"],
  ["categories", "Categories"],
  ["inventory", "Inventory"],
  ["kit", "Kit"],
  ["orders", "Orders"],
  ["reports", "Reports"],
  ["gst", "GST"],
  ["settings", "Settings"],
];

export function canAccess(admin, permission) {
  if (!admin) return false;

  if (admin.role === "super_admin") {
    return true;
  }

  return (
    Array.isArray(admin.permissions) &&
    admin.permissions.includes(permission)
  );
}

export function landingPage(admin) {
  if (!admin) {
    return "/login";
  }

  if (admin.role === "super_admin") {
    return "/admin/dashboard";
  }

  const first = PERMISSIONS.find(([permission]) =>
    canAccess(admin, permission)
  );

  return first
    ? `/admin/${first[0]}`
    : "/admin/no-access";
}
// export function landingPage(admin) {
//   const first = PERMISSIONS.find(([permission]) =>
//     canAccess(admin, permission)
//   );

//   return first
//     ? `/admin/${first[0]}`
//     : "/admin/no-access";
// }