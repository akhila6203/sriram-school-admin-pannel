
const db = require("../config/db");
const AppError = require("../utils/AppError");

const { applyOrderGst, isIntraState, round2 } =
  require("../utils/gst");

// -----------------------------------------
// Helpers
// -----------------------------------------

const positiveInt = (value, label) => {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new AppError(
      `${label} must be a positive integer`,
      400
    );
  }

  return number;
};

const isTrue = (value) =>
  value === true ||
  value === 1 ||
  value === "1";

const normalize = (value) =>
  String(value || "").trim().toLowerCase();

const studentIsBoy = (student) =>
  ["male", "boy", "boys"].includes(
    normalize(student.gender)
  );

const productGenders = (student) =>
  studentIsBoy(student)
    ? ["boys", "male", "both", "unisex"]
    : ["girls", "female", "both", "unisex"];

const kitGenders = (student) =>
  studentIsBoy(student)
    ? ["boys", "male", "both boys and girls", "unisex"]
    : ["girls", "female", "both boys and girls", "unisex"];

// -----------------------------------------
// Active kit
// -----------------------------------------

async function getActiveKit(student, connection = db) {
  const genders = kitGenders(student);

  return connection("kits")
    .where("is_active", true)
    .whereRaw(
      "LOWER(TRIM(class_name)) = ?",
      [normalize(student.class_name)]
    )
    .whereRaw(
      `LOWER(TRIM(gender)) IN (${genders
        .map(() => "?")
        .join(",")})`,
      genders
    )
    .orderBy("id", "desc")
    .first();
}

// -----------------------------------------
// Get or create student cart
// -----------------------------------------

async function findCart(
  studentId,
  connection = db,
  create = false
) {
  let cart = await connection("carts")
    .where({ student_id: studentId })
    .first();

  if (!cart && create) {
    await connection("carts")
      .insert({ student_id: studentId })
      .onConflict("student_id")
      .ignore();

    cart = await connection("carts")
      .where({ student_id: studentId })
      .first();
  }

  return cart;
}

// -----------------------------------------
// Validate product, size and eligibility
// -----------------------------------------

async function validateProduct(
  student,
  productId,
  variantId,
  kitId,
  connection = db
) {
  const product = await connection("products")
    .where({
      id: productId,
      status: "active",
    })
    .first();

  if (!product) {
    throw new AppError("Product unavailable", 404);
  }

  const variant = await connection("product_variants")
    .where({
      id: variantId,
      product_id: productId,
      is_active: true,
    })
    .first();

  if (!variant) {
    throw new AppError(
      "Selected product size is unavailable",
      400
    );
  }

  const available =
    Number(variant.stock_qty) -
    Number(variant.reserved_qty || 0);

  if (kitId !== null) {
    const kit = await getActiveKit(
      student,
      connection
    );

    if (!kit || Number(kit.id) !== Number(kitId)) {
      throw new AppError(
        "School kit is not active for this student",
        403
      );
    }

    const kitItem = await connection("kit_items")
      .where({
        kit_id: kit.id,
        product_id: productId,
      })
      .first();

    if (!kitItem) {
      throw new AppError(
        "Product does not belong to this kit",
        403
      );
    }

    return {
      product,
      variant,
      available,
      fixedQuantity: Number(kitItem.quantity),
    };
  }

  const activeKit = await getActiveKit(
    student,
    connection
  );

  if (activeKit) {
    throw new AppError(
      "Individual products are unavailable while the school kit is active",
      403
    );
  }

  if (!isTrue(product.visible_individually)) {
    throw new AppError(
      "Product is not sold individually",
      403
    );
  }

  const genders = productGenders(student);

  const eligible = await connection(
    "product_eligibility"
  )
    .where({ product_id: productId })
    .whereRaw(
      "LOWER(TRIM(class_name)) = ?",
      [normalize(student.class_name)]
    )
    .whereRaw(
      `LOWER(TRIM(gender)) IN (${genders
        .map(() => "?")
        .join(",")})`,
      genders
    )
    .first();

  if (!eligible) {
    throw new AppError(
      "Product is not available for this class and gender",
      403
    );
  }

  return {
    product,
    variant,
    available,
    fixedQuantity: null,
  };
}

// -----------------------------------------
// Build cart response with GST
// -----------------------------------------

