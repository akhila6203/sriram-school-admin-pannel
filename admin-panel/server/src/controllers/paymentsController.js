const { z } = require('zod');
const XLSX = require('xlsx');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const paytmService = require('../services/paytmService');
const stockService = require('../services/stock');
const { assignInvoiceIfNeeded } = require('../utils/invoiceNumber');
const {
  sendOrderConfirmationEmail,
} = require('../services/orderEmailService');

async function listPayments(req, res, next) {
  try {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional().default(''),
      status: z.string().optional().default(''),
    });
    const q = schema.parse(req.query);
    let query = db('payment_transactions as t')
  .join('orders as o', 'o.id', 't.order_id')
  .whereIn("t.status", [
  "pending",
  "success",
])
  // .whereIn('t.status', [
  //   'initiated',
  //   'pending',
  //   'success',
  // ])
  .whereIn('o.payment_status', [
    'pending',
    'paid',
  ])
  .select('t.*', 'o.order_number');
  //  let query = db('payment_transactions as t')
  // .join('orders as o', 'o.id', 't.order_id')
  // .where('t.status', 'success')
  // .where('o.payment_status', 'paid')
  // .select('t.*', 'o.order_number');
    if (q.search) {
      const s = `%${q.search}%`;
      query = query.andWhere((b) =>
        b
          .where('o.order_number', 'like', s)
          .orWhere('t.paytm_order_id', 'like', s)
          .orWhere('t.txn_id', 'like', s)
      );
    }
    if (q.status) query = query.andWhere('t.status', q.status);
    const countRow = await query.clone().clearSelect().count({ total: '*' }).first();
    const total = Number(countRow.total);
    const rows = await query
      .orderBy('t.created_at', 'desc')
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);
    res.json({
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          orderId: r.order_id,
          orderNumber: r.order_number,
          paytmOrderId: r.paytm_order_id,
          txnId: r.txn_id,
          bankTxnId: r.bank_txn_id,
          // status: r.status,
          status:
  r.status === 'success'
    ? 'success'
    : 'pending',
          amount: Number(r.amount),
          paymentMode: r.payment_mode,
          respMsg: r.resp_msg,
          createdAt: r.created_at,
        })),
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

async function paymentSummary(req, res, next) {
  try {
    const summary = await db('payment_transactions as t')
      .join('orders as o', 'o.id', 't.order_id')
      .where('t.status', 'success')
      .where('o.payment_status', 'paid')
      .select(
        db.raw('COUNT(*) AS totalTransactions'),
        db.raw('COALESCE(SUM(t.amount), 0) AS totalCollection')
      )
      .first();

    const itemSummary = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('o.payment_status', 'paid')
      .whereExists(function () {
        this.select(db.raw('1'))
          .from('payment_transactions as t')
          .whereRaw('t.order_id = o.id')
          .where('t.status', 'success');
      })
      .select(
        db.raw('COALESCE(SUM(oi.quantity), 0) AS totalItems')
      )
      .first();

    const totalTransactions =
      Number(summary?.totalTransactions || 0);

      // const attemptSummary = await db('payment_transactions')
      const attemptSummary = await db("payment_transactions")
  .whereIn("status", ["pending", "success"])
  .select(
    db.raw('COUNT(*) AS total'),
    db.raw(`
      SUM(
        CASE WHEN status = 'success' THEN 1 ELSE 0 END
      ) AS successful
    `),
    db.raw(`
      SUM(
        CASE WHEN status IN ('pending', 'initiated') THEN 1 ELSE 0 END
      ) AS pending
    `),
    db.raw(`
      SUM(
        CASE WHEN status = 'failed' THEN 1 ELSE 0 END
      ) AS failed
    `)
  )
  .first();

    res.json({
      success: true,
      data: {
  totalTransactions:
  Number(attemptSummary?.successful || 0) +
  Number(attemptSummary?.pending || 0),
  successful: Number(attemptSummary?.successful || 0),
  pending: Number(attemptSummary?.pending || 0),
  failed: Number(attemptSummary?.failed || 0),
  totalItems: Number(itemSummary?.totalItems || 0),
  totalCollection: Number(summary?.totalCollection || 0),
},
      // data: {
      //   totalTransactions,
      //   successful: totalTransactions,
      //   totalItems: Number(itemSummary?.totalItems || 0),
      //   totalCollection: Number(summary?.totalCollection || 0),
      // },
    });
  } catch (error) {
    next(error);
  }
}

