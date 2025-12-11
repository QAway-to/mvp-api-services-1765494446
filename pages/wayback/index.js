import Head from 'next/head';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import WaybackForm from '../../src/components/wayback/WaybackForm';
import WaybackResults from '../../src/components/wayback/WaybackResults';
import WaybackLogs from '../../src/components/wayback/WaybackLogs';
import SpamAnalysisForm from '../../src/components/wayback/SpamAnalysisForm';
import SpamAnalysisResults from '../../src/components/wayback/SpamAnalysisResults';
import DomainStatusList from '../../src/components/wayback/DomainStatusList';
import DomainMetricsPanel from '../../src/components/wayback/DomainMetricsPanel';
import BacklinkAnalysisPanel from '../../src/components/wayback/BacklinkAnalysisPanel';
import TopicAnalysisPanel from '../../src/components/wayback/TopicAnalysisPanel';
import DomainRecommendationsTable from '../../src/components/wayback/DomainRecommendationsTable';

export default function WaybackPage() {
  const [mode, setMode] = useState('test'); // 'test' or 'analyze'
  const [result, setResult] = useState(null);
  const [spamResults, setSpamResults] = useState(null);
  const [spamSummary, setSpamSummary] = useState(null);
  const [domainStatuses, setDomainStatuses] = useState([]);
  const [completeAnalysisResults, setCompleteAnalysisResults] = useState([]);
  const [analysisMode, setAnalysisMode] = useState('spam');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const eventSourceRef = useRef(null);

  const handleTest = async (target) => {
    setIsLoading(true);
    setError(null);
    setLogs([]);
    setResult(null);
    setSpamResults(null);
    setSpamSummary(null);

    try {
      const response = await fetch('/api/wayback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target }),
      });

      const data = await response.json();

      // Always set logs if available
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }

      if (data.success) {
        setResult(data.data[0]);
      } else {
        const errorMsg = data.message || data.error || 'Unknown error';
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Wayback test error:', err);
      const errorMsg = err.message || 'Network error or invalid response';
      setError(errorMsg);
      
      // Try to parse error response
      try {
        if (err.response) {
          const errorText = await err.response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.logs) {
                setLogs(errorJson.logs);
              }
            } catch (e) {
              // Not JSON
            }
          }
        }
      } catch (e) {
        // Ignore
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup SSE connection on unmount or when starting new analysis
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleSpamAnalysis = async ({ domains, stopWords, maxSnapshots, analysisMode = 'spam' }) => {
    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setLogs([]);
    setResult(null);
    setSpamResults(null);
    setSpamSummary(null);
    setDomainStatuses([]);
    setCompleteAnalysisResults([]);
    setAnalysisMode(analysisMode || 'spam');

    // Generate session ID for real-time updates
    const sessionId = `spam-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize domain statuses as QUEUED
    const initialStatuses = domains.map(domain => ({
      domain: domain.trim(),
      status: 'QUEUED',
      lastMessage: 'Waiting to start...',
      snapshotsFound: 0,
      snapshotsAnalyzed: 0,
    }));
    setDomainStatuses(initialStatuses);

    try {
      // Choose API endpoint based on analysis mode
      const apiEndpoint = analysisMode === 'complete' 
        ? '/api/wayback/analyze-complete' 
        : '/api/wayback/analyze-spam';
      
      // Start analysis (returns immediately)
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains, stopWords, maxSnapshots, sessionId }),
      });

      const data = await response.json();

      if (!data.success) {
        const errorMsg = data.message || data.error || 'Unknown error';
        setError(errorMsg);
        setIsLoading(false);
        return;
      }

      // Connect to SSE endpoint for real-time updates
      const statusEndpoint = analysisMode === 'complete' 
        ? `/api/wayback/analyze-complete-status?sessionId=${sessionId}`
        : `/api/wayback/analyze-spam-status?sessionId=${sessionId}`;
      
      const eventSource = new EventSource(statusEndpoint);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          
          // Handle complete analysis results (specific to complete mode)
          if (update.type === 'complete' && update.domains) {
            setCompleteAnalysisResults(update.domains);
            setIsLoading(false);
            eventSource.close();
            eventSourceRef.current = null;
            return;
          }
          
          // Handle domain status updates (for complete mode - single domain update)
          if (update.type === 'update' && update.domain) {
            setDomainStatuses(prevStatuses => {
              const existing = prevStatuses.find(d => d.domain === update.domain);
              if (existing) {
                return prevStatuses.map(d => 
                  d.domain === update.domain ? { ...d, ...update } : d
                );
              } else {
                return [...prevStatuses, update];
              }
            });
            return;
          }
          
          // Handle status updates (both spam and complete mode - batch updates)
          if (update.type === 'status' && update.domains && Array.isArray(update.domains)) {
            // Update domain statuses (real-time update)
            setDomainStatuses(prevStatuses => {
              // Validate and normalize domains data
              const validDomains = update.domains
                .filter(d => d && typeof d === 'object' && d.domain && typeof d.domain === 'string')
                .map(d => ({
                  domain: String(d.domain),
                  status: String(d.status || 'QUEUED'),
                  lastMessage: d.lastMessage ? String(d.lastMessage) : '',
                  snapshotsFound: typeof d.snapshotsFound === 'number' ? d.snapshotsFound : undefined,
                  snapshotsAnalyzed: typeof d.snapshotsAnalyzed === 'number' ? d.snapshotsAnalyzed : undefined,
                  spamSnapshots: typeof d.spamSnapshots === 'number' ? d.spamSnapshots : undefined,
                  maxSpamScore: typeof d.maxSpamScore === 'number' ? d.maxSpamScore : undefined,
                  avgSpamScore: typeof d.avgSpamScore === 'number' ? d.avgSpamScore : undefined,
                  stopWordsFound: Array.isArray(d.stopWordsFound) ? d.stopWordsFound : undefined,
                  error: d.error ? String(d.error) : undefined,
                }));
              
              // Create a map of new statuses
              const newStatusMap = new Map(validDomains.map(d => [d.domain, d]));
              
              // Merge with previous to preserve order and update only changed domains
              const updated = prevStatuses.map(prev => {
                if (!prev || !prev.domain) return prev;
                const updatedDomain = newStatusMap.get(prev.domain);
                if (updatedDomain) {
                  // Normalize status to always be a string
                  const merged = { ...prev, ...updatedDomain };
                  if (merged.status && typeof merged.status !== 'string') {
                    merged.status = String(merged.status.status || merged.status.label || merged.status || 'QUEUED');
                  } else if (!merged.status) {
                    merged.status = 'QUEUED';
                  }
                  return merged;
                }
                // Ensure prev.status is also a string
                if (prev.status && typeof prev.status !== 'string') {
                  prev.status = String(prev.status.status || prev.status.label || prev.status || 'QUEUED');
                }
                return prev;
              }).filter(d => d && d.domain);
              
              // Add any new domains that weren't in previous list
              validDomains.forEach(newDomain => {
                if (!prevStatuses.find(d => d && d.domain === newDomain.domain)) {
                  updated.push(newDomain);
                }
              });
              
              return updated;
            });
            
            // Check if all domains are complete (for spam analysis)
            const allComplete = update.domains.every(d => 
              ['CLEAN', 'SUSPICIOUS', 'SPAM', 'UNAVAILABLE', 'NO_SNAPSHOTS', 'COMPLETE'].includes(d.status)
            );
            
            if (allComplete) {
              // Calculate summary
              const summary = {
                total: update.domains.length,
                clean: update.domains.filter(d => d.status === 'CLEAN').length,
                suspicious: update.domains.filter(d => d.status === 'SUSPICIOUS').length,
                spam: update.domains.filter(d => d.status === 'SPAM').length,
                unavailable: update.domains.filter(d => d.status === 'UNAVAILABLE').length,
                no_snapshots: update.domains.filter(d => d.status === 'NO_SNAPSHOTS').length,
              };
              
              // Convert to results format
              const results = update.domains.map(d => {
                // Calculate spam percentage
                const spamPercentage = d.snapshotsAnalyzed > 0 && d.spamSnapshots > 0
                  ? (d.spamSnapshots / d.snapshotsAnalyzed) * 100
                  : 0;
                
                return {
                  domain: d.domain,
                  status: d.status,
                  lastMessage: d.lastMessage,
                  snapshotsFound: d.snapshotsFound || 0,
                  snapshotsAnalyzed: d.snapshotsAnalyzed || 0,
                  spamSnapshots: d.spamSnapshots || 0,
                  maxSpamScore: d.maxSpamScore,
                  avgSpamScore: d.avgSpamScore,
                  spamPercentage: Math.round(spamPercentage * 100) / 100,
                  totalStopWordsFound: d.totalStopWordsFound !== undefined 
                    ? d.totalStopWordsFound 
                    : (d.stopWordsFound && d.stopWordsFound.length ? d.stopWordsFound.length : 0),
                  stopWordsFound: d.stopWordsFound || [],
                  firstSpamDate: d.firstSpamDate || null,
                  error: d.error || null,
                };
              });
              
              setSpamResults(results);
              setSpamSummary(summary);
              setIsLoading(false);
              eventSource.close();
              eventSourceRef.current = null;
            }
          } else if (update.type === 'error') {
            setError(update.message || 'Error receiving updates');
            eventSource.close();
            eventSourceRef.current = null;
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
          eventSourceRef.current = null;
          // Don't set loading to false immediately - might be temporary connection issue
        }
      };

    } catch (err) {
      console.error('Spam analysis error:', err);
      const errorMsg = err.message || 'Network error or invalid response';
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!spamResults || spamResults.length === 0) {
      alert('No data to export');
      return;
    }

    // CSV Headers
    const headers = [
      'Domain',
      'Status',
      'Snapshots Checked',
      'Spam Snapshots',
      'Spam Percentage',
      'Average Spam Score',
      'Total Stop Words Found',
      'Stop Words List',
      'First Spam Date',
      'Error',
    ];

    // CSV Rows
    const rows = spamResults.map(result => {
      const stopWordsList = result.stopWordsFound
        ? result.stopWordsFound.map(sw => `${sw.word}(${sw.count})`).join('; ')
        : '';
      
      const formatDate = (timestamp) => {
        if (!timestamp || timestamp.length < 8) return '';
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        return `${year}-${month}-${day}`;
      };

      return [
        result.domain || '',
        result.status || '',
        result.snapshotsAnalyzed || 0,
        result.spamSnapshots || 0,
        result.spamPercentage !== undefined && result.spamPercentage > 0 
          ? `${result.spamPercentage}%` 
          : '',
        result.avgSpamScore !== undefined && result.avgSpamScore !== null && result.avgSpamScore > 0
          ? result.avgSpamScore
          : '',
        result.totalStopWordsFound !== undefined && result.totalStopWordsFound !== null
          ? result.totalStopWordsFound
          : (result.stopWordsFound && result.stopWordsFound.length > 0 ? result.stopWordsFound.length : 0),
        stopWordsList,
        result.firstSpamDate ? formatDate(result.firstSpamDate) : '',
        result.error || '',
      ];
    });

    // Create CSV content
    const csvRows = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => {
          const strValue = cell === null || cell === undefined ? '' : String(cell);
          return `"${strValue.replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `spam_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <>
      <Head>
        <title>Wayback Machine - API Services</title>
        <meta name="description" content="Test Wayback Machine API integration" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <main className="page">
        <header className="page-header">
          <div>
            <h1>Wayback Machine</h1>
            <p className="subtitle">
              Access archived website snapshots and analyze historical content
            </p>
          </div>
          <div className="header-actions">
            <Link href="/" className="btn">
              ← Back
            </Link>
          </div>
        </header>

        {/* Mode Switcher */}
        <div className="card">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <button
              onClick={() => {
                setMode('test');
                setResult(null);
                setSpamResults(null);
                setSpamSummary(null);
                setError(null);
                setLogs([]);
                setDomainStatuses([]);
              }}
              className={mode === 'test' ? 'btn btn-primary' : 'btn'}
              style={{ flex: 1 }}
            >
              Test Snapshots
            </button>
            <button
              onClick={() => {
                setMode('analyze');
                setResult(null);
                setSpamResults(null);
                setSpamSummary(null);
                setError(null);
                setLogs([]);
                setDomainStatuses([]);
              }}
              className={mode === 'analyze' ? 'btn btn-primary' : 'btn'}
              style={{ flex: 1 }}
            >
              Analyze for Spam
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="card">
          <header className="card-header">
            <h2>{mode === 'test' ? 'Test Snapshots' : 'Spam Analysis'}</h2>
          </header>
          {mode === 'test' ? (
            <WaybackForm onTest={handleTest} isLoading={isLoading} />
          ) : (
            <SpamAnalysisForm onAnalyze={handleSpamAnalysis} isLoading={isLoading} />
          )}
          {error && (
            <div className="alert alert-error" style={{ marginTop: '20px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>❌ Error: {error}</div>
              {logs.length > 0 && (
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                  Check logs below for detailed information
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <WaybackLogs logs={logs} />
        )}

        {/* Test Results */}
        {mode === 'test' && result && (
          <WaybackResults result={result} />
        )}

        {/* Spam Analysis Results - Domain Status List */}
        {mode === 'analyze' && domainStatuses && Array.isArray(domainStatuses) && domainStatuses.length > 0 && (
          <DomainStatusList 
            domains={domainStatuses.filter(d => d && typeof d === 'object' && d.domain)}
            summary={spamSummary}
          />
        )}

        {/* Legacy Spam Analysis Results (for CSV export) */}
        {mode === 'analyze' && analysisMode === 'spam' && spamResults && spamResults.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={handleExportCSV}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              📥 Export to CSV
            </button>
          </div>
        )}

        {/* Complete Analysis Results */}
        {mode === 'analyze' && analysisMode === 'complete' && completeAnalysisResults.length > 0 && (
          <>
            <DomainRecommendationsTable domains={completeAnalysisResults} />
            
            {completeAnalysisResults.map((domainResult, index) => (
              <div key={index} style={{ marginTop: '24px' }}>
                <h2 style={{ marginBottom: '16px', fontSize: '1.5rem', color: '#f1f5f9' }}>
                  {domainResult.domain}
                </h2>
                
                {domainResult.metrics && (
                  <DomainMetricsPanel metrics={domainResult} />
                )}
                
                {domainResult.backlinkAnalysis && (
                  <BacklinkAnalysisPanel backlinkAnalysis={domainResult} />
                )}
                
                {domainResult.topicAnalysis && (
                  <TopicAnalysisPanel topicAnalysis={domainResult} />
                )}
              </div>
            ))}
          </>
        )}

      </main>
    </>
  );
}

