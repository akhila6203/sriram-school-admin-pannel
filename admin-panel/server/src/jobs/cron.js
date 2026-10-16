const cron = require('node-cron');
const db = require('../config/db');
const settingsService = require('../services/settingsService');
const mailer = require('../services/mailer');
const paymentsController = require('../controllers/paymentsController');
const {
  sendDailyReportEmail,
} = require('../services/dailyReportEmailService');
const paytmService = require("../services/paytmService");

const {
  sendOrderConfirmationEmail,
} = require("../services/orderEmailService");

async function expirePendingPaytm() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  const orders = await db("orders")
    .where({
      payment_method: "paytm",
      payment_status: "pending",
    })
    .whereNotNull("paytm_order_id")
    .where("created_at", "<", cutoff)
    .orderBy("created_at", "asc")
    .limit(100);

  for (const order of orders) {
    try {
      // First verify with Paytm. Never expire blindly.
      const statusJson = await paytmService.getStatus(
        order.paytm_order_id
      );

      const body = statusJson?.body || {};
      const resultStatus =
        body?.resultInfo?.resultStatus;

      const isPaid =
        paymentsController.resultPaid(statusJson);

      // Only a verified success may finalize payment.
      if (isPaid) {
        if (
          String(body.orderId) !==
          String(order.paytm_order_id)
        ) {
          throw new Error("Paytm order ID mismatch");
        }

        if (
          !Number.isFinite(Number(body.txnAmount)) ||
          Math.abs(
            Number(body.txnAmount) -
            Number(order.total)
          ) > 0.001
        ) {
          throw new Error("Paytm amount mismatch");
        }

        let newlyPaid = false;

        await db.transaction(async (trx) => {
          const locked = await trx("orders")
            .where({ id: order.id })
            .forUpdate()
            .first();

          if (
            !locked ||
            locked.payment_status !== "pending" ||
            locked.paytm_order_id !==
              order.paytm_order_id
          ) {
            return;
          }

          const result =
            await paymentsController.applyPaidResult(
              trx,
              locked,
              statusJson,
              order.paytm_order_id
            );

          newlyPaid = !result.idempotent;
        });

        if (newlyPaid) {
          try {
            await sendOrderConfirmationEmail(order.id);
          } catch (emailError) {
            console.error(
              `Order ${order.id} email failed:`,
              emailError.message
            );
          }
        }

        continue;
      }

      // Only explicit gateway failure releases stock.
      if (resultStatus === "TXN_FAILURE") {
        await db.transaction(async (trx) => {
          const locked = await trx("orders")
            .where({ id: order.id })
            .forUpdate()
            .first();

          if (
            !locked ||
            locked.payment_status !== "pending" ||
            locked.paytm_order_id !==
              order.paytm_order_id
          ) {
            return;
          }

          await paymentsController.applyFailed(
            trx,
            locked,
            order.paytm_order_id,
            body?.resultInfo?.resultMsg ||
              "Paytm confirmed payment failure"
          );
        });

        continue;
      }

      // PENDING, unknown, gateway timeout, etc.
      // Do not release stock or mark failed.
      console.log(
        `Order ${order.order_number}: Paytm status ` +
        `${resultStatus || "unknown"}, retry later`
      );
    } catch (error) {
      console.error(
        `Paytm recovery ${order.order_number}:`,
        error.message
      );
    }
  }
}
// async function expirePendingPaytm() {
//   const cutoff = new Date(Date.now() - 30 * 60 * 1000);
//   const pending = await db('orders')
//     .where({ payment_method: 'paytm', payment_status: 'pending' })
//     .where('created_at', '<', cutoff);
//   for (const order of pending) {
//     await db.transaction(async (trx) => {
//       const locked = await trx('orders').where({ id: order.id }).forUpdate().first();
//       if (!locked || locked.payment_status !== 'pending') return;
//       await paymentsController.applyFailed(trx, locked, locked.paytm_order_id, 'Expired unpaid (>30 min)');
//     });
//   }
// }

async function sendGstDailyReport() {
  return sendDailyReportEmail();
}

function startJobs() {
  cron.schedule('*/10 * * * *', () => {
    expirePendingPaytm().catch((err) => console.error('Paytm expiry job:', err.message));
  });
  cron.schedule('* * * * *', async () => {
  try {
    const s = await settingsService.getSettings();

    const time = s.gst_email_time || '08:00';
    const timezone =
      s.gst_email_timezone || 'Asia/Kolkata';

    const now = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());

    if (now === time) {
      await sendGstDailyReport();
    }
  } catch (err) {
    console.error(
      'GST daily email job:',
      err.message
    );
  }
});
}

module.exports = { startJobs, expirePendingPaytm, sendGstDailyReport };
