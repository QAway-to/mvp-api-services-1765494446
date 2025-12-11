// Shopify Webhook Adapter
// In-memory storage for received events
let receivedEvents = [];

/**
 * Shopify Webhook Adapter
 * Handles Shopify webhook events storage and retrieval
 */
export class ShopifyAdapter {
  constructor() {
    this.storage = receivedEvents; // Reference to in-memory array
  }

  getName() {
    return 'shopify';
  }

  /**
   * Validate Shopify webhook payload against simplified schema
   * @param {Object} payload - Webhook payload to validate
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validateWebhookPayload(payload) {
    const errors = [];
    
    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['Payload must be an object'] };
    }

    // Check required top-level fields (simplified validation)
    if (payload.id !== undefined && typeof payload.id !== 'number') {
      errors.push('id must be a number');
    }
    
    if (payload.email !== undefined && typeof payload.email !== 'string') {
      errors.push('email must be a string');
    }
    
    if (payload.created_at !== undefined && typeof payload.created_at !== 'string') {
      errors.push('created_at must be a string');
    }
    
    if (payload.currency !== undefined && typeof payload.currency !== 'string') {
      errors.push('currency must be a string');
    }
    
    if (payload.total_price !== undefined && typeof payload.total_price !== 'string') {
      errors.push('total_price must be a string');
    }

    // Validate line_items if present
    if (payload.line_items !== undefined) {
      if (!Array.isArray(payload.line_items)) {
        errors.push('line_items must be an array');
      } else {
        payload.line_items.forEach((item, index) => {
          if (item.id !== undefined && typeof item.id !== 'number') {
            errors.push(`line_items[${index}].id must be a number`);
          }
          if (item.quantity !== undefined && typeof item.quantity !== 'number') {
            errors.push(`line_items[${index}].quantity must be a number`);
          }
          if (item.title !== undefined && typeof item.title !== 'string') {
            errors.push(`line_items[${index}].title must be a string`);
          }
          if (item.price !== undefined && typeof item.price !== 'string') {
            errors.push(`line_items[${index}].price must be a string`);
          }
          if (item.sku !== undefined && typeof item.sku !== 'string') {
            errors.push(`line_items[${index}].sku must be a string`);
          }
        });
      }
    }

    // Validate discount_codes if present
    if (payload.discount_codes !== undefined) {
      if (!Array.isArray(payload.discount_codes)) {
        errors.push('discount_codes must be an array');
      } else {
        payload.discount_codes.forEach((code, index) => {
          if (code.code !== undefined && typeof code.code !== 'string') {
            errors.push(`discount_codes[${index}].code must be a string`);
          }
          if (code.amount !== undefined && typeof code.amount !== 'string') {
            errors.push(`discount_codes[${index}].amount must be a string`);
          }
          if (code.type !== undefined && typeof code.type !== 'string') {
            errors.push(`discount_codes[${index}].type must be a string`);
          }
        });
      }
    }

    // Validate customer if present
    if (payload.customer !== undefined) {
      if (typeof payload.customer !== 'object') {
        errors.push('customer must be an object');
      } else {
        if (payload.customer.id !== undefined && typeof payload.customer.id !== 'number') {
          errors.push('customer.id must be a number');
        }
        if (payload.customer.first_name !== undefined && typeof payload.customer.first_name !== 'string') {
          errors.push('customer.first_name must be a string');
        }
        if (payload.customer.last_name !== undefined && typeof payload.customer.last_name !== 'string') {
          errors.push('customer.last_name must be a string');
        }
        if (payload.customer.email !== undefined && typeof payload.customer.email !== 'string') {
          errors.push('customer.email must be a string');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Store webhook event
   * @param {Object} payload - Validated webhook payload
   * @returns {Object} Stored event with timestamp
   */
  storeEvent(payload) {
    // Generate unique event ID (timestamp + random to ensure uniqueness)
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const event = {
      ...payload,
      received_at: new Date().toISOString(),
      id: uniqueId, // Unique ID for each event
      eventId: uniqueId, // Also store as eventId for clarity
      orderId: payload.id || null // Store original order ID separately
    };
    
    this.storage.push(event);
    return event;
  }

