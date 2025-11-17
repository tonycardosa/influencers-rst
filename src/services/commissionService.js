const dayjs = require('dayjs');
const db = require('../config/database');
const { getSettings } = require('./settingsService');
const prestashopService = require('./prestashopService');
const { findBrandByPrestashopId } = require('./brandService');
const { findRuleForInfluencerAndBrand } = require('./commissionRulesService');

async function getTotalsForAdmin() {
  const [[pending]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM psrst_commissions WHERE status = "pending"',
  );
  const [[paid]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM psrst_commissions WHERE status = "paid"',
  );
  return {
    totalPending: Number(pending.total || 0),
    totalPaid: Number(paid.total || 0),
  };
}

async function getTotalsForInfluencer(influencerId) {
  const [[pending]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM psrst_commissions WHERE status = "pending" AND influencer_id = ?',
    [influencerId],
  );
  const [[paid]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM psrst_commissions WHERE status = "paid" AND influencer_id = ?',
    [influencerId],
  );
  return {
    totalPending: Number(pending.total || 0),
    totalPaid: Number(paid.total || 0),
  };
}

async function getPendingPayouts() {
  const [rows] = await db.query(
    `SELECT c.*, u.name AS influencer_name
     FROM psrst_commissions c
     JOIN psrst_users u ON u.id = c.influencer_id
     WHERE c.status = 'pending'
     ORDER BY u.name, c.order_created_at DESC`,
  );
  return rows;
}

async function markCommissionsAsPaid(ids) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.query(
    `UPDATE psrst_commissions SET status = 'paid', paid_at = NOW() WHERE id IN (${placeholders})`,
    ids,
  );
}

async function getLastPrestashopOrderId() {
  const [[row]] = await db.query(
    'SELECT prestashop_order_id FROM psrst_commissions ORDER BY prestashop_order_id DESC LIMIT 1',
  );
  return row ? row.prestashop_order_id : null;
}

async function findCustomerByPrestashopId(id) {
  const [rows] = await db.query('SELECT * FROM psrst_customers WHERE prestashop_customer_id = ?', [id]);
  return rows[0] || null;
}

async function createOrUpdateCustomer(prestashopCustomerId, email, influencerId) {
  const existing = await findCustomerByPrestashopId(prestashopCustomerId);
  if (!existing) {
    const [result] = await db.query(
      'INSERT INTO psrst_customers (prestashop_customer_id, email, current_influencer_id) VALUES (?, ?, ?)',
      [prestashopCustomerId, email, influencerId],
    );
    return { id: result.insertId, prestashop_customer_id: prestashopCustomerId };
  }

  await db.query('UPDATE psrst_customers SET current_influencer_id = ?, email = ? WHERE id = ?', [
    influencerId,
    email,
    existing.id,
  ]);
  return { ...existing, current_influencer_id: influencerId, email };
}

async function countCustomerCommissions(customerId) {
  const [[row]] = await db.query(
    'SELECT COUNT(*) AS total FROM psrst_commissions WHERE customer_id = ?',
    [customerId],
  );
  return Number(row.total || 0);
}

async function insertCommission({
  prestashopOrderId,
  customerId,
  influencerId,
  orderTotalWithVat,
  commissionEarned,
  isFirstPurchase,
  orderCreatedAt,
}) {
  await db.query(
    `INSERT INTO psrst_commissions 
      (prestashop_order_id, customer_id, influencer_id, order_total_with_vat, commission_earned, is_first_purchase_commission, status, order_created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      prestashopOrderId,
      customerId,
      influencerId,
      orderTotalWithVat,
      commissionEarned,
      isFirstPurchase ? 1 : 0,
      orderCreatedAt,
    ],
  );
}

async function determineInfluencerFromOrder(order) {
  const cartRules = Array.isArray(order.associations?.cart_rules)
    ? order.associations.cart_rules
    : Array.isArray(order.associations?.cart_rows)
      ? order.associations.cart_rows
      : [];

  if (cartRules.length) {
    for (const rule of cartRules) {
      const code = rule?.code || rule?.cart_rule_name || rule?.name;
      if (!code) continue;
      const [rows] = await db.query('SELECT * FROM psrst_discount_codes WHERE prestashop_code = ?', [
        code,
      ]);
      if (rows.length) {
        return rows[0].user_id;
      }
    }
  }

  // fallback: existing customer
  const [customers] = await db.query(
    'SELECT * FROM psrst_customers WHERE prestashop_customer_id = ?',
    [order.id_customer],
  );
  if (customers.length) {
    return customers[0].current_influencer_id;
  }
  return null;
}

async function calculateCommissionForOrder({ order, orderDetails, influencerId, isFirst }) {
  let commissionTotal = 0;
  let orderTotalWithVat = 0;

  const detailsArray = Array.isArray(orderDetails)
    ? orderDetails
    : Array.isArray(orderDetails?.order_detail)
      ? orderDetails.order_detail
      : [];

  for (const detail of detailsArray) {
    const price = Number(detail.total_price_tax_incl || 0);
    orderTotalWithVat += price;

    const brand = await findBrandByPrestashopId(detail.id_manufacturer);
    let rule = null;
    if (brand) {
      rule = await findRuleForInfluencerAndBrand(influencerId, brand.id);
    }
    if (!rule) {
      rule = await findRuleForInfluencerAndBrand(influencerId, null);
    }

    if (!rule) {
      continue;
    }

    const percentage = isFirst ? rule.commission_first : rule.commission_subsequent;
    commissionTotal += price * (Number(percentage) / 100);
  }

  return { commissionTotal, orderTotalWithVat };
}

async function syncOrders() {
  const settings = await getSettings();
  if (!settings.prestashop_api_key || !settings.prestashop_api_url) {
    throw new Error('Configure as credenciais da API do Prestashop antes de sincronizar.');
  }

  const lastOrderId = await getLastPrestashopOrderId();
  const orders = await prestashopService.fetchOrdersSince(settings, lastOrderId);

  let imported = 0;
  for (const order of orders) {
    const influencerId = await determineInfluencerFromOrder(order);
    if (!influencerId) continue;

    const customerEmail = order.email || order.customer_email || order?.customer?.email || null;
    const customer = await createOrUpdateCustomer(
      order.id_customer,
      customerEmail,
      influencerId,
    );
    const previousCount = await countCustomerCommissions(customer.id);
    const isFirst = previousCount === 0;

    const orderDetails = await prestashopService.fetchOrderDetails(settings, order.id);
    const { commissionTotal, orderTotalWithVat } = await calculateCommissionForOrder({
      order,
      orderDetails,
      influencerId,
      isFirst,
    });

    if (!commissionTotal) continue;

    await insertCommission({
      prestashopOrderId: order.id,
      customerId: customer.id,
      influencerId,
      orderTotalWithVat,
      commissionEarned: commissionTotal,
      isFirstPurchase: isFirst,
      orderCreatedAt: dayjs(order.date_add).toDate(),
    });
    imported += 1;
  }
  return imported;
}

async function listCommissionsByInfluencer(influencerId) {
  const [rows] = await db.query(
    `SELECT * FROM psrst_commissions 
     WHERE influencer_id = ?
     ORDER BY order_created_at DESC`,
    [influencerId],
  );
  return rows;
}

module.exports = {
  getTotalsForAdmin,
  getTotalsForInfluencer,
  getPendingPayouts,
  markCommissionsAsPaid,
  syncOrders,
  listCommissionsByInfluencer,
};
