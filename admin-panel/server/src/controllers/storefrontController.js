const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const jwt = require("jsonwebtoken");
const env = require("../config/env");
const studentAuth = require("../middleware/studentAuth");

const { loadSettingsMap } =
  require("../services/catalogMode");
const stockService = require('../services/stock');
const { nextOrderNumber } = require('../utils/orderNumber');
const { applyOrderGst, isIntraState, splitLine, round2 } = require('../utils/gst');

async function login(req, res, next) {
  try {
    const schema = z.object({
      admissionNumber: z.string().min(1),
      secondFactor: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const settings = await loadSettingsMap(db);
    // const student = await db('students')
    //   .where({ admission_number: body.admissionNumber.trim(), is_active: true })
    //   .first();
   const student = await db("students")
  .where({
    admission_number: body.admissionNumber.trim(),
    is_active: true,
  })
  .first();

if (!student) {
  throw new AppError("Invalid admission number", 401);
}

    const check = settings.extra_login_check || 'none';
    if (check === 'zipcode') {
      if (!body.secondFactor || body.secondFactor.trim() !== student.zipcode) {
        throw new AppError('Invalid zipcode', 401);
      }
    }
    if (check === 'parent_phone') {
      if (!student.phone || !body.secondFactor || body.secondFactor.trim() !== student.phone) {
        throw new AppError('Invalid phone', 401);
      }
    }

    const patch = { last_login_at: db.fn.now() };
    if (!student.first_login_at) patch.first_login_at = db.fn.now();
    await db('students').where({ id: student.id }).update(patch);

    const refreshed = await db('students').where({ id: student.id }).first();
  const matchingKit = await db("kits")
  .where("is_active", true)
  .whereRaw(
    "LOWER(TRIM(class_name)) = LOWER(TRIM(?))",
    [String(refreshed.class_name)]
  )
  .whereRaw(
    `LOWER(TRIM(gender)) IN (?, ?, ?, ?)`,
    [
      ["male", "boys", "boy"].includes(
        String(refreshed.gender).trim().toLowerCase()
      )
        ? "boys"
        : "girls",
      ["male", "boys", "boy"].includes(
        String(refreshed.gender).trim().toLowerCase()
      )
        ? "male"
        : "female",
      "both boys and girls",
      "unisex",
    ]
  )
  .orderBy("id", "desc")
  .first();

// const mode = matchingKit ? "kit" : "individual";
const mode = matchingKit ? "kit" : "individual";

// Create backend student session
const token = jwt.sign(
  { type: "student" },
  env.jwtSecret,
  {
    subject: String(refreshed.id),
    expiresIn: env.jwtExpiresIn,
  }
);

// HTTP-only cookie: no localStorage required
res.cookie(studentAuth.COOKIE_NAME, token, {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "lax",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
});


    res.json({
      success: true,
      data: {
student: {
  id: refreshed.id,
  admissionNumber: refreshed.admission_number,
  studentName: refreshed.student_name,
  parentName: refreshed.parent_name,

  className: refreshed.class_name,
  age: refreshed.age,
  gender: refreshed.gender,
  houseColor: refreshed.house_color,

  phone: refreshed.phone || "",
  email: refreshed.email || "",

  address1: refreshed.address1 || "",
  address2: refreshed.address2 || "",
  city: refreshed.city || "",
  state: refreshed.state || "",
  zipcode: refreshed.zipcode || "",

  kitStatus: refreshed.kit_status,
  catalogMode: mode,
},
      },
    });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function getCatalog(req, res, next) {
  try {
    const admissionNumber =
  req.student.admission_number;

    if (!admissionNumber) {
      throw new AppError(
        "Admission number required",
        400
      );
    }

    const settings = await loadSettingsMap(db);

    const student = await db("students")
      .where({
        admission_number: admissionNumber,
        is_active: true,
      })
      .first();

    if (!student) {
      throw new AppError(
        "Student not found or inactive",
        404
      );
    }

    if (!student.class_name || !student.gender) {
      throw new AppError(
        "Student class and gender are not configured",
        400
      );
    }

    const normalizedGender = String(student.gender || "")
  .trim()
  .toLowerCase();

const isBoy = ["male", "boy", "boys"].includes(normalizedGender);
const isGirl = ["female", "girl", "girls"].includes(normalizedGender);

if (!isBoy && !isGirl) {
  throw new AppError("Invalid student gender", 400);
}

const allowedKitGenders = isBoy
  ? ["Boys", "Male", "Both Boys and Girls", "Unisex"]
  : ["Girls", "Female", "Both Boys and Girls", "Unisex"];

const allowedProductGenders = isBoy
  ? ["boys", "male", "both", "unisex"]
  : ["girls", "female", "both", "unisex"];



    const loadVariants = async (productId) => {
      const rows = await db("product_variants")
        .where({
          product_id: productId,
          is_active: true,
        })
        .whereRaw(
          "stock_qty > COALESCE(reserved_qty, 0)"
        )
        .orderBy("id");

      return rows.map((v) => ({
        id: v.id,
        sku: v.sku,
        option1Name: v.option1_name,
        option1Value: v.option1_value,
        option2Name: v.option2_name,
        option2Value: v.option2_value,
        priceOverride:
          v.price_override == null
            ? null
            : Number(v.price_override),
        stockQty:
          Number(v.stock_qty) -
          Number(v.reserved_qty || 0),
      }));
    };

    // First: matching active kit

      const kit = await db("kits")
  .where("is_active", true)
  .whereRaw(
    "LOWER(TRIM(class_name)) = LOWER(TRIM(?))",
    [String(student.class_name)]
  )
  .whereIn("gender", allowedKitGenders)
  .orderBy("id", "desc")
  .first();

      if (kit) {
        const items = await db("kit_items as ki")
          .join(
            "products as p",
            "p.id",
            "ki.product_id"
          )
          .where("ki.kit_id", kit.id)
          .where("p.status", "active")
          .select(
            "ki.*",
            "p.name",
            "p.slug",
            "p.description",
            "p.base_price"
          );

        const enriched = await Promise.all(
          items.map(async (item) => {
            const variants = await loadVariants(
              item.product_id
            );

            const images = await db("product_images")
              .where({
                product_id: item.product_id,
              })
              .orderBy("sort_order");

            return {
              productId: item.product_id,
              name: item.name,
              slug: item.slug,
              description: item.description,
              quantity: Number(item.quantity),
              price: Number(item.base_price),
              imageUrl: images[0]?.url || "",
              images: images.map((i) => i.url),
              studentPicksSize: Boolean(
                item.student_picks_size
              ),
              autoMatchHouseColor: Boolean(
                item.auto_match_house_color
              ),
              variants,
            };
          })
        );

        // Do not offer an incomplete or unavailable kit.
        const totalKitItems = await db("kit_items")
  .where({ kit_id: kit.id })
  .count({ total: "*" })
  .first();

const kitAvailable =
  enriched.length === Number(totalKitItems.total) &&
  enriched.length > 0 &&
  enriched.every((item) =>
    item.variants.some(
      (variant) =>
        Number(variant.stockQty) >=
        Number(item.quantity)
    )
  );

          return res.json({
            success: true,
            data: {
              mode: "kit",
              kit: {
  id: kit.id,
  name: kit.name,
  description: kit.description,
  price: Number(kit.price),
  imageUrl: kit.image_url,
  className: kit.class_name,
  gender: kit.gender,
  items: enriched,
  available: kitAvailable,
},
              products: [],
            },
          });
        
      }
    

    // No matching available kit OR kit already purchased:
    // show individual products.
    const products = await db("products as p")
      .where({
        "p.status": "active",
        "p.visible_individually": true,
      })
      .whereExists(function () {
        this.select(db.raw("1"))
          .from("product_eligibility as pe")
          .whereRaw("pe.product_id = p.id")
          .whereRaw(
            "LOWER(TRIM(pe.class_name)) = LOWER(?)",
            [student.class_name.trim()]
          )
          // .whereIn("pe.gender", allowedGenders);
          .whereIn("pe.gender", allowedProductGenders);
      })
      .whereExists(function () {
        this.select(db.raw("1"))
          .from("product_variants as v")
          .whereRaw("v.product_id = p.id")
          .where("v.is_active", true)
          .whereRaw(
            "v.stock_qty > COALESCE(v.reserved_qty, 0)"
          );
      })
      .select("p.*")
      .orderBy("p.id", "desc");

    const result = await Promise.all(
      products.map(async (product) => {
        const [variants, images] = await Promise.all([
          loadVariants(product.id),
          db("product_images")
            .where({ product_id: product.id })
            .orderBy("sort_order"),
        ]);

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          basePrice: Number(product.base_price),
          images: images.map((i) => i.url),
          variants,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        mode: "individual",
        kit: null,
        products: result,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function placeOrder(req, res, next) {
  try {
    const schema = z.object({
      admissionNumber: z.string().min(1),
      type: z.enum(['kit', 'individual']),
      items: z
        .array(
          z.object({
            variantId: z.coerce.number().int().positive(),
            productId: z.coerce.number().int().positive(),
            quantity: z.coerce.number().int().positive(),
          })
        )
        .min(1),
      paymentMethod: z.literal("paytm").default("paytm"),
      notes: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const settings = await loadSettingsMap(db);
    const student = await db('students')
      .where({ admission_number: body.admissionNumber.trim(), is_active: true })
      .first();
    if (!student) throw new AppError('Student not found', 404);

    if (!student.class_name || !student.gender) {
  throw new AppError(
    "Student class and gender are missing",
    400
  );
}

const normalizedGender = String(student.gender || "")
  .trim()
  .toLowerCase();

const isBoy = ["boys", "boy", "male"].includes(normalizedGender);
const isGirl = ["girls", "girl", "female"].includes(normalizedGender);

if (!isBoy && !isGirl) {
  throw new AppError("Invalid student gender", 400);
}

const allowedKitGenders = isBoy
  ? ["Boys", "Male", "Both Boys and Girls", "Unisex"]
  : ["Girls", "Female", "Both Boys and Girls", "Unisex"];

const allowedProductGenders = isBoy
  ? ["boys", "male", "both", "unisex"]
  : ["girls", "female", "both", "unisex"];

const matchingKit = await db("kits")
  .where({
    is_active: true,
    class_name: student.class_name,
  })
  .whereIn("gender", allowedKitGenders)
  .orderBy("id", "desc")
  .first();
    // if (body.type === 'individual' && mode === 'kit') {
    //   throw new AppError('Student is in kit mode; cannot order individual products', 403);
    // }
// Kit ON -> individual products ordering not allowed
if (body.type === "individual" && matchingKit) {
  throw new AppError(
    "Individual products are available only when the matching kit is inactive",
    403
  );
}

// Kit OFF -> kit ordering not allowed
if (body.type === "kit" && !matchingKit) {
  throw new AppError(
    "No matching active kit available",
    400
  );
}

// Kit remains visible after purchase.
// Reorder permission is separate from visibility.
if (
  body.type === "kit" &&
  student.kit_status === "ordered" &&
  settings.allow_kit_reorder !== true
) {
  throw new AppError(
    "Kit already purchased",
    403
  );
}

    // const shipping = Number(settings.shipping_fee || 0);
    const shippingFee = Number(settings.shipping_fee ?? 0);

if (!Number.isFinite(shippingFee) || shippingFee < 0) {
  throw new AppError("Invalid shipping fee in Admin Settings", 500);
}

const shipping = Math.round(shippingFee * 100) / 100;
    const prefix = settings.order_number_prefix || 'SS';


    const orderId = await db.transaction(async (trx) => {
      if (body.type === "kit") {
  const requiredItems = await trx("kit_items")
    .where({ kit_id: matchingKit.id });

  const expected = new Map(
    requiredItems.map((item) => [
      String(item.product_id),
      Number(item.quantity),
    ])
  );

  const actual = new Map();

  for (const item of body.items) {
    const key = String(item.productId);
    actual.set(
      key,
      (actual.get(key) || 0) +
        Number(item.quantity)
    );
  }

  if (
    !expected.size ||
    expected.size !== actual.size ||
    [...expected].some(
      ([id, qty]) => actual.get(id) !== qty
    )
  ) {
    throw new AppError(
      "Kit items do not match the selected school kit",
      400
    );
  }
}
      let subtotal = 0;
      const lineRows = [];

      for (const item of body.items) {
        const variant = await trx('product_variants').where({ id: item.variantId }).forUpdate().first();
        if (!variant || !variant.is_active) {
          throw new AppError('Variant unavailable', 400);
        }
        const available = Number(variant.stock_qty) - Number(variant.reserved_qty || 0);
        if (available < item.quantity) {
          throw new AppError(`Insufficient stock for ${variant.sku}`, 400);
        }
        const product = await trx('products').where({ id: item.productId }).first();
        if (!product) throw new AppError('Product not found', 400);

        if (Number(variant.product_id) !== Number(product?.id)) {
  throw new AppError(
    "Variant does not belong to selected product",
    400
  );
}

if (!product || product.status !== "active") {
  throw new AppError(
    "Product unavailable",
    400
  );
}

const eligible = await trx("product_eligibility")
  .where({
    product_id: product.id,
  })
  .whereRaw(
    "LOWER(TRIM(class_name)) = LOWER(?)",
    [student.class_name.trim()]
  )
  .whereIn("gender", allowedProductGenders)
  .first();

if (!eligible) {
  throw new AppError(
    "Product not available for this class and gender",
    403
  );
}

if (
  body.type === "individual" &&
  !product.visible_individually
) {
  throw new AppError(
    "Product is not available individually",
    403
  );
}

        const unit =
          variant.price_override != null
            ? Number(variant.price_override)
            : body.type === 'kit'
              ? 0
              : Number(product.base_price);
        const lineTotal = unit * item.quantity;
        subtotal += lineTotal;

        await stockService.reserveStock(trx, {
          variantId: variant.id,
          quantity: item.quantity,
          note: 'Storefront reserve',
        });

        lineRows.push({
          product_id: product.id,
          variant_id: variant.id,
          name_snapshot: product.name,
          sku_snapshot: variant.sku,
          option_snapshot: [variant.option1_value, variant.option2_value].filter(Boolean).join(' / '),
          unit_price: unit,
          quantity: item.quantity,
          line_total: lineTotal,
          hsn_code: product.hsn_code || null,
          gst_rate: Number(product.gst_rate != null ? product.gst_rate : product.tax_percent || 0),
          priceIncludesGst: product.price_includes_gst !== false && product.price_includes_gst !== 0,
        });
      }

      let profile = null;
      try {
        profile = await trx('gst_profile').orderBy('id').first();
      } catch {
        profile = null;
      }
      const intraState = isIntraState(profile || { state: 'Telangana', state_code: '36' }, student);

      let total = subtotal;
      let tax = 0;
      let taxableTotal = subtotal;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      if (body.type === 'kit') {
        // const kit = await trx('kits').where({ is_active: true }).orderBy('id', 'desc').first();
        const kit = await trx("kits")
  .where({
    id: matchingKit.id,
    is_active: true,
    class_name: student.class_name,
  })
  .whereIn("gender", allowedKitGenders)
  .first();
        if (!kit) throw new AppError('No active kit', 400);
        const kitSplit = splitLine({
          amount: Number(kit.price),
          quantity: 1,
          gstRate: 5,
          priceIncludesGst: true,
          intraState,
        });
        subtotal = kitSplit.lineTotal;
        taxableTotal = kitSplit.taxableValue;
        tax = kitSplit.tax;
        cgstTotal = kitSplit.cgst;
        sgstTotal = kitSplit.sgst;
        igstTotal = kitSplit.igst;
        // total = round2(kitSplit.lineTotal + shipping);
        total = round2(gst.itemsTotal + shipping);
        if (lineRows[0]) {
          lineRows[0].taxable_value = taxableTotal;
          lineRows[0].cgst = cgstTotal;
          lineRows[0].sgst = sgstTotal;
          lineRows[0].igst = igstTotal;
          lineRows[0].gst_rate = 5;
          lineRows[0].hsn_code = lineRows[0].hsn_code || '6109';
        }
      } else {
        const gst = applyOrderGst(
          lineRows.map((l) => ({
            unitPrice: l.unit_price,
            quantity: l.quantity,
            gstRate: l.gst_rate,
            priceIncludesGst: l.priceIncludesGst,
          })),
          { intraState }
        );
        gst.lines.forEach((g, i) => {
          lineRows[i].taxable_value = g.taxableValue;
          lineRows[i].cgst = g.cgst;
          lineRows[i].sgst = g.sgst;
          lineRows[i].igst = g.igst;
          lineRows[i].line_total = g.lineTotal;
        });
        taxableTotal = gst.taxableTotal;
        cgstTotal = gst.cgstTotal;
        sgstTotal = gst.sgstTotal;
        igstTotal = gst.igstTotal;
        tax = gst.gstTotal;
        subtotal = gst.itemsTotal;
        total = round2(gst.itemsTotal + shipping);
      }

      const orderNumber = await nextOrderNumber(trx, prefix);
      const addressSnapshot = {
        address1: student.address1,
        address2: student.address2,
        city: student.city,
        state: student.state,
        zipcode: student.zipcode,
        parentName: student.parent_name,
        phone: student.phone,
      };

      
      const [oid] = await trx('orders').insert({
        order_number: orderNumber,
        student_id: student.id,
        type: body.type,
        status: 'pending',
payment_status: 'pending',
payment_method: 'paytm',

        subtotal,
        tax,
        shipping,
        total,
        taxable_total: taxableTotal,
        cgst_total: cgstTotal,
        sgst_total: sgstTotal,
        igst_total: igstTotal,
        stock_state: 'reserved',
        address_snapshot: JSON.stringify(addressSnapshot),
        notes: body.notes || null,
      });

      for (const line of lineRows) {
        const { priceIncludesGst, ...rest } = line;
        await trx('order_items').insert({ ...rest, order_id: oid });
      }

      
      await trx('order_status_history').insert({
        order_id: oid,
        status: 'placed',
        changed_by: 'storefront',
        note: 'Order placed',
      });

      // attach order_id on stock movements created above — update recent
      await trx('stock_movements')
        .whereNull('order_id')
        .where({ reason: 'order' })
        .whereIn(
          'variant_id',
          lineRows.map((l) => l.variant_id)
        )
        .orderBy('id', 'desc')
        .limit(lineRows.length)
        .update({ order_id: oid });

      

      return oid;
    });

    const order = await db('orders').where({ id: orderId }).first();
    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          total: Number(order.total),
          status: order.status,
        },
      },
    });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function listOrders(req, res, next) {
  try {
    const orders = await db("orders")
      .where({
        student_id: req.student.id,
        payment_status: "paid",
      })
      .orderBy("created_at", "desc");

    const orderIds = orders.map((order) => order.id);

    const orderItems = orderIds.length
      ? await db("order_items")
          .whereIn("order_id", orderIds)
          .orderBy("id", "asc")
      : [];

      const productIds = [
  ...new Set(
    orderItems
      .map((item) => item.product_id)
      .filter(Boolean)
  ),
];

const productImages = productIds.length
  ? await db("product_images")
      .whereIn("product_id", productIds)
      .orderBy("sort_order", "asc")
      .select("product_id", "url")
  : [];

const imageByProduct = new Map();

for (const image of productImages) {
  const key = String(image.product_id);

  if (!imageByProduct.has(key)) {
    imageByProduct.set(key, image.url);
  }
}

    const itemsByOrder = new Map();

    for (const item of orderItems) {
      const key = String(item.order_id);

      if (!itemsByOrder.has(key)) {
        itemsByOrder.set(key, []);
      }

      itemsByOrder.get(key).push({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        name: item.name_snapshot,
        sku: item.sku_snapshot,
        size: item.option_snapshot || "",
        price: Number(item.unit_price || 0),
        quantity: Number(item.quantity || 0),
        total: Number(item.line_total || 0),
        gstRate: Number(item.gst_rate || 0),
        image:
  imageByProduct.get(String(item.product_id)) || "",
      });
    }

    const student = req.student;

    const address = [
      student.address1,
      student.address2,
      student.city,
      student.state,
      student.zipcode,
    ]
      .filter(Boolean)
      .join(", ");

    res.json({
      success: true,
      data: {
        items: orders.map((order) => ({
          id: order.id,
          orderNumber: order.order_number,
          type: order.type,
          status: order.status,
          paymentStatus: order.payment_status,
          paymentMethod: "Paytm",

          subtotal: Number(order.subtotal || 0),
          shipping: Number(order.shipping || 0),
          gstIncluded: Number(order.tax || 0),
          cgst: Number(order.cgst_total || 0),
          sgst: Number(order.sgst_total || 0),
          igst: Number(order.igst_total || 0),
          total: Number(order.total || 0),

          createdAt: order.created_at,
          items: itemsByOrder.get(String(order.id)) || [],

          student: {
            id: student.id,
            name: student.name,
            admissionNo: student.admission_number,
            className: student.class_name,
            phone: student.phone,
            email: student.email,
            address,
          },
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  getCatalog,
  placeOrder,
  listOrders,
};
