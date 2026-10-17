const db = require('../config/db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const mailer = require('./mailer');
// const { PDFDocument } = require('pdf-lib');
const settingsService = require('./settingsService');
const { getOrderDocuments, invoicesPdf, packingSlipsPdf } = require('./orderDocumentsService');
dayjs.extend(utc); dayjs.extend(timezone);


async function sendDailyReport({
  reportDate,
  to,
  tz = "Asia/Kolkata",
  scheduleTime = "08:00",
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error("Invalid report date");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to || "")) {
    throw new Error("Invalid admin email");
  }

  const time = String(scheduleTime).trim();

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Invalid report schedule time");
  }

  // One delivery per date, recipient and scheduled time.
  const reportType = `daily_orders_${time.replace(":", "")}`;

  const deliveryKey = {
    report_date: reportDate,
    recipient_email: to,
    report_type: reportType,
  };

  await db("daily_report_deliveries")
    .insert(deliveryKey)
    .onConflict([
      "report_date",
      "recipient_email",
      "report_type",
    ])
    .ignore();

  const updated = await db("daily_report_deliveries")
    .where(deliveryKey)
    .where((q) =>
      q
        .whereIn("status", ["pending", "failed"])
        .orWhere((q2) =>
          q2
            .where("status", "sending")
            .where(
              "claimed_at",
              "<",
              db.raw(
                "DATE_SUB(NOW(), INTERVAL 15 MINUTE)"
              )
            )
        )
    )
    .where("attempts", "<", 10)
    .update({
      status: "sending",
      claimed_at: db.fn.now(),
      attempts: db.raw("attempts + 1"),
    });

  // Already sent, currently processing or max attempts reached.
  if (!updated) return false;

  try {
    const start = dayjs.tz(reportDate, tz);

    if (!start.isValid()) {
      throw new Error("Invalid report date");
    }

    const from = start
      .startOf("day")
      .format("YYYY-MM-DD HH:mm:ss");

    // For today's report, include orders up to the current time.
    const now = dayjs().tz(tz);

    const isToday =
      reportDate === now.format("YYYY-MM-DD");

    const toDate = isToday
      ? now.format("YYYY-MM-DD HH:mm:ss")
      : start.endOf("day").format("YYYY-MM-DD HH:mm:ss");

    // getOrderDocuments already filters payment_status = paid.
    const { orders, docs } = await getOrderDocuments({
      from,
      to: toDate,
    });

    const count = orders.length;

    
if (count === 0) {
  await db("daily_report_deliveries")
    .where(deliveryKey)
    .update({
      status: "sent",
      sent_at: db.fn.now(),
      last_error: null,
    });

  console.log(
    `Daily report skipped: No paid orders for ${reportDate}`
  );

  return false;
}


    const quantity = docs.reduce(
      (n, d) =>
        n +
        d.items.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0),
          0
        ),
      0
    );

    const total = orders.reduce(
      (n, order) => n + Number(order.total || 0),
      0
    );

    
const invoicePdf = await invoicesPdf(docs);
const packingPdf = await packingSlipsPdf(docs);

const attachments = [
  {
    filename: `BrassLeaf-Invoices-${reportDate}.pdf`,
    content: invoicePdf,
    contentType: "application/pdf",
  },
  {
    filename: `BrassLeaf-Packing-Slips-${reportDate}.pdf`,
    content: packingPdf,
    contentType: "application/pdf",
  },
];

    // const attachments = [];

    // if (count > 0) {
    //   const merged = await PDFDocument.create();

    //   const pdfBuffers = [
    //     await invoicesPdf(docs),
    //     await packingSlipsPdf(docs),
    //   ];

    //   for (const buffer of pdfBuffers) {
    //     const source = await PDFDocument.load(buffer);

    //     const pages = await merged.copyPages(
    //       source,
    //       source.getPageIndices()
    //     );

    //     for (const page of pages) {
    //       merged.addPage(page);
    //     }
    //   }

    //   attachments.push({
    //     filename: `BrassLeaf-Daily-Report-${reportDate}-${time.replace(":", "")}.pdf`,
    //     content: Buffer.from(await merged.save()),
    //     contentType: "application/pdf",
    //   });
    // }

    await mailer.sendMail({
      to,
      subject: `BrassLeaf Daily Orders Report - ${reportDate} (${time})`,
      text:
        `BrassLeaf Daily Orders Report\n\n` +
        `Report Date: ${reportDate}\n` +
        `Scheduled Time: ${time}\n` +
        `Timezone: ${tz}\n\n` +
        `Successful Orders: ${count}\n` +
        `Total Products: ${quantity}\n` +
        `Total Collection: Rs. ${total.toFixed(2)}\n\n` +
        (count
          ? "Invoices and packing slips are attached."
          : "No paid orders found for this period."),
      attachments,
    });

    await db("daily_report_deliveries")
      .where(deliveryKey)
      .update({
        status: "sent",
        sent_at: db.fn.now(),
        last_error: null,
      });

    return true;
  } catch (error) {
    await db("daily_report_deliveries")
      .where(deliveryKey)
      .update({
        status: "failed",
        last_error: String(error.message).slice(0, 2000),
      });

    throw error;
  }
}

async function sendDailyReportEmail(options = {}) {
  const settings = await settingsService.getSettings();

  const to =
    options.to ||
    settings.gst_email_to ||
    settings.contact_email;

  const tz =
    settings.gst_email_timezone || "Asia/Kolkata";

  const reportDay =
    settings.gst_email_report_day || "yesterday";

  const scheduleTime =
    options.scheduleTime ||
    settings.gst_email_time ||
    "08:00";

  const today = dayjs().tz(tz);

  const reportDate =
    options.reportDate ||
    (reportDay === "today"
      ? today.format("YYYY-MM-DD")
      : today
          .subtract(1, "day")
          .format("YYYY-MM-DD"));

  return sendDailyReport({
    reportDate,
    to,
    tz,
    scheduleTime,
  });
}


module.exports = {
  sendDailyReport,
  sendDailyReportEmail,
};