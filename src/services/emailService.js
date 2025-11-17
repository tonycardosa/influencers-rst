const nodemailer = require('nodemailer');
const { getSettings } = require('./settingsService');

let cachedTransporter = null;
let cachedSignature = '';

async function getTransporter() {
  const settings = await getSettings();
  if (!settings.smtp_host || !settings.smtp_user) {
    throw new Error('SMTP settings are missing. Configure them in /admin/settings.');
  }

  const signature = `${settings.smtp_host}-${settings.smtp_port}-${settings.smtp_user}`;
  if (cachedTransporter && cachedSignature === signature) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port || 587),
    secure: Number(settings.smtp_port) === 465,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });
  cachedSignature = signature;
  return cachedTransporter;
}

async function sendOtpEmail(email, otpCode) {
  const transporter = await getTransporter();
  const settings = await getSettings();
  const fromAddress = settings.smtp_user || 'noreply@example.com';

  await transporter.sendMail({
    from: `RST Ferramentas <${fromAddress}>`,
    to: email,
    subject: 'Código de acesso RST Ferramentas',
    html: `
      <p>Olá,</p>
      <p>Utilize o código abaixo para concluir o seu login:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otpCode}</p>
      <p>Este código expira em 10 minutos.</p>
    `,
  });
}

module.exports = {
  sendOtpEmail,
};
