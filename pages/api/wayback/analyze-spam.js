// API endpoint for spam analysis of drop domains
import { waybackAdapter } from '../../../src/lib/adapters/wayback/index.js';
import { combineStopWords, parseStopWords, defaultStopWords } from '../../../src/lib/adapters/wayback/stopWords.js';

// Global storage for domain statuses (shared across requests in same process)
if (typeof global.domainStatusStorage === 'undefined') {
  global.domainStatusStorage = new Map();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const logs = [];
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    logs.push({ timestamp, type, message });
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  try {
    const { domains, stopWords, maxSnapshots, sessionId } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'domains array is required',
        logs: [{ timestamp: new Date().toISOString(), type: 'error', message: 'domains array is required' }]
      });
    }

    if (!sessionId) {
      return res.status(400).json({ 
        error: 'sessionId is required for real-time updates',
        logs: [{ timestamp: new Date().toISOString(), type: 'error', message: 'sessionId is required' }]
      });
    }

    // Initialize status storage for this session
    const domainStatuses = new Map();
    global.domainStatusStorage.set(sessionId, domainStatuses);

    // Initialize all domains as QUEUED
    domains.forEach(domain => {
      const trimmed = domain.trim();
      if (!trimmed) return;
      domainStatuses.set(trimmed, {
        domain: trimmed,
        status: 'QUEUED',
        lastMessage: 'Waiting to start...',
        snapshotsFound: 0,
        snapshotsAnalyzed: 0,
      });
    });

    // Parse stop words
    let finalStopWords = defaultStopWords;
    if (stopWords) {
      if (typeof stopWords === 'string') {
        finalStopWords = combineStopWords(parseStopWords(stopWords));
      } else if (Array.isArray(stopWords)) {
        finalStopWords = combineStopWords(stopWords);
      }
    }

    const snapshotsLimit = maxSnapshots || 10;

    addLog(`Starting spam analysis for ${domains.length} domain(s)`, 'info');
    addLog(`Using ${finalStopWords.length} stop words`, 'info');
    addLog(`Max snapshots per domain: ${snapshotsLimit}`, 'info');

    // Status callback to update domain statuses in global storage
    const statusCallback = (domainStatus) => {
      domainStatuses.set(domainStatus.domain, domainStatus);
    };

    // Start analysis asynchronously (don't wait for it)
    waybackAdapter.analyzeDomainsForSpam(
      domains,
      finalStopWords,
      snapshotsLimit,
      (msg) => addLog(msg, 'info'),
      statusCallback,
      3 // maxConcurrent = 3
    ).then(results => {
      // Analysis complete - statuses are already updated via callback
      addLog(`✅ Analysis complete`, 'success');
    }).catch(error => {
      addLog(`❌ Error: ${error.message}`, 'error');
      if (error.stack) {
        addLog(`Stack: ${error.stack}`, 'error');
      }
    });

    // Return immediately with sessionId
    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      message: 'Analysis started. Use /api/wayback/analyze-spam-status?sessionId=' + sessionId + ' for real-time updates',
    });
  } catch (error) {
    addLog(`❌ Fatal error: ${error.message}`, 'error');
    if (error.stack) {
      addLog(`Stack: ${error.stack}`, 'error');
    }
    
    console.error('Spam analysis error:', error);
    return res.status(500).json({
      error: 'Spam analysis failed',
      message: error.message,
      details: error.stack || error.toString(),
      logs: logs,
    });
  }
}

