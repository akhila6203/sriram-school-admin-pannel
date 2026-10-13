const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { slugify } = require('../utils/slug');
const storage = require('../services/storage');

const productBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(220).optional(),
  description: z.string().optional().default(''),
  categoryId: z.coerce.number().int().positive(),
  brand: z.string().max(120).optional().default(''),
  basePrice: z.coerce.number().nonnegative(),
  compareAtPrice: z.coerce.number().nonnegative().nullable().optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
  hsnCode: z.string().max(16).nullable().optional(),
  gstRate: z.coerce.number().min(0).max(28).optional(),
  priceIncludesGst: z.boolean().optional().default(true),
  includeInKit: z.boolean().optional().default(true),
  status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
  visibleIndividually: z.boolean().optional().default(true),
  variants: z
    .array(
      z.object({
        id: z.coerce.number().int().positive().optional(),
        sku: z.string().min(1).max(100),
        option1Name: z.string().nullable().optional(),
        option1Value: z.string().nullable().optional(),
        option2Name: z.string().nullable().optional(),
        option2Value: z.string().nullable().optional(),
        priceOverride: z.coerce.number().nullable().optional(),
        stockQty: z.coerce.number().int().min(0).optional().default(0),
        lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
        barcode: z.string().nullable().optional(),
        weightGrams: z.coerce.number().int().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        isActive: z.boolean().optional().default(true),
      })
    )
    .optional(),
});

