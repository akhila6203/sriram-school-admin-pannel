
const db = require('../config/db');
const XLSX = require('xlsx');

const pad = (n) => String(n).padStart(2, '0');

function dateText(d) {
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
  ].join('-');
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00`));
}

function filtersFrom(query) {
  const now = new Date();
  const today = dateText(now);

  const period = [
    'today', 'date', 'range', 'week', 'month', 'year',
  ].includes(query.period) ? query.period : 'month';

  const stockFilter = [
    'all', 'in', 'low', 'out',
  ].includes(query.stockFilter) ? query.stockFilter : 'all';

  const sort = [
    'most', 'least', 'sales', 'name', 'stock',
  ].includes(query.sort) ? query.sort : 'most';

  let from = today;
  let to = today;

  if (period === 'date') {
    from = to = isDate(query.date) ? query.date : today;
  }

  if (period === 'range') {
    from = isDate(query.from) ? query.from : today;
    to = isDate(query.to) ? query.to : today;
  }

  if (period === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    from = dateText(start);
  }

  if (period === 'month' || period === 'year') {
    const year = Math.max(
      2000,
      Math.min(2100, Number(query.year) || now.getFullYear())
    );

    if (period === 'year') {
      from = `${year}-01-01`;
      to = `${year}-12-31`;
    } else {
      const month = Math.max(
        1,
        Math.min(12, Number(query.month) || now.getMonth() + 1)
      );

      from = `${year}-${pad(month)}-01`;
      to = dateText(new Date(year, month, 0));
    }
  }

  if (from > to) {
    const error = new Error('From Date cannot be after To Date');
    error.status = 400;
    throw error;
  }

  return {
    period,
    from,
    to,
    stockFilter,
    sort,
    search: String(query.search || '').trim().slice(0, 150),
  };
}

function stockStatus(stock, threshold) {
  if (stock <= 0) return 'out';
  if (stock <= threshold) return 'low';
  return 'in';
}

function safeText(value) {
  const valueText = String(value ?? '');
  return /^[=+\-@\t\r]/.test(valueText)
    ? `'${valueText}`
    : valueText;
}

async function buildReport(filters) {
  const variants = await db('product_variants as v')
    .join('products as p', 'p.id', 'v.product_id')
    .select(
      'v.id',
      'v.product_id',
      'v.sku',
      'v.option1_name',
      'v.option1_value',
      'v.option2_name',
      'v.option2_value',
      'v.stock_qty',
      'v.reserved_qty',
      'v.low_stock_threshold',
      'v.price_override',
      'v.image_url',
      'v.is_active',
      'p.name as product_name',
      'p.base_price',
      'p.status as product_status'
    );

  const imageRows = await db('product_images')
    .select('product_id', 'url')
    .orderBy('is_primary', 'desc')
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc');

  const imagesByProduct = new Map();

  for (const image of imageRows) {
    const key = String(image.product_id);

    if (!imagesByProduct.has(key)) {
      imagesByProduct.set(key, image.url);
    }
  }

  const salesRows = await db('order_items as oi')
    .join('orders as o', 'o.id', 'oi.order_id')
    .where('o.payment_status', 'paid')
    .whereNotIn('o.status', ['cancelled', 'returned'])
    .where('o.created_at', '>=', `${filters.from} 00:00:00`)
    .where('o.created_at', '<=', `${filters.to} 23:59:59`)
    .groupBy('oi.variant_id')
    .select('oi.variant_id')
    .sum({ units_sold: 'oi.quantity' })
    .sum({ sales_amount: 'oi.line_total' });

  const salesByVariant = new Map(
    salesRows.map((row) => [
      String(row.variant_id),
      row,
    ])
  );

  const ordersRow = await db('orders')
    .where('payment_status', 'paid')
    .whereNotIn('status', ['cancelled', 'returned'])
    .where('created_at', '>=', `${filters.from} 00:00:00`)
    .where('created_at', '<=', `${filters.to} 23:59:59`)
    .count({ count: '*' })
    .first();

  const allItems = variants.map((variant) => {
    const sales = salesByVariant.get(String(variant.id));
    const stock = Number(variant.stock_qty || 0);
    const threshold = Number(
      variant.low_stock_threshold || 0
    );

    const optionParts = [
      [variant.option1_name, variant.option1_value],
      [variant.option2_name, variant.option2_value],
    ]
      .filter(([, value]) => Boolean(value))
      .map(([name, value]) =>
        name ? `${name}: ${value}` : String(value)
      );

    return {
      id: variant.id,
      variantId: variant.id,
      productId: variant.product_id,
      productName: variant.product_name,
      sku: variant.sku,
      options: optionParts.join(' / ') || '—',
      option1Name: variant.option1_name,
      option1Value: variant.option1_value,
      option2Name: variant.option2_name,
      option2Value: variant.option2_value,
      imageUrl:
        variant.image_url ||
        imagesByProduct.get(String(variant.product_id)) ||
        '',
      price: Number(
        variant.price_override ?? variant.base_price
      ),
      unitsSold: Number(sales?.units_sold || 0),
      salesAmount: Number(sales?.sales_amount || 0),
      unitsInStock: stock,
      reservedUnits: Number(variant.reserved_qty || 0),
availableUnits:
  stock - Number(variant.reserved_qty || 0),
      lowStockThreshold: threshold,
      stockStatus: stockStatus(stock, threshold),
      isActive: Boolean(variant.is_active),
      productStatus: variant.product_status,
    };
  });

  const distinctSoldProducts = new Set(
    allItems
      .filter((item) => item.unitsSold > 0)
      .map((item) => String(item.productId))
  );

  // Period totals are calculated before table filters.
  const summary = {
    totalUnitsSold: allItems.reduce(
      (sum, item) => sum + item.unitsSold, 0
    ),
    productsSold: distinctSoldProducts.size,
    totalSales: Number(
      allItems.reduce(
        (sum, item) => sum + item.salesAmount, 0
      ).toFixed(2)
    ),

    orders: Number(ordersRow?.count || 0),
    unitsInStock: allItems.reduce(
      (sum, item) => sum + item.unitsInStock, 0
    ),
    lowStock: allItems.filter(
      (item) => item.stockStatus === 'low'
    ).length,
    outOfStock: allItems.filter(
      (item) => item.stockStatus === 'out'
    ).length,
    reservedUnits: allItems.reduce(
  (sum, item) => sum + item.reservedUnits,
  0
),

availableUnits: allItems.reduce(
  (sum, item) => sum + item.availableUnits,
  0
),
  };

  let items = allItems.filter((item) => {
    if (
      filters.stockFilter !== 'all' &&
      item.stockStatus !== filters.stockFilter
    ) {
      return false;
    }

    if (filters.search) {
      const text = [
        item.productName,
        item.sku,
        item.options,
      ].join(' ').toLowerCase();

      return text.includes(filters.search.toLowerCase());
    }

    return true;
  });

  items.sort((a, b) => {
    if (filters.sort === 'least') {
      return a.unitsSold - b.unitsSold;
    }

    if (filters.sort === 'sales') {
      return b.salesAmount - a.salesAmount;
    }

    if (filters.sort === 'stock') {
      return b.unitsInStock - a.unitsInStock;
    }

    if (filters.sort === 'name') {
      return a.productName.localeCompare(b.productName);
    }

    return b.unitsSold - a.unitsSold;
  });

  return {
    filters,
    summary,
    items,
  };
}

