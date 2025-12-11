/**
 * Map Shopify Order to Bitrix24 Deal
 * Returns both deal fields and product rows
 */

import { BITRIX_CONFIG, financialStatusToStageId, financialStatusToPaymentStatus, sourceNameToSourceId } from './config.js';
import skuMapping from './skuMapping.json' assert { type: 'json' };
import handleMapping from './handleMapping.json' assert { type: 'json' };
import brandMapping from './brandMapping.json' assert { type: 'json' };
import { resolveResponsibleId } from './responsible.js';

/**
 * Parse model name from product title
 * Example: "Wellie Paint KL tractor blue Barefoot Kids Rubber Boots" → "Wellie Paint KL"
 * @param {string} title - Product title from Shopify
 * @returns {string|null} Model name or null
 */
function parseModelFromTitle(title) {
  if (!title || typeof title !== 'string') return null;
  
  // Common patterns: "Brand Model Color Type" or "Model Color Type"
  // Try to extract model (usually first 2-3 words before color)
  const words = title.split(/\s+/);
  
  // Look for color keywords to split model from color
  const colorKeywords = ['blue', 'red', 'green', 'yellow', 'black', 'white', 'pink', 'fuchsia', 'violet', 'cyan', 'tractor', 'flowers'];
  let modelEndIndex = words.length;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (colorKeywords.some(keyword => word.includes(keyword))) {
      modelEndIndex = i;
      break;
    }
  }
  
  // Extract model (first part before color)
  if (modelEndIndex > 0) {
    return words.slice(0, modelEndIndex).join(' ').trim() || null;
  }
  
  // Fallback: return first 2-3 words
  return words.slice(0, Math.min(3, words.length)).join(' ').trim() || null;
}

/**
 * Parse color from product title or properties
 * @param {string} title - Product title
 * @param {Array} properties - Product properties array
 * @returns {string|null} Color name or null
 */
function parseColorFromTitle(title, properties = []) {
  // First try properties
  const colorProperty = properties.find(p => 
    p.name && (
      p.name.toLowerCase().includes('color') || 
      p.name.toLowerCase().includes('цвет')
    )
  );
  if (colorProperty?.value) {
    return colorProperty.value.trim();
  }
  
  // Then try to extract from title
  if (!title || typeof title !== 'string') return null;
  
  const colorKeywords = {
    'blue': 'blue',
    'red': 'red',
    'green': 'green',
    'yellow': 'yellow',
    'black': 'black',
    'white': 'white',
    'pink': 'pink',
    'fuchsia': 'fuchsia',
    'violet': 'violet',
    'cyan': 'cyan',
    'tractor blue': 'tractor blue',
    'flowers': 'flowers'
  };
  
  const titleLower = title.toLowerCase();
  for (const [keyword, color] of Object.entries(colorKeywords)) {
    if (titleLower.includes(keyword)) {
      return color;
    }
  }
  
  return null;
}

/**
 * Map Shopify order to Bitrix24 deal fields and product rows
 * @param {Object} order - Shopify order object
 * @returns {Object} { dealFields, productRows }
 */
