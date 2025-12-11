// Get latest Shopify event
import { shopifyAdapter } from '../../../src/lib/adapters/shopify/index.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const latestEvent = shopifyAdapter.getLatestEvent();
    
    if (!latestEvent) {
      return res.status(200).json({
        success: true,
        message: 'no events'
      });
    }

    return res.status(200).json({
      success: true,
      event: latestEvent
    });
  } catch (error) {
    console.error('Get latest event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve latest event',
      message: error.message
    });
  }
}

