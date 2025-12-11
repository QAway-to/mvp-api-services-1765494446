// Get all Shopify events
import { shopifyAdapter } from '../../src/lib/adapters/shopify/index.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const events = shopifyAdapter.getAllEvents();
    
    return res.status(200).json({
      success: true,
      events: events,
      count: events.length
    });
  } catch (error) {
    console.error('Get events error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve events',
      message: error.message
    });
  }
}

