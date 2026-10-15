// const { z } = require('zod');
// const XLSX = require('xlsx');
// const dayjs = require('dayjs');
const { z } = require('zod');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const settingsService = require('../services/settingsService');
const mailer = require('../services/mailer');
const { invoicesPdf, packingSlipsPdf } = require('../services/gstPdf');
const {
  sendDailyReportEmail,
} = require('../services/dailyReportEmailService');


dayjs.extend(utc);
dayjs.extend(timezone);

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function rangeFromQuery(q) {
  const tz = 'Asia/Kolkata';
  const now = dayjs().tz(tz);
  let from;
  let to;
  switch (q.range) {
    case 'today':
      from = now.startOf('day');
      to = now.endOf('day');
      break;
    case 'yesterday':
      from = now.subtract(1, 'day').startOf('day');
      to = now.subtract(1, 'day').endOf('day');
      break;
    case 'select':
    case 'custom':
      from = q.from ? dayjs.tz(q.from, tz).startOf('day') : now.startOf('month');
      to = q.to ? dayjs.tz(q.to, tz).endOf('day') : now.endOf('day');
      break;
    case 'last7':
      from = now.subtract(6, 'day').startOf('day');
      to = now.endOf('day');
      break;
    case 'last30':
      from = now.subtract(29, 'day').startOf('day');
      to = now.endOf('day');
      break;
    case 'this_month':
      from = now.startOf('month');
      to = now.endOf('month');
      break;
    default:
      from = now.startOf('month');
      to = now.endOf('day');
  }
  return { from: from.format('YYYY-MM-DD HH:mm:ss'), to: to.format('YYYY-MM-DD HH:mm:ss') };
}

function applyOrderFilters(query, q, { from, to }) {
  query.whereBetween('o.created_at', [from, to]);
  if (q.studentIds && q.studentIds.length) {
    query.whereIn('o.student_id', q.studentIds);
  }
  return query;
}

async function getProfileRow() {
  let row = await db('gst_profile').orderBy('id').first();
  if (!row) {
    const [id] = await db('gst_profile').insert({
      legal_name: 'Scholar Store',
      city: 'Hyderabad',
      state: 'Telangana',
      state_code: '36',
    });
    row = await db('gst_profile').where({ id }).first();
  }
  return row;
}

