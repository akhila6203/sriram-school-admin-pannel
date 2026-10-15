const { z } = require('zod');
const XLSX = require('xlsx');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const stockService = require('../services/stock');
const { assignInvoiceIfNeeded } = require('../utils/invoiceNumber');

function mapOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    studentId: row.student_id,
    admissionNumber: row.admission_number,
    studentName: row.student_name,
    houseColor: row.house_color,
    type: row.type,
    status: row.status,

    paymentStatus: row.payment_status,
    gatewayStatus:
  row.gateway_status ||
  (row.payment_status === 'paid' ? 'success' : 'pending'),

    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    shipping: Number(row.shipping),
    total: Number(row.total),
    addressSnapshot: typeof row.address_snapshot === 'string'
      ? JSON.parse(row.address_snapshot)
      : row.address_snapshot,
    notes: row.notes,
    itemCount: Number(row.item_count || 0),
    phone: row.phone || null,
    email: row.email || null,
    txnId: row.txn_id || null,
    invoiceNumber: row.invoice_number || null,
    trackingNumber: row.tracking_number || '',
    courier: row.courier || '',
    trackingUrl: row.tracking_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function counts(req, res, next) {
  try {
    const rows = await db('orders')
    .whereIn('payment_status', [
  'pending',
  'paid',
  'partially_refunded',
  'refunded',
])
  .select('status')
  .count({ c: '*' })
  .groupBy('status');
  //   const rows = await db('orders')
  // .where('payment_status', 'paid')
  // .select('status')
  // .count({ c: '*' })
  // .groupBy('status');
    // const rows = await db('orders').select('status').count({ c: '*' }).groupBy('status');
    const map = {
      placed: 0,
      confirmed: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };
    rows.forEach((r) => {
      map[r.status] = Number(r.c);
    });
    res.json({ success: true, data: { counts: map } });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional().default(''),
      status: z.string().optional().default(''),
      type: z.enum(['', 'kit', 'individual']).optional().default(''),
      paymentStatus: z.string().optional().default(''),
      houseColor: z.string().optional().default(''),
      from: z.string().optional().default(''),
      to: z.string().optional().default(''),
    });
    const q = schema.parse(req.query);

    let query = db('orders as o')
      .join('students as s', 's.id', 'o.student_id')
      .leftJoin('order_items as oi', 'oi.order_id', 'o.id')
      .select(
        'o.*',
        's.admission_number',
        's.student_name',
        's.house_color',
        's.phone',
        db.raw('COUNT(oi.id) as item_count'),
        db.raw(
  '(SELECT t.txn_id FROM payment_transactions t WHERE t.order_id = o.id ORDER BY t.id DESC LIMIT 1) as txn_id'
),
db.raw(`
  (SELECT t.status
   FROM payment_transactions t
   WHERE t.order_id = o.id
   ORDER BY t.id DESC
   LIMIT 1) as gateway_status
`)
        // db.raw('(SELECT t.txn_id FROM payment_transactions t WHERE t.order_id = o.id ORDER BY t.id DESC LIMIT 1) as txn_id')
      )
      .groupBy('o.id', 's.admission_number', 's.student_name', 's.house_color', 's.phone');

      // query = query.where("o.payment_status", "paid");
      query = query.whereIn('o.payment_status', [
  'pending',
  'paid',
  'partially_refunded',
  'refunded',
]);
      
    if (q.search) {
      const s = `%${q.search}%`;
      query = query.andWhere((b) =>
        b
          .where('o.order_number', 'like', s)
          .orWhere('s.admission_number', 'like', s)
          .orWhere('s.student_name', 'like', s)
      );
    }
    if (q.status) query = query.andWhere('o.status', q.status);
    if (q.type) query = query.andWhere('o.type', q.type);
    if (q.paymentStatus) query = query.andWhere('o.payment_status', q.paymentStatus);
    if (q.houseColor) query = query.andWhere('s.house_color', q.houseColor);
    if (q.from) query = query.andWhere('o.created_at', '>=', q.from);
    if (q.to) query = query.andWhere('o.created_at', '<=', `${q.to} 23:59:59`);

    const idRows = await query.clone().clearSelect().select('o.id');
    const total = idRows.length;
    const rows = await query
      .orderBy('o.created_at', 'desc')
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

    res.json({
      success: true,
      data: {
        items: rows.map(mapOrder),
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

async function getOrder(req, res, next) {
  try {
    const row = await db('orders as o')
      .join('students as s', 's.id', 'o.student_id')
      .select('o.*', 's.admission_number', 's.student_name', 's.house_color', 's.phone')
      .where('o.id', req.params.id)
      .first();
    if (!row) throw new AppError('Order not found', 404);

    const items = await db('order_items').where({ order_id: row.id });
    const history = await db('order_status_history')
      .where({ order_id: row.id })
      .orderBy('created_at', 'asc');
    let payment = null;
    try {
      const p = await db('payment_transactions').where({ order_id: row.id }).orderBy('id', 'desc').first();
      if (p) {
        payment = {
          paytmOrderId: p.paytm_order_id,
          txnId: p.txn_id,
          bankTxnId: p.bank_txn_id,
          status: p.status,
          paymentMode: p.payment_mode,
          respMsg: p.resp_msg,
          amount: Number(p.amount),
        };
      }
    } catch {
      payment = null;
    }

    res.json({
      success: true,
      data: {
        order: mapOrder(row),
        studentPhone: row.phone,
        items: items.map((i) => ({
          id: i.id,
          productId: i.product_id,
          variantId: i.variant_id,
          nameSnapshot: i.name_snapshot,
          skuSnapshot: i.sku_snapshot,
          optionSnapshot: i.option_snapshot,
          unitPrice: Number(i.unit_price),
          quantity: i.quantity,
          lineTotal: Number(i.line_total),
          hsnCode: i.hsn_code,
          gstRate: i.gst_rate != null ? Number(i.gst_rate) : null,
        })),
        payment,
        history: history.map((h) => ({
          id: h.id,
          status: h.status,
          changedBy: h.changed_by,
          note: h.note,
          createdAt: h.created_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const schema = z.object({
      status: z.enum([
        'placed',
        'confirmed',
        'packed',
        'shipped',
        'delivered',
        'cancelled',
        'returned',
      ]),
      note: z.string().optional().default(''),
    });
    const body = schema.parse(req.body);
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) throw new AppError('Order not found', 404);

    await db.transaction(async (trx) => {
      if (
        (body.status === 'cancelled' || body.status === 'returned') &&
        !['cancelled', 'returned'].includes(order.status)
      ) {
        const items = await trx('order_items').where({ order_id: order.id });
        await stockService.restockOrderItems(trx, {
          order,
          items,
          reason: body.status === 'cancelled' ? 'cancel' : 'return',
          adminUserId: req.admin.id,
          note: body.note || `Order ${body.status}`,
        });
      }

      if (body.status === 'confirmed') {
        await assignInvoiceIfNeeded(trx, order);
      }

      await trx('orders').where({ id: order.id }).update({
        status: body.status,
        stock_state:
          body.status === 'cancelled' || body.status === 'returned'
            ? order.stock_state === 'reserved'
              ? 'released'
              : order.stock_state
            : order.stock_state,
        updated_at: trx.fn.now(),
      });
      await trx('order_status_history').insert({
        order_id: order.id,
        status: body.status,
        changed_by: req.admin.email,
        note: body.note || null,
      });
    });

    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function updatePayment(req, res, next) {
  try {
    const schema = z.object({
      paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']),
    });
    const { paymentStatus } = schema.parse(req.body);
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) throw new AppError('Order not found', 404);
    await db('orders').where({ id: order.id }).update({
      payment_status: paymentStatus,
      updated_at: db.fn.now(),
    });
    res.json({ success: true, message: 'Payment updated' });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function bulkStatus(req, res, next) {
  try {
    const schema = z.object({
      ids: z.array(z.coerce.number().int().positive()).min(1),
      status: z.enum([
        'placed',
        'confirmed',
        'packed',
        'shipped',
        'delivered',
        'cancelled',
        'returned',
      ]),
      note: z.string().optional().default(''),
    });
    const body = schema.parse(req.body);
    await db.transaction(async (trx) => {
      for (const id of body.ids) {
        const order = await trx('orders').where({ id }).first();
        if (!order) continue;
        if (
          (body.status === 'cancelled' || body.status === 'returned') &&
          !['cancelled', 'returned'].includes(order.status)
        ) {
          const items = await trx('order_items').where({ order_id: id });
          await stockService.restockOrderItems(trx, {
            order,
            items,
            reason: body.status === 'cancelled' ? 'cancel' : 'return',
            adminUserId: req.admin.id,
            note: body.note || `Bulk ${body.status}`,
          });
        }
        await trx('orders').where({ id }).update({ status: body.status, updated_at: trx.fn.now() });
        await trx('order_status_history').insert({
          order_id: id,
          status: body.status,
          changed_by: req.admin.email,
          note: body.note || 'Bulk update',
        });
      }
    });
    res.json({ success: true, message: 'Bulk status updated' });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function exportOrders(req, res, next) {
  try {
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    const rows = await db('orders as o')
      .join('students as s', 's.id', 'o.student_id')
      .select(
        'o.order_number',
        's.admission_number',
        's.student_name',
        's.house_color',
        'o.type',
        'o.status',
        'o.payment_status',
        'o.total',
        'o.created_at'
      )
      .orderBy('o.created_at', 'desc');

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="orders.xlsx"');
      return res.send(buf);
    }

    const header = Object.keys(rows[0] || { order_number: '' });
    const lines = [header.join(',')];
    rows.forEach((r) => {
      lines.push(header.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    return res.send(lines.join('\n'));
  } catch (err) {
    return next(err);
  }
}

async function pickList(req, res, next) {
  try {
    const schema = z.object({
      ids: z.array(z.coerce.number().int().positive()).min(1),
    });
    const { ids } = schema.parse(req.body);
    const items = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .whereIn('o.id', ids)
      .select('oi.sku_snapshot', 'oi.option_snapshot', 'oi.quantity', 'oi.name_snapshot');

    const grouped = {};
    items.forEach((i) => {
      const key = `${i.sku_snapshot}||${i.option_snapshot || ''}`;
      if (!grouped[key]) {
        grouped[key] = {
          sku: i.sku_snapshot,
          options: i.option_snapshot,
          name: i.name_snapshot,
          quantity: 0,
        };
      }
      grouped[key].quantity += i.quantity;
    });

    res.json({ success: true, data: { lines: Object.values(grouped) } });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function updateShipping(req, res, next) {
  try {
    const schema = z.object({
      trackingNumber: z.string().optional().default(''),
      courier: z.string().optional().default(''),
      trackingUrl: z.string().optional().default(''),
    });
    const body = schema.parse(req.body);
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) throw new AppError('Order not found', 404);
    await db('orders').where({ id: order.id }).update({
      tracking_number: body.trackingNumber || null,
      courier: body.courier || null,
      tracking_url: body.trackingUrl || null,
      updated_at: db.fn.now(),
    });
    res.json({ success: true, message: 'Shipping saved' });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

module.exports = {
  listOrders,
  counts,
  getOrder,
  updateStatus,
  updatePayment,
  updateShipping,
  bulkStatus,
  exportOrders,
  pickList,
};
