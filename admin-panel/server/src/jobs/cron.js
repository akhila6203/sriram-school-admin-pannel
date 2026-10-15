const cron = require('node-cron');
const db = require('../config/db');
const settingsService = require('../services/settingsService');
const mailer = require('../services/mailer');
const paymentsController = require('../controllers/paymentsController');
const {
  sendDailyReportEmail,
} = require('../services/dailyReportEmailService');


async function expirePendingPaytm() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const pending = await db('orders')
    .where({ payment_method: 'paytm', payment_status: 'pending' })
    .where('created_at', '<', cutoff);
  for (const order of pending) {
    await db.transaction(async (trx) => {
      const locked = await trx('orders').where({ id: order.id }).forUpdate().first();
      if (!locked || locked.payment_status !== 'pending') return;
      await paymentsController.applyFailed(trx, locked, locked.paytm_order_id, 'Expired unpaid (>30 min)');
    });
  }
}

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
