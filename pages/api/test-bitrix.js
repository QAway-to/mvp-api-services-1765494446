// Test endpoint for Bitrix24 integration
// Sends mock Shopify order data to test the integration

import { getBitrixWebhookUrl } from '../../src/lib/bitrix/client.js';
import { mapShopifyOrderToBitrixDealFields } from '../../src/lib/bitrix/dealMapper.js';
import { upsertBitrixContact } from '../../src/lib/bitrix/contact.js';
import { callBitrixAPI } from '../../src/lib/bitrix/client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const logs = [];
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    logs.push({ timestamp, type, message });
    console.log(`[TEST BITRIX] [${type.toUpperCase()}] ${message}`);
  };

  try {
    addLog('Starting test Bitrix integration', 'info');

    // Mock Shopify order data
    const mockOrder = {
      id: 999999999,
      order_number: 9999,
      name: '#9999',
      email: 'test@example.com',
      currency: 'EUR',
      total_price: '24.00',
      total_tax: '3.84',
      taxes_included: true,
      financial_status: 'paid',
      source_name: 'shopify_draft_order',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer: {
        id: 123456,
        first_name: 'John',
        last_name: 'Smith',
        email: 'test@example.com'
      },
      line_items: [
        {
          id: 866550311766439000,
          title: 'Test Product 1',
          quantity: 1,
          price: '12.00',
          sku: 'TEST001'
        },
        {
          id: 789012345678901200,
          title: 'Test Product 2',
          quantity: 1,
          price: '12.00',
          sku: 'TEST002'
        }
      ],
      shipping_lines: [
        {
          price: '6.00'
        }
      ],
      discount_codes: [
        {
          code: 'TEST',
          amount: '2.00'
        }
      ]
    };

    addLog(`Mock order created: #${mockOrder.order_number}`, 'info');

    // Get Bitrix webhook URL
    const bitrixWebhookUrl = getBitrixWebhookUrl();
    addLog('Using Bitrix webhook (URL hidden for security)', 'info');

    // Step 1: Upsert contact
    let contactId = null;
    try {
      addLog('Upserting contact...', 'info');
      contactId = await upsertBitrixContact(bitrixWebhookUrl, mockOrder);
      if (contactId) {
        addLog(`Contact ID: ${contactId}`, 'success');
      }
    } catch (contactError) {
      addLog(`Contact error (non-blocking): ${contactError.message}`, 'warning');
    }

    // Step 2: Map to Bitrix deal fields
    addLog('Mapping order to Bitrix deal fields...', 'info');
    const dealFields = mapShopifyOrderToBitrixDealFields(mockOrder, contactId);

    // Step 3: Create deal
    let dealId = null;
    try {
      addLog('Creating deal in Bitrix...', 'info');
      const dealResult = await callBitrixAPI(bitrixWebhookUrl, 'crm.deal.add', { fields: dealFields });
      
      if (dealResult.result) {
        dealId = parseInt(dealResult.result);
        addLog(`Deal created successfully. Deal ID: ${dealId}`, 'success');
      } else {
        throw new Error('No deal ID in response');
      }
    } catch (dealError) {
      addLog(`Failed to create deal: ${dealError.message}`, 'error');
      return res.status(500).json({
        ok: false,
        error: 'Failed to create deal',
        message: dealError.message,
        logs: logs
      });
    }

    // Step 4: Add product rows (minimal implementation)
    if (dealId && mockOrder.line_items && mockOrder.line_items.length > 0) {
      try {
        addLog('Adding product rows...', 'info');
        const item = mockOrder.line_items[0];
        
        const rows = [
          {
            PRODUCT_ID: 1, // Hardcoded for testing
            PRICE: Number(item.price),
            QUANTITY: item.quantity
          }
        ];

        addLog(`Calling crm.deal.productrows.set with deal ID: ${dealId}`, 'info');
        const productRowsResult = await callBitrixAPI(bitrixWebhookUrl, 'crm.deal.productrows.set', {
          id: dealId,
          rows: rows
        });

        if (productRowsResult.result) {
          addLog(`Product rows added successfully`, 'success');
        } else {
          addLog(`Product rows result: ${JSON.stringify(productRowsResult)}`, 'warning');
        }
      } catch (productRowsError) {
        addLog(`Product rows error (non-blocking): ${productRowsError.message}`, 'error');
        // Don't throw - deal is already created
      }
    }

    return res.status(200).json({
      ok: true,
      dealId: dealId,
      contactId: contactId,
      message: 'Test integration completed',
      logs: logs
    });

  } catch (error) {
    addLog(`Fatal error: ${error.message}`, 'error');
    if (error.stack) {
      addLog(`Stack: ${error.stack}`, 'error');
    }
    
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      message: error.message,
      logs: logs
    });
  }
}

