const nodemailer = require('nodemailer');
const settingsService = require('./settingsService');
const AppError = require('../utils/AppError');


async function getTransporter() {
  const s = await settingsService.getSettings();

  if (!s.smtp_host) {
    throw new AppError("SMTP is not configured", 400);
  }

  const host = String(s.smtp_host).trim();
  const port = Number(s.smtp_port || 587);

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: s.smtp_user
      ? {
          user: s.smtp_user,
          pass: s.smtp_password || undefined,
        }
      : undefined,
    tls: {
      servername: host,
      rejectUnauthorized: true,
    },
  });
}

// async function getTransporter() {
//   const s = await settingsService.getSettings();
//   if (!s.smtp_host) {
//     throw new AppError('SMTP is not configured', 400);
//   }
//   return nodemailer.createTransport({
//     host: s.smtp_host,
//     port: Number(s.smtp_port || 587),
//     secure: Boolean(s.smtp_secure),
//     auth: s.smtp_user
//       ? { user: s.smtp_user, pass: s.smtp_password || undefined }
//       : undefined,
//   });
// }

async function sendMail({ to, subject, text, html, attachments }) {
  const s = await settingsService.getSettings();
  const transporter = await getTransporter();
  return transporter.sendMail({
    from: `"${s.smtp_from_name || 'Scholar Store'}" <${s.smtp_from_email || s.smtp_user}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

function smtpConfigured(settings) {
  return Boolean(settings?.smtp_host && settings?.smtp_user);
}

module.exports = { getTransporter, sendMail, smtpConfigured };
