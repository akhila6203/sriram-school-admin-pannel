const AppError = require("../utils/AppError");
const PERMISSIONS = require("../utils/adminPermissions");

function requirePermission(...keys) {
  return (req, res, next) => {
    try {
      if (!req.admin) {
        throw new AppError("Authentication required", 401);
      }

      if (req.admin.role === "super_admin") {
        return next();
      }

      if (
        !keys.length ||
        keys.some((key) => !PERMISSIONS.includes(key))
      ) {
        throw new AppError("Invalid permission", 403);
      }

      const allowed = keys.some((key) =>
        (req.admin.permissions || []).includes(key)
      );

      if (!allowed) {
        throw new AppError(
          "You do not have permission to access this page",
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requirePermission;