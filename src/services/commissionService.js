const dayjs = require('dayjs');
const db = require('../config/database');
const { getSettings } = require('./settingsService');
const prestashopService = require('./prestashopService');
const { findBrandByPrestashopId } = require('./brandService');
const { findRuleForAfiliadoAndBrand } = require('./commissionRulesService');

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

async function getTotalsForAfiliado(afiliadoId) {
  const [[pending]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM psrst_commissions WHERE status = "pending" AND afiliado_id = ?',
    [afiliadoId],
  );
  const [[paid]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM psrst_commissions WHERE status = "paid" AND afiliado_id = ?',
    [afiliadoId],
  );
  return {
    totalPending: Number(pending.total || 0),
    totalPaid: Number(paid.total || 0),
  };
}

async function getPendingPayouts() {
  const [rows] = await db.query(
    `SELECT c.*, u.name AS afiliado_name
     FROM psrst_commissions c
     JOIN psrst_users u ON u.id = c.afiliado_id
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

async function createOrUpdateCustomer(prestashopCustomerId, email, afiliadoId) {
  const existing = await findCustomerByPrestashopId(prestashopCustomerId);
  if (!existing) {
    const [result] = await db.query(
      'INSERT INTO psrst_customers (prestashop_customer_id, email, current_afiliado_id) VALUES (?, ?, ?)',
      [prestashopCustomerId, email, afiliadoId],
    );
    return { id: result.insertId, prestashop_customer_id: prestashopCustomerId };
  }

  await db.query('UPDATE psrst_customers SET current_afiliado_id = ?, email = ? WHERE id = ?', [
    afiliadoId,
    email,
    existing.id,
  ]);
  return { ...existing, current_afiliado_id: afiliadoId, email };
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
  afiliadoId,
  orderTotalWithVat,
  commissionEarned,
  isFirstPurchase,
  orderCreatedAt,
}) {
  await db.query(
    `INSERT INTO psrst_commissions 
      (prestashop_order_id, customer_id, afiliado_id, order_total_with_vat, commission_earned, is_first_purchase_commission, status, order_created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      prestashopOrderId,
      customerId,
      afiliadoId,
      orderTotalWithVat,
      commissionEarned,
      isFirstPurchase ? 1 : 0,
      orderCreatedAt,
    ],
  );
}

async function determineAfiliadoFromOrder(order, cartRules, settings) {
  if (cartRules.length) {
    for (const rule of cartRules) {
      // The rule from order associations only has the ID. We need to fetch the full rule.
      const ruleDetails = await prestashopService.fetchCartRuleDetails(settings, rule.id_cart_rule);
      const code = ruleDetails?.code;
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
    return customers[0].current_afiliado_id;
  }
  return null;
}

async function calculateCommissionForOrder({ order, orderDetails, afiliadoId, isFirst }) {
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
      rule = await findRuleForAfiliadoAndBrand(afiliadoId, brand.id);
    }
    if (!rule) {
      rule = await findRuleForAfiliadoAndBrand(afiliadoId, null);
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
    // Fetch cart rules explicitly as they might not be in the order list response
    const cartRules = await prestashopService.fetchOrderCartRules(settings, order.id);
    const afiliadoId = await determineAfiliadoFromOrder(order, cartRules, settings);
    if (!afiliadoId) continue;

    const customerEmail = order.email || order.customer_email || order?.customer?.email || null;
    const customer = await createOrUpdateCustomer(
      order.id_customer,
      customerEmail,
      afiliadoId,
    );
    const previousCount = await countCustomerCommissions(customer.id);
    const isFirst = previousCount === 0;

    const orderDetails = await prestashopService.fetchOrderDetails(settings, order.id);
    const { commissionTotal, orderTotalWithVat } = await calculateCommissionForOrder({
      order,
      orderDetails,
      afiliadoId,
      isFirst,
    });

    if (!commissionTotal) continue;

    await insertCommission({
      prestashopOrderId: order.id,
      customerId: customer.id,
      afiliadoId,
      orderTotalWithVat,
      commissionEarned: commissionTotal,
      isFirstPurchase: isFirst,
      orderCreatedAt: dayjs(order.date_add).toDate(),
    });
    imported += 1;
  }
  return imported;
}

async function listCommissionsByAfiliado(afiliadoId) {
  const [rows] = await db.query(
    `SELECT * FROM psrst_commissions 
     WHERE afiliado_id = ?
     ORDER BY order_created_at DESC`,
    [afiliadoId],
  );
  return rows;
}

module.exports = {
  getTotalsForAdmin,
  getTotalsForAfiliado,
  getPendingPayouts,
  markCommissionsAsPaid,
  syncOrders,
  listCommissionsByAfiliado,
};
