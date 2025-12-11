// Bitrix24 Webhook endpoint - receives events from Bitrix and syncs to Shopify
import { callShopifyAdmin, getOrder, updateOrder } from '../../../src/lib/shopify/adminClient.js';
import { callBitrix } from '../../../src/lib/bitrix/client.js';

// Configure body parser
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

/**
 * Handle deal update event from Bitrix
 * Syncs changes to Shopify order
 */
async function handleDealUpdate(deal) {
  console.log(`[BITRIX WEBHOOK] Handling deal update: ${deal.ID || deal.id}`);
  
  // Get Shopify order ID from deal
  const shopifyOrderId = deal.UF_SHOPIFY_ORDER_ID || deal.uf_shopify_order_id;
  if (!shopifyOrderId) {
    console.log(`[BITRIX WEBHOOK] Deal ${deal.ID || deal.id} has no UF_SHOPIFY_ORDER_ID, skipping Shopify sync`);
    return;
  }

  console.log(`[BITRIX WEBHOOK] Found Shopify order ID: ${shopifyOrderId} for deal ${deal.ID || deal.id}`);

  try {
    // Get current order from Shopify
    const shopifyOrder = await getOrder(shopifyOrderId);
    if (!shopifyOrder) {
      console.error(`[BITRIX WEBHOOK] Order ${shopifyOrderId} not found in Shopify`);
      return;
    }

    const updateData = {};
    let needsUpdate = false;

    // 1. Sync fulfillment status (delivery status)
    // Map Bitrix stage to Shopify fulfillment_status
    const stageId = deal.STAGE_ID || deal.stage_id;
    if (stageId) {
      // Check if stage indicates "delivered" or "shipped"
      // You may need to adjust these stage IDs based on your Bitrix configuration
      const deliveredStages = ['C2:WON', 'C8:WON', 'C2:PREPARATION', 'C8:PREPARATION'];
      const shippedStages = ['C2:PREPARATION', 'C8:PREPARATION'];
      
      if (deliveredStages.includes(stageId)) {
        // If order is marked as delivered/shipped in Bitrix, update fulfillment in Shopify
        if (shopifyOrder.fulfillment_status !== 'fulfilled' && shopifyOrder.fulfillment_status !== 'partial') {
          // Try to create fulfillment using FulfillmentService API (simpler approach)
          try {
            // Get fulfillment orders first
            const fulfillmentOrdersResp = await callShopifyAdmin(`/orders/${shopifyOrderId}/fulfillment_orders.json`);
            const fulfillmentOrders = fulfillmentOrdersResp.fulfillment_orders || [];
            
            if (fulfillmentOrders.length > 0) {
              const fulfillmentOrder = fulfillmentOrders[0];
              const trackNumber = deal.UF_CRM_1741776378819 || deal.uf_crm_1741776378819 || null;
              
              // Create fulfillment using fulfillment_order_id
              await callShopifyAdmin(`/fulfillments.json`, {
                method: 'POST',
                body: JSON.stringify({
                  fulfillment: {
                    notify_customer: true,
                    tracking_info: trackNumber ? {
                      number: trackNumber,
                      company: null
                    } : null,
                    line_items_by_fulfillment_order: [{
                      fulfillment_order_id: fulfillmentOrder.id
                    }]
                  }
                })
              });
              console.log(`[BITRIX WEBHOOK] ✅ Created fulfillment for order ${shopifyOrderId}`);
            } else {
              // No fulfillment orders - add note instead
              updateData.note = shopifyOrder.note 
                ? `${shopifyOrder.note}\nOrder status updated in Bitrix: ${stageId}`
                : `Order status updated in Bitrix: ${stageId}`;
              needsUpdate = true;
            }
          } catch (fulfillmentError) {
            console.error(`[BITRIX WEBHOOK] Error creating fulfillment:`, fulfillmentError);
            // Fallback: just update order note
            updateData.note = shopifyOrder.note 
              ? `${shopifyOrder.note}\nOrder status updated in Bitrix: ${stageId}`
              : `Order status updated in Bitrix: ${stageId}`;
            needsUpdate = true;
          }
        }
      }
    }

    // 2. Sync order amount if changed (for refunds)
    const dealAmount = Number(deal.OPPORTUNITY || deal.opportunity || 0);
    const shopifyAmount = Number(shopifyOrder.total_price || 0);
    
    if (dealAmount < shopifyAmount && dealAmount > 0) {
      // Amount decreased - likely a refund
      const refundAmount = shopifyAmount - dealAmount;
      console.log(`[BITRIX WEBHOOK] Detected refund amount: ${refundAmount}`);
      
      // Note: Creating refunds via API requires specific permissions
      // For now, we'll add a note to the order
      const refundNote = `Refund processed in Bitrix: ${refundAmount} ${shopifyOrder.currency}`;
      updateData.note = shopifyOrder.note 
        ? `${shopifyOrder.note}\n${refundNote}`
        : refundNote;
      needsUpdate = true;
    }

    // 3. Sync tracking number if available
    const trackNumber = deal.UF_CRM_1741776378819 || deal.uf_crm_1741776378819;
    if (trackNumber && shopifyOrder.fulfillments && shopifyOrder.fulfillments.length > 0) {
      const fulfillment = shopifyOrder.fulfillments[0];
      if (fulfillment.tracking_number !== trackNumber) {
        try {
          await callShopifyAdmin(`/orders/${shopifyOrderId}/fulfillments/${fulfillment.id}.json`, {
            method: 'PUT',
            body: JSON.stringify({
              fulfillment: {
                tracking_number: trackNumber,
                notify_customer: true
              }
            })
          });
          console.log(`[BITRIX WEBHOOK] ✅ Updated tracking number: ${trackNumber}`);
        } catch (trackError) {
          console.error(`[BITRIX WEBHOOK] Error updating tracking:`, trackError);
        }
      }
    }

    // 4. Update order if needed
    if (needsUpdate && Object.keys(updateData).length > 0) {
      await updateOrder(shopifyOrderId, updateData);
      console.log(`[BITRIX WEBHOOK] ✅ Updated order ${shopifyOrderId} in Shopify`);
    }

  } catch (error) {
    console.error(`[BITRIX WEBHOOK] Error syncing deal ${deal.ID || deal.id} to Shopify:`, error);
    throw error;
  }
}

