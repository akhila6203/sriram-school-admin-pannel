const { z } = require('zod')
const db = require('../config/db')
const AppError = require('../utils/AppError')
const storage = require('../services/storage')

const itemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1),
  studentPicksSize: z.boolean(),
  autoMatchHouseColor: z.boolean().optional().default(false),
})

function allowedProductGenders(gender) {
  switch (gender) {
    case "Boys":
      return ["boys", "both", "unisex"];

    case "Girls":
      return ["girls", "both", "unisex"];

    case "Both Boys and Girls":
    case "Unisex":
      return ["both", "unisex"];

    default:
      return [];
  }
}

const kitSchema = z.object({
  name: z.string().trim().min(1).max(150),
  className: z.string().trim().min(1).max(50),
  // gender: z.enum(['Boys', 'Girls', 'Unisex']),
  gender: z.enum([
  'Boys',
  'Girls',
  'Both Boys and Girls',
  'Unisex',
]),
  description: z.string().optional().default(''),
  price: z.coerce.number().finite().min(0),
  isActive: z.boolean().default(true),
  items: z.array(itemSchema).min(1),
})

const handleError = (error, next) => {
  if (error.name === 'ZodError') {
    return next(
      new AppError('Validation failed', 400, error.issues || error.errors)
    )
  }
  next(error)
}

const mapKit = (kit) => ({
  id: kit.id,
  name: kit.name,
  className: kit.class_name,
  gender: kit.gender,
  description: kit.description || '',
  price: Number(kit.price),
  imageUrl: kit.image_url,
  isActive: Boolean(kit.is_active),
  createdAt: kit.created_at,
})

const mapItem = (item) => ({
  id: item.id,
  productId: item.product_id,
  productName: item.product_name,
  quantity: Number(item.quantity),
  studentPicksSize: Boolean(item.student_picks_size),
  autoMatchHouseColor: Boolean(item.auto_match_house_color),
})

async function itemsFor(kitId) {
  const rows = await db('kit_items as ki')
    .join('products as p', 'p.id', 'ki.product_id')
    .where('ki.kit_id', kitId)
    .select('ki.*', 'p.name as product_name')
    .orderBy('ki.id')

  return rows.map(mapItem)
}

async function listKits(req, res, next) {
  try {
    const kits = await db('kits').orderBy('id', 'desc')
    const ids = kits.map((kit) => kit.id)

    const allItems = ids.length
      ? await db('kit_items')
          .whereIn('kit_id', ids)
          .select('kit_id')
      : []

    const counts = new Map()

    allItems.forEach((item) => {
      const key = String(item.kit_id)
      counts.set(key, (counts.get(key) || 0) + 1)
    })

    res.json({
      success: true,
      data: {
        items: kits.map((kit) => ({
          ...mapKit(kit),
          itemCount: counts.get(String(kit.id)) || 0,
        })),
      },
    })
  } catch (error) {
    next(error)
  }
}

async function getKitById(req, res, next) {
  try {
    const kit = await db('kits')
      .where('id', req.params.id)
      .first()

    if (!kit) {
      throw new AppError('Kit not found', 404)
    }

    res.json({
      success: true,
      data: {
        kit: mapKit(kit),
        items: await itemsFor(kit.id),
      },
    })
  } catch (error) {
    next(error)
  }
}

async function validateProducts(
  trx,
  items,
  className,
  gender
) {
  const ids = items.map((item) => Number(item.productId));

  if (new Set(ids).size !== ids.length) {
    throw new AppError('Duplicate products in kit', 400);
  }

  const products = await trx('products as p')
    .join(
      'product_eligibility as pe',
      'pe.product_id',
      'p.id'
    )
    .whereIn('p.id', ids)
    .where('p.status', 'active')
    .where('p.include_in_kit', true)
    .whereRaw('LOWER(TRIM(pe.class_name)) = ?', [
      className.trim().toLowerCase(),
    ])
    // .whereIn('pe.gender', [
    //   gender === 'Girls' ? 'girls' : 'boys',
    //   'both',
    //   'unisex',
    // ])
    .whereIn("pe.gender", allowedProductGenders(gender))
    .distinct('p.id');

  if (products.length !== ids.length) {
    throw new AppError(
      'Some products are not eligible for the selected class and gender',
      400
    );
  }
}

async function calculateKitBasePrice(trx, items) {
  const ids = items.map((item) => Number(item.productId));

  const products = await trx('products')
    .whereIn('id', ids)
    .select('id', 'base_price');

  const variants = await trx('product_variants')
    .whereIn('product_id', ids)
    .where('is_active', true)
    .select('product_id', 'price_override');

  let total = 0;

  for (const item of items) {
    const product = products.find(
      (p) => Number(p.id) === Number(item.productId)
    );

    if (!product) {
      throw new AppError('Product not found', 400);
    }

    const productVariants = variants.filter(
      (v) => Number(v.product_id) === Number(item.productId)
    );

    const prices = productVariants.map((v) =>
      v.price_override == null
        ? Number(product.base_price)
        : Number(v.price_override)
    );

    const initialPrice = prices.length
      ? Math.min(...prices)
      : Number(product.base_price);

    total += initialPrice * Number(item.quantity);
  }

  return Math.round(total * 100) / 100;
}


