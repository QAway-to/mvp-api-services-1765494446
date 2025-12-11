/**
 * Map Shopify Order to Bitrix24 Deal Fields
 */

import { BITRIX_CONFIG, financialStatusToStageId, sourceNameToSourceId } from './config.js';

/**
 * Map Shopify order to Bitrix24 deal fields
 * @param {Object} shopifyOrder - Shopify order object
 * @param {number|null} contactId - Bitrix contact ID (if available)
 * @returns {Object} Bitrix24 deal fields object
 */
export function mapShopifyOrderToBitrixDealFields(shopifyOrder, contactId = null) {
  // Helper function to safely get value or null
  const getValue = (value, transform = null) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return transform ? transform(value) : value;
  };

  // Helper to parse number from string
  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? null : num;
  };

  // Helper to format date
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return null;
    }
  };

  // Calculate totals
  const totalPrice = parseNumber(shopifyOrder.total_price || shopifyOrder.total_price_set?.shop_money?.amount);
  const totalTax = parseNumber(shopifyOrder.total_tax || shopifyOrder.total_tax_set?.shop_money?.amount);
  
  // Calculate total discount
  let totalDiscount = null;
  if (shopifyOrder.discount_codes && Array.isArray(shopifyOrder.discount_codes) && shopifyOrder.discount_codes.length > 0) {
    totalDiscount = shopifyOrder.discount_codes.reduce((sum, code) => {
      const amount = parseNumber(code.amount);
      return sum + (amount || 0);
    }, 0);
    if (totalDiscount === 0) totalDiscount = null;
  } else if (shopifyOrder.total_discounts) {
    totalDiscount = parseNumber(shopifyOrder.total_discounts);
  }
  
  const shippingPrice = parseNumber(
    shopifyOrder.total_shipping_price_set?.shop_money?.amount || 
    shopifyOrder.shipping_price || 
    shopifyOrder.total_shipping_price_set?.amount ||
    (shopifyOrder.shipping_lines?.[0]?.price)
  );

  // Format line items for UF field
  const lineItems = shopifyOrder.line_items && Array.isArray(shopifyOrder.line_items)
    ? shopifyOrder.line_items.map(item => ({
        id: item.id || null,
        title: item.title || item.name || null,
        quantity: item.quantity || null,
        price: parseNumber(item.price || item.price_set?.shop_money?.amount),
        sku: item.sku || null,
        variant_id: item.variant_id || null,
        product_id: item.product_id || null
      }))
    : null;

  // Customer name
  const customerName = shopifyOrder.customer
    ? `${getValue(shopifyOrder.customer.first_name) || ''} ${getValue(shopifyOrder.customer.last_name) || ''}`.trim() || null
    : (shopifyOrder.billing_address 
        ? `${getValue(shopifyOrder.billing_address.first_name) || ''} ${getValue(shopifyOrder.billing_address.last_name) || ''}`.trim() || null
        : null);

  // Customer email
  const customerEmail = shopifyOrder.customer?.email || 
                       shopifyOrder.email || 
                       shopifyOrder.billing_address?.email || 
                       null;

  // Order title
  const orderTitle = shopifyOrder.order_number 
    ? `#${shopifyOrder.order_number}`
    : (shopifyOrder.name || `Order #${shopifyOrder.id || 'Unknown'}`);

  // Map financial status to stage ID
  const stageId = financialStatusToStageId(shopifyOrder.financial_status);

  // Map source name to source ID
  const sourceId = sourceNameToSourceId(shopifyOrder.source_name);

  // Build Bitrix24 deal fields
  const fields = {
    TITLE: orderTitle,
    TYPE_ID: null, // Not available in Shopify order
    STAGE_ID: stageId || null,
    CATEGORY_ID: BITRIX_CONFIG.CATEGORY_ID > 0 ? BITRIX_CONFIG.CATEGORY_ID : null,
    CURRENCY_ID: getValue(shopifyOrder.currency) || null,
    OPPORTUNITY: totalPrice,
    ASSIGNED_BY_ID: null, // Not available in Shopify order
    COMMENTS: getValue(shopifyOrder.note) || null,
    UF_SHOPIFY_ORDER_ID: getValue(shopifyOrder.id?.toString()) || null,
    UF_SHOPIFY_CUSTOMER_EMAIL: customerEmail,
    UF_SHOPIFY_CUSTOMER_NAME: customerName,
    UF_SHOPIFY_LINE_ITEMS: lineItems,
    UF_SHOPIFY_TOTAL_TAX: totalTax,
    UF_SHOPIFY_TOTAL_DISCOUNT: totalDiscount,
    UF_SHOPIFY_SHIPPING_PRICE: shippingPrice,
    CONTACT_ID: contactId,
    COMPANY_ID: null, // Not available in Shopify order
    BEGINDATE: formatDate(shopifyOrder.created_at),
    CLOSEDATE: formatDate(shopifyOrder.updated_at || shopifyOrder.created_at),
    SOURCE_ID: sourceId,
    SOURCE_DESCRIPTION: getValue(shopifyOrder.source_name) || null
  };

  return fields;
}

