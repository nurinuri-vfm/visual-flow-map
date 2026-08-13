// メール送信: SMTP リレー経由で送る
const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendEmail(to, subject, body) {
  try {
    await transport.sendMail({ from: 'shop@example.com', to, subject, text: body });
    return true;
  } catch (e) {
    console.error('mail failed:', e.message);
    return false;
  }
}

module.exports = { sendEmail };
