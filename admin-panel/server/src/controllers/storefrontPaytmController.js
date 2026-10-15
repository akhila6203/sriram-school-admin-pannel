const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const paytmService = require('../services/paytmService');
const paymentsController = require('./paymentsController');
const storefrontController = require('./storefrontController');
const {
  sendOrderConfirmationEmail,
} = require('../services/orderEmailService');

async function sendConfirmationSafely(orderId) {
  try {
    await sendOrderConfirmationEmail(orderId);
  } catch (error) {
    console.error(
      `Order ${orderId} confirmation email failed:`,
      error.message
    );
  }
}

async function initiate(req, res, next) {
  try {
    const schema = z.object({
      orderId: z.coerce.number().int().positive().optional(),
      orderNumber: z.string().optional(),
      admissionNumber: z.string().optional(),
      type: z.enum(['kit', 'individual']).optional(),
      items: z.array(z.any()).optional(),
      notes: z.string().optional(),
    });
    const body = schema.parse(req.body);
    let order;
    if (body.orderId || body.orderNumber) {
      order = body.orderId
        ? await db('orders').where({ id: body.orderId }).first()
        : await db('orders').where({ order_number: body.orderNumber }).first();
    } else {
      req.body.paymentMethod = 'paytm';
      const fakeRes = {
        statusCode: 201,
        payload: null,
        status(c) {
          this.statusCode = c;
          return this;
        },
        json(p) {
          this.payload = p;
        },
      };
      await storefrontController.placeOrder(req, fakeRes, (err) => {
        if (err) throw err;
      });
      if (!fakeRes.payload?.data?.order) {
        throw new AppError(fakeRes.payload?.message || 'Could not create order', fakeRes.statusCode || 400);
      }
      order = await db('orders').where({ id: fakeRes.payload.data.order.id }).first();
    }
    if (!order) throw new AppError('Order not found', 404);

    if (Number(order.student_id) !== Number(req.student.id)) {
  throw new AppError("Access denied", 403);
}

if (order.payment_status === "failed") {
  throw new AppError(
    "This order has failed. Please start a new order.",
    409
  );
}

    if (order.payment_status === 'paid') throw new AppError('Order already paid', 400);

    const student = await db('students').where({ id: order.student_id }).first();
    const init = await paytmService.initiateTransaction({
      orderNumber: order.order_number,
      total: order.total,
      admissionNumber: student?.admission_number,
      studentId: student?.id,
    });
    await db('orders').where({ id: order.id }).update({
      paytm_order_id: init.orderId,
      payment_method: 'paytm',
      updated_at: db.fn.now(),
    });
    await db('payment_transactions').insert({
      order_id: order.id,
      paytm_order_id: init.orderId,
      status: 'initiated',
      amount: order.total,
      currency: 'INR',
      gateway_name: 'paytm',
    });
    res.json({
      success: true,
      data: {
        txnToken: init.txnToken,
        mid: init.mid,
        orderId: init.orderId,
        amount: init.amount,
        orderNumber: order.order_number,
        host: init.host,
      },
    });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function callback(req, res, next) {
  try {
    const params = req.body || {};

    const verified = await paytmService.verifyCallback(params);

    const paytmOrderId = params.ORDERID;

    if (!paytmOrderId) {
      throw new AppError("Missing Paytm Order ID", 400);
    }

    const order = await db("orders")
      .where({
        paytm_order_id: paytmOrderId,
      })
      .first();

    if (!order) {
      throw new AppError(
        "Order not found for Paytm transaction",
        404
      );
    }
if (paymentsController.resultPaid(verified.statusJson)) {
  const gatewayBody = verified.statusJson?.body || {};

  if (
    String(gatewayBody.orderId) !==
    String(order.paytm_order_id)
  ) {
    throw new AppError("Paytm order ID mismatch", 400);
  }

  if (
    !Number.isFinite(Number(gatewayBody.txnAmount)) ||
    Math.abs(
      Number(gatewayBody.txnAmount) -
      Number(order.total)
    ) > 0.001
  ) {
    throw new AppError("Paytm amount mismatch", 400);
  }
}

let newlyPaid = false;

await db.transaction(async (trx) => {
  const locked = await trx("orders")
    .where({ id: order.id })
    .forUpdate()
    .first();

  if (paymentsController.resultPaid(verified.statusJson)) {
    const result =
      await paymentsController.applyPaidResult(
        trx,
        locked,
        verified.statusJson,
        paytmOrderId
      );

    newlyPaid = !result.idempotent;
  } else {
    const gatewayStatus =
      verified.statusJson?.body?.resultInfo?.resultStatus;

    if (gatewayStatus === "TXN_FAILURE") {
      await paymentsController.applyFailed(
        trx,
        locked,
        paytmOrderId,
        verified.statusJson?.body?.resultInfo?.resultMsg
      );
    }
  }
});

// Database transaction completed successfully.
// Send email outside transaction.
if (newlyPaid) {
  await sendConfirmationSafely(order.id);
}
    // await db.transaction(async (trx) => {
    //   const locked = await trx("orders")
    //     .where({ id: order.id })
    //     .forUpdate()
    //     .first();

    //   if (paymentsController.resultPaid(verified.statusJson)) {
    //     await paymentsController.applyPaidResult(
    //       trx,
    //       locked,
    //       verified.statusJson,
    //       paytmOrderId
    //     );
    //   } else {
    //     const gatewayStatus =
    //       verified.statusJson?.body?.resultInfo?.resultStatus;

    //     // Do not mark pending payments as failed.
    //     // if (gatewayStatus === "F") {
    //     if (gatewayStatus === "TXN_FAILURE") {
    //       await paymentsController.applyFailed(
    //         trx,
    //         locked,
    //         paytmOrderId,
    //         verified.statusJson?.body?.resultInfo?.resultMsg
    //       );
    //     }
    //   }
    // });

    return res.json({
      success: true,
      message: "Paytm callback processed",
    });
  } catch (err) {
    next(err);
  }
}

async function status(req, res, next) {
  try {
    let order = await db("orders")
      .where({
        order_number: req.params.orderNumber,
      })
      .first();

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (Number(order.student_id) !== Number(req.student.id)) {
      throw new AppError("Access denied", 403);
    }

    // Already paid orders need no further gateway request.
    if (
      order.payment_status === "pending" &&
      order.paytm_order_id
    ) {
      const gatewayResponse = await paytmService.getStatus(
        order.paytm_order_id
      );

      const gatewayBody = gatewayResponse?.body || {};
      const resultStatus =
        gatewayBody?.resultInfo?.resultStatus;

      if (resultStatus === "TXN_SUCCESS") {
  if (
    String(gatewayBody.orderId) !==
    String(order.paytm_order_id)
  ) {
    throw new AppError("Paytm order ID mismatch", 400);
  }

  if (
    !Number.isFinite(Number(gatewayBody.txnAmount)) ||
    Math.abs(
      Number(gatewayBody.txnAmount) -
      Number(order.total)
    ) > 0.001
  ) {
    throw new AppError("Paytm payment amount mismatch", 400);
  }

  let newlyPaid = false;

  await db.transaction(async (trx) => {
    const lockedOrder = await trx("orders")
      .where({ id: order.id })
      .forUpdate()
      .first();

    if (lockedOrder.payment_status === "pending") {
      const result =
        await paymentsController.applyPaidResult(
          trx,
          lockedOrder,
          gatewayResponse,
          order.paytm_order_id
        );

      newlyPaid = !result.idempotent;
    }
  });

  if (newlyPaid) {
    await sendConfirmationSafely(order.id);
  }

} else if (resultStatus === "TXN_FAILURE") {
  await db.transaction(async (trx) => {
    const lockedOrder = await trx("orders")
      .where({ id: order.id })
      .forUpdate()
      .first();

    if (lockedOrder.payment_status === "pending") {
      await paymentsController.applyFailed(
        trx,
        lockedOrder,
        order.paytm_order_id,
        gatewayBody?.resultInfo?.resultMsg ||
          "Payment failed"
      );
    }
  });

}
    }

    // Return latest database status after verification.
    order = await db("orders")
      .where({ id: order.id })
      .first();

    return res.json({
      success: true,
      data: {
        orderNumber: order.order_number,
        paymentStatus: order.payment_status,
        status: order.status,
        total: Number(order.total),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiate, callback, status };
