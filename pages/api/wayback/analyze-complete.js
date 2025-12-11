// API endpoint for complete domain analysis (spam, backlinks, topics, metrics)
import { waybackAdapter } from '../../../src/lib/adapters/wayback/index.js';
import { combineStopWords, parseStopWords, defaultStopWords } from '../../../src/lib/adapters/wayback/stopWords.js';

// Global storage for domain statuses (shared across requests in same process)
if (typeof global.domainStatusStorage === 'undefined') {
  global.domainStatusStorage = new Map();
}

// Global storage for complete analysis results
if (typeof global.completeAnalysisResults === 'undefined') {
  global.completeAnalysisResults = new Map();
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
      });
    });

    // Combine stop words
    const customStopWords = stopWords ? parseStopWords(stopWords) : [];
    const combinedStopWords = combineStopWords(defaultStopWords, customStopWords);

    addLog(`Starting complete analysis for ${domains.length} domain(s)...`);

    // Start analysis in background (non-blocking)
    const analyzePromise = (async () => {
      try {
        const statusUpdate = (statusData) => {
          domainStatuses.set(statusData.domain, statusData);
        };

        const results = await waybackAdapter.analyzeDomainsComplete(
          domains,
          combinedStopWords,
          maxSnapshots || 10,
          addLog,
          statusUpdate,
          2 // Max 2 concurrent due to API calls
        );

        // Store complete results
        global.completeAnalysisResults.set(sessionId, results);

        addLog(`Complete analysis finished for ${results.length} domain(s)`);
      } catch (error) {
        addLog(`❌ Analysis error: ${error.message}`, 'error');
      }
    })();

    // Return immediately (non-blocking)
    return res.status(200).json({
      success: true,
      message: 'Complete analysis started',
      sessionId,
      logs,
    });

  } catch (error) {
    addLog(`❌ Error: ${error.message}`, 'error');
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      logs,
    });
  }
}

