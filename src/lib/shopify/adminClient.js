/**
 * Shopify Admin API Client
 * Uses SHOPIFY_24_ADMIN token for authenticated requests
 */

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_24_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN || '83bfa8-c4.myshopify.com';
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_24_ADMIN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

/**
 * Get Shopify Admin API base URL
 */
export function getShopifyAdminBase() {
  if (!SHOPIFY_ADMIN_TOKEN) {
    throw new Error('SHOPIFY_24_ADMIN token is not configured');
  }
  
  // Remove protocol if present, ensure it's just the domain
  const domain = SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}`;
}

/**
 * Make authenticated request to Shopify Admin API
 * @param {string} endpoint - API endpoint (e.g., '/orders.json')
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<object>} Response JSON
 */
export async function callShopifyAdmin(endpoint, options = {}) {
  const baseUrl = getShopifyAdminBase();
  const url = `${baseUrl}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify Admin API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Get order by ID from Shopify Admin API
 * @param {string|number} orderId - Shopify order ID
 * @returns {Promise<object>} Order object
 */
export async function getOrder(orderId) {
  const response = await callShopifyAdmin(`/orders/${orderId}.json`);
  return response.order;
}

/**
 * Update order in Shopify (if needed in future)
 * @param {string|number} orderId - Shopify order ID
 * @param {object} orderData - Order data to update
 * @returns {Promise<object>} Updated order
 */
export async function updateOrder(orderId, orderData) {
  const response = await callShopifyAdmin(`/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ order: orderData }),
  });
  return response.order;
}

