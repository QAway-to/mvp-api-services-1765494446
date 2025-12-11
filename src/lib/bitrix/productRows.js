/**
 * Bitrix24 Deal Product Rows Management
 * Handles product rows for deals
 */

import { callBitrixAPI } from './client.js';
import { BITRIX_CONFIG } from './config.js';

/**
 * Map Shopify line item to Bitrix product row
 * @param {Object} lineItem - Shopify line item
 * @param {Object} order - Shopify order
 * @returns {Object|null} Bitrix product row or null if SKU not found
 */
function mapLineItemToProductRow(lineItem, order) {
  const sku = lineItem.sku;
  
  if (!sku) {
    console.warn(`[BITRIX PRODUCT ROWS] Line item ${lineItem.id} has no SKU, skipping`);
    return null;
  }

  const productId = BITRIX_CONFIG.SKU_TO_PRODUCT_ID[sku];

  if (!productId) {
    console.warn(`[BITRIX PRODUCT ROWS] SKU ${sku} not found in mapping, skipping`);
    return null;
  }

  // Parse price
  const price = typeof lineItem.price === 'string' 
    ? parseFloat(lineItem.price) 
    : (lineItem.price || 0);

  // Get tax rate from line item or order
  let taxRate = 0;
  if (lineItem.tax_lines && lineItem.tax_lines.length > 0) {
    taxRate = (lineItem.tax_lines[0].rate || 0) * 100;
  } else if (order.tax_lines && order.tax_lines.length > 0) {
    taxRate = (order.tax_lines[0].rate || 0) * 100;
  }

  return {
    PRODUCT_ID: productId,
    PRICE: price,
    QUANTITY: lineItem.quantity || 1,
    TAX_INCLUDED: order.taxes_included ? 'Y' : 'N',
    TAX_RATE: taxRate
  };
}

/**
 * Create product rows array from Shopify order
 * @param {Object} order - Shopify order
 * @returns {Array<Object>} Array of product rows
 */
export function createProductRowsFromOrder(order) {
  const rows = [];

  // Process line items
  if (order.line_items && Array.isArray(order.line_items)) {
    for (const lineItem of order.line_items) {
      const row = mapLineItemToProductRow(lineItem, order);
      if (row) {
        rows.push(row);
      }
    }
  }

  // Add shipping as separate product row if configured
  if (BITRIX_CONFIG.SHIPPING_PRODUCT_ID > 0 && order.shipping_lines && order.shipping_lines.length > 0) {
    const shippingLine = order.shipping_lines[0];
    const shippingPrice = typeof shippingLine.price === 'string'
      ? parseFloat(shippingLine.price)
      : (shippingLine.price || 0);

    if (shippingPrice > 0) {
      rows.push({
        PRODUCT_ID: BITRIX_CONFIG.SHIPPING_PRODUCT_ID,
        PRICE: shippingPrice,
        QUANTITY: 1,
        TAX_INCLUDED: order.taxes_included ? 'Y' : 'N',
        TAX_RATE: 0 // Shipping usually doesn't have tax
      });
    }
  }

  return rows;
}

/**
 * Set product rows for a deal
 * @param {string} webhookUrl - Bitrix webhook URL
 * @param {number} dealId - Deal ID
 * @param {Array<Object>} rows - Product rows array
 * @returns {Promise<boolean>} Success status
 */
export async function setBitrixDealProductRows(webhookUrl, dealId, rows) {
  if (!rows || rows.length === 0) {
    console.log('[BITRIX PRODUCT ROWS] No product rows to set');
    return true; // Not an error, just nothing to do
  }

  try {
    const result = await callBitrixAPI(webhookUrl, 'crm.deal.productrows.set', {
      id: dealId,
      rows: rows
    });

    if (result.result) {
      console.log(`[BITRIX PRODUCT ROWS] Successfully set ${rows.length} product rows for deal ${dealId}`);
      return true;
    }

    console.error('[BITRIX PRODUCT ROWS] Failed to set product rows:', result);
    return false;
  } catch (error) {
    console.error('[BITRIX PRODUCT ROWS] Error setting product rows:', error);
    return false;
  }
}