  /**
   * Get all events (newest first, deduplicated by orderId + received_at)
   * @returns {Array<Object>} All stored events
   */
  getAllEvents() {
    // Remove duplicates: keep only the latest event for each unique orderId
    const seen = new Map();
    const uniqueEvents = [];
    
    // Process in reverse order (newest first) and keep only the first occurrence
    for (let i = this.storage.length - 1; i >= 0; i--) {
      const event = this.storage[i];
      const orderId = event.orderId || event.id;
      
      // If we haven't seen this orderId yet, or this event is newer, keep it
      if (!seen.has(orderId)) {
        seen.set(orderId, event);
        uniqueEvents.unshift(event); // Add to beginning to maintain newest-first order
      }
    }
    
    return uniqueEvents;
  }

  /**
   * Get latest event
   * @returns {Object|null} Latest event or null
   */
  getLatestEvent() {
    if (this.storage.length === 0) {
      return null;
    }
    return this.storage[this.storage.length - 1];
  }

  /**
   * Get events count
   * @returns {number} Number of stored events
   */
  getEventsCount() {
    return this.storage.length;
  }

  /**
   * Clear all events (for testing/reset)
   * @returns {number} Number of cleared events
   */
  clearEvents() {
    const count = this.storage.length;
    this.storage.length = 0;
    return count;
  }

  /**
   * Transform Shopify order to Bitrix24 crm.deal.add format
   * @param {Object} shopifyOrder - Shopify webhook order data
   * @returns {Object} Bitrix24 deal format
   */
  transformToBitrix(shopifyOrder) {
    if (!shopifyOrder || typeof shopifyOrder !== 'object') {
      throw new Error('Invalid Shopify order data');
    }

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

    // Calculate totals - use real data from Shopify
    const totalPrice = parseNumber(shopifyOrder.total_price || shopifyOrder.total_price_set?.shop_money?.amount);
    const totalTax = parseNumber(shopifyOrder.total_tax || shopifyOrder.total_tax_set?.shop_money?.amount);
    
    // Calculate total discount from discount codes or discount_amount
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
      shopifyOrder.total_shipping_price_set?.amount
    );

    // Format line items - use real data from Shopify
    const lineItems = shopifyOrder.line_items && Array.isArray(shopifyOrder.line_items)
      ? shopifyOrder.line_items.map(item => ({
          id: item.id || null,
          title: item.title || item.name || null,
          quantity: item.quantity || null,
          price: parseNumber(item.price || item.price_set?.shop_money?.amount),
          sku: item.sku || null,
          variant_id: item.variant_id || item.variant_id || null,
          product_id: item.product_id || null
        }))
      : null;

    // Customer name - use real data
    const customerName = shopifyOrder.customer
      ? `${getValue(shopifyOrder.customer.first_name) || ''} ${getValue(shopifyOrder.customer.last_name) || ''}`.trim() || null
      : (shopifyOrder.billing_address 
          ? `${getValue(shopifyOrder.billing_address.first_name) || ''} ${getValue(shopifyOrder.billing_address.last_name) || ''}`.trim() || null
          : null);

    // Customer email - use real data
    const customerEmail = shopifyOrder.customer?.email || 
                         shopifyOrder.email || 
                         shopifyOrder.billing_address?.email || 
                         null;

    // Order title - use real order number or name
    const orderTitle = shopifyOrder.order_number 
      ? `#${shopifyOrder.order_number}`
      : (shopifyOrder.name || `Order #${shopifyOrder.id || 'Unknown'}`);

    // Build Bitrix24 deal structure with real data
    const bitrixDeal = {
      fields: {
        TITLE: orderTitle,
        TYPE_ID: null, // Not available in Shopify order
        STAGE_ID: null, // Not available in Shopify order
        CATEGORY_ID: null, // Not available in Shopify order
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
        CONTACT_ID: null, // Not available in Shopify order
        COMPANY_ID: null, // Not available in Shopify order
        BEGINDATE: formatDate(shopifyOrder.created_at),
        CLOSEDATE: formatDate(shopifyOrder.updated_at || shopifyOrder.created_at),
        SOURCE_ID: null, // Not available in Shopify order
        SOURCE_DESCRIPTION: getValue(shopifyOrder.source_name) || null
      }
    };

    return bitrixDeal;
  }
}

// Export singleton instance
export const shopifyAdapter = new ShopifyAdapter();

