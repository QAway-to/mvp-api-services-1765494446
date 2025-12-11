// API endpoint for Wayback Machine
import { waybackAdapter } from '../../../src/lib/adapters/wayback/index.js';

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
    const { target } = req.body;

    if (!target) {
      return res.status(400).json({ 
        error: 'Target is required',
        logs: [{ timestamp: new Date().toISOString(), type: 'error', message: 'Target is required' }]
      });
    }

    addLog(`Starting Wayback test for: ${target}`, 'info');

    try {
      addLog('Fetching snapshots from CDX API...', 'info');
      const result = await waybackAdapter.testWayback(target);
      
      if (result.snapshotsCount === 0) {
        addLog('⚠️ No snapshots found for this target', 'warning');
      } else {
        addLog(`✅ Found ${result.snapshotsCount} snapshots`, 'success');
        if (result.firstSnapshotTimestamp) {
          addLog(`✅ First snapshot: ${result.firstSnapshotTimestamp}`, 'success');
          addLog(`✅ HTML length: ${result.firstSnapshotHtmlLength} bytes`, 'success');
        }
      }

      return res.status(200).json({
        success: true,
        data: [result], // Wrap in array for consistency
        metadata: {
          target: target,
          snapshotsCount: result.snapshotsCount,
          timestamp: new Date().toISOString(),
        },
        count: 1,
        logs: logs,
      });
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      if (error.stack) {
        addLog(`Stack: ${error.stack}`, 'error');
      }
      throw error;
    }
  } catch (error) {
    addLog(`❌ Fatal error: ${error.message}`, 'error');
    if (error.stack) {
      addLog(`Stack: ${error.stack}`, 'error');
    }
    
    console.error('Wayback error:', error);
    return res.status(500).json({
      error: 'Wayback test failed',
      message: error.message,
      details: error.stack || error.toString(),
      logs: logs,
    });
  }
}

