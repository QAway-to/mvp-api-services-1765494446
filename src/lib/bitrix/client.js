/**
 * Bitrix24 REST API Client
 * Handles all API calls to Bitrix24
 */

/**
 * Call Bitrix24 REST API method
 * @param {string} webhookUrl - Base webhook URL (e.g., https://domain.bitrix24.eu/rest/52/xxx/)
 * @param {string} method - API method (e.g., 'crm.deal.add')
 * @param {Object} params - Method parameters
 * @returns {Promise<Object>} API response
 */
export async function callBitrixAPI(webhookUrl, method, params = {}) {
  // Ensure webhook URL ends with / and method ends with .json
  const baseUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`;
  const methodSuffix = method.endsWith('.json') ? method : `${method}.json`;
  const url = `${baseUrl}${methodSuffix}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Bitrix API error: ${JSON.stringify(result)}`);
    }

    if (result.error) {
      throw new Error(`Bitrix API error: ${result.error_description || result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`[BITRIX API] Error calling ${method}:`, error);
    throw error;
  }
}

/**
 * Get Bitrix webhook base URL from environment or use default
 */
export function getBitrixWebhookBase() {
  // Get from environment variable
  if (process.env.BITRIX_WEBHOOK_BASE) {
    const base = process.env.BITRIX_WEBHOOK_BASE;
    return base.endsWith('/') ? base : `${base}/`;
  }
  
  // Fallback to old env variable
  if (process.env.BITRIX_WEBHOOK_URL) {
    const url = process.env.BITRIX_WEBHOOK_URL;
    return url.endsWith('/') ? url : `${url}/`;
  }
  
  // Hardcoded webhook base URL
  return 'https://bfcshoes.bitrix24.eu/rest/52/i6l05o71ywxb8j1l/';
}

/**
 * Call Bitrix24 REST API method (simplified wrapper)
 * @param {string} method - API method (e.g., '/crm.deal.add.json')
 * @param {Object} payload - Method parameters
 * @returns {Promise<Object>} API response
 */
export async function callBitrix(method, payload = {}) {
  const baseUrl = getBitrixWebhookBase();
  const methodPath = method.startsWith('/') ? method : `/${method}`;
  const url = `${baseUrl}${methodPath}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Bitrix API error: ${JSON.stringify(result)}`);
    }

    if (result.error) {
      throw new Error(`Bitrix API error: ${result.error_description || result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`[BITRIX API] Error calling ${method}:`, error);
    throw error;
  }
}

/**
 * Get Bitrix webhook URL from environment or use default (legacy support)
 */
export function getBitrixWebhookUrl() {
  return getBitrixWebhookBase();
}

