const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const auth = require('../middleware/auth');


const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setAuthCookie(res, token) {
  res.cookie(auth.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(auth.COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
  });
}

function signToken(admin) {
  return jwt.sign(
    { role: admin.role, email: admin.email },
    env.jwtSecret,
    { subject: String(admin.id), expiresIn: env.jwtExpiresIn }
  );
}

// function publicAdmin(admin) {
//   return {
//     id: admin.id,
//     email: admin.email,
//     name: admin.name,
//     role: admin.role,
//   };
// }
async function publicAdmin(admin) {
  const permissions =
    admin.role === "super_admin"
      ? require("../utils/adminPermissions")
      : await db("admin_user_permissions")
          .where({ admin_user_id: admin.id })
          .pluck("permission_key");

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions,
  };
}

async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await db('admin_users').where({ email }).first();
    if (!user || !user.is_active) {
      throw new AppError('Invalid email or password', 401);
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    // res.json({
    //   success: true,
    //   message: 'Logged in',
    //   data: { admin: publicAdmin(user) },
    // });
    res.json({
  success: true,
  message: 'Logged in',
  data: {
    admin: await publicAdmin(user),
  },
  
});
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(
        new AppError(
          'Validation failed',
          400,
          err.issues.map((e) => ({ path: e.path.join('.'), message: e.message }))
        )
      );
    }
    return next(err);
  }
}

async function logout(req, res) {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
}

async function me(req, res) {
  res.json({
    success: true,
    data: { admin: req.admin },
  });
}

module.exports = {
  login,
  logout,
  me,
  loginSchema,
};