/**
 * Handle deal creation event from Bitrix
 * Usually not needed as deals are created from Shopify, but handle for completeness
 */
async function handleDealCreate(deal) {
  console.log(`[BITRIX WEBHOOK] Handling deal create: ${deal.ID || deal.id}`);
  // Deals are typically created from Shopify, so this is usually a no-op
  // But we can log it for monitoring
}

/**
 * Main webhook handler
 */
export default async function handler(req, res) {
  console.log(`[BITRIX WEBHOOK] ===== INCOMING REQUEST =====`);
  console.log(`[BITRIX WEBHOOK] Method: ${req.method}`);
  console.log(`[BITRIX WEBHOOK] Headers:`, {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent']
  });
  
  if (req.method !== 'POST') {
    console.log(`[BITRIX WEBHOOK] ❌ Method not allowed: ${req.method}`);
    res.status(405).end('Method not allowed');
    return;
  }

  const event = req.body;
  const eventType = event.event || event.EVENT || 'unknown';

  console.log(`[BITRIX WEBHOOK] Event type: ${eventType}`);
  console.log(`[BITRIX WEBHOOK] Event data:`, JSON.stringify(event, null, 2));

  try {
    // Bitrix webhook format: { event: 'ONCRMDEALUPDATE', data: { FIELDS: {...} } }
    // Or direct format: { ID: ..., STAGE_ID: ..., ... }
    
    let deal = null;
    if (event.data && event.data.FIELDS) {
      deal = event.data.FIELDS;
    } else if (event.FIELDS) {
      deal = event.FIELDS;
    } else {
      deal = event; // Direct deal object
    }

    if (!deal || (!deal.ID && !deal.id)) {
      console.error(`[BITRIX WEBHOOK] Invalid event format: no deal ID found`);
      res.status(400).json({ error: 'Invalid event format' });
      return;
    }

    // Route based on event type
    if (eventType === 'ONCRMDEALUPDATE' || eventType.includes('UPDATE')) {
      await handleDealUpdate(deal);
    } else if (eventType === 'ONCRMDEALADD' || eventType.includes('ADD')) {
      await handleDealCreate(deal);
    } else {
      console.log(`[BITRIX WEBHOOK] Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ success: true, message: 'Event processed' });
  } catch (e) {
    console.error('[BITRIX WEBHOOK] Error:', e);
    res.status(500).json({ error: 'Internal server error', message: e.message });
  }
}

