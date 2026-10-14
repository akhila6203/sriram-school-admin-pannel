
const express = require("express");
const rateLimit = require("express-rate-limit");

const storefrontController = require(
  "../controllers/storefrontController"
);

const storefrontPaytm = require(
  "../controllers/storefrontPaytmController"
);

const studentAuth = require(
  "../middleware/studentAuth"
);

const env = require("../config/env");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try later.",
  },
});

const callbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Paytm server callback (gateway verification handled
// inside the Paytm controller)
router.post(
  "/payments/paytm/callback",
  callbackLimiter,
  storefrontPaytm.callback
);

// PUBLIC: student admission number login
router.post(
  "/login",
  loginLimiter,
  storefrontController.login
);

// PROTECTED: current logged-in student
router.get("/session", studentAuth, (req, res) => {
  const s = req.student;

  res.json({
    success: true,
    data: {
      student: {
        id: s.id,
        admissionNumber: s.admission_number,
        studentName: s.student_name,
        parentName: s.parent_name,
        className: s.class_name,
        age: s.age,
        gender: s.gender,
        houseColor: s.house_color,
        phone: s.phone || "",
        email: s.email || "",
        address1: s.address1 || "",
        address2: s.address2 || "",
        city: s.city || "",
        state: s.state || "",
        zipcode: s.zipcode || "",
        kitStatus: s.kit_status,
      },
    },
  });
});

// Student logout
router.post("/logout", (req, res) => {
  res.clearCookie(studentAuth.COOKIE_NAME, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
  });

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// All routes below require student session
router.use(studentAuth);
// Logged-in student profile
router.get("/profile", async (req, res, next) => {
  try {
    const s = req.student;

    return res.json({
      success: true,
      data: {
        student: {
          id: s.id,
          admissionNumber: s.admission_number,
          studentName: s.student_name,
          parentName: s.parent_name,
          className: s.class_name,
          age: s.age,
          gender: s.gender,
          houseColor: s.house_color,
          phone: s.phone || "",
          email: s.email || "",
          address1: s.address1 || "",
          address2: s.address2 || "",
          city: s.city || "",
          state: s.state || "",
          zipcode: s.zipcode || "",
          kitStatus: s.kit_status,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Catalog based on logged-in student
router.get(
  "/catalog",
  storefrontController.getCatalog
);

// Logged-in student shipping address
router.get("/addresses", (req, res, next) => {
  try {
    const s = req.student;

    const hasAddress = [
      s.address1,
      s.address2,
      s.city,
      s.state,
      s.zipcode,
    ].some((value) => String(value || "").trim());

    const addresses = hasAddress
      ? [
          {
            id: `student-${s.id}`,
            name: s.student_name || "",
            phone: s.phone || "",
            addressLine1: s.address1 || "",
            addressLine2: s.address2 || "",
            city: s.city || "",
            state: s.state || "",
            pincode: s.zipcode || "",
            isDefault: true,
          },
        ]
      : [];

    return res.json({
      success: true,
      data: { addresses },
    });
  } catch (err) {
    next(err);
  }
});

// Orders
router.post(
  "/orders",
  storefrontController.placeOrder
);

router.get(
  "/orders",
  storefrontController.listOrders
);

// Paytm payment
router.post(
  "/payments/paytm/initiate",
  storefrontPaytm.initiate
);

router.get(
  "/payments/paytm/status/:orderNumber",
  storefrontPaytm.status
);

const storefrontCartController = require(
  "../controllers/storefrontCartController"
);

router.get(
  "/cart",
  storefrontCartController.getCart
);

router.post(
  "/cart/items",
  storefrontCartController.addItem
);

router.patch(
  "/cart/items/:id",
  storefrontCartController.updateItem
);

router.delete(
  "/cart/items/:id",
  storefrontCartController.removeItem
);

module.exports = router;




// const express = require('express');
// const rateLimit = require('express-rate-limit');
// const storefrontApiKey = require('../middleware/storefrontApiKey');
// const storefrontController = require('../controllers/storefrontController');
// const storefrontPaytm = require('../controllers/storefrontPaytmController');

// const router = express.Router();

// const callbackLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 60,
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// router.post('/payments/paytm/callback', callbackLimiter, storefrontPaytm.callback);

// router.use(storefrontApiKey);
// router.post('/login', storefrontController.login);
// router.get('/catalog', storefrontController.getCatalog);
// router.post('/orders', storefrontController.placeOrder);
// router.get('/orders', storefrontController.listOrders);
// router.post('/payments/paytm/initiate', storefrontPaytm.initiate);
// router.get('/payments/paytm/status/:orderNumber', storefrontPaytm.status);

// module.exports = router;
