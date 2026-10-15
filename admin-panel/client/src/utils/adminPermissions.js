export const ADMIN_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "students", label: "Students" },
  { key: "products", label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "inventory", label: "Inventory" },
  { key: "kit", label: "Kit" },
  { key: "orders", label: "Orders" },
  { key: "reports", label: "Reports" },
  { key: "gst", label: "GST" },
  { key: "settings", label: "Settings" },
];

export const hasAdminPermission = (
  admin,
  permission
) => {
  if (!admin) return false;

  if (admin.role === "super_admin") {
    return true;
  }

  return Array.isArray(admin.permissions)
    && admin.permissions.includes(permission);
};