async function documents(req, res, next) {
  try {
    const schema = z.object({
      range: z.string().optional().default('this_month'),
      from: z.string().optional(),
      to: z.string().optional(),
      studentIds: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    });
    const q = schema.parse(req.query);
    q.studentIds = q.studentIds
      ? q.studentIds.split(',').map((n) => Number(n)).filter(Boolean)
      : [];
    const bounds = rangeFromQuery(q);
    let query = db('orders as o')
  .join('students as s', 's.id', 'o.student_id')
  .where('o.payment_status', 'paid')
  .select('o.*', 's.student_name', 's.admission_number');
    applyOrderFilters(query, q, bounds);
    const countRow = await query.clone().clearSelect().count({ total: '*' }).first();
    const total = Number(countRow.total);
    const rows = await query
      .orderBy('o.created_at', 'desc')
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

      const statsQuery = db('orders as o')
  .where('o.payment_status', 'paid')
  .whereBetween('o.created_at', [
    bounds.from,
    bounds.to,
  ]);
    // const statsQuery = db('orders as o').whereBetween('o.created_at', [bounds.from, bounds.to]);
    if (q.studentIds.length) statsQuery.whereIn('o.student_id', q.studentIds);
    const stats = await statsQuery
      .select(
        db.raw('COALESCE(SUM(total),0) as sales'),
        db.raw("COALESCE(SUM(CASE WHEN payment_status IN ('paid','partially_refunded') THEN total ELSE 0 END),0) as collected"),
        db.raw("COALESCE(SUM(CASE WHEN payment_status IN ('refunded','partially_refunded') THEN tax ELSE 0 END),0) as refunded"),
        db.raw('COALESCE(SUM(taxable_total),0) as taxable'),
        db.raw('COALESCE(SUM(cgst_total + sgst_total + igst_total),0) as gst')
      )
      .first();

    res.json({
      success: true,
      data: {
        items: rows,
        pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) || 1 },
        stats: {
          totalSales: Number(stats.sales),
          collected: Number(stats.collected),
          refunded: Number(stats.refunded),
          taxableSubtotal: Number(stats.taxable),
          totalGst: Number(stats.gst),
          netSales: Number(stats.sales) - Number(stats.refunded),
        },
      },
    });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function summary(req, res, next) {
  try {
    const data = await summaryData();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const type =
      req.query.type === 'packing-slip'
        ? 'packing-slip'
        : 'invoice';

    const rawIds = String(req.query.orderIds || '').trim();

    const ids = [
      ...new Set(
        rawIds
          .split(',')
          .map(Number)
          .filter((n) => Number.isSafeInteger(n) && n > 0)
      ),
    ];

    // let ordersQuery = db('orders as o')
    //   .join('students as s', 's.id', 'o.student_id')
    //   .where('o.payment_status', 'paid')
    //   .select(
    //     'o.*',
    //     's.student_name',
    //     's.admission_number',
    //     's.house_color'
    //   );
  let ordersQuery = db('orders as o')
  .join('students as s', 's.id', 'o.student_id')
  .where('o.payment_status', 'paid')
  .select(
    'o.*',
    's.student_name',
    's.admission_number',
    's.house_color',
    's.class_name as class_name',
    's.phone as student_phone',
    's.email as student_email',
    's.gender as student_gender'
  );

    if (ids.length) {
      // Selected checkboxes or individual download
      ordersQuery.whereIn('o.id', ids);
    } else {
      // No checkboxes: download all paid orders
      // matching selected date range
      const q = {
        range: String(req.query.range || 'this_month'),
        from: req.query.from,
        to: req.query.to,
        studentIds: String(req.query.studentIds || '')
          .split(',')
          .map(Number)
          .filter(Boolean),
      };

      const bounds = rangeFromQuery(q);

      applyOrderFilters(ordersQuery, q, bounds);
    }

    const orders = await ordersQuery
      .orderBy('o.created_at', 'desc')
      .orderBy('o.id', 'desc');

    if (!orders.length) {
      throw new AppError(
        'No paid orders found for selected filters',
        404
      );
    }

    const profile = await getProfileRow();

    const orderIds = orders.map((o) => o.id);

    const allItems = await db('order_items')
      .whereIn('order_id', orderIds);

    const itemsByOrder = new Map();

    for (const item of allItems) {
      const key = Number(item.order_id);

      if (!itemsByOrder.has(key)) {
        itemsByOrder.set(key, []);
      }

      itemsByOrder.get(key).push(item);
    }

    const docs = orders.map((order) => ({
  profile,

  order,

  items: itemsByOrder.get(Number(order.id)) || [],

  student: {
    student_name: order.student_name,
    admission_number: order.admission_number,
    house_color: order.house_color,

    // Add actual DB fields here after confirming
    class_name: order.class_name || null,
    phone: order.student_phone || null,
    email: order.student_email || null,
    gender: order.student_gender || null,
  },
}));
    // const docs = orders.map((order) => ({
    //   profile,
    //   order,
    //   items: itemsByOrder.get(Number(order.id)) || [],
    //   student: {
    //     student_name: order.student_name,
    //     admission_number: order.admission_number,
    //     house_color: order.house_color,
    //   },
    // }));

    const output =
      type === 'invoice'
        ? await invoicesPdf(docs)
        : await packingSlipsPdf(docs);

    const filename =
      ids.length === 1
        ? `${type}-${orders[0].order_number}.pdf`
        : `${type}-${ids.length ? 'selected' : 'filtered'}-${orders.length}-orders.pdf`;

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    res.send(output);
  } catch (err) {
    next(err);
  }
}

async function exportXlsx(req, res, next) {
  try {
    const rows = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .join('students as s', 's.id', 'o.student_id')
      .select(
        'o.invoice_number',
        'o.order_number',
        'o.created_at',
        's.admission_number',
        's.student_name',
        'oi.hsn_code',
        'oi.name_snapshot',
        'oi.quantity',
        'oi.gst_rate',
        'oi.taxable_value',
        'oi.cgst',
        'oi.sgst',
        'oi.igst',
        'oi.line_total'
      );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GST');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gst-export.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const profile = await getProfileRow();
    res.json({ success: true, data: { profile } });
  } catch (err) {
    next(err);
  }
}