async function exportPayments(req, res, next) {
  try {
    const rows = await db('payment_transactions as t')
      .join('orders as o', 'o.id', 't.order_id')
      .select('t.*', 'o.order_number')
      .orderBy('t.created_at', 'desc');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
}

function resultPaid(statusJson) {
  const info = statusJson?.body?.resultInfo || {};
  const txn = String(statusJson?.body?.txnStatus || statusJson?.body?.STATUS || '').toUpperCase();
  return info.resultStatus === 'TXN_SUCCESS' || txn === 'TXN_SUCCESS';
}

async function applyPaidResult(trx, order, statusJson, paytmOrderId) {
  const body = statusJson.body || {};
  const txnId = body.txnId || body.TXNID;
  let existingQuery = trx('payment_transactions').where({ paytm_order_id: paytmOrderId });
  if (txnId) {
    existingQuery = trx('payment_transactions').where(function matchTxn() {
      this.where({ paytm_order_id: paytmOrderId }).orWhere({ txn_id: txnId });
    });
  }
  const existing = await existingQuery.first();
  if (existing && existing.status === 'success') {
    return { idempotent: true };
  }

  if (existing) {
    await trx('payment_transactions').where({ id: existing.id }).update({
      status: 'success',
      txn_id: txnId || existing.txn_id,
      bank_txn_id: body.bankTxnId || body.BANKTXNID || existing.bank_txn_id,
      payment_mode: body.paymentMode || body.PAYMENTMODE,
      resp_code: body.resultInfo?.resultCode,
      resp_msg: body.resultInfo?.resultMsg,
      raw_response: JSON.stringify(statusJson),
      updated_at: trx.fn.now(),
    });
  } else {
    await trx('payment_transactions').insert({
      order_id: order.id,
      paytm_order_id: paytmOrderId,
      txn_id: txnId,
      bank_txn_id: body.bankTxnId || body.BANKTXNID,
      status: 'success',
      amount: order.total,
      currency: 'INR',
      payment_mode: body.paymentMode,
      gateway_name: 'paytm',
      resp_code: body.resultInfo?.resultCode,
      resp_msg: body.resultInfo?.resultMsg,
      raw_response: JSON.stringify(statusJson),
    });
  }

  if (order.stock_state === 'reserved') {
    const items = await trx('order_items').where({ order_id: order.id });
    for (const item of items) {
      await stockService.finalizeReserved(trx, {
        variantId: item.variant_id,
        quantity: item.quantity,
        orderId: order.id,
        note: 'Paytm paid — finalize',
      });
    }
  }

  // await assignInvoiceIfNeeded(trx, order);
  // await trx('orders').where({ id: order.id }).update({
  //   payment_status: 'paid',
  //   status: order.status === 'placed' ? 'confirmed' : order.status,
  //   stock_state: 'finalized',
  //   paytm_order_id: paytmOrderId,
  //   updated_at: trx.fn.now(),
  // });
    await assignInvoiceIfNeeded(trx, order);

  await trx("orders")
    .where({ id: order.id })
    .update({
      payment_status: "paid",
      status:
        order.status === "placed"
          ? "confirmed"
          : order.status,
      stock_state: "finalized",
      paytm_order_id: paytmOrderId,
      updated_at: trx.fn.now(),
    });

  // Remove only the purchased quantities from the
  // Update kit status only after successful kit payment.
if (order.type === "kit") {
  await trx("students")
    .where({ id: order.student_id })
    .update({
      kit_status: "ordered",
      updated_at: trx.fn.now(),
    });
}
  // student's cart after verified successful payment.
  const studentCart = await trx("carts")
    .where({ student_id: order.student_id })
    .first();

  if (studentCart) {
    const purchasedItems = await trx("order_items")
      .where({ order_id: order.id });

    for (const purchased of purchasedItems) {
      
let matchingQuery = trx("cart_items")
  .where({
    cart_id: studentCart.id,
    product_id: purchased.product_id,
  });

if (purchased.variant_id == null) {
  matchingQuery = matchingQuery.whereNull("variant_id");
} else {
  matchingQuery = matchingQuery.where(
    "variant_id",
    purchased.variant_id
  );
}

const matchingCartItems = await matchingQuery
  .orderBy("id", "asc")
  .forUpdate();


      let remaining = Number(purchased.quantity);

      for (const cartItem of matchingCartItems) {
        if (remaining <= 0) break;

        const cartQuantity = Number(cartItem.quantity);

        if (cartQuantity <= remaining) {
          await trx("cart_items")
            .where({ id: cartItem.id })
            .del();

          remaining -= cartQuantity;
        } else {
          await trx("cart_items")
            .where({ id: cartItem.id })
            .update({
              quantity: cartQuantity - remaining,
            });

          remaining = 0;
        }
      }
    }
  }
  if (order.status === 'placed') {
    await trx('order_status_history').insert({
      order_id: order.id,
      status: 'confirmed',
      changed_by: 'paytm',
      note: 'Payment confirmed',
    });
  }
  return { idempotent: false };
}

async function applyFailed(trx, order, paytmOrderId, msg) {
  if (['paid', 'refunded', 'partially_refunded'].includes(order.payment_status)) return;
  if (order.stock_state === 'reserved') {
    const items = await trx('order_items').where({ order_id: order.id });
    for (const item of items) {
      await stockService.releaseReserved(trx, {
        variantId: item.variant_id,
        quantity: item.quantity,
        orderId: order.id,
        note: 'Paytm failed/expired — release',
      });
    }
  }
  await trx('orders').where({ id: order.id }).update({
    payment_status: 'failed',
    stock_state: 'released',
    updated_at: trx.fn.now(),
  });
  await trx('payment_transactions')
    .where({ paytm_order_id: paytmOrderId, order_id: order.id })
    .update({
      status: 'failed',
      resp_msg: msg || 'failed',
      updated_at: trx.fn.now(),
    });
}

async function recheckStatus(req, res, next) {
  try {
    const order = await db('orders')
      .where({ id: req.params.id })
      .first();

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const paytmOrderId = order.paytm_order_id;

    if (!paytmOrderId) {
      throw new AppError('No Paytm order id', 400);
    }

    // Verify actual payment status from Paytm
    const statusJson = await paytmService.getStatus(paytmOrderId);

    let newlyPaid = false;

    await db.transaction(async (trx) => {
      const fresh = await trx('orders')
        .where({ id: order.id })
        .forUpdate()
        .first();

      if (resultPaid(statusJson)) {
        const body = statusJson?.body || {};

        if (
          String(body.orderId) !== String(paytmOrderId)
        ) {
          throw new AppError(
            'Paytm order ID mismatch',
            400
          );
        }

        if (
          !Number.isFinite(Number(body.txnAmount)) ||
          Math.abs(
            Number(body.txnAmount) -
            Number(fresh.total)
          ) > 0.001
        ) {
          throw new AppError(
            'Paytm amount mismatch',
            400
          );
        }

        const result = await applyPaidResult(
          trx,
          fresh,
          statusJson,
          paytmOrderId
        );

        newlyPaid = !result.idempotent;
      }
    });

    // Email must be sent only AFTER transaction commits.
    // Do not make SMTP calls inside the database transaction.
    if (newlyPaid) {
      try {
        await sendOrderConfirmationEmail(order.id);
      } catch (emailError) {
        console.error(
          'Order confirmation email error:',
          emailError
        );
      }
    }

    res.json({
      success: true,
      data: {
        statusJson: {
          resultInfo: statusJson?.body?.resultInfo,
        },
      },
    });

  } catch (err) {
    next(err);
  }
}



async function refundOrder(req, res, next) {
  try {
    const schema = z.object({
      amount: z.coerce.number().positive(),
      reason: z.string().min(1),
    });
    const body = schema.parse(req.body);
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) throw new AppError('Order not found', 404);
    const txn = await db('payment_transactions')
      .where({ order_id: order.id, status: 'success' })
      .orderBy('id', 'desc')
      .first();
    if (!txn || !txn.txn_id) throw new AppError('No successful Paytm transaction', 400);
    const refId = `REF-${order.id}-${Date.now()}`;
    const result = await paytmService.refund({
      orderId: txn.paytm_order_id,
      txnId: txn.txn_id,
      amount: body.amount,
      refId,
    });
    await db('payment_refunds').insert({
      transaction_id: txn.id,
      refund_id: result?.applied?.body?.refundId || result?.body?.refundId || refId,
      amount: body.amount,
      status: result?.body?.resultInfo?.resultStatus || 'pending',
      reason: body.reason,
      admin_user_id: req.admin.id,
    });
    const full = Number(body.amount) >= Number(order.total) - 0.01;
    await db('orders').where({ id: order.id }).update({
      payment_status: full ? 'refunded' : 'partially_refunded',
      updated_at: db.fn.now(),
    });
    if (['cancelled', 'returned'].includes(order.status) && order.stock_state === 'finalized') {
      await db.transaction(async (trx) => {
        const items = await trx('order_items').where({ order_id: order.id });
        for (const item of items) {
          await stockService.changeStock(trx, {
            variantId: item.variant_id,
            changeQty: item.quantity,
            reason: order.status === 'cancelled' ? 'cancel' : 'return',
            orderId: order.id,
            adminUserId: req.admin.id,
            note: 'Restock after refund',
          });
        }
      });
    }
    res.json({ success: true, message: 'Refund submitted' });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

module.exports = {
  listPayments,
   paymentSummary,
  exportPayments,
  recheckStatus,
  refundOrder,
  applyPaidResult,
  applyFailed,
  resultPaid,
};