async function buildCartResponse(student) {
  const cart = await findCart(student.id);

  if (cart) {
  const activeKit = await getActiveKit(student);

  if (activeKit) {
    // Kit active: individual cart items should not remain.
    await db("cart_items")
      .where({
        cart_id: cart.id,
        is_kit_item: 0,
      })
      .del();

    // Remove kit items belonging to an older/inactive kit.
    await db("cart_items")
      .where({
        cart_id: cart.id,
        is_kit_item: 1,
      })
      .whereNot("kit_id", activeKit.id)
      .del();
  } else {
    // Kit OFF: remove previously added kit items.
    await db("cart_items")
      .where({
        cart_id: cart.id,
        is_kit_item: 1,
      })
      .del();
  }
}

  const rows = cart
    ? await db("cart_items as ci")
        .join(
          "products as p",
          "p.id",
          "ci.product_id"
        )
        .join(
          "product_variants as v",
          "v.id",
          "ci.variant_id"
        )
        .where("ci.cart_id", cart.id)
        .select(
          "ci.*",
          "p.name as product_name",
          "p.base_price",
          "p.gst_rate",
          "p.tax_percent",
          "p.price_includes_gst",
          "v.option1_value",
          "v.option2_value",
          "v.price_override",
          "v.stock_qty",
          "v.reserved_qty"
        )
        .orderBy("ci.id")
    : [];

  const items = await Promise.all(
    rows.map(async (row) => {
         const image = await db("product_images")
      .where("product_id", row.product_id)
      .orderBy("id", "asc")
      .first();


      const variants = await db("product_variants")
  .where({
    product_id: row.product_id,
    is_active: true,
  })
  .orderBy("id")
  .select(
    "id",
    "option1_value",
    "option2_value",
    "price_override",
    "stock_qty",
    "reserved_qty"
  );

const sizes = variants.map((variant) => ({
  id: variant.id,
  label: [
    variant.option1_value,
    variant.option2_value,
  ]
    .filter(Boolean)
    .join(" / "),
  price: Number(
    variant.price_override ?? row.base_price
  ),
  stockQty: Math.max(
    0,
    Number(variant.stock_qty || 0) -
      Number(variant.reserved_qty || 0)
  ),
}));

      const unitPrice =
        row.price_override == null
          ? Number(row.base_price)
          : Number(row.price_override);

      const quantity = Number(row.quantity);

      return {
        id: row.id,
        cartKey: String(row.id),

        productId: row.product_id,
        variantId: row.variant_id,
        kitId: row.kit_id,

        isKitItem: isTrue(row.is_kit_item),

        name: row.product_name,
        image: image?.url || "",
        imageUrl: image?.url || "",
        sizes,

        size: [
          row.option1_value,
          row.option2_value,
        ]
          .filter(Boolean)
          .join(" / "),

        quantity,
        price: unitPrice,

        lineTotal: round2(
          unitPrice * quantity
        ),

        availableStock:
          Number(row.stock_qty || 0) -
          Number(row.reserved_qty || 0),

        gstRate: Number(
          row.gst_rate ??
          row.tax_percent ??
          0
        ),

        priceIncludesGst:
          row.price_includes_gst == null ||
          isTrue(row.price_includes_gst),
      };
    })
  );

  let gstProfile = null;

  try {
    gstProfile = await db("gst_profile")
      .orderBy("id")
      .first();
  } catch (error) {
    gstProfile = null;
  }

  const gst = applyOrderGst(
    items.map((item) => ({
      unitPrice: item.price,
      quantity: item.quantity,
      gstRate: item.gstRate,
      priceIncludesGst: item.priceIncludesGst,
    })),
    {
      intraState: isIntraState(
        gstProfile || {
          state: "Telangana",
          state_code: "36",
        },
        student
      ),
    }
  );

 const subtotal = round2(
  items.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        Number(item.quantity || 0),
    0
  )
);

  // Fixed shipping for non-empty carts
//   const shipping = items.length > 0 ? 200 : 0;
 const shipping = items.length > 0 ? 0 : 0;

  const summary = {
    subtotal,
    shipping,

    gstIncluded: round2(
      Number(gst.gstTotal || 0)
    ),

    gstAmount: round2(
      Number(gst.gstTotal || 0)
    ),

    cgst: round2(
      Number(gst.cgstTotal || 0)
    ),

    sgst: round2(
      Number(gst.sgstTotal || 0)
    ),

    igst: round2(
      Number(gst.igstTotal || 0)
    ),

    total: round2(subtotal + shipping),
  };

  return {
    success: true,
    data: {
      items,
      cart: items,
      summary,
      ...summary,
    },
  };
}

