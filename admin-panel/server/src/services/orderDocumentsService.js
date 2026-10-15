const db = require('../config/db');
const { invoicesPdf, packingSlipsPdf } = require('./gstPdf');

async function getOrderDocuments({ orderIds, from, to }) {
  const query = db('orders as o')
    .join('students as s', 's.id', 'o.student_id')
    .where('o.payment_status', 'paid')
    .select('o.*', 's.student_name', 's.admission_number',
      's.house_color', 's.class_name', 's.email as student_email',
      's.gender as student_gender');
  if (orderIds) query.whereIn('o.id', orderIds);
  if (from && to) query.whereBetween('o.created_at', [from, to]);
  const orders = await query.orderBy('o.created_at', 'asc').orderBy('o.id', 'asc');
  if (!orders.length) return { orders: [], docs: [] };
  const profile = await db('gst_profile').orderBy('id').first() || { legal_name: 'Scholar Store' };
  const items = await db('order_items').whereIn('order_id', orders.map(o => o.id)).orderBy('id');
  const grouped = new Map();
  for (const item of items) {
    const key = Number(item.order_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  const docs = orders.map(order => ({
    profile, order, items: grouped.get(Number(order.id)) || [],
    student: {
      student_name: order.student_name,
      admission_number: order.admission_number,
      house_color: order.house_color,
      class_name: order.class_name,
      email: order.student_email,
      gender: order.student_gender,
    },
  }));
  return { orders, docs };
}
module.exports = { getOrderDocuments, invoicesPdf, packingSlipsPdf };
