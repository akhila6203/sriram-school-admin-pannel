
const db = require('../config/db');

async function getDashboard(req, res, next) {
  try {
    const todayStart = db.raw('CURDATE()');
    const monthStart = db.raw(
      'DATE_FORMAT(CURDATE(), "%Y-%m-01")'
    );

    // Dashboard orders: Paid + Pending only
    // const eligible = (query, column = 'payment_status') =>
    //   query.whereIn(column, ['paid', 'pending']);
    // Show paid orders and payment attempts awaiting confirmation.
// Hide orders where Paytm was only opened and closed.
const eligible = (query, alias = "orders") =>
  query
    .whereIn(`${alias}.payment_status`, [
      "paid",
      "pending",
    ])
    .andWhere(function () {
      this.where(`${alias}.payment_status`, "paid")
        .orWhereExists(function () {
          this.select(db.raw("1"))
            .from("payment_transactions as pt")
            .whereRaw(`pt.order_id = ${alias}.id`)
            .where("pt.status", "pending");
        });
    });

    const [
      studentsTotal,
      studentsLoggedIn,
      kitOrders,
      individualOrders,
      revenue,
      todaySales,
      totalOrders,
      productsCount,
      pendingOrders,
      lowStock,
      outStock,
      gstThisMonth,
      onlinePaid,
      statusRows,
      paymentRows,
    ] = await Promise.all([
      db('students').count({ c: '*' }).first(),

      db('students')
        .whereNotNull('first_login_at')
        .count({ c: '*' })
        .first(),

      eligible(db('orders'))
        .where({ type: 'kit' })
        .count({ c: '*' })
        .first(),

      eligible(db('orders'))
        .where({ type: 'individual' })
        .count({ c: '*' })
        .first(),

      db('orders')
        .where('payment_status', 'paid')
        .whereNotIn('status', ['cancelled', 'returned'])
        .sum({ total: 'total' })
        .first(),

      db('orders')
        .where('payment_status', 'paid')
        .whereNotIn('status', ['cancelled', 'returned'])
        .where('created_at', '>=', todayStart)
        .sum({ total: 'total' })
        .first(),

      eligible(db('orders'))
        .count({ c: '*' })
        .first(),

      db('products')
        .count({ c: '*' })
        .first(),

      // db('orders')
      //   .where('payment_status', 'pending')
      //   .count({ c: '*' })
      //   .first(),
      eligible(db("orders"))
  .where("orders.payment_status", "pending")
  .count({ c: "*" })
  .first(),

      db('product_variants')
        .where('stock_qty', '>', 0)
        .whereRaw('stock_qty <= low_stock_threshold')
        .count({ c: '*' })
        .first(),

      db('product_variants')
        .where({ stock_qty: 0 })
        .count({ c: '*' })
        .first(),

      db('orders')
        .where('payment_status', 'paid')
        .where('created_at', '>=', monthStart)
        .whereNotIn('status', ['cancelled', 'returned'])
        .select(
          db.raw(
            'COALESCE(SUM(cgst_total + sgst_total + igst_total), 0) as tax'
          )
        )
        .first(),

      db('orders')
        .where({
          payment_method: 'paytm',
          payment_status: 'paid',
        })
        .sum({ total: 'total' })
        .first(),

      eligible(db('orders'))
        .select('status')
        .count({ c: '*' })
        .groupBy('status'),

      eligible(db('orders'))
        .select('payment_status')
        .count({ c: '*' })
        .groupBy('payment_status'),
    ]);

    const statusCounts = {
      placed: 0,
      confirmed: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };

    for (const row of statusRows) {
      const status = String(row.status || '').toLowerCase();

      if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
        statusCounts[status] += Number(row.c);
      }
    }

    const paymentCounts = {
      paid: 0,
      pending: 0,
    };

    for (const row of paymentRows) {
      if (row.payment_status === 'paid') {
        paymentCounts.paid = Number(row.c);
      }

      if (row.payment_status === 'pending') {
        paymentCounts.pending = Number(row.c);
      }
    }

    // Daily sales - paid orders only
    const ordersPerDay = await db('orders')
      .where('payment_status', 'paid')
      .whereNotIn('status', ['cancelled', 'returned'])
      .where(
        'created_at',
        '>=',
        db.raw('DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
      )
      .select(
        db.raw('DATE(created_at) as day'),
        db.raw('COUNT(*) as count'),
        db.raw('COALESCE(SUM(total), 0) as sales')
      )
      .groupByRaw('DATE(created_at)')
      .orderBy('day', 'asc');

    // Revenue - paid orders only
    const revenueByMonth = await db('orders')
      .where('payment_status', 'paid')
      .whereNotIn('status', ['cancelled', 'returned'])
      .where(
        'created_at',
        '>=',
        db.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)')
      )
      .select(
        db.raw('DATE_FORMAT(created_at, "%Y-%m") as month'),
        db.raw('COALESCE(SUM(total), 0) as revenue')
      )
      .groupByRaw('DATE_FORMAT(created_at, "%Y-%m")')
      .orderBy('month', 'asc');

    // Top-selling products - paid orders only
    const topProducts = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('o.payment_status', 'paid')
      .whereNotIn('o.status', ['cancelled', 'returned'])
      .select('oi.name_snapshot as name')
      .sum({ qty: 'oi.quantity' })
      .groupBy('oi.name_snapshot')
      .orderBy('qty', 'desc')
      .limit(8);

    // Only latest 5 Paid / Pending orders
    // const recentOrders = await db('orders as o')
    //   .join('students as s', 's.id', 'o.student_id')
    const recentOrders = await eligible(
  db("orders as o"),
  "o"
)
  .join("students as s", "s.id", "o.student_id")
      // .whereIn('o.payment_status', ['paid', 'pending'])
      .select(
        'o.id',
        'o.order_number',
        'o.type',
        'o.status',
        'o.payment_status',
        'o.total',
        'o.created_at',
        's.admission_number',
        's.student_name'
      )
      .orderBy('o.created_at', 'desc')
      .orderBy('o.id', 'desc')
      .limit(5);

    // Existing low-stock functionality
    const lowStockList = await db('product_variants as v')
      .join('products as p', 'p.id', 'v.product_id')
      .whereRaw('v.stock_qty <= v.low_stock_threshold')
      .select(
        'v.sku',
        'p.name as product_name',
        'v.stock_qty',
        'v.low_stock_threshold'
      )
      .orderBy('v.stock_qty', 'asc')
      .limit(20);

    // Existing recent logins
    const recentLogins = await db('students')
      .whereNotNull('last_login_at')
      .select(
        'id',
        'admission_number',
        'student_name',
        'house_color',
        'last_login_at'
      )
      .orderBy('last_login_at', 'desc')
      .limit(10);

    res.json({
      success: true,
      data: {
        cards: {
          totalRevenue: Number(revenue?.total || 0),
          todaySales: Number(todaySales?.total || 0),
          totalOrders: Number(totalOrders?.c || 0),
          totalStudents: Number(studentsTotal?.c || 0),
          studentsLoggedIn: Number(studentsLoggedIn?.c || 0),
          kitOrders: Number(kitOrders?.c || 0),
          individualOrders: Number(individualOrders?.c || 0),
          products: Number(productsCount?.c || 0),
          pendingOrders: Number(pendingOrders?.c || 0),
          lowStockVariants: Number(lowStock?.c || 0),
          outOfStockVariants: Number(outStock?.c || 0),
          stockAlerts:
            Number(lowStock?.c || 0) +
            Number(outStock?.c || 0),
          gstThisMonth: Number(gstThisMonth?.tax || 0),
          onlinePayments: Number(onlinePaid?.total || 0),
        },

        statusCounts,
        paymentCounts,

        ordersPerDay: ordersPerDay.map((r) => ({
          day: r.day,
          count: Number(r.count),
          sales: Number(r.sales),
        })),

        revenueByMonth: revenueByMonth.map((r) => ({
          month: r.month,
          revenue: Number(r.revenue),
        })),

        topProducts: topProducts.map((r) => ({
          name: r.name,
          qty: Number(r.qty),
        })),

        ordersByStatus: Object.entries(statusCounts)
          .filter(([, value]) => value > 0)
          .map(([name, value]) => ({ name, value })),

        recentOrders,
        lowStockList,
        recentLogins,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };




// const db = require('../config/db');

// async function getDashboard(req, res, next) {
//   try {
//     const todayStart = db.raw('CURDATE()');
//     const monthStart = db.raw('DATE_FORMAT(CURDATE(), \"%Y-%m-01\")');

//     const [
//       studentsTotal,
//       studentsLoggedIn,
//       kitOrders,
//       individualOrders,
//       revenue,
//       todaySales,
//       totalOrders,
//       productsCount,
//       pendingOrders,
//       lowStock,
//       outStock,
//       gstThisMonth,
//       onlinePaid,
//       statusRows,
//     ] = await Promise.all([
//       db('students').count({ c: '*' }).first(),
//       db('students').whereNotNull('first_login_at').count({ c: '*' }).first(),
//       db('orders').where({ type: 'kit' }).whereNotIn('status', ['cancelled']).count({ c: '*' }).first(),
//       db('orders').where({ type: 'individual' }).whereNotIn('status', ['cancelled']).count({ c: '*' }).first(),
//       db('orders')
//         .whereNotIn('status', ['cancelled', 'returned'])
//         .whereIn('payment_status', ['paid', 'partially_refunded'])
//         .sum({ total: 'total' })
//         .first(),
//       db('orders')
//         .whereNotIn('status', ['cancelled', 'returned'])
//         .where('created_at', '>=', todayStart)
//         .sum({ total: 'total' })
//         .first(),
//       db('orders').count({ c: '*' }).first(),
//       db('products').count({ c: '*' }).first(),
//       db('orders').where({ status: 'placed' }).count({ c: '*' }).first(),
//       db('product_variants')
//         .where('stock_qty', '>', 0)
//         .whereRaw('stock_qty <= low_stock_threshold')
//         .count({ c: '*' })
//         .first(),
//       db('product_variants').where({ stock_qty: 0 }).count({ c: '*' }).first(),
//       db('orders')
//         .where('created_at', '>=', monthStart)
//         .whereNotIn('status', ['cancelled'])
//         .select(
//           db.raw('COALESCE(SUM(cgst_total + sgst_total + igst_total), SUM(tax), 0) as tax')
//         )
//         .first()
//         .catch(() => ({ tax: 0 })),
//       db('orders')
//         .where({ payment_method: 'paytm', payment_status: 'paid' })
//         .sum({ total: 'total' })
//         .first()
//         .catch(() => ({ total: 0 })),
//       db('orders')
//         .select('status')
//         .count({ c: '*' })
//         .groupBy('status'),
//     ]);

//     const statusCounts = {
//       placed: 0,
//       confirmed: 0,
//       packed: 0,
//       shipped: 0,
//       delivered: 0,
//       cancelled: 0,
//       returned: 0,
//     };
//     statusRows.forEach((r) => {
//       statusCounts[r.status] = Number(r.c);
//     });

//     const ordersPerDay = await db('orders')
//       .where('created_at', '>=', db.raw('DATE_SUB(CURDATE(), INTERVAL 30 DAY)'))
//       .select(db.raw('DATE(created_at) as day'), db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(total),0) as sales'))
//       .groupByRaw('DATE(created_at)')
//       .orderBy('day', 'asc');

//     const revenueByMonth = await db('orders')
//       .where('created_at', '>=', db.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
//       .whereNotIn('status', ['cancelled', 'returned'])
//       .select(db.raw('DATE_FORMAT(created_at, \"%Y-%m\") as month'), db.raw('COALESCE(SUM(total),0) as revenue'))
//       .groupByRaw('DATE_FORMAT(created_at, \"%Y-%m\")')
//       .orderBy('month', 'asc');

//     const topProducts = await db('order_items as oi')
//       .join('orders as o', 'o.id', 'oi.order_id')
//       .whereNotIn('o.status', ['cancelled', 'returned'])
//       .select('oi.name_snapshot as name')
//       .sum({ qty: 'oi.quantity' })
//       .groupBy('oi.name_snapshot')
//       .orderBy('qty', 'desc')
//       .limit(8);

//     const recentOrders = await db('orders as o')
//       .join('students as s', 's.id', 'o.student_id')
//       .select(
//         'o.id',
//         'o.order_number',
//         'o.type',
//         'o.status',
//         'o.total',
//         'o.created_at',
//         's.admission_number',
//         's.student_name'
//       )
//       .orderBy('o.created_at', 'desc')
//       .limit(10);

//     const lowStockList = await db('product_variants as v')
//       .join('products as p', 'p.id', 'v.product_id')
//       .whereRaw('v.stock_qty <= v.low_stock_threshold')
//       .select('v.sku', 'p.name as product_name', 'v.stock_qty', 'v.low_stock_threshold')
//       .orderBy('v.stock_qty', 'asc')
//       .limit(20);

//     const recentLogins = await db('students')
//       .whereNotNull('last_login_at')
//       .select('id', 'admission_number', 'student_name', 'house_color', 'last_login_at')
//       .orderBy('last_login_at', 'desc')
//       .limit(10);

//     res.json({
//       success: true,
//       data: {
//         cards: {
//           totalRevenue: Number(revenue.total || 0),
//           todaySales: Number(todaySales.total || 0),
//           totalOrders: Number(totalOrders.c),
//           totalStudents: Number(studentsTotal.c),
//           studentsLoggedIn: Number(studentsLoggedIn.c),
//           kitOrders: Number(kitOrders.c),
//           individualOrders: Number(individualOrders.c),
//           products: Number(productsCount.c),
//           pendingOrders: Number(pendingOrders.c),
//           lowStockVariants: Number(lowStock.c),
//           outOfStockVariants: Number(outStock.c),
//           stockAlerts: Number(lowStock.c) + Number(outStock.c),
//           gstThisMonth: Number(gstThisMonth.tax || 0),
//           onlinePayments: Number(onlinePaid.total || 0),
//         },
//         statusCounts,
//         ordersPerDay: ordersPerDay.map((r) => ({
//           day: r.day,
//           count: Number(r.count),
//           sales: Number(r.sales),
//         })),
//         revenueByMonth: revenueByMonth.map((r) => ({
//           month: r.month,
//           revenue: Number(r.revenue),
//         })),
//         topProducts: topProducts.map((r) => ({
//           name: r.name,
//           qty: Number(r.qty),
//         })),
//         ordersByStatus: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
//         recentOrders,
//         lowStockList,
//         recentLogins,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = { getDashboard };