async function putProfile(req, res, next) {
  try {
    const schema = z.object({
      legal_name: z.string().min(1),
      gstin: z.string().regex(GSTIN_RE).or(z.literal('')).optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      state_code: z.string().max(2).optional(),
      pincode: z.string().optional(),
      email: z.string().email().or(z.literal('')).optional(),
      phone: z.string().optional(),
      logo: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);
    const existing = await getProfileRow();
    await db('gst_profile').where({ id: existing.id }).update({ ...body, updated_at: db.fn.now() });
    const profile = await db('gst_profile').where({ id: existing.id }).first();
    res.json({ success: true, data: { profile } });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function getEmailSchedule(req, res, next) {
  try {
    const s = await settingsService.getPublicSettings();
    res.json({
      success: true,
      data: {
        email: s.gst_email_to || s.contact_email || '',
        time: s.gst_email_time || '08:00',
        reportDay: s.gst_email_report_day || 'yesterday',
        timezone: s.gst_email_timezone || 'Asia/Kolkata',
        smtpConfigured: Boolean(s.smtp_host),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function putEmailSchedule(req, res, next) {
  try {
    const schema = z.object({
      gst_email_to: z.string().trim().email(),
      gst_email_time: z.string().regex(
        /^([01]\d|2[0-3]):[0-5]\d$/,
        'Time must be HH:mm'
      ),
      gst_email_report_day: z.enum([
        'today',
        'yesterday',
      ]),
      gst_email_timezone: z.string()
        .default('Asia/Kolkata'),
    });

    const body = schema.parse(req.body);

    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: body.gst_email_timezone,
      });
    } catch {
      throw new AppError('Invalid timezone', 400);
    }

    await settingsService.updateSettings(body);

    res.json({
      success: true,
      message: 'Daily email schedule saved successfully',
    });

  } catch (err) {
    next(
      err.name === 'ZodError'
        ? new AppError(
            'Validation failed',
            400,
            err.issues
          )
        : err
    );
  }
}

async function sendTestEmail(req, res, next) {
  try {
    const s = await settingsService.getSettings();

    const to =
      s.gst_email_to ||
      s.contact_email ||
      s.smtp_from_email;

    if (!to) {
      throw new AppError(
        'Please configure admin email first',
        400
      );
    }

    if (!s.smtp_host) {
      throw new AppError(
        'Please configure SMTP settings first',
        400
      );
    }

    const result = await sendDailyReportEmail({
      to,
      force: true,
      isTest: true,
    });

    res.json({
      success: true,
      message: `Daily report test email sent to ${to}`,
      data: result,
    });

  } catch (err) {
    next(err);
  }
}

async function taxMapping(req, res, next) {
  try {
    const missing = req.query.missing === 'true';
    let query = db('products as p').leftJoin('categories as c', 'c.id', 'p.category_id').select('p.*', 'c.name as category_name');
    if (missing) {
      query = query.andWhere((b) => b.whereNull('p.hsn_code').orWhere('p.hsn_code', '').orWhere('p.gst_rate', 0));
    }
    const rows = await query.orderBy('p.name');
    res.json({
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          name: r.name,
          hsnCode: r.hsn_code,
          gstRate: Number(r.gst_rate || r.tax_percent || 0),
          categoryName: r.category_name,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function bulkTax(req, res, next) {
  try {
    const schema = z.object({
      ids: z.array(z.coerce.number().int().positive()).min(1),
      hsnCode: z.string().optional(),
      gstRate: z.coerce.number().optional(),
    });
    const body = schema.parse(req.body);
    const patch = { updated_at: db.fn.now() };
    if (body.hsnCode !== undefined) patch.hsn_code = body.hsnCode;
    if (body.gstRate !== undefined) {
      patch.gst_rate = body.gstRate;
      patch.tax_percent = body.gstRate;
    }
    await db('products').whereIn('id', body.ids).update(patch);
    res.json({ success: true, message: `Updated ${body.ids.length} products` });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function patchProductTax(req, res, next) {
  try {
    const schema = z.object({
      hsnCode: z.string().nullable().optional(),
      gstRate: z.coerce.number().optional(),
    });
    const body = schema.parse(req.body);
    const patch = { updated_at: db.fn.now() };
    if (body.hsnCode !== undefined) patch.hsn_code = body.hsnCode;
    if (body.gstRate !== undefined) {
      patch.gst_rate = body.gstRate;
      patch.tax_percent = body.gstRate;
    }
    await db('products').where({ id: req.params.id }).update(patch);
    res.json({ success: true });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function rateWise(req, res, next) {
  try {
    const data = await summaryData();
    res.json({ success: true, data: { items: data.rateWise } });
  } catch (err) {
    next(err);
  }
}

async function hsnWise(req, res, next) {
  try {
    const data = await summaryData();
    res.json({ success: true, data: { items: data.hsnWise } });
  } catch (err) {
    next(err);
  }
}

async function summaryData() {
  const monthRows = await db('orders')
    .whereNotIn('status', ['cancelled'])
    .select(
      db.raw('DATE_FORMAT(created_at, "%Y-%m") as month'),
      db.raw('COALESCE(SUM(taxable_total),0) as taxable'),
      db.raw('COALESCE(SUM(cgst_total + sgst_total + igst_total),0) as gst'),
      db.raw('COALESCE(SUM(total),0) as sales')
    )
    .groupByRaw('DATE_FORMAT(created_at, "%Y-%m")')
    .orderBy('month', 'asc');

  const rateWiseRows = await db('order_items as oi')
    .join('orders as o', 'o.id', 'oi.order_id')
    .whereNotIn('o.status', ['cancelled'])
    .select('oi.gst_rate')
    .sum({ taxable: 'oi.taxable_value' })
    .sum({ cgst: 'oi.cgst' })
    .sum({ sgst: 'oi.sgst' })
    .sum({ igst: 'oi.igst' })
    .groupBy('oi.gst_rate');

  const hsnWiseRows = await db('order_items as oi')
    .join('orders as o', 'o.id', 'oi.order_id')
    .whereNotIn('o.status', ['cancelled'])
    .select('oi.hsn_code')
    .sum({ taxable: 'oi.taxable_value' })
    .sum({ qty: 'oi.quantity' })
    .sum({ cgst: 'oi.cgst' })
    .sum({ sgst: 'oi.sgst' })
    .sum({ igst: 'oi.igst' })
    .groupBy('oi.hsn_code');

  return { monthly: monthRows, rateWise: rateWiseRows, hsnWise: hsnWiseRows };
}


// ============================================
// PRODUCT GST SALES REGISTER
// ============================================

function gstRegisterDates(query) {
  const now = dayjs().tz('Asia/Kolkata');
  const year = Number(query.year) || now.year();
  const month = Number(query.month) || now.month() + 1;

  let start;
  let end;

  switch (query.period) {
    case 'today':
      start = now.startOf('day');
      end = now.endOf('day');
      break;

    case 'date':
      start = dayjs.tz(
        query.date || now.format('YYYY-MM-DD'),
        'Asia/Kolkata'
      ).startOf('day');
      end = start.endOf('day');
      break;

    case 'date_range':
      if (!query.from || !query.to) {
        throw new AppError('Select From and To dates', 400);
      }
      start = dayjs.tz(query.from, 'Asia/Kolkata').startOf('day');
      end = dayjs.tz(query.to, 'Asia/Kolkata').endOf('day');
      break;

    case 'week':
      start = now.subtract(6, 'day').startOf('day');
      end = now.endOf('day');
      break;

    case 'year':
      start = dayjs.tz(`${year}-01-01`, 'Asia/Kolkata');
      end = start.endOf('year');
      break;

    case 'month':
    default:
      start = dayjs.tz(
        `${year}-${String(month).padStart(2, '0')}-01`,
        'Asia/Kolkata'
      );
      end = start.endOf('month');
  }

  if (
    !start.isValid() ||
    !end.isValid() ||
    start.isAfter(end)
  ) {
    throw new AppError('Invalid date range', 400);
  }

  return {
    from: start.format('YYYY-MM-DD HH:mm:ss'),
    to: end.format('YYYY-MM-DD HH:mm:ss'),
  };
}

async function getGstRegisterRows(query) {
  const dates = gstRegisterDates(query);

  const rows = await db('order_items as oi')
    .join('orders as o', 'o.id', 'oi.order_id')
    .where('o.payment_status', 'paid')
    .whereBetween('o.created_at', [dates.from, dates.to])
    .select(
      'oi.id',
      'oi.order_id',
      'oi.name_snapshot',
      'oi.option_snapshot',
      'oi.sku_snapshot',
      'oi.hsn_code',
      'oi.quantity',
      'oi.unit_price',
      'oi.line_total',
      'oi.taxable_value',
      'oi.gst_rate',
      'oi.cgst',
      'oi.sgst',
      'oi.igst',
      'o.invoice_number',
      'o.order_number',
      'o.created_at',
      'o.shipping'
    )
    .orderBy('o.created_at', 'desc')
    .orderBy('oi.id', 'desc');

  const countByOrder = {};
  rows.forEach((row) => {
    countByOrder[row.order_id] =
      (countByOrder[row.order_id] || 0) + 1;
  });

  return rows.map((row) => {
    const cgst = Number(row.cgst || 0);
    const sgst = Number(row.sgst || 0);
    const igst = Number(row.igst || 0);
    const gst = cgst + sgst + igst;
    const value = Number(row.line_total || 0);
    const quantity = Number(row.quantity || 0);
    const shipping = Number(row.shipping || 0);

    // Shipping is an order-level charge.
    // Allocate it across product rows without duplicating it.
    const itemCount = countByOrder[row.order_id] || 1;
    const orderRows = rows.filter(
      (item) => item.order_id === row.order_id
    );
    const rowIndex = orderRows.findIndex(
      (item) => item.id === row.id
    );

    const baseShare =
      Math.round((shipping / itemCount) * 100) / 100;

    const allocatedShipping =
      rowIndex === itemCount - 1
        ? Number(
            (
              shipping -
              baseShare * (itemCount - 1)
            ).toFixed(2)
          )
        : baseShare;

    return {
      ...row,
      product_name: [
        row.name_snapshot,
        row.option_snapshot,
      ].filter(Boolean).join(' - '),
      quantity,
      rate: Number(row.unit_price || 0),
      value,
      taxable: Number(row.taxable_value || 0),
      gst,
      sgst_percent: igst > 0 ? 0 : Number(row.gst_rate || 0) / 2,
      cgst_percent: igst > 0 ? 0 : Number(row.gst_rate || 0) / 2,
      igst_percent: igst > 0 ? Number(row.gst_rate || 0) : 0,
      cgst,
      sgst,
      igst,
      shipping_amount: allocatedShipping,
      total_with_shipping: Number(
        (value + allocatedShipping).toFixed(2)
      ),
    };
  });
}

async function gstRegister(req, res, next) {
  try {
    const rows = await getGstRegisterRows(req.query);

    const monthNames = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const {
  period = "month",
  year,
  month,
  date,
  from,
  to,
} = req.query;

const now = dayjs().tz("Asia/Kolkata");

let periodLabel = "GST Sales Register";

if (period === "month") {
  const selectedYear = Number(year) || now.year();
  const selectedMonth = Number(month) || now.month() + 1;

  periodLabel += ` - ${monthNames[selectedMonth - 1]} ${selectedYear}`;
} else if (period === "year") {
  periodLabel += ` - Year ${Number(year) || now.year()}`;
} else if (period === "date") {
  periodLabel += ` - ${date || now.format("YYYY-MM-DD")}`;
} else if (period === "date_range") {
  periodLabel += ` - ${from} to ${to}`;
} else if (period === "today") {
  periodLabel += ` - ${now.format("DD/MM/YYYY")}`;
} else if (period === "week") {
  periodLabel += " - This Week";
}

    res.json({
      success: true,
      data: {
        items: rows,
        total: rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function gstRegisterExport(req, res, next) {
  try {
    const rows = await getGstRegisterRows(req.query);

    
    // Excel sheet heading based on selected period
    const monthNames = [
      "January", "February", "March", "April",
      "May", "June", "July", "August",
      "September", "October", "November", "December",
    ];

    const {
      period = "month",
      year,
      month,
      date,
      from,
      to,
    } = req.query;

    const now = dayjs().tz("Asia/Kolkata");

    let periodLabel = "GST Sales Register";

    if (period === "month") {
      const selectedYear = Number(year) || now.year();
      const selectedMonth = Number(month) || now.month() + 1;

      periodLabel += ` - ${monthNames[selectedMonth - 1]} ${selectedYear}`;
    } else if (period === "year") {
      periodLabel += ` - Year ${Number(year) || now.year()}`;
    } else if (period === "date") {
      periodLabel += ` - ${date || now.format("YYYY-MM-DD")}`;
    } else if (period === "date_range") {
      periodLabel += ` - ${from} to ${to}`;
    } else if (period === "today") {
      periodLabel += ` - ${now.format("DD/MM/YYYY")}`;
    } else if (period === "week") {
      periodLabel += " - This Week";
    }


    const search = String(req.query.search || '')
      .trim()
      .toLowerCase();

    let filtered = search
      ? rows.filter((row) =>
          [
            row.product_name,
            row.sku_snapshot,
            row.hsn_code,
            row.invoice_number,
            row.order_number,
          ].some((value) =>
            String(value || '').toLowerCase().includes(search)
          )
        )
      : rows;

    const sort = String(req.query.sort || 'newest');

    const sorters = {
      newest: (a, b) =>
        new Date(b.created_at) - new Date(a.created_at),
      oldest: (a, b) =>
        new Date(a.created_at) - new Date(b.created_at),
      invoice: (a, b) =>
        String(a.invoice_number || '').localeCompare(
          String(b.invoice_number || ''),
          undefined,
          { numeric: true }
        ),
      order: (a, b) =>
        String(a.order_number || '').localeCompare(
          String(b.order_number || ''),
          undefined,
          { numeric: true }
        ),
      product: (a, b) =>
        a.product_name.localeCompare(b.product_name),
      highest_value: (a, b) => b.value - a.value,
      lowest_value: (a, b) => a.value - b.value,
      highest_gst: (a, b) => b.gst - a.gst,
      lowest_gst: (a, b) => a.gst - b.gst,
    };

    filtered = [...filtered].sort(
      sorters[sort] || sorters.newest
    );


    // ==========================================
    // GST EXCEL ROWS
    // ==========================================
    const excelRows = filtered.map((r, index) => ({
      'S.No': index + 1,
      'Date': dayjs(r.created_at).format('DD/MM/YYYY'),
      'Invoice Number': r.invoice_number || '',
      'Order Number': r.order_number || '',
      'Product Name / Size': r.product_name,
      'Product SKU': r.sku_snapshot || '',
      'Quantity': Number(r.quantity || 0),
      'Rate': Number(r.rate || 0),
      'Value': Number(r.value || 0),
      'Tax': Number(r.gst || 0),
      'Taxable Value': Number(r.taxable || 0),
      'SGST %': Number(r.sgst_percent || 0),
      'CGST %': Number(r.cgst_percent || 0),
      'IGST %': Number(r.igst_percent || 0),
      'SGST Amount': Number(r.sgst || 0),
      'CGST Amount': Number(r.cgst || 0),
      'IGST Amount': Number(r.igst || 0),
      'Total GST': Number(r.gst || 0),
      'Shipping Amount': Number(r.shipping_amount || 0),
      'Net Value': Number(
        (
          Number(r.taxable || 0) +
          Number(r.gst || 0) +
          Number(r.shipping_amount || 0)
        ).toFixed(2)
      ),
      'Total With Shipping': Number(r.total_with_shipping || 0),
    }));

    const headers = [
      'S.No',
      'Date',
      'Invoice Number',
      'Order Number',
      'Product Name / Size',
      'Product SKU',
      'Quantity',
      'Rate',
      'Value',
      'Tax',
      'Taxable Value',
      'SGST %',
      'CGST %',
      'IGST %',
      'SGST Amount',
      'CGST Amount',
      'IGST Amount',
      'Total GST',
      'Shipping Amount',
      'Net Value',
      'Total With Shipping',
    ];

    // ==========================================
    // CREATE WORKBOOK
    // ==========================================
    const workbook = new ExcelJS.Workbook();

    const worksheet = workbook.addWorksheet(
      'GST Sales Register'
    );

    worksheet.columns = headers.map((header) => ({
  key: header,
  width:
    header === 'Product Name / Size' ? 34 :
    header === 'Invoice Number' ? 26 :
    header === 'Order Number' ? 24 :
    header === 'Product SKU' ? 20 :
    header === 'Date' ? 16 :
    header === 'S.No' ? 10 : 19,
}));

// Row 1 = GST title
// Row 2 = empty space
// Row 3 = column headings
// worksheet.getRow(3).values = [
//   undefined,
//   ...headers,
// ];
const headingRow = worksheet.getRow(3);

headers.forEach((header, index) => {
  headingRow.getCell(index + 1).value = header;
});

    // ==========================================
    // TITLE ROW
    // ==========================================
    worksheet.mergeCells(1, 1, 1, headers.length);

    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = periodLabel;

    titleCell.font = {
      bold: true,
      size: 16,
      color: { argb: 'FF3730A3' },
    };

    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEDEBFF' },
    };

    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      indent: 1,
    };

    worksheet.getRow(1).height = 40;
    worksheet.getRow(2).height = 12;

    // ==========================================
    // COLUMN HEADER STYLING
    // ==========================================
    const headerRow = worksheet.getRow(3);

    headerRow.height = 38;

    headerRow.eachCell((cell) => {
      cell.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E7FF' },
};

cell.font = {
  bold: true,
  color: { argb: 'FF3730A3' },
  size: 11,
};

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
  top: { style: 'thin', color: { argb: 'FF4338CA' } },
  bottom: { style: 'thin', color: { argb: 'FF4338CA' } },
  left: { style: 'thin', color: { argb: 'FF818CF8' } },
  right: { style: 'thin', color: { argb: 'FF818CF8' } },
};
    });

    // ==========================================
    // ADD DATA ROWS
    // ==========================================
    const currencyColumns = new Set([
      'Rate',
      'Value',
      'Tax',
      'Taxable Value',
      'SGST Amount',
      'CGST Amount',
      'IGST Amount',
      'Total GST',
      'Shipping Amount',
      'Net Value',
      'Total With Shipping',
    ]);

    excelRows.forEach((item, index) => {
      const row = worksheet.addRow(item);

      row.height = 27;

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: index % 2 === 0
              ? 'FFFFFFFF'
              : 'FFF5F7FF',
          },
        };

        row.eachCell({ includeEmpty: true }, (cell) => {
  cell.border = {
    top: {
      style: 'thin',
      color: { argb: 'FFD1D5DB' },
    },
    bottom: {
      style: 'thin',
      color: { argb: 'FFD1D5DB' },
    },
    left: {
      style: 'thin',
      color: { argb: 'FFD1D5DB' },
    },
    right: {
      style: 'thin',
      color: { argb: 'FFD1D5DB' },
    },
  };
});

        cell.font = {
          size: 10,
          color: { argb: 'FF1E293B' },
        };

        cell.alignment = {
          vertical: 'middle',
          wrapText: true,
        };

        cell.border = {
          bottom: {
            style: 'hair',
            color: { argb: 'FFE2E8F0' },
          },
        };

        if (currencyColumns.has(headers[col - 1])) {
          cell.numFmt = '"₹"#,##0.00';
        }
      });
    });

    // Freeze headings while scrolling
    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 3,
      },
    ];

    // ==========================================
    // DOWNLOAD EXCEL
    // ==========================================
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const filePeriod = periodLabel
      .replace('GST Sales Register', '')
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gst-sales-register-${filePeriod || 'report'}.xlsx"`
    );

    res.send(Buffer.from(buffer));
} catch (error) {
  console.error('GST Excel Export Error:', error);
  next(error);
}
  // } catch (error) {
  //   next(error);
  // }
}


async function reportsExcelExport(req, res, next) {
  try {
    const rawIds = String(req.query.orderIds || "").trim();

    const ids = [
      ...new Set(
        rawIds
          .split(",")
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && id > 0)
      ),
    ];

    const range = String(req.query.range || "this_month");
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");

    const query = db("orders as o")
      .join("students as s", "s.id", "o.student_id")
      .where("o.payment_status", "paid")
      .select(
        "o.*",
        "s.student_name",
        "s.admission_number"
      );

    if (ids.length > 0) {
      query.whereIn("o.id", ids);
    } else {
      const q = {
        range,
        from,
        to,
        studentIds: String(req.query.studentIds || "")
          .split(",")
          .map(Number)
          .filter(Boolean),
      };

      const bounds = rangeFromQuery(q);
      applyOrderFilters(query, q, bounds);
    }

    const orders = await query
      .orderBy("o.created_at", "desc")
      .orderBy("o.id", "desc");

    if (!orders.length) {
      throw new AppError(
        "No paid orders found for selected filters",
        404
      );
    }

    // ==========================================
    // DYNAMIC REPORT HEADING
    // ==========================================

    const formatDate = (value) => {
      if (!value) return "";
      const parsed = dayjs(value);
      return parsed.isValid()
        ? parsed.format("DD/MM/YYYY")
        : value;
    };

    const today = dayjs().tz("Asia/Kolkata");

    let reportHeading = "Sales Reports";

    if (ids.length > 0) {
      reportHeading =
        `Sales Reports - Selected Orders (${orders.length})`;
    } else {
      switch (range) {
        case "today":
          reportHeading =
            `Sales Reports - Today (${today.format("DD/MM/YYYY")})`;
          break;

        case "yesterday":
          reportHeading =
            `Sales Reports - Yesterday (${today.subtract(1, "day").format("DD/MM/YYYY")})`;
          break;

        case "last7":
          reportHeading = "Sales Reports - Last 7 Days";
          break;

        case "last30":
          reportHeading = "Sales Reports - Last 30 Days";
          break;

        case "this_month":
          reportHeading =
            `Sales Reports - ${today.format("MMMM YYYY")}`;
          break;

        case "custom":
        case "select": {
          const bounds = rangeFromQuery({
            range,
            from,
            to,
          });

          reportHeading =
            `Sales Reports - ${formatDate(bounds.from)} to ${formatDate(bounds.to)}`;
          break;
        }

        default:
          reportHeading = "Sales Reports";
      }
    }

    // ==========================================
    // CREATE EXCEL WORKBOOK
    // ==========================================

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Scholar Store";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(
      "Sales Reports"
    );

    const columns = [
      { header: "S.No", key: "sno", width: 10 },
      { header: "Order Number", key: "order", width: 23 },
      { header: "Invoice Number", key: "invoice", width: 26 },
      { header: "Packing Slip Number", key: "slip", width: 27 },
      { header: "Student (Admission No)", key: "student", width: 34 },
      { header: "Net Value", key: "net", width: 18 },
      { header: "GST", key: "gst", width: 15 },
      { header: "Shipping", key: "shipping", width: 17 },
      { header: "Total", key: "total", width: 17 },
      { header: "Order Date", key: "date", width: 19 },
    ];

    worksheet.columns = columns.map(({ key, width }) => ({
      key,
      width,
    }));

    // ==========================================
    // ROW 1 - MAIN HEADING
    // ==========================================

    worksheet.mergeCells("A1:J1");

    const titleCell = worksheet.getCell("A1");

    titleCell.value = reportHeading;

    titleCell.font = {
      name: "Calibri",
      size: 16,
      bold: true,
      color: { argb: "FF3730A3" },
    };

    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEF2FF" },
    };

    titleCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1,
    };

    worksheet.getRow(1).height = 42;

    // Blank row between title and table
    worksheet.getRow(2).height = 12;

    // ==========================================
    // ROW 3 - COLUMN HEADINGS
    // ==========================================

    const headerRow = worksheet.getRow(3);

    columns.forEach((column, index) => {
      headerRow.getCell(index + 1).value =
        column.header;
    });

    headerRow.height = 36;

    headerRow.eachCell(
      { includeEmpty: true },
      (cell) => {
        cell.font = {
          name: "Calibri",
          size: 11,
          bold: true,
          color: { argb: "FF3730A3" },
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E7FF" },
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };

        cell.border = {
          top: {
            style: "thin",
            color: { argb: "FFC7D2FE" },
          },
          bottom: {
            style: "thin",
            color: { argb: "FFC7D2FE" },
          },
          left: {
            style: "thin",
            color: { argb: "FFC7D2FE" },
          },
          right: {
            style: "thin",
            color: { argb: "FFC7D2FE" },
          },
        };
      }
    );

    // ==========================================
    // DATA ROWS - START FROM ROW 4
    // ==========================================

    orders.forEach((order, index) => {
      const total = Number(order.total || 0);

      const gst =
        Number(order.cgst_total || 0) +
        Number(order.sgst_total || 0) +
        Number(order.igst_total || 0);

      const shipping = Number(order.shipping || 0);

      // Net value excludes GST and shipping
      const net = Number(
        (total - gst - shipping).toFixed(2)
      );

      const row = worksheet.addRow({
        sno: index + 1,
        order: order.order_number || "",
        invoice: order.invoice_number || "",
        slip: order.packing_slip_number || "",
        student:
          `${order.student_name || ""} (${order.admission_number || ""})`,
        net,
        gst,
        shipping,
        total,
        date: order.created_at
          ? dayjs(order.created_at).format("DD/MM/YYYY")
          : "",
      });

      row.height = 28;

      row.eachCell(
        { includeEmpty: true },
        (cell, col) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb:
                index % 2 === 0
                  ? "FFFFFFFF"
                  : "FFF5F7FF",
            },
          };

          cell.border = {
            top: {
              style: "thin",
              color: { argb: "FFD1D5DB" },
            },
            bottom: {
              style: "thin",
              color: { argb: "FFD1D5DB" },
            },
            left: {
              style: "thin",
              color: { argb: "FFD1D5DB" },
            },
            right: {
              style: "thin",
              color: { argb: "FFD1D5DB" },
            },
          };

          cell.alignment = {
            vertical: "middle",
            horizontal:
              col === 1 || col >= 6
                ? "center"
                : "left",
          };

          if (col >= 6 && col <= 9) {
            cell.numFmt = '"₹"#,##0.00';
          }
        }
      );
    });

    // ==========================================
    // FREEZE HEADER AND ENABLE FILTER
    // ==========================================

    worksheet.views = [
      {
        state: "frozen",
        ySplit: 3,
      },
    ];

    worksheet.autoFilter = {
      from: "A3",
      to: "J3",
    };

    // ==========================================
    // DOWNLOAD EXCEL
    // ==========================================

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reports-sales.xlsx"'
    );

    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error(
      "Reports Excel Export Error:",
      error
    );

    next(error);
  }
}



module.exports = {
  documents,
  summary,
  reportsExcelExport,
  rateWise,
  hsnWise,
  download,
  exportXlsx,
   gstRegister,
  getProfile,
  putProfile,
  getEmailSchedule,
  putEmailSchedule,
  sendTestEmail,
  taxMapping,
  bulkTax,
  patchProductTax,
  rangeFromQuery,
  getProfileRow,
  gstRegister,
gstRegisterExport,
};