// async function validateProducts(trx, items) {
//   const ids = items.map((item) => item.productId)

//   if (new Set(ids.map(String)).size !== ids.length) {
//     throw new AppError('Duplicate products in kit', 400)
//   }

//   const products = await trx('products')
//     .whereIn('id', ids)
//     .select('id')

//   if (products.length !== ids.length) {
//     throw new AppError(
//       'One or more products do not exist',
//       400
//     )
//   }
// }

async function writeItems(trx, kitId, items) {
  await trx('kit_items')
    .where({ kit_id: kitId })
    .del()

  for (const item of items) {
    await trx('kit_items').insert({
      kit_id: kitId,
      product_id: item.productId,
      quantity: item.quantity,
      student_picks_size: item.studentPicksSize,
      auto_match_house_color: item.autoMatchHouseColor,
    })
  }
}

async function createKit(req, res, next) {
  try {
    const body = kitSchema.parse(req.body)

    const id = await db.transaction(async (trx) => {
      // await validateProducts(trx, body.items)
      await validateProducts(
  trx,
  body.items,
  body.className,
  body.gender
);

const calculatedPrice = await calculateKitBasePrice(
  trx,
  body.items
);

      const [kitId] = await trx('kits').insert({
        name: body.name,
        class_name: body.className,
        gender: body.gender,
        description: body.description,
        // price: body.price,
        price: calculatedPrice,
        is_active: body.isActive,
      })

      await writeItems(trx, kitId, body.items)

      return kitId
    })

    res.status(201).json({
      success: true,
      data: { id },
    })
  } catch (error) {
    handleError(error, next)
  }
}

async function updateKit(req, res, next) {
  try {
    const body = kitSchema.parse(req.body)
    const id = req.params.id

    await db.transaction(async (trx) => {
      const existing = await trx('kits')
        .where({ id })
        .first()

      if (!existing) {
        throw new AppError('Kit not found', 404)
      }

      // await validateProducts(trx, body.items)
      await validateProducts(
  trx,
  body.items,
  body.className,
  body.gender
);

const calculatedPrice = await calculateKitBasePrice(
  trx,
  body.items
);

      await trx('kits')
        .where({ id })
        .update({
          name: body.name,
          class_name: body.className,
          gender: body.gender,
          description: body.description,
          // price: body.price,
          price: calculatedPrice,
          is_active: body.isActive,
          updated_at: trx.fn.now(),
        })

      await writeItems(trx, id, body.items)
    })

    res.json({
      success: true,
      data: { id },
    })
  } catch (error) {
    handleError(error, next)
  }
}

async function toggleKit(req, res, next) {
  try {
    const body = z.object({
      isActive: z.boolean(),
    }).parse(req.body)

    const updated = await db('kits')
      .where({ id: req.params.id })
      .update({
        is_active: body.isActive,
        updated_at: db.fn.now(),
      })

    if (!updated) {
      throw new AppError('Kit not found', 404)
    }

    res.json({ success: true })
  } catch (error) {
    handleError(error, next)
  }
}

async function deleteKit(req, res, next) {
  try {
    const id = req.params.id

    const kit = await db('kits')
      .where({ id })
      .first()

    if (!kit) {
      throw new AppError('Kit not found', 404)
    }

    await db.transaction(async (trx) => {
      await trx('kit_items')
        .where({ kit_id: id })
        .del()

      await trx('kits')
        .where({ id })
        .del()
    })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

async function listKitProducts(req, res, next) {
  try {
    const className = String(req.query.className || '').trim();
    const gender = String(req.query.gender || '').trim();

    if (!className || !gender) {
      return res.json({
        success: true,
        data: { items: [] },
      });
    }

    const products = await db('products as p')
      .join(
        'product_eligibility as pe',
        'pe.product_id',
        'p.id'
      )
      .where('p.status', 'active')
      .where('p.include_in_kit', true)
      .whereRaw('LOWER(TRIM(pe.class_name)) = ?', [
        className.toLowerCase(),
      ])
      .whereIn(
        'pe.gender',
        allowedProductGenders(gender)
      )
      .distinct(
        'p.id',
        'p.name',
        'p.base_price'
      )
      .orderBy('p.name');

    const ids = products.map((p) => p.id);

    const variants = ids.length
      ? await db('product_variants')
          .whereIn('product_id', ids)
          .where('is_active', true)
          .select(
            'product_id',
            'option1_value',
            'price_override'
          )
      : [];

    const items = products.map((product) => {
      const productVariants = variants.filter(
        (v) => Number(v.product_id) === Number(product.id)
      );

      const prices = productVariants.map((v) =>
        v.price_override == null
          ? Number(product.base_price)
          : Number(v.price_override)
      );

      return {
        id: product.id,
        name: product.name,
        status: 'active',
        price: prices.length
          ? Math.min(...prices)
          : Number(product.base_price),
        variants: productVariants.map((v) => ({
          size: v.option1_value,
          price: v.price_override == null
            ? Number(product.base_price)
            : Number(v.price_override),
        })),
      };
    });

    res.json({
      success: true,
      data: { items },
    });
  } catch (error) {
    next(error);
  }
}
// async function listKitProducts(req, res, next) {
//   try {
//     const products = await db('products')
//       .select('id', 'name', 'status', 'base_price')
//       .orderBy('name')

//     res.json({
//       success: true,
//       data: {
//         items: products.map((product) => ({
//           id: product.id,
//           name: product.name,
//           status: product.status,
//           price: Number(product.base_price),
//         })),
//       },
//     })
//   } catch (error) {
//     next(error)
//   }
// }

async function uploadKitImage(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('Image required', 400)
    }

    const kit = await db('kits')
      .where({ id: req.params.id })
      .first()

    if (!kit) {
      throw new AppError('Kit not found', 404)
    }

    const url = await storage.saveUploadedFile(req.file)

    await db('kits')
      .where({ id: kit.id })
      .update({
        image_url: url,
        updated_at: db.fn.now(),
      })

    res.json({
      success: true,
      data: { imageUrl: url },
    })
  } catch (error) {
    next(error)
  }
}

