function getSettings() {
  return {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS,
    prestashop_api_url: process.env.PRESTASHOP_API_URL,
    prestashop_api_key: process.env.PRESTASHOP_API_KEY,
  };
}

module.exports = {
  getSettings,
};
