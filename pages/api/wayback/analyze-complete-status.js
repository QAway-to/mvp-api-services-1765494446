// API endpoint for getting real-time complete analysis status via SSE
// Similar to analyze-spam-status but also handles complete analysis results

// Global storage for domain statuses and results
if (typeof global.domainStatusStorage === 'undefined') {
  global.domainStatusStorage = new Map();
}
if (typeof global.completeAnalysisResults === 'undefined') {
  global.completeAnalysisResults = new Map();
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
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Polling interval
  const pollInterval = 300; // Faster polling for real-time updates
  let lastUpdateTime = Date.now();
  
  let lastStatusHash = '';
  let lastResultsHash = '';
  
  const checkAndSendUpdates = () => {
    try {
      if (res.closed) {
        return;
      }
      
      const statuses = global.domainStatusStorage.get(sessionId);
      const results = global.completeAnalysisResults.get(sessionId);
      
      if (statuses) {
        const statusArray = Array.from(statuses.values());
        
        // Create hash of current status to detect changes (include more details)
        const statusHash = JSON.stringify(statusArray.map(d => ({ 
          domain: d.domain, 
          status: d.status,
          lastMessage: d.lastMessage,
          snapshotsFound: d.snapshotsFound,
          snapshotsAnalyzed: d.snapshotsAnalyzed,
        })));
        
        // Check if we have complete results
        if (results && results.length > 0) {
          const resultsHash = JSON.stringify(results.map(r => ({ domain: r.domain, status: r.status })));
          
          // Check if all domains are complete
          const allComplete = statusArray.every(d => 
            ['COMPLETE', 'UNAVAILABLE', 'NO_SNAPSHOTS'].includes(d.status)
          );
          
          if (allComplete && resultsHash !== lastResultsHash) {
            // Send complete results with all data merged from status and results
            res.write(`data: ${JSON.stringify({ 
              type: 'complete', 
              domains: results.map(r => {
                const statusData = statuses.get(r.domain);
                return {
                  ...r,
                  currentStatus: statusData?.status || r.status,
                  lastMessage: statusData?.lastMessage || r.recommendationReason || r.error || 'Analysis complete',
                  snapshotsFound: r.snapshotsFound !== undefined ? r.snapshotsFound : (statusData?.snapshotsFound || 0),
                  snapshotsAnalyzed: r.snapshotsAnalyzed !== undefined ? r.snapshotsAnalyzed : (statusData?.snapshotsAnalyzed || 0),
                  maxSpamScore: r.maxSpamScore !== undefined ? r.maxSpamScore : (statusData?.maxSpamScore || r.spamAnalysis?.maxSpamScore),
                  avgSpamScore: r.avgSpamScore !== undefined ? r.avgSpamScore : (statusData?.avgSpamScore || r.spamAnalysis?.avgSpamScore),
                };
              })
            })}\n\n`);
            
            lastResultsHash = resultsHash;
            // Don't clear immediately - allow client to see final status
            setTimeout(() => {
              global.completeAnalysisResults.delete(sessionId);
            }, 5000);
            return;
          }
        }
        
        // Send status updates if changed (always send updates for real-time feel)
        if (statusHash !== lastStatusHash || statusArray.length > 0) {
          res.write(`data: ${JSON.stringify({ type: 'status', domains: statusArray })}\n\n`);
          lastStatusHash = statusHash;
          lastUpdateTime = Date.now();
        }
      }
    } catch (error) {
      console.error('Error sending SSE update:', error);
      if (!res.closed) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      }
    }
  };

  // Send initial status if available
  checkAndSendUpdates();

  // Set up interval
  const intervalId = setInterval(() => {
    if (res.closed) {
      clearInterval(intervalId);
      return;
    }
    checkAndSendUpdates();
  }, pollInterval);

  // Keepalive
  const keepaliveId = setInterval(() => {
    if (res.closed) {
      clearInterval(keepaliveId);
      return;
    }
    res.write(`: keepalive\n\n`);
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    clearInterval(keepaliveId);
    setTimeout(() => {
      if (global.domainStatusStorage.has(sessionId)) {
        global.domainStatusStorage.delete(sessionId);
      }
      if (global.completeAnalysisResults.has(sessionId)) {
        global.completeAnalysisResults.delete(sessionId);
      }
    }, 300000);
  });
}

