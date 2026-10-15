const bcrypt = require("bcryptjs");
const db = require("../config/db");
const AppError = require("../utils/AppError");
const PERMISSIONS = require("../utils/adminPermissions");

function validPermissions(permissions) {
  return (
    Array.isArray(permissions) &&
    permissions.length > 0 &&
    permissions.every(
      (key) =>
        typeof key === "string" &&
        PERMISSIONS.includes(key)
    )
  );
}

async function list(req, res, next) {
  try {
    const users = await db("admin_users")
      .select(
        "id",
        "name",
        "email",
        "role",
        "is_active",
        "created_at"
      )
      .orderBy("id", "desc");

    const grants = await db("admin_user_permissions")
      .select("admin_user_id", "permission_key");

    const data = users.map((user) => ({
      ...user,
      permissions:
        user.role === "super_admin"
          ? PERMISSIONS
          : grants
              .filter(
                (p) =>
                  Number(p.admin_user_id) === Number(user.id)
              )
              .map((p) => p.permission_key),
    }));

    res.json({
      success: true,
      data: { users: data },
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { name, email, password, permissions } =
      req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 120
    ) {
      throw new AppError("Enter a valid username", 400);
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 190
    ) {
      throw new AppError("Enter a valid email", 400);
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      throw new AppError(
        "Password must contain 8 to 128 characters",
        400
      );
    }

    if (!validPermissions(permissions)) {
      throw new AppError(
        "Select at least one sidebar permission",
        400
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db("admin_users")
      .whereRaw("LOWER(email) = ?", [normalizedEmail])
      .first();

    if (existing) {
      throw new AppError("Email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userId = await db.transaction(async (trx) => {
      const [id] = await trx("admin_users").insert({
        name: name.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        role: "staff",
        is_active: 1,
      });

      await trx("admin_user_permissions").insert(
        [...new Set(permissions)].map((permission) => ({
          admin_user_id: id,
          permission_key: permission,
        }))
      );

      return id;
    });

    res.status(201).json({
      success: true,
      message: "Admin user created successfully",
      data: { id: userId },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return next(new AppError("Email already exists", 409));
    }

    next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);

    const {
      name,
      email,
      password,
      permissions,
    } = req.body || {};

    const user = await db("admin_users")
      .where({ id })
      .first();

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role === "super_admin") {
      throw new AppError(
        "Super Admin cannot be edited here",
        403
      );
    }

    const changes = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.length > 120
      ) {
        throw new AppError("Invalid username", 400);
      }

      changes.name = name.trim();
    }

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 190
      ) {
        throw new AppError("Invalid email", 400);
      }

      changes.email = email.trim().toLowerCase();
    }

    if (password !== undefined && password !== "") {
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      ) {
        throw new AppError(
          "Password must contain 8 to 128 characters",
          400
        );
      }

      changes.password_hash = await bcrypt.hash(
        password,
        12
      );
    }

    if (
      permissions !== undefined &&
      !validPermissions(permissions)
    ) {
      throw new AppError(
        "Select at least one valid permission",
        400
      );
    }

    await db.transaction(async (trx) => {
      if (Object.keys(changes).length) {
        await trx("admin_users")
          .where({ id })
          .update(changes);
      }

      if (permissions !== undefined) {
        await trx("admin_user_permissions")
          .where({ admin_user_id: id })
          .del();

        await trx("admin_user_permissions").insert(
          [...new Set(permissions)].map((permission) => ({
            admin_user_id: id,
            permission_key: permission,
          }))
        );
      }
    });

    res.json({
      success: true,
      message: "Admin user updated successfully",
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return next(new AppError("Email already exists", 409));
    }

    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);

    const user = await db("admin_users")
      .where({ id })
      .first();

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (
      user.role === "super_admin" ||
      id === Number(req.admin.id)
    ) {
      throw new AppError(
        "Cannot delete Super Admin or yourself",
        403
      );
    }

    await db("admin_users")
      .where({ id })
      .del();

    res.json({
      success: true,
      message: "Admin user deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
};