export function mapShopifyOrderToBitrixDeal(order) {
  // Aggregates
  const totalPrice = Number(order.current_total_price || order.total_price || 0);
  const totalDiscount = Number(order.current_total_discounts || order.total_discounts || 0);
  const totalTax = Number(order.current_total_tax || 0);
  const shippingPrice = Number(
    order.current_total_shipping_price_set?.shop_money?.amount ||
    order.total_shipping_price_set?.shop_money?.amount ||
    order.shipping_price ||
    order.shipping_lines?.[0]?.price ||
    0
  );

  // Determine category based on order tags (pre-order tags → cat_8, otherwise cat_2)
  const orderTags = Array.isArray(order.tags) 
    ? order.tags 
    : (order.tags ? String(order.tags).split(',').map(t => t.trim()) : []);
  
  const preorderTags = ['pre-order', 'preorder-product-added'];
  const hasPreorderTag = orderTags.some(tag => 
    preorderTags.some(preorderTag => tag.toLowerCase() === preorderTag.toLowerCase())
  );
  
  const categoryId = hasPreorderTag ? BITRIX_CONFIG.CATEGORY_PREORDER : BITRIX_CONFIG.CATEGORY_STOCK;
  console.log(`[ORDER MAPPER] Category determined: ${categoryId} (${hasPreorderTag ? 'Pre-order' : 'Stock'}) based on tags:`, orderTags);

  // Customer name
  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || null
    : null;

  // Map financial status to stage ID (based on category)
  const stageId = financialStatusToStageId(order.financial_status, categoryId);
  console.log(`[ORDER MAPPER] Financial status "${order.financial_status}" → Stage "${stageId}" for category ${categoryId}`);
  
  // Map financial status to payment status field
  const paymentStatusEnumId = financialStatusToPaymentStatus(order.financial_status);
  console.log(`[ORDER MAPPER] Financial status "${order.financial_status}" → Payment status enum ID "${paymentStatusEnumId}"`);
  
  // Map source name to source ID
  const sourceId = sourceNameToSourceId(order.source_name);
  const sourceName = hasPreorderTag ? 'pre-order (site)' : 'stock (site)';

  // Determine order type based on source and pre-order status
  // Bitrix field: UF_CRM_1739183268662 (enumeration)
  // Values: "44" = "online (stock)", "46" = "ofline (stock)", "48" = "online (pre-order)", "50" = "ofline (pre-order)"
  let orderTypeId = null;
  if (order.source_name === 'pos') {
    orderTypeId = hasPreorderTag ? '50' : '46'; // ofline (pre-order) or ofline (stock)
  } else {
    orderTypeId = hasPreorderTag ? '48' : '44'; // online (pre-order) or online (stock)
  }
  console.log(`[ORDER MAPPER] Order type determined: ID "${orderTypeId}" (source: ${order.source_name}, preorder: ${hasPreorderTag})`);

  // Determine delivery method from shipping_lines
  // Bitrix field: UF_CRM_1739183302609 (enumeration)
  // Values: "52" = "Pick up in shop", "54" = "Delivery by courier"
  let deliveryMethodId = null;
  if (order.shipping_lines && Array.isArray(order.shipping_lines) && order.shipping_lines.length > 0) {
    const shippingLine = order.shipping_lines[0];
    // Check if it's pickup (shop pickup, store pickup, etc.)
    const shippingTitle = (shippingLine.title || shippingLine.code || '').toLowerCase();
    const shippingCode = (shippingLine.code || '').toLowerCase();
    
    if (shippingTitle.includes('pick') || shippingTitle.includes('shop') || 
        shippingCode.includes('pick') || shippingCode.includes('shop') ||
        shippingTitle.includes('самовывоз') || shippingTitle.includes('магазин')) {
      deliveryMethodId = '52'; // Pick up in shop
    } else {
      deliveryMethodId = '54'; // Delivery by courier
    }
  } else {
    // Also check fulfillment status for pickup
    if (order.fulfillment_status) {
      const fulfillmentStatus = String(order.fulfillment_status).toLowerCase();
      if (fulfillmentStatus.includes('pick') || fulfillmentStatus.includes('shop')) {
        deliveryMethodId = '52'; // Pick up in shop
      } else {
        deliveryMethodId = '54'; // Delivery by courier
      }
    } else if (shippingPrice > 0) {
      // Default to courier delivery if shipping price > 0
      deliveryMethodId = '54'; // Delivery by courier
    }
  }
  
  console.log(`[ORDER MAPPER] Delivery method determined: ID "${deliveryMethodId}"`);

  // Deal fields (matching Python script structure)
  const dealFields = {
    TITLE: order.name || `Order #${order.id}`,
    OPPORTUNITY: totalPrice, // Final amount as in Shopify
    CURRENCY_ID: order.currency || 'EUR',
    COMMENTS: `Shopify order ${order.name || order.id}`,
    CATEGORY_ID: categoryId, // 2 = Stock (site), 8 = Pre-order (site)
    STAGE_ID: stageId,
    SOURCE_ID: sourceId || 'WEB', // Default to 'WEB' if not mapped
    SOURCE_DESCRIPTION: sourceName,

    // Key to Shopify order
    UF_SHOPIFY_ORDER_ID: String(order.id),
    UF_SHOPIFY_CUSTOMER_EMAIL: order.email || order.customer?.email || null,
    UF_SHOPIFY_CUSTOMER_NAME: customerName,

    // Order type (enumeration) - UF_CRM_1739183268662
    // Values: "44" = "online (stock)", "46" = "ofline (stock)", "48" = "online (pre-order)", "50" = "ofline (pre-order)"
    UF_CRM_1739183268662: orderTypeId,

    // Delivery method (enumeration) - UF_CRM_1739183302609
    // Values: "52" = "Pick up in shop", "54" = "Delivery by courier"
    // Only set if determined, otherwise leave empty (Bitrix will show empty)
    ...(deliveryMethodId ? { UF_CRM_1739183302609: deliveryMethodId } : {}),

    // Payment status (enumeration) - UF_CRM_1739183959976
    // Values: "56" = "Paid", "58" = "Unpaid", "60" = "10% prepayment"
    UF_CRM_1739183959976: paymentStatusEnumId,

    // Aggregates for reports (as in Python script) - always set, even if 0
    UF_SHOPIFY_TOTAL_DISCOUNT: totalDiscount || 0,
    UF_SHOPIFY_SHIPPING_PRICE: shippingPrice || 0,
    UF_SHOPIFY_TOTAL_TAX: totalTax || 0,
  };
  
  // Log all fields being sent for debugging
  console.log(`[ORDER MAPPER] Deal fields prepared:`, {
    ORDER_TYPE_ID: orderTypeId,
    DELIVERY_METHOD_ID: deliveryMethodId,
    PAYMENT_STATUS_ID: paymentStatusEnumId,
    CATEGORY_ID: categoryId,
    STAGE_ID: stageId
  });

  // Resolve responsible: assign explicitly on create per mapping (Bitrix can reassign later)
  const assigneeId = resolveResponsibleId(order);
  if (assigneeId) {
    dealFields.ASSIGNED_BY_ID = assigneeId;
  }

  // Extract product properties from ALL line_items for UF-fields
  // Aggregate Size and Color across all positions to preserve ordering
  if (order.line_items && Array.isArray(order.line_items) && order.line_items.length > 0) {
    const lineItems = order.line_items;
    const itemsCount = lineItems.length;

    console.log(`[ORDER MAPPER] Processing ${itemsCount} line_item(s) for UF-fields`);

    // ===== SIZE AGGREGATION =====
    if (itemsCount === 1) {
      const firstItem = lineItems[0];
      let sizeValue = null;
      if (firstItem.variant_title) {
        sizeValue = String(firstItem.variant_title).trim();
        console.log(`[ORDER MAPPER] Size from variant_title (single): "${sizeValue}"`);
      } else if (firstItem.name) {
        const nameParts = firstItem.name.split(' - ');
        if (nameParts.length > 1) {
          sizeValue = nameParts[nameParts.length - 1].trim();
          console.log(`[ORDER MAPPER] Size from name (single): "${sizeValue}"`);
        }
      }
      if (sizeValue) {
        dealFields.UF_CRM_1739793720585 = sizeValue;
        console.log(`[ORDER MAPPER] ✅ Size (single) UF_CRM_1739793720585 = "${sizeValue}"`);
      }
    } else {
      const sizeParts = [];
      for (let i = 0; i < itemsCount; i++) {
        const item = lineItems[i];
        const position = i + 1;
        let sizeValue = null;
        if (item.variant_title) {
          sizeValue = String(item.variant_title).trim();
        } else if (item.name) {
          const nameParts = item.name.split(' - ');
          if (nameParts.length > 1) {
            sizeValue = nameParts[nameParts.length - 1].trim();
          }
        }
        const sizeDisplay = sizeValue || '-';
        sizeParts.push(`${position}: ${sizeDisplay}`);
      }
      if (sizeParts.length > 0) {
        dealFields.UF_CRM_1739793720585 = sizeParts.join('; ');
        console.log(`[ORDER MAPPER] ✅ Size (aggregated) UF_CRM_1739793720585 = "${dealFields.UF_CRM_1739793720585}"`);
      }
    }

    // ===== COLOR AGGREGATION =====
    if (itemsCount === 1) {
      const firstItem = lineItems[0];
      const color = parseColorFromTitle(firstItem.title, firstItem.properties || []);
      if (color) {
        dealFields.UF_CRM_1739793651654 = color;
        console.log(`[ORDER MAPPER] ✅ Color (single) UF_CRM_1739793651654 = "${color}"`);
      }
    } else {
      const colorParts = [];
      for (let i = 0; i < itemsCount; i++) {
        const item = lineItems[i];
        const position = i + 1;
        const color = parseColorFromTitle(item.title, item.properties || []);
        const colorDisplay = color || '-';
        colorParts.push(`${position}: ${colorDisplay}`);
      }
      if (colorParts.length > 0) {
        dealFields.UF_CRM_1739793651654 = colorParts.join('; ');
        console.log(`[ORDER MAPPER] ✅ Color (aggregated) UF_CRM_1739793651654 = "${dealFields.UF_CRM_1739793651654}"`);
      }
    }

    // ===== MODEL AND BRAND (first item as reference) =====
    const firstItem = lineItems[0];

    const model = parseModelFromTitle(firstItem.title);
    if (model) {
      dealFields.UF_CRM_1739793668182 = model;
    }

    if (firstItem.vendor) {
      const vendorUpper = String(firstItem.vendor).toUpperCase().trim();
      const brandId = brandMapping[vendorUpper];
      if (brandId) {
        dealFields.UF_CRM_1741642513658 = brandId; // Enum field - use ID
      } else {
        console.warn(`[ORDER MAPPER] Brand "${vendorUpper}" not found in brandMapping.json, skipping UF_CRM_1741642513658`);
      }
    }

    console.log(`[ORDER MAPPER] Extracted UF-fields:`, {
      size: dealFields.UF_CRM_1739793720585 || 'N/A',
      color: dealFields.UF_CRM_1739793651654 || 'N/A',
      model: dealFields.UF_CRM_1739793668182 || 'N/A',
      brand: dealFields.UF_CRM_1741642513658 || 'N/A'
    });
  } else {
    console.warn(`[ORDER MAPPER] ⚠️ No line_items found in order, cannot extract product properties`);
  }
  
  // Log all UF-fields that will be sent to Bitrix
  const ufFields = Object.keys(dealFields).filter(key => key.startsWith('UF_'));
  console.log(`[ORDER MAPPER] All UF-fields in dealFields:`, ufFields.map(key => ({
    field: key,
    value: dealFields[key]
  })));

  // Product rows
  const productRows = [];
  
  // Shipping variables (defined early for final validation)
  let actualShippingPrice = 0;
  let shippingLineTitle = null;

  if (order.line_items && Array.isArray(order.line_items)) {
    // Get shipping product ID to avoid confusion
    const shippingProductId = BITRIX_CONFIG.SHIPPING_PRODUCT_ID > 0 
      ? BITRIX_CONFIG.SHIPPING_PRODUCT_ID 
      : 3000; // Default shipping product ID
    
    for (const item of order.line_items) {
      // CRITICAL: line_items are ALWAYS products, NEVER shipping
      // Even if a product has the same ID as shipping, it's still a product from line_items
      
      // Try SKU mapping first
      const productIdFromFile = item.sku ? skuMapping[item.sku] : null;
      const productIdFromConfig = item.sku ? BITRIX_CONFIG.SKU_TO_PRODUCT_ID[item.sku] : null;

      // Try handle-based mapping (with a small normalization removing "barefoot-")
      const rawHandle = item.handle || item.product_handle || null;
      const normHandle = rawHandle ? rawHandle.toLowerCase().replace('barefoot-', '') : null;
      const productIdFromHandle = normHandle ? (handleMapping[normHandle] || handleMapping[rawHandle]) : null;

      let productId = productIdFromFile || productIdFromHandle || productIdFromConfig || null;
      
      // Safety check: if product ID matches shipping ID, log warning but keep it as product
      // (line_items are always products, even if they accidentally have shipping ID)
      if (productId && productId == shippingProductId) {
        console.warn(`[ORDER MAPPER] WARNING: Product from line_items (SKU: ${item.sku || 'N/A'}, Title: ${item.title || 'N/A'}) has PRODUCT_ID ${productId} which matches shipping ID. Treating as product (not shipping).`);
      }

      // Extract size and properties from Shopify line_item
      // variant_title usually contains the size (e.g., "31", "36-39", "S", "M")
      const variantTitle = item.variant_title || null;
      
      // Extract properties (array of {name, value} objects)
      const properties = item.properties || [];
      const sizeProperty = properties.find(p => 
        p.name && (
          p.name.toLowerCase().includes('size') || 
          p.name.toLowerCase().includes('размер') ||
          p.name.toLowerCase() === 'size'
        )
      );
      const colorProperty = properties.find(p => 
        p.name && (
          p.name.toLowerCase().includes('color') || 
          p.name.toLowerCase().includes('цвет') ||
          p.name.toLowerCase() === 'color'
        )
      );
      
      // Get size from variant_title or properties
      const size = variantTitle || sizeProperty?.value || null;
      
      // Build descriptive name with size/variant/vendor/color/model if available
      const parts = [item.title || ''];
      
      // Add size if available (most important - should be visible)
      if (size) {
        parts.push(`Size: ${size}`);
      }
      
      // Add color if available
      if (colorProperty?.value) {
        parts.push(`Color: ${colorProperty.value}`);
      }
      
      // Add other options if they differ from variant_title
      if (item.option1 && item.option1 !== variantTitle && item.option1 !== size) {
        parts.push(item.option1);
      }
      if (item.option2 && item.option2 !== variantTitle && item.option2 !== size) {
        parts.push(item.option2);
      }
      if (item.option3) {
        parts.push(item.option3);
      }
      
      // Add vendor/brand if available
      if (item.vendor) {
        parts.push(`Brand: ${item.vendor}`);
      }
      
      // Join all parts with separator
      const productName = parts.filter(Boolean).join(' | ');

      // Prices and discounts
      const priceBrutto = Number(item.price || item.price_set?.shop_money?.amount || 0);
      const discountAmount = Number(
        item.discount_allocations?.[0]?.amount ||
        item.discount_allocations?.[0]?.amount_set?.shop_money?.amount ||
        item.total_discount ||
        0
      );
      const priceAfterDiscount = priceBrutto - discountAmount;
      const discountRate = priceBrutto > 0 ? (discountAmount / priceBrutto) * 100 : 0;

      // Tax
      let taxRate = 19.0;
      if (item.tax_lines && item.tax_lines.length > 0) {
        taxRate = Number(item.tax_lines[0].rate || 0) * 100;
      } else if (order.tax_lines && order.tax_lines.length > 0) {
        taxRate = Number(order.tax_lines[0].rate || 0) * 100;
      }

      const quantity = Number(item.quantity || 1);

      // Add one row per quantity
      // IMPORTANT: Always include PRODUCT_NAME even when PRODUCT_ID is set
      // This ensures size and properties are visible in Bitrix24 product card
      for (let i = 0; i < quantity; i++) {
        const row = {
          PRICE: priceAfterDiscount,
          PRICE_BRUTTO: priceBrutto,
          QUANTITY: 1,
          DISCOUNT_TYPE_ID: 1,
          DISCOUNT_SUM: discountAmount,
          DISCOUNT_RATE: discountRate,
          TAX_INCLUDED: order.taxes_included ? 'Y' : 'N',
          TAX_RATE: taxRate,
        };
        
        // Always set PRODUCT_NAME with size and properties for visibility in Bitrix24
        row.PRODUCT_NAME = productName || item.title || item.sku || 'Shopify item';
        
        // Set PRODUCT_ID if mapped (for linking to catalog)
        if (productId && productId !== 0) {
          row.PRODUCT_ID = productId;
        } else {
          console.warn(`[ORDER MAPPER] SKU ${item.sku || 'N/A'} not mapped, sending as custom row with name: ${productName}`);
        }
        
        productRows.push(row);
      }
    }
  }

  // Shipping as separate row - ONLY from shipping_lines, NEVER from line_items
  // Extract shipping price STRICTLY from shipping_lines to avoid confusion with regular products
  if (order.shipping_lines && Array.isArray(order.shipping_lines) && order.shipping_lines.length > 0) {
    // Get shipping from the first shipping_line (most reliable source)
    const shippingLine = order.shipping_lines[0];
    
    // CRITICAL VALIDATION: shipping_lines should NOT contain product information
    // If shipping_line has product-like fields (sku, variant_id, product_id), it's likely a data error
    if (shippingLine.sku || shippingLine.variant_id || shippingLine.product_id || shippingLine.line_item_id) {
      console.error(`[ORDER MAPPER] ERROR: shipping_line contains product data! This should NEVER happen. Skipping shipping to avoid confusion.`, shippingLine);
      // Don't process this as shipping - it's likely a product incorrectly placed in shipping_lines
      actualShippingPrice = 0;
      shippingLineTitle = null;
    } else {
      actualShippingPrice = Number(
        shippingLine.price ||
        shippingLine.price_set?.shop_money?.amount ||
        shippingLine.amount ||
        0
      );
      shippingLineTitle = shippingLine.title || shippingLine.code || 'Shipping';
    }
  } else {
    // Fallback: try to get from order-level shipping fields (less reliable)
    actualShippingPrice = Number(
      order.current_total_shipping_price_set?.shop_money?.amount ||
      order.total_shipping_price_set?.shop_money?.amount ||
      order.shipping_price ||
      0
    );
    shippingLineTitle = 'Shipping';
  }
  
  // Only add shipping row if we have actual shipping_lines OR explicit shipping price > 0
  // AND shipping price matches what we calculated (to avoid confusion with products)
  // AND shippingLineTitle is valid (not null, which would indicate invalid shipping data)
  const hasShippingLines = order.shipping_lines && Array.isArray(order.shipping_lines) && order.shipping_lines.length > 0;
  const hasExplicitShippingPrice = actualShippingPrice > 0 && Math.abs(actualShippingPrice - shippingPrice) < 0.01;
  const hasValidShippingTitle = shippingLineTitle && shippingLineTitle.trim().length > 0;
  
  if (actualShippingPrice > 0 && hasValidShippingTitle && (hasShippingLines || hasExplicitShippingPrice)) {
    // Use PRODUCT_ID for shipping (matching working script)
    const shippingProductId = BITRIX_CONFIG.SHIPPING_PRODUCT_ID > 0 
      ? BITRIX_CONFIG.SHIPPING_PRODUCT_ID 
      : 3000; // Default shipping product ID from working script
    
    const shippingName = shippingLineTitle || 'Shipping';
    
    productRows.push({
      PRODUCT_ID: shippingProductId, // Use shipping product ID (3000 from working script)
      PRODUCT_NAME: shippingName, // Explicit name for visibility
      PRICE: actualShippingPrice,
      QUANTITY: 1,
      DISCOUNT_TYPE_ID: 1,
      DISCOUNT_SUM: 0.0,
      TAX_INCLUDED: order.taxes_included ? 'Y' : 'N',
      TAX_RATE: 19.0, // Default tax rate for shipping
    });
    
    console.log(`[ORDER MAPPER] Added shipping row (PRODUCT_ID: ${shippingProductId}): ${shippingName}, Price: ${actualShippingPrice}`);
  } else if (shippingPrice > 0 && !hasShippingLines) {
    // Log warning if we have shipping price but no shipping_lines (potential data issue)
    console.warn(`[ORDER MAPPER] Shipping price detected (${shippingPrice}) but no shipping_lines found. Skipping shipping row to avoid confusion.`);
  }

  // Final validation: count products vs shipping
  const productRowsCount = productRows.length;
  const shippingRowsCount = productRows.filter(r => 
    r.PRODUCT_NAME && r.PRODUCT_NAME.toLowerCase().includes('shipping')
  ).length;
  const regularProductRowsCount = productRowsCount - shippingRowsCount;
  
  // Count expected items from Shopify
  const expectedLineItemsCount = order.line_items 
    ? order.line_items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
    : 0;
  const expectedShippingCount = (order.shipping_lines && order.shipping_lines.length > 0 && actualShippingPrice > 0) ? 1 : 0;
  const expectedTotalRows = expectedLineItemsCount + expectedShippingCount;
  
  // Log summary for debugging
  console.log(`[ORDER MAPPER] Order ${order.name || order.id} mapping summary:`);
  console.log(`  - Line items in Shopify: ${order.line_items?.length || 0} (total quantity: ${expectedLineItemsCount})`);
  console.log(`  - Shipping lines in Shopify: ${order.shipping_lines?.length || 0}`);
  console.log(`  - Product rows created: ${regularProductRowsCount}`);
  console.log(`  - Shipping rows created: ${shippingRowsCount}`);
  console.log(`  - Total rows: ${productRowsCount} (expected: ${expectedTotalRows})`);
  
  if (regularProductRowsCount !== expectedLineItemsCount) {
    console.warn(`[ORDER MAPPER] WARNING: Product rows count mismatch! Expected ${expectedLineItemsCount} from line_items, got ${regularProductRowsCount}`);
  }
  
  if (shippingRowsCount !== expectedShippingCount) {
    console.warn(`[ORDER MAPPER] WARNING: Shipping rows count mismatch! Expected ${expectedShippingCount}, got ${shippingRowsCount}`);
  }

  return { dealFields, productRows };
}
