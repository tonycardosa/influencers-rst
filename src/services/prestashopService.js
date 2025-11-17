const axios = require('axios');

function createClient(settings) {
  const baseURL = settings.prestashop_api_url?.replace(/\/$/, '');
  return axios.create({
    baseURL,
    auth: {
      username: settings.prestashop_api_key,
      password: '',
    },
    headers: {
      Accept: 'application/json',
    },
    params: {
      output_format: 'JSON',
    },
  });
}

async function fetchOrdersSince(settings, lastOrderId) {
  const client = createClient(settings);

  const filterId = lastOrderId ? `[${Number(lastOrderId) + 1},]` : '';
  const params = {
    display: 'full',
    sort: '[id_ASC]',
    'filter[current_state]': '[2|4|5]',
  };
  if (filterId) {
    params['filter[id]'] = filterId;
  }

  const { data } = await client.get('orders', { params });
  const orders = data.orders || [];
  if (Array.isArray(orders)) return orders;
  return orders.order || [];
}

async function fetchOrderDetails(settings, orderId) {
  const client = createClient(settings);
  const { data } = await client.get('order_details', {
    params: {
      display: 'full',
      'filter[id_order]': orderId,
    },
  });
  const details = data.order_details || [];
  if (Array.isArray(details)) {
    return details;
  }
  return details.order_detail || [];
}

async function fetchBrands(settings) {
  const client = createClient(settings);
  const { data } = await client.get('manufacturers', {
    params: { display: 'full' },
  });
  const manufacturers = data.manufacturers || [];
  if (Array.isArray(manufacturers)) return manufacturers;
  return manufacturers.manufacturer || [];
}

module.exports = {
  fetchOrdersSince,
  fetchOrderDetails,
  fetchBrands,
};
