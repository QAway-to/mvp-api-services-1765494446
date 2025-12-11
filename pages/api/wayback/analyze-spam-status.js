// API endpoint for getting real-time domain analysis status via SSE
// This endpoint uses Server-Sent Events to stream status updates to the client

// Global storage for domain statuses (shared across requests in same process)
// In production, this should be Redis or a database
if (typeof global.domainStatusStorage === 'undefined') {
  global.domainStatusStorage = new Map();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId query parameter is required' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Polling interval to check for status updates
  const pollInterval = 500; // 500ms
  let lastUpdateTime = Date.now();

  const checkAndSendUpdates = () => {
    try {
      const statuses = global.domainStatusStorage.get(sessionId);
      
      if (statuses) {
        const statusArray = Array.from(statuses.values());
        res.write(`data: ${JSON.stringify({ type: 'status', domains: statusArray })}\n\n`);
        lastUpdateTime = Date.now();
      }
    } catch (error) {
      console.error('Error sending SSE update:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    }
  };

  // Send initial status if available
  checkAndSendUpdates();

  // Set up interval to send updates
  const intervalId = setInterval(() => {
    if (res.closed) {
      clearInterval(intervalId);
      return;
    }
    checkAndSendUpdates();
  }, pollInterval);

  // Send keepalive every 30 seconds
  const keepaliveId = setInterval(() => {
    if (res.closed) {
      clearInterval(keepaliveId);
      return;
    }
    res.write(`: keepalive\n\n`);
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    clearInterval(keepaliveId);
    // Optionally clean up old session data after some time
    setTimeout(() => {
      if (global.domainStatusStorage.has(sessionId)) {
        global.domainStatusStorage.delete(sessionId);
      }
    }, 300000); // 5 minutes
  });
}

