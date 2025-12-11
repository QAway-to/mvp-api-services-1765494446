// Root API endpoint
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  return res.status(200).json({
    message: 'Shopify middleware is running.',
    endpoints: {
      webhook: 'POST /api/webhook/shopify',
      events: 'GET /api/events',
      latest: 'GET /api/events/latest'
    }
  });
}

