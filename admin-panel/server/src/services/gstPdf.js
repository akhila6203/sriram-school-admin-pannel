
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const { round2 } = require("../utils/gst");

const LOGO_PATH = path.join(
  __dirname,
  "../../assets/brassleaf-logo.jpeg"
);
const LEFT = 45;
const RIGHT = 550;
const PAGE_WIDTH = RIGHT - LEFT;

const money = (value) =>
  `Rs. ${Number(value || 0).toFixed(2)}`;

const clean = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
};

function dateText(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function parseAddr(order) {
  try {
    return typeof order.address_snapshot === "string"
      ? JSON.parse(order.address_snapshot)
      : order.address_snapshot || {};
  } catch {
    return {};
  }
}

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.end();
  });
}

// ============================================
// LOGO AND BRASSLEAF ADDRESS
// ============================================

function header(doc, profile, title) {
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, LEFT, 42, {
      fit: [165, 90],
    });
  }

  const x = 330;

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#111827")
    .text("BrassLeaf", x, 42, {
      width: 220,
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#111827");

  [
    "6-3-666/B, Pillar No. #1118",
    "Erramanzil Road, Panjagutta,",
    "Hyderabad - 500082",
    "Opp Nims Hospital",
    "GSTIN: 36AACFB1506E1Z5",
  ].forEach((line, index) => {
    doc.text(line, x, 65 + index * 15, {
      width: 220,
    });
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor("#111827")
    .text(title, LEFT, 165, {
      width: PAGE_WIDTH,
    });
}

// ============================================
// CUSTOMER DETAILS - LEFT SIDE
// ============================================

function customerDetails(doc, order, student, startY) {
  const addr = parseAddr(order);

  const address = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.state,
    addr.zipcode,
  ]
    .filter(Boolean)
    .join(", ");

  const fields = [
    ["Name", student?.student_name || order.student_name],
    [
      "Admission Number",
      student?.admission_number || order.admission_number,
    ],
    ["Address", address],
    ["Class", student?.class_name || student?.class],
    [
      "Mobile Number",
      addr.phone ||
        addr.mobile ||
        student?.phone ||
        student?.mobile,
    ],
    [
      "Email Address",
      student?.email || order.student_email,
    ],
    ["Gender", student?.gender],
  ];

  let y = startY;

  fields.forEach(([label, value]) => {
    const displayValue = clean(value);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111827")
      .text(`${label}:`, LEFT, y, {
        width: 112,
        lineBreak: false,
      });

    doc.font("Helvetica").fontSize(9);

    const height = doc.heightOfString(displayValue, {
      width: 155,
    });

    doc.text(displayValue, 158, y, {
      width: 155,
    });

    y += Math.max(23, height + 7);
  });

  return y;
}

// ============================================
// INVOICE / ORDER DETAILS - RIGHT SIDE
// ============================================

function orderDetails(doc, order, type, startY) {
  const invoice = type === "invoice";

  const fields = invoice
    ? [
        ["Invoice Number", order.invoice_number],
        [
          "Invoice Date",
          dateText(order.invoice_date || order.created_at),
        ],
        ["Order Number", order.order_number],
        ["Order Date", dateText(order.created_at)],
        [
          "Payment Method",
          order.payment_method || "—",
        ],
      ]
    : [
        ["Order Number", order.order_number],
        ["Order Date", dateText(order.created_at)],
        [
          "Shipping Method",
          order.shipping_method || "Standard",
        ],
      ];

  let y = startY;

  fields.forEach(([label, value]) => {
    const displayValue = clean(value);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111827")
      .text(`${label}:`, 330, y, {
        width: 112,
        lineBreak: false,
      });

    doc.font("Helvetica").fontSize(9);

    const height = doc.heightOfString(displayValue, {
      width: 108,
    });

    doc.text(displayValue, 442, y, {
      width: 108,
    });

    y += Math.max(25, height + 7);
  });

  return y;
}

// ============================================
// PRODUCT TABLE
// ============================================

function productTable(doc, items, startY, isInvoice) {
  let y = startY;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#111827");

  doc.text("Product", LEFT, y, {
    width: 300,
  });

  doc.text("Quantity", 365, y, {
    width: 80,
    align: "center",
  });

  if (isInvoice) {
    doc.text("Price", 460, y, {
      width: 90,
      align: "right",
    });
  }

  y += 24;

  doc
    .moveTo(LEFT, y)
    .lineTo(RIGHT, y)
    .strokeColor("#9ca3af")
    .lineWidth(0.8)
    .stroke();

  y += 15;

  items.forEach((item) => {
    if (y > 710) {
      doc.addPage();
      y = 55;
    }

    const productName = clean(item.name_snapshot);

    const size = item.option_snapshot
      ? String(item.option_snapshot)
      : "";

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#111827");

    const nameHeight = doc.heightOfString(productName, {
      width: 285,
    });

    doc.text(productName, LEFT, y, {
      width: 285,
    });

    let rowHeight = Math.max(25, nameHeight + 8);

    if (size) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text(`Size: ${size}`, LEFT, y + nameHeight + 3, {
          width: 285,
        });

      rowHeight += 15;
    }

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#111827")
      .text(clean(item.quantity), 365, y, {
        width: 80,
        align: "center",
      });

    if (isInvoice) {
      const price =
        item.line_total !== undefined &&
        item.line_total !== null
          ? item.line_total
          : Number(item.unit_price || 0) *
            Number(item.quantity || 0);

      doc.text(money(price), 460, y, {
        width: 90,
        align: "right",
      });
    }

    y += rowHeight + 12;

    doc
      .moveTo(LEFT, y)
      .lineTo(RIGHT, y)
      .strokeColor("#e5e7eb")
      .lineWidth(0.6)
      .stroke();

    y += 15;
  });

  return y;
}

// ============================================
// INVOICE TOTALS
// ============================================

function drawTotals(doc, order, startY) {
  let y = startY + 12;

  const total = Number(order.total || 0);
  const shipping = Number(order.shipping || 0);

  const cgst = Number(order.cgst_total || 0);
  const sgst = Number(order.sgst_total || 0);
  const igst = Number(order.igst_total || 0);

  const gst = round2(cgst + sgst + igst);

  // GST is already included in the item prices.
  const subtotal = round2(total - shipping);

  const gstLabel =
    igst > 0
      ? "GST (Included IGST)"
      : "GST (Included CGST & SGST)";

  const rows = [
    ["Subtotal", money(subtotal)],
    ["Shipping", money(shipping)],
    [gstLabel, money(gst)],
  ];

  rows.forEach(([label, value]) => {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#111827")
      .text(label, 315, y, {
        width: 180,
      });

    doc.text(value, 495, y, {
      width: 55,
      align: "right",
    });

    y += 26;
  });

  y += 7;

  doc
    .moveTo(315, y)
    .lineTo(RIGHT, y)
    .strokeColor("#9ca3af")
    .stroke();

  y += 18;

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111827")
    .text("Total Paid", 315, y, {
      width: 125,
    });

  doc.text(money(total), 445, y, {
    width: 105,
    align: "right",
  });

  return y + 45;
}

// ============================================
// BOTTOM NOTE
// ============================================

function footer(doc, startY) {
  const y = Math.min(Math.max(startY + 30, 660), 770);

  doc
    .moveTo(LEFT, y)
    .lineTo(RIGHT, y)
    .strokeColor("#d1d5db")
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#374151")
    .text(
      "Note: Any exchanges should be done at the BrassLeaf, Punjagutta store only",
      LEFT,
      y + 12,
      {
        width: PAGE_WIDTH,
        align: "center",
      }
    );
}

// ============================================
// INVOICE
// ============================================

function drawInvoice(doc, payload) {
  const { profile, order, items, student } = payload;

  header(doc, profile, "INVOICE");

  const customerEnd = customerDetails(
    doc,
    order,
    student,
    220
  );

  const orderEnd = orderDetails(
    doc,
    order,
    "invoice",
    220
  );

  const tableStart = Math.max(
    customerEnd,
    orderEnd
  ) + 30;

  const tableEnd = productTable(
    doc,
    items,
    tableStart,
    true
  );

  const totalsEnd = drawTotals(
    doc,
    order,
    tableEnd
  );

  footer(doc, totalsEnd);
}

// ============================================
// PACKING SLIP
// ============================================

function drawPackingSlip(doc, payload) {
  const { profile, order, items, student } = payload;

  header(doc, profile, "PACKING SLIP");

  const customerEnd = customerDetails(
    doc,
    order,
    student,
    220
  );

  const orderEnd = orderDetails(
    doc,
    order,
    "packing",
    220
  );

  const tableStart = Math.max(
    customerEnd,
    orderEnd
  ) + 30;

  const tableEnd = productTable(
    doc,
    items,
    tableStart,
    false
  );

  footer(doc, tableEnd);
}

// ============================================
// PDF EXPORTS
// ============================================

async function invoicesPdf(docs) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    autoFirstPage: true,
  });

  docs.forEach((payload, index) => {
    if (index > 0) {
      doc.addPage();
    }

    drawInvoice(doc, payload);
  });

  return collect(doc);
}