async function getReport(req, res, next) {
  try {
    const filters = filtersFrom(req.query);
    const report = await buildReport(filters);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

async function downloadReport(req, res, next) {
  try {
    const filters = filtersFrom(req.query);
    const { summary, items } = await buildReport(filters);

    const rows = [
      ['INVENTORY REPORT'],
      [],
      ['Period', filters.period.toUpperCase()],
      ['From Date', filters.from],
      ['To Date', filters.to],
      ['Stock Filter', filters.stockFilter],
      [],
      ['SUMMARY'],
      ['Total Units Sold', summary.totalUnitsSold],
      ['Products Sold', summary.productsSold],
      ['Total Sales (INR)', summary.totalSales],
      ['Orders', summary.orders],
      ['Units In Stock', summary.unitsInStock],
      ['Low Stock Variants', summary.lowStock],
      ['Out Of Stock Variants', summary.outOfStock],
      [],
      ['PRODUCT / VARIANT DETAILS'],
      [
        'S.No',
        'Product Name',
        'SKU',
        'Options',
        'Unit Price (INR)',
        'Units Sold',
        'Sales Amount (INR)',
        'Units In Stock',
        
      ],
    ];

    items.forEach((item, index) => {
  rows.push([
    index + 1,
    safeText(item.productName),
    safeText(item.sku),
    safeText(item.options),
    item.price,
    item.unitsSold,
    item.salesAmount,
    item.unitsInStock,
  ]);
});

    const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Inventory');

rows.forEach((row) => sheet.addRow(row));

sheet.columns = [
  { width: 8 },
  { width: 30 },
  { width: 20 },
  { width: 28 },
  { width: 18 },
  { width: 15 },
  { width: 20 },
  { width: 18 },
];

// Row 18 contains the column headings.
const headerRow = sheet.getRow(18);

headerRow.height = 28;

headerRow.eachCell((cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E5FF' },
  };

  cell.font = {
    bold: true,
    color: { argb: 'FF312E81' },
  };

  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center',
  };

  cell.border = {
    bottom: {
      style: 'thin',
      color: { argb: 'FFC7C3F5' },
    },
  };
});

sheet.views = [
  { state: 'frozen', ySplit: 18 },
];

const filename =
  `inventory-${filters.from}-to-${filters.to}.xlsx`;

res.setHeader(
  'Content-Type',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
);

res.setHeader(
  'Content-Disposition',
  `attachment; filename="${filename}"`
);

await workbook.xlsx.write(res);
res.end();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getReport,
  downloadReport,
};
