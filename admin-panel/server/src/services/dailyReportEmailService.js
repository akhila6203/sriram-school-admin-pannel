const db = require('../config/db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const mailer = require('./mailer');
const { PDFDocument } = require('pdf-lib');
const settingsService = require('./settingsService');
const { getOrderDocuments, invoicesPdf, packingSlipsPdf } = require('./orderDocumentsService');
dayjs.extend(utc); dayjs.extend(timezone);

async function sendDailyReport({ reportDate, to, tz = 'Asia/Kolkata' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) throw new Error('Invalid report date');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to || '')) throw new Error('Invalid admin email');
  await db('daily_report_deliveries').insert({ report_date: reportDate, recipient_email: to })
    .onConflict(['report_date','recipient_email','report_type']).ignore();
  const updated = await db('daily_report_deliveries')
    .where({report_date:reportDate,recipient_email:to,report_type:'daily_orders'})
    .where(q => q.whereIn('status',['pending','failed'])
      .orWhere(q2 => q2.where('status','sending')
        .where('claimed_at','<',db.raw('DATE_SUB(NOW(), INTERVAL 15 MINUTE)'))))
    .where('attempts','<',5)
    .update({status:'sending',claimed_at:db.fn.now(),attempts:db.raw('attempts + 1')});
  if (!updated) return false;
  try {
    const start = dayjs.tz(reportDate, tz);
    if (!start.isValid()) throw new Error('Invalid report date');
    // Current application stores order created_at in MySQL DATETIME; use local wall-clock bounds.
    const from = start.startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const toDate = start.endOf('day').format('YYYY-MM-DD HH:mm:ss');
    const { orders, docs } = await getOrderDocuments({ from, to: toDate });
    const count = orders.length;
    const quantity = docs.reduce((n,d) => n + d.items.reduce((s,i) => s + Number(i.quantity||0),0),0);
    const total = orders.reduce((n,o) => n + Number(o.total||0),0);
    const attachments = [];
    if (count) {
      const merged = await PDFDocument.create();
      for (const sourceBuffer of [await invoicesPdf(docs), await packingSlipsPdf(docs)]) {
        const source = await PDFDocument.load(sourceBuffer);
        const pages = await merged.copyPages(source, source.getPageIndices());
        for (const page of pages) merged.addPage(page);
      }
      attachments.push({filename:`Invoices-and-Packing-Slips-${reportDate}.pdf`,
        content:Buffer.from(await merged.save()),contentType:'application/pdf'});
    }
    await mailer.sendMail({
      to,
      subject:`BrassLeaf daily orders report - ${reportDate}`,
      text:`Daily report for ${reportDate} (${tz})\nSuccessful orders: ${count}\nTotal products: ${quantity}\nTotal collection: Rs. ${total.toFixed(2)}\n${count ? 'Attached: one PDF containing all invoices followed by all packing slips.' : 'No paid orders for this date.'}`,
      attachments,
    });
    await db('daily_report_deliveries').where({report_date:reportDate,recipient_email:to,report_type:'daily_orders'})
      .update({status:'sent',sent_at:db.fn.now(),last_error:null});
    return true;
  } catch (error) {
    await db('daily_report_deliveries').where({report_date:reportDate,recipient_email:to,report_type:'daily_orders'})
      .update({status:'failed',last_error:String(error.message).slice(0,2000)});
    throw error;
  }
}



async function sendDailyReportEmail(options = {}) {
  const settings = await settingsService.getSettings();

  const to = options.to ||
    settings.gst_email_to ||
    settings.contact_email;

  const tz = settings.gst_email_timezone || 'Asia/Kolkata';

  const reportDay =
    settings.gst_email_report_day || 'yesterday';

  const today = dayjs().tz(tz);

  const reportDate = options.reportDate || (
    reportDay === 'today'
      ? today.format('YYYY-MM-DD')
      : today.subtract(1, 'day').format('YYYY-MM-DD')
  );

  return sendDailyReport({
    reportDate,
    to,
    tz,
  });
}

module.exports = {
  sendDailyReport,
  sendDailyReportEmail,
};