async function packingSlipsPdf(docs) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    autoFirstPage: true,
  });

  docs.forEach((payload, index) => {
    if (index > 0) {
      doc.addPage();
    }

    drawPackingSlip(doc, payload);
  });

  return collect(doc);
}

async function invoicePdf(payload) {
  return invoicesPdf([payload]);
}

async function packingSlipPdf(payload) {
  return packingSlipsPdf([payload]);
}

module.exports = {
  invoicePdf,
  packingSlipPdf,
  invoicesPdf,
  packingSlipsPdf,
};




// const PDFDocument = require('pdfkit');
// const { amountInWords, round2 } = require('../utils/gst');

// function collect(doc) {
//   return new Promise((resolve, reject) => {
//     const chunks = [];
//     doc.on('data', (c) => chunks.push(c));
//     doc.on('end', () => resolve(Buffer.concat(chunks)));
//     doc.on('error', reject);
//     doc.end();
//   });
// }

// function header(doc, profile, title) {
//   doc.fontSize(16).fillColor('#0f172a').text(profile.legal_name || 'Scholar Store', { align: 'left' });
//   doc.fontSize(9).fillColor('#334155');
//   if (profile.gstin) doc.text(`GSTIN: ${profile.gstin}`);
//   doc.text([profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', '));
//   if (profile.phone || profile.email) doc.text([profile.phone, profile.email].filter(Boolean).join(' · '));
//   doc.moveDown(0.5).fillColor('#0f172a').fontSize(14).text(title, { align: 'center' });
//   doc.moveDown(0.5);
// }