// -----------------------------------------
// GET /storefront/cart
// -----------------------------------------

async function getCart(req, res, next) {
  try {
    const response = await buildCartResponse(
      req.student
    );

    res.json(response);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------
// POST /storefront/cart/items
// -----------------------------------------

async function addItem(req, res, next) {
  try {
    const productId = positiveInt(
      req.body.productId,
      "productId"
    );

    const variantId = positiveInt(
      req.body.variantId,
      "variantId"
    );

    const isKitItem = isTrue(
      req.body.isKitItem
    );

    const kitId = isKitItem
      ? positiveInt(req.body.kitId, "kitId")
      : null;

    const requestedQuantity = positiveInt(
      req.body.quantity ?? 1,
      "quantity"
    );

    await db.transaction(async (trx) => {
      const {
        available,
        fixedQuantity,
      } = await validateProduct(
        req.student,
        productId,
        variantId,
        kitId,
        trx
      );

      if (
        isKitItem &&
        requestedQuantity !== fixedQuantity
      ) {
        throw new AppError(
          "Kit quantity is fixed by school",
          400
        );
      }

      const cart = await findCart(
        req.student.id,
        trx,
        true
      );

      const existing = await trx("cart_items")
        .where({
          cart_id: cart.id,
          product_id: productId,
          variant_id: variantId,
          kit_id: kitId,
          is_kit_item: isKitItem ? 1 : 0,
        })
        .first();

      const quantity = isKitItem
        ? fixedQuantity
        : requestedQuantity +
          Number(existing?.quantity || 0);

      if (quantity > available) {
        throw new AppError(
          "Insufficient stock for selected size",
          400
        );
      }

      if (existing) {
        await trx("cart_items")
          .where({ id: existing.id })
          .update({ quantity });
      } else {
        await trx("cart_items").insert({
          cart_id: cart.id,
          product_id: productId,
          variant_id: variantId,
          kit_id: kitId,
          is_kit_item: isKitItem ? 1 : 0,
          quantity,
        });
      }
    });

    const response = await buildCartResponse(
      req.student
    );

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------
// PATCH /storefront/cart/items/:id
// -----------------------------------------

async function updateItem(req, res, next) {
  try {
    const id = positiveInt(
      req.params.id,
      "Cart item ID"
    );

    await db.transaction(async (trx) => {
      const cart = await findCart(
        req.student.id,
        trx
      );

      const item = cart
        ? await trx("cart_items")
            .where({
              id,
              cart_id: cart.id,
            })
            .first()
        : null;

      if (!item) {
        throw new AppError(
          "Cart item not found",
          404
        );
      }

      const isKitItem = isTrue(
        item.is_kit_item
      );

      const variantId =
        req.body.variantId == null
          ? Number(item.variant_id)
          : positiveInt(
              req.body.variantId,
              "variantId"
            );

      const quantity =
        req.body.quantity == null
          ? Number(item.quantity)
          : positiveInt(
              req.body.quantity,
              "quantity"
            );

      const {
        available,
        fixedQuantity,
      } = await validateProduct(
        req.student,
        Number(item.product_id),
        variantId,
        isKitItem
          ? Number(item.kit_id)
          : null,
        trx
      );

      if (
        isKitItem &&
        quantity !== fixedQuantity
      ) {
        throw new AppError(
          "Kit quantity cannot be changed",
          400
        );
      }

      if (quantity > available) {
        throw new AppError(
          "Insufficient stock",
          400
        );
      }

      await trx("cart_items")
        .where({
          id,
          cart_id: cart.id,
        })
        .update({
          variant_id: variantId,
          quantity,
        });
    });

    res.json(
      await buildCartResponse(req.student)
    );
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------
// DELETE /storefront/cart/items/:id
// -----------------------------------------

async function removeItem(req, res, next) {
  try {
    const id = positiveInt(
      req.params.id,
      "Cart item ID"
    );

    const cart = await findCart(
      req.student.id
    );

    if (!cart) {
      throw new AppError(
        "Cart item not found",
        404
      );
    }

    const item = await db("cart_items")
      .where({
        id,
        cart_id: cart.id,
      })
      .first();

    if (!item) {
      throw new AppError(
        "Cart item not found",
        404
      );
    }

    if (isTrue(item.is_kit_item)) {
      throw new AppError(
        "School kit items cannot be removed individually",
        403
      );
    }

    await db("cart_items")
      .where({
        id,
        cart_id: cart.id,
      })
      .del();

    res.json(
      await buildCartResponse(req.student)
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
};