// Existing single-kit API compatibility
async function getActiveKit(req, res, next) {
  try {
    let kit = await db('kits')
      .where({ is_active: true })
      .orderBy('id', 'desc')
      .first()

    if (!kit) {
      kit = await db('kits')
        .orderBy('id', 'desc')
        .first()
    }

    if (!kit) {
      return res.json({
        success: true,
        data: {
          kit: null,
          items: [],
          warnings: [],
        },
      })
    }

    const items = await itemsFor(kit.id)
    const warnings = []

    for (const item of items) {
      const variants = await db('product_variants')
        .where({
          product_id: item.productId,
          is_active: true,
        })

      const zeroStock = variants.filter(
        (variant) => Number(variant.stock_qty) === 0
      )

      if (zeroStock.length) {
        warnings.push({
          productId: item.productId,
          productName: item.productName,
          zeroStockSkus: zeroStock.map(
            (variant) => variant.sku
          ),
        })
      }
    }

    res.json({
      success: true,
      data: {
        kit: mapKit(kit),
        items,
        warnings,
      },
    })
  } catch (error) {
    next(error)
  }
}

async function saveKit(req, res, next) {
  try {
    const body = z.object({
      name: z.string().min(1),
      description: z.string().optional().default(''),
      price: z.coerce.number().min(0),
      isActive: z.boolean(),
      items: z.array(itemSchema),
    }).parse(req.body)

    const kit = await db('kits')
      .orderBy('id', 'desc')
      .first()

    if (!kit) {
      throw new AppError(
        'Create a kit first',
        400
      )
    }

    await db.transaction(async (trx) => {
      // await validateProducts(trx, body.items)
      await validateProducts(
  trx,
  body.items,
  kit.class_name,
  kit.gender
)

      await trx('kits')
        .where({ id: kit.id })
        .update({
          name: body.name,
          description: body.description,
          price: body.price,
          is_active: body.isActive,
          updated_at: trx.fn.now(),
        })

      await writeItems(trx, kit.id, body.items)
    })

    res.json({
      success: true,
      data: { id: kit.id },
    })
  } catch (error) {
    handleError(error, next)
  }
}

async function uploadLegacyImage(req, res, next) {
  try {
    const kit = await db('kits')
      .orderBy('id', 'desc')
      .first()

    if (!kit) {
      throw new AppError('Create kit first', 400)
    }

    req.params.id = String(kit.id)
    return uploadKitImage(req, res, next)
  } catch (error) {
    next(error)
  }
}

// Matching API for class/gender filtering
async function matchingKits(req, res, next) {
  try {
    const className = String(
      req.query.className || ''
    ).trim()

    const gender = String(
      req.query.gender || ''
    ).trim()

    if (!className || !gender) {
      throw new AppError(
        'className and gender required',
        400
      )
    }

    const kits = await db('kits')
      .where({
        is_active: true,
        class_name: className,
      })
      // .whereIn('gender', [gender, 'Unisex'])
      .whereIn("gender", [
  gender,
  "Both Boys and Girls",
  "Unisex",
])
      .orderBy('id', 'desc')

    res.json({
      success: true,
      data: {
        items: kits.map(mapKit),
      },
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listKits,
  getKitById,
  getActiveKit,
  createKit,
  updateKit,
  toggleKit,
  deleteKit,
  listKitProducts,
  uploadKitImage,
  saveKit,
  uploadLegacyImage,
  matchingKits,
}

