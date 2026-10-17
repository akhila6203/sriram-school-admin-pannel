const db = require('../config/db');
const mailer = require('./mailer');
const { getOrderDocuments, invoicesPdf } = require('./orderDocumentsService');

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

async function sendCustomerOrderEmail(orderId) {
  const order = await db('orders').where({ id: orderId, payment_status: 'paid' }).first();
  if (!order) return false;
  const student = await db('students').where({ id: order.student_id }).first();
  const recipient = String(student?.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    console.warn('Order confirmation skipped: missing valid student email for order', orderId);
    return false;
  }
  await db('order_email_deliveries').insert({
    order_id: orderId, email_type: 'order_confirmation', recipient_email: recipient,
  }).onConflict(['order_id','email_type']).ignore();
  const updated = await db('order_email_deliveries')
    .where({ order_id: orderId, email_type: 'order_confirmation' })
    .where(q => q.whereIn('status', ['pending','failed'])
      .orWhere(q2 => q2.where('status','sending')
        .where('claimed_at','<',db.raw('DATE_SUB(NOW(), INTERVAL 15 MINUTE)'))))
    .where('attempts','<',10)
    .update({ status: 'sending', claimed_at: db.fn.now(),
      attempts: db.raw('attempts + 1'), recipient_email: recipient });
  if (!updated) return false;
  try {
    const { docs } = await getOrderDocuments({ orderIds: [orderId] });
    if (!docs.length) throw new Error('Paid order documents not found');
    const invoice = await invoicesPdf(docs);
    const items = docs[0].items;
    const itemLines = items.map(i => `${i.name_snapshot}${i.option_snapshot ? ' ('+i.option_snapshot+')' : ''} x ${i.quantity}`);
    const itemHtml = items.map(i => `<li>${escapeHtml(i.name_snapshot)}${i.option_snapshot ? ' ('+escapeHtml(i.option_snapshot)+')' : ''} &times; ${Number(i.quantity)}</li>`).join('');
    await mailer.sendMail({
      to: recipient,
      subject: `Your order ${order.order_number} is confirmed - BrassLeaf`,
      text: `Hello ${student.student_name || 'Customer'},\n\nYour payment was successful and your order is confirmed.\nOrder: ${order.order_number}\nProducts:\n${itemLines.join('\n')}\nTotal paid: Rs. ${Number(order.total).toFixed(2)}\n\nYour invoice is attached.\nBrassLeaf`,
      html: `<p>Hello ${escapeHtml(student.student_name || 'Customer')},</p><p><strong>Your order is confirmed!</strong> Your payment was successful.</p><p>Order number: <strong>${escapeHtml(order.order_number)}</strong></p><ul>${itemHtml}</ul><p>Total paid: <strong>Rs. ${Number(order.total).toFixed(2)}</strong></p><p>Your invoice is attached.</p><p>BrassLeaf Team</p>`,
      attachments: [{ filename: `Invoice-${order.order_number}.pdf`, content: invoice, contentType: 'application/pdf' }],
    });
    await db('order_email_deliveries').where({order_id: orderId,email_type:'order_confirmation'})
      .update({status:'sent',sent_at:db.fn.now(),last_error:null});
    return true;
  } catch (error) {
    await db('order_email_deliveries').where({order_id:orderId,email_type:'order_confirmation'})
      .update({status:'failed',last_error:String(error.message).slice(0,2000)});
    throw error;
  }
}

module.exports = {
  sendCustomerOrderEmail,
  sendOrderConfirmationEmail: sendCustomerOrderEmail,
};
// module.exports = { sendCustomerOrderEmail };
