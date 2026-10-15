const express = require("express");

const controller = require("../controllers/adminUsersController");

const router = express.Router();

router.use((req, res, next) => {
  if (req.admin?.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Only Super Admin can manage users",
    });
  }

  next();
});

router.get("/", controller.list);
router.post("/", controller.create);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;