function mapProduct(row, extras = {}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name || extras.categoryName,
    brand: row.brand,
    basePrice: Number(row.base_price),
    compareAtPrice: row.compare_at_price != null ? Number(row.compare_at_price) : null,
    taxPercent: Number(row.gst_rate != null ? row.gst_rate : row.tax_percent),
    hsnCode: row.hsn_code || null,
    gstRate: Number(row.gst_rate != null ? row.gst_rate : row.tax_percent || 0),
    priceIncludesGst: row.price_includes_gst == null ? true : Boolean(row.price_includes_gst),
    includeInKit: row.include_in_kit == null ? true : Boolean(row.include_in_kit),
    status: row.status,
    visibleIndividually: Boolean(row.visible_individually),
    sku: row.sku || extras.sku || null,
    minPrice: row.min_price != null ? Number(row.min_price) : Number(row.base_price),
    maxPrice: row.max_price != null ? Number(row.max_price) : Number(row.base_price),
    stockStatus: extras.stockStatus || row.stock_status || null,
    primaryImage: row.primary_image || extras.primaryImage || null,
    totalStock: Number(row.total_stock || extras.totalStock || 0),
    variantCount: Number(row.variant_count || extras.variantCount || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVariant(v) {
  return {
    id: v.id,
    productId: v.product_id,
    sku: v.sku,
    option1Name: v.option1_name,
    option1Value: v.option1_value,
    option2Name: v.option2_name,
    option2Value: v.option2_value,
    priceOverride: v.price_override != null ? Number(v.price_override) : null,
    stockQty: v.stock_qty,
    lowStockThreshold: v.low_stock_threshold,
    barcode: v.barcode,
    weightGrams: v.weight_grams,
    imageUrl: v.image_url,
    isActive: Boolean(v.is_active),
  };
}

function mapImage(img) {
  return {
    id: img.id,
    url: img.url,
    sortOrder: img.sort_order,
    isPrimary: Boolean(img.is_primary),
  };
}

async function listProducts(req, res, next) {
  try {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional().default(''),
      categoryId: z.string().optional().default(''),
      status: z.enum(['draft', 'active', 'archived', '']).optional().default(''),
      stockFilter: z.enum(['', 'in', 'low', 'out']).optional().default(''),
    });
    const q = schema.parse(req.query);

    let query = db('products as p')
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .leftJoin('product_variants as v', 'v.product_id', 'p.id')
      .leftJoin('product_images as pi', function joinPrimary() {
        this.on('pi.product_id', '=', 'p.id').andOn('pi.is_primary', '=', db.raw('1'));
      })
      .select(
        'p.*',
        'c.name as category_name',
        db.raw('COALESCE(SUM(v.stock_qty), 0) as total_stock'),
        db.raw('COUNT(DISTINCT v.id) as variant_count'),
        db.raw('MAX(pi.url) as primary_image'),
        db.raw('MIN(v.sku) as sku'),
        db.raw('MIN(COALESCE(v.price_override, p.base_price)) as min_price'),
        db.raw('MAX(COALESCE(v.price_override, p.base_price)) as max_price')
      )
      .groupBy('p.id', 'c.name');

    if (q.search) {
      const s = `%${q.search}%`;
      query = query.andWhere((b) =>
        b.where('p.name', 'like', s).orWhere('p.slug', 'like', s).orWhere('v.sku', 'like', s)
      );
    }
    if (q.categoryId) query = query.andWhere('p.category_id', q.categoryId);
    if (q.status) query = query.andWhere('p.status', q.status);

    if (q.stockFilter === 'out') {
      query = query.havingRaw('COALESCE(SUM(v.stock_qty), 0) = 0');
    } else if (q.stockFilter === 'low') {
      query = query.havingRaw(
        'COALESCE(SUM(v.stock_qty), 0) > 0 AND COALESCE(SUM(v.stock_qty), 0) <= COALESCE(MIN(v.low_stock_threshold), 5)'
      );
    } else if (q.stockFilter === 'in') {
      query = query.havingRaw(
        'COALESCE(SUM(v.stock_qty), 0) > COALESCE(MIN(v.low_stock_threshold), 5)'
      );
    }

    const countRows = await query.clone().clearSelect().clearOrder().countDistinct({ total: 'p.id' }).first();
    // groupBy count is awkward — use subquery approach for total
    const allIds = await query.clone().clearSelect().select('p.id');
    const total = allIds.length;

    const rows = await query
      .orderBy('p.updated_at', 'desc')
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

    res.json({
      success: true,
      data: {
        items: rows.map((r) => {
          const total = Number(r.total_stock || 0);
          const lowAt = Number(r.low_stock_threshold || 5);
          let stockStatus = 'in stock';
          if (total <= 0) stockStatus = 'out';
          else if (total <= lowAt) stockStatus = 'low';
          return mapProduct(r, { stockStatus });
        }),
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          total,
          totalPages: Math.ceil(total / q.pageSize) || 1,
        },
      },
    });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function getProduct(req, res, next) {
  try {
    const row = await db('products as p')
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .select('p.*', 'c.name as category_name')
      .where('p.id', req.params.id)
      .first();
    if (!row) throw new AppError('Product not found', 404);

    const images = await db('product_images').where({ product_id: row.id }).orderBy('sort_order');
    const variants = await db('product_variants').where({ product_id: row.id }).orderBy('id');
    const movements = await db('stock_movements as m')
      .join('product_variants as v', 'v.id', 'm.variant_id')
      .where('v.product_id', row.id)
      .select('m.*', 'v.sku')
      .orderBy('m.created_at', 'desc')
      .limit(50);
    const salesRow = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('oi.product_id', row.id)
      .whereNotIn('o.status', ['cancelled'])
      .countDistinct({ orders: 'o.id' })
      .sum({ qty: 'oi.quantity' })
      .sum({ revenue: 'oi.line_total' })
      .first();

    res.json({
      success: true,
      data: {
        product: mapProduct(row, { sku: variants[0]?.sku }),
        images: images.map(mapImage),
        variants: variants.map(mapVariant),
        movements: movements.map((m) => ({
          id: m.id,
          sku: m.sku,
          changeQty: m.change_qty,
          reason: m.reason,
          note: m.note,
          createdAt: m.created_at,
        })),
        sales: {
          orders: Number(salesRow?.orders || 0),
          qty: Number(salesRow?.qty || 0),
          revenue: Number(salesRow?.revenue || 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function assertUniqueSkus(trx, variants, productId = null) {
  const skus = variants.map((v) => v.sku);
  const unique = new Set(skus);
  if (unique.size !== skus.length) {
    throw new AppError('Duplicate SKUs in request', 400);
  }
  let q = trx('product_variants').whereIn('sku', skus);
  if (productId) q = q.whereNot({ product_id: productId });
  const clash = await q.first();
  if (clash) throw new AppError(`SKU already exists: ${clash.sku}`, 409);
}

async function createProduct(req, res, next) {
  try {
    const body = productBodySchema.parse(req.body);
    const slug = body.slug ? slugify(body.slug) : slugify(body.name);
    const exists = await db('products').where({ slug }).first();
    if (exists) throw new AppError('Product slug already exists', 409);

    const variants = body.variants || [];
    const id = await db.transaction(async (trx) => {
      await assertUniqueSkus(trx, variants);
      const [productId] = await trx('products').insert({
        name: body.name.trim(),
        slug,
        description: body.description || '',
        category_id: body.categoryId,
        brand: body.brand || '',
        base_price: body.basePrice,
        compare_at_price: body.compareAtPrice ?? null,
        tax_percent: body.gstRate ?? body.taxPercent,
        gst_rate: body.gstRate ?? body.taxPercent ?? 0,
        hsn_code: body.hsnCode || null,
        price_includes_gst: body.priceIncludesGst !== false,
        include_in_kit: body.includeInKit !== false,
        status: body.status,
        visible_individually: body.visibleIndividually,
      });

      for (const v of variants) {
        const [variantId] = await trx('product_variants').insert({
          product_id: productId,
          sku: v.sku.trim(),
          option1_name: v.option1Name || null,
          option1_value: v.option1Value || null,
          option2_name: v.option2Name || null,
          option2_value: v.option2Value || null,
          price_override: v.priceOverride ?? null,
          stock_qty: v.stockQty || 0,
          low_stock_threshold: v.lowStockThreshold ?? 5,
          barcode: v.barcode || null,
          weight_grams: v.weightGrams ?? null,
          image_url: v.imageUrl || null,
          is_active: v.isActive !== false,
        });
        if (v.stockQty > 0) {
          await trx('stock_movements').insert({
            variant_id: variantId,
            change_qty: v.stockQty,
            reason: 'initial',
            admin_user_id: req.admin.id,
            note: 'Initial stock on product create',
          });
        }
      }
      return productId;
    });

    const row = await db('products').where({ id }).first();
    res.status(201).json({ success: true, data: { product: mapProduct(row) } });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const body = productBodySchema.partial().parse(req.body);
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) throw new AppError('Product not found', 404);

    await db.transaction(async (trx) => {
      const patch = { updated_at: trx.fn.now() };
      if (body.name !== undefined) patch.name = body.name.trim();
      if (body.slug !== undefined) patch.slug = slugify(body.slug);
      if (body.description !== undefined) patch.description = body.description;
      if (body.categoryId !== undefined) patch.category_id = body.categoryId;
      if (body.brand !== undefined) patch.brand = body.brand;
      if (body.basePrice !== undefined) patch.base_price = body.basePrice;
      if (body.compareAtPrice !== undefined) patch.compare_at_price = body.compareAtPrice;
      if (body.taxPercent !== undefined) patch.tax_percent = body.taxPercent;
      if (body.gstRate !== undefined) {
        patch.gst_rate = body.gstRate;
        patch.tax_percent = body.gstRate;
      }
      if (body.hsnCode !== undefined) patch.hsn_code = body.hsnCode;
      if (body.priceIncludesGst !== undefined) patch.price_includes_gst = body.priceIncludesGst;
      if (body.includeInKit !== undefined) patch.include_in_kit = body.includeInKit;
      if (body.status !== undefined) patch.status = body.status;
      if (body.visibleIndividually !== undefined) patch.visible_individually = body.visibleIndividually;

      if (patch.slug) {
        const clash = await trx('products').where({ slug: patch.slug }).whereNot({ id: product.id }).first();
        if (clash) throw new AppError('Product slug already exists', 409);
      }

      await trx('products').where({ id: product.id }).update(patch);

      if (body.variants) {
        await assertUniqueSkus(trx, body.variants, product.id);
        const existing = await trx('product_variants').where({ product_id: product.id });
        const keepIds = body.variants.filter((v) => v.id).map((v) => v.id);

        // Soft-deactivate removed variants (preserve order history FKs)
        await trx('product_variants')
          .where({ product_id: product.id })
          .whereNotIn('id', keepIds.length ? keepIds : [0])
          .update({ is_active: false, updated_at: trx.fn.now() });

        for (const v of body.variants) {
          if (v.id) {
            const prev = existing.find((e) => e.id === v.id);
            await trx('product_variants').where({ id: v.id }).update({
              sku: v.sku.trim(),
              option1_name: v.option1Name || null,
              option1_value: v.option1Value || null,
              option2_name: v.option2Name || null,
              option2_value: v.option2Value || null,
              price_override: v.priceOverride ?? null,
              low_stock_threshold: v.lowStockThreshold ?? 5,
              barcode: v.barcode || null,
              weight_grams: v.weightGrams ?? null,
              image_url: v.imageUrl || null,
              is_active: v.isActive !== false,
              updated_at: trx.fn.now(),
            });
            // stock changes go through inventory endpoints; only set if creating new
            if (prev && v.stockQty !== undefined && v.stockQty !== prev.stock_qty) {
              // ignore stock on update path — inventory owns stock mutations
            }
          } else {
            const [variantId] = await trx('product_variants').insert({
              product_id: product.id,
              sku: v.sku.trim(),
              option1_name: v.option1Name || null,
              option1_value: v.option1Value || null,
              option2_name: v.option2Name || null,
              option2_value: v.option2Value || null,
              price_override: v.priceOverride ?? null,
              stock_qty: v.stockQty || 0,
              low_stock_threshold: v.lowStockThreshold ?? 5,
              barcode: v.barcode || null,
              weight_grams: v.weightGrams ?? null,
              image_url: v.imageUrl || null,
              is_active: v.isActive !== false,
            });
            if (v.stockQty > 0) {
              await trx('stock_movements').insert({
                variant_id: variantId,
                change_qty: v.stockQty,
                reason: 'initial',
                admin_user_id: req.admin.id,
                note: 'Initial stock on variant create',
              });
            }
          }
        }
      }
    });

    const row = await db('products').where({ id: product.id }).first();
    res.json({ success: true, data: { product: mapProduct(row) } });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) throw new AppError('Product not found', 404);
    const used = await db('order_items').where({ product_id: product.id }).count({ c: '*' }).first();
    if (Number(used.c) > 0) {
      throw new AppError('Product appears on orders. Archive instead.', 400);
    }
    await db('products').where({ id: product.id }).del();
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
}

async function bulkStatus(req, res, next) {
  try {
    const schema = z.object({
      ids: z.array(z.coerce.number().int().positive()).min(1),
      status: z.enum(['draft', 'active', 'archived']),
    });
    const { ids, status } = schema.parse(req.body);
    await db('products').whereIn('id', ids).update({ status, updated_at: db.fn.now() });
    res.json({ success: true, message: `Updated ${ids.length} products` });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function duplicateProduct(req, res, next) {
  try {
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) throw new AppError('Product not found', 404);
    const images = await db('product_images').where({ product_id: product.id });
    const variants = await db('product_variants').where({ product_id: product.id });

    const newId = await db.transaction(async (trx) => {
      let slug = `${product.slug}-copy`;
      let n = 1;
      while (await trx('products').where({ slug }).first()) {
        n += 1;
        slug = `${product.slug}-copy-${n}`;
      }
      const [productId] = await trx('products').insert({
        name: `${product.name} (Copy)`,
        slug,
        description: product.description,
        category_id: product.category_id,
        brand: product.brand,
        base_price: product.base_price,
        compare_at_price: product.compare_at_price,
        tax_percent: product.tax_percent,
        gst_rate: product.gst_rate,
        hsn_code: product.hsn_code,
        price_includes_gst: product.price_includes_gst,
        include_in_kit: product.include_in_kit,
        status: 'draft',
        visible_individually: product.visible_individually,
      });
      for (const img of images) {
        await trx('product_images').insert({
          product_id: productId,
          url: img.url,
          sort_order: img.sort_order,
          is_primary: img.is_primary,
        });
      }
      for (const v of variants) {
        await trx('product_variants').insert({
          product_id: productId,
          sku: `${v.sku}-COPY${Date.now().toString().slice(-4)}`,
          option1_name: v.option1_name,
          option1_value: v.option1_value,
          option2_name: v.option2_name,
          option2_value: v.option2_value,
          price_override: v.price_override,
          stock_qty: 0,
          low_stock_threshold: v.low_stock_threshold,
          barcode: null,
          weight_grams: v.weight_grams,
          image_url: v.image_url,
          is_active: v.is_active,
        });
      }
      return productId;
    });

    res.status(201).json({ success: true, data: { id: newId } });
  } catch (err) {
    next(err);
  }
}

async function uploadImages(req, res, next) {
  try {
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) throw new AppError('Product not found', 404);
    const files = req.files || [];
    if (!files.length) throw new AppError('No files uploaded', 400);

    const existing = await db('product_images').where({ product_id: product.id });
    let sort = existing.length;
    const created = [];
    for (const file of files) {
      const url = await storage.saveUploadedFile(file);
      const [id] = await db('product_images').insert({
        product_id: product.id,
        url,
        sort_order: sort,
        is_primary: existing.length === 0 && sort === 0,
      });
      created.push({ id, url, sortOrder: sort, isPrimary: existing.length === 0 && sort === 0 });
      sort += 1;
    }
    res.status(201).json({ success: true, data: { images: created } });
  } catch (err) {
    next(err);
  }
}

async function reorderImages(req, res, next) {
  try {
    const schema = z.object({
      images: z.array(
        z.object({
          id: z.coerce.number().int().positive(),
          sortOrder: z.coerce.number().int().min(0),
          isPrimary: z.boolean().optional(),
        })
      ),
    });
    const { images } = schema.parse(req.body);
    await db.transaction(async (trx) => {
      for (const img of images) {
        await trx('product_images').where({ id: img.id, product_id: req.params.id }).update({
          sort_order: img.sortOrder,
          is_primary: img.isPrimary === true,
          updated_at: trx.fn.now(),
        });
      }
      const primary = images.find((i) => i.isPrimary);
      if (primary) {
        await trx('product_images')
          .where({ product_id: req.params.id })
          .whereNot({ id: primary.id })
          .update({ is_primary: false });
      }
    });
    res.json({ success: true, message: 'Images updated' });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function deleteImage(req, res, next) {
  try {
    const img = await db('product_images')
      .where({ id: req.params.imageId, product_id: req.params.id })
      .first();
    if (!img) throw new AppError('Image not found', 404);
    await db('product_images').where({ id: img.id }).del();
    await storage.deleteByUrl(img.url);
    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkStatus,
  duplicateProduct,
  uploadImages,
  reorderImages,
  deleteImage,
};





// const { z } = require('zod');
// const db = require('../config/db');
// const AppError = require('../utils/AppError');
// const { slugify } = require('../utils/slug');
// const storage = require('../services/storage');

// const productBodySchema = z.object({
//   name: z.string().min(1).max(200),
//   slug: z.string().max(220).optional(),
//   description: z.string().optional().default(''),
//   categoryId: z.coerce.number().int().positive(),
//   brand: z.string().max(120).optional().default(''),
//   basePrice: z.coerce.number().nonnegative(),
//   compareAtPrice: z.coerce.number().nonnegative().nullable().optional(),
//   taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
//   hsnCode: z.string().max(16).nullable().optional(),
//   gstRate: z.coerce.number().min(0).max(28).optional(),
//   priceIncludesGst: z.boolean().optional().default(true),
//   includeInKit: z.boolean().optional().default(true),
//   status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
//   visibleIndividually: z.boolean().optional().default(true),
//   variants: z
//     .array(
//       z.object({
//         id: z.coerce.number().int().positive().optional(),
//         sku: z.string().min(1).max(100),
//         option1Name: z.string().nullable().optional(),
//         option1Value: z.string().nullable().optional(),
//         option2Name: z.string().nullable().optional(),
//         option2Value: z.string().nullable().optional(),
//         priceOverride: z.coerce.number().nullable().optional(),
//         stockQty: z.coerce.number().int().min(0).optional().default(0),
//         lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
//         barcode: z.string().nullable().optional(),
//         weightGrams: z.coerce.number().int().nullable().optional(),
//         imageUrl: z.string().nullable().optional(),
//         isActive: z.boolean().optional().default(true),
//       })
//     )
//     .optional(),
// });

// function mapProduct(row, extras = {}) {
//   return {
//     id: row.id,
//     name: row.name,
//     slug: row.slug,
//     description: row.description,
//     categoryId: row.category_id,
//     categoryName: row.category_name || extras.categoryName,
//     brand: row.brand,
//     basePrice: Number(row.base_price),
//     compareAtPrice: row.compare_at_price != null ? Number(row.compare_at_price) : null,
//     taxPercent: Number(row.gst_rate != null ? row.gst_rate : row.tax_percent),
//     hsnCode: row.hsn_code || null,
//     gstRate: Number(row.gst_rate != null ? row.gst_rate : row.tax_percent || 0),
//     priceIncludesGst: row.price_includes_gst == null ? true : Boolean(row.price_includes_gst),
//     includeInKit: row.include_in_kit == null ? true : Boolean(row.include_in_kit),
//     status: row.status,
//     visibleIndividually: Boolean(row.visible_individually),
//     sku: row.sku || extras.sku || null,
//     minPrice: row.min_price != null ? Number(row.min_price) : Number(row.base_price),
//     maxPrice: row.max_price != null ? Number(row.max_price) : Number(row.base_price),
//     stockStatus: extras.stockStatus || row.stock_status || null,
//     primaryImage: row.primary_image || extras.primaryImage || null,
//     totalStock: Number(row.total_stock || extras.totalStock || 0),
//     variantCount: Number(row.variant_count || extras.variantCount || 0),
//     createdAt: row.created_at,
//     updatedAt: row.updated_at,
//   };
// }

// function mapVariant(v) {
//   return {
//     id: v.id,
//     productId: v.product_id,
//     sku: v.sku,
//     option1Name: v.option1_name,
//     option1Value: v.option1_value,
//     option2Name: v.option2_name,
//     option2Value: v.option2_value,
//     priceOverride: v.price_override != null ? Number(v.price_override) : null,
//     stockQty: v.stock_qty,
//     lowStockThreshold: v.low_stock_threshold,
//     barcode: v.barcode,
//     weightGrams: v.weight_grams,
//     imageUrl: v.image_url,
//     isActive: Boolean(v.is_active),
//   };
// }

// function mapImage(img) {
//   return {
//     id: img.id,
//     url: img.url,
//     sortOrder: img.sort_order,
//     isPrimary: Boolean(img.is_primary),
//   };
// }

// async function listProducts(req, res, next) {
//   try {
//     const schema = z.object({
//       page: z.coerce.number().int().min(1).default(1),
//       pageSize: z.coerce.number().int().min(1).max(100).default(20),
//       search: z.string().optional().default(''),
//       categoryId: z.string().optional().default(''),
//       status: z.enum(['draft', 'active', 'archived', '']).optional().default(''),
//       stockFilter: z.enum(['', 'in', 'low', 'out']).optional().default(''),
//     });
//     const q = schema.parse(req.query);

//     let query = db('products as p')
//       .leftJoin('categories as c', 'c.id', 'p.category_id')
//       .leftJoin('product_variants as v', 'v.product_id', 'p.id')
//       .leftJoin('product_images as pi', function joinPrimary() {
//         this.on('pi.product_id', '=', 'p.id').andOn('pi.is_primary', '=', db.raw('1'));
//       })
//       .select(
//         'p.*',
//         'c.name as category_name',
//         db.raw('COALESCE(SUM(v.stock_qty), 0) as total_stock'),
//         db.raw('COUNT(DISTINCT v.id) as variant_count'),
//         db.raw('MAX(pi.url) as primary_image'),
//         db.raw('MIN(v.sku) as sku'),
//         db.raw('MIN(COALESCE(v.price_override, p.base_price)) as min_price'),
//         db.raw('MAX(COALESCE(v.price_override, p.base_price)) as max_price')
//       )
//       .groupBy('p.id', 'c.name');

//     if (q.search) {
//       const s = `%${q.search}%`;
//       query = query.andWhere((b) =>
//         b.where('p.name', 'like', s).orWhere('p.slug', 'like', s).orWhere('v.sku', 'like', s)
//       );
//     }
//     if (q.categoryId) query = query.andWhere('p.category_id', q.categoryId);
//     if (q.status) query = query.andWhere('p.status', q.status);

//     if (q.stockFilter === 'out') {
//       query = query.havingRaw('COALESCE(SUM(v.stock_qty), 0) = 0');
//     } else if (q.stockFilter === 'low') {
//       query = query.havingRaw(
//         'COALESCE(SUM(v.stock_qty), 0) > 0 AND COALESCE(SUM(v.stock_qty), 0) <= COALESCE(MIN(v.low_stock_threshold), 5)'
//       );
//     } else if (q.stockFilter === 'in') {
//       query = query.havingRaw(
//         'COALESCE(SUM(v.stock_qty), 0) > COALESCE(MIN(v.low_stock_threshold), 5)'
//       );
//     }

//     const countRows = await query.clone().clearSelect().clearOrder().countDistinct({ total: 'p.id' }).first();
//     // groupBy count is awkward — use subquery approach for total
//     const allIds = await query.clone().clearSelect().select('p.id');
//     const total = allIds.length;

//     const rows = await query
//       .orderBy('p.updated_at', 'desc')
//       .limit(q.pageSize)
//       .offset((q.page - 1) * q.pageSize);

//     res.json({
//       success: true,
//       data: {
//         items: rows.map((r) => {
//           const total = Number(r.total_stock || 0);
//           const lowAt = Number(r.low_stock_threshold || 5);
//           let stockStatus = 'in stock';
//           if (total <= 0) stockStatus = 'out';
//           else if (total <= lowAt) stockStatus = 'low';
//           return mapProduct(r, { stockStatus });
//         }),
//         pagination: {
//           page: q.page,
//           pageSize: q.pageSize,
//           total,
//           totalPages: Math.ceil(total / q.pageSize) || 1,
//         },
//       },
//     });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function getProduct(req, res, next) {
//   try {
//     const row = await db('products as p')
//       .leftJoin('categories as c', 'c.id', 'p.category_id')
//       .select('p.*', 'c.name as category_name')
//       .where('p.id', req.params.id)
//       .first();
//     if (!row) throw new AppError('Product not found', 404);

//     const images = await db('product_images').where({ product_id: row.id }).orderBy('sort_order');
//     const variants = await db('product_variants').where({ product_id: row.id }).orderBy('id');
//     const movements = await db('stock_movements as m')
//       .join('product_variants as v', 'v.id', 'm.variant_id')
//       .where('v.product_id', row.id)
//       .select('m.*', 'v.sku')
//       .orderBy('m.created_at', 'desc')
//       .limit(50);
//     const salesRow = await db('order_items as oi')
//       .join('orders as o', 'o.id', 'oi.order_id')
//       .where('oi.product_id', row.id)
//       .whereNotIn('o.status', ['cancelled'])
//       .countDistinct({ orders: 'o.id' })
//       .sum({ qty: 'oi.quantity' })
//       .sum({ revenue: 'oi.line_total' })
//       .first();

//     res.json({
//       success: true,
//       data: {
//         product: mapProduct(row, { sku: variants[0]?.sku }),
//         images: images.map(mapImage),
//         variants: variants.map(mapVariant),
//         movements: movements.map((m) => ({
//           id: m.id,
//           sku: m.sku,
//           changeQty: m.change_qty,
//           reason: m.reason,
//           note: m.note,
//           createdAt: m.created_at,
//         })),
//         sales: {
//           orders: Number(salesRow?.orders || 0),
//           qty: Number(salesRow?.qty || 0),
//           revenue: Number(salesRow?.revenue || 0),
//         },
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// async function assertUniqueSkus(trx, variants, productId = null) {
//   const skus = variants.map((v) => v.sku);
//   const unique = new Set(skus);
//   if (unique.size !== skus.length) {
//     throw new AppError('Duplicate SKUs in request', 400);
//   }
//   let q = trx('product_variants').whereIn('sku', skus);
//   if (productId) q = q.whereNot({ product_id: productId });
//   const clash = await q.first();
//   if (clash) throw new AppError(`SKU already exists: ${clash.sku}`, 409);
// }

// async function createProduct(req, res, next) {
//   try {
//     const body = productBodySchema.parse(req.body);
//     const slug = body.slug ? slugify(body.slug) : slugify(body.name);
//     const exists = await db('products').where({ slug }).first();
//     if (exists) throw new AppError('Product slug already exists', 409);

//     const variants = body.variants || [];
//     const id = await db.transaction(async (trx) => {
//       await assertUniqueSkus(trx, variants);
//       const [productId] = await trx('products').insert({
//         name: body.name.trim(),
//         slug,
//         description: body.description || '',
//         category_id: body.categoryId,
//         brand: body.brand || '',
//         base_price: body.basePrice,
//         compare_at_price: body.compareAtPrice ?? null,
//         tax_percent: body.gstRate ?? body.taxPercent,
//         gst_rate: body.gstRate ?? body.taxPercent ?? 0,
//         hsn_code: body.hsnCode || null,
//         price_includes_gst: body.priceIncludesGst !== false,
//         include_in_kit: body.includeInKit !== false,
//         status: body.status,
//         visible_individually: body.visibleIndividually,
//       });

//       for (const v of variants) {
//         const [variantId] = await trx('product_variants').insert({
//           product_id: productId,
//           sku: v.sku.trim(),
//           option1_name: v.option1Name || null,
//           option1_value: v.option1Value || null,
//           option2_name: v.option2Name || null,
//           option2_value: v.option2Value || null,
//           price_override: v.priceOverride ?? null,
//           stock_qty: v.stockQty || 0,
//           low_stock_threshold: v.lowStockThreshold ?? 5,
//           barcode: v.barcode || null,
//           weight_grams: v.weightGrams ?? null,
//           image_url: v.imageUrl || null,
//           is_active: v.isActive !== false,
//         });
//         if (v.stockQty > 0) {
//           await trx('stock_movements').insert({
//             variant_id: variantId,
//             change_qty: v.stockQty,
//             reason: 'initial',
//             admin_user_id: req.admin.id,
//             note: 'Initial stock on product create',
//           });
//         }
//       }
//       return productId;
//     });

//     const row = await db('products').where({ id }).first();
//     res.status(201).json({ success: true, data: { product: mapProduct(row) } });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function updateProduct(req, res, next) {
//   try {
//     const body = productBodySchema.partial().parse(req.body);
//     const product = await db('products').where({ id: req.params.id }).first();
//     if (!product) throw new AppError('Product not found', 404);

//     await db.transaction(async (trx) => {
//       const patch = { updated_at: trx.fn.now() };
//       if (body.name !== undefined) patch.name = body.name.trim();
//       if (body.slug !== undefined) patch.slug = slugify(body.slug);
//       if (body.description !== undefined) patch.description = body.description;
//       if (body.categoryId !== undefined) patch.category_id = body.categoryId;
//       if (body.brand !== undefined) patch.brand = body.brand;
//       if (body.basePrice !== undefined) patch.base_price = body.basePrice;
//       if (body.compareAtPrice !== undefined) patch.compare_at_price = body.compareAtPrice;
//       if (body.taxPercent !== undefined) patch.tax_percent = body.taxPercent;
//       if (body.gstRate !== undefined) {
//         patch.gst_rate = body.gstRate;
//         patch.tax_percent = body.gstRate;
//       }
//       if (body.hsnCode !== undefined) patch.hsn_code = body.hsnCode;
//       if (body.priceIncludesGst !== undefined) patch.price_includes_gst = body.priceIncludesGst;
//       if (body.includeInKit !== undefined) patch.include_in_kit = body.includeInKit;
//       if (body.status !== undefined) patch.status = body.status;
//       if (body.visibleIndividually !== undefined) patch.visible_individually = body.visibleIndividually;

//       if (patch.slug) {
//         const clash = await trx('products').where({ slug: patch.slug }).whereNot({ id: product.id }).first();
//         if (clash) throw new AppError('Product slug already exists', 409);
//       }

//       await trx('products').where({ id: product.id }).update(patch);

//       if (body.variants) {
//         await assertUniqueSkus(trx, body.variants, product.id);
//         const existing = await trx('product_variants').where({ product_id: product.id });
//         const keepIds = body.variants.filter((v) => v.id).map((v) => v.id);

//         // Soft-deactivate removed variants (preserve order history FKs)
//         await trx('product_variants')
//           .where({ product_id: product.id })
//           .whereNotIn('id', keepIds.length ? keepIds : [0])
//           .update({ is_active: false, updated_at: trx.fn.now() });

//         for (const v of body.variants) {
//           if (v.id) {
//             const prev = existing.find((e) => e.id === v.id);
//             await trx('product_variants').where({ id: v.id }).update({
//               sku: v.sku.trim(),
//               option1_name: v.option1Name || null,
//               option1_value: v.option1Value || null,
//               option2_name: v.option2Name || null,
//               option2_value: v.option2Value || null,
//               price_override: v.priceOverride ?? null,
//               low_stock_threshold: v.lowStockThreshold ?? 5,
//               barcode: v.barcode || null,
//               weight_grams: v.weightGrams ?? null,
//               image_url: v.imageUrl || null,
//               is_active: v.isActive !== false,
//               updated_at: trx.fn.now(),
//             });
//             // stock changes go through inventory endpoints; only set if creating new
//             if (prev && v.stockQty !== undefined && v.stockQty !== prev.stock_qty) {
//               // ignore stock on update path — inventory owns stock mutations
//             }
//           } else {
//             const [variantId] = await trx('product_variants').insert({
//               product_id: product.id,
//               sku: v.sku.trim(),
//               option1_name: v.option1Name || null,
//               option1_value: v.option1Value || null,
//               option2_name: v.option2Name || null,
//               option2_value: v.option2Value || null,
//               price_override: v.priceOverride ?? null,
//               stock_qty: v.stockQty || 0,
//               low_stock_threshold: v.lowStockThreshold ?? 5,
//               barcode: v.barcode || null,
//               weight_grams: v.weightGrams ?? null,
//               image_url: v.imageUrl || null,
//               is_active: v.isActive !== false,
//             });
//             if (v.stockQty > 0) {
//               await trx('stock_movements').insert({
//                 variant_id: variantId,
//                 change_qty: v.stockQty,
//                 reason: 'initial',
//                 admin_user_id: req.admin.id,
//                 note: 'Initial stock on variant create',
//               });
//             }
//           }
//         }
//       }
//     });

//     const row = await db('products').where({ id: product.id }).first();
//     res.json({ success: true, data: { product: mapProduct(row) } });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function deleteProduct(req, res, next) {
//   try {
//     const product = await db('products').where({ id: req.params.id }).first();
//     if (!product) throw new AppError('Product not found', 404);
//     const used = await db('order_items').where({ product_id: product.id }).count({ c: '*' }).first();
//     if (Number(used.c) > 0) {
//       throw new AppError('Product appears on orders. Archive instead.', 400);
//     }
//     await db('products').where({ id: product.id }).del();
//     res.json({ success: true, message: 'Product deleted' });
//   } catch (err) {
//     next(err);
//   }
// }

// async function bulkStatus(req, res, next) {
//   try {
//     const schema = z.object({
//       ids: z.array(z.coerce.number().int().positive()).min(1),
//       status: z.enum(['draft', 'active', 'archived']),
//     });
//     const { ids, status } = schema.parse(req.body);
//     await db('products').whereIn('id', ids).update({ status, updated_at: db.fn.now() });
//     res.json({ success: true, message: `Updated ${ids.length} products` });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function duplicateProduct(req, res, next) {
//   try {
//     const product = await db('products').where({ id: req.params.id }).first();
//     if (!product) throw new AppError('Product not found', 404);
//     const images = await db('product_images').where({ product_id: product.id });
//     const variants = await db('product_variants').where({ product_id: product.id });

//     const newId = await db.transaction(async (trx) => {
//       let slug = `${product.slug}-copy`;
//       let n = 1;
//       while (await trx('products').where({ slug }).first()) {
//         n += 1;
//         slug = `${product.slug}-copy-${n}`;
//       }
//       const [productId] = await trx('products').insert({
//         name: `${product.name} (Copy)`,
//         slug,
//         description: product.description,
//         category_id: product.category_id,
//         brand: product.brand,
//         base_price: product.base_price,
//         compare_at_price: product.compare_at_price,
//         tax_percent: product.tax_percent,
//         gst_rate: product.gst_rate,
//         hsn_code: product.hsn_code,
//         price_includes_gst: product.price_includes_gst,
//         include_in_kit: product.include_in_kit,
//         status: 'draft',
//         visible_individually: product.visible_individually,
//       });
//       for (const img of images) {
//         await trx('product_images').insert({
//           product_id: productId,
//           url: img.url,
//           sort_order: img.sort_order,
//           is_primary: img.is_primary,
//         });
//       }
//       for (const v of variants) {
//         await trx('product_variants').insert({
//           product_id: productId,
//           sku: `${v.sku}-COPY${Date.now().toString().slice(-4)}`,
//           option1_name: v.option1_name,
//           option1_value: v.option1_value,
//           option2_name: v.option2_name,
//           option2_value: v.option2_value,
//           price_override: v.price_override,
//           stock_qty: 0,
//           low_stock_threshold: v.low_stock_threshold,
//           barcode: null,
//           weight_grams: v.weight_grams,
//           image_url: v.image_url,
//           is_active: v.is_active,
//         });
//       }
//       return productId;
//     });

//     res.status(201).json({ success: true, data: { id: newId } });
//   } catch (err) {
//     next(err);
//   }
// }

// async function uploadImages(req, res, next) {
//   try {
//     const product = await db('products').where({ id: req.params.id }).first();
//     if (!product) throw new AppError('Product not found', 404);
//     const files = req.files || [];
//     if (!files.length) throw new AppError('No files uploaded', 400);

//     const existing = await db('product_images').where({ product_id: product.id });
//     let sort = existing.length;
//     const created = [];
//     for (const file of files) {
//       const url = await storage.saveUploadedFile(file);
//       const [id] = await db('product_images').insert({
//         product_id: product.id,
//         url,
//         sort_order: sort,
//         is_primary: existing.length === 0 && sort === 0,
//       });
//       created.push({ id, url, sortOrder: sort, isPrimary: existing.length === 0 && sort === 0 });
//       sort += 1;
//     }
//     res.status(201).json({ success: true, data: { images: created } });
//   } catch (err) {
//     next(err);
//   }
// }

// async function reorderImages(req, res, next) {
//   try {
//     const schema = z.object({
//       images: z.array(
//         z.object({
//           id: z.coerce.number().int().positive(),
//           sortOrder: z.coerce.number().int().min(0),
//           isPrimary: z.boolean().optional(),
//         })
//       ),
//     });
//     const { images } = schema.parse(req.body);
//     await db.transaction(async (trx) => {
//       for (const img of images) {
//         await trx('product_images').where({ id: img.id, product_id: req.params.id }).update({
//           sort_order: img.sortOrder,
//           is_primary: img.isPrimary === true,
//           updated_at: trx.fn.now(),
//         });
//       }
//       const primary = images.find((i) => i.isPrimary);
//       if (primary) {
//         await trx('product_images')
//           .where({ product_id: req.params.id })
//           .whereNot({ id: primary.id })
//           .update({ is_primary: false });
//       }
//     });
//     res.json({ success: true, message: 'Images updated' });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function deleteImage(req, res, next) {
//   try {
//     const img = await db('product_images')
//       .where({ id: req.params.imageId, product_id: req.params.id })
//       .first();
//     if (!img) throw new AppError('Image not found', 404);
//     await db('product_images').where({ id: img.id }).del();
//     await storage.deleteByUrl(img.url);
//     res.json({ success: true, message: 'Image deleted' });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = {
//   listProducts,
//   getProduct,
//   createProduct,
//   updateProduct,
//   deleteProduct,
//   bulkStatus,
//   duplicateProduct,
//   uploadImages,
//   reorderImages,
//   deleteImage,
// };