// function parseAddr(order) {
//   const addr = typeof order.address_snapshot === 'string'
//     ? JSON.parse(order.address_snapshot)
//     : order.address_snapshot || {};
//   return addr;
// }

// function drawInvoice(doc, { profile, order, items, student }) {
//   header(doc, profile, 'GST TAX INVOICE');
//   doc.fontSize(10).fillColor('#0f172a');
//   doc.text(`Invoice No: ${order.invoice_number || '—'}`);
//   doc.text(`Invoice Date: ${order.invoice_date || order.created_at || ''}`);
//   doc.text(`Order: ${order.order_number}`);
//   doc.moveDown(0.5);
//   const addr = parseAddr(order);
//   doc.text('Bill To / Ship To');
//   doc.text(`${student?.student_name || order.student_name || ''} (${student?.admission_number || ''})`);
//   doc.text([addr.address1, addr.address2, addr.city, addr.state, addr.zipcode].filter(Boolean).join(', '));
//   doc.moveDown(0.5);

//   doc.fontSize(8);
//   const y = doc.y;
//   doc.text('HSN', 40, y);
//   doc.text('Item', 90, y);
//   doc.text('Qty', 280, y);
//   doc.text('Rate', 310, y);
//   doc.text('Taxable', 350, y);
//   doc.text('CGST', 400, y);
//   doc.text('SGST', 440, y);
//   doc.text('IGST', 480, y);
//   doc.moveTo(40, y + 12).lineTo(555, y + 12).stroke();
//   doc.y = y + 16;

//   items.forEach((i) => {
//     const yy = doc.y;
//     doc.text(i.hsn_code || '—', 40, yy, { width: 45 });
//     doc.text(i.name_snapshot || '', 90, yy, { width: 170 });
//     doc.text(String(i.quantity), 280, yy);
//     doc.text(String(round2(i.unit_price)), 310, yy);
//     doc.text(String(round2(i.taxable_value || 0)), 350, yy);
//     doc.text(String(round2(i.cgst || 0)), 400, yy);
//     doc.text(String(round2(i.sgst || 0)), 440, yy);
//     doc.text(String(round2(i.igst || 0)), 480, yy);
//     doc.y = yy + 16;
//   });

//   doc.moveDown(0.5);
//   doc.fontSize(10);
//   doc.text(`Taxable: ₹${round2(order.taxable_total || 0)}`);
//   doc.text(`CGST: ₹${round2(order.cgst_total || 0)}  SGST: ₹${round2(order.sgst_total || 0)}  IGST: ₹${round2(order.igst_total || 0)}`);
//   doc.fontSize(12).text(`Total: ₹${round2(order.total)}`);
//   doc.fontSize(9).text(`Amount in words: ${amountInWords(order.total)}`);
// }

// function drawPackingSlip(doc, { profile, order, items, student }) {
//   header(doc, profile, 'PACKING SLIP');
//   doc.fontSize(10).fillColor('#0f172a');
//   doc.text(`Packing slip: ${order.packing_slip_number || '—'}`);
//   doc.text(`Order: ${order.order_number}`);
//   const addr = parseAddr(order);
//   doc.moveDown(0.5);
//   doc.text(`${student?.student_name || ''} (${student?.admission_number || ''}) · ${student?.house_color || ''}`);
//   doc.text([addr.address1, addr.address2, addr.city, addr.state, addr.zipcode].filter(Boolean).join(', '));
//   doc.moveDown();
//   items.forEach((i) => {
//     doc.text(`${i.sku_snapshot}  ${i.name_snapshot}  ${i.option_snapshot || ''}  ×${i.quantity}`);
//   });
// }

// async function invoicesPdf(docs) {
//   const doc = new PDFDocument({ size: 'A4', margin: 40 });
//   docs.forEach((payload, i) => {
//     if (i > 0) doc.addPage();
//     drawInvoice(doc, payload);
//   });
//   return collect(doc);
// }

// async function packingSlipsPdf(docs) {
//   const doc = new PDFDocument({ size: 'A4', margin: 40 });
//   docs.forEach((payload, i) => {
//     if (i > 0) doc.addPage();
//     drawPackingSlip(doc, payload);
//   });
//   return collect(doc);
// }

// async function invoicePdf(payload) {
//   return invoicesPdf([payload]);
// }

// async function packingSlipPdf(payload) {
//   return packingSlipsPdf([payload]);
// }

// module.exports = { invoicePdf, packingSlipPdf, invoicesPdf, packingSlipsPdf };
