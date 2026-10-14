
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const env = require("../config/env");
const AppError = require("../utils/AppError");

const STUDENT_COOKIE = "student_token";

async function studentAuth(req, res, next) {
  try {
    const token = req.cookies?.[STUDENT_COOKIE];

    if (!token) {
      throw new AppError("Student login required", 401);
    }

    let payload;

    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new AppError(
        "Student session expired. Please login again",
        401
      );
    }

    if (
      payload.type !== "student" ||
      !payload.sub
    ) {
      throw new AppError("Invalid student session", 401);
    }

    const student = await db("students")
      .where({
        id: payload.sub,
        is_active: true,
      })
      .first();

    if (!student) {
      throw new AppError(
        "Student account not found or inactive",
        401
      );
    }

    req.student = student;
    next();
  } catch (error) {
    next(error);
  }
}

studentAuth.COOKIE_NAME = STUDENT_COOKIE;

module.exports = studentAuth;
